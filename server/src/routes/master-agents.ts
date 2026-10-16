import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createMasterAgentSchema,
  createMasterTeamSchema,
  onboardingHireSchema,
  putDefaultModelSchema,
  updateMasterAgentSchema,
  updateMasterTeamSchema,
} from "@paperclipai/shared";
import { forbidden } from "../errors.js";
import { getHiddenSettings } from "../services/settings-visibility.js";
import { validate } from "../middleware/validate.js";
import { masterAgentService } from "../services/master-agents.js";
import { assertBoard, assertCompanyAccess, assertInstanceAdmin, getActorInfo } from "./authz.js";

function assertMasterAgentsVisible() {
  if (getHiddenSettings().has("instance.masterAgents")) {
    throw forbidden("Master agents are managed by the hosting operator on this instance", {
      code: "settings_operator_managed",
    });
  }
}

function actorFrom(req: Parameters<typeof getActorInfo>[0]) {
  const actor = getActorInfo(req);
  return {
    actorType: actor.actorType,
    actorId: actor.actorId,
    userId: actor.actorType === "user" ? actor.actorId : null,
  };
}

export function masterAgentRoutes(db: Db) {
  const router = Router();
  const svc = masterAgentService(db);

  router.get("/instance/master-agents", async (req, res) => {
    assertBoard(req);
    const includeDisabled = req.query.includeDisabled === "true";
    if (includeDisabled) assertInstanceAdmin(req);
    res.json(await svc.listAgents(includeDisabled));
  });

  router.post("/instance/master-agents", validate(createMasterAgentSchema), async (req, res) => {
    assertInstanceAdmin(req);
    assertMasterAgentsVisible();
    const created = await svc.createAgent(req.body);
    await svc.logInstanceChange(actorFrom(req), "master_agent.created", created.id);
    res.status(201).json(created);
  });

  router.patch("/instance/master-agents/:id", validate(updateMasterAgentSchema), async (req, res) => {
    assertInstanceAdmin(req);
    assertMasterAgentsVisible();
    const updated = await svc.updateAgent(req.params.id as string, req.body);
    await svc.logInstanceChange(actorFrom(req), "master_agent.updated", updated.id);
    res.json(updated);
  });

  router.delete("/instance/master-agents/:id", async (req, res) => {
    assertInstanceAdmin(req);
    assertMasterAgentsVisible();
    const id = req.params.id as string;
    await svc.removeAgent(id);
    await svc.logInstanceChange(actorFrom(req), "master_agent.deleted", id);
    res.status(204).end();
  });

  router.get("/instance/master-teams", async (req, res) => {
    assertBoard(req);
    const includeDisabled = req.query.includeDisabled === "true";
    if (includeDisabled) assertInstanceAdmin(req);
    res.json(await svc.listTeams(includeDisabled));
  });

  router.post("/instance/master-teams", validate(createMasterTeamSchema), async (req, res) => {
    assertInstanceAdmin(req);
    assertMasterAgentsVisible();
    const created = await svc.createTeam(req.body);
    await svc.logInstanceChange(actorFrom(req), "master_team.created", created.id);
    res.status(201).json(created);
  });

  router.patch("/instance/master-teams/:id", validate(updateMasterTeamSchema), async (req, res) => {
    assertInstanceAdmin(req);
    assertMasterAgentsVisible();
    const updated = await svc.updateTeam(req.params.id as string, req.body);
    await svc.logInstanceChange(actorFrom(req), "master_team.updated", updated.id);
    res.json(updated);
  });

  router.delete("/instance/master-teams/:id", async (req, res) => {
    assertInstanceAdmin(req);
    assertMasterAgentsVisible();
    const id = req.params.id as string;
    await svc.removeTeam(id);
    await svc.logInstanceChange(actorFrom(req), "master_team.deleted", id);
    res.status(204).end();
  });

  router.get("/instance/default-model", async (req, res) => {
    assertBoard(req);
    res.json(await svc.defaultModelStatus());
  });

  router.put("/instance/default-model", validate(putDefaultModelSchema), async (req, res) => {
    assertInstanceAdmin(req);
    assertMasterAgentsVisible();
    const actor = actorFrom(req);
    const status = await svc.putDefaultModel(req.body, actor.userId);
    await svc.logInstanceChange(actor, "instance.default_model.updated", "default");
    res.json(status);
  });

  router.post("/companies/:companyId/onboarding/hires", validate(onboardingHireSchema), async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const hired = await svc.hire(companyId, req.body, actorFrom(req));
    res.status(201).json(hired);
  });

  return router;
}
