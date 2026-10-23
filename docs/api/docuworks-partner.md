# DocuWorks partner API (Dev)

Paperclip exposes DocuWorks Drawing Audit Desktop APIs under `/api/v1/*`.  
Auth: `Authorization: Bearer pcp_cust_…` or `X-API-Key: pcp_cust_…`.

OpenAPI: `GET /api/openapi.json` (tag `docuworks-partner`).

## Prerequisites (board master data)

1. Company (e.g. `DocuWorks Audit Dev`)
2. Environment + vault Gemini (or vision) key
3. Agent `PDF OCR` with skill [`skills/docuworks-handwriting-ocr/SKILL.md`](../../skills/docuworks-handwriting-ocr/SKILL.md)
4. API App → default agent = PDF OCR
5. Billing unit `page` (price e.g. ¥15 = `1500` cents)
6. Customer: name, `external_ref=LIC-2026-DEV-001`, plan `pro`, `monthlyUnitCap` 500–1000
7. Mint customer key once; store securely

UI path: `/company/settings/api-apps` → app → customer.

Optional project name: set env `DOCUWORKS_DEFAULT_PROJECT_NAME`, or use `external_ref` as `LIC-xxx::project name`.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/license/current` | License status |
| GET | `/api/v1/license/quota` | Page quota |
| GET | `/api/v1/billing/pricing-summary` | Pricing + refill packages |
| POST | `/api/v1/license/consume-quota` | Meter pages (`job_id` idempotent) |
| POST | `/api/v1/license/activate` | Redeem `dwlic_…` token |
| POST | `/api/v1/ocr/handwriting` | OCR (waits ≤25s; else 202) |
| GET | `/api/v1/ocr/jobs/:requestId` | Poll OCR |
| POST | `/api/api-apps/:apiAppId/docuworks/license-tokens` | Board: mint redeem token |

## Curl recipes

```bash
BASE=http://localhost:3100
KEY=pcp_cust_YOUR_KEY

curl -s "$BASE/api/v1/license/current" -H "Authorization: Bearer $KEY"
curl -s "$BASE/api/v1/license/quota" -H "Authorization: Bearer $KEY"
curl -s "$BASE/api/v1/billing/pricing-summary" -H "Authorization: Bearer $KEY"

curl -s -X POST "$BASE/api/v1/license/consume-quota" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"machine_id":"DEV-MACHINE","pages_consumed":1,"job_id":"JOB-smoke-001"}'

# OCR (tiny PNG as base64)
IMG=$(printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
curl -s -X POST "$BASE/api/v1/ocr/handwriting" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"image_data\":\"$IMG\",\"language\":\"ja\",\"context\":\"architecture_drawing\"}"
```

Board mint top-up token (session or board key):

```bash
curl -s -X POST "$BASE/api/api-apps/$APP_ID/docuworks/license-tokens" \
  -H "Authorization: Bearer $BOARD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pagesGranted":1000,"expiresAt":"2028-10-31T23:59:59.000Z"}'
```

## Env knobs

| Variable | Default | Meaning |
|----------|---------|---------|
| `PAPERCLIP_DOCUWORKS_OCR_WAIT_MS` | `25000` | Sync wait before 202 |
| `PAPERCLIP_DOCUWORKS_OCR_POLL_MS` | `500` | Poll interval while waiting |
| `DOCUWORKS_DEFAULT_PROJECT_NAME` | (empty) | `license.project_name` |

## Field mapping

See plan field map: license/quota/billing from API App customer + `page` unit meters; OCR text from agent JSON comment; activate from `license_redeem_tokens`.
