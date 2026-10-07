import { api } from "./client";

export type PricingPlan = {
  id: string;
  slug: string;
  displayName: string;
  monthlyTokenLimit: number;
  monthlyCostCentsLimit: number;
  costMultiplierBps: number;
  allowedModels: string[];
  rpmLimit: number;
  isActive: boolean;
};

export type ApiApp = {
  id: string;
  companyId: string;
  name: string;
  status: "active" | "paused" | "revoked";
  defaultAgentId: string | null;
  responsibleUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiAppCustomer = {
  id: string;
  apiAppId: string;
  companyId: string;
  externalRef: string | null;
  name: string;
  email: string | null;
  status: "active" | "paused" | "revoked";
  planId: string;
  defaultAgentId: string | null;
  allowedModelsOverride: string[] | null;
  unitSpendCapCents: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiAppCustomerKey = {
  id: string;
  name: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type ApiAppCustomerKeyCreated = ApiAppCustomerKey & { token: string };

export type BillingUnitDef = {
  id: string;
  apiAppId: string;
  companyId: string;
  unitKey: string;
  displayName: string;
  description: string | null;
  aggregation: "per_unit" | "per_pack";
  packSize: number;
  defaultPriceCents: number;
  isActive: boolean;
};

export type CustomerUnitPrice = {
  billingUnitDefId: string;
  unitKey: string;
  displayName: string;
  packSize: number;
  aggregation: "per_unit" | "per_pack";
  priceCents: number;
  enabled: boolean;
  monthlyUnitCap: number | null;
  isOverride: boolean;
  isActive: boolean;
};

export type CustomerUsage = {
  windowStart: string;
  tokensUsed: number;
  tokenLimit: number;
  costCentsUsed: number;
  costCentsLimit: number;
  planSlug: string;
  planId: string;
  unitSpendCentsUsed: number;
  unitSpendCapCents: number | null;
  units: Array<{
    unitKey: string;
    displayName: string;
    quantity: number;
    billablePacks: number;
    costCents: number;
    priceCents: number;
  }>;
  warnToken: boolean;
  warnCost: boolean;
  llmBlocked: boolean;
  unitBlocked: boolean;
  blocked: boolean;
};

export const apiAppsApi = {
  listPlans: () => api.get<PricingPlan[]>("/pricing-plans"),
  listApps: (companyId: string) => api.get<ApiApp[]>(`/companies/${companyId}/api-apps`),
  createApp: (companyId: string, data: { name: string; defaultAgentId?: string | null }) =>
    api.post<ApiApp>(`/companies/${companyId}/api-apps`, data),
  getApp: (id: string) => api.get<ApiApp>(`/api-apps/${id}`),
  updateApp: (id: string, data: Partial<{ name: string; status: ApiApp["status"]; defaultAgentId: string | null }>) =>
    api.patch<ApiApp>(`/api-apps/${id}`, data),
  usageSummary: (id: string) =>
    api.get<{ customerCount: number; blockedCount: number; nearingLimitCount: number }>(
      `/api-apps/${id}/usage-summary`,
    ),
  listCustomers: (apiAppId: string) => api.get<ApiAppCustomer[]>(`/api-apps/${apiAppId}/customers`),
  createCustomer: (
    apiAppId: string,
    data: {
      name: string;
      planId: string;
      externalRef?: string | null;
      email?: string | null;
      defaultAgentId?: string | null;
      unitSpendCapCents?: number | null;
    },
  ) => api.post<ApiAppCustomer>(`/api-apps/${apiAppId}/customers`, data),
  getCustomer: (id: string) => api.get<ApiAppCustomer>(`/api-app-customers/${id}`),
  updateCustomer: (
    id: string,
    data: Partial<{
      name: string;
      status: ApiAppCustomer["status"];
      planId: string;
      externalRef: string | null;
      email: string | null;
      defaultAgentId: string | null;
      unitSpendCapCents: number | null;
      allowedModelsOverride: string[] | null;
    }>,
  ) => api.patch<ApiAppCustomer>(`/api-app-customers/${id}`, data),
  usage: (id: string) => api.get<CustomerUsage>(`/api-app-customers/${id}/usage`),
  listKeys: (id: string) => api.get<ApiAppCustomerKey[]>(`/api-app-customers/${id}/keys`),
  createKey: (id: string, data: { name: string; expiresAt?: string | null }) =>
    api.post<ApiAppCustomerKeyCreated>(`/api-app-customers/${id}/keys`, data),
  revokeKey: (id: string, keyId: string) =>
    api.delete<{ ok: boolean }>(`/api-app-customers/${id}/keys/${keyId}`),
  listBillingUnits: (apiAppId: string) =>
    api.get<BillingUnitDef[]>(`/api-apps/${apiAppId}/billing-units`),
  createBillingUnit: (
    apiAppId: string,
    data: {
      unitKey: string;
      displayName: string;
      description?: string | null;
      aggregation: "per_unit" | "per_pack";
      packSize: number;
      defaultPriceCents: number;
    },
  ) => api.post<BillingUnitDef>(`/api-apps/${apiAppId}/billing-units`, data),
  updateBillingUnit: (
    id: string,
    data: Partial<{
      displayName: string;
      description: string | null;
      aggregation: "per_unit" | "per_pack";
      packSize: number;
      defaultPriceCents: number;
      isActive: boolean;
    }>,
  ) => api.patch<BillingUnitDef>(`/billing-units/${id}`, data),
  getUnitPrices: (customerId: string) =>
    api.get<CustomerUnitPrice[]>(`/api-app-customers/${customerId}/unit-prices`),
  putUnitPrices: (
    customerId: string,
    prices: Array<{
      billingUnitDefId: string;
      priceCents: number;
      enabled: boolean;
      monthlyUnitCap?: number | null;
    }>,
  ) =>
    api.put<CustomerUnitPrice[]>(`/api-app-customers/${customerId}/unit-prices`, { prices }),
  meterEvents: (customerId: string) =>
    api.get<Array<Record<string, unknown>>>(`/api-app-customers/${customerId}/meter-events`),
};
