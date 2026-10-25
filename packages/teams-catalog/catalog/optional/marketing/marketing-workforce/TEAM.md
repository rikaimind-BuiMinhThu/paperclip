---
name: Marketing Workforce
description: Hub-and-spoke marketing organization led by a Marketing Manager covering discovery through research, strategy, content, campaigns, growth, analytics, and optimization.
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
  - skills/adaptive-question-generation/SKILL.md
  - skills/ads-campaign-setup/SKILL.md
  - skills/approval-management/SKILL.md
  - skills/blog-writing/SKILL.md
  - skills/budget-planning/SKILL.md
  - skills/campaign-monitoring/SKILL.md
  - skills/campaign-roi-analysis/SKILL.md
  - skills/channel-strategy/SKILL.md
  - skills/competitor-discovery/SKILL.md
  - skills/competitor-profile-analysis/SKILL.md
  - skills/content-planning/SKILL.md
  - skills/content-quality-review/SKILL.md
  - skills/context-retrieval/SKILL.md
  - skills/crm-sync/SKILL.md
  - skills/customer-painpoint-analysis/SKILL.md
  - skills/data-collection/SKILL.md
  - skills/email-campaign-execution/SKILL.md
  - skills/email-copywriting/SKILL.md
  - skills/funnel-analysis/SKILL.md
  - skills/gtm-planning/SKILL.md
  - skills/icp-builder/SKILL.md
  - skills/image-generation/SKILL.md
  - skills/kpi-definition/SKILL.md
  - skills/kpi-tracking/SKILL.md
  - skills/landing-page-copywriting/SKILL.md
  - skills/lead-capture/SKILL.md
  - skills/lead-enrichment/SKILL.md
  - skills/lead-nurturing/SKILL.md
  - skills/lead-scoring/SKILL.md
  - skills/lead-segmentation/SKILL.md
  - skills/market-overview-research/SKILL.md
  - skills/market-segmentation/SKILL.md
  - skills/market-trend-analysis/SKILL.md
  - skills/optimization-recommendation/SKILL.md
  - skills/performance-reporting/SKILL.md
  - skills/positioning-strategy/SKILL.md
  - skills/requirement-brief-generation/SKILL.md
  - skills/requirement-discovery/SKILL.md
  - skills/requirement-gap-analysis/SKILL.md
  - skills/seo-optimization/SKILL.md
  - skills/social-post-writing/SKILL.md
  - skills/social-publishing/SKILL.md
  - skills/social-scheduling/SKILL.md
  - skills/source-verification/SKILL.md
  - skills/task-decomposition/SKILL.md
  - skills/task-delegation/SKILL.md
  - skills/value-proposition-design/SKILL.md
  - skills/video-production/SKILL.md
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
  - research
  - strategy
  - content
  - growth
  - analytics
---

# Marketing Workforce

Hub-and-spoke marketing company package. The **Marketing Manager** is the only user-facing agent for intake. Specialists receive delegated child issues after the requirement brief is confirmed.

## Workflows

| ID | Workflow | Owner |
|----|----------|-------|
| WF-01 | Requirement Discovery | Marketing Manager |
| WF-02 | Market Research | Market Research |
| WF-03 | Marketing Strategy | Marketing Strategy |
| WF-04 | Content Production | Content and Creative |
| WF-05 | Campaign Execution | Channel and Campaign |
| WF-06 | Lead Generation | Growth and Lead Generation |
| WF-07 | Marketing Analytics | Marketing Analytics |
| WF-08 | Marketing Optimization | Marketing Analytics (+ Strategy) |

## Gates

- Planning children (WF-02…08) require confirmed `requirement_brief`
- Strategy activation requires confirmed `marketing_strategy`
- Publish / spend / outbound require matching authorization confirmations
- Missing external integrations must be reported as `not_configured`
