import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { workflowVersions } from "@paperclipai/db";
import { SACHI_DAILY_WORKFLOW_GRAPH } from "@paperclipai/shared";
import { WorkforceError } from "../services/workforce/workflow-engine.js";
import { describeWorkforce, seedWorkforceCompany, useWorkforceDb, workflowSvc } from "./helpers/workforce-fixture.js";

describeWorkforce("workforce engine", () => {
  const ctx = useWorkforceDb("workforce-engine-");

  it("freezes the published graph and skips succeeded steps", async () => {
    const { companyId, agentId } = await seedWorkforceCompany(ctx.db, "Engine");
    const svc = workflowSvc(ctx.db);
    const created = await svc.createDefinition(companyId, { template: "sachi-daily" });
    const publishedGraph = created.version.graph;
    const run = await ctx.db.transaction(async (tx) => svc.startRun(tx, {
      companyId,
      definitionId: created.definition.id,
      agentId,
      input: { subject: "Frozen subject" },
    }));
    const nodes = SACHI_DAILY_WORKFLOW_GRAPH.nodes.map((node) => (
      node.id === "report" ? { ...node, id: "report-draft" } : node
    ));
    await svc.saveDraft(companyId, created.definition.id, nodes);
    const [published] = await ctx.db.select().from(workflowVersions).where(eq(workflowVersions.id, created.version.id));
    expect(published?.graph).toEqual(publishedGraph);
    expect(run.graphSnapshot).toEqual(publishedGraph);
    const before = await svc.getRun(companyId, run.id);
    const again = await svc.advance(ctx.db, run.id);
    const after = await svc.getRun(companyId, run.id);
    expect(again.status).toBe("waiting_for_human");
    expect(after?.steps).toHaveLength(before?.steps.length ?? 0);
  });

  it("rejects an unsupported node on publish", async () => {
    const { companyId } = await seedWorkforceCompany(ctx.db, "Bad graph");
    const svc = workflowSvc(ctx.db);
    const created = await svc.createDefinition(companyId, { graph: SACHI_DAILY_WORKFLOW_GRAPH });
    const draft = created.version;
    const graph = structuredClone(SACHI_DAILY_WORKFLOW_GRAPH);
    graph.nodes[2] = { ...graph.nodes[2], type: "parallel" };
    await ctx.db.update(workflowVersions).set({ graph }).where(eq(workflowVersions.id, draft.id));
    await expect(svc.publish(companyId, created.definition.id)).rejects.toMatchObject({ code: "unsupported_node" });
    await expect(svc.publish(companyId, created.definition.id)).rejects.toBeInstanceOf(WorkforceError);
  });
});
