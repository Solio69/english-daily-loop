---
name: english-daily-loop-support-triage
description: Analyze english-daily-loop support reports and production/local diagnostics. Use when Codex needs to inspect or explain entries from public.support_reports, correlate request_ids with Edge Function logs, triage AI generation failures, review safe AI diagnostics, or propose fixes from user-submitted error reports.
---

# English Daily Loop Support Triage

## Overview

Use this skill to triage user-submitted error reports for `english-daily-loop`. Keep the analysis read-only unless the user explicitly asks for a code fix after the diagnosis.

## Required Project Context

Before diagnosing, read the current project docs if they are available in the repo:

- `AGENTS.md`
- `notes/support-diagnostics.md`
- `notes/ai-observability-diagnostics.md` when AI diagnostics are present
- `notes/security-threat-model.md` when the report touches auth, secrets, access, or DB exposure

## Safety Rules

- Do not apply migrations or mutate DB data.
- Do not ask the user to paste Telegram `initData`, tokens, provider raw responses, full prompts, full generated texts, or secrets.
- Use read-only SQL only.
- Treat `public.support_reports` as sensitive operational data. Quote only the relevant fields in the answer.
- If you do not have DB access, ask the user for either the report id plus exported report row, or screenshots/SQL output from the read-only queries.

## Triage Workflow

1. Identify the report.
   - Prefer a concrete `support_reports.id`.
   - If there is no id, inspect the latest reports by `created_at`.

2. Read the report shape.
   - Check `user_comment`, `current_screen`, `created_at`, `request_ids`, `ai_diagnostics`, `events`, and `app_context`.
   - Note `telegram_user_id`, `app_role`, and effective access only as debugging context.

3. Classify the likely area.
   - Auth/bootstrap: `auth-telegram`, missing/expired initData, role/subscription summary.
   - Reading generation: `generate-reading-text`, OpenRouter, validation, active text persistence.
   - Vocabulary cards: `prepare-vocabulary-cards`, provider response, output validation, card persistence.
   - Review flow: `get-vocabulary-review-state`, `review-vocabulary-word`, counters/completion markers.
   - Client UI/state: screen events, repeated navigation, stale state, modal/form errors.
   - Local infrastructure: tunnel/API reachability, stale function bundle, missing migration.

4. Correlate evidence.
   - Use `request_ids` to search Edge/API logs.
   - Use `ai_diagnostics` to inspect stage/model/promptVersion safely.
   - Use attempt tables for AI failures:
     - `public.reading_generation_attempts`
     - `public.vocabulary_card_generation_attempts`

5. Produce a concise diagnosis.
   - Start with the likely cause.
   - Include evidence with field names and dates.
   - Separate confirmed facts from hypotheses.
   - Suggest the smallest safe next fix or next check.

## SQL Reference

Read `references/sql.md` for read-only queries. Use only the queries needed for the current report.

## Response Shape

Use this structure unless the user asks for another format:

- **Что видно:** short factual summary.
- **Вероятная причина:** one or two likely causes.
- **Доказательства:** report fields, request ids, AI stage/model, relevant attempt rows.
- **Что проверить дальше:** minimal next checks.
- **Что править:** proposed code/config/docs fix if enough evidence exists.
