---
name: social-scheduling
description: Prepare social publishing schedules without posting unless preauthorized.
slug: social-scheduling
tags:
  - marketing
  - channel
---

# Social Scheduling

## Trigger
WF-05 Campaign Execution tasks.

## Required inputs
- Approved strategy / content drafts
- Explicit authorization for any publish or spend action

## Instructions
1. Prepare schedules, configs, and tracking plans first.
2. For publish/spend: require `executionPolicy.marketingWorkforce.externalAction` plus accepted confirmation targeting `publish_authorization` or `spend_authorization`.
3. If channel APIs (Meta, Google, ESP, CMS) are not configured, mark `not_configured` and stop before pretending success.
4. Log actions and artifact links on the issue.

## Output contract
- Publishing schedule / campaign draft / tracking config
- Or explicit unavailable state

## Guardrails
- Unauthorized publish/spend is forbidden
- Rejected approvals must not execute

## Completion
Prepared artifacts saved, or authorized action executed with evidence.
