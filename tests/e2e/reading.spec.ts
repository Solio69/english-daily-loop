import { expect, test, type Page } from '@playwright/test'
import { BOOTSTRAP_MOCKS, MOCK_SUCCESSFUL_AUTH } from '../mocks/bootstrap.ts'
import {
  ACTIVE_READING_TEXT,
  EMPTY_READING_STATE,
  GENERATION_API_PAYLOAD,
  READING_SCREEN_CASE,
} from '../mocks/readingScreen.ts'

const readingAuth = {
  ...MOCK_SUCCESSFUL_AUTH,
  data: {
    ...MOCK_SUCCESSFUL_AUTH.data,
    user: {
      ...MOCK_SUCCESSFUL_AUTH.data.user,
      settingsCompletedAt: '2026-10-20T10:00:00Z',
    },
    settings: { englishLevel: 'A2', dailyReadingMinutes: 3 },
  },
}

const positionBody = `${'The first paragraph has enough words to fill the mobile screen. '.repeat(20)}\n\nThe second paragraph resumes the reading session.`

const installReadingMocks = async (
  page: Page,
  {
    theme,
    initiallyActive,
    restorePosition = false,
  }: {
    theme: 'light' | 'dark'
    initiallyActive: boolean
    restorePosition?: boolean
  },
) => {
  let active = initiallyActive
  let completed = false
  let saved = false
  let paragraphIndex: number | null = restorePosition ? 1 : null
  const generationRequestIds: string[] = []
  const positionSaves: Array<number | null> = []
  const unexpectedRequests: string[] = []

  await page.addInitScript(
    ({ initData, colorScheme }) => {
      Object.defineProperty(window, 'Telegram', {
        configurable: true,
        value: {
          WebApp: {
            initData,
            colorScheme,
            ready: () => {},
            onEvent: () => {},
            offEvent: () => {},
          },
        },
      })
    },
    { initData: BOOTSTRAP_MOCKS.fakeInitData, colorScheme: theme },
  )

  await page.route(BOOTSTRAP_MOCKS.routePattern, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === BOOTSTRAP_MOCKS.baseURL) {
      await route.continue()
      return
    }
    if (
      url.origin === BOOTSTRAP_MOCKS.telegramScriptOrigin &&
      url.pathname === BOOTSTRAP_MOCKS.telegramScriptPath
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: '',
      })
      return
    }
    if (url.origin === BOOTSTRAP_MOCKS.apiURL) {
      if (request.method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: BOOTSTRAP_MOCKS.corsHeaders,
        })
        return
      }
      const respond = async (data: unknown) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: BOOTSTRAP_MOCKS.authCorsHeaders,
          body: JSON.stringify({ ok: true, data }),
        })
      switch (url.pathname) {
        case BOOTSTRAP_MOCKS.authPath:
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: BOOTSTRAP_MOCKS.authCorsHeaders,
            body: JSON.stringify(readingAuth),
          })
          return
        case '/functions/v1/get-reading-state':
          await respond({
            ...EMPTY_READING_STATE,
            isReadingCompletedToday: completed,
            activeText: active
              ? {
                  ...ACTIVE_READING_TEXT,
                  body: restorePosition
                    ? positionBody
                    : ACTIVE_READING_TEXT.body,
                  lastReadParagraphIndex: paragraphIndex,
                  savedWordIndexes: saved
                    ? [READING_SCREEN_CASE.wordIndex]
                    : [],
                  pendingSavedWordIndexes: saved
                    ? [READING_SCREEN_CASE.wordIndex]
                    : [],
                }
              : null,
          })
          return
        case '/functions/v1/get-vocabulary-state':
          await respond({
            pendingCount: 0,
            needsApprovalCount: 0,
            readyCount: 0,
            totalCount: 0,
            cardGeneration: {
              dailyLimit: 10,
              usedAttempts: 0,
              remainingAttempts: 10,
            },
          })
          return
        case '/functions/v1/generate-reading-text':
          generationRequestIds.push(request.headers()['x-request-id'])
          active = true
          await respond(GENERATION_API_PAYLOAD)
          return
        case '/functions/v1/save-vocabulary-word':
          saved = true
          await respond({
            wordIndex: READING_SCREEN_CASE.wordIndex,
            cardStatus: 'pending',
          })
          return
        case '/functions/v1/delete-pending-vocabulary-word':
          saved = false
          await respond({ removedWordIndexes: [READING_SCREEN_CASE.wordIndex] })
          return
        case '/functions/v1/complete-reading-text':
          active = false
          completed = true
          await respond({
            completedDate: READING_SCREEN_CASE.date,
            firstTextCompletedAt: '2026-10-20T10:00:00Z',
            isReadingCompletedToday: true,
            streakDays: 1,
            completedReadingTextCount: 1,
          })
          return
        case '/functions/v1/save-reading-position':
          paragraphIndex = request.postDataJSON()?.paragraphIndex ?? null
          positionSaves.push(paragraphIndex)
          await respond({
            readingTextId: READING_SCREEN_CASE.textId,
            paragraphIndex,
          })
          return
      }
    }
    unexpectedRequests.push(request.url())
    await route.abort()
  })

  return { generationRequestIds, positionSaves, unexpectedRequests }
}

const openReading = async (page: Page) => {
  await page.goto(BOOTSTRAP_MOCKS.homePath)
  await page.locator('nav').getByRole('button', { name: 'Текст' }).click()
}

test('light mobile reading generates, resumes and completes a text', async ({
  page,
}) => {
  const requests = await installReadingMocks(page, {
    theme: 'light',
    initiallyActive: false,
  })
  await openReading(page)
  await page
    .getByRole('button', { name: READING_SCREEN_CASE.generateButton })
    .click()
  await expect(page.getByText(READING_SCREEN_CASE.title)).toBeVisible()
  expect(requests.generationRequestIds).toHaveLength(1)
  expect(requests.generationRequestIds[0]).toMatch(/^req_/)

  await page.locator('nav').getByRole('button', { name: 'Главная' }).click()
  await page.locator('nav').getByRole('button', { name: 'Текст' }).click()
  await expect(page.getByText(READING_SCREEN_CASE.title)).toBeVisible()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'tools/test-temp/reading-light.png' })

  await page
    .getByRole('button', { name: READING_SCREEN_CASE.completeButton })
    .click()
  await expect(page.getByRole('heading', { name: 'Тест!' })).toBeVisible()
  expect(requests.unexpectedRequests).toEqual([])
})

test('dark mobile reading keeps word actions and keyboard navigation', async ({
  page,
}) => {
  const requests = await installReadingMocks(page, {
    theme: 'dark',
    initiallyActive: true,
  })
  await openReading(page)
  await expect(page.getByText(READING_SCREEN_CASE.title)).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.getByText(READING_SCREEN_CASE.word).click()
  await page
    .getByRole('button', { name: READING_SCREEN_CASE.addButton })
    .click()
  await page.getByText(READING_SCREEN_CASE.word).click()
  await expect(
    page.getByRole('button', { name: READING_SCREEN_CASE.deleteButton }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: READING_SCREEN_CASE.deleteButton })
    .click()
  await page.getByText(READING_SCREEN_CASE.word).click()
  await expect(
    page.getByRole('button', { name: READING_SCREEN_CASE.addButton }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Отмена' }).click()

  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(
    'BUTTON',
  )
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'tools/test-temp/reading-dark.png' })
  expect(requests.unexpectedRequests).toEqual([])
})

test('reading resumes at the saved paragraph and resets position at the top', async ({
  page,
}) => {
  const requests = await installReadingMocks(page, {
    theme: 'light',
    initiallyActive: true,
    restorePosition: true,
  })
  await openReading(page)
  await expect(
    page.getByText('The second paragraph resumes the reading session.'),
  ).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(320)
  await page
    .getByRole('button', { name: 'Вернуться к началу страницы' })
    .click()
  await expect.poll(() => requests.positionSaves).toContain(null)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  expect(requests.unexpectedRequests).toEqual([])
})
