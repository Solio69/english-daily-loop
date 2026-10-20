import { ArrowUp } from "lucide-react";
import React, { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button } from "../components/Button";
import { InlineStatusCard } from "../components/InlineStatusCard";
import { LoadingState } from "../components/LoadingState";
import { ReadingGeneratedToolbar } from "../components/reading/ReadingGeneratedToolbar";
import { ReadingGenerationCard } from "../components/reading/ReadingGenerationCard";
import { ReadingInfoCard } from "../components/reading/ReadingInfoCard";
import { ReadingTextCard } from "../components/reading/ReadingTextCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { AppToast } from "../components/Toast";
import {
  generateReadingText,
  getReadingState,
} from "../services/readingService";
import {
  deletePendingVocabularyWord,
  saveVocabularyWord,
} from "../services/vocabularyService";
import { EdgeFunctionError } from "../services/edgeFunctionErrors";
import { useReadingPosition } from "../hooks/useReadingPosition";
import { ReadingHomeStatus } from "../types/homeProgress";
import { ReadingText } from "../types/reading";
import { normalizeSelectableWord } from "../utils/readingText";
import {
  removeWordIndexes,
  resolveReadingWordAction,
  shouldCloseStaleRemoveAction,
  type ReadingWordAction,
} from "../utils/readingWordAction";

const resolveReadingStatus = (
  nextText: ReadingText | null,
  hasCompletedReadingToday: boolean,
): ReadingHomeStatus => {
  if (hasCompletedReadingToday) return "completed";
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
  const generationInFlight = useRef(false);
  const [text, setText] = useState<ReadingText | null>(null);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [remainingAttempts, setRemainingAttempts] = useState(0);
  const [hasCompletedReadingToday, setHasCompletedReadingToday] =
    useState(false);
  const [selectedWord, setSelectedWord] =
    useState<ReadingWordAction | null>(null);
  const [savedWords, setSavedWords] = useState<Set<number>>(new Set());
  const [pendingSavedWords, setPendingSavedWords] = useState<Set<number>>(
    new Set(),
  );
  const [errorText, setErrorText] = useState<string | null>(null);
  const [wordFeedback, setWordFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [mutatingWordIndex, setMutatingWordIndex] = useState<number | null>(
    null,
  );
  const [isFinishing, setIsFinishing] = useState(false);
  const {
    registerParagraph,
    isScrollTopVisible,
    positionError,
    retryPositionSave,
    scrollToPageTop,
  } = useReadingPosition(text, !loading);
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
        setPendingSavedWords(
          new Set(state.activeText?.pendingSavedWordIndexes ?? []),
        );
        setSelectedWord(null);
        setWordFeedback(null);
        setDailyLimit(state.dailyLimit);
        setRemainingAttempts(state.remainingAttempts);
        setHasCompletedReadingToday(state.isReadingCompletedToday);
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
    if (generationInFlight.current || remainingAttempts <= 0) return;
    generationInFlight.current = true;
    const previousTextId = text?.id ?? null;

    setLoading(true);
    setSavedWords(new Set());
    setPendingSavedWords(new Set());
    setSelectedWord(null);
    setErrorText(null);
    setWordFeedback(null);

    try {
      const result = await generateReadingText();
      setText(result.text);
      setDailyLimit(result.dailyLimit);
      setRemainingAttempts(result.remainingAttempts);
      setErrorText(null);
      onReadingStatusChange?.(
        hasCompletedReadingToday ? "completed" : "in_progress",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось загрузить текст. Попробуй еще раз.";
      let recoveredNewText = false;

      try {
        const state = await getReadingState();
        recoveredNewText =
          state.activeText !== null && state.activeText.id !== previousTextId;
        setText(state.activeText);
        setSavedWords(new Set(state.activeText?.savedWordIndexes ?? []));
        setPendingSavedWords(
          new Set(state.activeText?.pendingSavedWordIndexes ?? []),
        );
        setDailyLimit(state.dailyLimit);
        setRemainingAttempts(state.remainingAttempts);
        setHasCompletedReadingToday(state.isReadingCompletedToday);
        onReadingStatusChange?.(
          resolveReadingStatus(state.activeText, state.isReadingCompletedToday),
        );
      } catch {
        // Keep the latest visible state if refresh fails after generation error.
      }
      setErrorText(recoveredNewText ? null : message);
    } finally {
      generationInFlight.current = false;
      setLoading(false);
    }
  };

  const handleWordClick = (word: string, index: number) => {
    const normalizedWord = normalizeSelectableWord(word);
    if (!normalizedWord || mutatingWordIndex !== null) {
      return;
    }

    const nextAction = resolveReadingWordAction({
      word: normalizedWord,
      index,
      savedWordIndexes: savedWords,
      pendingSavedWordIndexes: pendingSavedWords,
    });
    if (!nextAction) return;

    setWordFeedback(null);
    setSelectedWord(nextAction);
  };

  const handleAddWord = async () => {
    if (!selectedWord || selectedWord.mode !== "add" || !text) return;

    setMutatingWordIndex(selectedWord.index);
    setErrorText(null);
    setWordFeedback(null);

    try {
      const result = await saveVocabularyWord({
        readingTextId: text.id,
        word: selectedWord.word,
        wordIndex: selectedWord.index,
      });

      setSavedWords((prev) => new Set(prev).add(result.wordIndex));
      if (result.cardStatus === "pending") {
        setPendingSavedWords((prev) => new Set(prev).add(result.wordIndex));
      }
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
      setMutatingWordIndex(null);
    }
  };

  const refreshSavedWordState = async (
    readingTextId: string,
  ): Promise<Set<number> | null> => {
    const state = await getReadingState();
    if (state.activeText?.id !== readingTextId) return null;

    const refreshedSavedWords = new Set(
      state.activeText.savedWordIndexes ?? [],
    );
    setSavedWords(refreshedSavedWords);
    setPendingSavedWords(
      new Set(state.activeText.pendingSavedWordIndexes ?? []),
    );
    return refreshedSavedWords;
  };

  const handleDeleteWord = async () => {
    if (!selectedWord || selectedWord.mode !== "remove" || !text) return;

    const readingTextId = text.id;
    setMutatingWordIndex(selectedWord.index);
    setErrorText(null);
    setWordFeedback(null);

    try {
      const result = await deletePendingVocabularyWord({
        readingTextId,
        wordIndex: selectedWord.index,
      });

      setSavedWords((prev) =>
        removeWordIndexes(prev, result.removedWordIndexes),
      );
      setPendingSavedWords((prev) =>
        removeWordIndexes(prev, result.removedWordIndexes),
      );
      setSelectedWord(null);
    } catch (error) {
      let refreshedSavedWords: Set<number> | null = null;
      if (
        error instanceof EdgeFunctionError &&
        (error.code === "VOCABULARY_CARD_ALREADY_PREPARED" ||
          error.code === "VOCABULARY_SOURCE_NOT_FOUND")
      ) {
        try {
          refreshedSavedWords = await refreshSavedWordState(readingTextId);
        } catch {
          // Keep the visible state stable if the conflict refresh also fails.
        }
      }

      if (
        shouldCloseStaleRemoveAction({
          errorCode:
            error instanceof EdgeFunctionError ? error.code : undefined,
          selectedIndex: selectedWord.index,
          refreshedSavedWordIndexes: refreshedSavedWords,
        })
      ) {
        setSelectedWord(null);
        setWordFeedback(null);
        return;
      }

      setWordFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось удалить слово. Попробуй еще раз.",
      });
    } finally {
      setMutatingWordIndex(null);
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
      setPendingSavedWords(new Set());
      setSelectedWord(null);
      setWordFeedback(null);
      setHasCompletedReadingToday(true);
      onReadingStatusChange?.("completed");
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
    remainingAttempts <= 0;
  const generateButtonLabel =
    remainingAttempts <= 0
      ? "Попытки на сегодня закончились"
      : "Сгенерировать текст";
  const generateActionLabel = text
    ? "Сгенерировать новый текст"
    : generateButtonLabel;
  const shouldShowIdleGeneration =
    !isStateLoading && !loading && !text;

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
          mutatingWordIndex={mutatingWordIndex}
          wordFeedback={wordFeedback}
          onWordClick={handleWordClick}
          onAddWord={handleAddWord}
          onDeleteWord={handleDeleteWord}
          onCancelWord={() => {
            setSelectedWord(null);
            setWordFeedback(null);
          }}
          onParagraphRef={registerParagraph}
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

      {positionError && text && !loading && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-40 flex justify-center px-4">
          <AppToast
            variant="warning"
            title="Позиция чтения пока не сохранена"
            description={positionError}
            actionLabel="Повторить"
            onAction={retryPositionSave}
          />
        </div>
      )}

      {text && !loading && isScrollTopVisible && !positionError && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-30 mx-auto w-full max-w-[430px] px-3.5 min-[390px]:px-4 min-[480px]:max-w-[390px] min-[480px]:px-3">
          <button
            type="button"
            onClick={scrollToPageTop}
            aria-label="Вернуться к началу страницы"
            className="glass-control pointer-events-auto ml-auto grid size-12 place-items-center rounded-full text-[var(--primary)] shadow-primary-glow transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
          >
            <ArrowUp className="size-5" strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
};
