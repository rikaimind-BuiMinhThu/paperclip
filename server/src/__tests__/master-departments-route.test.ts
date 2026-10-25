import request from "supertest";
import { afterEach, expect, it } from "vitest";
import { activityLog, masterAgents, masterDepartments, masterTeamMembers, masterTeams } from "@paperclipai/db";
import { MASTER_AGENT_DEPARTMENTS } from "@paperclipai/shared";
import { masterAgentRoutes } from "../routes/master-agents.js";
import { masterDepartmentRoutes } from "../routes/master-departments.js";
import {
  describeEmbeddedPostgres,
  resetCompanyIssueFixtures,
  routeApp,
  seedCompanyWithBoardAccess,
  useEmbeddedPostgres,
  type BoardActor,
} from "./helpers/route-test-harness.js";

describeEmbeddedPostgres("master departments", () => {
  const ctx = useEmbeddedPostgres("master-departments-route");

  afterEach(async () => {
    await ctx.db.delete(activityLog);
    await ctx.db.delete(masterTeamMembers);
    await ctx.db.delete(masterTeams);
    await ctx.db.delete(masterAgents);
    await ctx.db.delete(masterDepartments);
    await resetCompanyIssueFixtures(ctx.db);
  });

  function appFor(actor: BoardActor) {
    return routeApp(ctx.db, actor, masterDepartmentRoutes, masterAgentRoutes);
  }

  function adminActor(actor: BoardActor): BoardActor {
    return { ...actor, isInstanceAdmin: true };
  }

  it("seeds the seven default departments", async () => {
    const seeded = await seedCompanyWithBoardAccess(ctx.db, "Master departments seed");
    const board = appFor(seeded.actor);

    const listed = await request(board).get("/api/instance/master-departments");
    expect(listed.status).toBe(200);
    expect(listed.body.map((row: { slug: string }) => row.slug)).toEqual([...MASTER_AGENT_DEPARTMENTS]);
  });

  it("rejects writes from a non-admin", async () => {
    const seeded = await seedCompanyWithBoardAccess(ctx.db, "Master departments board");
    const app = appFor(seeded.actor);

    const create = await request(app).post("/api/instance/master-departments").send({
      name: "Legal",
      slug: "legal",
    });
    expect(create.status).toBe(403);
  });

  it("lets instance admins create custom departments and rejects unknown agent departments", async () => {
    const seeded = await seedCompanyWithBoardAccess(ctx.db, "Master departments admin");
    const admin = appFor(adminActor(seeded.actor));

    const created = await request(admin).post("/api/instance/master-departments").send({
      name: "Legal",
      slug: "legal",
      description: "Contracts and compliance.",
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      slug: "legal",
      name: "Legal",
      enabled: true,
    });

    const agentOk = await request(admin).post("/api/instance/master-agents").send({
      title: "General Counsel",
      department: "legal",
      description: "Owns contracts.",
      instructions: "Review contracts carefully.",
    });
    expect(agentOk.status).toBe(201);

    const agentBad = await request(admin).post("/api/instance/master-agents").send({
      title: "Ghost Agent",
      department: "does-not-exist",
      description: "Should fail.",
      instructions: "Nope.",
    });
    expect(agentBad.status).toBe(422);
  });

  it("blocks delete while referenced and allows delete when unused", async () => {
    const seeded = await seedCompanyWithBoardAccess(ctx.db, "Master departments delete");
    const admin = appFor(adminActor(seeded.actor));

    const created = await request(admin).post("/api/instance/master-departments").send({
      name: "Research",
      slug: "research",
    });
    expect(created.status).toBe(201);

    const agent = await request(admin).post("/api/instance/master-agents").send({
      title: "Researcher",
      department: "research",
      description: "Investigates.",
      instructions: "Investigate thoroughly.",
    });
    expect(agent.status).toBe(201);

    const blocked = await request(admin).delete(`/api/instance/master-departments/${created.body.id}`);
    expect(blocked.status).toBe(409);

    const removedAgent = await request(admin).delete(`/api/instance/master-agents/${agent.body.id}`);
    expect(removedAgent.status).toBe(204);

    const removed = await request(admin).delete(`/api/instance/master-departments/${created.body.id}`);
    expect(removed.status).toBe(204);
  });
});
