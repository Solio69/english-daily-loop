import { invokeFunction } from './functionClient'
import {
  isPrepareVocabularyCardsResult,
  isReviewVocabularyWordResult,
  isVocabularyReviewState,
  isVocabularyState,
  isVocabularyWordsPage,
  requireVocabularyResponse,
} from './vocabularyContracts'
import {
  ApproveVocabularyCardResult,
  ApproveVocabularyCardsResult,
  DeletePendingVocabularyWordResult,
  PrepareVocabularyCardsResult,
  ReviewVocabularyWordResult,
  SaveVocabularyWordResult,
  VocabularyReviewAction,
  VocabularyReviewState,
  VocabularyState,
  VocabularyWordsPage,
} from '../types/vocabulary'

export const saveVocabularyWord = async ({
  readingTextId,
  word,
  wordIndex,
}: {
  readingTextId: string
  word: string
  wordIndex: number
}): Promise<SaveVocabularyWordResult> =>
  invokeFunction<SaveVocabularyWordResult>(
    'save-vocabulary-word',
    { readingTextId, word, wordIndex },
    'Не удалось сохранить слово. Попробуй еще раз.',
  )

export const deletePendingVocabularyWord = async ({
  readingTextId,
  wordIndex,
}: {
  readingTextId: string
  wordIndex: number
}): Promise<DeletePendingVocabularyWordResult> =>
  invokeFunction<DeletePendingVocabularyWordResult>(
    'delete-pending-vocabulary-word',
    { readingTextId, wordIndex },
    'Не удалось удалить слово. Попробуй еще раз.',
  )

export const getVocabularyState = async (): Promise<VocabularyState> =>
  requireVocabularyResponse({
    value: await invokeFunction<unknown>(
      'get-vocabulary-state',
      {},
      'Не удалось загрузить состояние словаря.',
    ),
    guard: isVocabularyState,
  })

export const prepareVocabularyCards =
  async (): Promise<PrepareVocabularyCardsResult> =>
    requireVocabularyResponse({
      value: await invokeFunction<unknown>(
        'prepare-vocabulary-cards',
        {},
        'Не удалось подготовить карточки слов.',
      ),
      guard: isPrepareVocabularyCardsResult,
    })

export const getVocabularyWords = async (): Promise<VocabularyWordsPage> =>
  requireVocabularyResponse({
    value: await invokeFunction<unknown>(
      'get-vocabulary-words',
      {},
      'Не удалось загрузить карточки словаря.',
    ),
    guard: isVocabularyWordsPage,
  })

export const getVocabularyReviewState =
  async (): Promise<VocabularyReviewState> =>
    requireVocabularyResponse({
      value: await invokeFunction<unknown>(
        'get-vocabulary-review-state',
        {},
        'Не удалось загрузить повторение слов.',
      ),
      guard: isVocabularyReviewState,
    })

export const reviewVocabularyWord = async (
  wordId: string,
  action: VocabularyReviewAction,
): Promise<ReviewVocabularyWordResult> =>
  requireVocabularyResponse({
    value: await invokeFunction<unknown>(
      'review-vocabulary-word',
      { wordId, action },
      'Не удалось сохранить ответ.',
    ),
    guard: isReviewVocabularyWordResult,
  })

export const approveVocabularyCard = async (
  wordId: string,
): Promise<ApproveVocabularyCardResult> =>
  invokeFunction<ApproveVocabularyCardResult>(
    'approve-vocabulary-card',
    { wordId },
    'Не удалось подтвердить карточку.',
  )

export const approveVocabularyCards =
  async (): Promise<ApproveVocabularyCardsResult> =>
    invokeFunction<ApproveVocabularyCardsResult>(
      'approve-vocabulary-cards',
      {},
      'Не удалось подтвердить карточки.',
    )
