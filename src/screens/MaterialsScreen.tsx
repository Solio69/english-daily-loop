import { BookOpen, BookText } from 'lucide-react'
import { useState } from 'react'
import { ReadingHistoryList } from '../components/materials/ReadingHistoryList'
import { ScreenHeader } from '../components/ScreenHeader'
import { VocabularyTab } from '../components/vocabulary/VocabularyTab'
import { useMaterialsVocabularyCount } from '../hooks/useMaterialsVocabularyCount'
import { useReadingHistory } from '../hooks/useReadingHistory'
import type { MaterialsTab } from '../types/materials'

type MaterialsScreenProps = {
  onBack: () => void
  initialTab?: MaterialsTab
  onVocabularyReviewStateChange?: () => Promise<unknown>
}

const TAB_STYLES: Record<
  MaterialsTab,
  { label: string; icon: typeof BookOpen }
> = {
  texts: { label: 'Текстов', icon: BookOpen },
  vocabulary: { label: 'Слов', icon: BookText },
}
const TAB_ORDER: MaterialsTab[] = ['vocabulary', 'texts']
const UNKNOWN_VOCABULARY_COUNT = '...'

export const MaterialsScreen = ({
  onBack,
  initialTab = 'vocabulary',
  onVocabularyReviewStateChange,
}: MaterialsScreenProps) => {
  const [activeTab, setActiveTab] = useState<MaterialsTab>(initialTab)
  const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(
    () => new Set(),
  )
  const vocabularyCount = useMaterialsVocabularyCount()
  const { texts, nextCursor, isLoading, isLoadingMore, errorText, loadMore } =
    useReadingHistory()

  const toggleTextExpanded = (id: string) => {
    setExpandedTextIds((currentIds) => {
      const nextIds = new Set(currentIds)
      if (nextIds.has(id)) nextIds.delete(id)
      else nextIds.add(id)
      return nextIds
    })
  }

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-3 px-3.5 pb-6 pt-3 min-[390px]:px-4 min-[480px]:max-w-[390px] min-[480px]:px-3">
      <ScreenHeader title="Мои материалы" onBack={onBack} />

      <div
        className="glass-card grid grid-cols-2 gap-2 rounded-[20px] p-2"
        role="tablist"
        aria-label="Материалы"
      >
        {TAB_ORDER.map((tab) => {
          const Icon = TAB_STYLES[tab].icon
          const isActive = activeTab === tab
          const count =
            tab === 'texts'
              ? texts.length
              : (vocabularyCount ?? UNKNOWN_VOCABULARY_COUNT)

          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`glass-control flex min-h-12 items-center justify-center gap-2 rounded-[16px] px-2 py-2 font-heading text-sm font-semibold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${
                isActive
                  ? 'border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-primary-glow'
                  : 'text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]'
              }`}
              role="tab"
              aria-selected={isActive}
            >
              <Icon size={19} strokeWidth={2.2} />
              <span className="truncate">
                {TAB_STYLES[tab].label}:{' '}
                <span
                  className={
                    isActive
                      ? 'text-[var(--primary)]'
                      : 'text-[var(--text-secondary)]'
                  }
                >
                  {count}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {activeTab === 'texts' ? (
        <ReadingHistoryList
          texts={texts}
          expandedTextIds={expandedTextIds}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          errorText={errorText}
          nextCursor={nextCursor}
          onToggleExpanded={toggleTextExpanded}
          onLoadMore={loadMore}
        />
      ) : (
        <VocabularyTab
          isActive={activeTab === 'vocabulary'}
          onVocabularyReviewStateChange={onVocabularyReviewStateChange}
        />
      )}
    </div>
  )
}
