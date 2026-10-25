---
name: requirement-brief-generation
description: Generate requirement_brief.md from requirement_state for human confirmation before any marketing planning.
slug: requirement-brief-generation
tags:
  - marketing
  - discovery
  - artifacts
---

# Requirement Brief Generation

## Trigger

When gap analysis reports the brief is ready (`pending_confirmation`).

## Required inputs

- `requirement_state` with critical categories satisfied or classified

## Instructions

1. Generate markdown covering: business goal, product, target market/ICP, current situation, budget, timeline, success criteria, constraints, assumptions, research gaps, decisions pending, automation permissions.
2. Use shared `generateRequirementBriefMarkdown` semantics when available — unknowns stay listed as gaps, never filled with guesses.
3. Save as issue document key `requirement_brief` (new revision).
4. Hand off to `approval-management` for confirmation.

## Output contract

- Document `requirement_brief` (markdown)
- Comment summarizing that planning is blocked until confirmation

## Quality criteria

- Readable by a non-technical operator
- Explicit gaps and pending decisions

## Guardrails

- Do not create planning children here
- Do not claim confirmation until the user accepts

## Completion

Brief document saved; approval skill runs next.
