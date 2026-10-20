import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseReadingGenerationPayload,
  parseReadingState,
} from '../src/services/readingContracts.ts'
import {
  ACTIVE_READING_STATE,
  GENERATION_API_PAYLOAD,
  INVALID_GENERATION_PAYLOAD,
  INVALID_READING_STATE,
  READING_SCREEN_CASE,
} from './mocks/readingScreen.ts'

test('reading API state keeps the active text and saved position', () => {
  const state = parseReadingState(ACTIVE_READING_STATE)
  assert.equal(state.activeText?.id, READING_SCREEN_CASE.textId)
  assert.equal(state.activeText?.lastReadParagraphIndex, null)
})

test('reading API rejects a malformed active text before UI use', () => {
  assert.throws(() => parseReadingState(INVALID_READING_STATE), {
    message: READING_SCREEN_CASE.invalidStateMessage,
  })
})

test('generation API keeps the existing response counters and model', () => {
  const result = parseReadingGenerationPayload(GENERATION_API_PAYLOAD)
  assert.equal(
    result.remainingAttempts,
    READING_SCREEN_CASE.newRemainingAttempts,
  )
  assert.equal(result.generation.model, READING_SCREEN_CASE.model)
})

test('generation API accepts nullable duplicate-attempt metadata', () => {
  const result = parseReadingGenerationPayload({
    ...GENERATION_API_PAYLOAD,
    generation: {
      provider: READING_SCREEN_CASE.provider,
      model: null,
      fallbackUsed: null,
      promptVersion: null,
    },
  })
  assert.equal(result.generation.model, null)
})

test('generation API rejects malformed text with a safe message', () => {
  assert.throws(
    () => parseReadingGenerationPayload(INVALID_GENERATION_PAYLOAD),
    { message: READING_SCREEN_CASE.invalidGenerationMessage },
  )
})
