import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import {
  createWorkforceWorkflowSchema,
  startWorkforceRunSchema,
  updateWorkforceDraftSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { forbidden, notFound, unauthorized } from "../errors.js";
import { accessService } from "../services/index.js";
import { workforceWorkflowService, type WorkforceActor } from "../services/workforce/workflow-engine.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function workforceRoutes(db: Db) {
  const router = Router();
  const svc = workforceWorkflowService(db);
  const access = accessService(db);

  function actorOf(req: Request): WorkforceActor {
    const actor = getActorInfo(req);
    return {
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
    };
  }

  async function assertMutator(req: Request, companyId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "agent") throw forbidden("Agents cannot change workforce controls");
    if (req.actor.type !== "board") throw unauthorized();
    if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) return;
    const allowed = await access.canUser(companyId, req.actor.userId, "tasks:assign");
    if (!allowed) throw forbidden("Missing permission: tasks:assign");
  }

  function canReadPrivate(req: Request, companyId: string) {
    if (req.actor.type !== "board") return false;
    if (req.actor.isInstanceAdmin) return true;
    const membership = req.actor.memberships?.find((item) => item.companyId === companyId);
    return membership?.membershipRole !== "viewer";
  }

  router.get("/companies/:companyId/workforce/overview", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.overview(companyId));
  });

  router.get("/companies/:companyId/workforce/shifts", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.listShifts(companyId));
  });

  router.get("/companies/:companyId/workforce/shifts/:shiftId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const shiftId = req.params.shiftId as string;
    assertCompanyAccess(req, companyId);
    const shift = await svc.getShift(companyId, shiftId);
    if (!shift) throw notFound("Shift not found");
    res.json(shift);
  });

  router.get("/companies/:companyId/workforce/workflows", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.listDefinitions(companyId));
  });

  router.post("/companies/:companyId/workforce/workflows", validate(createWorkforceWorkflowSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertMutator(req, companyId);
    const created = await svc.createDefinition(companyId, req.body, actorOf(req));
    res.status(201).json(created);
  });

  router.get("/companies/:companyId/workforce/workflows/runs/:runId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const runId = req.params.runId as string;
    assertCompanyAccess(req, companyId);
    const run = await svc.getRun(companyId, runId);
    if (!run) throw notFound("Workflow run not found");
    res.json(run);
  });

  router.post("/companies/:companyId/workforce/workflows/runs/:runId/cancel", async (req, res) => {
    const companyId = req.params.companyId as string;
    const runId = req.params.runId as string;
    await assertMutator(req, companyId);
    res.json(await svc.cancelRun(companyId, runId, actorOf(req)));
  });

  router.get("/companies/:companyId/workforce/workflows/:definitionId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const definitionId = req.params.definitionId as string;
    assertCompanyAccess(req, companyId);
    const detail = await svc.getDefinition(companyId, definitionId);
    if (!detail) throw notFound("Workflow not found");
    res.json(detail);
  });

  router.put("/companies/:companyId/workforce/workflows/:definitionId/draft", validate(updateWorkforceDraftSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    const definitionId = req.params.definitionId as string;
    await assertMutator(req, companyId);
    res.json(await svc.saveDraft(companyId, definitionId, req.body.nodes));
  });

  router.post("/companies/:companyId/workforce/workflows/:definitionId/publish", async (req, res) => {
    const companyId = req.params.companyId as string;
    const definitionId = req.params.definitionId as string;
    await assertMutator(req, companyId);
    res.json(await svc.publish(companyId, definitionId, actorOf(req)));
  });

  router.post("/companies/:companyId/workforce/workflows/:definitionId/runs", validate(startWorkforceRunSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    const definitionId = req.params.definitionId as string;
    await assertMutator(req, companyId);
    const detail = await svc.getDefinition(companyId, definitionId);
    if (!detail) throw notFound("Workflow not found");
    const run = await db.transaction(async (tx) => svc.startRun(tx as unknown as Db, {
      companyId,
      definitionId,
      agentId: detail.definition.assigneeAgentId,
      issueId: req.body.issueId ?? null,
      input: req.body.input,
    }));
    res.status(201).json(run);
  });

  router.get("/companies/:companyId/workforce/approvals", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.listApprovals(companyId));
  });

  router.post("/companies/:companyId/workforce/approvals/:actionRequestId/approve", async (req, res) => {
    const companyId = req.params.companyId as string;
    const actionRequestId = req.params.actionRequestId as string;
    await assertMutator(req, companyId);
    res.json(await svc.decideApproval(companyId, actionRequestId, "approve", actorOf(req)));
  });

  router.post("/companies/:companyId/workforce/approvals/:actionRequestId/reject", async (req, res) => {
    const companyId = req.params.companyId as string;
    const actionRequestId = req.params.actionRequestId as string;
    await assertMutator(req, companyId);
    res.json(await svc.decideApproval(companyId, actionRequestId, "reject", actorOf(req)));
  });

  router.get("/companies/:companyId/workforce/memories", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;
    const scopeType = typeof req.query.scopeType === "string" ? req.query.scopeType : undefined;
    const actor = req.actor.type === "agent" && req.actor.agentId
      ? { type: "agent" as const, agentId: req.actor.agentId }
      : { type: "human" as const, canReadPrivate: canReadPrivate(req, companyId) };
    res.json(await svc.listMemories(companyId, actor, { agentId, scopeType }));
  });

  router.delete("/companies/:companyId/workforce/memories/:memoryId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const memoryId = req.params.memoryId as string;
    await assertMutator(req, companyId);
    res.json(await svc.deleteMemory(companyId, memoryId));
  });

  return router;
}
