import request from "supertest";
import { afterEach, expect, it } from "vitest";
import { activityLog, masterSkillCatalogPrefs, masterSkills } from "@paperclipai/db";
import { masterCustomSkillKey } from "@paperclipai/shared";
import { masterSkillRoutes } from "../routes/master-skills.js";
import {
  describeEmbeddedPostgres,
  resetCompanyIssueFixtures,
  routeApp,
  seedCompanyWithBoardAccess,
  useEmbeddedPostgres,
  type BoardActor,
} from "./helpers/route-test-harness.js";

describeEmbeddedPostgres("master skills", () => {
  const ctx = useEmbeddedPostgres("master-skills-route");

  afterEach(async () => {
    await ctx.db.delete(activityLog);
    await ctx.db.delete(masterSkills);
    await ctx.db.delete(masterSkillCatalogPrefs);
    await resetCompanyIssueFixtures(ctx.db);
  });

  function appFor(actor: BoardActor) {
    return routeApp(ctx.db, actor, masterSkillRoutes);
  }

  function adminActor(actor: BoardActor): BoardActor {
    return { ...actor, isInstanceAdmin: true };
  }

  it("rejects writes from a non-admin", async () => {
    const seeded = await seedCompanyWithBoardAccess(ctx.db, "Master skills");
    const app = appFor(seeded.actor);

    const create = await request(app).post("/api/instance/master-skills").send({
      name: "Brief Writer",
      description: "Writes briefs.",
      instructions: "Write a clear brief.",
    });
    expect(create.status).toBe(403);

    const pref = await request(app).put("/api/instance/master-skill-catalog-prefs").send({
      catalogKey: "paperclipai/bundled/paperclip-operations/task-planning",
      enabled: false,
    });
    expect(pref.status).toBe(403);
  });

  it("lets instance admins CRUD custom skills and catalog prefs", async () => {
    const seeded = await seedCompanyWithBoardAccess(ctx.db, "Master skills admin");
    const admin = appFor(adminActor(seeded.actor));

    const created = await request(admin).post("/api/instance/master-skills").send({
      name: "Brief Writer",
      slug: "brief-writer",
      description: "Writes briefs.",
      instructions: "Write a clear brief.",
      recommended: true,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      slug: "brief-writer",
      key: masterCustomSkillKey("brief-writer"),
      name: "Brief Writer",
      recommended: true,
      enabled: true,
    });

    const listed = await request(admin).get("/api/instance/master-skills?includeDisabled=true");
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);

    const updated = await request(admin)
      .patch(`/api/instance/master-skills/${created.body.id}`)
      .send({ enabled: false, recommended: false });
    expect(updated.status).toBe(200);
    expect(updated.body.enabled).toBe(false);

    const pref = await request(admin).put("/api/instance/master-skill-catalog-prefs").send({
      catalogKey: "paperclipai/bundled/paperclip-operations/task-planning",
      enabled: false,
      recommended: false,
      sortOrder: 10,
    });
    expect(pref.status).toBe(200);
    expect(pref.body).toMatchObject({
      catalogKey: "paperclipai/bundled/paperclip-operations/task-planning",
      enabled: false,
      sortOrder: 10,
    });

    const options = await request(admin).get("/api/instance/master-skill-options");
    expect(options.status).toBe(200);
    expect(Array.isArray(options.body)).toBe(true);
    expect(options.body.find((row: { key: string }) => row.key === pref.body.catalogKey)).toBeUndefined();
    expect(
      options.body.find((row: { key: string }) => row.key === masterCustomSkillKey("brief-writer")),
    ).toBeUndefined();

    const optionsAll = await request(admin).get("/api/instance/master-skill-options?includeDisabled=true");
    expect(optionsAll.status).toBe(200);
    expect(
      optionsAll.body.find((row: { key: string }) => row.key === masterCustomSkillKey("brief-writer")),
    ).toBeTruthy();

    const removed = await request(admin).delete(`/api/instance/master-skills/${created.body.id}`);
    expect(removed.status).toBe(204);
  });
});
