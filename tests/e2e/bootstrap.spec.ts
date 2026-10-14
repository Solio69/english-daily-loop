import { expect, test, type Page } from '@playwright/test'

const baseURL = 'http://127.0.0.1:4173'
const apiURL = 'http://127.0.0.1:54321'
const fakeInitData = 'query_id=f02-fixture&auth_date=1&hash=not-real'

const successfulAuth = {
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

const installMocks = async ({
  page,
  authResponse,
  authStatus,
}: {
  page: Page
  authResponse: unknown
  authStatus: number
}) => {
  const unexpectedRequests: string[] = []
  const authBodies: unknown[] = []

  await page.addInitScript((initData) => {
    Object.defineProperty(window, 'Telegram', {
      configurable: true,
      value: {
        WebApp: {
          initData,
          colorScheme: 'light',
          ready: () => {},
          onEvent: () => {},
          offEvent: () => {},
        },
      },
    })
  }, fakeInitData)

  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (url.origin === baseURL) {
      await route.continue()
      return
    }
    if (
      url.origin === 'https://telegram.org' &&
      url.pathname === '/js/telegram-web-app.js'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: '',
      })
      return
    }
    if (
      url.origin === apiURL &&
      url.pathname === '/functions/v1/auth-telegram'
    ) {
      if (request.method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-headers': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
          },
        })
        return
      }
      authBodies.push(request.postDataJSON())
      await route.fulfill({
        status: authStatus,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(authResponse),
      })
      return
    }

    unexpectedRequests.push(request.url())
    await route.abort()
  })

  return { unexpectedRequests, authBodies }
}

test('Telegram bootstrap opens the home screen with a mocked API', async ({
  page,
}) => {
  const requests = await installMocks({
    page,
    authResponse: successfulAuth,
    authStatus: 200,
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Тест!' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Открыть настройки' }).first(),
  ).toBeVisible()
  expect(requests.authBodies).toContainEqual({ initData: fakeInitData })
  expect(requests.unexpectedRequests).toEqual([])
})

test('auth failure shows an actionable error without contacting a real backend', async ({
  page,
}) => {
  const requests = await installMocks({
    page,
    authResponse: {
      ok: false,
      error: {
        code: 'AUTH_VALIDATION_FAILED',
        message: 'Не удалось проверить данные Telegram.',
      },
    },
    authStatus: 401,
  })

  await page.goto('/')

  await expect(
    page.getByText('Не удалось проверить данные Telegram.'),
  ).toBeVisible()
  await expect(page.getByText('Загружаем профиль...')).not.toBeVisible()
  expect(requests.authBodies).toContainEqual({ initData: fakeInitData })
  expect(requests.unexpectedRequests).toEqual([])
})
