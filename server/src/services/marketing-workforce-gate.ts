import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issueDocuments, issueThreadInteractions, issues } from "@paperclipai/db";
import {
  MARKETING_REQUIREMENT_DOCUMENT_KEYS,
  readMarketingWorkforceMarker,
  requiredAuthorizationDocumentKey,
  requiresApprovedRequirementBrief,
  requiresMarketingStrategyApproval,
  type MarketingWorkforceMarker,
} from "@paperclipai/shared/validators/marketing-requirement";
import { unprocessable } from "../errors.js";

type DbLike = Pick<Db, "select">;

export function extractConfirmationTargetKey(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const target = (payload as { target?: unknown }).target;
  if (!target || typeof target !== "object" || Array.isArray(target)) return null;
  const key = (target as { key?: unknown }).key;
  return typeof key === "string" && key.trim() ? key : null;
}

export function interactionConfirmsDocumentKey(
  row: {
    kind: string;
    status: string;
    payload: unknown;
  },
  documentKey: string,
): boolean {
  if (row.status !== "accepted") return false;
  if (
    row.kind !== "request_confirmation" &&
    row.kind !== "request_checkbox_confirmation"
  ) {
    return false;
  }
  return extractConfirmationTargetKey(row.payload) === documentKey;
}

export function interactionConfirmsRequirementBrief(row: {
  kind: string;
  status: string;
  payload: unknown;
}): boolean {
  return interactionConfirmsDocumentKey(
    row,
    MARKETING_REQUIREMENT_DOCUMENT_KEYS.brief,
  );
}

async function listAcceptedConfirmations(args: {
  db: DbLike;
  companyId: string;
  issueId: string;
}) {
  return args.db
    .select({
      kind: issueThreadInteractions.kind,
      status: issueThreadInteractions.status,
      payload: issueThreadInteractions.payload,
    })
    .from(issueThreadInteractions)
    .where(
      and(
        eq(issueThreadInteractions.companyId, args.companyId),
        eq(issueThreadInteractions.issueId, args.issueId),
        eq(issueThreadInteractions.status, "accepted"),
        inArray(issueThreadInteractions.kind, [
          "request_confirmation",
          "request_checkbox_confirmation",
        ]),
      ),
    );
}

async function assertAcceptedDocumentConfirmation(args: {
  db: DbLike;
  companyId: string;
  issueId: string;
  documentKey: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  const interactions = await listAcceptedConfirmations({
    db: args.db,
    companyId: args.companyId,
    issueId: args.issueId,
  });
  const confirmed = interactions.some((row) =>
    interactionConfirmsDocumentKey(row, args.documentKey),
  );
  if (!confirmed) {
    throw unprocessable(args.message, {
      code: args.code,
      documentKey: args.documentKey,
      issueId: args.issueId,
      ...args.details,
    });
  }
}

/**
 * Assert marketing planning/execution children are only created after the
 * campaign parent's requirement brief confirmation is accepted. Also enforce
 * strategy approval for later workflows and external-action authorizations.
 */
export async function assertMarketingPlanningAllowed(args: {
  db: DbLike;
  companyId: string;
  parentId: string | null | undefined;
  childExecutionPolicy: unknown;
}): Promise<void> {
  const childMarker = readMarketingWorkforceMarker(args.childExecutionPolicy);
  if (!childMarker) return;

  const needsBrief = requiresApprovedRequirementBrief(childMarker);
  const needsStrategy = requiresMarketingStrategyApproval(childMarker);
  const authDocKey = requiredAuthorizationDocumentKey(childMarker);
  if (!needsBrief && !needsStrategy && !authDocKey) return;

  if (!args.parentId) {
    throw unprocessable(
      "Marketing planning/execution issues require a campaign parent with a confirmed requirement brief",
      { code: "marketing_requirement_brief_required" },
    );
  }

  const [parent] = await args.db
    .select({
      id: issues.id,
      executionPolicy: issues.executionPolicy,
    })
    .from(issues)
    .where(
      and(eq(issues.companyId, args.companyId), eq(issues.id, args.parentId)),
    )
    .limit(1);

  if (!parent) {
    throw unprocessable("Parent issue not found for marketing workforce child", {
      code: "marketing_parent_not_found",
    });
  }

  const parentMarker = readMarketingWorkforceMarker(parent.executionPolicy);
  const [stateDoc] = await args.db
    .select({ key: issueDocuments.key })
    .from(issueDocuments)
    .where(
      and(
        eq(issueDocuments.companyId, args.companyId),
        eq(issueDocuments.issueId, args.parentId),
        eq(issueDocuments.key, MARKETING_REQUIREMENT_DOCUMENT_KEYS.state),
      ),
    )
    .limit(1);

  const parentIsMarketingCampaign =
    Boolean(stateDoc) ||
    parentMarker?.workflowId === "WF-01" ||
    parentMarker?.phase === "discovery";

  if (!parentIsMarketingCampaign) {
    throw unprocessable(
      "Marketing planning/execution children must hang under a WF-01 campaign parent",
      { code: "marketing_parent_not_campaign" },
    );
  }

  if (needsBrief) {
    await assertAcceptedDocumentConfirmation({
      db: args.db,
      companyId: args.companyId,
      issueId: args.parentId,
      documentKey: MARKETING_REQUIREMENT_DOCUMENT_KEYS.brief,
      code: "marketing_requirement_brief_unconfirmed",
      message:
        "Marketing planning is blocked until the requirement brief is confirmed on the campaign parent",
      details: {
        parentIssueId: args.parentId,
        childWorkflowId: (childMarker as MarketingWorkforceMarker).workflowId,
      },
    });
  }

  if (needsStrategy) {
    await assertAcceptedDocumentConfirmation({
      db: args.db,
      companyId: args.companyId,
      issueId: args.parentId,
      documentKey: MARKETING_REQUIREMENT_DOCUMENT_KEYS.strategy,
      code: "marketing_strategy_unconfirmed",
      message:
        "Content/campaign/growth work is blocked until marketing_strategy is confirmed on the campaign parent",
      details: {
        parentIssueId: args.parentId,
        childWorkflowId: childMarker.workflowId,
      },
    });
  }

  if (authDocKey) {
    await assertAcceptedDocumentConfirmation({
      db: args.db,
      companyId: args.companyId,
      issueId: args.parentId,
      documentKey: authDocKey,
      code: "marketing_external_action_unauthorized",
      message: `Unauthorized marketing ${childMarker.externalAction} action is blocked until ${authDocKey} is confirmed`,
      details: {
        parentIssueId: args.parentId,
        externalAction: childMarker.externalAction,
      },
    });
  }
}
