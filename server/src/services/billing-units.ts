import { and, asc, desc, eq, gte, sql, sum } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  apiAppCustomerUnitPrices,
  apiAppCustomers,
  apiApps,
  billingUnitDefs,
  billingUnitMeterEvents,
} from "@paperclipai/db";
import { conflict, notFound, unprocessable } from "../errors.js";

export type MeterSource = "partner_api" | "auto";

export function utcMonthStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function billablePacksForQuantity(quantity: number, packSize: number): number {
  const size = Math.max(1, packSize);
  return Math.ceil(quantity / size);
}

export function billingUnitService(db: Db) {
  async function resolveUnitPrice(customerId: string, unitDefId: string, defaultPriceCents: number) {
    const override = await db
      .select()
      .from(apiAppCustomerUnitPrices)
      .where(
        and(
          eq(apiAppCustomerUnitPrices.apiAppCustomerId, customerId),
          eq(apiAppCustomerUnitPrices.billingUnitDefId, unitDefId),
        ),
      )
      .then((rows) => rows[0] ?? null);
    if (!override) {
      return { priceCents: defaultPriceCents, enabled: true, monthlyUnitCap: null as number | null };
    }
    return {
      priceCents: override.priceCents,
      enabled: override.enabled,
      monthlyUnitCap: override.monthlyUnitCap,
    };
  }

  async function monthUnitQuantity(customerId: string, unitDefId: string, windowStart: Date) {
    const row = await db
      .select({
        total: sum(billingUnitMeterEvents.quantity),
      })
      .from(billingUnitMeterEvents)
      .where(
        and(
          eq(billingUnitMeterEvents.apiAppCustomerId, customerId),
          eq(billingUnitMeterEvents.billingUnitDefId, unitDefId),
          gte(billingUnitMeterEvents.occurredAt, windowStart),
        ),
      )
      .then((rows) => rows[0]);
    return Number(row?.total ?? 0);
  }

  async function monthUnitSpendCents(customerId: string, windowStart: Date) {
    const row = await db
      .select({
        total: sum(billingUnitMeterEvents.costCents),
      })
      .from(billingUnitMeterEvents)
      .where(
        and(
          eq(billingUnitMeterEvents.apiAppCustomerId, customerId),
          gte(billingUnitMeterEvents.occurredAt, windowStart),
        ),
      )
      .then((rows) => rows[0]);
    return Number(row?.total ?? 0);
  }

  return {
    monthUnitSpendCents,
    monthUnitQuantity,
    resolveUnitPrice,

    recordUnitMeter: async (input: {
      customerId: string;
      unitKey: string;
      quantity: number;
      source: MeterSource;
      idempotencyKey: string;
      metadata?: Record<string, unknown> | null;
      occurredAt?: Date;
    }) => {
      const idempotencyKey = input.idempotencyKey.trim();
      if (!idempotencyKey) {
        throw unprocessable("Idempotency key is required");
      }

      const existing = await db
        .select()
        .from(billingUnitMeterEvents)
        .where(
          and(
            eq(billingUnitMeterEvents.apiAppCustomerId, input.customerId),
            eq(billingUnitMeterEvents.idempotencyKey, idempotencyKey),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (existing) {
        return { event: existing, created: false };
      }

      const customer = await db
        .select()
        .from(apiAppCustomers)
        .where(eq(apiAppCustomers.id, input.customerId))
        .then((rows) => rows[0] ?? null);
      if (!customer) throw notFound("API app customer not found");

      const app = await db
        .select()
        .from(apiApps)
        .where(eq(apiApps.id, customer.apiAppId))
        .then((rows) => rows[0] ?? null);
      if (!app) throw notFound("API app not found");
      if (app.status !== "active") {
        throw conflict("API app is inactive", { code: "API_APP_INACTIVE" });
      }
      if (customer.status !== "active") {
        throw conflict("API app customer is inactive", { code: "API_CUSTOMER_INACTIVE" });
      }

      const unitDef = await db
        .select()
        .from(billingUnitDefs)
        .where(
          and(
            eq(billingUnitDefs.apiAppId, customer.apiAppId),
            eq(billingUnitDefs.unitKey, input.unitKey),
            eq(billingUnitDefs.isActive, true),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (!unitDef) {
        throw unprocessable("Unknown or inactive billing unit", {
          code: "API_CUSTOMER_UNIT_UNKNOWN",
        });
      }

      const price = await resolveUnitPrice(customer.id, unitDef.id, unitDef.defaultPriceCents);
      if (!price.enabled) {
        throw unprocessable("Billing unit disabled for this customer", {
          code: "API_CUSTOMER_UNIT_DISABLED",
        });
      }

      const windowStart = utcMonthStart(input.occurredAt ?? new Date());
      const usedQty = await monthUnitQuantity(customer.id, unitDef.id, windowStart);
      if (price.monthlyUnitCap != null && usedQty + input.quantity > price.monthlyUnitCap) {
        throw conflict("Monthly unit quantity cap exceeded", {
          code: "API_CUSTOMER_UNIT_CAP_EXCEEDED",
        });
      }

      const packs = billablePacksForQuantity(input.quantity, unitDef.packSize);
      const costCents = packs * price.priceCents;
      const usedSpend = await monthUnitSpendCents(customer.id, windowStart);
      if (
        customer.unitSpendCapCents != null &&
        usedSpend + costCents > customer.unitSpendCapCents
      ) {
        throw conflict("Monthly unit spend cap exceeded", {
          code: "API_CUSTOMER_UNIT_SPEND_EXCEEDED",
        });
      }

      try {
        const [created] = await db
          .insert(billingUnitMeterEvents)
          .values({
            companyId: customer.companyId,
            apiAppId: customer.apiAppId,
            apiAppCustomerId: customer.id,
            billingUnitDefId: unitDef.id,
            unitKey: unitDef.unitKey,
            quantity: input.quantity,
            packSize: unitDef.packSize,
            priceCents: price.priceCents,
            billablePacks: packs,
            costCents,
            source: input.source,
            idempotencyKey,
            occurredAt: input.occurredAt ?? new Date(),
            metadata: input.metadata ?? null,
          })
          .returning();
        return { event: created!, created: true };
      } catch (err) {
        const again = await db
          .select()
          .from(billingUnitMeterEvents)
          .where(
            and(
              eq(billingUnitMeterEvents.apiAppCustomerId, input.customerId),
              eq(billingUnitMeterEvents.idempotencyKey, idempotencyKey),
            ),
          )
          .then((rows) => rows[0] ?? null);
        if (again) return { event: again, created: false };
        throw err;
      }
    },

    listUnitDefs: async (apiAppId: string) => {
      return db
        .select()
        .from(billingUnitDefs)
        .where(eq(billingUnitDefs.apiAppId, apiAppId))
        .orderBy(asc(billingUnitDefs.unitKey));
    },

    createUnitDef: async (
      apiAppId: string,
      companyId: string,
      input: {
        unitKey: string;
        displayName: string;
        description?: string | null;
        aggregation: "per_unit" | "per_pack";
        packSize: number;
        defaultPriceCents: number;
      },
    ) => {
      const [created] = await db
        .insert(billingUnitDefs)
        .values({
          apiAppId,
          companyId,
          unitKey: input.unitKey,
          displayName: input.displayName,
          description: input.description ?? null,
          aggregation: input.aggregation,
          packSize: input.packSize,
          defaultPriceCents: input.defaultPriceCents,
        })
        .returning();
      return created!;
    },

    updateUnitDef: async (
      id: string,
      patch: Partial<{
        displayName: string;
        description: string | null;
        aggregation: "per_unit" | "per_pack";
        packSize: number;
        defaultPriceCents: number;
        isActive: boolean;
      }>,
    ) => {
      const [updated] = await db
        .update(billingUnitDefs)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(billingUnitDefs.id, id))
        .returning();
      if (!updated) throw notFound("Billing unit not found");
      return updated;
    },

    getCustomerUnitPrices: async (customerId: string) => {
      const customer = await db
        .select()
        .from(apiAppCustomers)
        .where(eq(apiAppCustomers.id, customerId))
        .then((rows) => rows[0] ?? null);
      if (!customer) throw notFound("API app customer not found");

      const defs = await db
        .select()
        .from(billingUnitDefs)
        .where(eq(billingUnitDefs.apiAppId, customer.apiAppId));
      const overrides = await db
        .select()
        .from(apiAppCustomerUnitPrices)
        .where(eq(apiAppCustomerUnitPrices.apiAppCustomerId, customerId));
      const byDef = new Map(overrides.map((o) => [o.billingUnitDefId, o]));

      return defs.map((def) => {
        const override = byDef.get(def.id);
        return {
          billingUnitDefId: def.id,
          unitKey: def.unitKey,
          displayName: def.displayName,
          packSize: def.packSize,
          aggregation: def.aggregation,
          priceCents: override?.priceCents ?? def.defaultPriceCents,
          enabled: override?.enabled ?? true,
          monthlyUnitCap: override?.monthlyUnitCap ?? null,
          isOverride: Boolean(override),
          isActive: def.isActive,
        };
      });
    },

    putCustomerUnitPrices: async (
      customerId: string,
      prices: Array<{
        billingUnitDefId: string;
        priceCents: number;
        enabled: boolean;
        monthlyUnitCap?: number | null;
      }>,
    ) => {
      const customer = await db
        .select()
        .from(apiAppCustomers)
        .where(eq(apiAppCustomers.id, customerId))
        .then((rows) => rows[0] ?? null);
      if (!customer) throw notFound("API app customer not found");

      for (const row of prices) {
        const def = await db
          .select()
          .from(billingUnitDefs)
          .where(
            and(
              eq(billingUnitDefs.id, row.billingUnitDefId),
              eq(billingUnitDefs.apiAppId, customer.apiAppId),
            ),
          )
          .then((rows) => rows[0] ?? null);
        if (!def) throw unprocessable("Billing unit does not belong to this app");

        const existing = await db
          .select()
          .from(apiAppCustomerUnitPrices)
          .where(
            and(
              eq(apiAppCustomerUnitPrices.apiAppCustomerId, customerId),
              eq(apiAppCustomerUnitPrices.billingUnitDefId, row.billingUnitDefId),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (existing) {
          await db
            .update(apiAppCustomerUnitPrices)
            .set({
              priceCents: row.priceCents,
              enabled: row.enabled,
              monthlyUnitCap: row.monthlyUnitCap ?? null,
              updatedAt: new Date(),
            })
            .where(eq(apiAppCustomerUnitPrices.id, existing.id));
        } else {
          await db.insert(apiAppCustomerUnitPrices).values({
            apiAppCustomerId: customerId,
            billingUnitDefId: row.billingUnitDefId,
            priceCents: row.priceCents,
            enabled: row.enabled,
            monthlyUnitCap: row.monthlyUnitCap ?? null,
          });
        }
      }

      return billingUnitService(db).getCustomerUnitPrices(customerId);
    },

    listRecentMeterEvents: async (customerId: string, limit = 20) => {
      return db
        .select()
        .from(billingUnitMeterEvents)
        .where(eq(billingUnitMeterEvents.apiAppCustomerId, customerId))
        .orderBy(desc(billingUnitMeterEvents.occurredAt))
        .limit(limit);
    },
  };
}
