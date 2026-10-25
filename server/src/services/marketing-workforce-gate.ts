import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issueDocuments, issueThreadInteractions, issues } from "@paperclipai/db";
import {
  MARKETING_REQUIREMENT_DOCUMENT_KEYS,
  readMarketingWorkforceMarker,
  requiresApprovedRequirementBrief,
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

export function interactionConfirmsRequirementBrief(row: {
  kind: string;
  status: string;
  payload: unknown;
}): boolean {
  if (row.status !== "accepted") return false;
  if (
    row.kind !== "request_confirmation" &&
    row.kind !== "request_checkbox_confirmation"
  ) {
    return false;
  }
  return (
    extractConfirmationTargetKey(row.payload) ===
    MARKETING_REQUIREMENT_DOCUMENT_KEYS.brief
  );
}

/**
 * Assert marketing planning/execution children are only created after the
 * campaign parent's requirement brief confirmation is accepted.
 */
export async function assertMarketingPlanningAllowed(args: {
  db: DbLike;
  companyId: string;
  parentId: string | null | undefined;
  childExecutionPolicy: unknown;
}): Promise<void> {
  const childMarker = readMarketingWorkforceMarker(args.childExecutionPolicy);
  if (!requiresApprovedRequirementBrief(childMarker)) return;
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

  const interactions = await args.db
    .select({
      kind: issueThreadInteractions.kind,
      status: issueThreadInteractions.status,
      payload: issueThreadInteractions.payload,
    })
    .from(issueThreadInteractions)
    .where(
      and(
        eq(issueThreadInteractions.companyId, args.companyId),
        eq(issueThreadInteractions.issueId, args.parentId),
        eq(issueThreadInteractions.status, "accepted"),
        inArray(issueThreadInteractions.kind, [
          "request_confirmation",
          "request_checkbox_confirmation",
        ]),
      ),
    );

  const confirmed = interactions.some((row) =>
    interactionConfirmsRequirementBrief(row),
  );

  if (!confirmed) {
    throw unprocessable(
      "Marketing planning is blocked until the requirement brief is confirmed on the campaign parent",
      {
        code: "marketing_requirement_brief_unconfirmed",
        parentIssueId: args.parentId,
        childWorkflowId: (childMarker as MarketingWorkforceMarker | null)
          ?.workflowId,
      },
    );
  }
}
