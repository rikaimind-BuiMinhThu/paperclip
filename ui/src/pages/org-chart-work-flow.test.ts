import { describe, expect, it } from "vitest";
import type { Issue } from "@paperclipai/shared";
import { buildOrgWorkFlowStats, resolveWorkRootIssueId } from "./org-chart-work-flow";

function issue(partial: Partial<Issue> & Pick<Issue, "id" | "status">): Issue {
  return {
    companyId: "company-1",
    title: partial.title ?? partial.id,
    description: null,
    status: partial.status,
    priority: "medium",
    assigneeAgentId: partial.assigneeAgentId ?? null,
    assigneeUserId: null,
    parentId: partial.parentId ?? null,
    projectId: null,
    goalId: null,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: partial.updatedAt ?? "2026-10-20T00:00:00.000Z",
    ...partial,
  } as Issue;
}

describe("org-chart-work-flow", () => {
  it("prefers the workIssue query root when present", () => {
    const issues = [
      issue({ id: "root-a", status: "todo", assigneeAgentId: "cmo", updatedAt: "2026-10-21T00:00:00.000Z" }),
      issue({ id: "root-b", status: "todo", assigneeAgentId: "cmo", updatedAt: "2026-10-22T00:00:00.000Z" }),
    ];
    expect(resolveWorkRootIssueId(issues, "root-a")).toBe("root-a");
    expect(resolveWorkRootIssueId(issues, null)).toBe("root-b");
  });

  it("counts open children per assignee and marks active child agents", () => {
    const issues = [
      issue({ id: "campaign", status: "todo", assigneeAgentId: "cmo" }),
      issue({ id: "copy", status: "todo", parentId: "campaign", assigneeAgentId: "writer" }),
      issue({ id: "video", status: "in_progress", parentId: "campaign", assigneeAgentId: "editor" }),
      issue({ id: "done", status: "done", parentId: "campaign", assigneeAgentId: "social" }),
      issue({ id: "other", status: "todo", assigneeAgentId: "other" }),
    ];
    const stats = buildOrgWorkFlowStats(issues, "campaign");
    expect(stats.openByAgent.get("cmo")).toBe(1);
    expect(stats.openByAgent.get("writer")).toBe(1);
    expect(stats.openByAgent.get("editor")).toBe(1);
    expect(stats.openByAgent.has("social")).toBe(false);
    expect(stats.inProgressByAgent.get("editor")).toBe(1);
    expect([...stats.activeChildAgentIds].sort()).toEqual(["editor", "writer"]);
  });
});
