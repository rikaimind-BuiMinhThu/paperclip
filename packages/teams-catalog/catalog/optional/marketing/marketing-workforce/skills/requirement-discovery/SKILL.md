---
name: requirement-discovery
description: Run WF-01 Requirement Discovery — interview the user until critical marketing requirements are collected, then stop for brief confirmation.
slug: requirement-discovery
tags:
  - marketing
  - discovery
  - interview
---

# Requirement Discovery (WF-01)

## Trigger

User asks for marketing help, a campaign, GTM, leads, or awareness without an approved requirement brief on this issue.

## Required inputs

- User request text
- Campaign issue with `executionPolicy.marketingWorkforce.workflowId = "WF-01"`

## Optional inputs

- Existing `requirement_state` document (resume)

## Instructions

1. Create or load `requirement_state` (`schema: paperclip.marketing_requirement_state.v1`, status `interviewing`).
2. Run one adaptive question per turn (see `adaptive-question-generation`).
3. Parse answers including numbered choices (`1`, `1,3`), free-form, "I don't know", and "Recommend the best option". Prefer shared helpers when available (`parseInterviewAnswer` / `applyInterviewAnswer` semantics).
4. Classify unknowns as `research_required`, `decision_pending`, or `optional_unknown`. Never invent answers.
5. Persist `requirement_state` after every turn (document revisions provide history).
6. When critical categories are satisfied, switch to brief generation — do not keep interviewing for curiosity.

## Categories

1. Business context  
2. Product or service  
3. Objectives  
4. Target customers  
5. Current marketing situation  
6. Budget and resources  
7. Timeline  
8. Success criteria / KPIs  
9. Constraints and risks  
10. Automation permissions  

Critical for brief: objectives, product, business_context, target_customers, success_criteria.

## Output contract

- Versioned `requirement_state` JSON document
- Status transitions: `interviewing` → `pending_confirmation` → `confirmed` (after approval skill)

## Guardrails

- Do not create WF-02…08 children during discovery
- Do not produce a full marketing plan in this skill
- Do not ask all questions at once

## Completion

Brief is ready for confirmation, or the user cancelled / requested restart.
