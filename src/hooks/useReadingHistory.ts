import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getReadingHistory,
  HISTORY_PAGE_LIMIT,
} from '../services/materialsService'
import type { CompletedReadingText } from '../types/materials'

const FIRST_PAGE_ERROR = 'Не удалось загрузить прочитанные тексты.'
const NEXT_PAGE_ERROR = 'Не удалось загрузить следующую страницу.'

export const useReadingHistory = () => {
  const [texts, setTexts] = useState<CompletedReadingText[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const isMounted = useRef(false)
  const isLoadingMoreInFlight = useRef(false)

  useEffect(() => {
    isMounted.current = true
    let isCurrentRequest = true
    const loadFirstPage = async () => {
      setIsLoading(true)
      setErrorText(null)
      try {
        const page = await getReadingHistory({ limit: HISTORY_PAGE_LIMIT })
        if (!isCurrentRequest) return
        setTexts(page.items)
        setNextCursor(page.nextCursor)
      } catch (error) {
        if (!isCurrentRequest) return
        setErrorText(error instanceof Error ? error.message : FIRST_PAGE_ERROR)
      } finally {
        if (isCurrentRequest) setIsLoading(false)
      }
    }

    void loadFirstPage()
    return () => {
      isCurrentRequest = false
      isMounted.current = false
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMoreInFlight.current) return
    isLoadingMoreInFlight.current = true
    setIsLoadingMore(true)
    setErrorText(null)
    try {
      const page = await getReadingHistory({
        cursor: nextCursor,
        limit: HISTORY_PAGE_LIMIT,
      })
      if (!isMounted.current) return
      setTexts((currentTexts) => [...currentTexts, ...page.items])
      setNextCursor(page.nextCursor)
    } catch (error) {
      if (!isMounted.current) return
      setErrorText(error instanceof Error ? error.message : NEXT_PAGE_ERROR)
    } finally {
      isLoadingMoreInFlight.current = false
      if (isMounted.current) setIsLoadingMore(false)
    }
  }, [nextCursor])

  return {
    texts,
    nextCursor,
    isLoading,
    isLoadingMore,
    errorText,
    loadMore,
  }
}
