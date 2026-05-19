import React, { useEffect, useEffectEvent, useState } from "react";
import { Button } from "../components/Button";
import { InlineStatusCard } from "../components/InlineStatusCard";
import { LoadingState } from "../components/LoadingState";
import { ReadingGeneratedToolbar } from "../components/reading/ReadingGeneratedToolbar";
import { ReadingGenerationCard } from "../components/reading/ReadingGenerationCard";
import { ReadingInfoCard } from "../components/reading/ReadingInfoCard";
import { ReadingTextCard } from "../components/reading/ReadingTextCard";
import { ScreenHeader } from "../components/ScreenHeader";
import {
  generateReadingText,
  getReadingState,
} from "../services/readingService";
import { saveVocabularyWord } from "../services/vocabularyService";
import { ReadingHomeStatus } from "../types/homeProgress";
import { ReadingText } from "../types/reading";
import { normalizeSelectableWord } from "../utils/readingText";

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
  } | null>(null);
  const [savedWords, setSavedWords] = useState<Set<number>>(new Set());
  const [errorText, setErrorText] = useState<string | null>(null);
  const [wordFeedback, setWordFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [savingWordIndex, setSavingWordIndex] = useState<number | null>(null);
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
        setSavedWords(new Set(state.activeText?.savedWordIndexes ?? []));
        setSelectedWord(null);
        setWordFeedback(null);
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
    setWordFeedback(null);

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
        setSavedWords(new Set(state.activeText?.savedWordIndexes ?? []));
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

  const handleWordClick = (word: string, index: number) => {
    const normalizedWord = normalizeSelectableWord(word);
    if (!normalizedWord || savedWords.has(index) || savingWordIndex !== null) {
      return;
    }

    setWordFeedback(null);
    setSelectedWord({
      word: normalizedWord,
      index,
    });
  };

  const handleAddWord = async () => {
    if (!selectedWord || !text) return;

    setSavingWordIndex(selectedWord.index);
    setErrorText(null);
    setWordFeedback(null);

    try {
      const result = await saveVocabularyWord({
        readingTextId: text.id,
        word: selectedWord.word,
        wordIndex: selectedWord.index,
      });

      setSavedWords((prev) => new Set(prev).add(result.wordIndex));
      setSelectedWord(null);
      setWordFeedback(null);
    } catch (error) {
      setWordFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось сохранить слово. Попробуй еще раз.",
      });
    } finally {
      setSavingWordIndex(null);
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
      setWordFeedback(null);
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
  const generateActionLabel = text
    ? "Сгенерировать новый текст"
    : generateButtonLabel;
  const shouldShowIdleGeneration =
    !isStateLoading && !loading && !text && !isReadingCompletedToday;

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-3 px-3.5 pb-3 pt-3 min-[390px]:px-4 min-[480px]:max-w-[390px] min-[480px]:px-3">
      <ScreenHeader title="Текст" onBack={onBack} />

      {shouldShowIdleGeneration && (
        <>
          <ReadingGenerationCard
            userLevel={userLevel}
            remainingAttempts={remainingAttempts}
            dailyLimit={dailyLimit}
            readingMinutes={readingMinutes}
            buttonLabel={generateActionLabel}
            disabled={isGenerateDisabled}
            onGenerate={handleGenerate}
          />

          {errorText && (
            <InlineStatusCard
              variant="error"
              title="Не удалось сгенерировать текст"
              description={errorText}
            />
          )}

          <ReadingInfoCard />
        </>
      )}

      {isStateLoading && (
        <LoadingState message="Загружаем текст..." />
      )}

      {loading && (
        <LoadingState message="Генерируем текст..." />
      )}

      {isReadingCompletedToday && (
        <InlineStatusCard
          variant="success"
          title="Текст на сегодня прочитан"
          description="Новый текст будет доступен завтра."
        />
      )}

      {text && !loading && (
        <ReadingGeneratedToolbar
          userLevel={userLevel}
          remainingAttempts={remainingAttempts}
          dailyLimit={dailyLimit}
          readingMinutes={readingMinutes}
          buttonLabel={generateActionLabel}
          disabled={isGenerateDisabled}
          onGenerate={handleGenerate}
        />
      )}

      {errorText && !shouldShowIdleGeneration && (
        <InlineStatusCard
          variant="error"
          title="Не удалось сгенерировать текст"
          description={errorText}
        />
      )}

      {text && !loading && (
        <ReadingTextCard
          text={text}
          selectedWord={selectedWord}
          savedWords={savedWords}
          savingWordIndex={savingWordIndex}
          wordFeedback={wordFeedback}
          onWordClick={handleWordClick}
          onAddWord={handleAddWord}
          onCancelWord={() => {
            setSelectedWord(null);
            setWordFeedback(null);
          }}
        />
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
    </div>
  );
};
