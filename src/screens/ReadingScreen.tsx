import { ArrowUp } from 'lucide-react'
import React from 'react'
import { Button } from '../components/Button'
import { InlineStatusCard } from '../components/InlineStatusCard'
import { LoadingState } from '../components/LoadingState'
import { ReadingGeneratedToolbar } from '../components/reading/ReadingGeneratedToolbar'
import { ReadingGenerationCard } from '../components/reading/ReadingGenerationCard'
import { ReadingInfoCard } from '../components/reading/ReadingInfoCard'
import { ReadingTextCard } from '../components/reading/ReadingTextCard'
import { ScreenHeader } from '../components/ScreenHeader'
import { AppToast } from '../components/Toast'
import { useReadingFlow } from '../hooks/useReadingFlow'
import { useReadingPosition } from '../hooks/useReadingPosition'
import type { ReadingHomeStatus } from '../types/homeProgress'

type ReadingScreenProps = {
  onBack: () => void
  onNext?: () => void
  onCompleteText?: () => Promise<void>
  onReadingStatusChange?: (status: ReadingHomeStatus) => void
  userLevel?: string | null
  readingMinutes?: number | null
}

export const ReadingScreen: React.FC<ReadingScreenProps> = ({
  onBack,
  onNext,
  onCompleteText,
  onReadingStatusChange,
  userLevel,
  readingMinutes,
}) => {
  const {
    isStateLoading,
    loading,
    text,
    dailyLimit,
    remainingAttempts,
    errorText,
    isFinishing,
    selectedWord,
    savedWords,
    wordFeedback,
    mutatingWordIndex,
    handleGenerate,
    handleDone,
    handleWordClick,
    handleAddWord,
    handleDeleteWord,
    cancelWord,
  } = useReadingFlow({
    onBack,
    onNext,
    onCompleteText,
    onReadingStatusChange,
  })
  const {
    registerParagraph,
    isScrollTopVisible,
    positionError,
    retryPositionSave,
    scrollToPageTop,
  } = useReadingPosition(text, !loading)
  const isGenerateDisabled = isStateLoading || loading || remainingAttempts <= 0
  const generateButtonLabel =
    remainingAttempts <= 0
      ? 'Попытки на сегодня закончились'
      : 'Сгенерировать текст'
  const generateActionLabel = text
    ? 'Сгенерировать новый текст'
    : generateButtonLabel
  const shouldShowIdleGeneration = !isStateLoading && !loading && !text

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

      {isStateLoading && <LoadingState message="Загружаем текст..." />}

      {loading && <LoadingState message="Генерируем текст..." />}

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
          onCancelWord={cancelWord}
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
          {isFinishing ? 'Сохраняем...' : 'Завершить текст'}
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
  )
}
