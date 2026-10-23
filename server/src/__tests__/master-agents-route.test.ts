import request from "supertest";
import { eq } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import { activityLog, agents, companySkills, instanceDefaultModels, masterAgents, masterTeamMembers, masterTeams } from "@paperclipai/db";
import { legacyAgentAppearance } from "@paperclipai/shared";
import { masterAgentRoutes } from "../routes/master-agents.js";
import {
  describeEmbeddedPostgres,
  resetCompanyIssueFixtures,
  routeApp,
  seedCompanyWithBoardAccess,
  useEmbeddedPostgres,
  type BoardActor,
} from "./helpers/route-test-harness.js";

describeEmbeddedPostgres("master agent gallery", () => {
  const ctx = useEmbeddedPostgres("master-agents-route");

  afterEach(async () => {
    await ctx.db.delete(activityLog);
    await ctx.db.delete(agents);
    await ctx.db.delete(companySkills);
    await ctx.db.delete(masterTeamMembers);
    await ctx.db.delete(masterTeams);
    await ctx.db.delete(masterAgents);
    await ctx.db.delete(instanceDefaultModels);
    await resetCompanyIssueFixtures(ctx.db);
  });

  function appFor(actor: BoardActor) {
    return routeApp(ctx.db, actor, masterAgentRoutes);
  }

  function adminActor(actor: BoardActor): BoardActor {
    return { ...actor, isInstanceAdmin: true };
  }

  it("rejects master and default-model writes from a non-admin", async () => {
    const seeded = await seedCompanyWithBoardAccess(ctx.db, "Gallery");
    const app = appFor(seeded.actor);

    const create = await request(app).post("/api/instance/master-agents").send({
      title: "Analyst",
      department: "leadership",
      description: "Reads the numbers.",
      instructions: "Read the numbers.",
    });
    expect(create.status).toBe(403);

    const model = await request(app).put("/api/instance/default-model").send({
      adapterType: "cursor",
      model: "composer",
      credential: { kind: "stored_login" },
    });
    expect(model.status).toBe(403);
  });

  it("hires with Cursor auto when no platform model is saved", async () => {
    const seeded = await seedCompanyWithBoardAccess(ctx.db, "Gallery implicit model");
    const board = appFor(seeded.actor);
    const status = await request(board).get("/api/instance/default-model");
    expect(status.status).toBe(200);
    expect(status.body).toEqual({
      configured: true,
      adapterType: "cursor",
      model: "auto",
      credentialKind: "stored_login",
    });
    const stored = await ctx.db.select().from(instanceDefaultModels);
    expect(stored).toHaveLength(0);

    const catalog = await request(board).get("/api/instance/master-agents");
    const starter = catalog.body.find((row: { slug: string }) => row.slug === "customer-success-manager");
    const hired = await request(board)
      .post(`/api/companies/${seeded.companyId}/onboarding/hires`)
      .send({ masterAgentId: starter.id });
    expect(hired.status).toBe(201);
    expect(hired.body.agents[0].adapterType).toBe("cursor");
    expect(hired.body.agents[0].adapterConfig.model).toBe("auto");
  });

  it("hires with the platform default and ignores a client adapter", async () => {
    const seeded = await seedCompanyWithBoardAccess(ctx.db, "Gallery");
    const admin = appFor(adminActor(seeded.actor));
    const board = appFor(seeded.actor);

    const saved = await request(admin).put("/api/instance/default-model").send({
      adapterType: "claude_local",
      model: "claude-sonnet-platform",
      credential: { kind: "stored_login" },
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({
      configured: true,
      adapterType: "claude_local",
      model: "claude-sonnet-platform",
      credentialKind: "stored_login",
    });
    expect(saved.body.apiKey).toBeUndefined();

    const catalog = await request(board).get("/api/instance/master-agents");
    expect(catalog.status).toBe(200);
    const chief = catalog.body.find((row: { slug: string }) => row.slug === "chief-of-staff");
    expect(chief).toBeTruthy();

    const rejected = await request(board)
      .post(`/api/companies/${seeded.companyId}/onboarding/hires`)
      .send({ masterAgentId: chief.id, adapterType: "cursor" });
    expect(rejected.status).toBe(400);

    const hired = await request(board)
      .post(`/api/companies/${seeded.companyId}/onboarding/hires`)
      .send({ masterAgentId: chief.id });
    expect(hired.status).toBe(201);
    expect(hired.body.agents).toHaveLength(1);
    expect(hired.body.agents[0].adapterType).toBe("claude_local");
    expect(hired.body.agents[0].adapterConfig.model).toBe("claude-sonnet-platform");
    expect(hired.body.agents[0].reportsTo).toBeNull();
    expect(hired.body.agents[0].appearance).toEqual(legacyAgentAppearance(chief.id));
    expect(hired.body.agents[0].metadata).toEqual({ masterAgentId: chief.id });

    const duplicate = await request(board)
      .post(`/api/companies/${seeded.companyId}/onboarding/hires`)
      .send({ masterAgentId: chief.id });
    expect(duplicate.status).toBe(409);
  });

  it("sets reportsTo on a team hire", async () => {
    const seeded = await seedCompanyWithBoardAccess(ctx.db, "Gallery team");
    const admin = appFor(adminActor(seeded.actor));
    const board = appFor(seeded.actor);

    await request(admin).put("/api/instance/default-model").send({
      adapterType: "codex_local",
      model: "gpt-platform",
      credential: { kind: "stored_login" },
    });

    const catalog = await request(board).get("/api/instance/master-agents");
    const cmo = catalog.body.find((row: { slug: string }) => row.slug === "cmo");
    expect(cmo.skillKeys).toEqual(expect.arrayContaining([
      "paperclipai/bundled/paperclip-operations/task-planning",
      "paperclipai/bundled/paperclip-operations/issue-triage",
    ]));

    const teams = await request(board).get("/api/instance/master-teams");
    const marketing = teams.body.find((row: { slug: string }) => row.slug === "marketing-team");
    expect(marketing.members).toHaveLength(4);
    expect(marketing.members.map((row: { title: string }) => row.title)).toEqual(
      expect.arrayContaining(["CMO", "Content Writer", "Video Editor", "Social Media Manager"]),
    );

    const hired = await request(board)
      .post(`/api/companies/${seeded.companyId}/onboarding/hires`)
      .send({ masterTeamId: marketing.id });
    expect(hired.status).toBe(201);
    expect(hired.body.agents).toHaveLength(4);

    const rows = await ctx.db.select().from(agents).where(eq(agents.companyId, seeded.companyId));
    const manager = rows.find((row) => row.id === hired.body.managerAgentId);
    expect(manager?.reportsTo).toBeNull();
    expect(manager?.name).toBe("CMO");
    const reports = rows.filter((row) => row.id !== manager?.id);
    expect(reports).toHaveLength(3);
    expect(reports.every((row) => row.reportsTo === manager?.id)).toBe(true);
    expect(rows.every((row) => row.adapterType === "codex_local")).toBe(true);
    expect(rows.every((row) => (row.adapterConfig as { model?: string }).model === "gpt-platform")).toBe(true);
    expect(manager?.appearance).toEqual(legacyAgentAppearance(cmo.id));
    for (const member of marketing.members as Array<{ masterAgentId: string; title: string }>) {
      const row = rows.find((agent) => agent.name === member.title);
      expect(row?.appearance).toEqual(legacyAgentAppearance(member.masterAgentId));
    }
  });
});
