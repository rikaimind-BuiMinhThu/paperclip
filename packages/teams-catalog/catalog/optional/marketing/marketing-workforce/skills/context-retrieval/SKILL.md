---
name: context-retrieval
description: Load existing company and issue context before asking marketing discovery questions so the Manager does not re-ask known facts.
slug: context-retrieval
tags:
  - marketing
  - discovery
  - context
---

# Context Retrieval

## Trigger

Before the first WF-01 interview question, and again before generating the requirement brief.

## Required inputs

- Current campaign issue id
- Company id

## Optional inputs

- Prior approved `requirement_brief` documents on related issues
- Company folder documents (brand, ICP, product)

## Instructions

1. Read this issue’s documents, especially `requirement_state` and `requirement_brief`.
2. List company documents and fold reliable approved facts into `requirement_state` under the matching categories; mark `answeredCategories` for those facts.
3. Do not treat draft, speculative, or unapproved notes as facts.
4. If a fact would materially change the plan but is missing, leave it for interview or `research_required`.

## Tools

- Issue documents API
- Company documents / folders (read)

## Output contract

- Updated in-memory context summary for the Manager
- Optional patch to `requirement_state` when trusted facts were found

## Quality criteria

- No invented company facts
- No re-asking of facts already present in approved sources

## Guardrails

- Never write secrets into the brief
- Never mark a category answered from weak or conflicting sources

## Completion

Context pass finished; Manager proceeds to gap analysis or the next question.
