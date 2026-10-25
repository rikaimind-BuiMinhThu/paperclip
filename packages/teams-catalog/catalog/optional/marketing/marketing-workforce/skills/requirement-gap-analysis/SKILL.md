---
name: requirement-gap-analysis
description: Decide whether another interview question is needed, what is researchable, and when the requirement brief is ready.
slug: requirement-gap-analysis
tags:
  - marketing
  - discovery
  - analysis
---

# Requirement Gap Analysis

## Trigger

After every user answer during WF-01, and before brief generation.

## Required inputs

- Latest `requirement_state`
- Latest parsed answer

## Instructions

1. Update structured fields from the answer; never invent missing facts.
2. Identify missing **critical** categories: objectives, product, business_context, target_customers, success_criteria.
3. Detect conflicts (e.g. "no budget" vs "run paid ads") and ask a clarifying question or record a constraint.
4. Skip questions when:
   - Already answered
   - Reliable approved KB context exists
   - Authorized research can fill it (`research_required`)
   - Answer would not change the plan (`optional_unknown`)
5. If critical gaps remain → keep `status: interviewing` and select next question.
6. If critical gaps are satisfied → set `status: pending_confirmation` and stop interviewing.

## Output contract

- Patched `requirement_state`
- Decision: `ask_next` | `generate_brief` | `blocked`

## Guardrails

- Unknown ≠ filled; classify it
- Do not start planning from gap analysis

## Completion

State updated; Manager follows the decision.
