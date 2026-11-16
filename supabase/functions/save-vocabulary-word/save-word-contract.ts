import { fail, HTTP_STATUS } from '../_shared/server.ts'
import { normalizeVocabularyWord } from '../_shared/vocabulary.ts'

const WORD_PATTERN = /^[a-z][a-z'-]{0,39}$/
const MIN_WORD_INDEX = 0

export const SAVE_WORD_CODE = {
  readingTextIdRequired: 'READING_TEXT_ID_REQUIRED',
  wordRequired: 'WORD_REQUIRED',
  invalidWord: 'INVALID_WORD',
  invalidWordIndex: 'INVALID_WORD_INDEX',
  wordMismatch: 'WORD_MISMATCH',
  noActiveText: 'NO_ACTIVE_READING_TEXT',
  activeTextChanged: 'ACTIVE_TEXT_CHANGED',
  activeTextLoadFailed: 'ACTIVE_TEXT_LOAD_FAILED',
  vocabularyLimitExceeded: 'VOCABULARY_LIMIT_EXCEEDED',
  saveFailed: 'VOCABULARY_SAVE_FAILED',
} as const

export const SAVE_WORD_ERROR = {
  activeTextUnavailable: 'Текст изменился или уже недоступен. Обнови экран.',
  activeTextLoad: 'Failed to load active reading text.',
  saveFailed: 'Не удалось проверить словарь. Попробуй еще раз.',
  saveRejected: 'Не удалось сохранить слово. Попробуй еще раз.',
  limitExceeded:
    'Лимит словаря исчерпан. Перейди на другой тариф, чтобы добавить больше слов.',
  readingTextIdRequired: 'readingTextId is required.',
  wordRequired: 'word is required.',
  invalidWord: 'Selected word is invalid.',
  invalidWordIndex: 'wordIndex must be a non-negative integer.',
  outsideText: 'wordIndex is outside of the active text.',
  wordMismatch: 'Selected word does not match active text.',
} as const

const parseString = ({
  value,
  code,
  message,
}: {
  value: unknown
  code: string
  message: string
}): string => {
  const parsed = typeof value === 'string' ? value.trim() : ''
  if (!parsed) fail(HTTP_STATUS.BAD_REQUEST, code, message)
  return parsed
}

export const parseSaveWordInput = (body: {
  readingTextId?: unknown
  word?: unknown
  wordIndex?: unknown
}) => {
  const readingTextId = parseString({
    value: body?.readingTextId,
    code: SAVE_WORD_CODE.readingTextIdRequired,
    message: SAVE_WORD_ERROR.readingTextIdRequired,
  })
  const selectedWordRaw = parseString({
    value: body?.word,
    code: SAVE_WORD_CODE.wordRequired,
    message: SAVE_WORD_ERROR.wordRequired,
  })
  const word = normalizeVocabularyWord(selectedWordRaw)
  if (!WORD_PATTERN.test(word)) {
    fail(
      HTTP_STATUS.BAD_REQUEST,
      SAVE_WORD_CODE.invalidWord,
      SAVE_WORD_ERROR.invalidWord,
    )
  }

  const wordIndex =
    typeof body?.wordIndex === 'number'
      ? body.wordIndex
      : Number(body?.wordIndex)
  const invalidIndex =
    !Number.isInteger(wordIndex) || wordIndex < MIN_WORD_INDEX
  if (invalidIndex) {
    fail(
      HTTP_STATUS.BAD_REQUEST,
      SAVE_WORD_CODE.invalidWordIndex,
      SAVE_WORD_ERROR.invalidWordIndex,
    )
  }

  return { readingTextId, word, wordIndex }
}

export const rejectSaveWordResult = ({ code }: { code: string }): never => {
  if (code === SAVE_WORD_CODE.vocabularyLimitExceeded) {
    fail(HTTP_STATUS.TOO_MANY_REQUESTS, code, SAVE_WORD_ERROR.limitExceeded)
  }
  const activeTextChanged =
    code === SAVE_WORD_CODE.noActiveText ||
    code === SAVE_WORD_CODE.activeTextChanged
  if (activeTextChanged) {
    fail(HTTP_STATUS.CONFLICT, code, SAVE_WORD_ERROR.activeTextUnavailable)
  }
  fail(HTTP_STATUS.INTERNAL_SERVER_ERROR, code, SAVE_WORD_ERROR.saveRejected)
}
