# english-daily-loop

Telegram Mini App для ежедневной практики английского языка.

## Stack

- Vite
- React
- TypeScript
- Supabase local + Edge Functions
- OpenRouter для AI-генерации текстов

## Local Run

Prerequisites:
- Node.js
- pnpm
- Docker
- Supabase CLI

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Create `.env.local` from `.env.example` and fill required secrets.

3. Start local stack:
   ```bash
   npm run dev:all
   ```

`dev:all` starts the frontend, local Supabase, Edge Functions, Cloudflare tunnels,
DB/API logs, and prints a startup summary for Telegram Mini App testing.

