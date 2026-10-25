import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createMasterDepartmentSchema,
  updateMasterDepartmentSchema,
} from "@paperclipai/shared";
import { forbidden } from "../errors.js";
import { getHiddenSettings } from "../services/settings-visibility.js";
import { validate } from "../middleware/validate.js";
import { masterDepartmentService } from "../services/master-departments.js";
import { assertBoard, assertInstanceAdmin, getActorInfo } from "./authz.js";

function assertMasterDepartmentsVisible() {
  if (getHiddenSettings().has("instance.masterDepartments")) {
    throw forbidden("Master departments are managed by the hosting operator on this instance", {
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

export function masterDepartmentRoutes(db: Db) {
  const router = Router();
  const svc = masterDepartmentService(db);

  router.get("/instance/master-departments", async (req, res) => {
    assertBoard(req);
    const includeDisabled = req.query.includeDisabled === "true";
    if (includeDisabled) assertInstanceAdmin(req);
    res.json(await svc.list(includeDisabled));
  });

  router.post("/instance/master-departments", validate(createMasterDepartmentSchema), async (req, res) => {
    assertInstanceAdmin(req);
    assertMasterDepartmentsVisible();
    const created = await svc.create(req.body);
    await svc.logInstanceChange(actorFrom(req), "master_department.created", created.id);
    res.status(201).json(created);
  });

  router.patch("/instance/master-departments/:id", validate(updateMasterDepartmentSchema), async (req, res) => {
    assertInstanceAdmin(req);
    assertMasterDepartmentsVisible();
    const updated = await svc.update(req.params.id as string, req.body);
    await svc.logInstanceChange(actorFrom(req), "master_department.updated", updated.id);
    res.json(updated);
  });

  router.delete("/instance/master-departments/:id", async (req, res) => {
    assertInstanceAdmin(req);
    assertMasterDepartmentsVisible();
    const id = req.params.id as string;
    await svc.remove(id);
    await svc.logInstanceChange(actorFrom(req), "master_department.deleted", id);
    res.status(204).end();
  });

  return router;
}
