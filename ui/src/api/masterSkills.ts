import type {
  CreateMasterSkill,
  MasterSkillCatalogPref,
  MasterSkillOption,
  MasterSkillRecord,
  UpdateMasterSkill,
  UpsertMasterSkillCatalogPref,
} from "@paperclipai/shared";
import { api } from "./client";

export const masterSkillsApi = {
  list: (includeDisabled = false) =>
    api.get<MasterSkillRecord[]>(`/instance/master-skills${includeDisabled ? "?includeDisabled=true" : ""}`),
  create: (body: CreateMasterSkill) =>
    api.post<MasterSkillRecord>("/instance/master-skills", body),
  update: (id: string, body: UpdateMasterSkill) =>
    api.patch<MasterSkillRecord>(`/instance/master-skills/${id}`, body),
  remove: (id: string) => api.delete(`/instance/master-skills/${id}`),
  listPrefs: () =>
    api.get<MasterSkillCatalogPref[]>("/instance/master-skill-catalog-prefs"),
  upsertPref: (body: UpsertMasterSkillCatalogPref) =>
    api.put<MasterSkillCatalogPref>("/instance/master-skill-catalog-prefs", body),
  listOptions: (includeDisabled = false) =>
    api.get<MasterSkillOption[]>(
      `/instance/master-skill-options${includeDisabled ? "?includeDisabled=true" : ""}`,
    ),
};
