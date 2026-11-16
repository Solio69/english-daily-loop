import { useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  generateReadingText,
  getReadingState,
} from '../services/readingService'
import type { ReadingHomeStatus } from '../types/homeProgress'
import type { ReadingText } from '../types/reading'
import { useReadingWordActions } from './useReadingWordActions'

const DEFAULT_DAILY_LIMIT = 10
const NO_ATTEMPTS = 0

const resolveReadingStatus = ({
  nextText,
  hasCompletedReadingToday,
}: {
  nextText: ReadingText | null
  hasCompletedReadingToday: boolean
}): ReadingHomeStatus => {
  if (hasCompletedReadingToday) return 'completed'
  if (nextText) return 'in_progress'
  return 'not_started'
}

type ReadingFlowOptions = {
  onBack: () => void
  onNext?: () => void
  onCompleteText?: () => Promise<void>
  onReadingStatusChange?: (status: ReadingHomeStatus) => void
}

export const useReadingFlow = ({
  onBack,
  onNext,
  onCompleteText,
  onReadingStatusChange,
}: ReadingFlowOptions) => {
  const [isStateLoading, setIsStateLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const generationInFlight = useRef(false)
  const [text, setText] = useState<ReadingText | null>(null)
  const [dailyLimit, setDailyLimit] = useState(DEFAULT_DAILY_LIMIT)
  const [remainingAttempts, setRemainingAttempts] = useState(NO_ATTEMPTS)
  const [hasCompletedReadingToday, setHasCompletedReadingToday] =
    useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [isFinishing, setIsFinishing] = useState(false)
  const words = useReadingWordActions({ text, setErrorText })
  const hydrateFromText = words.hydrateFromText
  const emitReadingStatusChange = useEffectEvent(
    (status: ReadingHomeStatus) => {
      onReadingStatusChange?.(status)
    },
  )

  useEffect(() => {
    let isMounted = true

    const loadInitialState = async () => {
      setIsStateLoading(true)
      setErrorText(null)
      try {
        const state = await getReadingState()
        if (!isMounted) return
        setText(state.activeText)
        hydrateFromText(state.activeText)
        setDailyLimit(state.dailyLimit)
        setRemainingAttempts(state.remainingAttempts)
        setHasCompletedReadingToday(state.isReadingCompletedToday)
        emitReadingStatusChange(
          resolveReadingStatus({
            nextText: state.activeText,
            hasCompletedReadingToday: state.isReadingCompletedToday,
          }),
        )
      } catch (error) {
        if (!isMounted) return
        const message =
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить состояние чтения.'
        setErrorText(message)
      } finally {
        if (isMounted) setIsStateLoading(false)
      }
    }

    loadInitialState()
    return () => {
      isMounted = false
    }
  }, [hydrateFromText])

  const handleGenerate = async () => {
    if (generationInFlight.current || remainingAttempts <= NO_ATTEMPTS) return
    generationInFlight.current = true
    const previousTextId = text?.id ?? null

    setLoading(true)
    words.clearWords()
    setErrorText(null)
    try {
      const result = await generateReadingText()
      setText(result.text)
      setDailyLimit(result.dailyLimit)
      setRemainingAttempts(result.remainingAttempts)
      setErrorText(null)
      onReadingStatusChange?.(
        hasCompletedReadingToday ? 'completed' : 'in_progress',
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить текст. Попробуй еще раз.'
      let recoveredNewText = false
      try {
        const state = await getReadingState()
        recoveredNewText =
          state.activeText !== null && state.activeText.id !== previousTextId
        setText(state.activeText)
        hydrateFromText(state.activeText)
        setDailyLimit(state.dailyLimit)
        setRemainingAttempts(state.remainingAttempts)
        setHasCompletedReadingToday(state.isReadingCompletedToday)
        onReadingStatusChange?.(
          resolveReadingStatus({
            nextText: state.activeText,
            hasCompletedReadingToday: state.isReadingCompletedToday,
          }),
        )
      } catch {
        // Keep the latest visible state if refresh fails after generation error.
      }
      setErrorText(recoveredNewText ? null : message)
    } finally {
      generationInFlight.current = false
      setLoading(false)
    }
  }

  const handleDone = async () => {
    setIsFinishing(true)
    try {
      if (onCompleteText) await onCompleteText()
      setText(null)
      words.clearWords()
      setHasCompletedReadingToday(true)
      onReadingStatusChange?.('completed')
      if (onNext) onNext()
      else onBack()
    } finally {
      setIsFinishing(false)
    }
  }

  return {
    isStateLoading,
    loading,
    text,
    dailyLimit,
    remainingAttempts,
    errorText,
    isFinishing,
    selectedWord: words.selectedWord,
    savedWords: words.savedWords,
    wordFeedback: words.wordFeedback,
    mutatingWordIndex: words.mutatingWordIndex,
    handleGenerate,
    handleDone,
    handleWordClick: words.handleWordClick,
    handleAddWord: words.handleAddWord,
    handleDeleteWord: words.handleDeleteWord,
    cancelWord: words.cancelWord,
  }
}
