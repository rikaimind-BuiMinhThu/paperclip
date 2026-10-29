---
name: cmo-campaign-planning
description: Ask clarifying questions first, then write a content×channel WBS issue plan with package components and final assemble deliverables, get plan confirmation, decompose to children, and request approval of final packages.
key: paperclipai/bundled/marketing/cmo-campaign-planning
recommendedForRoles:
  - marketer
  - manager
  - cmo
tags:
  - paperclip
  - marketing
  - planning
  - wbs
  - approval
---

# CMO campaign planning

Turn a marketing request into an executable Paperclip campaign: intake questions, a content×channel matrix, component WBS rows, one final assemble deliverable per channel placement, plan confirmation, then deliverable confirmation.

Use with `task-planning` for document/API mechanics. Prefer this skill’s templates over free-form plans for CMO work.

## When to use

- User asks to plan, launch, or run a campaign, GTM push, content series, or multi-channel marketing effort.
- CMO is assigned a vague idea and must clarify before committing work.
- Many Content Writer pieces must fan out to email, landing page, website, LinkedIn, or other channels.

## When not to use

- A single tiny copy tweak already fully specified — just execute.
- Non-marketing work (use plain `task-planning`).

## Hard rule: questions before plan

1. On a new or incomplete brief, post `ask_user_questions` immediately.
2. **Forbidden before answers (or an explicit user skip):** `PUT …/documents/plan`, creating child issues, assigning reports, starting publish work.
3. After answers, comment a short summary of what you learned, then write the plan.
4. Skip intake only when the same thread already includes: goal, audience, offer/product, channels, timeline, budget or “no budget”, and success metric. If anything material is missing, ask.

### Intake checklist

Cover at least:

1. **Goal** — leads, awareness, launch, retention, other
2. **Offer / product** — what is promoted; URL or one-liner
3. **Audience / ICP** — primary buyer; geo/language if relevant
4. **Channels** — email, landing page, website, LinkedIn, other social, SEO, paid, community, video
5. **Content volume** — how many distinct pieces, or “propose a set”
6. **Timeline** — start / launch / end, or “propose a 90-day roadmap”
7. **Budget / constraints** — band or hard limits; brand/legal must-haves
8. **Success metric** — one primary KPI
9. **Existing assets** — LP, brand kit, prior campaigns

Optional follow-ups: competitors, tone, exclusions, must-have vs nice-to-have channels per piece.

## Content × channel model

1. **Content piece** — one named source asset (e.g. pillar blog, LP section, nurture email). Owned by Content Writer (or Video Editor for video).
2. **Channel placement** — each matrix cell that is `adapt` or `publish` becomes WBS work that depends on the write/components for that Content ID.
3. Never one child for “write all campaign content” or “post everywhere”.

Cell values in the inventory matrix: `—` (out of scope), `adapt` (channel-specific rewrite), `publish` (ship that channel).

## Package components → final assemble

A website/LP (and many other channels) is **many component deliverables → one final deliverable**.

1. **Component rows** (Final?=no) — copy, images, alts, extras, SEO meta, etc.
2. **Final assemble row** (Final?=yes) — exactly one per Content ID × channel. Collects corresponding component deliverables, writes the assembled package doc, attaches/links every part, then publishes (or hands off for live publish).
3. Assemble owner must not invent missing parts. Incomplete components keep the assemble child blocked or returned to the component owner.
4. User approval of `campaign_deliverables` reviews **final packages**, each with a nested collected-component checklist.

Website package typically includes: body copy, hero/inline images, alt text, SEO title/meta, CTA, plus named extras (FAQ, form copy, …).

## Outputs

1. Issue document `plan` using the template below (required sections filled; empty WBS forbidden).
2. Comment linking `#document-plan` and naming the next action.
3. `request_confirmation` on the latest `plan` revision; issue `in_review`. No children until accepted.
4. After accept: one child issue per WBS row; `blockedByIssueIds` from Depends on; assignee by Owner role.
5. When channel work finishes: issue document `campaign_deliverables` + `request_confirmation` before done / live publish authorization.

Fold useful outputs from `marketing-plan`, `content-strategy`, `product-marketing`, and `launch` into the **issue** `plan` — do not stop at filesystem-only or chat-only plans.

## Locked issue `plan` template

```markdown
# Campaign plan

## Goal
One paragraph: what success looks like for the user/org.

## Context collected
- Answers from intake (goal, product, audience, channels, timeline, budget, KPI, assets)
- Other sources read (product-marketing doc, links, prior issues)

## Constraints and non-goals
- Must hold: …
- Will not do: …

## Schedule (phases)
| Phase | Window | Focus |
|-------|--------|--------|
| P1 | W1–W2 | Unblock / discovery |
| P2 | W3–W4 | Write source content |
| P3 | W5–W8 | Adapt + publish per channel |
| P4 | W9–W12 | Amplify / measure |

## Content inventory × channels
| Content ID | Piece (source deliverable) | Writer role | Email | Landing page | Website | LinkedIn | Other |
|------------|----------------------------|-------------|-------|--------------|---------|----------|-------|
| C1 | … | Content Writer | — / adapt / publish | … | … | … | … |

## Package components (per content × channel)
| Content ID | Channel | Component | Format | Owner role | WBS ID | Final? |
|------------|---------|-----------|--------|------------|--------|--------|
| C1 | Website | Body copy | md/HTML | Content Writer | 2.1 | no |
| C1 | Website | Hero image | PNG/WebP | Content Writer | 2.1a | no |
| C1 | Website | Alt text | md | Content Writer | 2.1b | no |
| C1 | Website | Other parts | md | Content Writer | 2.1c | no |
| C1 | Website | SEO title + meta | md | SEO Specialist | 3.1a | no |
| C1 | Website | **Final page package** | doc + URL | SEO Specialist | 3.1 | **yes** |

## Work breakdown (WBS)
| ID | Phase | Action | Deliverable | Owner role | Depends on | Acceptance criteria |
|----|-------|--------|-------------|------------|------------|---------------------|
| 2.1 | P2 | Write C1 copy | `C1-copy.md` | Content Writer | — | Component ready |
| 2.1a | P2 | Create C1 images | image files | Content Writer | — | Component ready |
| 3.1 | P3 | Assemble + publish C1 website | `C1-website-final` + URL | SEO Specialist | 2.1, 2.1a, … | Final collects all components |

## Risks and mitigations
- …

## Out of scope / deferrals
- …
```

### Final assemble document shape

Paste into the final child’s deliverable (e.g. `C1-website-final`):

```markdown
# C1 Website final deliverable

## Collected from
| WBS ID | Component | Link |
|--------|-----------|------|
| 2.1 | Body copy | … |
| 2.1a | Images | … |

## Assembled page
… merged content ready for CMS / live …

## Live
URL: …
```

Child descriptions for assemble rows must include the package checklist and: collect and write from corresponding deliverables only.

## Locked `campaign_deliverables` template

```markdown
# Campaign deliverables for approval

## Summary
One paragraph: what was produced vs the approved plan.

## Final packages for approval
| Content ID | Channel | Final WBS | Final deliverable | Components collected | Live URL | Status |
|------------|---------|-----------|-------------------|----------------------|----------|--------|
| C1 | Website | 3.1 | `C1-website-final` | 2.1, 2.1a, 2.1b, 2.1c, 3.1a | … | ready |

### C1 Website — collected components
| WBS ID | Component | Link |
|--------|-----------|------|
| 2.1 | Body copy | … |
| 2.1a | Images | … |

## Ask
Approve these **final** packages (each is the roll-up of its corresponding deliverables) to close the campaign or request changes.
```

## Filing APIs (reminder)

- `PUT /api/issues/{issueId}/documents/plan` (include `baseRevisionId` when updating)
- `POST /api/issues/{issueId}/comments` with `/<prefix>/issues/<id>#document-plan`
- Plan approval: `POST /api/issues/{issueId}/interactions` with `kind: request_confirmation`, target = latest `plan` revision, `idempotencyKey: confirmation:{issueId}:plan:{revisionId}`, `continuationPolicy: wake_assignee`
- Deliverable approval: same pattern on document key `campaign_deliverables`
- Set issue `in_review` while a confirmation is pending

## Anti-patterns

- Writing a plan before intake questions
- Chat-only “looks good” instead of `request_confirmation`
- Children before plan accept
- One mega content or publish-everywhere child
- Marking a channel done on a component row alone
- Final assemble without collecting every Depends-on component
- Approving leaf files instead of final packages
- Filesystem-only marketing-plan output with no issue `plan`
