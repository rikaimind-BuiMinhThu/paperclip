---
name: competitor-profile-analysis
description: Profile key competitors: positioning, channels, messaging, and strengths/weaknesses.
slug: competitor-profile-analysis
tags:
  - marketing
  - research
---

# Competitor Profile Analysis

## Trigger
WF-02 Market Research tasks assigned to Market Research.

## Required inputs
- Confirmed `requirement_brief`
- Campaign constraints and target market

## Optional inputs
- Company brand/KB documents
- Prior `market_research.json`

## Instructions
1. Prefer authorized internal context and allowed web research.
2. Never invent statistics. Mark unknowns for `source-verification`.
3. Write outputs as issue documents / work products with the keys listed below.
4. Separate **verified facts**, **estimates**, and **hypotheses**.

## Output contract
- `market_report.md` and/or skill-specific JSON artifacts (`market_research.json`, `competitor_matrix.json`, `icp.json`, `sources.json` as applicable)
- Comment summarizing findings and open gaps

## Quality criteria
- Claims cite sources or are labeled estimate/hypothesis
- Aligns to the approved brief objective

## Guardrails
- No unauthorized scraping/login actions
- No outbound customer contact

## Completion
Artifacts saved and parent Manager notified.
