import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  apiAppCustomerKeys,
  docuworksOcrJobs,
  licenseRedeemTokens,
  pricingPlans,
} from "@paperclipai/db";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  paymentRequired,
  unprocessable,
} from "../errors.js";
import { apiAppsService } from "./api-apps.js";
import { heartbeatService } from "./heartbeat.js";
import { queueIssueAssignmentWakeup } from "./issue-assignment-wakeup.js";
import { issueService } from "./issues.js";
import { logActivity } from "./activity-log.js";
import { confidenceBand, parseOcrJsonFromText } from "./partner-docuworks-ocr-parse.js";

export { confidenceBand, parseOcrJsonFromText } from "./partner-docuworks-ocr-parse.js";

const PAGE_UNIT_KEY = "page";
const DEFAULT_FEATURES = ["native_extraction", "hybrid_ai_ocr", "diff_audit"] as const;
const DEFAULT_REFILL_PACKAGES = [
  {
    package_id: "PKG-1K",
    name: "1,000 Pages Top-up",
    pages: 1000,
    price: 15000,
    discount_percentage: 0.0,
  },
  {
    package_id: "PKG-5K",
    name: "5,000 Pages Top-up",
    pages: 5000,
    price: 67500,
    discount_percentage: 10.0,
  },
] as const;

const TIER_BY_PLAN_SLUG: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Enterprise",
};

export type DocuworksOcrResult = {
  status: "success";
  text: string;
  confidence: "High" | "Medium" | "Low";
  confidence_score: number;
  pages_deducted: number;
  request_id: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRequestId() {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const seq = randomBytes(2).toString("hex");
  return `dev-req-${day}-${seq}`;
}

function createLicenseTokenPlaintext() {
  return `dwlic_${randomBytes(24).toString("hex")}`;
}

function hashLicenseToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function ocrWaitMs() {
  const raw = Number(process.env.PAPERCLIP_DOCUWORKS_OCR_WAIT_MS ?? "25000");
  return Number.isFinite(raw) && raw >= 0 ? Math.min(raw, 60_000) : 25_000;
}

function ocrPollMs() {
  const raw = Number(process.env.PAPERCLIP_DOCUWORKS_OCR_POLL_MS ?? "500");
  return Number.isFinite(raw) && raw >= 50 ? Math.min(raw, 5_000) : 500;
}

export function partnerDocuworksService(db: Db) {
  const apiApps = apiAppsService(db);
  const issues = issueService(db);
  const heartbeat = heartbeatService(db);

  async function requireCustomerContext(customerId: string) {
    const customer = await apiApps.getCustomer(customerId);
    if (!customer) throw notFound("API app customer not found");
    const app = await apiApps.getApp(customer.apiAppId);
    if (!app) throw notFound("API app not found");
    const plan = await db
      .select()
      .from(pricingPlans)
      .where(eq(pricingPlans.id, customer.planId))
      .then((rows) => rows[0] ?? null);
    return { customer, app, plan };
  }

  async function pageQuota(customerId: string) {
    const usage = await apiApps.getCustomerMonthUsage(customerId);
    const pageUnit = usage.units.find((u) => u.unitKey === PAGE_UNIT_KEY);
    const prices = await apiApps.units.getCustomerUnitPrices(customerId);
    const pagePrice = prices.find((p) => p.unitKey === PAGE_UNIT_KEY && p.isActive);
    const total = pagePrice?.monthlyUnitCap ?? 0;
    const consumed = pageUnit?.quantity ?? 0;
    const remaining = Math.max(0, total - consumed);
    const usagePercentage = total > 0 ? Math.round((consumed / total) * 1000) / 10 : 0;
    const events = await apiApps.units.listRecentMeterEvents(customerId, 1);
    const last = events[0] ?? null;
    const unitPriceYen = (pagePrice?.priceCents ?? pageUnit?.priceCents ?? 0) / 100;
    const incurred =
      pageUnit != null ? pageUnit.costCents / 100 : consumed * unitPriceYen;
    return {
      total,
      consumed,
      remaining,
      usagePercentage,
      lastProcessedAt: last?.occurredAt ? new Date(last.occurredAt).toISOString() : null,
      unitPriceYen,
      incurred,
      contractTotal: total * unitPriceYen,
      remainingBalance: Math.max(0, total * unitPriceYen - incurred),
      pagePrice,
      events,
    };
  }

  async function resolveDefaultAgentId(customerId: string, appId: string) {
    const customer = await apiApps.getCustomer(customerId);
    if (customer?.defaultAgentId) return customer.defaultAgentId;
    const app = await apiApps.getApp(appId);
    return app?.defaultAgentId ?? null;
  }

  async function finishOcrSuccess(input: {
    jobId: string;
    requestId: string;
    customerId: string;
    companyId: string;
    text: string;
    confidence_score: number;
    confidence?: string;
  }): Promise<DocuworksOcrResult> {
    const confidence =
      input.confidence === "High" ||
      input.confidence === "Medium" ||
      input.confidence === "Low"
        ? input.confidence
        : confidenceBand(input.confidence_score);

    await apiApps.units.recordUnitMeter({
      customerId: input.customerId,
      unitKey: PAGE_UNIT_KEY,
      quantity: 1,
      source: "auto",
      idempotencyKey: input.requestId,
      metadata: { kind: "docuworks_ocr_handwriting" },
    });

    const result: DocuworksOcrResult = {
      status: "success",
      text: input.text,
      confidence,
      confidence_score: input.confidence_score,
      pages_deducted: 1,
      request_id: input.requestId,
    };

    await db
      .update(docuworksOcrJobs)
      .set({
        status: "success",
        result,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(docuworksOcrJobs.id, input.jobId));

    await logActivity(db, {
      companyId: input.companyId,
      actorType: "system",
      actorId: input.customerId,
      action: "docuworks.ocr.success",
      entityType: "docuworks_ocr_job",
      entityId: input.jobId,
      details: { requestId: input.requestId, pagesDeducted: 1 },
    });

    return result;
  }

  async function tryParseIssueOcr(issueId: string) {
    const comments = await issues.listComments(issueId, { order: "desc", limit: 20 });
    for (const comment of comments) {
      const parsed = parseOcrJsonFromText(comment.body ?? "");
      if (parsed) return parsed;
    }
    return null;
  }

  return {
    getLicenseCurrent: async (input: {
      customerId: string;
      keyId?: string | null;
      machineId?: string | null;
    }) => {
      const { customer, app, plan } = await requireCustomerContext(input.customerId);
      const keys = await apiApps.listKeys(customer.id);
      const activeKey =
        (input.keyId ? keys.find((k) => k.id === input.keyId) : null) ??
        keys.find((k) => !k.revokedAt) ??
        null;

      let status: "Active" | "Suspended" | "Expired" = "Active";
      if (app.status !== "active" || customer.status !== "active") status = "Suspended";
      if (activeKey?.expiresAt && new Date(activeKey.expiresAt).getTime() <= Date.now()) {
        status = "Expired";
      }
      if (activeKey?.revokedAt) status = "Suspended";

      const events = await apiApps.units.listRecentMeterEvents(customer.id, 20);
      const machineFromMeta = events
        .map((e) => {
          const mid = e.metadata && typeof e.metadata === "object" ? (e.metadata as Record<string, unknown>).machine_id : null;
          return typeof mid === "string" ? mid : null;
        })
        .find(Boolean);

      const projectName =
        process.env.DOCUWORKS_DEFAULT_PROJECT_NAME?.trim() ||
        (customer.externalRef?.includes("::")
          ? customer.externalRef.split("::").slice(1).join("::")
          : "");

      const licenseId =
        customer.externalRef?.split("::")[0]?.trim() || `LIC-${customer.id}`;

      return {
        status: "success" as const,
        license: {
          license_id: licenseId,
          status,
          tier: TIER_BY_PLAN_SLUG[plan?.slug ?? ""] ?? plan?.displayName ?? "Standard",
          customer_name: customer.name,
          project_name: projectName,
          machine_id: input.machineId?.trim() || machineFromMeta || "",
          activated_at: new Date(customer.createdAt).toISOString(),
          expires_at: activeKey?.expiresAt
            ? new Date(activeKey.expiresAt).toISOString()
            : null,
          features_allowed: [...DEFAULT_FEATURES],
        },
      };
    },

    getQuota: async (customerId: string) => {
      await requireCustomerContext(customerId);
      const q = await pageQuota(customerId);
      return {
        status: "success" as const,
        quota: {
          total_contracted_pages: q.total,
          consumed_pages: q.consumed,
          remaining_pages: q.remaining,
          usage_percentage: q.usagePercentage,
          breakdown: {
            native_pages_processed: 0,
            ai_ocr_pages_consumed: q.consumed,
          },
          last_processed_at: q.lastProcessedAt,
        },
      };
    },

    getPricingSummary: async (customerId: string) => {
      await requireCustomerContext(customerId);
      const q = await pageQuota(customerId);
      return {
        status: "success" as const,
        billing: {
          currency: "JPY",
          unit_price_per_page: q.unitPriceYen,
          total_incurred_cost: q.incurred,
          remaining_balance_value: q.remainingBalance,
          contract_total_value: q.contractTotal,
          overage_policy: {
            allow_overage: false,
            overage_unit_price: q.unitPriceYen > 0 ? q.unitPriceYen + 5 : 20,
          },
          refill_packages: DEFAULT_REFILL_PACKAGES.map((p) => ({ ...p })),
        },
      };
    },

    consumeQuota: async (input: {
      customerId: string;
      companyId: string;
      machineId: string;
      pagesConsumed: number;
      jobId: string;
      clientTimestamp?: number;
      ledgerHashProof?: string;
    }) => {
      await apiApps.assertCustomerNotBlocked(input.companyId, input.customerId);
      const result = await apiApps.units.recordUnitMeter({
        customerId: input.customerId,
        unitKey: PAGE_UNIT_KEY,
        quantity: input.pagesConsumed,
        source: "partner_api",
        idempotencyKey: input.jobId,
        metadata: {
          machine_id: input.machineId,
          ledger_hash_proof: input.ledgerHashProof ?? null,
          client_timestamp: input.clientTimestamp ?? null,
        },
        occurredAt:
          input.clientTimestamp != null ? new Date(input.clientTimestamp * 1000) : undefined,
      });
      const q = await pageQuota(input.customerId);
      return {
        status: "success" as const,
        remaining_pages: q.remaining,
        transaction_id: result.event.id,
      };
    },

    createLicenseToken: async (input: {
      companyId: string;
      apiAppId: string;
      pagesGranted: number;
      expiresAt: Date;
      apiAppCustomerId?: string | null;
      label?: string | null;
      createdByUserId: string;
    }) => {
      const app = await apiApps.getApp(input.apiAppId);
      if (!app || app.companyId !== input.companyId) throw notFound("API app not found");
      if (input.apiAppCustomerId) {
        const customer = await apiApps.getCustomer(input.apiAppCustomerId);
        if (!customer || customer.apiAppId !== app.id) {
          throw unprocessable("Customer does not belong to this API app");
        }
      }
      const token = createLicenseTokenPlaintext();
      const [created] = await db
        .insert(licenseRedeemTokens)
        .values({
          companyId: input.companyId,
          apiAppId: input.apiAppId,
          apiAppCustomerId: input.apiAppCustomerId ?? null,
          label: input.label ?? null,
          tokenHash: hashLicenseToken(token),
          pagesGranted: input.pagesGranted,
          expiresAt: input.expiresAt,
        })
        .returning();
      await logActivity(db, {
        companyId: input.companyId,
        actorType: "user",
        actorId: input.createdByUserId,
        action: "docuworks.license_token.created",
        entityType: "license_redeem_token",
        entityId: created!.id,
        details: { pagesGranted: input.pagesGranted, apiAppId: input.apiAppId },
      });
      return {
        id: created!.id,
        license_key: token,
        pages_granted: created!.pagesGranted,
        expires_at: created!.expiresAt.toISOString(),
      };
    },

    activateLicense: async (input: {
      customerId: string;
      companyId: string;
      machineId: string;
      licenseKey: string;
      keyId?: string | null;
    }) => {
      const { customer, app } = await requireCustomerContext(input.customerId);
      const tokenHash = hashLicenseToken(input.licenseKey.trim());
      const token = await db
        .select()
        .from(licenseRedeemTokens)
        .where(
          and(
            eq(licenseRedeemTokens.tokenHash, tokenHash),
            eq(licenseRedeemTokens.apiAppId, app.id),
            isNull(licenseRedeemTokens.redeemedAt),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (!token) throw badRequest("Invalid or already used license key");
      if (token.apiAppCustomerId && token.apiAppCustomerId !== customer.id) {
        throw forbidden("License key is bound to another customer");
      }

      const prices = await apiApps.units.getCustomerUnitPrices(customer.id);
      const pagePrice = prices.find((p) => p.unitKey === PAGE_UNIT_KEY);
      if (!pagePrice) {
        throw unprocessable("Billing unit 'page' is not configured for this customer");
      }
      const currentCap = pagePrice.monthlyUnitCap ?? 0;
      const newCap = currentCap + token.pagesGranted;
      await apiApps.units.putCustomerUnitPrices(customer.id, [
        {
          billingUnitDefId: pagePrice.billingUnitDefId,
          priceCents: pagePrice.priceCents,
          enabled: pagePrice.enabled,
          monthlyUnitCap: newCap,
        },
      ]);

      if (input.keyId) {
        await db
          .update(apiAppCustomerKeys)
          .set({ expiresAt: token.expiresAt })
          .where(
            and(
              eq(apiAppCustomerKeys.id, input.keyId),
              eq(apiAppCustomerKeys.apiAppCustomerId, customer.id),
            ),
          );
      }

      await db
        .update(licenseRedeemTokens)
        .set({
          redeemedAt: new Date(),
          redeemedByCustomerId: customer.id,
        })
        .where(eq(licenseRedeemTokens.id, token.id));

      await logActivity(db, {
        companyId: input.companyId,
        actorType: "system",
        actorId: customer.id,
        action: "docuworks.license.activated",
        entityType: "license_redeem_token",
        entityId: token.id,
        details: {
          machine_id: input.machineId,
          pages_granted: token.pagesGranted,
          new_cap: newCap,
        },
      });

      const q = await pageQuota(customer.id);
      return {
        status: "success" as const,
        message: "License activated successfully",
        new_remaining_pages: q.remaining,
        new_expires_at: token.expiresAt.toISOString(),
      };
    },

    runHandwritingOcr: async (input: {
      customerId: string;
      companyId: string;
      apiAppId: string;
      imageBase64: string;
      language: string;
      context: string;
      createdByUserId: string;
    }): Promise<{ httpStatus: 200 | 202; body: DocuworksOcrResult | { status: "accepted"; request_id: string; poll_url: string } }> => {
      await apiApps.assertCustomerNotBlocked(input.companyId, input.customerId);
      const q = await pageQuota(input.customerId);
      if (q.total > 0 && q.remaining < 1) {
        throw paymentRequired("Monthly unit quantity cap exceeded", {
          code: "API_CUSTOMER_UNIT_CAP_EXCEEDED",
        });
      }

      const agentId = await resolveDefaultAgentId(input.customerId, input.apiAppId);
      if (!agentId) {
        throw conflict("No default agent bound for OCR", { code: "AGENT_NOT_BOUND" });
      }

      const requestId = createRequestId();
      const cleaned = input.imageBase64.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
      if (!cleaned) throw badRequest("image_data is required");
      // Keep description bounded for DB/prompts; full images should use attachments in later iterations.
      const imageForPrompt =
        cleaned.length > 120_000 ? `${cleaned.slice(0, 120_000)}…[truncated]` : cleaned;

      const description = [
        `# DocuWorks OCR handwriting`,
        ``,
        `language: ${input.language}`,
        `context: ${input.context}`,
        `request_id: ${requestId}`,
        ``,
        `Recognize Japanese freehand strokes. Reply with ONLY one fenced JSON block:`,
        "```json",
        `{ "text": "...", "confidence_score": 0.0, "confidence": "Low" }`,
        "```",
        ``,
        `Image (base64):`,
        "```",
        imageForPrompt,
        "```",
      ].join("\n");

      const issue = await issues.create(input.companyId, {
        title: `DocuWorks OCR ${requestId}`,
        description,
        status: "todo",
        assigneeAgentId: agentId,
        apiAppId: input.apiAppId,
        apiAppCustomerId: input.customerId,
        createdByUserId: input.createdByUserId,
        idempotencyKey: `docuworks-ocr:${requestId}`,
      });

      const [job] = await db
        .insert(docuworksOcrJobs)
        .values({
          requestId,
          companyId: input.companyId,
          apiAppId: input.apiAppId,
          apiAppCustomerId: input.customerId,
          issueId: issue.id,
          status: "pending",
        })
        .returning();

      void queueIssueAssignmentWakeup({
        heartbeat,
        issue: { id: issue.id, assigneeAgentId: agentId, status: issue.status },
        reason: "docuworks_ocr_handwriting",
        mutation: "docuworks.ocr.created",
        contextSource: "docuworks_partner_api",
        requestedByActorType: "user",
        requestedByActorId: input.createdByUserId,
        taskKey: `docuworks-ocr:${requestId}`,
      });

      const deadline = Date.now() + ocrWaitMs();
      while (Date.now() < deadline) {
        const parsed = await tryParseIssueOcr(issue.id);
        if (parsed) {
          const body = await finishOcrSuccess({
            jobId: job!.id,
            requestId,
            customerId: input.customerId,
            companyId: input.companyId,
            text: parsed.text,
            confidence_score: parsed.confidence_score,
            confidence: parsed.confidence,
          });
          return { httpStatus: 200, body };
        }
        await sleep(ocrPollMs());
      }

      return {
        httpStatus: 202,
        body: {
          status: "accepted",
          request_id: requestId,
          poll_url: `/api/v1/ocr/jobs/${requestId}`,
        },
      };
    },

    getOcrJob: async (input: { customerId: string; requestId: string }) => {
      const job = await db
        .select()
        .from(docuworksOcrJobs)
        .where(
          and(
            eq(docuworksOcrJobs.requestId, input.requestId),
            eq(docuworksOcrJobs.apiAppCustomerId, input.customerId),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (!job) throw notFound("OCR job not found");

      if (job.status === "success" && job.result) {
        return { httpStatus: 200 as const, body: job.result };
      }
      if (job.status === "failed") {
        return {
          httpStatus: 502 as const,
          body: {
            status: "failed",
            request_id: job.requestId,
            error: job.errorMessage ?? "OCR failed",
          },
        };
      }

      if (job.issueId) {
        const parsed = await tryParseIssueOcr(job.issueId);
        if (parsed) {
          const body = await finishOcrSuccess({
            jobId: job.id,
            requestId: job.requestId,
            customerId: input.customerId,
            companyId: job.companyId,
            text: parsed.text,
            confidence_score: parsed.confidence_score,
            confidence: parsed.confidence,
          });
          return { httpStatus: 200 as const, body };
        }
      }

      return {
        httpStatus: 202 as const,
        body: { status: "pending", request_id: job.requestId },
      };
    },
  };
}
