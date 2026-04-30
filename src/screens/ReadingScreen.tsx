import { BookOpen, Clock, Loader2, Sparkles } from "lucide-react";
import React, { useEffect, useEffectEvent, useState } from "react";
import { Button } from "../components/Button";
import {
  generateReadingText,
  getReadingState,
} from "../services/readingService";
import { ReadingHomeStatus } from "../types/homeProgress";
import { ReadingText } from "../types/reading";

const getModelLabel = (model?: string): string | null => {
  if (!model) return null;
  const modelName = model.split("/").pop()?.replace(":free", "");
  return modelName || model;
};

const resolveReadingStatus = (
  nextText: ReadingText | null,
  completedToday: boolean,
): ReadingHomeStatus => {
  if (completedToday) return "completed";
  if (nextText) return "in_progress";
  return "not_started";
};

type ReadingScreenProps = {
  onBack: () => void;
  onNext?: () => void;
  onCompleteText?: () => Promise<void>;
  onReadingStatusChange?: (status: ReadingHomeStatus) => void;
  userLevel?: string | null;
  readingMinutes?: number | null;
};

export const ReadingScreen: React.FC<ReadingScreenProps> = ({
  onBack,
  onNext,
  onCompleteText,
  onReadingStatusChange,
  userLevel,
  readingMinutes,
}) => {
  const [isStateLoading, setIsStateLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<ReadingText | null>(null);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [remainingAttempts, setRemainingAttempts] = useState(0);
  const [isReadingCompletedToday, setIsReadingCompletedToday] = useState(false);
  const [selectedWord, setSelectedWord] = useState<{
    word: string;
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const [savedWords, setSavedWords] = useState<Set<number>>(new Set());
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const emitReadingStatusChange = useEffectEvent(
    (status: ReadingHomeStatus) => {
      onReadingStatusChange?.(status);
    },
  );

  useEffect(() => {
    let isMounted = true;

    const loadReadingState = async () => {
      setIsStateLoading(true);
      setErrorText(null);

      try {
        const state = await getReadingState();
        if (!isMounted) return;

        setText(state.activeText);
        setDailyLimit(state.dailyLimit);
        setRemainingAttempts(state.remainingAttempts);
        setIsReadingCompletedToday(state.isReadingCompletedToday);
        emitReadingStatusChange(
          resolveReadingStatus(state.activeText, state.isReadingCompletedToday),
        );
      } catch (error) {
        if (!isMounted) return;
        const message =
          error instanceof Error
            ? error.message
            : "Не удалось загрузить состояние чтения.";
        setErrorText(message);
      } finally {
        if (isMounted) {
          setIsStateLoading(false);
        }
      }
    };

    loadReadingState();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleGenerate = async () => {
    if (isReadingCompletedToday || remainingAttempts <= 0) return;

    setLoading(true);
    setSavedWords(new Set());
    setSelectedWord(null);
    setErrorText(null);

    try {
      const result = await generateReadingText();
      setText(result.text);
      setDailyLimit(result.dailyLimit);
      setRemainingAttempts(result.remainingAttempts);
      emitReadingStatusChange("in_progress");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось загрузить текст. Попробуй еще раз.";
      setErrorText(message);

      try {
        const state = await getReadingState();
        setText(state.activeText);
        setDailyLimit(state.dailyLimit);
        setRemainingAttempts(state.remainingAttempts);
        setIsReadingCompletedToday(state.isReadingCompletedToday);
        emitReadingStatusChange(
          resolveReadingStatus(state.activeText, state.isReadingCompletedToday),
        );
      } catch {
        // Keep the latest visible state if refresh fails after generation error.
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWordClick = (
    word: string,
    index: number,
    e: React.MouseEvent,
  ) => {
    if (savedWords.has(index)) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setSelectedWord({
      word,
      index,
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY,
    });
  };

  const handleAddWord = () => {
    if (selectedWord) {
      setSavedWords((prev) => new Set(prev).add(selectedWord.index));
      setSelectedWord(null);
    }
  };

  const handleDone = async () => {
    setIsFinishing(true);
    try {
      if (onCompleteText) {
        await onCompleteText();
      }
      setText(null);
      setSavedWords(new Set());
      setSelectedWord(null);
      setIsReadingCompletedToday(true);
      setRemainingAttempts(0);
      emitReadingStatusChange("completed");
      if (onNext) {
        onNext();
      } else {
        onBack();
      }
    } finally {
      setIsFinishing(false);
    }
  };

  const isGenerateDisabled =
    isStateLoading ||
    loading ||
    isReadingCompletedToday ||
    remainingAttempts <= 0;
  const generateButtonLabel = isReadingCompletedToday
    ? "Текст на сегодня прочитан"
    : remainingAttempts <= 0
      ? "Попытки на сегодня закончились"
      : "Сгенерировать текст";

  return (
    <div className="p-4 space-y-6">
      <div className="bg-white dark:bg-gray-800 p-2.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-2">
        <div className="grid grid-cols-3 gap-1.5 text-[11px] sm:text-xs text-gray-700 dark:text-gray-200">
          <p className="inline-flex items-center gap-1 min-w-0 whitespace-nowrap">
            <BookOpen size={14} className="text-green-500 shrink-0" />
            <span>Уровень:</span>
            <span className="font-semibold text-green-500 truncate">
              {userLevel ?? "—"}
            </span>
          </p>
          <p className="inline-flex items-center gap-1 min-w-0 justify-center whitespace-nowrap">
            <Sparkles size={14} className="text-green-500 shrink-0" />
            <span>Осталось:</span>
            <span className="font-semibold text-green-500">
              {remainingAttempts}/{dailyLimit}
            </span>
          </p>
          <p className="inline-flex items-center gap-1 min-w-0 justify-end whitespace-nowrap">
            <Clock size={14} className="text-green-500 shrink-0" />
            <span>Время:</span>
            <span className="font-semibold text-green-500">
              {readingMinutes ? `${readingMinutes} мин` : "—"}
            </span>
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={isGenerateDisabled}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm sm:text-base dark:bg-orange-500 dark:hover:bg-orange-600"
        >
          <Sparkles size={18} /> {generateButtonLabel}
        </Button>
      </div>

      {isStateLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400 dark:text-gray-500">
          <Loader2 size={32} className="animate-spin" />
          <p>Загружаем текст...</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400 dark:text-gray-500">
          <Loader2 size={32} className="animate-spin" />
          <p>Генерируем текст...</p>
        </div>
      )}

      {isReadingCompletedToday && (
        <div className="p-4 rounded-xl border border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
          Текст на сегодня уже прочитан. Новый текст будет доступен завтра.
        </div>
      )}

      {errorText && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {errorText}
        </div>
      )}

      {text && !loading && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {text.title}
            </h3>
            {text.source && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                  text.source === "ai"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                }`}
                title={
                  text.source === "ai"
                    ? text.generation?.model
                      ? `AI: ${text.generation.model}`
                      : "AI"
                    : "DB fallback"
                }
              >
                {text.source === "ai"
                  ? `AI${getModelLabel(text.generation?.model) ? ` · ${getModelLabel(text.generation?.model)}` : ""}`
                  : "DB"}
              </span>
            )}
          </div>
          <p className="text-gray-800 dark:text-gray-200 leading-relaxed text-lg">
            {text.body.split(" ").map((word, i) => {
              const cleanWord = word.replace(/[.,]/g, "");
              const isSelected = selectedWord?.index === i;
              const isSaved = savedWords.has(i);
              return (
                <span
                  key={i}
                  onClick={(e) => handleWordClick(cleanWord, i, e)}
                  className={`cursor-pointer rounded px-0.5 transition-colors ${isSelected ? "bg-blue-200 dark:bg-orange-900/40" : isSaved ? "bg-green-200 dark:bg-green-900/40" : "hover:bg-blue-100 dark:hover:bg-gray-700"}`}
                >
                  {word}{" "}
                </span>
              );
            })}
          </p>
        </div>
      )}

      {text && !loading && (
        <Button
          variant="accent"
          className="w-full"
          onClick={handleDone}
          disabled={isFinishing}
        >
          {isFinishing ? "Сохраняем..." : "Завершить текст"}
        </Button>
      )}

      {selectedWord && (
        <div
          className="absolute bg-white dark:bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 flex flex-col gap-2 z-50"
          style={{
            top:
              selectedWord.y > window.innerHeight / 2 + window.scrollY
                ? selectedWord.y - 110
                : selectedWord.y + 30,
            left: selectedWord.x - 70,
          }}
        >
          <p className="text-xs text-center dark:text-gray-200">
            Добавить в словарь?
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleAddWord}
              className="flex-1 text-xs py-1 dark:bg-orange-500 dark:hover:bg-orange-600"
            >
              Добавить
            </Button>
            <Button
              onClick={() => setSelectedWord(null)}
              variant="outline"
              className="flex-1 text-xs py-1 dark:border-gray-700 dark:text-gray-200"
            >
              Отмена
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
