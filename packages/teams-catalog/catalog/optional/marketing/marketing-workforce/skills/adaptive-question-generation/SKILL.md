---
name: adaptive-question-generation
description: Ask one high-value numbered interview question per turn based on requirement gaps and primary objective.
slug: adaptive-question-generation
tags:
  - marketing
  - discovery
  - questions
---

# Adaptive Question Generation

## Trigger

During WF-01 when `requirement_state.status` is `interviewing` and the brief is not ready.

## Required inputs

- Current `requirement_state`
- Prior question history

## Instructions

1. Compute missing categories (prefer shared `selectNextInterviewQuestion` / gap analysis).
2. Ask **exactly one** primary question via `ask_user_questions`:
   - Prefer `single_select` or `multi_select` with numbered options
   - Include free-text "Other" when useful
   - Include "I don't know" and/or "Recommend the best option" when the user may not know
3. Objective-aware priority:
   - Lead generation → product, ICP, success criteria early
   - Brand awareness → business context, audience, success criteria early
4. Never repeat a question id already in `questionHistory` unless the user asked to edit that answer.
5. Accept chat replies: `1`, `2`, `1,3`, free-form, unknown, recommend.

## Output contract

- One posted `ask_user_questions` interaction
- Updated `nextQuestion` on `requirement_state`

## Quality criteria

- Options are mutually understandable
- Question depends on prior answers (not a fixed questionnaire dump)

## Guardrails

- Max one question card per turn
- Do not ask non-material optional questions before critical ones are done

## Completion

Question posted; wait for user answer before asking another.
