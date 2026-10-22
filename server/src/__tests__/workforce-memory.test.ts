import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { agents, workforceMemories, workforceShifts } from "@paperclipai/db";
import { workforceMemoryService } from "../services/workforce/memory.js";
import { describeWorkforce, seedWorkforceCompany, useWorkforceDb, workflowSvc } from "./helpers/workforce-fixture.js";

describeWorkforce("workforce memory", () => {
  const ctx = useWorkforceDb("workforce-memory-");

  it("gives the next shift the previous summary and hides private notes from another agent", async () => {
    const { companyId, agentId } = await seedWorkforceCompany(ctx.db, "Memory");
    const otherAgentId = randomUUID();
    await ctx.db.insert(agents).values({
      id: otherAgentId,
      companyId,
      name: "Other",
      status: "idle",
    });
    const memory = workforceMemoryService(ctx.db);
    const shiftId = randomUUID();
    await memory.writeShiftSummary({
      companyId,
      agentId,
      shiftId,
      workflowRunId: randomUUID(),
      content: "Yesterday closed two leads.",
    });
    await ctx.db.insert(workforceMemories).values({
      companyId,
      scopeType: "agent",
      scopeId: agentId,
      ownerAgentId: agentId,
      visibility: "agent_private",
      kind: "note",
      content: "Do not show this to the other agent.",
      source: "test",
    });

    const context = await memory.contextForNextShift(companyId, agentId);
    expect(context.previousSummary).toBe("Yesterday closed two leads.");

    const svc = workflowSvc(ctx.db);
    const created = await svc.createDefinition(companyId, { template: "sachi-daily" });
    const run = await ctx.db.transaction(async (tx) => svc.startRun(tx, {
      companyId,
      definitionId: created.definition.id,
      agentId,
    }));
    const [shift] = await ctx.db.select().from(workforceShifts).where(eq(workforceShifts.id, run.shiftId!));
    expect(shift?.contextSnapshot).toMatchObject({ previousSummary: "Yesterday closed two leads." });

    const otherView = await memory.list(companyId, { type: "agent", agentId: otherAgentId });
    expect(otherView.some((row) => row.visibility === "agent_private")).toBe(false);
    expect(otherView.some((row) => row.content === "Yesterday closed two leads.")).toBe(true);

    const ownerView = await memory.list(companyId, { type: "agent", agentId });
    expect(ownerView.some((row) => row.visibility === "agent_private")).toBe(true);
  });
});
