import React from 'react'
import type { VocabularyWordCard as VocabularyWord } from '../../types/vocabulary'
import { VocabularyWordCard } from './VocabularyWordCard'

type VocabularyReadyWordsProps = {
  words: VocabularyWord[]
  expandedWordId: string | null
  setExpandedWordId: (wordId: string | null) => void
}

export const VocabularyReadyWords: React.FC<VocabularyReadyWordsProps> = ({
  words,
  expandedWordId,
  setExpandedWordId,
}) => {
  if (words.length === 0) return null

  return (
    <section className="space-y-2">
      <h2 className="font-heading text-sm font-semibold text-[var(--text-secondary)]">
        Словарь
      </h2>
      {words.map((word) => (
        <VocabularyWordCard
          key={word.id}
          word={word}
          mode="ready"
          isExpanded={expandedWordId === word.id}
          isApproving={false}
          onToggle={() =>
            setExpandedWordId(expandedWordId === word.id ? null : word.id)
          }
          onApprove={() => undefined}
        />
      ))}
    </section>
  )
}
