# Backup and restore

## Назначение

Этот runbook описывает текущую стратегию резервного копирования и
восстановления English Daily Loop для схемы:

```text
Telegram Mini App
  -> Vercel frontend
  -> Supabase Edge Functions
  -> Supabase Postgres
```

Стратегия рассчитана на solo-разработчика, Free Plan Supabase и минимальные
регулярные расходы.

Целевые показатели:

- штатный `RPO`: `24 часа`;
- принятый деградированный `RPO`: до `72 часов`, если компьютер был выключен;
- `RTO`: `4 часа` при доступности локального snapshot, сервисных аккаунтов и
  production secrets.

Локальный backup не даёт жёсткой гарантии RPO: его выполнение зависит от
Windows-компьютера, Docker Desktop и интернета.

## Текущая стратегия

| Область | Решение |
| --- | --- |
| Supabase plan | Free Plan без platform-managed automatic backups |
| DB backup | Официальный Supabase CLI `db dump` |
| Расписание | Windows Task Scheduler, ежедневно в `20:00` |
| Пропущенный запуск | `StartWhenAvailable` при следующей доступной сессии |
| Retry | 3 повтора через 30 минут |
| Backup root | `D:\Backups\english-daily-loop\production` |
| Формат | Незашифрованные logical SQL dumps |
| Credential | Windows DPAPI, привязан к текущему Windows-пользователю |
| Retention | 7 последних snapshots + последние snapshots 4 завершённых ISO-недель |
| Restore | Только в отдельный Supabase recovery project |
| Drill | После настройки, ежеквартально и перед рискованными data changes |

Supabase рекомендует Free Plan проектам регулярно экспортировать данные через
`supabase db dump`. Платные Daily Backups и PITR не используются в текущем MVP.

## Ответственность

### Автоматизация

- запускает только `supabase db dump`;
- читает production БД и не выполняет DDL, DML, migrations, reset или seed;
- создаёт и проверяет локальные snapshot;
- применяет retention только после нового успешного snapshot;
- не выполняет restore или production cutover автоматически.

### Владелец проекта

- вводит database password через secure prompt;
- регистрирует Windows Scheduled Task;
- запускает первый production dump;
- создаёт временный recovery project;
- выполняет restore и validation только по одному согласованному шагу;
- задаёт recovery secrets и выполняет deploy;
- удаляет временный recovery project после drill.

### AI-агент

- поддерживает tooling, тесты и runbook;
- проверяет локальный код без production access;
- не получает значения secrets;
- не запускает production backup;
- не выполняет restore, migration, изменение DB data, deploy или Git-changing
  команды.

## Состав recovery kit

### Postgres snapshot

Каждый completed snapshot содержит:

```text
roles.sql
schema.sql
data.sql
history_schema.sql
history_data.sql
manifest.json
checksums.sha256
```

- `roles.sql` — роли Postgres без project-specific passwords;
- `schema.sql` — таблицы, functions/RPC, triggers, indexes, RLS и grants;
- `data.sql` — прикладные данные в COPY-формате;
- `history_schema.sql` и `history_data.sql` — Supabase migration history;
- `manifest.json` — безопасные metadata, row counts и tooling version;
- `checksums.sha256` — контроль случайной порчи SQL-файлов.

Manifest фиксирует локальный Git SHA backup tooling. Он не считается
production version: реально развернутый commit подтверждается по Vercel
production deployment и проверенному GitHub Release.

### Остальные части сервиса

- frontend, Edge Functions и migrations: GitHub repository;
- список Vercel env и Supabase secrets: `notes/production-env.md`;
- реальные secret values: частное хранилище владельца;
- production build SHA: Vercel deployment;
- Telegram entrypoint: production bot и BotFather menu button;
- OpenRouter: аккаунт и API key владельца.

Secrets, Supabase-generated keys и passwords не входят в SQL snapshot,
manifest, status или drill evidence.

Supabase Storage objects сейчас не используются. До первого production flow со
Storage эта стратегия должна быть дополнена отдельным backup объектов.

## Локальная структура

```text
D:\Backups\english-daily-loop\production\
  config\
    backup-config.json
    database-password.dpapi
  snapshots\
    2026-07-29T170000Z_ab12cd34\
    2026-07-29T170000Z_ab12cd34.partial\
  status\
    last-success.json
    last-failure.json
    backup.lock
  drills\
    2026-07-29_ab12cd34.validation.json
```

- `backup-config.json` содержит только несекретные локальные параметры;
- `database-password.dpapi` расшифровывается только тем же Windows-user;
- completed snapshot имеет имя без `.partial`;
- `.partial` не используется для восстановления;
- invalid snapshot не удаляется retention и остаётся для ручной диагностики.

Backup root находится вне Git и cloud sync. NTFS ACL оставляет Full Control
текущему Windows-пользователю и `SYSTEM`.

SQL snapshots временно хранятся незашифрованными по явному решению владельца.
Они могут содержать `telegram_user_id`, `first_name`, учебные данные и
пользовательский текст support reports. SQL-файлы нельзя прикладывать к issue,
чату, support report или screenshot.

## Первоначальная настройка

### Preconditions

- Windows;
- dependencies проекта уже установлены;
- репозиторий связан с production Supabase project;
- Docker Desktop установлен;
- production database password доступен владельцу;
- `D:\Backups\english-daily-loop\production` не находится в cloud sync.

Мы работаем с **production БД**. Setup и registration к БД не подключаются.
Первое подключение происходит только на шаге ручного read-only dump.

### 1. Создать config и DPAPI credential

```powershell
pnpm backup:setup
```

Команда:

- показывает linked project ref;
- просит повторить его для подтверждения production target;
- запрашивает database password скрытым вводом;
- создаёт backup root и owner-only ACL;
- сохраняет password через Windows DPAPI;
- не подключается к БД.

Если database password ротирован или репозиторий перемещён, credential и config
пересоздаются явным owner-действием:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/backup/initialize-production-backup.ps1 -RotateCredential
```

### 2. Зарегистрировать ежедневную задачу

```powershell
pnpm backup:schedule
```

Task:

- запускается от текущего Windows-user с `RunLevel Limited`;
- не хранит Windows password;
- работает только в интерактивной пользовательской сессии;
- запускается ежедневно в `20:00`;
- использует `StartWhenAvailable`;
- повторяется до трёх раз с интервалом 30 минут;
- не создаёт параллельные backup instances;
- разрешён при питании от батареи;
- ожидает доступную сеть.

Task не запускает Codex, ChatGPT или другого агента.

Существующий task заменяется только явной командой владельца:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/backup/register-production-backup-task.ps1 -Force
```

### 3. Создать первый production snapshot

```powershell
pnpm backup:production
```

Эта команда подключается к **production БД только для чтения**. Она:

1. проверяет Windows identity, config, linked project ref, executables и Docker;
2. расшифровывает database password только в памяти;
3. передаёт password дочернему процессу через `SUPABASE_DB_PASSWORD`;
4. последовательно вызывает пять `supabase db dump`;
5. создаёт `.partial`;
6. проверяет artifacts, row counts и SHA-256;
7. публикует completed snapshot;
8. обновляет status;
9. применяет retention.

Supabase CLI использует Docker для совместимого `pg_dump`. Первый запуск CLI
может потребовать получить используемый им Docker image; это действие выполняет
владелец, агент ничего не скачивает.

### 4. Проверить результат

```powershell
pnpm backup:status
```

Status:

- повторно проверяет пять SQL-файлов и SHA-256;
- не подключается к БД;
- показывает последний completed snapshot;
- возвращает `0` в штатном режиме;
- возвращает `2` при возрасте больше 24, но не больше 72 часов;
- возвращает `1` при возрасте больше 72 часов, отсутствии или повреждении
  snapshot.

## Ежедневный flow

```text
Windows Task Scheduler
  -> run-production-backup.ps1
  -> DPAPI decrypt in memory
  -> production-backup.ts
  -> Supabase CLI db dump
  -> .partial snapshot
  -> local validation
  -> completed snapshot
  -> status
  -> retention
```

Если компьютер выключен, Task Scheduler запускает пропущенную задачу при
следующей доступной пользовательской сессии. Если Docker или интернет
недоступны, completed snapshot не публикуется, старые snapshots не удаляются,
а безопасная ошибка записывается в `last-failure.json`.

Владелец запускает `pnpm backup:status`:

- минимум раз в неделю;
- перед migration или data cleanup;
- после длительного выключения компьютера;
- после rotation database password;
- после изменения backup tooling.

Migration, schema cleanup и другие изменения структуры не запускаются
одновременно с backup: пять CLI dumps выполняются последовательно. Перед такими
операциями владелец дожидается завершения snapshot и проверяет его status.

При миграции, которая добавляет или удаляет public table, server-only function,
critical index/trigger либо cron job, одновременно обновляются versioned
backup/recovery contract и его тесты. После изменения contract нужен новый
snapshot и recovery drill.

## Контракт ошибок

| Ошибка | Результат | Действие владельца |
| --- | --- | --- |
| Docker daemon недоступен | Backup прекращается до DB dump | Запустить Docker и повторить backup |
| Linked ref отличается | Backup прекращается до подключения | Проверить, какой Supabase project связан с repo |
| DPAPI credential не читается | Password не передаётся worker | Запустить setup под исходным Windows-user или пересоздать credential |
| Один dump завершился ошибкой | Остаётся `.partial`, retention не запускается | Проверить безопасное terminal message и повторить |
| Checksum/manifest невалиден | Completed snapshot не публикуется | Сохранить `.partial` для диагностики |
| Другой backup выполняется | Второй process останавливается | Дождаться текущего task |
| Backup старше 72 часов | Policy violation | Запустить manual backup и проверить status |

`last-failure.json` не содержит command arguments, connection string, database
password, bot token, OpenRouter key, service role key или DB row contents.

## Retention

После нового успешного snapshot сохраняются:

- 7 последних completed snapshots;
- последний completed snapshot каждой из 4 последних завершённых ISO-недель.

Один snapshot может одновременно входить в обе группы. Поэтому фактическое
количество каталогов обычно меньше 11.

Retention:

- не запускается после failed backup;
- игнорирует `.partial`;
- игнорирует symlink/junction;
- не удаляет invalid snapshot;
- не выходит за `snapshots` root;
- удаляет только каталог с completed name pattern.

## Когда нужен restore

### Backup не используется

- frontend regression без повреждения данных;
- Edge Function regression без повреждения данных;
- provider outage;
- schema issue, для которого безопасен forward-fix.

### Сначала нужен isolated restore

- случайно удалена часть пользовательских данных;
- неизвестен масштаб data corruption;
- production Supabase project потерян;
- нужно доказать, что snapshot восстанавливается;
- готовится рискованный contract cleanup.

Частичное повреждение данных не исправляется импортом полного старого dump
поверх production. Snapshot восстанавливается отдельно, после чего selective
repair получает собственный review и план.

## Recovery-drill

### Частота

- после первого successful production snapshot;
- один раз в квартал;
- после изменения snapshot format;
- перед физическим удалением совместимых columns;
- перед другим рискованным data/schema change, если соответствующий contract
  менялся после последнего drill.

### Preconditions

- свежий completed snapshot;
- свободный временный Supabase project slot;
- отдельный recovery Supabase project;
- target project ref, DB host, port и user из recovery connection settings;
- recovery database password;
- Docker Desktop;
- local Docker image `postgres:17`;
- доступ к GitHub, Vercel, Supabase, development bot и recovery-safe secrets.

Restore scripts используют `--pull=never` и сами ничего не скачивают. Если
official PostgreSQL 17 image отсутствует, владелец получает его отдельной
командой:

```powershell
docker pull postgres:17
```

Эта команда скачивает Docker image и не подключается к production БД.

### Target guard

До любого restore script проверяет:

- snapshot находится внутри configured `snapshots` root;
- snapshot completed и проходит SHA-256 validation;
- snapshot source ref совпадает с production config;
- target project ref отличается от production;
- target DB host/user не содержит production ref;
- direct host или pooler user согласован с recovery project ref;
- target host принадлежит домену Supabase.

Несовпадение прекращает процесс до password prompt и DB connection.

### Restore в отдельный project

Владелец запускает:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/backup/restore-recovery-snapshot.ps1 `
  -SnapshotPath "D:\Backups\english-daily-loop\production\snapshots\COMPLETED_SNAPSHOT_NAME" `
  -TargetProjectRef "RECOVERY_PROJECT_REF" `
  -TargetDbHost "RECOVERY_DB_HOST" `
  -TargetDbUser "RECOVERY_DB_USER" `
  -TargetDbPort 5432
```

Значения берутся только из временного recovery project. Password вводится
скрытым prompt и не входит в command arguments.

Restore:

1. применяет roles, закрывает default table privileges для
   `anon`/`authenticated`, восстанавливает schema и data в одной transaction;
2. отключает triggers на время загрузки data через
   `session_replication_role = replica`;
3. применяет migration history в отдельной transaction;
4. создаёт три recovery cron jobs по versioned definition;
5. оставляет recovery cron jobs `inactive`, чтобы drill не удалял
   восстановленные данные;
6. останавливается при первой SQL error.

Эта команда изменяет только явно указанный **recovery project**. Её нельзя
запускать с production connection parameters.

### Read-only DB validation

После restore владелец запускает:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/backup/validate-recovery-snapshot.ps1 `
  -SnapshotPath "D:\Backups\english-daily-loop\production\snapshots\COMPLETED_SNAPSHOT_NAME" `
  -TargetProjectRef "RECOVERY_PROJECT_REF" `
  -TargetDbHost "RECOVERY_DB_HOST" `
  -TargetDbUser "RECOVERY_DB_USER" `
  -TargetDbPort 5432
```

Validation выполняет только `SELECT` и проверяет:

- 13 public tables;
- row counts каждой таблицы по manifest;
- последнюю Supabase migration version;
- RLS на 12 protected tables;
- отсутствие table access у `anon` и `authenticated`;
- полный table access `service_role`;
- 11 required server-only functions и отсутствие client execute на всех
  functions в `public`;
- отсутствие execute у `anon` и `authenticated`;
- execute access `service_role`;
- `pgcrypto` и `pg_cron`;
- три inactive cron jobs и их расписание;
- критичные indexes и triggers;
- наличие public foreign keys.

Safe JSON result сохраняется в `drills`. Он содержит counts и schema metadata,
но не содержит row contents, Telegram ids или secrets.

### Full-service smoke

После DB validation:

1. подтвердить production Git commit по Vercel deployment и GitHub Release;
2. deploy Edge Functions из этого commit в recovery project с явным recovery
   project ref;
3. задать только recovery-safe secrets;
4. не задавать production bot token и production OpenRouter key;
5. подключить Vercel preview или локальную recovery-сборку;
6. открыть приложение через development bot;
7. проверить auth, reading, history, vocabulary, review и support report;
8. подтвердить, что новые тестовые записи появились только в recovery DB;
9. зафиксировать start/end time, фактические RPO/RTO, snapshot id и Git SHA;
10. удалить recovery project после сохранения evidence.

Production Vercel env и production BotFather URL во время drill не меняются.

## Реальное полное восстановление

Полное восстановление использует проверенный isolated recovery flow:

1. выбрать последний snapshot до момента incident;
2. восстановить и проверить новый Supabase project;
3. подтвердить совместимый stable Git commit;
4. создать project-specific Supabase URL и keys;
5. задать production Edge Function secrets из частного хранилища;
6. deploy Edge Functions;
7. переключить Vercel env и создать новый deployment;
8. выполнить production smoke;
9. изменить BotFather URL только при изменении frontend production URL;
10. включить три cron jobs только после проверки нового production target;
11. не удалять старый project до успешного smoke.

Production cutover, secrets, deploy и включение cron выполняются владельцем по
отдельно подтверждённой incident-процедуре. Этот runbook намеренно не содержит
автоматического in-place production restore.

## Residual risks

- одновременная потеря Supabase и локального диска делает recovery невозможным;
- SQL snapshots не зашифрованы;
- backup зависит от Windows-компьютера, Docker и интернета;
- local SHA-256 не защищает от человека, способного заменить snapshot и
  checksum одновременно;
- external alerts отсутствуют;
- RTO 4 часа подтверждается только фактическим drill.

Encryption и off-site copy пересматриваются до:

- первого копирования snapshot за пределы компьютера;
- появления более чувствительных пользовательских данных;
- существенного роста реальных пользователей;
- передачи доступа к backup другому человеку.

## Проверки tooling

Локальные проверки не подключаются к production:

```powershell
pnpm lint
pnpm test
pnpm build
pnpm release:check
```

`tests/productionBackup.test.ts` использует только temp fixtures и проверяет:

- COPY row-count parser;
- migration history parser;
- manifest и SHA-256;
- atomic publish и partial failure;
- retention;
- age thresholds;
- secret redaction;
- recovery target guard;
- recovery DB report;
- отсутствие production write commands;
- Scheduled Task contract;
- PowerShell parser.

## Official references

- Supabase Database Backups:
  https://supabase.com/docs/guides/platform/backups
- Supabase Backup and Restore using the CLI:
  https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- Supabase CLI database reference:
  https://supabase.com/docs/reference/cli/supabase-db
- Supabase Restore to a New Project:
  https://supabase.com/docs/guides/platform/clone-project
- Microsoft Task Scheduler `StartWhenAvailable`:
  https://learn.microsoft.com/en-us/windows/win32/taskschd/taskschedulerschema-startwhenavailable-settingstype-element
- Microsoft PowerShell DPAPI:
  https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/convertfrom-securestring
- Vercel environment variables:
  https://vercel.com/docs/environment-variables
- Telegram Mini Apps:
  https://core.telegram.org/bots/webapps
