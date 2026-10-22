import request from "supertest";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { workforceMemories } from "@paperclipai/db";
import { workforceRoutes } from "../routes/workforce.js";
import { routeApp, seedCompanyWithBoardAccess } from "./helpers/route-test-harness.js";
import { describeWorkforce, seedWorkforceCompany, useWorkforceDb, workflowSvc } from "./helpers/workforce-fixture.js";

describeWorkforce("workforce isolation", () => {
  const ctx = useWorkforceDb("workforce-isolation-");

  it("hides another company's shift, run, memory, and approval", async () => {
    const companyA = await seedCompanyWithBoardAccess(ctx.db, "Company A");
    const companyB = await seedWorkforceCompany(ctx.db, "Company B");
    const svc = workflowSvc(ctx.db);
    const created = await svc.createDefinition(companyB.companyId, { template: "sachi-daily" });
    const run = await ctx.db.transaction(async (tx) => svc.startRun(tx, {
      companyId: companyB.companyId,
      definitionId: created.definition.id,
      agentId: companyB.agentId,
    }));
    const [approval] = await svc.listApprovals(companyB.companyId);
    const [memory] = await ctx.db.insert(workforceMemories).values({
      companyId: companyB.companyId,
      scopeType: "agent",
      scopeId: companyB.agentId,
      ownerAgentId: companyB.agentId,
      visibility: "company",
      kind: "note",
      content: "private to B",
      source: "test",
    }).returning();
    const app = routeApp(ctx.db, companyA.actor, (db) => workforceRoutes(db));

    const shift = await request(app).get(`/api/companies/${companyA.companyId}/workforce/shifts/${run.shiftId}`);
    const runRes = await request(app).get(`/api/companies/${companyA.companyId}/workforce/workflows/runs/${run.id}`);
    const memoryRes = await request(app).delete(`/api/companies/${companyA.companyId}/workforce/memories/${memory!.id}`);
    const approvalRes = await request(app).post(`/api/companies/${companyA.companyId}/workforce/approvals/${approval!.id}/approve`);

    expect(shift.status).toBe(404);
    expect(runRes.status).toBe(404);
    expect(memoryRes.status).toBe(404);
    expect(approvalRes.status).toBe(404);
    const stillThere = await ctx.db.select().from(workforceMemories).where(eq(workforceMemories.id, memory!.id));
    expect(stillThere).toHaveLength(1);
  });
});
