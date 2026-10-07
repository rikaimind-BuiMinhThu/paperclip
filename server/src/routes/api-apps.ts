import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createApiAppCustomerKeySchema,
  createApiAppCustomerSchema,
  createApiAppSchema,
  createBillingUnitDefSchema,
  putCustomerUnitPricesSchema,
  recordBillingUnitMeterSchema,
  updateApiAppCustomerSchema,
  updateApiAppSchema,
  updateBillingUnitDefSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { badRequest, forbidden, notFound } from "../errors.js";
import { apiAppsService } from "../services/api-apps.js";
import { logActivity } from "../services/activity-log.js";
import {
  assertBoard,
  assertCompanyAccess,
} from "./authz.js";

function requireBoardUserId(req: import("express").Request): string {
  assertBoard(req);
  if (!req.actor.userId) {
    throw forbidden("Board user context required");
  }
  return req.actor.userId;
}

function assertApiCustomer(req: import("express").Request) {
  if (req.actor.type !== "api_customer") {
    throw forbidden("API customer access required");
  }
}

export function apiAppRoutes(db: Db) {
  const router = Router();
  const svc = apiAppsService(db);

  router.get("/pricing-plans", async (req, res) => {
    assertBoard(req);
    const plans = await svc.listPricingPlans();
    res.json(plans);
  });

  router.get("/companies/:companyId/api-apps", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertBoard(req);
    assertCompanyAccess(req, companyId);
    const apps = await svc.listApps(companyId);
    res.json(apps);
  });

  router.post(
    "/companies/:companyId/api-apps",
    validate(createApiAppSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const userId = requireBoardUserId(req);
      assertCompanyAccess(req, companyId);
      const created = await svc.createApp({
        companyId,
        name: req.body.name,
        defaultAgentId: req.body.defaultAgentId,
        responsibleUserId: userId,
        createdByUserId: userId,
      });
      await logActivity(db, {
        companyId,
        actorType: "user",
        actorId: userId,
        action: "api_app.created",
        entityType: "api_app",
        entityId: created.id,
        details: { name: created.name },
      });
      res.status(201).json(created);
    },
  );

  router.get("/api-apps/:id", async (req, res) => {
    assertBoard(req);
    const app = await svc.getApp(req.params.id as string);
    if (!app) throw notFound("API app not found");
    assertCompanyAccess(req, app.companyId);
    res.json(app);
  });

  router.patch("/api-apps/:id", validate(updateApiAppSchema), async (req, res) => {
    const userId = requireBoardUserId(req);
    const existing = await svc.getApp(req.params.id as string);
    if (!existing) throw notFound("API app not found");
    assertCompanyAccess(req, existing.companyId);
    const updated = await svc.updateApp(existing.id, req.body);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: "user",
      actorId: userId,
      action: "api_app.updated",
      entityType: "api_app",
      entityId: updated.id,
      details: req.body,
    });
    res.json(updated);
  });

  router.get("/api-apps/:id/usage-summary", async (req, res) => {
    assertBoard(req);
    const app = await svc.getApp(req.params.id as string);
    if (!app) throw notFound("API app not found");
    assertCompanyAccess(req, app.companyId);
    res.json(await svc.getAppUsageSummary(app.id));
  });

  router.get("/api-apps/:apiAppId/customers", async (req, res) => {
    assertBoard(req);
    const app = await svc.getApp(req.params.apiAppId as string);
    if (!app) throw notFound("API app not found");
    assertCompanyAccess(req, app.companyId);
    res.json(await svc.listCustomers(app.id));
  });

  router.post(
    "/api-apps/:apiAppId/customers",
    validate(createApiAppCustomerSchema),
    async (req, res) => {
      const userId = requireBoardUserId(req);
      const app = await svc.getApp(req.params.apiAppId as string);
      if (!app) throw notFound("API app not found");
      assertCompanyAccess(req, app.companyId);
      const created = await svc.createCustomer({
        apiAppId: app.id,
        companyId: app.companyId,
        ...req.body,
        createdByUserId: userId,
      });
      await logActivity(db, {
        companyId: app.companyId,
        actorType: "user",
        actorId: userId,
        action: "api_app_customer.created",
        entityType: "api_app_customer",
        entityId: created.id,
        details: { name: created.name, planId: created.planId },
      });
      res.status(201).json(created);
    },
  );

  router.get("/api-app-customers/:id", async (req, res) => {
    assertBoard(req);
    const customer = await svc.getCustomer(req.params.id as string);
    if (!customer) throw notFound("API app customer not found");
    assertCompanyAccess(req, customer.companyId);
    res.json(customer);
  });

  router.patch(
    "/api-app-customers/:id",
    validate(updateApiAppCustomerSchema),
    async (req, res) => {
      const userId = requireBoardUserId(req);
      const existing = await svc.getCustomer(req.params.id as string);
      if (!existing) throw notFound("API app customer not found");
      assertCompanyAccess(req, existing.companyId);
      const updated = await svc.updateCustomer(existing.id, req.body);
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: "user",
        actorId: userId,
        action: "api_app_customer.updated",
        entityType: "api_app_customer",
        entityId: updated.id,
        details: req.body,
      });
      res.json(updated);
    },
  );

  router.get("/api-app-customers/:id/usage", async (req, res) => {
    const customer = await svc.getCustomer(req.params.id as string);
    if (!customer) throw notFound("API app customer not found");
    if (req.actor.type === "api_customer") {
      if (req.actor.apiAppCustomerId !== customer.id) {
        throw forbidden("Cannot read another customer's usage");
      }
      assertCompanyAccess(req, customer.companyId);
    } else {
      assertBoard(req);
      assertCompanyAccess(req, customer.companyId);
    }
    res.json(await svc.getCustomerMonthUsage(customer.id));
  });

  router.get("/api-app-customers/me/usage", async (req, res) => {
    assertApiCustomer(req);
    const customerId = req.actor.apiAppCustomerId!;
    assertCompanyAccess(req, req.actor.companyId!);
    res.json(await svc.getCustomerMonthUsage(customerId));
  });

  router.get("/api-app-customers/:id/keys", async (req, res) => {
    assertBoard(req);
    const customer = await svc.getCustomer(req.params.id as string);
    if (!customer) throw notFound("API app customer not found");
    assertCompanyAccess(req, customer.companyId);
    res.json(await svc.listKeys(customer.id));
  });

  router.post(
    "/api-app-customers/:id/keys",
    validate(createApiAppCustomerKeySchema),
    async (req, res) => {
      const userId = requireBoardUserId(req);
      const customer = await svc.getCustomer(req.params.id as string);
      if (!customer) throw notFound("API app customer not found");
      assertCompanyAccess(req, customer.companyId);
      const created = await svc.createKey({
        customerId: customer.id,
        name: req.body.name,
        expiresAt: req.body.expiresAt,
      });
      await logActivity(db, {
        companyId: customer.companyId,
        actorType: "user",
        actorId: userId,
        action: "api_app_customer_key.created",
        entityType: "api_app_customer_key",
        entityId: created.id,
        details: { name: created.name, customerId: customer.id },
      });
      res.status(201).json(created);
    },
  );

  router.delete("/api-app-customers/:id/keys/:keyId", async (req, res) => {
    const userId = requireBoardUserId(req);
    const customer = await svc.getCustomer(req.params.id as string);
    if (!customer) throw notFound("API app customer not found");
    assertCompanyAccess(req, customer.companyId);
    const revoked = await svc.revokeKey(customer.id, req.params.keyId as string);
    await logActivity(db, {
      companyId: customer.companyId,
      actorType: "user",
      actorId: userId,
      action: "api_app_customer_key.revoked",
      entityType: "api_app_customer_key",
      entityId: revoked.id,
      details: { customerId: customer.id },
    });
    res.json({ ok: true });
  });

  router.get("/api-apps/:apiAppId/billing-units", async (req, res) => {
    assertBoard(req);
    const app = await svc.getApp(req.params.apiAppId as string);
    if (!app) throw notFound("API app not found");
    assertCompanyAccess(req, app.companyId);
    res.json(await svc.units.listUnitDefs(app.id));
  });

  router.post(
    "/api-apps/:apiAppId/billing-units",
    validate(createBillingUnitDefSchema),
    async (req, res) => {
      const userId = requireBoardUserId(req);
      const app = await svc.getApp(req.params.apiAppId as string);
      if (!app) throw notFound("API app not found");
      assertCompanyAccess(req, app.companyId);
      const created = await svc.units.createUnitDef(app.id, app.companyId, req.body);
      await logActivity(db, {
        companyId: app.companyId,
        actorType: "user",
        actorId: userId,
        action: "billing_unit.created",
        entityType: "billing_unit_def",
        entityId: created.id,
        details: { unitKey: created.unitKey },
      });
      res.status(201).json(created);
    },
  );

  router.patch("/billing-units/:id", validate(updateBillingUnitDefSchema), async (req, res) => {
    const userId = requireBoardUserId(req);
    const updated = await svc.units.updateUnitDef(req.params.id as string, req.body);
    assertCompanyAccess(req, updated.companyId);
    await logActivity(db, {
      companyId: updated.companyId,
      actorType: "user",
      actorId: userId,
      action: "billing_unit.updated",
      entityType: "billing_unit_def",
      entityId: updated.id,
      details: req.body,
    });
    res.json(updated);
  });

  router.get("/api-app-customers/:id/unit-prices", async (req, res) => {
    assertBoard(req);
    const customer = await svc.getCustomer(req.params.id as string);
    if (!customer) throw notFound("API app customer not found");
    assertCompanyAccess(req, customer.companyId);
    res.json(await svc.units.getCustomerUnitPrices(customer.id));
  });

  router.put(
    "/api-app-customers/:id/unit-prices",
    validate(putCustomerUnitPricesSchema),
    async (req, res) => {
      const userId = requireBoardUserId(req);
      const customer = await svc.getCustomer(req.params.id as string);
      if (!customer) throw notFound("API app customer not found");
      assertCompanyAccess(req, customer.companyId);
      const prices = await svc.units.putCustomerUnitPrices(customer.id, req.body.prices);
      await logActivity(db, {
        companyId: customer.companyId,
        actorType: "user",
        actorId: userId,
        action: "api_app_customer.unit_prices_updated",
        entityType: "api_app_customer",
        entityId: customer.id,
        details: { count: req.body.prices.length },
      });
      res.json(prices);
    },
  );

  router.get("/api-app-customers/:id/meter-events", async (req, res) => {
    assertBoard(req);
    const customer = await svc.getCustomer(req.params.id as string);
    if (!customer) throw notFound("API app customer not found");
    assertCompanyAccess(req, customer.companyId);
    res.json(await svc.units.listRecentMeterEvents(customer.id));
  });

  router.post(
    "/api-app-customers/me/meter",
    validate(recordBillingUnitMeterSchema),
    async (req, res) => {
      assertApiCustomer(req);
      const customerId = req.actor.apiAppCustomerId!;
      const companyId = req.actor.companyId!;
      assertCompanyAccess(req, companyId);
      await svc.assertCustomerNotBlocked(companyId, customerId);

      const idempotencyKey =
        (typeof req.header("Idempotency-Key") === "string" && req.header("Idempotency-Key")?.trim()) ||
        (typeof req.header("idempotency-key") === "string" && req.header("idempotency-key")?.trim()) ||
        "";
      if (!idempotencyKey) {
        throw badRequest("Idempotency-Key header is required");
      }

      const result = await svc.units.recordUnitMeter({
        customerId,
        unitKey: req.body.unitKey,
        quantity: req.body.quantity,
        source: "partner_api",
        idempotencyKey,
        metadata: req.body.metadata,
        occurredAt: req.body.occurredAt,
      });

      await logActivity(db, {
        companyId,
        actorType: "system",
        actorId: customerId,
        action: "billing_unit.metered",
        entityType: "billing_unit_meter_event",
        entityId: result.event.id,
        details: {
          unitKey: result.event.unitKey,
          quantity: result.event.quantity,
          costCents: result.event.costCents,
          created: result.created,
          keyId: req.actor.keyId ?? null,
          apiAppCustomerId: customerId,
        },
      });

      res.status(result.created ? 201 : 200).json({
        eventId: result.event.id,
        billablePacks: result.event.billablePacks,
        costCents: result.event.costCents,
        source: result.event.source,
      });
    },
  );

  return router;
}
