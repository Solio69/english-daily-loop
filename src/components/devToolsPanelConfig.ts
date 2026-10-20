import type React from 'react'
import {
  BookMarked,
  CalendarClock,
  RotateCcw,
  Trash2,
  WalletCards,
} from 'lucide-react'
import type { DevToolAction } from '../types/devTools'
import type { VocabularyReviewStep } from '../types/vocabulary'

export type SimpleDevToolAction = Exclude<
  DevToolAction,
  'complete_today_vocabulary_reviews_at_step'
>

export type DevToolIcon = React.ComponentType<{
  size?: number
  className?: string
}>

export const DEV_TOOL_BUTTONS: Array<{
  action: SimpleDevToolAction
  label: string
  description: string
  icon: DevToolIcon
}> = [
  {
    action: 'reset_generation_attempts',
    label: 'Сброс текстов',
    description: 'Обнуляет попытки генерации текстов за сегодня.',
    icon: RotateCcw,
  },
  {
    action: 'reset_vocabulary_card_attempts',
    label: 'Сброс AI-карточек',
    description: 'Обнуляет попытки генерации карточек словаря за сегодня.',
    icon: BookMarked,
  },
  {
    action: 'reset_vocabulary_review_progress',
    label: 'Сброс повторения',
    description: 'Возвращает готовые слова в начало алгоритма.',
    icon: RotateCcw,
  },
  {
    action: 'make_vocabulary_reviews_due_today',
    label: 'Слова на сегодня',
    description: 'Делает активные карточки доступными сегодня.',
    icon: CalendarClock,
  },
  {
    action: 'clear_today_vocabulary_review_completion',
    label: 'Открыть повторение',
    description: 'Удаляет отметку завершения повторения за сегодня.',
    icon: Trash2,
  },
  {
    action: 'delete_today_reading_completion',
    label: 'Удалить прочитанное',
    description: 'Удаляет прогресс дня и все тексты за сегодня.',
    icon: Trash2,
  },
  {
    action: 'reset_subscriptions',
    label: 'Сброс подписок',
    description: 'Удаляет активные и будущие подписки.',
    icon: WalletCards,
  },
]

export const REVIEW_STEP_OPTIONS: VocabularyReviewStep[] = [
  '1_day',
  '3_days',
  '7_days',
  '14_days',
  '1_month',
  '2_months',
  '3_months',
  '4_months',
  '5_months',
  '6_months',
]
