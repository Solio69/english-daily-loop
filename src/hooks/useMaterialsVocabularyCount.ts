import { useEffect, useState } from 'react'
import { getVocabularyState } from '../services/vocabularyService'

export const useMaterialsVocabularyCount = () => {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let isCurrent = true
    const loadCount = async () => {
      try {
        const state = await getVocabularyState()
        if (isCurrent) setCount(state.totalCount)
      } catch {
        if (isCurrent) setCount(null)
      }
    }
    void loadCount()
    return () => {
      isCurrent = false
    }
  }, [])

  return count
}
