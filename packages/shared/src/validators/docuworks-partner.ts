import { z } from "zod";

export const docuworksOcrHandwritingSchema = z.object({
  image_data: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1).max(16).default("ja"),
  context: z.string().trim().min(1).max(120).default("architecture_drawing"),
});
export type DocuworksOcrHandwriting = z.infer<typeof docuworksOcrHandwritingSchema>;

export const docuworksConsumeQuotaSchema = z.object({
  machine_id: z.string().trim().min(1).max(200),
  pages_consumed: z.number().int().min(1),
  job_id: z.string().trim().min(1).max(200),
  client_timestamp: z.number().int().optional(),
  ledger_hash_proof: z.string().trim().max(500).optional(),
});
export type DocuworksConsumeQuota = z.infer<typeof docuworksConsumeQuotaSchema>;

export const docuworksActivateLicenseSchema = z.object({
  machine_id: z.string().trim().min(1).max(200),
  license_key: z.string().trim().min(8).max(4000),
});
export type DocuworksActivateLicense = z.infer<typeof docuworksActivateLicenseSchema>;

export const docuworksCreateLicenseTokenSchema = z.object({
  pagesGranted: z.number().int().min(1).default(1000),
  expiresAt: z.coerce.date(),
  apiAppCustomerId: z.string().uuid().nullable().optional(),
  label: z.string().trim().min(1).max(120).optional(),
});
export type DocuworksCreateLicenseToken = z.infer<typeof docuworksCreateLicenseTokenSchema>;
