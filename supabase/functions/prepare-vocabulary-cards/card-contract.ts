/// <reference path="../deno-globals.d.ts" />

import {
  assertAsciiEnglishText,
  assertSafeText,
  countWords,
  normalizePlainText,
  stripCodeFence,
} from '../_shared/ai-text.ts'
import {
  normalizeVocabularyWord,
  type EnglishLevel,
  type VocabularyCard,
  type VocabularyCardBatchItem,
} from '../_shared/vocabulary.ts'

const ALLOWED_PARTS_OF_SPEECH = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'conjunction',
  'pronoun',
  'phrase',
  'other',
])

export class VocabularyAiError extends Error {
  stage: 'provider_request' | 'provider_response' | 'output_validation'
  model: string | null
  finishReason: string | null
  completionTokens: number | null
  reasoningTokens: number | null
  providerStatus: number | null
  providerErrorCode: string | null

  constructor(
    message: string,
    metadata: {
      stage?: 'provider_request' | 'provider_response' | 'output_validation'
      model?: string | null
      finishReason?: string | null
      completionTokens?: number | null
      reasoningTokens?: number | null
      providerStatus?: number | null
      providerErrorCode?: string | number | null
    } = {},
  ) {
    super(message)
    this.stage = metadata.stage ?? 'output_validation'
    this.model = metadata.model ?? null
    this.finishReason = metadata.finishReason ?? null
    this.completionTokens = metadata.completionTokens ?? null
    this.reasoningTokens = metadata.reasoningTokens ?? null
    this.providerStatus = metadata.providerStatus ?? null
    this.providerErrorCode =
      metadata.providerErrorCode == null
        ? null
        : String(metadata.providerErrorCode)
  }
}

const extractJsonObjectFromModelResponse = (raw: string): string => {
  const withoutFence = stripCodeFence(raw)
  const start = withoutFence.indexOf('{')
  const end = withoutFence.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    return withoutFence
  }

  return withoutFence.slice(start, end + 1)
}

const assertVocabularySafeText = (field: string, value: string): void => {
  try {
    assertSafeText(field, value)
  } catch (error) {
    throw new VocabularyAiError(
      error instanceof Error ? error.message : `${field} is invalid.`,
    )
  }
}

const assertVocabularyAsciiEnglishText = (
  field: string,
  value: string,
): void => {
  try {
    assertAsciiEnglishText(field, value)
  } catch (error) {
    throw new VocabularyAiError(
      error instanceof Error ? error.message : `${field} is invalid.`,
    )
  }
}

const parseCardJson = (
  raw: string,
  lemma: string,
  level: EnglishLevel,
): VocabularyCard => {
  const parsed = JSON.parse(extractJsonObjectFromModelResponse(raw)) as {
    word?: unknown
    translation?: unknown
    partOfSpeech?: unknown
    isVerb?: unknown
    isRegularVerb?: unknown
    verbForms?: unknown
    examples?: unknown
    level?: unknown
  }

  if (typeof parsed.word !== 'string') {
    throw new VocabularyAiError('Card JSON has invalid word.')
  }
  if (normalizeVocabularyWord(parsed.word) !== lemma) {
    throw new VocabularyAiError('Card word does not match lemma.')
  }
  if (typeof parsed.translation !== 'string') {
    throw new VocabularyAiError('Card JSON has invalid translation.')
  }
  if (typeof parsed.partOfSpeech !== 'string') {
    throw new VocabularyAiError('Card JSON has invalid partOfSpeech.')
  }
  if (typeof parsed.isVerb !== 'boolean') {
    throw new VocabularyAiError('Card JSON has invalid isVerb.')
  }
  if (!Array.isArray(parsed.examples) || parsed.examples.length !== 3) {
    throw new VocabularyAiError('Card JSON must contain exactly 3 examples.')
  }

  const translation = normalizePlainText(parsed.translation)
  const partOfSpeech = normalizePlainText(parsed.partOfSpeech).toLowerCase()
  if (!translation || translation.length > 120) {
    throw new VocabularyAiError('Card translation is invalid.')
  }
  if (!ALLOWED_PARTS_OF_SPEECH.has(partOfSpeech)) {
    throw new VocabularyAiError('Card partOfSpeech is unsupported.')
  }

  assertVocabularySafeText('translation', translation)

  const examples = parsed.examples.map((example, index) => {
    if (typeof example !== 'string') {
      throw new VocabularyAiError(`Example ${index + 1} is invalid.`)
    }

    const normalized = normalizePlainText(example)
    if (!normalized || normalized.length > 180) {
      throw new VocabularyAiError(`Example ${index + 1} length is invalid.`)
    }
    if (countWords(normalized) < 3 || countWords(normalized) > 20) {
      throw new VocabularyAiError(`Example ${index + 1} word count is invalid.`)
    }

    assertVocabularySafeText(`example ${index + 1}`, normalized)
    assertVocabularyAsciiEnglishText(`example ${index + 1}`, normalized)
    return normalized
  })

  let isRegularVerb: boolean | null = null
  let verbForms: VocabularyCard['verbForms'] = null

  if (parsed.isVerb) {
    if (typeof parsed.isRegularVerb !== 'boolean') {
      throw new VocabularyAiError('Verb card has invalid isRegularVerb.')
    }
    if (!parsed.verbForms || typeof parsed.verbForms !== 'object') {
      throw new VocabularyAiError('Verb card has invalid verbForms.')
    }

    const forms = parsed.verbForms as {
      base?: unknown
      past?: unknown
      pastParticiple?: unknown
    }
    if (
      typeof forms.base !== 'string' ||
      typeof forms.past !== 'string' ||
      typeof forms.pastParticiple !== 'string'
    ) {
      throw new VocabularyAiError('Verb forms must be strings.')
    }

    verbForms = {
      base: normalizeVocabularyWord(forms.base),
      past: normalizeVocabularyWord(forms.past),
      pastParticiple: normalizeVocabularyWord(forms.pastParticiple),
    }

    if (!verbForms.base || !verbForms.past || !verbForms.pastParticiple) {
      throw new VocabularyAiError('Verb forms must not be empty.')
    }
    if (verbForms.base !== lemma) {
      throw new VocabularyAiError('Verb base form does not match lemma.')
    }

    isRegularVerb = parsed.isRegularVerb
  } else if (parsed.isRegularVerb != null || parsed.verbForms != null) {
    throw new VocabularyAiError('Non-verb card must not contain verb data.')
  }

  return {
    word: lemma,
    translation,
    partOfSpeech,
    isVerb: parsed.isVerb,
    isRegularVerb,
    verbForms,
    examples,
    level,
  }
}

export const parseCardBatchJson = (
  raw: string,
  expectedIds: Set<string>,
  level: EnglishLevel,
): VocabularyCardBatchItem[] => {
  const parsed = JSON.parse(extractJsonObjectFromModelResponse(raw)) as {
    cards?: unknown
  }
  if (!Array.isArray(parsed.cards)) {
    throw new VocabularyAiError('Batch JSON has invalid cards.')
  }

  const seenIds = new Set<string>()
  const validCards: VocabularyCardBatchItem[] = []

  for (const item of parsed.cards) {
    try {
      if (!item || typeof item !== 'object') {
        throw new VocabularyAiError('Batch card is invalid.')
      }

      const rawItem = item as { id?: unknown; word?: unknown }
      if (typeof rawItem.id !== 'string' || !expectedIds.has(rawItem.id)) {
        throw new VocabularyAiError('Batch card id is invalid.')
      }
      if (seenIds.has(rawItem.id)) {
        throw new VocabularyAiError('Batch card id is duplicated.')
      }

      if (typeof rawItem.word !== 'string') {
        throw new VocabularyAiError('Batch card word is invalid.')
      }

      const lemma = normalizeVocabularyWord(rawItem.word)
      if (!/^[a-z][a-z'-]{0,39}$/.test(lemma)) {
        throw new VocabularyAiError('Batch card word is invalid.')
      }

      const card = {
        ...parseCardJson(JSON.stringify(item), lemma, level),
        id: rawItem.id,
      }

      seenIds.add(rawItem.id)
      validCards.push(card)
    } catch (error) {
      console.warn(
        '[prepare-vocabulary-cards] skipped invalid generated card',
        {
          error:
            error instanceof Error
              ? error.message
              : 'Unknown card validation error.',
        },
      )
    }
  }

  if (validCards.length === 0) {
    throw new VocabularyAiError('Batch JSON has no valid cards.')
  }

  return validCards
}
