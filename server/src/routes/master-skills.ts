import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createMasterSkillSchema,
  updateMasterSkillSchema,
  upsertMasterSkillCatalogPrefSchema,
} from "@paperclipai/shared";
import { forbidden } from "../errors.js";
import { getHiddenSettings } from "../services/settings-visibility.js";
import { validate } from "../middleware/validate.js";
import { masterSkillService } from "../services/master-skills.js";
import { assertBoard, assertInstanceAdmin, getActorInfo } from "./authz.js";

function assertMasterSkillsVisible() {
  if (getHiddenSettings().has("instance.masterSkills")) {
    throw forbidden("Master skills are managed by the hosting operator on this instance", {
      code: "settings_operator_managed",
    });
  }
}

function actorFrom(req: Parameters<typeof getActorInfo>[0]) {
  const actor = getActorInfo(req);
  return {
    actorType: actor.actorType,
    actorId: actor.actorId,
  };
}

export function masterSkillRoutes(db: Db) {
  const router = Router();
  const svc = masterSkillService(db);

  router.get("/instance/master-skills", async (req, res) => {
    assertBoard(req);
    const includeDisabled = req.query.includeDisabled === "true";
    if (includeDisabled) assertInstanceAdmin(req);
    res.json(await svc.listCustom(includeDisabled));
  });

  router.post("/instance/master-skills", validate(createMasterSkillSchema), async (req, res) => {
    assertInstanceAdmin(req);
    assertMasterSkillsVisible();
    const created = await svc.createCustom(req.body);
    await svc.logInstanceChange(actorFrom(req), "master_skill.created", created.id);
    res.status(201).json(created);
  });

  router.patch("/instance/master-skills/:id", validate(updateMasterSkillSchema), async (req, res) => {
    assertInstanceAdmin(req);
    assertMasterSkillsVisible();
    const updated = await svc.updateCustom(req.params.id as string, req.body);
    await svc.logInstanceChange(actorFrom(req), "master_skill.updated", updated.id);
    res.json(updated);
  });

  router.delete("/instance/master-skills/:id", async (req, res) => {
    assertInstanceAdmin(req);
    assertMasterSkillsVisible();
    const id = req.params.id as string;
    await svc.removeCustom(id);
    await svc.logInstanceChange(actorFrom(req), "master_skill.deleted", id);
    res.status(204).end();
  });

  router.get("/instance/master-skill-catalog-prefs", async (req, res) => {
    assertBoard(req);
    res.json(await svc.listPrefs());
  });

  router.put(
    "/instance/master-skill-catalog-prefs",
    validate(upsertMasterSkillCatalogPrefSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      assertMasterSkillsVisible();
      const saved = await svc.upsertPref(req.body);
      await svc.logInstanceChange(actorFrom(req), "master_skill_catalog_pref.upserted", saved.catalogKey);
      res.json(saved);
    },
  );

  /** Effective catalog + custom options for Master Agent skill pickers. */
  router.get("/instance/master-skill-options", async (req, res) => {
    assertBoard(req);
    const includeDisabled = req.query.includeDisabled === "true";
    if (includeDisabled) assertInstanceAdmin(req);
    res.json(await svc.listEffectiveOptions(includeDisabled));
  });

  return router;
}
