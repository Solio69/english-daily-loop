import type {
  PrepareVocabularyCardsResult,
  ReviewVocabularyWordResult,
  VocabularyReviewAction,
  VocabularyReviewCard,
  VocabularyReviewState,
  VocabularyReviewStep,
  VocabularyState,
  VocabularyWordCard,
  VocabularyWordsPage,
} from '../types/vocabulary'

const INVALID_RESPONSE_MESSAGE = 'Некорректный ответ сервера.'

export class InvalidVocabularyResponseError extends Error {
  constructor() {
    super(INVALID_RESPONSE_MESSAGE)
    this.name = 'InvalidVocabularyResponseError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string'

const REVIEW_STEPS: VocabularyReviewStep[] = [
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

const REVIEW_ACTIONS: VocabularyReviewAction[] = [
  'forgot',
  'same_step',
  'next_step',
  'jump_step',
]

const isReviewStep = (value: unknown): value is VocabularyReviewStep =>
  REVIEW_STEPS.some((step) => step === value)

const isWordStatus = (value: unknown): boolean =>
  value === 'not_started' || value === 'active' || value === 'learned'

const isVerbForms = (value: unknown): boolean =>
  value === null ||
  (isRecord(value) &&
    typeof value.base === 'string' &&
    typeof value.past === 'string' &&
    typeof value.pastParticiple === 'string')

const isWordCard = (value: unknown): value is VocabularyWordCard =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.word === 'string' &&
  typeof value.translation === 'string' &&
  typeof value.partOfSpeech === 'string' &&
  typeof value.isVerb === 'boolean' &&
  (value.isRegularVerb === null || typeof value.isRegularVerb === 'boolean') &&
  isVerbForms(value.verbForms) &&
  Array.isArray(value.examples) &&
  value.examples.every((example) => typeof example === 'string') &&
  isWordStatus(value.status) &&
  (value.cardStatus === 'ready' || value.cardStatus === 'needs_approval') &&
  (value.reviewStep === null || isReviewStep(value.reviewStep)) &&
  isNullableString(value.nextReviewDate) &&
  isNullableString(value.lastReviewedAt) &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string'

const hasReviewCardFields = (value: unknown): boolean => {
  if (!isRecord(value) || !Array.isArray(value.actions)) return false
  const actions: unknown[] = value.actions
  return (
    value.cardStatus === 'ready' &&
    isCount(value.reviewCount) &&
    typeof value.isOptional === 'boolean' &&
    actions.length === REVIEW_ACTIONS.length &&
    actions.every(
      (option) =>
        isRecord(option) &&
        REVIEW_ACTIONS.some((action) => action === option.action) &&
        typeof option.label === 'string',
    ) &&
    REVIEW_ACTIONS.every((action) =>
      actions.some((option) => isRecord(option) && option.action === action),
    )
  )
}

const isReviewCard = (value: unknown): value is VocabularyReviewCard =>
  isWordCard(value) && hasReviewCardFields(value)

export const isVocabularyState = (value: unknown): value is VocabularyState =>
  isRecord(value) &&
  isCount(value.pendingCount) &&
  isCount(value.needsApprovalCount) &&
  isCount(value.readyCount) &&
  isCount(value.totalCount) &&
  isRecord(value.cardGeneration) &&
  isCount(value.cardGeneration.dailyLimit) &&
  isCount(value.cardGeneration.usedAttempts) &&
  isCount(value.cardGeneration.remainingAttempts)

export const isVocabularyWordsPage = (
  value: unknown,
): value is VocabularyWordsPage =>
  isRecord(value) &&
  Array.isArray(value.needsApproval) &&
  value.needsApproval.every(
    (card) => isWordCard(card) && card.cardStatus === 'needs_approval',
  ) &&
  Array.isArray(value.ready) &&
  value.ready.every((card) => isWordCard(card) && card.cardStatus === 'ready')

export const isPrepareVocabularyCardsResult = (
  value: unknown,
): value is PrepareVocabularyCardsResult =>
  isRecord(value) &&
  [
    value.preparedCount,
    value.failedCount,
    value.mergedCount,
    value.reactivatedCount,
    value.remainingPendingCount,
    value.needsApprovalCount,
    value.dailyLimit,
    value.usedAttempts,
    value.remainingAttempts,
  ].every(isCount)

export const isVocabularyReviewState = (
  value: unknown,
): value is VocabularyReviewState =>
  isRecord(value) &&
  typeof value.reviewDate === 'string' &&
  (value.status === 'not_started' ||
    value.status === 'in_progress' ||
    value.status === 'completed') &&
  [
    value.totalReadyCount,
    value.requiredTotalCount,
    value.reviewedTodayCount,
    value.remainingRequiredCount,
    value.newAvailableCount,
    value.extraAvailableCount,
    value.displayTotalCount,
    value.displayReviewedCount,
    value.displayRemainingCount,
  ].every(isCount) &&
  isNullableString(value.completedAt) &&
  isRecord(value.dictionaryActions) &&
  isCount(value.dictionaryActions.pendingCount) &&
  isCount(value.dictionaryActions.needsApprovalCount) &&
  (value.currentCard === null || isReviewCard(value.currentCard))

export const isReviewVocabularyWordResult = (
  value: unknown,
): value is ReviewVocabularyWordResult =>
  isRecord(value) &&
  typeof value.reviewDate === 'string' &&
  typeof value.wordId === 'string' &&
  typeof value.word === 'string' &&
  isWordStatus(value.status) &&
  (value.reviewStep === null || isReviewStep(value.reviewStep)) &&
  isNullableString(value.nextReviewDate) &&
  isNullableString(value.learnedAt) &&
  typeof value.wasRequired === 'boolean'

export const requireVocabularyResponse = <T>({
  value,
  guard,
}: {
  value: unknown
  guard: (value: unknown) => value is T
}): T => {
  if (!guard(value)) throw new InvalidVocabularyResponseError()
  return value
}
