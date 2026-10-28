# Marketing Workforce

AI Marketing Workforce on Paperclip / Kujira AI Workforce.

## Status

Phases **0–4** are implemented as a teams-catalog package plus shared gate helpers.

| Phase | Scope |
|-------|--------|
| 0 | Architecture assessment |
| 1 | WF-01 Discovery MVP |
| 2 | Research + Strategy skills/workflows + strategy approval gate |
| 3 | Content + Channel skills/workflows + publish/spend authorization |
| 4 | Growth + Analytics skills/workflows + optimization |

## Install

Team key: `paperclipai/optional/marketing/marketing-workforce`

```sh
# Install / refresh package skills (skip existing agents/projects)
curl -X POST "http://127.0.0.1:3100/api/companies/<COMPANY_ID>/teams/catalog/paperclipai%2Foptional%2Fmarketing%2Fmarketing-workforce/install" \
  -H 'Content-Type: application/json' \
  -d '{"targetManagerAgentId":null,"collisionStrategy":"skip"}'
```

Then sync each specialist’s desired skills via `POST /api/agents/:id/skills/sync` with `{ "mode": "replace", "desiredSkills": [...] }` (see [PHASE-VERIFICATION.md](./PHASE-VERIFICATION.md)).

Skills appear under **Skills → Installed** after install. Team Catalog UI route may 404 in some builds; use the API. `collisionStrategy: replace` is rejected by safe import.

## Gates (server-enforced)

1. **Requirement brief** — required before WF-02…08 children  
2. **Marketing strategy** — required before WF-04…08 children  
3. **Publish / spend / outbound** — require matching `*_authorization` confirmations when `externalAction` is set  

## Smoke test (local)

1. `pnpm install` and `pnpm dev`
2. Install the Marketing Workforce team
3. Create campaign parent with `executionPolicy.marketingWorkforce = { workflowId: "WF-01", phase: "discovery" }`
4. Complete interview → confirm `requirement_brief`
5. Create WF-02 / WF-03 children (allowed)
6. Confirm `marketing_strategy`, then create WF-04+
7. Publish/spend children without authorization return **422**

## Local tests

```sh
pnpm exec vitest run packages/shared/src/validators/marketing-requirement.test.ts \
  server/src/services/marketing-workforce-gate.test.ts \
  server/src/__tests__/marketing-workforce-gate.test.ts
pnpm --filter @paperclipai/teams-catalog test
```

See [architecture-assessment.md](./architecture-assessment.md).
