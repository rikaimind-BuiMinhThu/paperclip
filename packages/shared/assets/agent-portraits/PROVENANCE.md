# Agent portrait provenance (photo-v1)

These PNGs are **synthetic photoreal headshots** (AI-generated likenesses of
fictional people). They are not photographs of real individuals and contain no
third-party celebrity or known-person likenesses.

License: same as the Paperclip repository (MIT). Redistribute with the product.

Each file is named after an `AGENT_PALETTE_IDS` slot and is 512×512 PNG,
face-centered for circular crop at serve time. Muted presentation applies a
grayscale transform at serve time; there is no separate muted asset file.

Source generation: Cursor `GenerateImage` photoreal corporate headshots, then
resized with Sharp via a one-shot install into this folder. The older SVG
geometry script `scripts/generate-agent-portraits.mjs` is obsolete for product
pixels (kept only as a historical placeholder if present).
