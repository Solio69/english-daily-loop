# Режим разработки / DX

## 1) Область документа
Документ фиксирует локальные режимы запуска приложения и dev-сценарии пользователей.

Production-цель приложения не меняется: приложение работает внутри Telegram Mini App.
Browser-режим нужен только для локальной разработки, быстрого UI/debug цикла и проверки
заранее подготовленных состояний.

## 2) Режимы запуска

### Telegram mode

Команда:

```bash
npm run dev:telegram
```

Что делает:
- запускает локальный Supabase;
- запускает Vite frontend;
- запускает Edge Functions;
- запускает Cloudflare tunnels для frontend и Supabase API;
- выключает `VITE_ENABLE_DEV_AUTH_FALLBACK`;
- обновляет `VITE_SUPABASE_URL` в `.env.local` на API tunnel URL;
- печатает URL для BotFather.

Этот режим нужен для production-like проверки:
- настоящий Telegram `initData`;
- реальный Telegram user;
- поведение внутри Telegram на телефоне;
- tunnel/BotFather flow.

### Browser scenario mode

Команда:

```bash
npm run dev:browser -- active-text
```

Что делает:
- запускает локальный Supabase;
- запускает Vite frontend;
- запускает Edge Functions;
- не запускает tunnels;
- включает `VITE_ENABLE_DEV_AUTH_FALLBACK`;
- ставит `VITE_SUPABASE_URL="http://127.0.0.1:55421"`;
- ставит `VITE_DEV_TELEGRAM_USER_ID` под выбранный сценарий.

Открывать:

```text
http://localhost:3000
```

Важно: browser mode не подменяет AI. `generate-reading-text` использует тот же
`OPENROUTER_API_KEY` и тот же серверный flow, что и Telegram mode.

## 3) Dev-сценарии

Сценарии создаются в `supabase/seed.sql`.

| Scenario | Telegram user id | Состояние |
| --- | ---: | --- |
| `fresh` | `999000001` | Новый пользователь без сохраненных настроек |
| `onboarded` | `999000002` | Настройки сохранены, первый текст еще не прочитан |
| `active-text` | `999000003` | Есть активный текст, чтение сегодня не завершено |
| `completed-today` | `999000004` | Чтение на сегодня уже завершено |
| `paid` | `999000005` | Активная MVP paid-подписка |
| `history` | `999000006` | Есть история прочитанных текстов |

Если сценарий не указан, используется `fresh`:

```bash
npm run dev:browser
```

## 4) Когда нужен reset локальной БД

Seed применяется при полном reset локальной базы:

```bash
npx supabase db reset
```

`db reset` пересоздает локальную БД, заново применяет миграции и затем выполняет
`supabase/seed.sql`. Текущие локальные данные при этом удаляются.

Reset нужен, когда нужно применить обновленный `supabase/seed.sql` или вернуться к базовому
состоянию dev-сценариев.

Новые миграции без пересоздания локальной БД применяются отдельно:

```bash
npx supabase migration up
```

## 5) Правила безопасности

- Dev fallback включается только в browser mode.
- Telegram mode всегда выключает dev fallback.
- Секреты остаются в `.env.local`.
- `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` не должны
  попадать во frontend-код и git.
