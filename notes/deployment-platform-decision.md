# Deployment platform decision

## Decision

Для первого production-релиза используется связка:

```text
Frontend: Vercel
Backend/data: Supabase Cloud
AI provider: OpenRouter
Telegram entrypoint: BotFather menu button URL -> Vercel production URL
```

Это целевой путь для MVP. VPS/self-hosting остается возможным будущим вариантом, но не используется для первого релиза.

## Why This Path

Приложение уже построено вокруг Supabase:

- Postgres schema хранится в `supabase/migrations`
- серверная бизнес-логика находится в Supabase Edge Functions
- защищенные операции идут через `SUPABASE_SERVICE_ROLE_KEY`
- frontend работает через сервисный слой и не пишет напрямую в защищенные таблицы
- локальный Telegram-режим уже имитирует production-like схему: frontend build + Supabase API URL + Edge Functions

Vercel подходит для frontend-части, потому что Vite build является статическим приложением: `index.html`, JS, CSS, шрифты и assets. Telegram Mini App открывает этот HTTPS URL внутри WebView.

Supabase Cloud подходит для backend-части, потому что сохраняет текущую модель Postgres + Edge Functions без отдельного Express/Nest backend.

## Runtime Architecture

```text
Telegram Mini App
  -> opens Vercel HTTPS URL in Telegram WebView
  -> loads Vite/React frontend
  -> frontend reads Telegram.WebApp.initData
  -> frontend calls Supabase Edge Functions
  -> Edge Functions validate initData and use service role for server-side DB work
  -> Postgres stores users, settings, reading, vocabulary, review and support reports
```

## Deployment Surfaces

### Vercel

Vercel hosts only frontend assets.

Vercel env contains only public frontend variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_FEEDBACK_TELEGRAM_USERNAME`

Never put server secrets into Vercel `VITE_*` variables.

### Supabase Cloud

Supabase Cloud hosts:

- Postgres database
- RLS/grants/server-only RPC
- Edge Functions
- Edge Function secrets
- platform logs
- database backups

Supabase Edge Function secrets contain server-only values:

- `OPENROUTER_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `DEV_TOOLS_ENABLED`
- `SUBSCRIPTION_FLOW_ENABLED`
- optional OpenRouter model chain variables

## Deploy Order

1. Create or choose Supabase Cloud project.
2. Apply database migrations to Supabase Cloud.
3. Configure Supabase Edge Function secrets.
4. Deploy Supabase Edge Functions.
5. Create Vercel project from the repository.
6. Configure Vercel frontend env.
7. Deploy frontend to Vercel.
8. Set BotFather menu button URL to Vercel production URL.
9. Run production smoke checklist in Telegram.

## Region Choice

Supabase region should be chosen before creating the production project. For the MVP, prefer a stable European region available in the account, then verify real access from the target Telegram environment.

The final choice must be validated by opening the deployed Mini App from Telegram on the user's actual network.

## VPS / Self-hosting Position

VPS is not selected for the first release because it adds operational scope:

- server provisioning
- HTTPS certificates
- Docker/runtime updates
- firewall
- Postgres backups and restore drills
- monitoring and logs
- security patching

The app can move later if needed. The current codebase keeps that path realistic by keeping data access in services, business logic in Edge Functions/server code, migrations in files, and env outside code.

## Fallbacks

If Vercel is not usable from the target environment:

1. Keep Supabase Cloud for backend/data.
2. Move frontend to another HTTPS static hosting provider.
3. Update `VITE_SUPABASE_URL`, rebuild frontend and change BotFather URL.

If Supabase Cloud is not usable:

1. Re-evaluate managed Postgres + serverless functions alternatives.
2. Consider VPS/self-hosting as a separate infrastructure project.

## Open Questions Before First Deploy

- Which Supabase region is available and stable for the user's target environment?
- Which domain is used first: Vercel default domain or custom domain?
- Is the current Supabase plan enough for backups, `pg_cron` and expected usage?
- Is OpenRouter key usable from Supabase Edge Functions in the chosen region?

## Production Dev Tools

For the first production testing period, `DEV_TOOLS_ENABLED` is intentionally enabled:

```env
DEV_TOOLS_ENABLED="true"
```

Dev tools still require both gates:

- frontend renders the panel only for `appUser.role === "admin"`
- `supabase/functions/dev-tools` executes actions only when server env `DEV_TOOLS_ENABLED="true"` and `users.app_role = 'admin'`

This is a temporary launch/testing decision. Revisit it after the first stable production run and either disable dev tools in production or reduce the available production actions to a safer subset.

## Related Docs

- `notes/production-env.md`
- `notes/production-deploy-flow.md`
- `notes/production-readiness.md`
- `notes/server-side-data-guards.md`
- `notes/security-threat-model.md`
- `docs/agents/LOCAL_TELEGRAM_RUN.md`
