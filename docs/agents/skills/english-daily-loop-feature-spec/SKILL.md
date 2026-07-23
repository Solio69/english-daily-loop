---
name: english-daily-loop-feature-spec
description: Create and refine project-specific feature specifications for english-daily-loop before coding. Use when Codex is asked to groom, analyze, formulate, document, or prepare a new product or technical feature; create or update a draft in the external feature folder; compare implementation options; ask product questions; define scope, technical plan, acceptance criteria, and a detailed manual test checklist. Do not use for bug triage, support-report diagnosis, or direct implementation.
---

# English Daily Loop Feature Spec

## Purpose

Turn a raw feature idea into a project-aware specification that the owner can approve before coding. Treat the external feature file as the canonical product and implementation brief. Do not change application code while grooming the feature.

## Required Context

Before writing the specification, inspect:

- `AGENTS.md`, `GIT_POLICY.md`, and `README.md`;
- relevant files in `notes/` and `docs/agents/`;
- `docs/agents/DESIGN_SYSTEM.md` for any user-facing UI change;
- relevant implementation, types, migrations, tests, and read-only Git context;
- existing feature drafts in `D:\anastasiaStorage\pet-projects\English daily loop\Фичи`.

Use `D:\anastasiaStorage\pet-projects\English daily loop\Фичи\Продумать flow версионирования и оформление release notes.md` as the current style example when available. Read `references/feature-template.md` before creating the draft and `docs/agents/references/manual-testing-guide.md` before writing its test checklist.

Do not invent current behavior. Verify it in code or documentation, and mark anything that cannot be verified as an open question or assumption.

## Scope Boundary

- Use this skill for new features and planned product or technical improvements.
- Use the separate bug workflow for bug cards and approved bug batches.
- Use the support-triage skill for submitted error reports and diagnostics.
- Do not implement code, install packages, apply migrations, mutate DB data, change secrets, deploy, or run Git-changing commands during feature grooming.
- Do not mark a feature ready for development without explicit approval from the project owner.

## Workflow

### 1. Investigate

Map the current behavior and affected surfaces before proposing a solution:

- user flow and navigation;
- frontend components, state, services, and shared types;
- Edge Functions, RPCs, tables, RLS, grants, limits, and dates when relevant;
- observability, support diagnostics, local development, deployment, and documentation;
- existing tests and likely regression areas.

Separate confirmed facts from inferences. Prefer existing project patterns over new abstractions.

### 2. Groom the Product Decision

- Explain at least two viable options when a meaningful tradeoff exists.
- State the advantages, disadvantages, and recommendation in project terms.
- Ask only questions that require a product decision or block a safe technical design. Resolve implementation details from the repository when possible.
- Format every unanswered owner question exactly like this:

```md
- Текст вопроса?
<mark>решение:</mark>
```

Do not hide unresolved decisions inside prose.

### 3. Create the Draft

Create or update:

`D:\anastasiaStorage\pet-projects\English daily loop\Фичи\<Название фичи>.md`

Rules:

- The filename is the visible title; do not duplicate it with an H1 inside the file.
- A new file starts with `Статус: черновик для согласования.`
- Follow `references/feature-template.md`, omitting only sections that are genuinely irrelevant.
- Preserve the owner's original intent, but rewrite ambiguous notes into testable behavior.
- Keep the document about the intended current solution, not a history of how proposals changed.

### 4. Make the Specification Verifiable

The draft must cover, when relevant:

- goal and current context;
- open product questions;
- considered options and recommendation;
- target user flow and states;
- frontend, backend, DB, security, and observability design;
- MVP boundaries, rollout, compatibility, and rollback;
- numbered implementation plan;
- acceptance criteria;
- automated checks;
- detailed manual test scenarios;
- actions that only the project owner may perform;
- official references for unstable external behavior.

Every acceptance criterion must map to an automated check, a manual scenario, or both. A one-line manual checklist is not sufficient.

### 5. Resolve and Approve

After the owner answers:

1. Fold each answer into the target behavior and technical solution.
2. Remove obsolete alternatives, placeholders, and resolved question blocks.
3. Recheck the plan, acceptance criteria, risks, and test scenarios for consistency.
4. Keep `Статус: черновик для согласования.` until the owner explicitly approves the whole feature.
5. On explicit approval, set `Статус: готово к разработке.`

Use these lifecycle values consistently:

- `черновик для согласования`;
- `готово к разработке`;
- `в разработке`;
- `готово к ручной проверке`;
- `проверено`.

Do not infer approval from silence or from an answer to only one open question.

### 6. Hand Off

When the project workflow requests it and the TickTick integration is available, sync the body into the same-named TickTick task. The Markdown file remains canonical; do not let the two copies diverge silently. If the integration is unavailable, report that clearly instead of claiming synchronization.

Finish by reporting:

- canonical file path;
- current status;
- unresolved decisions;
- owner-only actions;
- whether the specification is ready for development.

## Quality Gate

Before completing the grooming task, verify:

- current behavior and file names were checked against the repository;
- all acceptance criteria are testable and traceable;
- each manual scenario has preconditions, actions, and expected results;
- happy path, relevant failures, persistence/re-entry, permissions, and regressions are covered;
- responsive viewports and both themes are covered only when the feature affects UI;
- migration, secret, deployment, and data-change responsibilities are explicit;
- the file has no duplicate H1, unresolved placeholders, or stale alternatives presented as decisions;
- no product code or Git state was changed during grooming.
