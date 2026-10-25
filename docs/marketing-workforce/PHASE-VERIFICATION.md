# Marketing Workforce — Phase verification

Checked against the original Definition of Done.

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Request marketing objective via chat with Manager | OK — Manager agent + WF-01 skills |
| 2 | Adaptive interview starts | OK — `requirement-discovery` / `adaptive-question-generation` |
| 3 | Numbered options | OK — `ask_user_questions` + skill instructions |
| 4 | Number / free-form / unknown answers | OK — shared `parseInterviewAnswer` + tests |
| 5 | Interview state persists | OK — `requirement_state` issue document |
| 6 | Requirement brief generated | OK — `requirement_brief` + generator helper |
| 7 | Approve / request changes | OK — `approval-management` + checkbox confirmation |
| 8 | Planning blocked until confirmation | OK — server gate 422 |
| 9 | Research/Strategy receive delegated tasks | OK — agents + WF-02/03 tasks + skills |
| 10 | Agents execute configured skills | OK after install + `/skills/sync` |
| 11 | Structured artifacts | OK — document keys in skills/tasks |
| 12 | Marketing plan approval | OK — `marketing_strategy` gate for WF-04…08 |
| 13 | Unauthorized external actions blocked | OK — publish/spend/outbound gates |
| 14 | Workflow/cost observability | OK — existing Paperclip runs/costs |
| 15 | Reuse Paperclip primitives | OK — no separate agent framework |

## Local company checklist (Test / TES)

1. Team package installed (`paperclipai/optional/marketing/marketing-workforce`)
2. Company skills include all 48 workforce skills
3. Primary agents (exact names, not `* 2` duplicates) have `desiredSkills` synced
4. Gate tests pass:

```sh
pnpm exec vitest run packages/shared/src/validators/marketing-requirement.test.ts \
  server/src/services/marketing-workforce-gate.test.ts \
  server/src/__tests__/marketing-workforce-gate.test.ts
pnpm --filter @paperclipai/teams-catalog test
```

## Known limitations

- Team Catalog UI route may 404; install via API
- Safe import forbids `collisionStrategy: replace` — use `skip` then sync agent skills
- External Meta/Google/CRM connectors return `not_configured` until credentials exist
- Duplicate agents named `… 2` may appear after reinstall with skip; use the unnumbered originals
