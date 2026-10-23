---
name: docuworks-handwriting-ocr
description: Recognize Japanese freehand handwriting on architecture drawing crops and return structured OCR JSON for the DocuWorks partner API.
---

# DocuWorks handwriting OCR

When the task is a DocuWorks handwriting OCR job (title or description mentions `DocuWorks OCR` / `handwriting` / `architecture_drawing`):

1. Read the attached image or the base64 image block in the issue description.
2. Recognize Japanese handwriting (`language=ja`) in an architecture-drawing context.
3. Reply with **only** one fenced JSON block (no prose outside the fence):

```json
{
  "text": "出入口の幅を1000に変更すること",
  "confidence_score": 0.68,
  "confidence": "Low"
}
```

## Rules

- `text` is the recognized Japanese (or empty string if unreadable).
- `confidence_score` is `0.0`–`1.0`.
- `confidence` must be `High` (≥0.85), `Medium` (≥0.65), or `Low` (<0.65). Prefer deriving it from `confidence_score`.
- Do not include chain-of-thought, tool traces, or markdown outside the single JSON fence.
- One page of strokes deducts one page of quota on the Hub after success; keep the reply short.
