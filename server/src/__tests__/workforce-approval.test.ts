import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { toolActionRequests, workflowStepRuns, workforceOutboundDeliveries } from "@paperclipai/db";
import { describeWorkforce, seedWorkforceCompany, useWorkforceDb, workflowSvc } from "./helpers/workforce-fixture.js";

describeWorkforce("workforce approval", () => {
  const ctx = useWorkforceDb("workforce-approval-");

  async function pausedRun(name: string) {
    const seeded = await seedWorkforceCompany(ctx.db, name);
    const svc = workflowSvc(ctx.db);
    const created = await svc.createDefinition(seeded.companyId, { template: "sachi-daily" });
    const run = await ctx.db.transaction(async (tx) => svc.startRun(tx, {
      companyId: seeded.companyId,
      definitionId: created.definition.id,
      agentId: seeded.agentId,
    }));
    const [approval] = await svc.listApprovals(seeded.companyId);
    return { ...seeded, svc, run, approval };
  }

  async function deliveryCount(companyId: string) {
    const rows = await ctx.db.select().from(workforceOutboundDeliveries).where(eq(workforceOutboundDeliveries.companyId, companyId));
    return rows.length;
  }

  it("sends once and a second resume does not add a delivery", async () => {
    const { companyId, svc, approval } = await pausedRun("Send");
    expect(approval?.payload?.subject).toBe("Daily sales outreach");
    await svc.decideApproval(companyId, approval!.id, "approve");
    expect(await deliveryCount(companyId)).toBe(1);
    await svc.decideApproval(companyId, approval!.id, "approve");
    expect(await deliveryCount(companyId)).toBe(1);
  });

  it("reject and expire add no delivery", async () => {
    const rejected = await pausedRun("Reject");
    await rejected.svc.decideApproval(rejected.companyId, rejected.approval!.id, "reject");
    expect(await deliveryCount(rejected.companyId)).toBe(0);

    const expired = await pausedRun("Expire");
    await ctx.db.update(toolActionRequests).set({
      expiresAt: new Date(Date.now() - 1000),
    }).where(eq(toolActionRequests.id, expired.approval!.id));
    await expect(expired.svc.decideApproval(expired.companyId, expired.approval!.id, "approve")).rejects.toMatchObject({
      code: "approval_expired",
    });
    expect(await deliveryCount(expired.companyId)).toBe(0);
  });

  it("returns 409 when the stored payload hash changes", async () => {
    const { companyId, svc, approval } = await pausedRun("Mismatch");
    const [step] = await ctx.db.select().from(workflowStepRuns).where(eq(workflowStepRuns.toolActionRequestId, approval!.id));
    await ctx.db.update(workflowStepRuns).set({
      output: { ...step!.output, payload: { to: "other@example.com", subject: "Changed", body: "Changed" } },
    }).where(eq(workflowStepRuns.id, step!.id));
    await expect(svc.decideApproval(companyId, approval!.id, "approve")).rejects.toMatchObject({
      code: "approval_payload_mismatch",
      status: 409,
    });
    expect(await deliveryCount(companyId)).toBe(0);
  });
});
