---
name: data-collection
description: Collect available marketing metrics from configured analytics sources.
slug: data-collection
tags:
  - marketing
  - analytics
---

# Data Collection

## Trigger
WF-07 Analytics or WF-08 Optimization tasks.

## Required inputs
- KPI definitions from strategy
- Campaign/content identifiers

## Instructions
1. Pull from configured analytics connectors when available; otherwise use provided exports or mark `not_configured`.
2. Do not change live campaigns/spend outside approved optimization scope.
3. Save reports as `performance_report.md` / JSON metrics artifacts.
4. For WF-08, propose changes and only execute those already authorized.

## Output contract
- KPI dashboard notes / performance report / optimization recommendations

## Guardrails
- No unauthorized spend changes
- Label estimates vs measured values

## Completion
Report artifacts saved; Manager can brief the user.
