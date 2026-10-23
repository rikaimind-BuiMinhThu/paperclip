import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { issues, routineRuns, routines, workforceShifts, workflowRuns } from "@paperclipai/db";
import { routineService } from "../services/routines.js";
import { describeWorkforce, seedWorkforceCompany, useWorkforceDb, workflowSvc } from "./helpers/workforce-fixture.js";

describeWorkforce("workforce routine hook", () => {
  const ctx = useWorkforceDb("workforce-routine-");

  function routinesSvc() {
    return routineService(ctx.db, {
      heartbeat: { wakeup: async () => null },
      storeFile: async () => ({
        provider: "local",
        objectKey: "unused",
        contentType: "text/html",
        byteSize: 1,
        sha256: "b".repeat(64),
        originalFilename: "unused.html",
      }),
    });
  }

  it("keeps a routine with no workflow on the issue path", async () => {
    const { companyId, agentId } = await seedWorkforceCompany(ctx.db, "Plain");
    const svc = routinesSvc();
    const routine = await svc.create(companyId, {
      title: "Issue only",
      assigneeAgentId: agentId,
      priority: "medium",
      status: "active",
      concurrencyPolicy: "coalesce_if_active",
      catchUpPolicy: "skip_missed",
    }, { userId: "board-user" });
    const run = await svc.runRoutine(routine.id, { source: "manual" }, { userId: "board-user" });
    expect(run.status).toBe("issue_created");
    const shifts = await ctx.db.select().from(workforceShifts).where(eq(workforceShifts.companyId, companyId));
    const createdIssues = await ctx.db.select().from(issues).where(eq(issues.companyId, companyId));
    expect(shifts).toHaveLength(0);
    expect(createdIssues).toHaveLength(1);
  });

  it("creates one shift and skips a second fire while that run is open", async () => {
    const { companyId, agentId } = await seedWorkforceCompany(ctx.db, "Linked");
    const workflows = workflowSvc(ctx.db);
    const definition = await workflows.createDefinition(companyId, { template: "sachi-daily" });
    const svc = routinesSvc();
    const routine = await svc.create(companyId, {
      title: "Daily sales",
      assigneeAgentId: agentId,
      workflowDefinitionId: definition.definition.id,
      priority: "medium",
      concurrencyPolicy: "skip_if_active",
      catchUpPolicy: "skip_missed",
      status: "active",
    }, { userId: "board-user" });
    const first = await svc.runRoutine(routine.id, { source: "manual" }, { userId: "board-user" });
    const second = await svc.runRoutine(routine.id, { source: "manual" }, { userId: "board-user" });
    const shifts = await ctx.db.select().from(workforceShifts).where(eq(workforceShifts.companyId, companyId));
    const runs = await ctx.db.select().from(workflowRuns).where(eq(workflowRuns.companyId, companyId));
    expect(first.status).toBe("issue_created");
    expect(second.status).toBe("skipped");
    expect(shifts).toHaveLength(1);
    expect(runs).toHaveLength(1);
  });

  it("fails a draft assignee and leaves no shift", async () => {
    const { companyId, agentId } = await seedWorkforceCompany(ctx.db, "Draft", "draft");
    const workflows = workflowSvc(ctx.db);
    const definition = await workflows.createDefinition(companyId, { template: "sachi-daily" });
    const svc = routinesSvc();
    const routine = await svc.create(companyId, {
      title: "Draft employee",
      assigneeAgentId: agentId,
      workflowDefinitionId: definition.definition.id,
      priority: "medium",
      concurrencyPolicy: "coalesce_if_active",
      catchUpPolicy: "skip_missed",
      status: "active",
    }, { userId: "board-user" });
    const run = await svc.runRoutine(routine.id, { source: "manual" }, { userId: "board-user" });
    const shifts = await ctx.db.select().from(workforceShifts).where(eq(workforceShifts.companyId, companyId));
    const stored = await ctx.db.select().from(routineRuns).where(eq(routineRuns.id, run.id));
    const linked = await ctx.db.select().from(routines).where(eq(routines.id, routine.id));
    expect(run.status).toBe("failed");
    expect(stored[0]?.failureReason).toBe("workforce_employee_draft");
    expect(shifts).toHaveLength(0);
    expect(linked[0]?.workflowDefinitionId).toBe(definition.definition.id);
  });
});
