import type {
  CompletedReadingText,
  ReadingHistoryPage,
} from '../../src/types/materials'
import type { VocabularyState } from '../../src/types/vocabulary'
import {
  BOOTSTRAP_MOCKS,
  MOCK_SAVED_SETTINGS,
  MOCK_SUCCESSFUL_AUTH,
} from './bootstrap'
import { VOCABULARY_STATE } from './vocabularyClient'

export const APP_SHELL = {
  homePath: '/',
  textsShortcut: 'Тексты',
  vocabularyShortcut: 'Словарь',
  materialsHeading: 'Мои материалы',
  textsTab: 'Текстов: 1',
  vocabularyTab: 'Слов: 1',
  loadMoreButton: 'Показать еще',
  expandButton: 'Показать полностью',
  collapseButton: 'Свернуть',
  backButton: 'Назад',
  homeHeading: 'Тест!',
  errorHeading: 'Не удалось загрузить материалы',
  emptyHeading: 'Прочитанных текстов пока нет',
  darkThemeButton: 'Темная тема',
  lightThemeButton: 'Светлая тема',
  systemThemeButton: 'Как в Telegram',
  themeStorageKey: 'english-daily-loop-theme-preference',
  darkTheme: 'dark',
  lightTheme: 'light',
  systemTheme: 'system',
  role: 'radio',
  buttonRole: 'button',
  enterKey: 'Enter',
  headingRole: 'heading',
  tabRole: 'tab',
  selectedAttribute: 'aria-selected',
  expandedAttribute: 'aria-expanded',
  trueValue: 'true',
  falseValue: 'false',
  secondPageRequestCount: 2,
  pageLimit: 10,
  mobileWidth: 390,
  mobileHeight: 844,
  historyPath: '/functions/v1/get-reading-history',
  vocabularyStatePath: '/functions/v1/get-vocabulary-state',
  vocabularyWordsPath: '/functions/v1/get-vocabulary-words',
  materialsNav: 'Материалы',
  browserSchemeAttribute: 'data-theme-preference',
  darkClass: 'dark',
  htmlTag: 'html',
  tablistRole: 'tablist',
  materialsTablist: 'Материалы',
  telegramGlobal: 'Telegram',
  pathPattern: '**/*',
  emptyBody: '',
  firstHistoryRequest: {
    initData: BOOTSTRAP_MOCKS.fakeInitData,
    cursor: null,
    limit: 10,
  },
  secondHistoryRequest: {
    initData: BOOTSTRAP_MOCKS.fakeInitData,
    cursor: 'cursor-2',
    limit: 10,
  },
  errorMessage: 'История временно недоступна.',
  invalidResponseMessage: 'Некорректный ответ сервера.',
  firstPageFailure: true,
  firstTitle: 'Morning walk',
  secondTitle: 'Evening walk',
  completedAtLabel: '20 октября, 14:30',
  modelLabel: 'model-one',
  firstCursor: 'cursor-2',
  firstWord: 'hello',
  inProgressDescriptionLines: [
    'Урок начат.',
    'Вернись, чтобы закончить чтение.',
  ],
  reviewDescription: 'Осталось повторить 2 слова.',
  completedDescription: 'Сегодняшний урок завершен.',
  completedChipState: 'completed',
  pendingTile: 'Добавить: 1',
  readyTile: 'В словаре: 2',
  loadingTile: 'Проверяем словарь',
  invalidModel: 'provider/model-one:free',
  fixedDate: '2026-10-20T11:30:00.000Z',
  unknownValue: 'unknown',
  homeScreen: 'home',
  readingScreen: 'reading',
  vocabularyScreen: 'vocabulary',
  materialsScreen: 'materials',
  settingsScreen: 'settings',
  readingStep: 'reading',
  vocabularyStep: 'vocabulary',
  onboardingMessage: 'Открой настройки, чтобы продолжить.',
  onboardingTone: 'onboarding',
} as const

export const APP_SHELL_HOME_CASES = {
  readingInProgress: {
    lessonStatus: 'in_progress',
    lessonCurrentStep: 'reading',
    readingStatus: 'in_progress',
    reviewStatus: 'not_started',
    reviewDueCount: 2,
    reviewReviewedTodayCount: 0,
  },
  reviewRequired: {
    lessonStatus: 'in_progress',
    lessonCurrentStep: 'vocabulary',
    readingStatus: 'completed',
    reviewStatus: 'not_started',
    reviewDueCount: 2,
    reviewReviewedTodayCount: 0,
  },
  completed: {
    lessonStatus: 'completed',
    lessonCurrentStep: null,
    readingStatus: 'completed',
    reviewStatus: 'completed',
    reviewDueCount: 0,
    reviewReviewedTodayCount: 2,
  },
} as const

export const APP_SHELL_THEME_CASES = {
  telegramDark: { telegramColorScheme: 'dark', browserPrefersDark: false },
  browserDark: { telegramColorScheme: null, browserPrefersDark: true },
  browserLight: { telegramColorScheme: null, browserPrefersDark: false },
  explicitLight: { preference: 'light', systemTheme: 'dark' },
  systemDark: { preference: 'system', systemTheme: 'dark' },
} as const

export const APP_SHELL_NAVIGATION_CASES = {
  firstSetup: {
    currentScreen: 'home',
    isSettingsCompleted: false,
    lessonCurrentStep: 'reading',
  },
  ready: {
    currentScreen: 'home',
    isSettingsCompleted: true,
    lessonCurrentStep: 'reading',
  },
  review: {
    currentScreen: 'home',
    isSettingsCompleted: true,
    lessonCurrentStep: 'vocabulary',
  },
  rootOptions: { root: true },
} as const

export const APP_SHELL_AUTH = {
  ...MOCK_SUCCESSFUL_AUTH,
  data: {
    ...MOCK_SUCCESSFUL_AUTH.data,
    user: MOCK_SAVED_SETTINGS.data.user,
    settings: MOCK_SAVED_SETTINGS.data.settings,
    completedReadingTextCount: 1,
  },
}

export const APP_SHELL_FIRST_SETUP_AUTH = MOCK_SUCCESSFUL_AUTH

export const APP_SHELL_VOCABULARY_STATE: VocabularyState = {
  ...VOCABULARY_STATE,
  totalCount: 1,
}

export const APP_SHELL_READY_VOCABULARY_STATE: VocabularyState = {
  ...VOCABULARY_STATE,
  pendingCount: 0,
  readyCount: 2,
  totalCount: 2,
}

export const APP_SHELL_FIRST_TEXT: CompletedReadingText = {
  id: 'f1300000-0000-4000-8000-000000000001',
  completedDate: '2026-10-20',
  completedAt: APP_SHELL.fixedDate,
  title: APP_SHELL.firstTitle,
  body: 'A walk in the morning. The sky is blue and the air is fresh.',
  level: 'A2',
  estimatedMinutes: 5,
  generation: {
    provider: 'openrouter',
    model: APP_SHELL.invalidModel,
    fallbackUsed: false,
  },
}

export const APP_SHELL_SECOND_TEXT: CompletedReadingText = {
  ...APP_SHELL_FIRST_TEXT,
  id: 'f1300000-0000-4000-8000-000000000002',
  title: APP_SHELL.secondTitle,
}

export const APP_SHELL_FIRST_PAGE: ReadingHistoryPage = {
  items: [APP_SHELL_FIRST_TEXT],
  nextCursor: APP_SHELL.firstCursor,
}

export const APP_SHELL_SECOND_PAGE: ReadingHistoryPage = {
  items: [APP_SHELL_SECOND_TEXT],
  nextCursor: null,
}

export const APP_SHELL_EMPTY_PAGE: ReadingHistoryPage = {
  items: [],
  nextCursor: null,
}

export const APP_SHELL_INVALID_PAGE = {
  items: [{ id: APP_SHELL_FIRST_TEXT.id }],
  nextCursor: null,
}

export const APP_SHELL_EMPTY_WORDS = { needsApproval: [], ready: [] }

export const appShellSuccessResponse = (data: unknown) => ({ ok: true, data })

export const APP_SHELL_HISTORY_ERROR = {
  ok: false,
  error: { code: 'READING_HISTORY_FAILED', message: APP_SHELL.errorMessage },
}

export const APP_SHELL_LIST_CASES = {
  firstPage: {
    texts: APP_SHELL_FIRST_PAGE.items,
    expandedTextIds: new Set<string>(),
    isLoading: false,
    isLoadingMore: false,
    errorText: null,
    nextCursor: APP_SHELL_FIRST_PAGE.nextCursor,
  },
  expandedFirstPage: {
    texts: APP_SHELL_FIRST_PAGE.items,
    expandedTextIds: new Set<string>([APP_SHELL_FIRST_TEXT.id]),
    isLoading: false,
    isLoadingMore: false,
    errorText: null,
    nextCursor: APP_SHELL_FIRST_PAGE.nextCursor,
  },
  empty: {
    texts: APP_SHELL_EMPTY_PAGE.items,
    expandedTextIds: new Set<string>(),
    isLoading: false,
    isLoadingMore: false,
    errorText: null,
    nextCursor: APP_SHELL_EMPTY_PAGE.nextCursor,
  },
  error: {
    texts: APP_SHELL_EMPTY_PAGE.items,
    expandedTextIds: new Set<string>(),
    isLoading: false,
    isLoadingMore: false,
    errorText: APP_SHELL.errorMessage,
    nextCursor: APP_SHELL_EMPTY_PAGE.nextCursor,
  },
}
