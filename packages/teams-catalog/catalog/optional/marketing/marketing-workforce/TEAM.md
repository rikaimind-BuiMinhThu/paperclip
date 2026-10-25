---
name: Marketing Workforce
description: Hub-and-spoke marketing organization led by a Marketing Manager. Phase 1 ships Requirement Discovery (WF-01); specialists are scaffolded for later research, strategy, content, channel, growth, and analytics workflows.
schema: agentcompanies/v1
slug: marketing-workforce
category: marketing
key: paperclipai/optional/marketing/marketing-workforce
manager: agents/marketing-manager/AGENTS.md
includes:
  - agents/market-research/AGENTS.md
  - agents/marketing-strategy/AGENTS.md
  - agents/content-creative/AGENTS.md
  - agents/channel-campaign/AGENTS.md
  - agents/growth-lead-gen/AGENTS.md
  - agents/marketing-analytics/AGENTS.md
  - skills/context-retrieval/SKILL.md
  - skills/requirement-discovery/SKILL.md
  - skills/adaptive-question-generation/SKILL.md
  - skills/requirement-gap-analysis/SKILL.md
  - skills/requirement-brief-generation/SKILL.md
  - skills/approval-management/SKILL.md
  - projects/marketing-campaigns/PROJECT.md
defaultInstall: false
recommendedForCompanyTypes:
  - agency
  - marketing
  - startup
tags:
  - marketing
  - discovery
  - workforce
  - interview
---

# Marketing Workforce

Hub-and-spoke marketing company package. The **Marketing Manager** is the only user-facing agent for intake. Specialists receive delegated child issues after the requirement brief is confirmed.

## Phase 1 (current)

- WF-01 Requirement Discovery (adaptive interview → brief → human confirmation)
- Server gate blocks WF-02…08 children until `requirement_brief` is accepted

## Later phases

- WF-02 Research, WF-03 Strategy, WF-04 Content, WF-05 Campaign, WF-06 Growth, WF-07 Analytics, WF-08 Optimization
