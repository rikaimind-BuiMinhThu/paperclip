---
name: task-delegation
description: Assign marketing child issues to the correct specialist agent and wake them without exposing internal chatter in the main user chat.
slug: task-delegation
tags:
  - marketing
  - manager
  - delegation
---

# Task Delegation

## Trigger
When decomposed child issues need owners.

## Required inputs
- Child issue ids
- Specialist agent map (research, strategy, content, channel, growth, analytics)

## Instructions
1. Assign by role: Market Research → WF-02, Strategy → WF-03, Content → WF-04, Channel → WF-05, Growth → WF-06, Analytics → WF-07/08.
2. Wake assignees via assignment (heartbeat).
3. Post a short execution status message to the parent (task, agent, status) — not raw specialist transcripts.
4. On specialist completion, review artifacts before requesting human approvals for strategy/publish/spend.

## Output contract
- Assignees set
- Parent execution status comment

## Guardrails
- Do not reassign away from specialists without cause
- Do not auto-approve consequential actions

## Completion
Every open child has a specialist assignee or an explicit blocked reason.
