import { fail, HTTP_STATUS } from '../_shared/server.ts'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MIN_WORD_INDEX = 0

export const DELETE_WORD_CODE = {
  invalidReadingTextId: 'INVALID_READING_TEXT_ID',
  invalidWordIndex: 'INVALID_WORD_INDEX',
  activeTextChanged: 'ACTIVE_TEXT_CHANGED',
  activeTextLoadFailed: 'ACTIVE_TEXT_LOAD_FAILED',
  cardAlreadyPrepared: 'VOCABULARY_CARD_ALREADY_PREPARED',
  sourceNotFound: 'VOCABULARY_SOURCE_NOT_FOUND',
  invalidDeleteInput: 'INVALID_DELETE_INPUT',
  deleteFailed: 'VOCABULARY_DELETE_FAILED',
} as const

export const DELETE_WORD_ERROR = {
  activeTextUnavailable: 'Текст изменился или уже недоступен. Обнови экран.',
  deleteFailed: 'Не удалось удалить слово. Попробуй еще раз.',
  invalidReadingTextId: 'readingTextId must be a valid UUID.',
  invalidWordIndex: 'wordIndex must be a non-negative integer.',
  cardAlreadyPrepared:
    'Карточка уже подготовлена — удалить слово здесь нельзя.',
  sourceNotFound:
    'Слово уже удалено или состояние текста изменилось. Обнови экран.',
  invalidDeleteInput: 'Не удалось определить выбранное слово.',
} as const

export const parseDeleteWordInput = (body: {
  readingTextId?: unknown
  wordIndex?: unknown
}) => {
  const readingTextId =
    typeof body?.readingTextId === 'string' ? body.readingTextId.trim() : ''
  if (!UUID_PATTERN.test(readingTextId)) {
    fail(
      HTTP_STATUS.BAD_REQUEST,
      DELETE_WORD_CODE.invalidReadingTextId,
      DELETE_WORD_ERROR.invalidReadingTextId,
    )
  }
  const wordIndex = body?.wordIndex
  const invalidWordIndex =
    typeof wordIndex !== 'number' ||
    !Number.isInteger(wordIndex) ||
    wordIndex < MIN_WORD_INDEX
  if (invalidWordIndex) {
    fail(
      HTTP_STATUS.BAD_REQUEST,
      DELETE_WORD_CODE.invalidWordIndex,
      DELETE_WORD_ERROR.invalidWordIndex,
    )
  }
  return { readingTextId, wordIndex }
}

export const rejectDeleteWordResult = ({ code }: { code: string }): never => {
  if (code === DELETE_WORD_CODE.cardAlreadyPrepared) {
    fail(HTTP_STATUS.CONFLICT, code, DELETE_WORD_ERROR.cardAlreadyPrepared)
  }
  if (code === DELETE_WORD_CODE.activeTextChanged) {
    fail(HTTP_STATUS.CONFLICT, code, DELETE_WORD_ERROR.activeTextUnavailable)
  }
  if (code === DELETE_WORD_CODE.sourceNotFound) {
    fail(HTTP_STATUS.CONFLICT, code, DELETE_WORD_ERROR.sourceNotFound)
  }
  if (code === DELETE_WORD_CODE.invalidDeleteInput) {
    fail(HTTP_STATUS.BAD_REQUEST, code, DELETE_WORD_ERROR.invalidDeleteInput)
  }
  fail(HTTP_STATUS.INTERNAL_SERVER_ERROR, code, DELETE_WORD_ERROR.deleteFailed)
}
