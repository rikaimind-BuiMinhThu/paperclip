import { z } from "zod";

export const apiAppStatusSchema = z.enum(["active", "paused", "revoked"]);
export type ApiAppStatus = z.infer<typeof apiAppStatusSchema>;

export const billingUnitAggregationSchema = z.enum(["per_unit", "per_pack"]);
export type BillingUnitAggregation = z.infer<typeof billingUnitAggregationSchema>;

export const createApiAppSchema = z.object({
  name: z.string().trim().min(1).max(120),
  defaultAgentId: z.string().uuid().nullable().optional(),
});
export type CreateApiApp = z.infer<typeof createApiAppSchema>;

export const updateApiAppSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  status: apiAppStatusSchema.optional(),
  defaultAgentId: z.string().uuid().nullable().optional(),
});
export type UpdateApiApp = z.infer<typeof updateApiAppSchema>;

export const createApiAppCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  externalRef: z.string().trim().min(1).max(200).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  planId: z.string().uuid(),
  defaultAgentId: z.string().uuid().nullable().optional(),
  unitSpendCapCents: z.number().int().min(0).nullable().optional(),
  allowedModelsOverride: z.array(z.string().trim().min(1)).nullable().optional(),
});
export type CreateApiAppCustomer = z.infer<typeof createApiAppCustomerSchema>;

export const updateApiAppCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  externalRef: z.string().trim().min(1).max(200).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  status: apiAppStatusSchema.optional(),
  planId: z.string().uuid().optional(),
  defaultAgentId: z.string().uuid().nullable().optional(),
  unitSpendCapCents: z.number().int().min(0).nullable().optional(),
  allowedModelsOverride: z.array(z.string().trim().min(1)).nullable().optional(),
});
export type UpdateApiAppCustomer = z.infer<typeof updateApiAppCustomerSchema>;

export const createApiAppCustomerKeySchema = z.object({
  name: z.string().trim().min(1).max(120).default("default"),
  expiresAt: z.coerce.date().nullable().optional(),
});
export type CreateApiAppCustomerKey = z.infer<typeof createApiAppCustomerKeySchema>;

export const createBillingUnitDefSchema = z.object({
  unitKey: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/, "unitKey must be snake_case"),
  displayName: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  aggregation: billingUnitAggregationSchema.default("per_unit"),
  packSize: z.number().int().min(1).default(1),
  defaultPriceCents: z.number().int().min(0).default(0),
});
export type CreateBillingUnitDef = z.infer<typeof createBillingUnitDefSchema>;

export const updateBillingUnitDefSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  aggregation: billingUnitAggregationSchema.optional(),
  packSize: z.number().int().min(1).optional(),
  defaultPriceCents: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateBillingUnitDef = z.infer<typeof updateBillingUnitDefSchema>;

export const customerUnitPriceRowSchema = z.object({
  billingUnitDefId: z.string().uuid(),
  priceCents: z.number().int().min(0),
  enabled: z.boolean().default(true),
  monthlyUnitCap: z.number().int().min(0).nullable().optional(),
});
export type CustomerUnitPriceRow = z.infer<typeof customerUnitPriceRowSchema>;

export const putCustomerUnitPricesSchema = z.object({
  prices: z.array(customerUnitPriceRowSchema).min(1),
});
export type PutCustomerUnitPrices = z.infer<typeof putCustomerUnitPricesSchema>;

export const recordBillingUnitMeterSchema = z.object({
  unitKey: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1),
  occurredAt: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type RecordBillingUnitMeter = z.infer<typeof recordBillingUnitMeterSchema>;
