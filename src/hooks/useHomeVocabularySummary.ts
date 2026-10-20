import { useEffect, useState } from 'react'
import { getVocabularyState } from '../services/vocabularyService'
import type { VocabularyState } from '../types/vocabulary'

export const useHomeVocabularySummary = (isFirstSetup: boolean) => {
  const [vocabularyState, setVocabularyState] =
    useState<VocabularyState | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isFirstSetup) return

    let isMounted = true
    const loadVocabularyState = async () => {
      setIsLoading(true)
      try {
        const state = await getVocabularyState()
        if (isMounted) setVocabularyState(state)
      } catch {
        if (isMounted) setVocabularyState(null)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadVocabularyState()
    return () => {
      isMounted = false
    }
  }, [isFirstSetup])

  return {
    vocabularyState: isFirstSetup ? null : vocabularyState,
    isLoading: !isFirstSetup && isLoading,
  }
}
