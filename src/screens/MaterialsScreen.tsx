import {
  BookOpen,
  BookText,
  ChevronLeft,
  Clock,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { LoadingState } from "../components/LoadingState";
import { VocabularyTab } from "../components/vocabulary/VocabularyTab";
import { getReadingHistory } from "../services/materialsService";
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
      label: "Тексты",
      icon: BookOpen,
    },
    vocabulary: {
      label: "Словарь",
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
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-700 dark:hover:text-gray-300"
          aria-label="Назад"
        >
          <ChevronLeft size={20} /> Назад
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
          Мои материалы
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 dark:bg-gray-800 p-1">
        {(Object.keys(TAB_STYLES) as MaterialsTab[]).map((tab) => {
          const Icon = TAB_STYLES[tab].icon;
          const isActive = activeTab === tab;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-white text-green-600 shadow-sm dark:bg-gray-700 dark:text-orange-300"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Icon size={16} />
              {TAB_STYLES[tab].label}
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
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {errorText}
            </div>
          )}

          {!isLoading && texts.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 text-center shadow-sm">
              <BookOpen
                size={34}
                className="mx-auto mb-3 text-gray-300 dark:text-gray-600"
              />
              <h2 className="font-bold text-gray-900 dark:text-white">
                Прочитанных текстов пока нет
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Завершенные тексты будут появляться здесь.
              </p>
            </div>
          )}

          {texts.map((text) => {
            const isExpanded = expandedTextIds.has(text.id);

            return (
              <article
                key={text.id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      {formatCompletedDate(text.completedAt)}
                    </p>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
                      {text.title}
                    </h2>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 rounded-full bg-green-50 text-green-600 dark:bg-orange-900/20 dark:text-orange-300 px-2 py-1 text-[11px] font-semibold">
                    <Clock size={13} />
                    {text.estimatedMinutes}м
                  </div>
                </div>

                <p
                  className="text-sm leading-5 text-gray-600 dark:text-gray-300 overflow-hidden whitespace-pre-line"
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

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500 min-w-0">
                    <span className="rounded bg-gray-50 dark:bg-gray-700 px-2 py-0.5">
                      {text.level}
                    </span>
                    <span className="rounded bg-gray-50 dark:bg-gray-700 px-2 py-0.5 truncate">
                      {getModelLabel(text.generation.model)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleTextExpanded(text.id)}
                    className="shrink-0 text-[11px] font-semibold text-green-600 dark:text-orange-300"
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
              className="w-full dark:border-gray-700 dark:text-gray-200"
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
