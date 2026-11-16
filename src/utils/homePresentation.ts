import { SHOW_VOCABULARY_CARD_APPROVAL_FLOW } from '../constants/vocabularyFeatures'
import type {
  LessonCurrentStep,
  LessonHomeStatus,
  ReadingHomeStatus,
  ReviewHomeStatus,
} from '../types/homeProgress'
import type { VocabularyState } from '../types/vocabulary'
import {
  getReviewProgressPresentation,
  type HomeProgressStepState,
} from './homeProgressPresentation'
import { getRussianPlural } from './russianPlural'

export type ReadingChipState = 'completed' | 'in_progress' | 'idle'

const WORD_FORMS = ['слово', 'слова', 'слов'] as const
const VOCABULARY_APPROVAL_LABEL = ' Подтвердить'

const getReadingProgressStatus = (
  status: ReadingHomeStatus,
): HomeProgressStepState => {
  if (status === 'completed') return 'done'
  if (status === 'in_progress') return 'in_progress'
  return 'not_started'
}

const getReadingChipState = (status: ReadingHomeStatus): ReadingChipState => {
  if (status === 'completed') return 'completed'
  if (status === 'in_progress') return 'in_progress'
  return 'idle'
}

const getLessonDescription = ({
  lessonStatus,
  lessonCurrentStep,
  reviewDueCount,
}: {
  lessonStatus: LessonHomeStatus
  lessonCurrentStep: LessonCurrentStep
  reviewDueCount: number
}): string => {
  if (lessonStatus === 'completed') return 'Сегодняшний урок завершен.'
  if (lessonCurrentStep === 'reading') {
    if (lessonStatus === 'in_progress') {
      return 'Урок начат. Вернись, чтобы закончить чтение.'
    }
    return 'Начни урок с чтения текста.'
  }
  if (reviewDueCount > 0) {
    return `Осталось повторить ${reviewDueCount} ${getRussianPlural(reviewDueCount, WORD_FORMS)}.`
  }
  return 'Повтори слова, чтобы закрыть урок.'
}

export const getVocabularyTile = ({
  state,
  isLoading,
}: {
  state: VocabularyState | null
  isLoading: boolean
}): { text: string; isAttention: boolean; lines: string[] } => {
  let text: string
  let isAttention = false
  if (isLoading) {
    text = 'Проверяем словарь'
  } else if (!state) {
    text = 'Словарь доступен'
  } else {
    const needsApprovalCount = SHOW_VOCABULARY_CARD_APPROVAL_FLOW
      ? state.needsApprovalCount
      : 0
    if (state.pendingCount > 0 && needsApprovalCount > 0) {
      text = `Добавить: ${state.pendingCount} Подтвердить: ${needsApprovalCount}`
      isAttention = true
    } else if (state.pendingCount > 0) {
      text = `Добавить: ${state.pendingCount}`
      isAttention = true
    } else if (needsApprovalCount > 0) {
      text = `Подтвердить: ${needsApprovalCount}`
      isAttention = true
    } else {
      text = `В словаре: ${state.readyCount}`
    }
  }

  const lines =
    SHOW_VOCABULARY_CARD_APPROVAL_FLOW &&
    text.includes(VOCABULARY_APPROVAL_LABEL)
      ? text.replace(VOCABULARY_APPROVAL_LABEL, '\nПодтвердить').split('\n')
      : [text]
  return { text, isAttention, lines }
}

export const getHomePresentation = ({
  lessonStatus,
  lessonCurrentStep,
  readingStatus,
  reviewStatus,
  reviewDueCount,
  reviewReviewedTodayCount,
}: {
  lessonStatus: LessonHomeStatus
  lessonCurrentStep: LessonCurrentStep
  readingStatus: ReadingHomeStatus
  reviewStatus: ReviewHomeStatus
  reviewDueCount: number
  reviewReviewedTodayCount: number
}) => {
  const isLessonCompleted = lessonStatus === 'completed'
  const readingProgressStatus = getReadingProgressStatus(readingStatus)
  const readingChipState = getReadingChipState(readingStatus)
  const reviewProgress = getReviewProgressPresentation({
    status: reviewStatus,
    dueCount: reviewDueCount,
    reviewedTodayCount: reviewReviewedTodayCount,
  })
  const lessonButtonLabel =
    lessonStatus === 'in_progress' ? 'Продолжить' : 'Начать'
  const lessonDescription = getLessonDescription({
    lessonStatus,
    lessonCurrentStep,
    reviewDueCount,
  })
  const lessonDescriptionLines = lessonDescription.includes('. ')
    ? lessonDescription
        .split('. ')
        .map((line, index, lines) =>
          index < lines.length - 1 ? `${line}.` : line,
        )
    : [lessonDescription]

  return {
    isLessonCompleted,
    readingProgressStatus,
    readingChipState,
    reviewProgress,
    lessonButtonLabel,
    lessonDescriptionLines,
  }
}
