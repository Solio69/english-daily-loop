import {
  assertSafeText,
  countWords,
  normalizePlainText,
  stripCodeFence,
} from '../_shared/ai-text.ts'
import type {
  EnglishLevel,
  GeneratedReadingText,
  ReadingGenerationConfig,
  ReadingMinutes,
} from './ai-pipeline.ts'

export const parseGeneratedJson = (
  raw: string,
  targetLevel: EnglishLevel,
  readingMinutes: ReadingMinutes,
  config: ReadingGenerationConfig,
): Omit<GeneratedReadingText, 'usedModel' | 'promptVersion'> => {
  const parsed = JSON.parse(stripCodeFence(raw)) as {
    title?: unknown
    body?: unknown
    estimatedMinutes?: unknown
    level?: unknown
  }

  if (typeof parsed.title !== 'string') {
    throw new Error('Generated JSON has invalid title.')
  }
  if (typeof parsed.body !== 'string') {
    throw new Error('Generated JSON has invalid body.')
  }
  if (parsed.estimatedMinutes !== readingMinutes) {
    throw new Error('Generated JSON has invalid estimatedMinutes.')
  }
  if (parsed.level !== targetLevel) {
    throw new Error('Generated JSON has invalid level.')
  }

  const title = normalizePlainText(parsed.title)
  const body = parsed.body.trim()
  if (!title) {
    throw new Error('Generated title is empty.')
  }
  if (!body) {
    throw new Error('Generated body is empty.')
  }

  const titleWordCount = countWords(title)
  if (titleWordCount < 3 || titleWordCount > 8 || title.length > 80) {
    throw new Error('Generated title length is invalid.')
  }

  assertSafeText('Generated title', title)
  assertSafeText('Generated body', body)

  const wordCount = countWords(body)
  if (
    wordCount < config.validationWordMin ||
    wordCount > config.validationWordMax
  ) {
    throw new Error(
      `Generated body has ${wordCount} words, expected ${config.validationWordMin}-${config.validationWordMax}.`,
    )
  }

  return {
    title,
    body,
    estimatedMinutes: readingMinutes,
    level: targetLevel,
    validation: {
      wordCount,
    },
  }
}
