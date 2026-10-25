---
name: Campaign Execution (WF-05)
slug: campaign-execution
description: WF-05 campaign preparation/execution child task.
assignee: channel-campaign
---

# WF-05 — Campaign Execution

Prepare publishing schedules and campaign drafts. Publish/spend only with authorization.

For publish: `externalAction: "publish"` and accepted `publish_authorization`.
For ads spend: `externalAction: "spend"` and accepted `spend_authorization`.
Set `executionPolicy.marketingWorkforce` accordingly with `workflowId: "WF-05"`.
