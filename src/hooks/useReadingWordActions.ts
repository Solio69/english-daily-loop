import { useCallback, useState } from 'react'
import { EdgeFunctionError } from '../services/edgeFunctionErrors'
import { getReadingState } from '../services/readingService'
import {
  deletePendingVocabularyWord,
  saveVocabularyWord,
} from '../services/vocabularyService'
import type { ReadingText } from '../types/reading'
import { normalizeSelectableWord } from '../utils/readingText'
import {
  removeWordIndexes,
  resolveReadingWordAction,
  shouldCloseStaleRemoveAction,
  type ReadingWordAction,
} from '../utils/readingWordAction'

type WordFeedback = { tone: 'success' | 'error'; message: string } | null

export const useReadingWordActions = ({
  text,
  setErrorText,
}: {
  text: ReadingText | null
  setErrorText: (message: string | null) => void
}) => {
  const [selectedWord, setSelectedWord] = useState<ReadingWordAction | null>(
    null,
  )
  const [savedWords, setSavedWords] = useState<Set<number>>(new Set())
  const [pendingSavedWords, setPendingSavedWords] = useState<Set<number>>(
    new Set(),
  )
  const [wordFeedback, setWordFeedback] = useState<WordFeedback>(null)
  const [mutatingWordIndex, setMutatingWordIndex] = useState<number | null>(
    null,
  )

  const hydrateFromText = useCallback((nextText: ReadingText | null) => {
    setSavedWords(new Set(nextText?.savedWordIndexes ?? []))
    setPendingSavedWords(new Set(nextText?.pendingSavedWordIndexes ?? []))
    setSelectedWord(null)
    setWordFeedback(null)
  }, [])

  const clearWords = () => {
    setSavedWords(new Set())
    setPendingSavedWords(new Set())
    setSelectedWord(null)
    setWordFeedback(null)
  }

  const cancelWord = () => {
    setSelectedWord(null)
    setWordFeedback(null)
  }

  const handleWordClick = (word: string, index: number) => {
    const normalizedWord = normalizeSelectableWord(word)
    if (!normalizedWord || mutatingWordIndex !== null) return
    const nextAction = resolveReadingWordAction({
      word: normalizedWord,
      index,
      savedWordIndexes: savedWords,
      pendingSavedWordIndexes: pendingSavedWords,
    })
    if (!nextAction) return
    setWordFeedback(null)
    setSelectedWord(nextAction)
  }

  const handleAddWord = async () => {
    if (!selectedWord || selectedWord.mode !== 'add' || !text) return
    setMutatingWordIndex(selectedWord.index)
    setErrorText(null)
    setWordFeedback(null)
    try {
      const result = await saveVocabularyWord({
        readingTextId: text.id,
        word: selectedWord.word,
        wordIndex: selectedWord.index,
      })
      setSavedWords((prev) => new Set(prev).add(result.wordIndex))
      if (result.cardStatus === 'pending') {
        setPendingSavedWords((prev) => new Set(prev).add(result.wordIndex))
      }
      setSelectedWord(null)
      setWordFeedback(null)
    } catch (error) {
      setWordFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Не удалось сохранить слово. Попробуй еще раз.',
      })
    } finally {
      setMutatingWordIndex(null)
    }
  }

  const refreshSavedWordState = async (
    readingTextId: string,
  ): Promise<Set<number> | null> => {
    const state = await getReadingState()
    if (state.activeText?.id !== readingTextId) return null
    const refreshedSavedWords = new Set(state.activeText.savedWordIndexes ?? [])
    setSavedWords(refreshedSavedWords)
    setPendingSavedWords(
      new Set(state.activeText.pendingSavedWordIndexes ?? []),
    )
    return refreshedSavedWords
  }

  const handleDeleteWord = async () => {
    if (!selectedWord || selectedWord.mode !== 'remove' || !text) return
    const readingTextId = text.id
    setMutatingWordIndex(selectedWord.index)
    setErrorText(null)
    setWordFeedback(null)
    try {
      const result = await deletePendingVocabularyWord({
        readingTextId,
        wordIndex: selectedWord.index,
      })
      setSavedWords((prev) =>
        removeWordIndexes(prev, result.removedWordIndexes),
      )
      setPendingSavedWords((prev) =>
        removeWordIndexes(prev, result.removedWordIndexes),
      )
      setSelectedWord(null)
    } catch (error) {
      let refreshedSavedWords: Set<number> | null = null
      if (
        error instanceof EdgeFunctionError &&
        (error.code === 'VOCABULARY_CARD_ALREADY_PREPARED' ||
          error.code === 'VOCABULARY_SOURCE_NOT_FOUND')
      ) {
        try {
          refreshedSavedWords = await refreshSavedWordState(readingTextId)
        } catch {
          // Keep the visible state stable if the conflict refresh also fails.
        }
      }
      if (
        shouldCloseStaleRemoveAction({
          errorCode:
            error instanceof EdgeFunctionError ? error.code : undefined,
          selectedIndex: selectedWord.index,
          refreshedSavedWordIndexes: refreshedSavedWords,
        })
      ) {
        setSelectedWord(null)
        setWordFeedback(null)
        return
      }
      setWordFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Не удалось удалить слово. Попробуй еще раз.',
      })
    } finally {
      setMutatingWordIndex(null)
    }
  }

  return {
    selectedWord,
    savedWords,
    pendingSavedWords,
    wordFeedback,
    mutatingWordIndex,
    hydrateFromText,
    clearWords,
    cancelWord,
    handleWordClick,
    handleAddWord,
    handleDeleteWord,
  }
}
