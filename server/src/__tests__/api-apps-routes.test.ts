import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("http");
vi.unmock("node:http");

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const appId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const customerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const planId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const mockSvc = vi.hoisted(() => ({
  listPricingPlans: vi.fn(),
  listApps: vi.fn(),
  createApp: vi.fn(),
  getApp: vi.fn(),
  updateApp: vi.fn(),
  getAppUsageSummary: vi.fn(),
  listCustomers: vi.fn(),
  createCustomer: vi.fn(),
  getCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  getCustomerMonthUsage: vi.fn(),
  listKeys: vi.fn(),
  createKey: vi.fn(),
  revokeKey: vi.fn(),
  assertCustomerNotBlocked: vi.fn(),
  units: {
    listUnitDefs: vi.fn(),
    createUnitDef: vi.fn(),
    updateUnitDef: vi.fn(),
    getCustomerUnitPrices: vi.fn(),
    putCustomerUnitPrices: vi.fn(),
    listRecentMeterEvents: vi.fn(),
    recordUnitMeter: vi.fn(),
  },
}));

vi.mock("../services/api-apps.js", () => ({
  apiAppsService: () => mockSvc,
}));

vi.mock("../services/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
}));

import { apiAppRoutes } from "../routes/api-apps.js";
import { errorHandler } from "../middleware/error-handler.js";
import { paymentRequired } from "../errors.js";

function makeApp(actor: express.Request["actor"]) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = actor;
    next();
  });
  app.use(apiAppRoutes({} as never));
  app.use(errorHandler);
  return app;
}

describe("api app routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets board list pricing plans", async () => {
    mockSvc.listPricingPlans.mockResolvedValue([
      { id: planId, slug: "free", displayName: "Free" },
    ]);
    const res = await request(
      makeApp({
        type: "board",
        userId: "user-1",
        companyIds: [companyId],
        source: "session",
        memberships: [{ companyId, membershipRole: "owner", status: "active" }],
      }),
    ).get("/pricing-plans");
    expect(res.status).toBe(200);
    expect(res.body[0].slug).toBe("free");
  });

  it("rejects agent keys from board management routes", async () => {
    const res = await request(
      makeApp({
        type: "agent",
        agentId: "agent-1",
        companyId,
        source: "agent_key",
      }),
    ).get(`/companies/${companyId}/api-apps`);
    expect(res.status).toBe(403);
  });

  it("allows api_customer to meter with idempotency key", async () => {
    mockSvc.assertCustomerNotBlocked.mockResolvedValue(undefined);
    mockSvc.units.recordUnitMeter.mockResolvedValue({
      created: true,
      event: {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        unitKey: "pdf_page",
        quantity: 12,
        billablePacks: 12,
        costCents: 24,
        source: "partner_api",
      },
    });

    const res = await request(
      makeApp({
        type: "api_customer",
        apiAppCustomerId: customerId,
        apiAppId: appId,
        companyId,
        userId: "user-1",
        keyId: "key-1",
        source: "api_app_customer_key",
        onBehalfOfUserId: "user-1",
        onBehalfOfMemberships: [
          { companyId, membershipRole: "owner", status: "active" },
        ],
      }),
    )
      .post("/api-app-customers/me/meter")
      .set("Idempotency-Key", "doc-99")
      .send({ unitKey: "pdf_page", quantity: 12 });

    expect(res.status).toBe(201);
    expect(res.body.costCents).toBe(24);
    expect(mockSvc.units.recordUnitMeter).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId,
        unitKey: "pdf_page",
        quantity: 12,
        idempotencyKey: "doc-99",
        source: "partner_api",
      }),
    );
  });

  it("requires Idempotency-Key for meter posts", async () => {
    const res = await request(
      makeApp({
        type: "api_customer",
        apiAppCustomerId: customerId,
        apiAppId: appId,
        companyId,
        userId: "user-1",
        source: "api_app_customer_key",
        onBehalfOfUserId: "user-1",
        onBehalfOfMemberships: [
          { companyId, membershipRole: "owner", status: "active" },
        ],
      }),
    )
      .post("/api-app-customers/me/meter")
      .send({ unitKey: "pdf_page", quantity: 1 });

    expect(res.status).toBe(400);
  });

  it("surfaces plan hard-stop from assertCustomerNotBlocked before metering", async () => {
    mockSvc.assertCustomerNotBlocked.mockRejectedValue(
      paymentRequired("API customer unit spend cap exceeded", {
        code: "API_CUSTOMER_UNIT_SPEND_EXCEEDED",
      }),
    );

    const res = await request(
      makeApp({
        type: "api_customer",
        apiAppCustomerId: customerId,
        apiAppId: appId,
        companyId,
        userId: "user-1",
        source: "api_app_customer_key",
        onBehalfOfUserId: "user-1",
        onBehalfOfMemberships: [
          { companyId, membershipRole: "owner", status: "active" },
        ],
      }),
    )
      .post("/api-app-customers/me/meter")
      .set("Idempotency-Key", "blocked-1")
      .send({ unitKey: "pdf_page", quantity: 1 });

    expect(res.status).toBe(402);
    expect(mockSvc.units.recordUnitMeter).not.toHaveBeenCalled();
  });
});
