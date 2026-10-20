import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReadingScreen } from '../../src/screens/ReadingScreen'
import { EdgeFunctionError } from '../../src/services/edgeFunctionErrors'
import {
  ACTIVE_READING_STATE,
  DELETED_WORD_RESULT,
  EMPTY_READING_STATE,
  GENERATED_READING_RESULT,
  READING_SCREEN_CASE,
  SAVED_WORD_RESULT,
} from '../mocks/readingScreen'

const api = vi.hoisted(() => ({
  getReadingState: vi.fn(),
  generateReadingText: vi.fn(),
  saveVocabularyWord: vi.fn(),
  deletePendingVocabularyWord: vi.fn(),
}))

vi.mock('../../src/services/readingService', () => ({
  getReadingState: api.getReadingState,
  generateReadingText: api.generateReadingText,
}))

vi.mock('../../src/services/vocabularyService', () => ({
  saveVocabularyWord: api.saveVocabularyWord,
  deletePendingVocabularyWord: api.deletePendingVocabularyWord,
}))

vi.mock('../../src/hooks/useReadingPosition', () => ({
  useReadingPosition: () => ({
    registerParagraph: vi.fn(),
    isScrollTopVisible: false,
    positionError: null,
    retryPositionSave: vi.fn(),
    scrollToPageTop: vi.fn(),
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.getReadingState.mockResolvedValue(EMPTY_READING_STATE)
  api.generateReadingText.mockResolvedValue(GENERATED_READING_RESULT)
  api.saveVocabularyWord.mockResolvedValue(SAVED_WORD_RESULT)
  api.deletePendingVocabularyWord.mockResolvedValue(DELETED_WORD_RESULT)
})

describe('ReadingScreen existing reading flow', () => {
  it('loads an empty state and offers the existing generate action', async () => {
    render(<ReadingScreen onBack={vi.fn()} />)
    expect(
      await screen.findByRole('button', {
        name: READING_SCREEN_CASE.generateButton,
      }),
    ).toBeEnabled()
    expect(api.getReadingState).toHaveBeenCalledOnce()
  })

  it('keeps the existing error state when the initial reading state fails', async () => {
    api.getReadingState.mockRejectedValueOnce(
      new Error(READING_SCREEN_CASE.networkError),
    )
    render(<ReadingScreen onBack={vi.fn()} />)
    expect(
      await screen.findByText(READING_SCREEN_CASE.networkError),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Попытки на сегодня закончились' }),
    ).toBeDisabled()
  })

  it('generates one text and updates the home status', async () => {
    const onReadingStatusChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ReadingScreen
        onBack={vi.fn()}
        onReadingStatusChange={onReadingStatusChange}
      />,
    )
    await user.click(
      await screen.findByRole('button', {
        name: READING_SCREEN_CASE.generateButton,
      }),
    )
    expect(await screen.findByText(READING_SCREEN_CASE.title)).toBeVisible()
    expect(api.generateReadingText).toHaveBeenCalledOnce()
    expect(onReadingStatusChange).toHaveBeenCalledWith(
      READING_SCREEN_CASE.changedStatus,
    )
  })

  it('recovers a new active text after an unknown generation result', async () => {
    api.getReadingState
      .mockResolvedValueOnce(EMPTY_READING_STATE)
      .mockResolvedValueOnce(ACTIVE_READING_STATE)
    api.generateReadingText.mockRejectedValueOnce(
      new Error(READING_SCREEN_CASE.networkError),
    )
    const user = userEvent.setup()
    render(<ReadingScreen onBack={vi.fn()} />)
    await user.click(
      await screen.findByRole('button', {
        name: READING_SCREEN_CASE.generateButton,
      }),
    )
    expect(await screen.findByText(READING_SCREEN_CASE.title)).toBeVisible()
    expect(api.getReadingState).toHaveBeenCalledTimes(
      READING_SCREEN_CASE.stateReadsAfterRecovery,
    )
    expect(
      screen.queryByText(READING_SCREEN_CASE.networkError),
    ).not.toBeInTheDocument()
  })

  it('saves and deletes a pending word through the existing vocabulary API', async () => {
    api.getReadingState.mockResolvedValue(ACTIVE_READING_STATE)
    const user = userEvent.setup()
    render(<ReadingScreen onBack={vi.fn()} />)
    await user.click(await screen.findByText(READING_SCREEN_CASE.word))
    await user.click(
      screen.getByRole('button', { name: READING_SCREEN_CASE.addButton }),
    )
    await waitFor(() => expect(api.saveVocabularyWord).toHaveBeenCalledOnce())
    await user.click(screen.getByText(READING_SCREEN_CASE.word))
    await user.click(
      screen.getByRole('button', { name: READING_SCREEN_CASE.deleteButton }),
    )
    await waitFor(() =>
      expect(api.deletePendingVocabularyWord).toHaveBeenCalledOnce(),
    )
  })

  it('refreshes a stale pending word after a source conflict', async () => {
    api.getReadingState
      .mockResolvedValueOnce({
        ...ACTIVE_READING_STATE,
        activeText: {
          ...ACTIVE_READING_STATE.activeText,
          savedWordIndexes: [READING_SCREEN_CASE.wordIndex],
          pendingSavedWordIndexes: [READING_SCREEN_CASE.wordIndex],
        },
      })
      .mockResolvedValueOnce(ACTIVE_READING_STATE)
    api.deletePendingVocabularyWord.mockRejectedValueOnce(
      new EdgeFunctionError({
        code: 'VOCABULARY_SOURCE_NOT_FOUND',
        message: 'Источник уже удалён',
        requestId: 'req_f07_stale_source',
      }),
    )
    const user = userEvent.setup()
    render(<ReadingScreen onBack={vi.fn()} />)
    await user.click(await screen.findByText(READING_SCREEN_CASE.word))
    await user.click(
      screen.getByRole('button', { name: READING_SCREEN_CASE.deleteButton }),
    )
    await waitFor(() => expect(api.getReadingState).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: READING_SCREEN_CASE.deleteButton,
        }),
      ).not.toBeInTheDocument(),
    )
    await user.click(screen.getByText(READING_SCREEN_CASE.word))
    expect(
      screen.getByRole('button', { name: READING_SCREEN_CASE.addButton }),
    ).toBeVisible()
  })

  it('waits for the App completion callback before navigating', async () => {
    api.getReadingState.mockResolvedValue(ACTIVE_READING_STATE)
    let releaseCompletion: () => void = () => undefined
    const completion = new Promise<void>((resolve) => {
      releaseCompletion = resolve
    })
    const onCompleteText = vi.fn(() => completion)
    const onNext = vi.fn()
    const onReadingStatusChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ReadingScreen
        onBack={vi.fn()}
        onNext={onNext}
        onCompleteText={onCompleteText}
        onReadingStatusChange={onReadingStatusChange}
      />,
    )
    await user.click(
      await screen.findByRole('button', {
        name: READING_SCREEN_CASE.completeButton,
      }),
    )
    expect(onCompleteText).toHaveBeenCalledOnce()
    expect(onNext).not.toHaveBeenCalled()
    releaseCompletion()
    await waitFor(() => expect(onNext).toHaveBeenCalledOnce())
    expect(onCompleteText.mock.invocationCallOrder[0]).toBeLessThan(
      onNext.mock.invocationCallOrder[0],
    )
    expect(onReadingStatusChange).toHaveBeenCalledWith(
      READING_SCREEN_CASE.completedStatus,
    )
  })
})
