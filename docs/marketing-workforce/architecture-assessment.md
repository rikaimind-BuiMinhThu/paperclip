# Marketing Workforce — Architecture Assessment

**Date:** 2026-10-25  
**Scope:** Paperclip / Kujira AI Harness control-plane reuse for an AI Marketing Workforce  
**Phase:** 0 assessment + Phase 1 Discovery MVP design lock

## Executive summary

Paperclip already provides org hierarchy, issue trees, heartbeat execution, skills, thread interactions (questions/confirmations), approvals, documents/artifacts, and cost tracking. **Do not introduce a separate agent framework.**

| Layer | Reuse | Marketing gap |
|-------|-------|---------------|
| Org + hire | Partial — `reportsTo`, master hire, teams-catalog | Prompt’s 7-agent org ≠ current CMO team (writer/video/social) |
| Task execution | Yes — issues, checkout, heartbeat | Campaign templates |
| Interview UX | Yes — `ask_user_questions` | Adaptive one-question WF-01 skills |
| Artifacts | Yes — `issue_documents` + revisions | Keys `requirement_state`, `requirement_brief` |
| Approvals | Yes — checkbox confirmation + board approvals | Hard planning gate before confirmation |
| Workforce engine | Partial — sales outbound tools | Not used for Phase 1 |
| KB | Partial — documents/folders | No semantic brand RAG |

**Phase 1 packaging:** optional teams-catalog package `marketing-workforce` (leave WIP `master_agents` adapter/model changes alone).

---

## 1. Agent creation, hierarchy, delegation

**Sources:** `packages/db/src/schema/agents.ts`, `master_agents.ts`, `server/src/services/agents.ts`, `master-agents.ts`, `master-agent-catalog.ts`

**Reuse:** Partial. Hierarchy is `reportsTo`; delegation is issue assignment, not a separate API.

**Phase 1:** Ship Marketing Manager (+ six specialist scaffolds) via teams-catalog. Do not replace existing CMO master team.

**Risks:** Single-assignee tasks; template `role: "cmo"` on ICs in master catalog is misleading for specialists.

---

## 2. Runtime adapters

**Sources:** `packages/adapters/*`, `server/src/adapters/registry.ts`, `AGENT_ADAPTER_TYPES`

**Reuse:** Yes for LLM adapters. No marketing-specific adapter required in Phase 1.

**Risk:** Skill sync is adapter-dependent (`paperclipSkillSync.desiredSkills`).

---

## 3. Skills

**Sources:** `packages/skills-catalog/`, `packages/teams-catalog/.../skills/`, `company_skills`, adapter skill sync

**Reuse:** Partial. `SKILL.md` + company install is production-ready; marketing discovery skills are missing.

**Phase 1:** Six Manager skills under the team package (context retrieval, discovery, adaptive questions, gap analysis, brief generation, approval management).

---

## 4. Tasks / issues

**Sources:** `packages/db/src/schema/issues.ts`, `server/src/services/issues.ts`, heartbeat

**Reuse:** Yes. Campaign parent + child workflows map cleanly to issue trees.

**Note:** Issues have **no generic `metadata` column**. Phase 1 markers live in `executionPolicy.marketingWorkforce` (JSONB) plus document keys.

---

## 5. Workflow orchestration

**Sources:** `issue_relations` (`blocks`), `parentId`, pipelines, routines, `workforce` engine

**Reuse:** Partial. Use issue parent/blocks for marketing lifecycle. Workforce graph tools are sales-oriented — defer.

**Phase 1:** WF-01 only (interview → brief → confirm). WF-02…08 scaffolded in docs/package only.

---

## 6. Approvals / human-in-the-loop

**Sources:** `approvals`, `issue_approvals`, `issue_thread_interactions`, `APPROVAL_TYPES`

**Reuse:** Yes. Requirement confirmation uses `request_checkbox_confirmation` targeting `requirement_brief` (same pattern as first-task plan acceptance).

**Phase 1 hard gate:** Server rejects planning/research children (WF-02…08) under a campaign parent until an accepted confirmation targets `requirement_brief`.

---

## 7. Chat / conversation

**Sources:** `issue_comments`, task-chat UI, `ask_user_questions`

**Reuse:** Partial. Primary UX is task chat with the Marketing Manager. Numbered choices use question cards; chat replies (`1`, `1,3`, free-form) parsed in shared helpers.

---

## 8. Knowledge / documents / artifacts

**Sources:** `documents`, `issue_documents`, `issue_work_products`, `doc/AGENT-ARTIFACTS.md`

**Reuse:** Partial. Issue documents + revisions give versioning/resume for requirement state and brief. No new tables in Phase 1.

---

## 9. Tools / permissions / logs

**Sources:** `tool_access`, heartbeat run events, connections playbook

**Reuse:** Partial. No external marketing connectors in Phase 1; unauthorized publish/spend deferred to later phases with tool policies.

---

## 10. UI

**Sources:** Agents, MasterAgents, TeamCatalog, Workforce pages, task-chat interactions

**Reuse:** Partial. Phase 1 reuses question + confirmation cards. No Marketing Command Center.

---

## Component reuse matrix

| Capability | Verdict | Phase 1 action |
|------------|---------|----------------|
| teams-catalog install | Reuse | Add `marketing-workforce` |
| master marketing-team | Leave alone | Parallel path |
| content-machine | Leave alone | Optional later |
| first-task interview | Pattern reuse | New WF-01 skills |
| ask_user_questions | Reuse | One question/turn |
| issue documents | Reuse | `requirement_state`, `requirement_brief` |
| checkbox confirmation | Reuse | Brief approval |
| issue create | Extend | Planning gate |
| workforce engine | Defer | Phase 3+ |
| New DB migration | Avoid | None in Phase 1 |

---

## Proposed data model (Phase 1)

### Issue document `requirement_state` (JSON)

Logical fields: `workflowId` (`WF-01`), `status`, category objects, `questionHistory`, `researchRequired`, `decisionPending`, `nextQuestion`, `approvalStatus`, `version`.

Validated by `@paperclipai/shared` Zod schema `marketingRequirementStateSchema`.

### Issue document `requirement_brief` (Markdown)

Human-readable brief generated from state; confirmation targets a specific revision.

### `executionPolicy.marketingWorkforce`

```ts
{
  workflowId: "WF-01" | "WF-02" | ... | "WF-08",
  phase?: "discovery" | "planning" | "execution"
}
```

Stored on campaign parent (`WF-01` / discovery) and gated children (`WF-02`…`WF-08` or `phase: "planning"`).

---

## API changes (Phase 1)

- No new public routes.
- `POST /api/companies/:companyId/issues` (create): when `parentId` set and child is marketing planning/execution, call gate; fail **422** if brief not confirmed.
- Shared helpers exported from `@paperclipai/shared` for agents/UI/tests.

---

## UI changes (Phase 1)

None required if existing question/confirmation cards work. Fix only if broken.

---

## Migration plan

**Phase 1:** none.  
Later phases may add approval types or connectors; still prefer documents + executionPolicy over new tables until volume demands it.

---

## Test strategy

1. Shared unit: answer parse, adaptive next question, skip repeats, brief-ready, brief markdown.
2. Server unit/route: block planning child before confirm; allow after accepted confirmation.
3. Catalog: package validates and appears in generated manifest.
4. Manual smoke: install team → WF-01 issue → interview → brief → confirm → planning child.

---

## Implementation phases

| Phase | Scope | Status |
|-------|-------|--------|
| **0** | This assessment | Done |
| **1** | Manager + WF-01 + skills + gate + tests | Done |
| **2** | Research + Strategy agents, WF-02/03, plan approval | Done |
| **3** | Content + Channel, publish authorization | Done |
| **4** | Growth + Analytics, optimization | Done |

Phases 2–4 ship as skill packs + workflow TASK.md templates inside the same `marketing-workforce` team package, with server gates for `marketing_strategy` confirmation and `publish` / `spend` / `outbound` authorizations. External connectors remain policy-gated and return `not_configured` when credentials are missing.

---

## Risks and assumptions

1. Adaptive interview quality depends on LLM skill compliance; pure gap helpers reduce drift.
2. Operators must install `marketing-workforce` (separate from CMO master hire).
3. Skill sync requires Manager adapter support for `paperclipSkillSync`.
4. Issues lack generic metadata — markers use `executionPolicy.marketingWorkforce`.
5. Single-assignee model: campaign parent stays on Manager for Phase 1.
