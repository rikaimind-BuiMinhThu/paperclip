import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  apiAppCustomerKeys,
  apiAppCustomers,
  apiApps,
  costEvents,
  pricingPlans,
} from "@paperclipai/db";
import { badRequest, conflict, notFound, paymentRequired, unprocessable } from "../errors.js";
import { billingUnitService, utcMonthStart } from "./billing-units.js";

const DEFAULT_PLANS = [
  {
    slug: "free",
    displayName: "Free",
    monthlyTokenLimit: 500_000,
    monthlyCostCentsLimit: 500,
    costMultiplierBps: 10000,
    allowedModels: ["claude-haiku-4-5", "gpt-4o-mini"],
    rpmLimit: 30,
  },
  {
    slug: "starter",
    displayName: "Starter",
    monthlyTokenLimit: 5_000_000,
    monthlyCostCentsLimit: 5000,
    costMultiplierBps: 10000,
    allowedModels: ["claude-haiku-4-5", "claude-sonnet-4-5", "gpt-4o-mini", "gpt-4o"],
    rpmLimit: 120,
  },
  {
    slug: "pro",
    displayName: "Pro",
    monthlyTokenLimit: 50_000_000,
    monthlyCostCentsLimit: 50000,
    costMultiplierBps: 10000,
    allowedModels: [
      "claude-haiku-4-5",
      "claude-sonnet-4-5",
      "claude-opus-4-5",
      "gpt-4o-mini",
      "gpt-4o",
      "gpt-5",
    ],
    rpmLimit: 600,
  },
] as const;

export function hashCustomerToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createCustomerApiToken() {
  return `pcp_cust_${randomBytes(24).toString("hex")}`;
}

export function planCostCents(providerCostCents: number, costMultiplierBps: number) {
  return Math.ceil((providerCostCents * costMultiplierBps) / 10000);
}

export type ApiCustomerInvocationBlock = {
  code:
    | "API_CUSTOMER_INACTIVE"
    | "API_APP_INACTIVE"
    | "API_CUSTOMER_PLAN_TOKEN_EXCEEDED"
    | "API_CUSTOMER_PLAN_COST_EXCEEDED"
    | "API_CUSTOMER_UNIT_SPEND_EXCEEDED"
    | "API_CUSTOMER_UNIT_CAP_EXCEEDED"
    | "API_CUSTOMER_RPM_EXCEEDED"
    | "API_CUSTOMER_MODEL_NOT_ALLOWED";
  message: string;
  usage?: Record<string, unknown>;
};

export function apiAppsService(db: Db) {
  const units = billingUnitService(db);

  async function ensureDefaultPricingPlans() {
    for (const plan of DEFAULT_PLANS) {
      const existing = await db
        .select()
        .from(pricingPlans)
        .where(eq(pricingPlans.slug, plan.slug))
        .then((rows) => rows[0] ?? null);
      if (existing) continue;
      await db.insert(pricingPlans).values({
        slug: plan.slug,
        displayName: plan.displayName,
        monthlyTokenLimit: plan.monthlyTokenLimit,
        monthlyCostCentsLimit: plan.monthlyCostCentsLimit,
        costMultiplierBps: plan.costMultiplierBps,
        allowedModels: [...plan.allowedModels],
        rpmLimit: plan.rpmLimit,
        isActive: true,
      });
    }
  }

  async function getApp(id: string) {
    return db
      .select()
      .from(apiApps)
      .where(eq(apiApps.id, id))
      .then((rows) => rows[0] ?? null);
  }

  async function getCustomer(id: string) {
    return db
      .select()
      .from(apiAppCustomers)
      .where(eq(apiAppCustomers.id, id))
      .then((rows) => rows[0] ?? null);
  }

  async function getPlan(id: string) {
    return db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.id, id))
      .then((rows) => rows[0] ?? null);
  }

  async function llmMonthUsage(customerId: string, companyId: string, multiplierBps: number) {
    const windowStart = utcMonthStart();
    const rows = await db
      .select({
        tokens:
          sql<number>`coalesce(sum(${costEvents.inputTokens} + ${costEvents.cachedInputTokens} + ${costEvents.outputTokens}), 0)`,
        costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)`,
      })
      .from(costEvents)
      .where(
        and(
          eq(costEvents.companyId, companyId),
          eq(costEvents.apiAppCustomerId, customerId),
          gte(costEvents.occurredAt, windowStart),
        ),
      );
    const tokensUsed = Number(rows[0]?.tokens ?? 0);
    const providerCost = Number(rows[0]?.costCents ?? 0);
    return {
      windowStart,
      tokensUsed,
      costCentsUsed: planCostCents(providerCost, multiplierBps),
      providerCostCents: providerCost,
    };
  }

  return {
    ensureDefaultPricingPlans,

    listPricingPlans: async () => {
      await ensureDefaultPricingPlans();
      return db
        .select()
        .from(pricingPlans)
        .where(eq(pricingPlans.isActive, true))
        .orderBy(pricingPlans.monthlyCostCentsLimit);
    },

    listApps: async (companyId: string) => {
      return db
        .select()
        .from(apiApps)
        .where(eq(apiApps.companyId, companyId))
        .orderBy(desc(apiApps.updatedAt));
    },

    getApp,

    createApp: async (input: {
      companyId: string;
      name: string;
      defaultAgentId?: string | null;
      responsibleUserId: string;
      createdByUserId?: string | null;
    }) => {
      const [created] = await db
        .insert(apiApps)
        .values({
          companyId: input.companyId,
          name: input.name.trim(),
          defaultAgentId: input.defaultAgentId ?? null,
          responsibleUserId: input.responsibleUserId,
          createdByUserId: input.createdByUserId ?? input.responsibleUserId,
        })
        .returning();
      return created!;
    },

    updateApp: async (
      id: string,
      patch: Partial<{
        name: string;
        status: "active" | "paused" | "revoked";
        defaultAgentId: string | null;
      }>,
    ) => {
      const [updated] = await db
        .update(apiApps)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(apiApps.id, id))
        .returning();
      if (!updated) throw notFound("API app not found");
      return updated;
    },

    listCustomers: async (apiAppId: string) => {
      return db
        .select()
        .from(apiAppCustomers)
        .where(eq(apiAppCustomers.apiAppId, apiAppId))
        .orderBy(desc(apiAppCustomers.updatedAt));
    },

    getCustomer,

    createCustomer: async (input: {
      apiAppId: string;
      companyId: string;
      name: string;
      planId: string;
      externalRef?: string | null;
      email?: string | null;
      defaultAgentId?: string | null;
      unitSpendCapCents?: number | null;
      allowedModelsOverride?: string[] | null;
      createdByUserId?: string | null;
    }) => {
      const app = await getApp(input.apiAppId);
      if (!app || app.companyId !== input.companyId) throw notFound("API app not found");
      const plan = await getPlan(input.planId);
      if (!plan || !plan.isActive) throw unprocessable("Invalid pricing plan");

      if (input.allowedModelsOverride) {
        const allowed = new Set(plan.allowedModels ?? []);
        for (const model of input.allowedModelsOverride) {
          if (!allowed.has(model)) {
            throw unprocessable(`Model ${model} is not in plan allowlist`);
          }
        }
      }

      const [created] = await db
        .insert(apiAppCustomers)
        .values({
          apiAppId: input.apiAppId,
          companyId: input.companyId,
          name: input.name.trim(),
          planId: input.planId,
          externalRef: input.externalRef?.trim() || null,
          email: input.email?.trim() || null,
          defaultAgentId: input.defaultAgentId ?? null,
          unitSpendCapCents: input.unitSpendCapCents ?? null,
          allowedModelsOverride: input.allowedModelsOverride ?? null,
          createdByUserId: input.createdByUserId ?? null,
        })
        .returning();
      return created!;
    },

    updateCustomer: async (
      id: string,
      patch: Partial<{
        name: string;
        externalRef: string | null;
        email: string | null;
        status: "active" | "paused" | "revoked";
        planId: string;
        defaultAgentId: string | null;
        unitSpendCapCents: number | null;
        allowedModelsOverride: string[] | null;
      }>,
    ) => {
      if (patch.planId) {
        const plan = await getPlan(patch.planId);
        if (!plan || !plan.isActive) throw unprocessable("Invalid pricing plan");
        if (patch.allowedModelsOverride) {
          const allowed = new Set(plan.allowedModels ?? []);
          for (const model of patch.allowedModelsOverride) {
            if (!allowed.has(model)) {
              throw unprocessable(`Model ${model} is not in plan allowlist`);
            }
          }
        }
      } else if (patch.allowedModelsOverride) {
        const customer = await getCustomer(id);
        if (!customer) throw notFound("API app customer not found");
        const plan = await getPlan(customer.planId);
        const allowed = new Set(plan?.allowedModels ?? []);
        for (const model of patch.allowedModelsOverride) {
          if (!allowed.has(model)) {
            throw unprocessable(`Model ${model} is not in plan allowlist`);
          }
        }
      }

      const [updated] = await db
        .update(apiAppCustomers)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(apiAppCustomers.id, id))
        .returning();
      if (!updated) throw notFound("API app customer not found");
      return updated;
    },

    listKeys: async (customerId: string) => {
      return db
        .select({
          id: apiAppCustomerKeys.id,
          name: apiAppCustomerKeys.name,
          lastUsedAt: apiAppCustomerKeys.lastUsedAt,
          revokedAt: apiAppCustomerKeys.revokedAt,
          expiresAt: apiAppCustomerKeys.expiresAt,
          createdAt: apiAppCustomerKeys.createdAt,
        })
        .from(apiAppCustomerKeys)
        .where(eq(apiAppCustomerKeys.apiAppCustomerId, customerId))
        .orderBy(desc(apiAppCustomerKeys.createdAt));
    },

    createKey: async (input: {
      customerId: string;
      name: string;
      expiresAt?: Date | null;
    }) => {
      const customer = await getCustomer(input.customerId);
      if (!customer) throw notFound("API app customer not found");
      if (customer.status === "revoked") {
        throw conflict("Cannot create keys for revoked customers");
      }
      const token = createCustomerApiToken();
      const [created] = await db
        .insert(apiAppCustomerKeys)
        .values({
          apiAppCustomerId: customer.id,
          apiAppId: customer.apiAppId,
          companyId: customer.companyId,
          name: input.name.trim() || "default",
          keyHash: hashCustomerToken(token),
          expiresAt: input.expiresAt ?? null,
        })
        .returning();
      return {
        id: created!.id,
        name: created!.name,
        token,
        expiresAt: created!.expiresAt,
        createdAt: created!.createdAt,
      };
    },

    revokeKey: async (customerId: string, keyId: string) => {
      const [updated] = await db
        .update(apiAppCustomerKeys)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(apiAppCustomerKeys.id, keyId),
            eq(apiAppCustomerKeys.apiAppCustomerId, customerId),
            isNull(apiAppCustomerKeys.revokedAt),
          ),
        )
        .returning();
      if (!updated) throw notFound("API key not found");
      return updated;
    },

    findCustomerKeyByToken: async (token: string) => {
      if (!token.startsWith("pcp_cust_")) return null;
      const key = await db
        .select()
        .from(apiAppCustomerKeys)
        .where(
          and(eq(apiAppCustomerKeys.keyHash, hashCustomerToken(token)), isNull(apiAppCustomerKeys.revokedAt)),
        )
        .then((rows) => rows[0] ?? null);
      if (!key) return null;
      if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) return null;

      const customer = await getCustomer(key.apiAppCustomerId);
      if (!customer) return null;
      const app = await getApp(customer.apiAppId);
      if (!app) return null;

      return { key, customer, app };
    },

    touchKeyLastUsed: async (keyId: string) => {
      await db
        .update(apiAppCustomerKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiAppCustomerKeys.id, keyId));
    },

    getCustomerMonthUsage: async (customerId: string) => {
      const customer = await getCustomer(customerId);
      if (!customer) throw notFound("API app customer not found");
      const plan = await getPlan(customer.planId);
      if (!plan) throw notFound("Pricing plan not found");

      const llm = await llmMonthUsage(customer.id, customer.companyId, plan.costMultiplierBps);
      const unitSpendCentsUsed = await units.monthUnitSpendCents(customer.id, llm.windowStart);
      const unitPrices = await units.getCustomerUnitPrices(customer.id);
      const unitBreakdown = [];
      for (const price of unitPrices) {
        const quantity = await units.monthUnitQuantity(customer.id, price.billingUnitDefId, llm.windowStart);
        if (quantity === 0 && !price.isOverride) continue;
        unitBreakdown.push({
          unitKey: price.unitKey,
          displayName: price.displayName,
          quantity,
          billablePacks: billablePacksProxy(quantity, price.packSize),
          costCents: billablePacksProxy(quantity, price.packSize) * price.priceCents,
          priceCents: price.priceCents,
        });
      }

      const llmBlocked =
        llm.tokensUsed >= plan.monthlyTokenLimit || llm.costCentsUsed >= plan.monthlyCostCentsLimit;
      const unitBlocked =
        customer.unitSpendCapCents != null && unitSpendCentsUsed >= customer.unitSpendCapCents;

      return {
        windowStart: llm.windowStart.toISOString(),
        tokensUsed: llm.tokensUsed,
        tokenLimit: plan.monthlyTokenLimit,
        costCentsUsed: llm.costCentsUsed,
        costCentsLimit: plan.monthlyCostCentsLimit,
        planSlug: plan.slug,
        planId: plan.id,
        unitSpendCentsUsed,
        unitSpendCapCents: customer.unitSpendCapCents,
        units: unitBreakdown,
        warnToken: llm.tokensUsed >= plan.monthlyTokenLimit * 0.8,
        warnCost: llm.costCentsUsed >= plan.monthlyCostCentsLimit * 0.8,
        llmBlocked,
        unitBlocked,
        blocked:
          llmBlocked ||
          unitBlocked ||
          customer.status !== "active",
      };
    },

    getApiCustomerInvocationBlock: async (
      companyId: string,
      customerId: string,
      options?: { model?: string | null },
    ): Promise<ApiCustomerInvocationBlock | null> => {
      const customer = await getCustomer(customerId);
      if (!customer || customer.companyId !== companyId) {
        return { code: "API_CUSTOMER_INACTIVE", message: "API app customer not found" };
      }
      const app = await getApp(customer.apiAppId);
      if (!app || app.status !== "active") {
        return { code: "API_APP_INACTIVE", message: "API app is inactive" };
      }
      if (customer.status !== "active") {
        return { code: "API_CUSTOMER_INACTIVE", message: "API app customer is inactive" };
      }

      const plan = await getPlan(customer.planId);
      if (!plan) {
        return { code: "API_CUSTOMER_INACTIVE", message: "Pricing plan missing" };
      }

      const effectiveModels = customer.allowedModelsOverride ?? plan.allowedModels ?? [];
      if (options?.model && effectiveModels.length > 0 && !effectiveModels.includes(options.model)) {
        return {
          code: "API_CUSTOMER_MODEL_NOT_ALLOWED",
          message: `Model ${options.model} is not allowed for this customer plan`,
        };
      }

      const usage = await llmMonthUsage(customer.id, companyId, plan.costMultiplierBps);
      if (usage.tokensUsed >= plan.monthlyTokenLimit) {
        return {
          code: "API_CUSTOMER_PLAN_TOKEN_EXCEEDED",
          message: "Monthly token plan limit exceeded",
          usage: { ...usage, tokenLimit: plan.monthlyTokenLimit },
        };
      }
      if (usage.costCentsUsed >= plan.monthlyCostCentsLimit) {
        return {
          code: "API_CUSTOMER_PLAN_COST_EXCEEDED",
          message: "Monthly cost plan limit exceeded",
          usage: { ...usage, costCentsLimit: plan.monthlyCostCentsLimit },
        };
      }

      const unitSpend = await units.monthUnitSpendCents(customer.id, usage.windowStart);
      if (customer.unitSpendCapCents != null && unitSpend >= customer.unitSpendCapCents) {
        return {
          code: "API_CUSTOMER_UNIT_SPEND_EXCEEDED",
          message: "Monthly unit spend cap exceeded",
          usage: { unitSpendCentsUsed: unitSpend, unitSpendCapCents: customer.unitSpendCapCents },
        };
      }

      return null;
    },

    assertCustomerNotBlocked: async (companyId: string, customerId: string, options?: { model?: string | null }) => {
      const block = await apiAppsService(db).getApiCustomerInvocationBlock(companyId, customerId, options);
      if (!block) return;
      if (
        block.code === "API_CUSTOMER_PLAN_TOKEN_EXCEEDED" ||
        block.code === "API_CUSTOMER_PLAN_COST_EXCEEDED" ||
        block.code === "API_CUSTOMER_UNIT_SPEND_EXCEEDED" ||
        block.code === "API_CUSTOMER_UNIT_CAP_EXCEEDED"
      ) {
        throw paymentRequired(block.message, { code: block.code, usage: block.usage });
      }
      if (block.code === "API_CUSTOMER_MODEL_NOT_ALLOWED") {
        throw unprocessable(block.message, { code: block.code });
      }
      if (block.code === "API_CUSTOMER_RPM_EXCEEDED") {
        throw badRequest(block.message, { code: block.code });
      }
      throw conflict(block.message, { code: block.code });
    },

    effectiveModelsForCustomer: async (customerId: string) => {
      const customer = await getCustomer(customerId);
      if (!customer) throw notFound("API app customer not found");
      const plan = await getPlan(customer.planId);
      return customer.allowedModelsOverride ?? plan?.allowedModels ?? [];
    },

    getAppUsageSummary: async (apiAppId: string) => {
      const customers = await db
        .select()
        .from(apiAppCustomers)
        .where(eq(apiAppCustomers.apiAppId, apiAppId));
      let blocked = 0;
      let nearing = 0;
      for (const customer of customers) {
        try {
          const usage = await apiAppsService(db).getCustomerMonthUsage(customer.id);
          if (usage.blocked) blocked += 1;
          else if (usage.warnToken || usage.warnCost) nearing += 1;
        } catch {
          // ignore
        }
      }
      return {
        customerCount: customers.length,
        blockedCount: blocked,
        nearingLimitCount: nearing,
      };
    },

    units,
  };
}

function billablePacksProxy(quantity: number, packSize: number) {
  return Math.ceil(quantity / Math.max(1, packSize));
}
