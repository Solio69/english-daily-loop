# Production environment

## Purpose

Этот документ фиксирует production env inventory для схемы `Supabase Cloud + Vercel`.

В файле хранятся только имена переменных, назначение и место хранения. Реальные значения секретов нельзя записывать в репозиторий, чат, screenshots или notes.

## Environment Split

```text
Vercel env:
  public frontend config for Vite build

Supabase Edge Function secrets:
  server-only secrets and feature gates
```

Переменные с префиксом `VITE_` попадают во frontend bundle и считаются публичными. Server secrets должны жить только в Supabase Edge Function secrets.

## Vercel Env

| Name | Required | Visibility | Purpose |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | yes | public | Production Supabase project URL, for example `https://<project-ref>.supabase.co`. |
| `VITE_SUPABASE_ANON_KEY` | yes | public | Production anon key used by frontend Supabase client. Access is still restricted by RLS/grants and Edge Function validation. |
| `VITE_FEEDBACK_TELEGRAM_USERNAME` | no | public | Telegram username for the settings feedback link, without `@`. Empty value hides the feedback link. |

Vercel build command:

```bash
pnpm build
```

Vercel output directory:

```text
dist
```

## Supabase Edge Function Secrets

| Name | Required | Visibility | Purpose |
| --- | --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | secret | Server-side OpenRouter API key for reading text and vocabulary card generation. |
| `TELEGRAM_BOT_TOKEN` | yes | secret | Server-side Telegram bot token for validating Mini App `initData` and sending/configuring bot replies through trusted server/owner tooling. |
| `TELEGRAM_BOT_WEBHOOK_SECRET` | yes | secret | Random 32–256 character secret used to authenticate Telegram webhook requests through `X-Telegram-Bot-Api-Secret-Token`. |
| `DEV_TOOLS_ENABLED` | yes | secret/config | Server-side gate for `dev-tools` actions. Keep `"false"` unless admin dev tools are intentionally allowed in production. |
| `SUBSCRIPTION_FLOW_ENABLED` | yes | secret/config | Server-side gate for hidden subscription activation flow. Keep `"false"` while payments are disabled. |
| `OPENROUTER_MODEL_CHAIN` | no | secret/config | Full allowlisted model chain for reading text generation. |
| `OPENROUTER_MODEL_PRIMARY` | no | secret/config | Optional additional model when full chain is not set. |
| `OPENROUTER_MODEL_FALLBACK` | no | secret/config | Optional additional model when full chain is not set. |
| `OPENROUTER_MODEL_TERTIARY` | no | secret/config | Optional additional model when full chain is not set. |

`SUPABASE_SERVICE_ROLE_KEY` must be available only server-side. In Supabase Edge Functions, verify how the production project exposes it before deploying functions that use service-role operations.

## Recommended MVP Values

```env
DEV_TOOLS_ENABLED="true"
SUBSCRIPTION_FLOW_ENABLED="false"
```

`DEV_TOOLS_ENABLED` is enabled for the first production testing period so the admin can use technical recovery/debug actions. This is temporary. Frontend visibility by role is not enough; server-side env and `users.app_role = 'admin'` must both pass.

After the first stable production run, revisit this value and either set:

```env
DEV_TOOLS_ENABLED="false"
```

or reduce production dev tools to a safer subset.

## Secrets Handling Rules

- Do not commit `.env.telegram.local` or any other file containing real environment values.
- Do not paste real secrets into notes, README, AGENTS, issue text or chat.
- Do not put `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_WEBHOOK_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` into Vercel `VITE_*` env.
- Production bot token and webhook secret are entered into `scripts/telegram/configure-production-bot.ps1` only through hidden prompts; never pass them as command arguments.
- Rotate secrets if they appear in git history, logs, screenshots or support reports.
- Use separate local and production values where possible.

## Production Setup Checklist

1. Create Supabase Cloud project and copy project URL.
2. Copy production anon key from Supabase API settings.
3. Add Vercel env:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_FEEDBACK_TELEGRAM_USERNAME`
4. Add Supabase Edge Function secrets:
   - `OPENROUTER_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_BOT_WEBHOOK_SECRET`
   - `DEV_TOOLS_ENABLED`
   - `SUBSCRIPTION_FLOW_ENABLED`
   - optional OpenRouter model variables
5. Deploy Edge Functions.
6. Deploy frontend.
7. Run production smoke checklist.

## Related Docs

- `notes/deployment-platform-decision.md`
- `.env.production.example`
- `.env.telegram.example`
- `notes/security-threat-model.md`
- `notes/server-side-data-guards.md`
- `docs/agents/LOCAL_TELEGRAM_RUN.md`
