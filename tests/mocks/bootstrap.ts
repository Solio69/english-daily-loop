import {
  HTTP_ALLOWED_METHODS,
  HTTP_CORS_ORIGIN_ANY,
  HTTP_HEADER,
} from '../fixtures/http.ts'

export const BOOTSTRAP_MOCKS = {
  baseURL: 'http://127.0.0.1:4173',
  apiURL: 'http://127.0.0.1:54321',
  fakeInitData: 'query_id=f02-fixture&auth_date=1&hash=not-real',
  telegramGlobal: 'Telegram',
  colorScheme: 'light',
  routePattern: '**/*',
  telegramScriptOrigin: 'https://telegram.org',
  telegramScriptPath: '/js/telegram-web-app.js',
  authPath: '/functions/v1/auth-telegram',
  homePath: '/',
  emptyBody: '',
  corsHeaders: {
    [HTTP_HEADER.allowOrigin]: HTTP_CORS_ORIGIN_ANY,
    [HTTP_HEADER.allowHeaders]: HTTP_CORS_ORIGIN_ANY,
    [HTTP_HEADER.allowMethods]: HTTP_ALLOWED_METHODS,
  },
  authCorsHeaders: { [HTTP_HEADER.allowOrigin]: HTTP_CORS_ORIGIN_ANY },
  headingRole: 'heading',
  buttonRole: 'button',
  homeHeading: 'Тест!',
  settingsButton: 'Открыть настройки',
  loadingText: 'Загружаем профиль...',
  authError: {
    ok: false,
    error: {
      code: 'AUTH_VALIDATION_FAILED',
      message: 'Не удалось проверить данные Telegram.',
    },
  },
} as const

export const MOCK_SUCCESSFUL_AUTH = {
  ok: true,
  data: {
    user: {
      id: 'f0200000-0000-4000-8000-000000000001',
      firstName: 'Тест',
      settingsCompletedAt: null,
      firstTextCompletedAt: null,
      role: 'user',
    },
    settings: null,
    subscription: {
      tier: 'free',
      accessType: 'free',
      limits: { dailyReadingGenerations: 3, vocabularyWordsLimit: 30 },
      activeSubscription: null,
      scheduledSubscription: null,
    },
    homeProgress: {
      lesson: { status: 'not_started', currentStep: 'reading' },
      reading: { status: 'not_started' },
      review: { status: 'completed', dueCount: 0, reviewedTodayCount: 0 },
    },
    streakDays: 0,
    completedReadingTextCount: 0,
  },
}
