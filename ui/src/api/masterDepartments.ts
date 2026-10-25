import type {
  CreateMasterDepartment,
  MasterDepartmentRecord,
  UpdateMasterDepartment,
} from "@paperclipai/shared";
import { api } from "./client";

export const masterDepartmentsApi = {
  list: (includeDisabled = false) =>
    api.get<MasterDepartmentRecord[]>(
      `/instance/master-departments${includeDisabled ? "?includeDisabled=true" : ""}`,
    ),
  create: (body: CreateMasterDepartment) =>
    api.post<MasterDepartmentRecord>("/instance/master-departments", body),
  update: (id: string, body: UpdateMasterDepartment) =>
    api.patch<MasterDepartmentRecord>(`/instance/master-departments/${id}`, body),
  remove: (id: string) => api.delete(`/instance/master-departments/${id}`),
};
