import { Router } from "express";
import multer from "multer";
import type { Db } from "@paperclipai/db";
import {
  docuworksActivateLicenseSchema,
  docuworksConsumeQuotaSchema,
  docuworksCreateLicenseTokenSchema,
  docuworksOcrHandwritingSchema,
} from "@paperclipai/shared";
import { badRequest, forbidden, notFound } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { apiAppsService } from "../services/api-apps.js";
import { partnerDocuworksService } from "../services/partner-docuworks.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});

function assertApiCustomer(req: import("express").Request) {
  if (req.actor.type !== "api_customer") {
    throw forbidden("API customer access required");
  }
}

function requireBoardUserId(req: import("express").Request): string {
  assertBoard(req);
  if (!req.actor.userId) {
    throw forbidden("Board user context required");
  }
  return req.actor.userId;
}

export function partnerDocuworksRoutes(db: Db) {
  const router = Router();
  const svc = partnerDocuworksService(db);

  router.get("/v1/license/current", async (req, res) => {
    assertApiCustomer(req);
    const companyId = req.actor.companyId!;
    assertCompanyAccess(req, companyId);
    const machineId =
      typeof req.query.machine_id === "string" ? req.query.machine_id : null;
    const body = await svc.getLicenseCurrent({
      customerId: req.actor.apiAppCustomerId!,
      keyId: req.actor.keyId ?? null,
      machineId,
    });
    res.json(body);
  });

  router.get("/v1/license/status", async (req, res) => {
    assertApiCustomer(req);
    const companyId = req.actor.companyId!;
    assertCompanyAccess(req, companyId);
    const machineId =
      typeof req.query.machine_id === "string" ? req.query.machine_id : null;
    const body = await svc.getLicenseCurrent({
      customerId: req.actor.apiAppCustomerId!,
      keyId: req.actor.keyId ?? null,
      machineId,
    });
    res.json(body);
  });

  router.get("/v1/license/quota", async (req, res) => {
    assertApiCustomer(req);
    assertCompanyAccess(req, req.actor.companyId!);
    res.json(await svc.getQuota(req.actor.apiAppCustomerId!));
  });

  router.get("/v1/billing/pricing-summary", async (req, res) => {
    assertApiCustomer(req);
    assertCompanyAccess(req, req.actor.companyId!);
    res.json(await svc.getPricingSummary(req.actor.apiAppCustomerId!));
  });

  router.get("/v1/billing/summary", async (req, res) => {
    assertApiCustomer(req);
    assertCompanyAccess(req, req.actor.companyId!);
    res.json(await svc.getPricingSummary(req.actor.apiAppCustomerId!));
  });

  router.post(
    "/v1/license/consume-quota",
    validate(docuworksConsumeQuotaSchema),
    async (req, res) => {
      assertApiCustomer(req);
      assertCompanyAccess(req, req.actor.companyId!);
      const body = await svc.consumeQuota({
        customerId: req.actor.apiAppCustomerId!,
        companyId: req.actor.companyId!,
        machineId: req.body.machine_id,
        pagesConsumed: req.body.pages_consumed,
        jobId: req.body.job_id,
        clientTimestamp: req.body.client_timestamp,
        ledgerHashProof: req.body.ledger_hash_proof,
      });
      res.json(body);
    },
  );

  router.post(
    "/v1/license/activate",
    validate(docuworksActivateLicenseSchema),
    async (req, res) => {
      assertApiCustomer(req);
      assertCompanyAccess(req, req.actor.companyId!);
      const body = await svc.activateLicense({
        customerId: req.actor.apiAppCustomerId!,
        companyId: req.actor.companyId!,
        machineId: req.body.machine_id,
        licenseKey: req.body.license_key,
        keyId: req.actor.keyId ?? null,
      });
      res.json(body);
    },
  );

  router.post(
    "/v1/license/topup",
    validate(docuworksActivateLicenseSchema),
    async (req, res) => {
      assertApiCustomer(req);
      assertCompanyAccess(req, req.actor.companyId!);
      const body = await svc.activateLicense({
        customerId: req.actor.apiAppCustomerId!,
        companyId: req.actor.companyId!,
        machineId: req.body.machine_id,
        licenseKey: req.body.license_key,
        keyId: req.actor.keyId ?? null,
      });
      res.json(body);
    },
  );

  router.post(
    "/v1/ocr/handwriting",
    upload.single("image"),
    async (req, res) => {
      assertApiCustomer(req);
      assertCompanyAccess(req, req.actor.companyId!);

      const parsedJson =
        req.is("multipart/form-data")
          ? {
              image_data: undefined as string | undefined,
              language:
                typeof req.body?.language === "string" ? req.body.language : "ja",
              context:
                typeof req.body?.context === "string"
                  ? req.body.context
                  : "architecture_drawing",
            }
          : docuworksOcrHandwritingSchema.parse(req.body ?? {});

      let imageBase64 = parsedJson.image_data?.trim() || "";
      if (req.file?.buffer?.length) {
        imageBase64 = req.file.buffer.toString("base64");
      }
      if (!imageBase64) {
        throw badRequest("Provide image_data (base64) or multipart file field 'image'");
      }

      const result = await svc.runHandwritingOcr({
        customerId: req.actor.apiAppCustomerId!,
        companyId: req.actor.companyId!,
        apiAppId: req.actor.apiAppId!,
        imageBase64,
        language: parsedJson.language ?? "ja",
        context: parsedJson.context ?? "architecture_drawing",
        createdByUserId: req.actor.userId!,
      });
      res.status(result.httpStatus).json(result.body);
    },
  );

  router.get("/v1/ocr/jobs/:requestId", async (req, res) => {
    assertApiCustomer(req);
    assertCompanyAccess(req, req.actor.companyId!);
    const result = await svc.getOcrJob({
      customerId: req.actor.apiAppCustomerId!,
      requestId: req.params.requestId as string,
    });
    res.status(result.httpStatus).json(result.body);
  });

  router.post(
    "/api-apps/:apiAppId/docuworks/license-tokens",
    validate(docuworksCreateLicenseTokenSchema),
    async (req, res) => {
      const userId = requireBoardUserId(req);
      const apiAppId = req.params.apiAppId as string;
      const app = await apiAppsService(db).getApp(apiAppId);
      if (!app) throw notFound("API app not found");
      assertCompanyAccess(req, app.companyId);
      const created = await svc.createLicenseToken({
        companyId: app.companyId,
        apiAppId,
        pagesGranted: req.body.pagesGranted,
        expiresAt: req.body.expiresAt,
        apiAppCustomerId: req.body.apiAppCustomerId ?? null,
        label: req.body.label ?? null,
        createdByUserId: userId,
      });
      res.status(201).json(created);
    },
  );

  return router;
}
