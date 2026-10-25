---
name: approval-management
description: Request human confirmation of the marketing requirement brief and interpret approve / request-changes / continue-interview outcomes.
slug: approval-management
tags:
  - marketing
  - discovery
  - approvals
---

# Approval Management (Requirement Brief)

## Trigger

After `requirement_brief` is written or revised.

## Required inputs

- Issue document `requirement_brief` with revision id
- Campaign issue id

## Instructions

1. Post `request_checkbox_confirmation` targeting the `requirement_brief` document revision.
2. Offer clear outcomes in the prompt:
   - Approve the brief (proceed to research/planning later)
   - Request changes (user will comment what to fix)
   - Continue interview (return to WF-01 questions)
3. Keep the issue `in_review` while pending. Set `requirement_state.approvalStatus` to `pending`.
4. On accept: set `approvalStatus: approved`, `status: confirmed`. Only then may WF-02…08 children be created (server enforces this).
5. On reject / changes: set `approvalStatus: changes_requested`, return to interviewing or revise the brief; do not create planning children.
6. Persist acceptance via the interaction APIs; do not treat a vague chat "ok" as approval when a confirmation card is still open — resolve the card (or use resolve-from-comment) first.

## Output contract

- Confirmation interaction
- Updated `requirement_state` approval fields

## Guardrails

- Rejecting must never silently unlock planning
- Do not publish, spend, or hire from this skill

## Completion

Brief confirmed, changes requested, or interview resumed.
