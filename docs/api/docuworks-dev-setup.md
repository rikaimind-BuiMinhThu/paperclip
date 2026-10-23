# DocuWorks Dev setup checklist (Phase 0)

Run with `pnpm dev` (API/UI on `http://localhost:3100`).

## Create master data (board UI)

1. `/companies` — create **DocuWorks Audit Dev**
2. `/company/settings/instance/environments` — create a runtime environment
3. `/company/settings/secrets` — add provider key (Gemini / vision) to platform vault
4. `/agents/new` — create **PDF OCR**
   - Adapter with vision (e.g. `gemini_local`)
   - Bind environment
   - Attach / paste instructions from `skills/docuworks-handwriting-ocr/SKILL.md`
5. `/company/settings/api-apps` — create app **DocuWorks Drawing Audit**
   - Default agent = PDF OCR
6. App detail — create billing unit:
   - `unitKey`: `page`
   - `displayName`: `Page`
   - `defaultPriceCents`: `1500` (¥15)
7. Create customer:
   - Name: `清水建設 (Shimizu Corporation)`
   - `external_ref`: `LIC-2026-DEV-001` (optional `::新宿オフィス棟新築工事`)
   - Plan: `pro`
8. Customer detail — set unit price:
   - `priceCents`: `1500`
   - `monthlyUnitCap`: `1000`
9. **Create key** — copy `pcp_cust_…` once (name e.g. `rikai-desktop-dev`)

## Smoke (before / after facade)

```bash
KEY=pcp_cust_...
curl -s http://localhost:3100/api/api-app-customers/me/usage -H "Authorization: Bearer $KEY"
curl -s -X POST http://localhost:3100/api/api-app-customers/me/meter \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: setup-smoke-1" \
  -d '{"unitKey":"page","quantity":1}'
```

Then hit `/api/v1/license/quota` with the same key (see [docuworks-partner.md](./docuworks-partner.md)).

## Handoff to Rikai

- Base URL (localhost or tunnel)
- One `pcp_cust_` key
- Page cap (500–1000)
- Link to OpenAPI (`/api/openapi.json`) and [docuworks-partner.md](./docuworks-partner.md)
