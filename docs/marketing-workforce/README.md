# Marketing Workforce

AI Marketing Workforce on Paperclip / Kujira AI Harness.

## Phase 1 — Discovery MVP (current)

- Install team package: `paperclipai/optional/marketing/marketing-workforce`
- User talks to **Marketing Manager**
- **WF-01 Requirement Discovery**: adaptive interview → `requirement_state` + `requirement_brief` → human confirmation
- Server blocks planning/research children (WF-02…08) until the brief is confirmed

See [architecture-assessment.md](./architecture-assessment.md).

## Smoke test (local)

1. `pnpm install` and `pnpm dev`
2. Install team key `paperclipai/optional/marketing/marketing-workforce` from Team Catalog
3. Create a campaign issue assigned to Marketing Manager with:
   `executionPolicy: { marketingWorkforce: { workflowId: "WF-01", phase: "discovery" } }`
4. Answer interview cards (or reply `1`, `1,3`, free-form, "I don't know")
5. Confirm the `requirement_brief` checkbox card
6. Creating a child with `workflowId: "WF-03"` fails with 422 until step 5, then succeeds

## Local tests

```sh
pnpm exec vitest run packages/shared/src/validators/marketing-requirement.test.ts \
  server/src/services/marketing-workforce-gate.test.ts \
  server/src/__tests__/marketing-workforce-gate.test.ts

pnpm --filter @paperclipai/teams-catalog test
```
