import type { WorkforceNode } from "@paperclipai/shared";
import { api } from "./client";

export interface WorkforceOverview {
  totalAgents: number;
  invokableAgents: number;
  runningShifts: number;
  waitingForHumanShifts: number;
  failedRunsLast7Days: number;
  completedShifts: number;
  monthSpendCents: number;
  pendingApprovals: number;
  nextRoutine: { nextRunAt: string | null; routineId: string; title: string } | null;
  recentShifts: WorkforceShift[];
  workflowCount: number;
}

export interface WorkforceDefinition {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  status: string;
  assigneeAgentId: string | null;
  publishedVersionId: string | null;
  currentDraftVersionId: string | null;
}

export interface WorkforceDefinitionListItem {
  definition: WorkforceDefinition;
  publishedVersionNumber: number | null;
}

export interface WorkforceVersion {
  id: string;
  versionNumber: number;
  state: string;
  graph: { nodes: WorkforceNode[]; edges: { from: string; to: string }[] };
}

export interface WorkforceRun {
  id: string;
  status: string;
  issueId: string | null;
  shiftId: string | null;
  errorCode: string | null;
  currentNodeId: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface WorkforceStep {
  id: string;
  nodeId: string;
  nodeType: string;
  status: string;
  output: Record<string, unknown>;
}

export interface WorkforceShift {
  id: string;
  agentId: string;
  status: string;
  summary: string | null;
  costCents: number;
  startedAt: string;
  endedAt: string | null;
  contextSnapshot: Record<string, unknown> | null;
  workflowRunId: string | null;
}

export interface WorkforceApproval {
  id: string;
  agentName: string | null;
  toolName: string;
  risk: "EXTERNAL_COMMUNICATION";
  payload: { to?: string; subject?: string; body?: string } | null;
  issueId: string | null;
  expiresAt: string | null;
  status: string;
}

export const workforceApi = {
  overview: (companyId: string) =>
    api.get<WorkforceOverview>(`/companies/${companyId}/workforce/overview`),
  listWorkflows: (companyId: string) =>
    api.get<WorkforceDefinitionListItem[]>(`/companies/${companyId}/workforce/workflows`),
  createWorkflow: (companyId: string, body: { template: "sachi-daily"; assigneeAgentId?: string | null }) =>
    api.post<{ definition: WorkforceDefinition; version: WorkforceVersion }>(
      `/companies/${companyId}/workforce/workflows`,
      body,
    ),
  getWorkflow: (companyId: string, definitionId: string) =>
    api.get<{ definition: WorkforceDefinition; versions: WorkforceVersion[]; runs: WorkforceRun[] }>(
      `/companies/${companyId}/workforce/workflows/${definitionId}`,
    ),
  saveDraft: (companyId: string, definitionId: string, nodes: WorkforceNode[]) =>
    api.put<WorkforceVersion>(`/companies/${companyId}/workforce/workflows/${definitionId}/draft`, { nodes }),
  publish: (companyId: string, definitionId: string) =>
    api.post<{ definition: WorkforceDefinition; version: WorkforceVersion }>(
      `/companies/${companyId}/workforce/workflows/${definitionId}/publish`,
      {},
    ),
  startRun: (companyId: string, definitionId: string, input: Record<string, unknown>) =>
    api.post<WorkforceRun>(`/companies/${companyId}/workforce/workflows/${definitionId}/runs`, { input }),
  getRun: (companyId: string, runId: string) =>
    api.get<{ run: WorkforceRun; steps: WorkforceStep[] }>(`/companies/${companyId}/workforce/workflows/runs/${runId}`),
  cancelRun: (companyId: string, runId: string) =>
    api.post<{ run: WorkforceRun }>(`/companies/${companyId}/workforce/workflows/runs/${runId}/cancel`, {}),
  listShifts: (companyId: string) =>
    api.get<WorkforceShift[]>(`/companies/${companyId}/workforce/shifts`),
  getShift: (companyId: string, shiftId: string) =>
    api.get<{
      shift: WorkforceShift;
      previous: WorkforceShift | null;
      run: { run: WorkforceRun; steps: WorkforceStep[] } | null;
    }>(`/companies/${companyId}/workforce/shifts/${shiftId}`),
  listApprovals: (companyId: string) =>
    api.get<WorkforceApproval[]>(`/companies/${companyId}/workforce/approvals`),
  approve: (companyId: string, actionRequestId: string) =>
    api.post<unknown>(`/companies/${companyId}/workforce/approvals/${actionRequestId}/approve`, {}),
  reject: (companyId: string, actionRequestId: string) =>
    api.post<unknown>(`/companies/${companyId}/workforce/approvals/${actionRequestId}/reject`, {}),
};
