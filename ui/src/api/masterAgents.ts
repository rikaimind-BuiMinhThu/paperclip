import type {
  CreateMasterAgent,
  CreateMasterTeam,
  DefaultModelStatus,
  MasterAgentRecord,
  MasterTeamRecord,
  OnboardingHireRequest,
  PutDefaultModel,
  UpdateMasterAgent,
  UpdateMasterTeam,
} from "@paperclipai/shared";
import { api } from "./client";

export interface OnboardingHireResult {
  agents: Array<{ id: string; name: string }>;
  managerAgentId: string;
  label: string;
}

export const masterAgentsApi = {
  list: (includeDisabled = false) =>
    api.get<MasterAgentRecord[]>(`/instance/master-agents${includeDisabled ? "?includeDisabled=true" : ""}`),
  create: (body: CreateMasterAgent) =>
    api.post<MasterAgentRecord>("/instance/master-agents", body),
  update: (id: string, body: UpdateMasterAgent) =>
    api.patch<MasterAgentRecord>(`/instance/master-agents/${id}`, body),
  remove: (id: string) => api.delete(`/instance/master-agents/${id}`),
  listTeams: (includeDisabled = false) =>
    api.get<MasterTeamRecord[]>(`/instance/master-teams${includeDisabled ? "?includeDisabled=true" : ""}`),
  createTeam: (body: CreateMasterTeam) =>
    api.post<MasterTeamRecord>("/instance/master-teams", body),
  updateTeam: (id: string, body: UpdateMasterTeam) =>
    api.patch<MasterTeamRecord>(`/instance/master-teams/${id}`, body),
  removeTeam: (id: string) => api.delete(`/instance/master-teams/${id}`),
  defaultModel: () => api.get<DefaultModelStatus>("/instance/default-model"),
  putDefaultModel: (body: PutDefaultModel) =>
    api.put<DefaultModelStatus>("/instance/default-model", body),
  hire: (companyId: string, body: OnboardingHireRequest) =>
    api.post<OnboardingHireResult>(`/companies/${companyId}/onboarding/hires`, body),
};
