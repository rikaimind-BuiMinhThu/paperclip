import { createHash } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agentConfigRevisions,
  agents,
  assets,
  companies,
  costEvents,
  issueAttachments,
  issueWorkProducts,
  routineTriggers,
  routines,
  toolActionRequests,
  toolInvocations,
  workflowDefinitions,
  workflowRuns,
  workflowStepRuns,
  workflowVersions,
  workforceCrmRecords,
  workforceOutboundDeliveries,
  workforceShifts,
} from "@paperclipai/db";
import {
  SACHI_DAILY_WORKFLOW_GRAPH,
  nextDelegationDepth,
  validateWorkforceGraph,
  type WorkforceGraph,
  type WorkforceNode,
} from "@paperclipai/shared";
import {
  canonicalToolArguments,
  hashToolValue,
  signToolArguments,
  verifyToolArgumentsSignature,
} from "../tool-content-guards.js";
import { logActivity } from "../activity-log.js";
import { HttpError, notFound } from "../../errors.js";
import { getStorageService } from "../../storage/index.js";
import { workforceMemoryService, type WorkforceMemoryActor } from "./memory.js";

const INVOKABLE_STATUSES = new Set(["active", "idle", "running", "error"]);
const OUTBOUND_TOOL = "workforce.outbound_message";
const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

export class WorkforceError extends HttpError {
  readonly code: string;

  constructor(code: string, status = 422) {
    super(status, code, { code });
    this.code = code;
  }
}

export type WorkforceActor = {
  actorType: string;
  actorId: string;
  agentId?: string | null;
  runId?: string | null;
};

export type WorkforceStoreFile = (input: {
  companyId: string;
  originalFilename: string;
  contentType: string;
  body: Buffer;
}) => Promise<{
  provider: string;
  objectKey: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  originalFilename: string | null;
}>;

type Executor = Db;

function isUniqueViolation(error: unknown) {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ((current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "\"": return "&quot;";
      default: return "&#39;";
    }
  });
}

function chainOf(graph: WorkforceGraph) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const next = new Map(graph.edges.map((edge) => [edge.from, edge.to]));
  const start = graph.nodes.find((node) => node.type === "start");
  if (!start) throw new WorkforceError("workflow_graph_invalid");
  const ordered: WorkforceNode[] = [];
  const seen = new Set<string>();
  let cursor: WorkforceNode | undefined = start;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    ordered.push(cursor);
    const nextId = next.get(cursor.id);
    cursor = nextId ? byId.get(nextId) : undefined;
  }
  return { ordered, byId };
}

function lifecycleOf(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const workforce = (metadata as { workforce?: { lifecycle?: unknown } }).workforce;
  return typeof workforce?.lifecycle === "string" ? workforce.lifecycle : null;
}

function draftPayload(run: { input: Record<string, unknown>; agentId: string; issueId: string | null }) {
  const input = run.input ?? {};
  return {
    to: typeof input.to === "string" ? input.to : "leads@example.com",
    subject: typeof input.subject === "string" ? input.subject : "Daily sales outreach",
    body: typeof input.body === "string" ? input.body : "Draft outreach prepared for approval.",
    agentId: run.agentId,
    issueId: run.issueId,
  };
}

async function defaultStoreFile(input: {
  companyId: string;
  originalFilename: string;
  contentType: string;
  body: Buffer;
}) {
  return getStorageService().putFile({
    companyId: input.companyId,
    namespace: "assets/companies",
    originalFilename: input.originalFilename,
    contentType: input.contentType,
    body: input.body,
  });
}

export function workforceWorkflowService(db: Db, options: { storeFile?: WorkforceStoreFile } = {}) {
  const storeFile = options.storeFile ?? defaultStoreFile;

  async function log(executor: Executor, input: {
    companyId: string;
    actor?: WorkforceActor;
    action: string;
    entityType: string;
    entityId: string;
    details?: Record<string, unknown>;
  }) {
    const actor = input.actor ?? { actorType: "system" as const, actorId: "workforce", agentId: null, runId: null };
    const actorType = actor.actorType === "agent" || actor.actorType === "user" || actor.actorType === "plugin"
      ? actor.actorType
      : "system";
    await logActivity(executor, {
      companyId: input.companyId,
      actorType,
      actorId: actor.actorId,
      agentId: actor.agentId ?? null,
      runId: actor.runId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details,
    });
  }

  async function failRun(executor: Executor, run: typeof workflowRuns.$inferSelect, code: string, nodeId?: string) {
    if (nodeId) {
      await executor.update(workflowStepRuns).set({
        status: "failed",
        completedAt: new Date(),
        updatedAt: new Date(),
        output: { errorCode: code },
      }).where(and(eq(workflowStepRuns.runId, run.id), eq(workflowStepRuns.nodeId, nodeId)));
    }
    await executor.update(workflowRuns).set({
      status: "failed",
      errorCode: code,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(workflowRuns.id, run.id));
    if (run.shiftId) {
      await executor.update(workforceShifts).set({
        status: "failed",
        endedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(workforceShifts.id, run.shiftId));
    }
  }

  async function executeNode(
    executor: Executor,
    run: typeof workflowRuns.$inferSelect,
    node: WorkforceNode,
    graph: WorkforceGraph,
    actor?: WorkforceActor,
  ) {
    const now = new Date();
    const [step] = await executor.insert(workflowStepRuns).values({
      companyId: run.companyId,
      runId: run.id,
      nodeId: node.id,
      nodeType: node.type,
      status: "running",
      startedAt: now,
    }).returning();
    if (!step) throw new WorkforceError("workflow_step_missing", 500);

    if (node.type === "start") {
      await executor.update(workflowStepRuns).set({
        status: "succeeded",
        output: { startedAt: now.toISOString() },
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(workflowStepRuns.id, step.id));
      return { wait: false };
    }

    if (node.type === "employee") {
      await executor.update(workflowStepRuns).set({
        status: "succeeded",
        output: {
          issueId: run.issueId,
          agentId: run.agentId,
          agentConfigRevisionId: run.agentConfigRevisionId,
        },
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(workflowStepRuns.id, step.id));
      return { wait: false };
    }

    if (node.type === "tool" && node.mode === "draft") {
      const payload = draftPayload(run);
      const payloadHash = hashToolValue(payload);
      await executor.update(workflowStepRuns).set({
        status: "succeeded",
        output: { payload, payloadHash },
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(workflowStepRuns.id, step.id));
      return { wait: false };
    }

    if (node.type === "approval") {
      const { byId } = chainOf(graph);
      const draft = node.bindsNodeId ? byId.get(node.bindsNodeId) : undefined;
      const [draftStep] = draft
        ? await executor.select().from(workflowStepRuns).where(and(
          eq(workflowStepRuns.runId, run.id),
          eq(workflowStepRuns.nodeId, draft.id),
        ))
        : [];
      const payload = draftStep?.output?.payload;
      if (!payload || typeof payload !== "object") throw new WorkforceError("workflow_graph_invalid");
      const payloadHash = hashToolValue(payload);
      const canonical = canonicalToolArguments(payload);
      const [invocation] = await executor.insert(toolInvocations).values({
        companyId: run.companyId,
        idempotencyKey: `${run.id}:${node.id}`,
        actorType: "agent",
        actorId: run.agentId,
        agentId: run.agentId,
        issueId: run.issueId,
        toolName: OUTBOUND_TOOL,
        argumentsHash: payloadHash,
        argumentsSummary: { summary: "Outbound message draft", sha256: payloadHash },
        policyDecision: "require_approval",
        approvalState: "pending",
        status: "awaiting_approval",
        riskLevel: "high",
      }).returning();
      if (!invocation) throw new WorkforceError("workflow_step_missing", 500);
      const signedArguments = signToolArguments({
        invocationId: invocation.id,
        toolName: OUTBOUND_TOOL,
        canonicalArguments: canonical,
        executionOnApprove: true,
      });
      const [action] = await executor.insert(toolActionRequests).values({
        companyId: run.companyId,
        invocationId: invocation.id,
        issueId: run.issueId,
        status: "pending",
        canonicalArgumentsHash: payloadHash,
        canonicalArgumentsSummary: { summary: "Outbound message draft", sha256: payloadHash },
        signedArguments,
        requestedByAgentId: run.agentId,
        expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
      }).returning();
      if (!action) throw new WorkforceError("workflow_step_missing", 500);
      await executor.update(workflowStepRuns).set({
        status: "waiting_for_human",
        toolActionRequestId: action.id,
        output: { actionRequestId: action.id, payloadHash, payload },
        updatedAt: new Date(),
      }).where(eq(workflowStepRuns.id, step.id));
      await executor.update(workflowRuns).set({
        status: "waiting_for_human",
        currentNodeId: node.id,
        updatedAt: new Date(),
      }).where(eq(workflowRuns.id, run.id));
      if (run.shiftId) {
        await executor.update(workforceShifts).set({
          status: "waiting_for_human",
          updatedAt: new Date(),
        }).where(eq(workforceShifts.id, run.shiftId));
      }
      return { wait: true };
    }

    if (node.type === "tool" && node.mode === "send") {
      const { byId } = chainOf(graph);
      const approval = node.bindsNodeId ? byId.get(node.bindsNodeId) : undefined;
      const draftId = approval?.bindsNodeId;
      const [approvalStep] = approval
        ? await executor.select().from(workflowStepRuns).where(and(
          eq(workflowStepRuns.runId, run.id),
          eq(workflowStepRuns.nodeId, approval.id),
        ))
        : [];
      const [draftStep] = draftId
        ? await executor.select().from(workflowStepRuns).where(and(
          eq(workflowStepRuns.runId, run.id),
          eq(workflowStepRuns.nodeId, draftId),
        ))
        : [];
      const payload = draftStep?.output?.payload;
      if (!payload || typeof payload !== "object" || !approvalStep?.toolActionRequestId) {
        throw new WorkforceError("approval_payload_mismatch", 409);
      }
      const payloadHash = hashToolValue(payload);
      const [action] = await executor.select().from(toolActionRequests).where(and(
        eq(toolActionRequests.companyId, run.companyId),
        eq(toolActionRequests.id, approvalStep.toolActionRequestId),
      ));
      if (!action || action.status !== "executed" || action.canonicalArgumentsHash !== payloadHash) {
        throw new WorkforceError("approval_payload_mismatch", 409);
      }
      const idempotencyKey = action.id;
      let created = true;
      let deliveryId: string;
      try {
        const [delivery] = await executor.insert(workforceOutboundDeliveries).values({
          companyId: run.companyId,
          agentId: run.agentId,
          workflowRunId: run.id,
          stepRunId: step.id,
          actionRequestId: action.id,
          idempotencyKey,
          payload: payload as Record<string, unknown>,
          payloadHash,
        }).returning();
        if (!delivery) throw new WorkforceError("workflow_step_missing", 500);
        deliveryId = delivery.id;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        created = false;
        const [existing] = await executor.select().from(workforceOutboundDeliveries).where(and(
          eq(workforceOutboundDeliveries.companyId, run.companyId),
          eq(workforceOutboundDeliveries.idempotencyKey, idempotencyKey),
        ));
        if (!existing) throw error;
        deliveryId = existing.id;
      }
      if (created) {
        await log(executor, {
          companyId: run.companyId,
          actor,
          action: "workforce.outbound_sent",
          entityType: "workflow_run",
          entityId: run.id,
          details: { deliveryId, payloadHash },
        });
      }
      await executor.update(workflowStepRuns).set({
        status: "succeeded",
        idempotencyKey,
        output: { deliveryId, payloadHash },
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(workflowStepRuns.id, step.id));
      return { wait: false };
    }

    if (node.type === "tool" && node.tool === "workforce.crm_record") {
      const idempotencyKey = `${run.id}:crm`;
      let recordId: string;
      try {
        const [record] = await executor.insert(workforceCrmRecords).values({
          companyId: run.companyId,
          agentId: run.agentId,
          workflowRunId: run.id,
          idempotencyKey,
          externalRef: run.issueId,
          note: "CRM updated after the approved outreach.",
        }).returning();
        if (!record) throw new WorkforceError("workflow_step_missing", 500);
        recordId = record.id;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const [existing] = await executor.select().from(workforceCrmRecords).where(and(
          eq(workforceCrmRecords.companyId, run.companyId),
          eq(workforceCrmRecords.idempotencyKey, idempotencyKey),
        ));
        if (!existing) throw error;
        recordId = existing.id;
      }
      await executor.update(workflowStepRuns).set({
        status: "succeeded",
        idempotencyKey,
        output: { recordId },
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(workflowStepRuns.id, step.id));
      return { wait: false };
    }

    if (node.type === "artifact") {
      const [agent] = await executor.select({ name: agents.name }).from(agents).where(eq(agents.id, run.agentId));
      const steps = await executor.select().from(workflowStepRuns).where(eq(workflowStepRuns.runId, run.id));
      const draft = steps.find((item) => item.output?.payload && typeof item.output.payload === "object");
      const send = steps.find((item) => typeof item.output?.deliveryId === "string");
      const crm = steps.find((item) => typeof item.output?.recordId === "string");
      const subject = typeof (draft?.output?.payload as { subject?: unknown } | undefined)?.subject === "string"
        ? (draft?.output?.payload as { subject: string }).subject
        : "";
      const html = [
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Shift report</title></head><body>",
        `<h1>${escapeHtml(agent?.name ?? "AI Employee")}</h1>`,
        `<p>Subject: ${escapeHtml(subject)}</p>`,
        `<p>Delivery: ${escapeHtml(String(send?.output?.deliveryId ?? ""))}</p>`,
        `<p>CRM: ${escapeHtml(String(crm?.output?.recordId ?? ""))}</p>`,
        `<p>Shift: ${escapeHtml(run.shiftId ?? "")}</p>`,
        "</body></html>",
      ].join("");
      const body = Buffer.from(html, "utf8");
      const stored = await storeFile({
        companyId: run.companyId,
        originalFilename: "shift-report.html",
        contentType: "text/html",
        body,
      });
      const [asset] = await executor.insert(assets).values({
        companyId: run.companyId,
        provider: stored.provider,
        objectKey: stored.objectKey,
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
        originalFilename: stored.originalFilename,
        createdByAgentId: run.agentId,
      }).returning();
      if (!asset) throw new WorkforceError("workflow_step_missing", 500);
      let workProductId: string | null = null;
      let contentPath = `/api/assets/${asset.id}/content`;
      if (run.issueId) {
        const [attachment] = await executor.insert(issueAttachments).values({
          companyId: run.companyId,
          issueId: run.issueId,
          assetId: asset.id,
        }).returning();
        if (attachment) {
          contentPath = `/api/attachments/${attachment.id}/content`;
          const [product] = await executor.insert(issueWorkProducts).values({
            companyId: run.companyId,
            issueId: run.issueId,
            type: "artifact",
            provider: "workforce",
            title: "Shift report",
            status: "ready_for_review",
            metadata: {
              attachmentId: attachment.id,
              contentType: asset.contentType,
              byteSize: asset.byteSize,
              contentPath,
              openPath: contentPath,
              downloadPath: `${contentPath}?download=1`,
              originalFilename: asset.originalFilename,
              sha256: asset.sha256,
            },
          }).returning();
          workProductId = product?.id ?? null;
        }
      }
      await executor.update(workflowStepRuns).set({
        status: "succeeded",
        output: { assetId: asset.id, workProductId, sha256: asset.sha256, contentPath },
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(workflowStepRuns.id, step.id));
      return { wait: false };
    }

    if (node.type === "end") {
      const [cost] = await executor.select({
        total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
      }).from(costEvents).where(and(
        eq(costEvents.companyId, run.companyId),
        run.issueId ? eq(costEvents.issueId, run.issueId) : sql`false`,
      ));
      const summary = `Shift completed for workflow run ${run.id}.`;
      await executor.update(workflowRuns).set({
        status: "completed",
        currentNodeId: node.id,
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(workflowRuns.id, run.id));
      if (run.shiftId) {
        await executor.update(workforceShifts).set({
          status: "completed",
          summary,
          costCents: cost?.total ?? 0,
          endedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(workforceShifts.id, run.shiftId));
        await workforceMemoryService(executor).writeShiftSummary({
          companyId: run.companyId,
          agentId: run.agentId,
          shiftId: run.shiftId,
          workflowRunId: run.id,
          content: summary,
        });
      }
      await executor.update(workflowStepRuns).set({
        status: "succeeded",
        output: { summary },
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(workflowStepRuns.id, step.id));
      return { wait: true };
    }

    throw new WorkforceError("unsupported_node");
  }

  async function advance(executor: Executor, runId: string, actor?: WorkforceActor) {
    const [run] = await executor.select().from(workflowRuns).where(eq(workflowRuns.id, runId));
    if (!run) throw notFound("Workflow run not found");
    if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") return run;
    const checked = validateWorkforceGraph(run.graphSnapshot);
    if (!checked.ok) throw new WorkforceError(checked.code);
    const { ordered } = chainOf(checked.graph);
    const steps = await executor.select().from(workflowStepRuns).where(eq(workflowStepRuns.runId, run.id));
    const succeeded = new Set(steps.filter((step) => step.status === "succeeded").map((step) => step.nodeId));
    const next = ordered.find((node) => !succeeded.has(node.id));
    if (!next) return run;
    const existing = steps.find((step) => step.nodeId === next.id);
    if (existing?.status === "waiting_for_human") return run;
    if (existing?.status === "running" && !existing.toolActionRequestId) {
      await executor.delete(workflowStepRuns).where(and(
        eq(workflowStepRuns.companyId, run.companyId),
        eq(workflowStepRuns.id, existing.id),
      ));
    } else if (existing && existing.status !== "succeeded") {
      return run;
    }
    try {
      await executor.update(workflowRuns).set({
        currentNodeId: next.id,
        updatedAt: new Date(),
      }).where(eq(workflowRuns.id, run.id));
      const result = await executeNode(executor, run, next, checked.graph, actor);
      if (result.wait) {
        const [updated] = await executor.select().from(workflowRuns).where(eq(workflowRuns.id, run.id));
        return updated ?? run;
      }
      return advance(executor, runId, actor);
    } catch (error) {
      const code = error instanceof WorkforceError ? error.code : "workflow_failed";
      await failRun(executor, run, code, next.id);
      if (error instanceof WorkforceError) throw error;
      throw new WorkforceError(code, 500);
    }
  }

  return {
    nextDelegationDepth,

    async createDefinition(companyId: string, input: {
      template?: "sachi-daily";
      name?: string;
      description?: string | null;
      assigneeAgentId?: string | null;
      graph?: unknown;
    }, actor?: WorkforceActor) {
      const templated = input.template === "sachi-daily";
      const graphInput = templated ? SACHI_DAILY_WORKFLOW_GRAPH : input.graph;
      const checked = validateWorkforceGraph(graphInput);
      if (!checked.ok) throw new WorkforceError(checked.code);
      const now = new Date();
      const [definition] = await db.insert(workflowDefinitions).values({
        companyId,
        name: input.name ?? (templated ? "Daily Sales Operations" : "Workflow"),
        description: input.description ?? null,
        status: templated ? "published" : "draft",
        assigneeAgentId: input.assigneeAgentId ?? null,
        createdByUserId: actor?.actorType === "user" ? actor.actorId : null,
      }).returning();
      if (!definition) throw new WorkforceError("workflow_graph_invalid");
      const [version] = await db.insert(workflowVersions).values({
        companyId,
        definitionId: definition.id,
        versionNumber: 1,
        state: templated ? "published" : "draft",
        graph: checked.graph,
        publishedAt: templated ? now : null,
      }).returning();
      if (!version) throw new WorkforceError("workflow_graph_invalid");
      const [updated] = await db.update(workflowDefinitions).set({
        currentDraftVersionId: templated ? null : version.id,
        publishedVersionId: templated ? version.id : null,
        updatedAt: now,
      }).where(and(eq(workflowDefinitions.id, definition.id), eq(workflowDefinitions.companyId, companyId))).returning();
      return { definition: updated ?? definition, version };
    },

    async listDefinitions(companyId: string) {
      return db.select({
        definition: workflowDefinitions,
        publishedVersionNumber: workflowVersions.versionNumber,
      }).from(workflowDefinitions).leftJoin(
        workflowVersions,
        eq(workflowVersions.id, workflowDefinitions.publishedVersionId),
      ).where(eq(workflowDefinitions.companyId, companyId)).orderBy(desc(workflowDefinitions.createdAt));
    },

    async getDefinition(companyId: string, definitionId: string) {
      const [definition] = await db.select().from(workflowDefinitions).where(and(
        eq(workflowDefinitions.companyId, companyId),
        eq(workflowDefinitions.id, definitionId),
      ));
      if (!definition) return null;
      const versions = await db.select().from(workflowVersions).where(and(
        eq(workflowVersions.companyId, companyId),
        eq(workflowVersions.definitionId, definitionId),
      )).orderBy(desc(workflowVersions.versionNumber));
      const runs = await db.select().from(workflowRuns).where(and(
        eq(workflowRuns.companyId, companyId),
        eq(workflowRuns.definitionId, definitionId),
      )).orderBy(desc(workflowRuns.createdAt));
      return { definition, versions, runs };
    },

    async saveDraft(companyId: string, definitionId: string, nodes: unknown[]) {
      const [definition] = await db.select().from(workflowDefinitions).where(and(
        eq(workflowDefinitions.companyId, companyId),
        eq(workflowDefinitions.id, definitionId),
      ));
      if (!definition) throw notFound("Workflow not found");
      const edges = nodes.slice(0, -1).map((node, index) => ({
        from: (node as { id: string }).id,
        to: (nodes[index + 1] as { id: string }).id,
      }));
      const checked = validateWorkforceGraph({ nodes, edges });
      if (!checked.ok) throw new WorkforceError(checked.code);
      const [currentDraft] = definition.currentDraftVersionId
        ? await db.select().from(workflowVersions).where(and(
          eq(workflowVersions.companyId, companyId),
          eq(workflowVersions.id, definition.currentDraftVersionId),
          eq(workflowVersions.state, "draft"),
        ))
        : [];
      if (currentDraft) {
        const [updated] = await db.update(workflowVersions).set({
          graph: checked.graph,
        }).where(and(
          eq(workflowVersions.id, currentDraft.id),
          eq(workflowVersions.state, "draft"),
        )).returning();
        return updated ?? currentDraft;
      }
      const [latest] = await db.select().from(workflowVersions).where(eq(workflowVersions.definitionId, definition.id)).orderBy(desc(workflowVersions.versionNumber)).limit(1);
      const [created] = await db.insert(workflowVersions).values({
        companyId,
        definitionId: definition.id,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        state: "draft",
        graph: checked.graph,
      }).returning();
      await db.update(workflowDefinitions).set({
        currentDraftVersionId: created?.id ?? null,
        updatedAt: new Date(),
      }).where(and(eq(workflowDefinitions.id, definition.id), eq(workflowDefinitions.companyId, companyId)));
      return created;
    },

    async publish(companyId: string, definitionId: string, actor?: WorkforceActor) {
      const [definition] = await db.select().from(workflowDefinitions).where(and(
        eq(workflowDefinitions.companyId, companyId),
        eq(workflowDefinitions.id, definitionId),
      ));
      if (!definition?.currentDraftVersionId) throw new WorkforceError("workflow_graph_invalid");
      const [draft] = await db.select().from(workflowVersions).where(and(
        eq(workflowVersions.companyId, companyId),
        eq(workflowVersions.id, definition.currentDraftVersionId),
        eq(workflowVersions.state, "draft"),
      ));
      if (!draft) throw new WorkforceError("workflow_graph_invalid");
      const checked = validateWorkforceGraph(draft.graph);
      if (!checked.ok) throw new WorkforceError(checked.code);
      const now = new Date();
      const [published] = await db.update(workflowVersions).set({
        state: "published",
        graph: checked.graph,
        publishedAt: now,
      }).where(and(eq(workflowVersions.id, draft.id), eq(workflowVersions.state, "draft"))).returning();
      if (!published) throw new WorkforceError("workflow_graph_invalid");
      const [updated] = await db.update(workflowDefinitions).set({
        status: "published",
        publishedVersionId: published.id,
        currentDraftVersionId: null,
        updatedAt: now,
      }).where(and(eq(workflowDefinitions.id, definition.id), eq(workflowDefinitions.companyId, companyId))).returning();
      await log(db, {
        companyId,
        actor,
        action: "workforce.workflow_published",
        entityType: "workflow_definition",
        entityId: definition.id,
        details: { versionId: published.id },
      });
      return { definition: updated, version: published };
    },

    async startRun(executor: Executor, input: {
      companyId: string;
      definitionId: string;
      agentId: string | null;
      issueId?: string | null;
      routineId?: string | null;
      routineRunId?: string | null;
      input?: Record<string, unknown>;
    }) {
      if (!input.agentId) throw new WorkforceError("workforce_assignee_required");
      const [definition] = await executor.select().from(workflowDefinitions).where(and(
        eq(workflowDefinitions.companyId, input.companyId),
        eq(workflowDefinitions.id, input.definitionId),
      ));
      if (!definition?.publishedVersionId) throw new WorkforceError("workflow_not_published");
      const [version] = await executor.select().from(workflowVersions).where(and(
        eq(workflowVersions.companyId, input.companyId),
        eq(workflowVersions.id, definition.publishedVersionId),
        eq(workflowVersions.state, "published"),
      ));
      if (!version) throw new WorkforceError("workflow_not_published");
      const checked = validateWorkforceGraph(version.graph);
      if (!checked.ok) throw new WorkforceError(checked.code);
      const [company] = await executor.select().from(companies).where(eq(companies.id, input.companyId));
      if (company?.pauseReason === "budget") throw new WorkforceError("budget_hard_stop", 409);
      const [agent] = await executor.select().from(agents).where(and(
        eq(agents.companyId, input.companyId),
        eq(agents.id, input.agentId),
      ));
      if (!agent) throw new WorkforceError("workforce_assignee_required");
      if (lifecycleOf(agent.metadata) === "draft") throw new WorkforceError("workforce_employee_draft");
      if (!INVOKABLE_STATUSES.has(agent.status)) throw new WorkforceError("workforce_employee_not_invokable");
      const [revision] = await executor.select({ id: agentConfigRevisions.id }).from(agentConfigRevisions).where(and(
        eq(agentConfigRevisions.companyId, input.companyId),
        eq(agentConfigRevisions.agentId, agent.id),
      )).orderBy(desc(agentConfigRevisions.createdAt)).limit(1);
      const memory = workforceMemoryService(executor);
      const context = await memory.contextForNextShift(input.companyId, agent.id);
      const [previous] = await executor.select({ id: workforceShifts.id }).from(workforceShifts).where(and(
        eq(workforceShifts.companyId, input.companyId),
        eq(workforceShifts.agentId, agent.id),
        eq(workforceShifts.status, "completed"),
      )).orderBy(desc(workforceShifts.startedAt)).limit(1);
      const [shift] = await executor.insert(workforceShifts).values({
        companyId: input.companyId,
        agentId: agent.id,
        routineId: input.routineId ?? null,
        routineRunId: input.routineRunId ?? null,
        issueId: input.issueId ?? null,
        previousShiftId: previous?.id ?? null,
        status: "running",
        contextSnapshot: {
          goals: context.goals,
          openIssues: context.openIssues.map((issue) => ({ id: issue.id, title: issue.title, status: issue.status })),
          previousSummary: context.previousSummary,
        },
      }).returning();
      if (!shift) throw new WorkforceError("workflow_step_missing", 500);
      try {
        const [run] = await executor.insert(workflowRuns).values({
          companyId: input.companyId,
          definitionId: definition.id,
          versionId: version.id,
          shiftId: shift.id,
          routineId: input.routineId ?? null,
          routineRunId: input.routineRunId ?? null,
          issueId: input.issueId ?? null,
          agentId: agent.id,
          agentConfigRevisionId: revision?.id ?? null,
          status: "running",
          maxDelegationDepth: 3,
          graphSnapshot: checked.graph,
          input: input.input ?? {},
        }).returning();
        if (!run) throw new WorkforceError("workflow_step_missing", 500);
        await executor.update(workforceShifts).set({
          workflowRunId: run.id,
          updatedAt: new Date(),
        }).where(eq(workforceShifts.id, shift.id));
        return advance(executor, run.id);
      } catch (error) {
        if (isUniqueViolation(error)) throw new WorkforceError("workflow_already_running", 409);
        throw error;
      }
    },

    advance,

    async resumeInterruptedRuns() {
      const runs = await db.select({ id: workflowRuns.id }).from(workflowRuns).where(eq(workflowRuns.status, "running"));
      for (const run of runs) {
        await db.transaction(async (tx) => {
          await advance(tx as unknown as Db, run.id);
        });
      }
      return runs.length;
    },

    async getRun(companyId: string, runId: string) {
      const [run] = await db.select().from(workflowRuns).where(and(
        eq(workflowRuns.companyId, companyId),
        eq(workflowRuns.id, runId),
      ));
      if (!run) return null;
      const steps = await db.select().from(workflowStepRuns).where(and(
        eq(workflowStepRuns.companyId, companyId),
        eq(workflowStepRuns.runId, run.id),
      )).orderBy(workflowStepRuns.createdAt);
      return { run, steps };
    },

    async cancelRun(companyId: string, runId: string, actor?: WorkforceActor) {
      const [run] = await db.select().from(workflowRuns).where(and(
        eq(workflowRuns.companyId, companyId),
        eq(workflowRuns.id, runId),
      ));
      if (!run) throw notFound("Workflow run not found");
      await db.update(workflowRuns).set({
        status: "cancelled",
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(workflowRuns.companyId, companyId), eq(workflowRuns.id, run.id)));
      if (run.shiftId) {
        await db.update(workforceShifts).set({
          status: "cancelled",
          endedAt: new Date(),
          updatedAt: new Date(),
        }).where(and(eq(workforceShifts.companyId, companyId), eq(workforceShifts.id, run.shiftId)));
      }
      const pendingSteps = await db.select().from(workflowStepRuns).where(and(
        eq(workflowStepRuns.companyId, companyId),
        eq(workflowStepRuns.runId, run.id),
        eq(workflowStepRuns.status, "waiting_for_human"),
      ));
      for (const step of pendingSteps) {
        if (!step.toolActionRequestId) continue;
        await db.update(toolActionRequests).set({
          status: "cancelled",
          updatedAt: new Date(),
        }).where(and(
          eq(toolActionRequests.companyId, companyId),
          eq(toolActionRequests.id, step.toolActionRequestId),
          eq(toolActionRequests.status, "pending"),
        ));
      }
      await log(db, {
        companyId,
        actor,
        action: "workforce.run_cancelled",
        entityType: "workflow_run",
        entityId: run.id,
      });
      return this.getRun(companyId, run.id);
    },

    async listShifts(companyId: string) {
      return db.select().from(workforceShifts).where(eq(workforceShifts.companyId, companyId)).orderBy(desc(workforceShifts.startedAt));
    },

    async getShift(companyId: string, shiftId: string) {
      const [shift] = await db.select().from(workforceShifts).where(and(
        eq(workforceShifts.companyId, companyId),
        eq(workforceShifts.id, shiftId),
      ));
      if (!shift) return null;
      const [previous] = shift.previousShiftId
        ? await db.select().from(workforceShifts).where(and(
          eq(workforceShifts.companyId, companyId),
          eq(workforceShifts.id, shift.previousShiftId),
        ))
        : [];
      const run = shift.workflowRunId ? await this.getRun(companyId, shift.workflowRunId) : null;
      return { shift, previous: previous ?? null, run };
    },

    async listApprovals(companyId: string) {
      const rows = await db.select({
        request: toolActionRequests,
        step: workflowStepRuns,
        agentName: agents.name,
      }).from(toolActionRequests).innerJoin(
        toolInvocations,
        eq(toolInvocations.id, toolActionRequests.invocationId),
      ).innerJoin(
        workflowStepRuns,
        eq(workflowStepRuns.toolActionRequestId, toolActionRequests.id),
      ).leftJoin(
        agents,
        eq(agents.id, toolActionRequests.requestedByAgentId),
      ).where(and(
        eq(toolActionRequests.companyId, companyId),
        eq(toolInvocations.toolName, OUTBOUND_TOOL),
        eq(toolActionRequests.status, "pending"),
      )).orderBy(desc(toolActionRequests.createdAt));
      return rows.map((row) => ({
        id: row.request.id,
        agentName: row.agentName,
        toolName: OUTBOUND_TOOL,
        risk: "EXTERNAL_COMMUNICATION" as const,
        payload: row.step.output?.payload ?? null,
        issueId: row.request.issueId,
        expiresAt: row.request.expiresAt,
        status: row.request.status,
      }));
    },

    async decideApproval(companyId: string, actionRequestId: string, decision: "approve" | "reject", actor?: WorkforceActor) {
      const [request] = await db.select().from(toolActionRequests).where(and(
        eq(toolActionRequests.companyId, companyId),
        eq(toolActionRequests.id, actionRequestId),
      ));
      if (!request) throw notFound("Approval not found");
      const [step] = await db.select().from(workflowStepRuns).where(and(
        eq(workflowStepRuns.companyId, companyId),
        eq(workflowStepRuns.toolActionRequestId, request.id),
      ));
      if (!step) throw notFound("Approval not found");
      const [run] = await db.select().from(workflowRuns).where(and(
        eq(workflowRuns.companyId, companyId),
        eq(workflowRuns.id, step.runId),
      ));
      if (!run) throw notFound("Workflow run not found");
      if (request.expiresAt && request.expiresAt.getTime() <= Date.now() && request.status === "pending") {
        await db.update(toolActionRequests).set({ status: "expired", updatedAt: new Date() }).where(eq(toolActionRequests.id, request.id));
        await failRun(db, run, "approval_expired", step.nodeId);
        throw new WorkforceError("approval_expired");
      }
      if (decision === "reject") {
        if (request.status === "executed") throw new WorkforceError("approval_payload_mismatch", 409);
        await db.update(toolActionRequests).set({
          status: "rejected",
          decidedAt: new Date(),
          updatedAt: new Date(),
        }).where(and(eq(toolActionRequests.companyId, companyId), eq(toolActionRequests.id, request.id)));
        await failRun(db, run, "approval_rejected", step.nodeId);
        await log(db, {
          companyId,
          actor,
          action: "workforce.approval_rejected",
          entityType: "tool_action_request",
          entityId: request.id,
        });
        return { status: "rejected" as const };
      }
      const payload = step.output?.payload;
      const payloadHash = payload && typeof payload === "object" ? hashToolValue(payload) : "";
      if (request.canonicalArgumentsHash !== payloadHash) {
        throw new WorkforceError("approval_payload_mismatch", 409);
      }
      const [invocation] = await db.select().from(toolInvocations).where(eq(toolInvocations.id, request.invocationId));
      const signedOk = verifyToolArgumentsSignature({
        signedArguments: request.signedArguments,
        invocationId: request.invocationId,
        toolName: OUTBOUND_TOOL,
        canonicalArguments: canonicalToolArguments(payload),
        executionOnApprove: true,
      });
      if (!signedOk || !invocation) throw new WorkforceError("approval_payload_mismatch", 409);
      if (request.status === "pending") {
        await db.update(toolActionRequests).set({
          status: "executed",
          decidedAt: new Date(),
          resolvedAt: new Date(),
          updatedAt: new Date(),
        }).where(and(
          eq(toolActionRequests.companyId, companyId),
          eq(toolActionRequests.id, request.id),
          eq(toolActionRequests.status, "pending"),
        ));
        await db.update(workflowStepRuns).set({
          status: "succeeded",
          completedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(workflowStepRuns.id, step.id));
        await log(db, {
          companyId,
          actor,
          action: "workforce.approval_approved",
          entityType: "tool_action_request",
          entityId: request.id,
        });
      } else if (request.status !== "executed") {
        throw new WorkforceError("approval_payload_mismatch", 409);
      }
      await db.update(workflowRuns).set({ status: "running", updatedAt: new Date() }).where(and(
        eq(workflowRuns.companyId, companyId),
        eq(workflowRuns.id, run.id),
        eq(workflowRuns.status, "waiting_for_human"),
      ));
      if (run.shiftId) {
        await db.update(workforceShifts).set({ status: "running", updatedAt: new Date() }).where(and(
          eq(workforceShifts.companyId, companyId),
          eq(workforceShifts.id, run.shiftId),
          eq(workforceShifts.status, "waiting_for_human"),
        ));
      }
      return db.transaction(async (tx) => advance(tx as unknown as Db, run.id, actor));
    },

    async expireDueApprovals(now = new Date()) {
      const due = await db.select().from(toolActionRequests).where(and(
        eq(toolActionRequests.status, "pending"),
        sql`${toolActionRequests.expiresAt} is not null and ${toolActionRequests.expiresAt} <= ${now}`,
      ));
      let expired = 0;
      for (const request of due) {
        const [invocation] = await db.select().from(toolInvocations).where(and(
          eq(toolInvocations.id, request.invocationId),
          eq(toolInvocations.toolName, OUTBOUND_TOOL),
        ));
        if (!invocation) continue;
        const [step] = await db.select().from(workflowStepRuns).where(eq(workflowStepRuns.toolActionRequestId, request.id));
        const [run] = step
          ? await db.select().from(workflowRuns).where(eq(workflowRuns.id, step.runId))
          : [];
        await db.update(toolActionRequests).set({ status: "expired", updatedAt: new Date() }).where(eq(toolActionRequests.id, request.id));
        if (run && step) await failRun(db, run, "approval_expired", step.nodeId);
        expired += 1;
      }
      return expired;
    },

    async overview(companyId: string) {
      const agentRows = await db.select({ status: agents.status, metadata: agents.metadata }).from(agents).where(eq(agents.companyId, companyId));
      const invokable = agentRows.filter((agent) => INVOKABLE_STATUSES.has(agent.status) && lifecycleOf(agent.metadata) !== "draft").length;
      const shifts = await db.select({ status: workforceShifts.status }).from(workforceShifts).where(eq(workforceShifts.companyId, companyId));
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [failed] = await db.select({
        total: sql<number>`count(*)::int`,
      }).from(workflowRuns).where(and(
        eq(workflowRuns.companyId, companyId),
        eq(workflowRuns.status, "failed"),
        gte(workflowRuns.startedAt, weekAgo),
      ));
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const [spend] = await db.select({
        total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
      }).from(costEvents).where(and(
        eq(costEvents.companyId, companyId),
        gte(costEvents.occurredAt, monthStart),
      ));
      const pending = await this.listApprovals(companyId);
      const [nextTrigger] = await db.select({
        nextRunAt: routineTriggers.nextRunAt,
        routineId: routines.id,
        title: routines.title,
      }).from(routineTriggers).innerJoin(routines, eq(routines.id, routineTriggers.routineId)).where(and(
        eq(routines.companyId, companyId),
        sql`${routines.workflowDefinitionId} is not null`,
        eq(routineTriggers.enabled, true),
        eq(routineTriggers.archived, false),
      )).orderBy(routineTriggers.nextRunAt).limit(1);
      const recentShifts = await this.listShifts(companyId);
      const [workflowCount] = await db.select({
        total: sql<number>`count(*)::int`,
      }).from(workflowDefinitions).where(eq(workflowDefinitions.companyId, companyId));
      return {
        totalAgents: agentRows.length,
        invokableAgents: invokable,
        runningShifts: shifts.filter((shift) => shift.status === "running").length,
        waitingForHumanShifts: shifts.filter((shift) => shift.status === "waiting_for_human").length,
        failedRunsLast7Days: failed?.total ?? 0,
        completedShifts: shifts.filter((shift) => shift.status === "completed").length,
        monthSpendCents: spend?.total ?? 0,
        pendingApprovals: pending.length,
        nextRoutine: nextTrigger?.nextRunAt ? nextTrigger : null,
        recentShifts: recentShifts.slice(0, 8),
        workflowCount: workflowCount?.total ?? 0,
      };
    },

    listMemories(companyId: string, actor: WorkforceMemoryActor, filters?: { agentId?: string; scopeType?: string }) {
      return workforceMemoryService(db).list(companyId, actor, filters);
    },

    deleteMemory(companyId: string, memoryId: string) {
      return workforceMemoryService(db).remove(companyId, memoryId);
    },

    contextForNextShift(companyId: string, agentId: string) {
      return workforceMemoryService(db).contextForNextShift(companyId, agentId);
    },
  };
}

export function workforceReportSha256(html: string) {
  return createHash("sha256").update(html).digest("hex");
}
