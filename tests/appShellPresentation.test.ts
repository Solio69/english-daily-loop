import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getHomePresentation,
  getVocabularyTile,
} from '../src/utils/homePresentation'
import {
  formatCompletedDateTime,
  getModelLabel,
} from '../src/utils/materialsPresentation'
import { requireReadingHistoryPage } from '../src/services/materialsContracts'
import {
  isThemePreference,
  resolveEffectiveTheme,
  resolveSystemTheme,
} from '../src/utils/themePreference'
import {
  APP_SHELL,
  APP_SHELL_HOME_CASES,
  APP_SHELL_FIRST_PAGE,
  APP_SHELL_INVALID_PAGE,
  APP_SHELL_READY_VOCABULARY_STATE,
  APP_SHELL_THEME_CASES,
  APP_SHELL_VOCABULARY_STATE,
} from './mocks/appShell'

test('home keeps the reading and review lesson labels', () => {
  const reading = getHomePresentation(APP_SHELL_HOME_CASES.readingInProgress)
  const review = getHomePresentation(APP_SHELL_HOME_CASES.reviewRequired)
  const completed = getHomePresentation(APP_SHELL_HOME_CASES.completed)

  assert.deepEqual(
    reading.lessonDescriptionLines,
    APP_SHELL.inProgressDescriptionLines,
  )
  assert.deepEqual(review.lessonDescriptionLines, [APP_SHELL.reviewDescription])
  assert.deepEqual(completed.lessonDescriptionLines, [
    APP_SHELL.completedDescription,
  ])
  assert.equal(completed.isLessonCompleted, true)
  assert.equal(review.readingChipState, APP_SHELL.completedChipState)
})

test('home vocabulary summary keeps pending, ready and loading text', () => {
  assert.equal(
    getVocabularyTile({ state: APP_SHELL_VOCABULARY_STATE, isLoading: false })
      .text,
    APP_SHELL.pendingTile,
  )
  assert.equal(
    getVocabularyTile({
      state: APP_SHELL_READY_VOCABULARY_STATE,
      isLoading: false,
    }).text,
    APP_SHELL.readyTile,
  )
  assert.equal(
    getVocabularyTile({ state: null, isLoading: true }).text,
    APP_SHELL.loadingTile,
  )
})

test('theme resolution keeps Telegram priority and explicit preferences', () => {
  assert.equal(
    resolveSystemTheme(APP_SHELL_THEME_CASES.telegramDark),
    APP_SHELL.darkTheme,
  )
  assert.equal(
    resolveSystemTheme(APP_SHELL_THEME_CASES.browserDark),
    APP_SHELL.darkTheme,
  )
  assert.equal(
    resolveSystemTheme(APP_SHELL_THEME_CASES.browserLight),
    APP_SHELL.lightTheme,
  )
  assert.equal(
    resolveEffectiveTheme(APP_SHELL_THEME_CASES.explicitLight),
    APP_SHELL.lightTheme,
  )
  assert.equal(
    resolveEffectiveTheme(APP_SHELL_THEME_CASES.systemDark),
    APP_SHELL.darkTheme,
  )
  assert.equal(isThemePreference(APP_SHELL.unknownValue), false)
})

test('history presentation keeps Moscow time and short model name', () => {
  assert.equal(
    formatCompletedDateTime(APP_SHELL.fixedDate),
    APP_SHELL.completedAtLabel,
  )
  assert.equal(getModelLabel(APP_SHELL.invalidModel), APP_SHELL.modelLabel)
})

test('history boundary accepts complete pages and rejects malformed cards', () => {
  assert.deepEqual(
    requireReadingHistoryPage(APP_SHELL_FIRST_PAGE),
    APP_SHELL_FIRST_PAGE,
  )
  assert.throws(() => requireReadingHistoryPage(APP_SHELL_INVALID_PAGE), {
    message: APP_SHELL.invalidResponseMessage,
  })
})
