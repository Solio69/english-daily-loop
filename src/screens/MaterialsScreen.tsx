import {
  BookOpen,
  BookText,
  Clock,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { InlineStatusCard } from "../components/InlineStatusCard";
import { LoadingState } from "../components/LoadingState";
import { ScreenHeader } from "../components/ScreenHeader";
import { VocabularyTab } from "../components/vocabulary/VocabularyTab";
import { getReadingHistory } from "../services/materialsService";
import { getVocabularyState } from "../services/vocabularyService";
import { CompletedReadingText, MaterialsTab } from "../types/materials";

type MaterialsScreenProps = {
  onBack: () => void;
  initialTab?: MaterialsTab;
};

const HISTORY_PAGE_LIMIT = 10;

const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  day: "numeric",
  month: "long",
});

const TAB_STYLES: Record<MaterialsTab, { label: string; icon: typeof BookOpen }> =
  {
    texts: {
      label: "Текстов",
      icon: BookOpen,
    },
    vocabulary: {
      label: "Слов",
      icon: BookText,
    },
  };

const formatCompletedDate = (value: string): string =>
  DATE_FORMATTER.format(new Date(value));

const getModelLabel = (model: string): string => {
  const modelName = model.split("/").pop()?.replace(":free", "");
  return modelName || model;
};

export const MaterialsScreen: React.FC<MaterialsScreenProps> = ({
  onBack,
  initialTab = "texts",
}) => {
  const [activeTab, setActiveTab] = useState<MaterialsTab>(initialTab);
  const [texts, setTexts] = useState<CompletedReadingText[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [vocabularyCount, setVocabularyCount] = useState<number | null>(null);
  const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    let isMounted = true;

    const loadTexts = async () => {
      setIsLoading(true);
      setErrorText(null);

      try {
        const page = await getReadingHistory(null, HISTORY_PAGE_LIMIT);
        if (!isMounted) return;

        setTexts(page.items);
        setNextCursor(page.nextCursor);
      } catch (error) {
        if (!isMounted) return;

        setErrorText(
          error instanceof Error
            ? error.message
            : "Не удалось загрузить прочитанные тексты.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadTexts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadVocabularyCount = async () => {
      try {
        const state = await getVocabularyState();
        if (!isMounted) return;
        setVocabularyCount(state.totalCount);
      } catch {
        if (!isMounted) return;
        setVocabularyCount(null);
      }
    };

    loadVocabularyCount();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    setErrorText(null);

    try {
      const page = await getReadingHistory(nextCursor, HISTORY_PAGE_LIMIT);
      setTexts((currentTexts) => [...currentTexts, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить следующую страницу.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  const toggleTextExpanded = (id: string) => {
    setExpandedTextIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(id)) {
        nextIds.delete(id);
      } else {
        nextIds.add(id);
      }

      return nextIds;
    });
  };

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-3 px-3.5 pb-6 pt-3 min-[390px]:px-4 min-[480px]:max-w-[390px] min-[480px]:px-3">
      <ScreenHeader title="Мои материалы" onBack={onBack} />

      <div
        className="glass-card grid grid-cols-2 gap-2 rounded-[20px] p-2"
        role="tablist"
        aria-label="Материалы"
      >
        {(Object.keys(TAB_STYLES) as MaterialsTab[]).map((tab) => {
          const Icon = TAB_STYLES[tab].icon;
          const isActive = activeTab === tab;
          const count =
            tab === "texts"
              ? texts.length
              : vocabularyCount === null
                ? "..."
                : vocabularyCount;

          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`glass-control flex min-h-12 items-center justify-center gap-2 rounded-[16px] px-2 py-2 font-heading text-sm font-semibold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${
                isActive
                  ? "border-[var(--border-strong)] bg-[var(--primary-soft)] text-[var(--primary)] shadow-primary-glow"
                  : "text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
              }`}
              role="tab"
              aria-selected={isActive}
            >
              <Icon size={19} strokeWidth={2.2} />
              <span className="truncate">
                {TAB_STYLES[tab].label}:{" "}
                <span
                  className={
                    isActive
                      ? "text-[var(--primary)]"
                      : "text-[var(--text-secondary)]"
                  }
                >
                  {count}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === "texts" ? (
        <section className="space-y-3">
          {isLoading && (
            <LoadingState message="Загружаем тексты..." />
          )}

          {errorText && (
            <InlineStatusCard
              variant="error"
              title="Не удалось загрузить материалы"
              description={errorText}
            />
          )}

          {!isLoading && texts.length === 0 && (
            <div className="glass-card rounded-[20px] p-6 text-center">
              <div className="glass-control mx-auto mb-3 grid size-14 place-items-center rounded-full text-[var(--primary)]">
                <BookOpen size={28} />
              </div>
              <h2 className="font-heading text-base font-semibold text-[var(--text-primary)]">
                Прочитанных текстов пока нет
              </h2>
              <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                Завершенные тексты будут появляться здесь.
              </p>
            </div>
          )}

          {texts.map((text) => {
            const isExpanded = expandedTextIds.has(text.id);

            return (
              <article
                key={text.id}
                className="glass-card rounded-[20px] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-5 text-[var(--text-muted)]">
                      {formatCompletedDate(text.completedAt)}
                    </p>
                    <h2 className="mt-1 font-heading text-[20px] font-semibold leading-6 text-[var(--text-primary)]">
                      {text.title}
                    </h2>
                  </div>
                  <div className="glass-control flex shrink-0 items-center gap-1 rounded-full border-[var(--accent-warm)] bg-[var(--accent-warm-soft)] px-2.5 py-1 text-[12px] font-semibold text-[var(--accent-warm)] shadow-warm-glow">
                    <Clock size={14} strokeWidth={2.4} />
                    {text.estimatedMinutes}м
                  </div>
                </div>

                <p
                  className="mt-3 overflow-hidden whitespace-pre-line text-[15px] leading-6 text-[var(--text-secondary)]"
                  style={
                    isExpanded
                      ? undefined
                      : {
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }
                  }
                >
                  {text.body}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-[var(--text-muted)]">
                    <span className="rounded-[10px] bg-[var(--surface-strong)] px-2.5 py-1">
                      {text.level}
                    </span>
                    <span className="truncate rounded-[10px] bg-[var(--surface-strong)] px-2.5 py-1">
                      {getModelLabel(text.generation.model)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleTextExpanded(text.id)}
                    className="shrink-0 text-[13px] font-semibold text-[var(--accent-warm)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-warm)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? "Свернуть" : "Показать полностью"}
                  </button>
                </div>
              </article>
            );
          })}

          {nextCursor && (
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="w-full"
            >
              {isLoadingMore ? "Загружаем..." : "Показать еще"}
            </Button>
          )}
        </section>
      ) : (
        <VocabularyTab isActive={activeTab === "vocabulary"} />
      )}
    </div>
  );
};
