# DocuWorks partner API — implementation report

**Date:** 2026-10-23  
**Branch:** `feat/marketing-plan-first-org-work-flow` (local DocuWorks changes)  
**Base URL tested:** `http://127.0.0.1:3100`  
**Deployment:** `local_trusted`

## 1. What shipped

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/license/current` | License status |
| GET | `/api/v1/license/status` | Alias |
| GET | `/api/v1/license/quota` | Page quota |
| GET | `/api/v1/billing/pricing-summary` | Pricing + refill packages |
| GET | `/api/v1/billing/summary` | Alias |
| POST | `/api/v1/license/consume-quota` | Meter pages (`job_id` idempotent) |
| POST | `/api/v1/license/activate` | Redeem `dwlic_…` token |
| POST | `/api/v1/license/topup` | Alias of activate |
| POST | `/api/v1/ocr/handwriting` | Handwriting OCR via default agent |
| GET | `/api/v1/ocr/jobs/:requestId` | Poll OCR job |
| POST | `/api/api-apps/:apiAppId/docuworks/license-tokens` | Board: mint redeem token |

OpenAPI tag: `docuworks-partner` (`GET /api/openapi.json`).

Auth: `Authorization: Bearer pcp_cust_…` **or** `X-API-Key: pcp_cust_…`.

## 2. Seeded master data (live Dev)

| Object | ID / value |
|--------|------------|
| Company | `63e75bf2-64fc-4a20-9ac5-71dbd5f6fa6f` — DocuWorks Audit Dev |
| Agent | `c016aafc-028b-4c93-b6b5-7965264fa7e4` — PDF OCR (`gemini_local`) |
| API App | `f17932dc-e16b-40fe-a83f-c643b2de9208` — DocuWorks Drawing Audit |
| Billing unit | `page` @ ¥15 (`1500` cents) |
| Customer | `483dfd71-5f8d-4224-a96d-8805a936848d` — 清水建設… |
| External ref | `LIC-2026-DEV-001::新宿オフィス棟新築工事` |
| Plan | `pro` → tier Enterprise |
| Page cap | `1000` |
| Key | `pcp_cust_68fc…` (redacted; recreate under customer → API keys) |

Setup checklist: [docuworks-dev-setup.md](./docuworks-dev-setup.md)  
Partner curl recipes: [docuworks-partner.md](./docuworks-partner.md)

## 3. Live smoke results (2026-10-23)

| Call | HTTP | Result |
|------|------|--------|
| `GET /api/v1/license/current` | **200** | `license_id=LIC-2026-DEV-001`, `status=Active`, `tier=Enterprise`, project from `external_ref` |
| `GET /api/v1/license/quota` | **200** | `1000` total, `0` consumed initially |
| `GET /api/v1/billing/pricing-summary` | **200** | `unit_price_per_page=15`, `JPY`, PKG-1K / PKG-5K |
| `POST /api/v1/license/consume-quota` (1 page) | **200** | `remaining_pages=999` |
| `GET /api/v1/license/quota` (after) | **200** | `consumed_pages=1`, `usage_percentage=0.1` |
| `POST /api/v1/ocr/handwriting` | **202** | `request_id=dev-req-20261023-4d5a` + `poll_url` (agent did not finish within wait; expected without vault Gemini) |
| `X-API-Key` on license | **200** | Same license shape; `machine_id` from prior consume metadata |

## 4. Automated tests

```text
pnpm exec vitest run \
  src/__tests__/partner-docuworks-routes.test.ts \
  src/__tests__/openapi-routes.test.ts

Test Files  2 passed (2)
Tests       22 passed (22)
```

## 5. Gaps / follow-ups

- **OCR 200** needs platform-vault Gemini (or other vision) keys so the agent can complete within `PAPERCLIP_DOCUWORKS_OCR_WAIT_MS` (default 25s); otherwise clients poll `GET /api/v1/ocr/jobs/:id`.
- **Refill packages** are static catalog in the facade (not Stripe checkout).
- **Activate / top-up** requires board-minted tokens via `POST /api/api-apps/:id/docuworks/license-tokens`.
- Migration: `packages/db/src/migrations/0299_daily_stellaris.sql` (`docuworks_ocr_jobs`, `license_redeem_tokens`).

## 6. Commit

**Commit:** `6ed7dbd1` (`6ed7dbd149e520e76bf3caa6865c7d8ecebf55af`).
