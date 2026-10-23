import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("http");
vi.unmock("node:http");

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const appId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const customerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const mockSvc = vi.hoisted(() => ({
  getLicenseCurrent: vi.fn(),
  getQuota: vi.fn(),
  getPricingSummary: vi.fn(),
  consumeQuota: vi.fn(),
  activateLicense: vi.fn(),
  runHandwritingOcr: vi.fn(),
  getOcrJob: vi.fn(),
  createLicenseToken: vi.fn(),
}));

vi.mock("../services/partner-docuworks.js", () => ({
  partnerDocuworksService: () => mockSvc,
}));

vi.mock("../services/api-apps.js", () => ({
  apiAppsService: () => ({
    getApp: vi.fn(async () => ({ id: appId, companyId, name: "DocuWorks" })),
  }),
}));

import { partnerDocuworksRoutes } from "../routes/partner-docuworks.js";
import { errorHandler } from "../middleware/error-handler.js";
import { paymentRequired } from "../errors.js";

function makeApp(actor: express.Request["actor"]) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = actor;
    next();
  });
  app.use(partnerDocuworksRoutes({} as never));
  app.use(errorHandler);
  return app;
}

const apiCustomerActor = {
  type: "api_customer" as const,
  apiAppCustomerId: customerId,
  apiAppId: appId,
  companyId,
  userId: "user-1",
  keyId: "key-1",
  source: "api_app_customer_key" as const,
};

describe("partner docuworks routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-api-customer from license current", async () => {
    const res = await request(
      makeApp({
        type: "board",
        userId: "user-1",
        companyIds: [companyId],
        source: "session",
        memberships: [{ companyId, membershipRole: "owner", status: "active" }],
      }),
    ).get("/v1/license/current");
    expect(res.status).toBe(403);
  });

  it("returns license current shape", async () => {
    mockSvc.getLicenseCurrent.mockResolvedValue({
      status: "success",
      license: {
        license_id: "LIC-2026-DEV-001",
        status: "Active",
        tier: "Enterprise",
        customer_name: "清水建設 (Shimizu Corporation)",
        project_name: "新宿オフィス棟新築工事",
        machine_id: "",
        activated_at: "2026-10-19T08:00:00.000Z",
        expires_at: "2027-10-31T23:59:59.000Z",
        features_allowed: ["native_extraction", "hybrid_ai_ocr", "diff_audit"],
      },
    });
    const res = await request(makeApp(apiCustomerActor)).get("/v1/license/current");
    expect(res.status).toBe(200);
    expect(res.body.license.license_id).toBe("LIC-2026-DEV-001");
    expect(res.body.license.features_allowed).toContain("hybrid_ai_ocr");
  });

  it("returns quota shape", async () => {
    mockSvc.getQuota.mockResolvedValue({
      status: "success",
      quota: {
        total_contracted_pages: 5000,
        consumed_pages: 1420,
        remaining_pages: 3580,
        usage_percentage: 28.4,
        breakdown: { native_pages_processed: 0, ai_ocr_pages_consumed: 1420 },
        last_processed_at: "2026-10-19T14:30:15.000Z",
      },
    });
    const res = await request(makeApp(apiCustomerActor)).get("/v1/license/quota");
    expect(res.status).toBe(200);
    expect(res.body.quota.remaining_pages).toBe(3580);
  });

  it("returns pricing summary with refill packages", async () => {
    mockSvc.getPricingSummary.mockResolvedValue({
      status: "success",
      billing: {
        currency: "JPY",
        unit_price_per_page: 15,
        total_incurred_cost: 21300,
        remaining_balance_value: 53700,
        contract_total_value: 75000,
        overage_policy: { allow_overage: false, overage_unit_price: 20 },
        refill_packages: [{ package_id: "PKG-1K", name: "1,000 Pages Top-up", pages: 1000, price: 15000, discount_percentage: 0 }],
      },
    });
    const res = await request(makeApp(apiCustomerActor)).get("/v1/billing/pricing-summary");
    expect(res.status).toBe(200);
    expect(res.body.billing.currency).toBe("JPY");
    expect(res.body.billing.refill_packages[0].package_id).toBe("PKG-1K");
  });

  it("consumes quota idempotently by job_id", async () => {
    mockSvc.consumeQuota.mockResolvedValue({
      status: "success",
      remaining_pages: 3570,
      transaction_id: "TXN-1",
    });
    const res = await request(makeApp(apiCustomerActor))
      .post("/v1/license/consume-quota")
      .send({
        machine_id: "MACHINE-1",
        pages_consumed: 10,
        job_id: "JOB-20261019-001",
      });
    expect(res.status).toBe(200);
    expect(mockSvc.consumeQuota).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "JOB-20261019-001", pagesConsumed: 10 }),
    );
    expect(res.body.remaining_pages).toBe(3570);
  });

  it("activates license", async () => {
    mockSvc.activateLicense.mockResolvedValue({
      status: "success",
      message: "License activated successfully",
      new_remaining_pages: 8570,
      new_expires_at: "2028-10-31T23:59:59.000Z",
    });
    const res = await request(makeApp(apiCustomerActor))
      .post("/v1/license/activate")
      .send({
        machine_id: "MACHINE-1",
        license_key: "dwlic_testtoken12345678",
      });
    expect(res.status).toBe(200);
    expect(res.body.new_remaining_pages).toBe(8570);
  });

  it("runs handwriting OCR success", async () => {
    mockSvc.runHandwritingOcr.mockResolvedValue({
      httpStatus: 200,
      body: {
        status: "success",
        text: "出入口の幅を1000に変更すること",
        confidence: "Low",
        confidence_score: 0.68,
        pages_deducted: 1,
        request_id: "dev-req-20261023-0001",
      },
    });
    const res = await request(makeApp(apiCustomerActor))
      .post("/v1/ocr/handwriting")
      .send({
        image_data: Buffer.from("fake").toString("base64"),
        language: "ja",
        context: "architecture_drawing",
      });
    expect(res.status).toBe(200);
    expect(res.body.text).toContain("出入口");
    expect(res.body.pages_deducted).toBe(1);
  });

  it("returns 202 when OCR is still pending", async () => {
    mockSvc.runHandwritingOcr.mockResolvedValue({
      httpStatus: 202,
      body: {
        status: "accepted",
        request_id: "dev-req-pending",
        poll_url: "/api/v1/ocr/jobs/dev-req-pending",
      },
    });
    const res = await request(makeApp(apiCustomerActor))
      .post("/v1/ocr/handwriting")
      .send({ image_data: "YWJj" });
    expect(res.status).toBe(202);
    expect(res.body.poll_url).toContain("/api/v1/ocr/jobs/");
  });

  it("surfaces quota exceeded from OCR", async () => {
    mockSvc.runHandwritingOcr.mockRejectedValue(
      paymentRequired("Monthly unit quantity cap exceeded", {
        code: "API_CUSTOMER_UNIT_CAP_EXCEEDED",
      }),
    );
    const res = await request(makeApp(apiCustomerActor))
      .post("/v1/ocr/handwriting")
      .send({ image_data: "YWJj" });
    expect(res.status).toBe(402);
  });

  it("polls OCR job", async () => {
    mockSvc.getOcrJob.mockResolvedValue({
      httpStatus: 202,
      body: { status: "pending", request_id: "dev-req-1" },
    });
    const res = await request(makeApp(apiCustomerActor)).get("/v1/ocr/jobs/dev-req-1");
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("pending");
  });

  it("lets board mint license tokens", async () => {
    mockSvc.createLicenseToken.mockResolvedValue({
      id: "token-1",
      license_key: "dwlic_abc",
      pages_granted: 1000,
      expires_at: "2028-10-31T23:59:59.000Z",
    });
    const res = await request(
      makeApp({
        type: "board",
        userId: "user-1",
        companyIds: [companyId],
        source: "session",
        memberships: [{ companyId, membershipRole: "owner", status: "active" }],
      }),
    )
      .post(`/api-apps/${appId}/docuworks/license-tokens`)
      .send({ pagesGranted: 1000, expiresAt: "2028-10-31T23:59:59.000Z" });
    expect(res.status).toBe(201);
    expect(res.body.license_key).toMatch(/^dwlic_/);
  });
});

describe("ocr json parser", () => {
  it("parses fenced agent JSON", async () => {
    const { parseOcrJsonFromText, confidenceBand } = await import(
      "../services/partner-docuworks-ocr-parse.js"
    );
    const parsed = parseOcrJsonFromText(
      'Here you go:\n```json\n{"text":"幅を変更","confidence_score":0.9,"confidence":"High"}\n```\n',
    );
    expect(parsed?.text).toBe("幅を変更");
    expect(confidenceBand(0.9)).toBe("High");
    expect(confidenceBand(0.7)).toBe("Medium");
    expect(confidenceBand(0.4)).toBe("Low");
  });
});
