import { useCallback, useEffect, useRef, useState } from 'react'
import { InvalidVocabularyResponseError } from '../services/vocabularyContracts'
import {
  getVocabularyReviewState,
  reviewVocabularyWord,
} from '../services/vocabularyService'
import type {
  VocabularyReviewAction,
  VocabularyReviewState,
  VocabularyReviewStatus,
} from '../types/vocabulary'

const REVIEW_ERROR = {
  load: 'Не удалось загрузить повторение слов.',
  save: 'Не удалось сохранить ответ.',
  next: 'Не удалось загрузить следующую карточку.',
  savedButRefreshFailed:
    'Ответ сохранён, но не удалось загрузить следующую карточку.',
} as const

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

export const useVocabularyReview = ({
  onReviewStatusChange,
}: {
  onReviewStatusChange?: (
    status: VocabularyReviewStatus,
    remainingRequiredCount: number,
    reviewedTodayCount: number,
  ) => void
}) => {
  const [reviewState, setReviewState] = useState<VocabularyReviewState | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)
  const [isReviewStateStale, setIsReviewStateStale] = useState(false)
  const [isCardRevealed, setIsCardRevealed] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)

  const applyReviewState = useCallback(
    (state: VocabularyReviewState) => {
      setReviewState(state)
      onReviewStatusChange?.(
        state.status,
        state.remainingRequiredCount,
        state.reviewedTodayCount,
      )
    },
    [onReviewStatusChange],
  )

  const loadReviewState = useCallback(async () => {
    setErrorText(null)
    const state = await getVocabularyReviewState()
    applyReviewState(state)
    setIsReviewStateStale(false)
  }, [applyReviewState])

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      setIsLoading(true)
      try {
        const state = await getVocabularyReviewState()
        if (!isMounted) return
        applyReviewState(state)
      } catch (error) {
        if (!isMounted) return
        setErrorText(errorMessage(error, REVIEW_ERROR.load))
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    void load()
    return () => {
      isMounted = false
    }
  }, [applyReviewState])

  const handleReview = async (action: VocabularyReviewAction) => {
    const currentCard = reviewState?.currentCard
    if (!currentCard || isSubmittingRef.current || isReviewStateStale) return

    let isReviewSaved = false
    isSubmittingRef.current = true
    setIsSubmitting(true)
    setErrorText(null)
    try {
      await reviewVocabularyWord(currentCard.id, action)
      isReviewSaved = true
      await loadReviewState()
      setIsCardRevealed(false)
    } catch (error) {
      const savedWithInvalidResponse =
        error instanceof InvalidVocabularyResponseError
      if (isReviewSaved || savedWithInvalidResponse) {
        setIsReviewStateStale(true)
        setIsCardRevealed(false)
        setErrorText(REVIEW_ERROR.savedButRefreshFailed)
      } else {
        setErrorText(errorMessage(error, REVIEW_ERROR.save))
      }
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const handleReviewStateRefresh = async () => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setIsSubmitting(true)
    try {
      await loadReviewState()
    } catch (error) {
      setErrorText(errorMessage(error, REVIEW_ERROR.next))
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return {
    reviewState,
    isLoading,
    isSubmitting,
    isReviewStateStale,
    isCardRevealed,
    errorText,
    setIsCardRevealed,
    loadReviewState,
    handleReview,
    handleReviewStateRefresh,
  }
}
