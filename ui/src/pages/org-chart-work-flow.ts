import type { Issue, IssueStatus } from "@paperclipai/shared";
import { filterIssueDescendants } from "../lib/issue-tree";

const OPEN_STATUSES = new Set<IssueStatus>([
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
]);

const BOTH_TRANSFER_STATUSES = new Set<IssueStatus>(["in_progress", "in_review"]);

export type OrgWorkFlowTransfer = "down" | "both";

export type OrgWorkFlowOpenIssue = {
  id: string;
  title: string;
  status: IssueStatus;
  transfer: OrgWorkFlowTransfer;
};

export type OrgWorkFlowStats = {
  openByAgent: Map<string, number>;
  inProgressByAgent: Map<string, number>;
  activeChildAgentIds: Set<string>;
  openIssuesByAgent: Map<string, OrgWorkFlowOpenIssue[]>;
  upTransferAgentIds: Set<string>;
};

export function resolveWorkRootIssueId(
  issues: Issue[],
  preferredIssueId: string | null,
): string | null {
  if (preferredIssueId && issues.some((issue) => issue.id === preferredIssueId)) {
    return preferredIssueId;
  }
  const roots = issues
    .filter((issue) => !issue.parentId && OPEN_STATUSES.has(issue.status))
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });
  return roots[0]?.id ?? null;
}

function resolveTransfer(
  status: IssueStatus,
  agentId: string,
  runningAgentIds: ReadonlySet<string> | undefined,
): OrgWorkFlowTransfer {
  if (BOTH_TRANSFER_STATUSES.has(status) || runningAgentIds?.has(agentId)) {
    return "both";
  }
  return "down";
}

export function buildOrgWorkFlowStats(
  issues: Issue[],
  rootIssueId: string | null,
  runningAgentIds?: ReadonlySet<string>,
): OrgWorkFlowStats {
  const openByAgent = new Map<string, number>();
  const inProgressByAgent = new Map<string, number>();
  const activeChildAgentIds = new Set<string>();
  const openIssuesByAgent = new Map<string, OrgWorkFlowOpenIssue[]>();
  const upTransferAgentIds = new Set<string>();
  if (!rootIssueId) {
    return {
      openByAgent,
      inProgressByAgent,
      activeChildAgentIds,
      openIssuesByAgent,
      upTransferAgentIds,
    };
  }

  const campaign = [
    ...issues.filter((issue) => issue.id === rootIssueId),
    ...filterIssueDescendants(rootIssueId, issues),
  ];

  for (const issue of campaign) {
    const agentId = issue.assigneeAgentId;
    if (!agentId) continue;
    if (OPEN_STATUSES.has(issue.status)) {
      openByAgent.set(agentId, (openByAgent.get(agentId) ?? 0) + 1);
      if (issue.id !== rootIssueId) {
        activeChildAgentIds.add(agentId);
        const transfer = resolveTransfer(issue.status, agentId, runningAgentIds);
        if (transfer === "both") upTransferAgentIds.add(agentId);
        const list = openIssuesByAgent.get(agentId) ?? [];
        list.push({
          id: issue.id,
          title: issue.title,
          status: issue.status,
          transfer,
        });
        openIssuesByAgent.set(agentId, list);
      }
    }
    if (issue.status === "in_progress") {
      inProgressByAgent.set(agentId, (inProgressByAgent.get(agentId) ?? 0) + 1);
    }
  }

  return {
    openByAgent,
    inProgressByAgent,
    activeChildAgentIds,
    openIssuesByAgent,
    upTransferAgentIds,
  };
}

/** Walk ancestors (immediate parent first) to the campaign/work root id. */
export function resolveWorkRootFromIssue(issue: {
  id: string;
  parentId?: string | null;
  ancestors?: Array<{ id: string }> | null;
}): string {
  const ancestors = issue.ancestors ?? [];
  if (ancestors.length > 0) {
    return ancestors[ancestors.length - 1]!.id;
  }
  return issue.parentId ?? issue.id;
}
