import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VocabularyTab } from '../../src/components/vocabulary/VocabularyTab'
import { VocabularyScreen } from '../../src/screens/VocabularyScreen'
import {
  InvalidVocabularyResponseError,
  isVocabularyReviewState,
  isVocabularyState,
  isVocabularyWordsPage,
  requireVocabularyResponse,
} from '../../src/services/vocabularyContracts'
import {
  INVALID_VOCABULARY_REVIEW_STATE,
  INVALID_VOCABULARY_STATE,
  VOCABULARY_APPROVAL_STATE,
  VOCABULARY_APPROVAL_WORDS,
  VOCABULARY_CLIENT,
  VOCABULARY_EMPTY_REVIEW_STATE,
  VOCABULARY_PREPARED,
  VOCABULARY_REVIEW_STATE,
  VOCABULARY_STATE,
  VOCABULARY_WORDS,
} from '../mocks/vocabularyClient'

const api = vi.hoisted(() => ({
  getVocabularyReviewState: vi.fn(),
  reviewVocabularyWord: vi.fn(),
  getVocabularyState: vi.fn(),
  getVocabularyWords: vi.fn(),
  prepareVocabularyCards: vi.fn(),
  approveVocabularyCard: vi.fn(),
  approveVocabularyCards: vi.fn(),
}))

vi.mock('../../src/services/vocabularyService', () => api)

beforeEach(() => {
  vi.clearAllMocks()
  api.getVocabularyReviewState.mockResolvedValue(VOCABULARY_REVIEW_STATE)
  api.reviewVocabularyWord.mockResolvedValue({})
  api.getVocabularyState.mockResolvedValue(VOCABULARY_STATE)
  api.getVocabularyWords.mockResolvedValue(VOCABULARY_WORDS)
  api.prepareVocabularyCards.mockResolvedValue(VOCABULARY_PREPARED)
})

describe('vocabulary client contracts', () => {
  it('accepts current review, state and list payloads', () => {
    expect(isVocabularyReviewState(VOCABULARY_REVIEW_STATE)).toBe(true)
    expect(isVocabularyState(VOCABULARY_STATE)).toBe(true)
    expect(isVocabularyWordsPage(VOCABULARY_WORDS)).toBe(true)
  })

  it('rejects damaged counters and card actions', () => {
    expect(isVocabularyState(INVALID_VOCABULARY_STATE)).toBe(false)
    expect(isVocabularyReviewState(INVALID_VOCABULARY_REVIEW_STATE)).toBe(false)
  })

  it('returns a safe error for an invalid response', () => {
    expect(() =>
      requireVocabularyResponse({
        value: INVALID_VOCABULARY_STATE,
        guard: isVocabularyState,
      }),
    ).toThrow(VOCABULARY_CLIENT.invalidResponse)
  })
})

describe('VocabularyScreen', () => {
  it('keeps the current load error state', async () => {
    api.getVocabularyReviewState.mockRejectedValueOnce(
      new Error(VOCABULARY_CLIENT.networkError),
    )
    render(
      <VocabularyScreen onBack={vi.fn()} onOpenVocabularyMaterials={vi.fn()} />,
    )
    expect(
      await screen.findByText(VOCABULARY_CLIENT.networkError),
    ).toBeVisible()
  })

  it('shows the current card and reports a saved review', async () => {
    api.getVocabularyReviewState
      .mockResolvedValueOnce(VOCABULARY_REVIEW_STATE)
      .mockResolvedValueOnce(VOCABULARY_EMPTY_REVIEW_STATE)
    const onReviewStatusChange = vi.fn()
    const user = userEvent.setup()
    render(
      <VocabularyScreen
        onBack={vi.fn()}
        onOpenVocabularyMaterials={vi.fn()}
        onReviewStatusChange={onReviewStatusChange}
      />,
    )
    await user.click(
      await screen.findByRole('button', {
        name: VOCABULARY_CLIENT.revealButton,
      }),
    )
    await user.click(
      screen.getByRole('button', { name: VOCABULARY_CLIENT.reviewButton }),
    )
    await waitFor(() => expect(api.reviewVocabularyWord).toHaveBeenCalledOnce())
    expect(api.reviewVocabularyWord).toHaveBeenCalledWith(
      VOCABULARY_CLIENT.wordId,
      VOCABULARY_CLIENT.reviewAction,
    )
    expect(
      await screen.findByText(VOCABULARY_CLIENT.emptyHeading),
    ).toBeVisible()
    expect(onReviewStatusChange).toHaveBeenLastCalledWith(
      VOCABULARY_EMPTY_REVIEW_STATE.status,
      VOCABULARY_EMPTY_REVIEW_STATE.remainingRequiredCount,
      VOCABULARY_EMPTY_REVIEW_STATE.reviewedTodayCount,
    )
  })

  it('blocks repeat review until a failed refresh is retried', async () => {
    api.getVocabularyReviewState
      .mockResolvedValueOnce(VOCABULARY_REVIEW_STATE)
      .mockRejectedValueOnce(new Error(VOCABULARY_CLIENT.networkError))
      .mockResolvedValueOnce(VOCABULARY_EMPTY_REVIEW_STATE)
    const user = userEvent.setup()
    render(
      <VocabularyScreen onBack={vi.fn()} onOpenVocabularyMaterials={vi.fn()} />,
    )
    await user.click(
      await screen.findByRole('button', {
        name: VOCABULARY_CLIENT.revealButton,
      }),
    )
    await user.click(
      screen.getByRole('button', { name: VOCABULARY_CLIENT.reviewButton }),
    )
    expect(
      await screen.findByRole('heading', {
        name: VOCABULARY_CLIENT.savedHeading,
      }),
    ).toBeVisible()
    expect(api.reviewVocabularyWord).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('button', { name: VOCABULARY_CLIENT.reviewButton }),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: VOCABULARY_CLIENT.retryButton }),
    )
    expect(
      await screen.findByText(VOCABULARY_CLIENT.emptyHeading),
    ).toBeVisible()
    expect(api.reviewVocabularyWord).toHaveBeenCalledOnce()
  })

  it('sends one review request for rapid repeated clicks', async () => {
    let completeReview: () => void = () => undefined
    const inFlight = new Promise<void>((resolve) => {
      completeReview = resolve
    })
    api.reviewVocabularyWord.mockReturnValueOnce(inFlight)
    const user = userEvent.setup()
    render(
      <VocabularyScreen onBack={vi.fn()} onOpenVocabularyMaterials={vi.fn()} />,
    )
    await user.click(
      await screen.findByRole('button', {
        name: VOCABULARY_CLIENT.revealButton,
      }),
    )
    const actionButton = screen.getByRole('button', {
      name: VOCABULARY_CLIENT.reviewButton,
    })
    fireEvent.click(actionButton)
    fireEvent.click(actionButton)
    expect(api.reviewVocabularyWord).toHaveBeenCalledOnce()
    completeReview()
    await waitFor(() =>
      expect(api.getVocabularyReviewState).toHaveBeenCalledTimes(
        VOCABULARY_CLIENT.two,
      ),
    )
  })

  it('holds the old card after a malformed mutation response', async () => {
    api.reviewVocabularyWord.mockRejectedValueOnce(
      new InvalidVocabularyResponseError(),
    )
    const user = userEvent.setup()
    render(
      <VocabularyScreen onBack={vi.fn()} onOpenVocabularyMaterials={vi.fn()} />,
    )
    await user.click(
      await screen.findByRole('button', {
        name: VOCABULARY_CLIENT.revealButton,
      }),
    )
    await user.click(
      screen.getByRole('button', { name: VOCABULARY_CLIENT.reviewButton }),
    )
    expect(
      await screen.findByRole('heading', {
        name: VOCABULARY_CLIENT.savedHeading,
      }),
    ).toBeVisible()
    expect(api.reviewVocabularyWord).toHaveBeenCalledOnce()
  })
})

describe('VocabularyTab', () => {
  it('refreshes state and words after card preparation', async () => {
    const user = userEvent.setup()
    render(<VocabularyTab isActive />)
    await user.click(
      await screen.findByRole('button', {
        name: VOCABULARY_CLIENT.prepareButton,
      }),
    )
    await waitFor(() =>
      expect(api.prepareVocabularyCards).toHaveBeenCalledOnce(),
    )
    await waitFor(() =>
      expect(api.getVocabularyState).toHaveBeenCalledTimes(
        VOCABULARY_CLIENT.two,
      ),
    )
    expect(api.getVocabularyWords).toHaveBeenCalledTimes(VOCABULARY_CLIENT.two)
  })

  it('keeps approval controls hidden', async () => {
    api.getVocabularyState.mockResolvedValueOnce(VOCABULARY_APPROVAL_STATE)
    api.getVocabularyWords.mockResolvedValueOnce(VOCABULARY_APPROVAL_WORDS)
    render(<VocabularyTab isActive />)
    await screen.findByText(VOCABULARY_CLIENT.dictionaryHeading)
    expect(
      screen.queryByText(VOCABULARY_CLIENT.approvalHeading),
    ).not.toBeInTheDocument()
  })
})
