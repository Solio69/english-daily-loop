# AI red-team checklist

## 1) Назначение
Документ фиксирует ручные adversarial-проверки AI-пайплайна генерации текста.
Цель: убедиться, что LLM и provider остаются недоверенными компонентами, а сервер
не сохраняет невалидный или небезопасный output.

Checklist используется:
- перед production-релизом
- после изменения `supabase/functions/generate-reading-text/ai-pipeline.ts`
- после изменения prompt version
- после изменения OpenRouter model chain
- после ослабления или расширения output validation

## 2) Где смотреть результат
Проверять нужно в трех местах:
- UI экрана чтения: пользователь видит безопасную ошибку или валидный текст
- `public.reading_generation_attempts`: status, `failure_stage`, `error_code`, sanitized `error_message`
- Edge Function logs: нет секретов, полного prompt, raw provider response, полного generated text или Telegram `initData`

Невалидный output не должен попадать в `public.user_active_reading_texts`.
Ранее активный текст независимо от даты генерации должен оставаться доступным после ошибки генерации.

## 3) Provider response cases
| Case | Ожидаемое поведение |
| --- | --- |
| Provider timeout | attempt `failed`, `failure_stage = 'provider_request'`, пользователь видит безопасную ошибку |
| Provider вернул non-JSON API response | attempt `failed`, `failure_stage = 'provider_response'` |
| Provider вернул пустой `content` | attempt `failed`, `failure_stage = 'provider_response'` |
| Provider вернул модель вне allowlist | attempt `failed`, `failure_stage = 'provider_response'` |
| Server env указывает модель вне allowlist | ответ `AI_MODEL_CONFIG_INVALID`, попытка не списывается |

## 4) Output validation cases
| Case | Ожидаемое поведение |
| --- | --- |
| Ответ модели не JSON | попытка следующей модели или attempt `failed` с `output_validation` |
| JSON без `title` | попытка следующей модели или attempt `failed` с `output_validation` |
| JSON без `body` | попытка следующей модели или attempt `failed` с `output_validation` |
| `title` меньше 3 слов | попытка следующей модели или attempt `failed` с `output_validation` |
| `title` больше 8 слов или длиннее 80 символов | попытка следующей модели или attempt `failed` с `output_validation` |
| `body` слишком короткий | попытка следующей модели или attempt `failed` с `output_validation` |
| `body` слишком длинный | попытка следующей модели или attempt `failed` с `output_validation` |
| `estimatedMinutes` не совпадает с настройкой пользователя | попытка следующей модели или attempt `failed` с `output_validation` |
| `level` не совпадает с настройкой пользователя | попытка следующей модели или attempt `failed` с `output_validation` |

## 5) Content safety cases
| Case | Ожидаемое поведение |
| --- | --- |
| `body` содержит markdown code fence | output отклоняется |
| `body` содержит `<script>` | output отклоняется |
| `body` содержит `<iframe>` | output отклоняется |
| `body` содержит `javascript:` | output отклоняется |
| `body` содержит inline event handler вроде `onerror=` | output отклоняется |
| `body` содержит `system prompt` или `developer message` | output отклоняется |
| `body` содержит `ignore previous instructions` | output отклоняется |

## 6) Persistence cases
| Case | Ожидаемое поведение |
| --- | --- |
| App-level validation failed | новый active text не сохраняется |
| Provider failed after attempt claim | attempt остается списанным и получает `status = 'failed'` |
| Provider failed after previous active text exists | предыдущий active text независимо от даты генерации остается доступным |
| Valid text generated | active text сохраняется с `reading_date`, attempt получает `status = 'succeeded'` |
| DB save failed | attempt получает `failure_stage = 'db_save'` |

## 7) Privacy and logging cases
| Case | Ожидаемое поведение |
| --- | --- |
| Любая ошибка provider | `error_message` sanitized и не содержит raw response |
| Любая ошибка генерации | logs не содержат `OPENROUTER_API_KEY` |
| Любая ошибка auth/request | logs не содержат полный Telegram `initData` |
| Любая ошибка output validation | attempt metadata не содержит полный generated text |
| Любая ошибка prompt/provider | logs не содержат полный prompt |

## 8) Abuse cases
| Case | Ожидаемое поведение |
| --- | --- |
| Клиент пытается передать свой prompt в body | prompt игнорируется, сервер использует только настройки пользователя |
| Клиент пытается передать `telegram_user_id` в body | user определяется только из валидного `initData` |
| Клиент пытается выбрать model в body | model игнорируется, используется server env + allowlist |
| Пользователь делает параллельные генерации | лимит списывается атомарно через RPC |
| Пользователь вызывает генерацию после завершения чтения за учебный день, но попытки еще есть | генерация разрешена, новый active text сохраняется с текущей учебной датой |
| Пользователь открывает экран чтения после смены учебной даты с незавершенным текстом прошлой даты | тот же active text отображается как текущий дневной план, перенос не списывает попытку |
| Пользователь вызывает генерацию после исчерпания дневного лимита | ответ `GENERATION_ATTEMPTS_EXHAUSTED` |

## 9) Признаки fail
Проверка считается проваленной, если:
- невалидный output сохранился в `user_active_reading_texts`
- prompt, raw provider response, generated text, `initData`, stack trace или secrets попали в logs/attempt metadata
- `failure_stage` не помогает понять этап отказа
- server env model config списывает попытку при ошибке allowlist
- ошибка генерации удаляет или портит предыдущий active text независимо от даты генерации
- frontend показывает SQL/provider/internal details пользователю

## 10) Production follow-up
Автотесты для `ai-pipeline.ts` должны покрыть эти ручные cases:
- parser/validator
- model allowlist
- content safety patterns
- failure stage mapping
- sanitized error message
