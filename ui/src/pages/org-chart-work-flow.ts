import type { Issue } from "@paperclipai/shared";
import { filterIssueDescendants } from "../lib/issue-tree";

const OPEN_STATUSES = new Set([
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
]);

export type OrgWorkFlowStats = {
  openByAgent: Map<string, number>;
  inProgressByAgent: Map<string, number>;
  activeChildAgentIds: Set<string>;
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

export function buildOrgWorkFlowStats(
  issues: Issue[],
  rootIssueId: string | null,
): OrgWorkFlowStats {
  const openByAgent = new Map<string, number>();
  const inProgressByAgent = new Map<string, number>();
  const activeChildAgentIds = new Set<string>();
  if (!rootIssueId) {
    return { openByAgent, inProgressByAgent, activeChildAgentIds };
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
      if (issue.id !== rootIssueId) activeChildAgentIds.add(agentId);
    }
    if (issue.status === "in_progress") {
      inProgressByAgent.set(agentId, (inProgressByAgent.get(agentId) ?? 0) + 1);
    }
  }

  return { openByAgent, inProgressByAgent, activeChildAgentIds };
}
