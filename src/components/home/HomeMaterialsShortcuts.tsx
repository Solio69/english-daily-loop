import { BookOpen, NotebookTabs } from 'lucide-react'
import type { MaterialsTab } from '../../types/materials'
import { getCompletedReadingTextLabel } from '../../utils/homeProgressPresentation'

type HomeMaterialsShortcutsProps = {
  vocabularyTile: { isAttention: boolean; lines: string[] }
  completedReadingTextCount: number | null
  onOpenMaterials: (tab: MaterialsTab) => void
}

export const HomeMaterialsShortcuts = ({
  vocabularyTile,
  completedReadingTextCount,
  onOpenMaterials,
}: HomeMaterialsShortcutsProps) => (
  <section className="glass-card rounded-[20px] p-3">
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-semibold uppercase tracking-[0.11em] text-[var(--primary)]">
            Мои материалы
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOpenMaterials('vocabulary')}
          className="grid h-[108px] grid-rows-[44px_40px] content-start rounded-[16px] border border-[var(--border)] bg-[var(--surface-strong)] p-2.5 text-left backdrop-blur-[24px] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        >
          <div className="flex h-11 items-center gap-2 text-[var(--text-primary)]">
            <span className="glass-control grid size-10 shrink-0 place-items-center rounded-full text-[var(--primary)]">
              <NotebookTabs size={20} />
            </span>
            <span className="font-heading text-base font-semibold">
              Словарь
            </span>
          </div>
          <p
            className={`mt-1.5 h-10 overflow-hidden text-sm leading-5 ${
              vocabularyTile.isAttention
                ? 'font-semibold text-[var(--accent-warm)]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            {vocabularyTile.lines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onOpenMaterials('texts')}
          className="grid h-[108px] grid-rows-[44px_40px] content-start rounded-[16px] border border-[var(--border)] bg-[var(--surface-strong)] p-2.5 text-left backdrop-blur-[24px] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        >
          <div className="flex h-11 items-center gap-2 text-[var(--text-primary)]">
            <span className="glass-control grid size-10 shrink-0 place-items-center rounded-full text-[var(--primary)]">
              <BookOpen className="-translate-y-px" size={20} />
            </span>
            <span className="font-heading text-base font-semibold">Тексты</span>
          </div>
          <p className="mt-1.5 h-10 overflow-hidden text-sm leading-5 text-[var(--text-secondary)]">
            {getCompletedReadingTextLabel(completedReadingTextCount)}
          </p>
        </button>
      </div>
    </div>
  </section>
)
