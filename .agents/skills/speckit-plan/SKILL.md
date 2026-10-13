---
name: speckit-plan
description: Подготовить технический план для English Daily Loop в рамках полного Spec Kit.
metadata:
  author: github-spec-kit
  source: templates/commands/plan.md
  adaptation: english-daily-loop
---

# plan

Применять к одной явно выбранной задаче English Daily Loop. Основной обзор и согласование ведутся в `D:\anastasiaStorage\Проекты\English daily loop\_work`; технический пакет в `specs/NNN-slug/`. Действующие правила: [AGENTS.md](../../../AGENTS.md), [конституция](../../../.specify/memory/constitution.md), [GIT_POLICY.md](../../../GIT_POLICY.md). Происхождение: [документ](../../../docs/spec-kit-provenance.md). Архив `docs/archive/pre-sdd` не задаёт текущий процесс.

Определи корень проекта по расположению этого SKILL.md: три уровня вверх. Папку фичи бери из задачи, а не из ветки или последнего каталога. Установи `SPECIFY_FEATURE_DIRECTORY` и передай её абсолютный путь как `-ExpectedFeatureDirectory` каждому скрипту в `.specify/scripts/powershell/`. Сверь успешный exit code и точное значение `FEATURE_DIR` до чтения или записи. Если задача неизвестна, уточни её. Скрипты работают локально без Git, сети и установок.

Точка согласования одна: пользователь утверждает основной обзор и назначает созданную ею ветку. После этого агент самостоятельно выполняет полный комплект, анализ, код и проверки. При новом существенном решении возвращается к пользователю; не запрашивает повторный допуск для каждой технической стадии. Для настоящего первого этапа меняются только Spec Kit и документация.

## Работа

Вызови `check-prerequisites.ps1 -RequireSpec`, затем `setup-plan.ps1` с явной папкой. При существующем plan не стирай содержание. По [шаблону](../../../.specify/templates/plan-template.md) детализируй архитектуру в согласованных границах, файлы и зависимости, назначенную ветку/remote, проверки, действия владельца, влияние на frontend, Edge Functions и Postgres. Создай research/data-model/contracts/quickstart только по применимости. Проверь C1–C8 и Git-политику. Не включай новые установки или миграции как разрешённые действия агента.
