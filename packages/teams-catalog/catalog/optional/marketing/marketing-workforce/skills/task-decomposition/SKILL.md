---
name: task-decomposition
description: Break an approved marketing requirement or strategy into delegated child issues with clear owners, dependencies, and acceptance criteria.
slug: task-decomposition
tags:
  - marketing
  - manager
  - delegation
---

# Task Decomposition

## Trigger
After requirement brief confirmation, or after marketing strategy approval when expanding into execution work.

## Required inputs
- Approved `requirement_brief` (and `marketing_strategy` when past WF-03)
- Campaign parent issue id

## Instructions
1. Decompose into WF-aligned child issues (research, strategy, content, channel, growth, analytics, optimization).
2. Each child must set `executionPolicy.marketingWorkforce.workflowId` appropriately.
3. Link children with `parentId` and `blocks` relations when order matters (research before strategy; strategy before publish).
4. Write acceptance criteria and expected artifact document keys on each child.
5. Do not create publish/spend children with `externalAction` until authorizations exist.

## Output contract
- Child issues created and assigned
- Comment summarizing the decomposition graph

## Guardrails
- Never invent unapproved budget or publish permissions
- Keep user-facing conversation on the Marketing Manager parent issue

## Completion
All planned children exist with assignees and workflow markers.
