---
name: image-generation
description: Produce image briefs or generate images when a configured image tool exists; otherwise mark unavailable.
slug: image-generation
tags:
  - marketing
  - content
---

# Image Generation

## Trigger
WF-04 Content Production tasks.

## Required inputs
- Approved `marketing_strategy` (or Manager-confirmed strategy artifacts)
- Brand voice / constraints from brief

## Instructions
1. Create drafts and calendars as issue documents/attachments.
2. Run internal quality review before requesting publish approval.
3. If an external creative API/tool is not configured, set status `not_configured` and provide a brief/interface stub instead of faking delivery.
4. Never publish publicly from this skill.

## Output contract
- Content calendar and draft artifacts
- Quality review notes

## Guardrails
- No public posting
- No paid media spend

## Completion
Drafts ready for human or Manager approval.
