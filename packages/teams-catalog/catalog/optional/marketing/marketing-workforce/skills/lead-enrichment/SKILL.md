---
name: lead-enrichment
description: Enrich leads when CRM/enrichment tools are configured; otherwise mark unavailable.
slug: lead-enrichment
tags:
  - marketing
  - growth
---

# Lead Enrichment

## Trigger
WF-06 Lead Generation tasks.

## Required inputs
- Approved ICP / qualification criteria
- Privacy/consent constraints from the brief

## Instructions
1. Respect data privacy and consent; never fabricate personal data.
2. Deduplicate before CRM writes.
3. Outbound customer messages require `externalAction: outbound` authorization.
4. If CRM/enrichment APIs are missing, return `not_configured` with the expected interface fields.

## Output contract
- Lead lists / scores / segments as documents or structured JSON
- CRM sync result or unavailable state

## Guardrails
- No unauthorized outbound
- No silent CRM overwrites of protected fields

## Completion
Lead workflow artifacts saved and Manager notified.
