import { expect, test, type Page } from '@playwright/test'
import { BOOTSTRAP_MOCKS, MOCK_SUCCESSFUL_AUTH } from '../mocks/bootstrap'
import {
  VOCABULARY_CLIENT,
  VOCABULARY_E2E,
  VOCABULARY_EMPTY_REVIEW_STATE,
  VOCABULARY_PREPARED,
  VOCABULARY_REVIEW_STATE,
  VOCABULARY_STATE,
} from '../mocks/vocabularyClient'

const vocabularyAuth = {
  ...MOCK_SUCCESSFUL_AUTH,
  data: {
    ...MOCK_SUCCESSFUL_AUTH.data,
    user: {
      ...MOCK_SUCCESSFUL_AUTH.data.user,
      settingsCompletedAt: VOCABULARY_CLIENT.timestamp,
    },
    settings: VOCABULARY_E2E.settings,
    homeProgress: {
      ...MOCK_SUCCESSFUL_AUTH.data.homeProgress,
      review: {
        status: VOCABULARY_E2E.progressStatus,
        dueCount: VOCABULARY_CLIENT.one,
        reviewedTodayCount: VOCABULARY_CLIENT.zero,
      },
    },
  },
}

const installVocabularyMocks = async ({
  page,
  theme,
}: {
  page: Page
  theme: 'light' | 'dark'
}) => {
  let isPrepared = false
  let isReviewed = false
  let reviewCalls = VOCABULARY_CLIENT.zero
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
        status: VOCABULARY_E2E.successStatus,
        contentType: VOCABULARY_E2E.javascriptContentType,
        body: VOCABULARY_E2E.emptyBody,
      })
      return
    }
    if (url.origin === BOOTSTRAP_MOCKS.apiURL) {
      if (request.method() === VOCABULARY_E2E.optionsMethod) {
        await route.fulfill({
          status: VOCABULARY_E2E.optionsStatus,
          headers: BOOTSTRAP_MOCKS.corsHeaders,
        })
        return
      }
      const respond = async (data: unknown) =>
        route.fulfill({
          status: VOCABULARY_E2E.successStatus,
          contentType: VOCABULARY_E2E.jsonContentType,
          headers: BOOTSTRAP_MOCKS.authCorsHeaders,
          body: JSON.stringify({ ok: true, data }),
        })
      switch (url.pathname) {
        case BOOTSTRAP_MOCKS.authPath:
          await route.fulfill({
            status: VOCABULARY_E2E.successStatus,
            contentType: VOCABULARY_E2E.jsonContentType,
            headers: BOOTSTRAP_MOCKS.authCorsHeaders,
            body: JSON.stringify(vocabularyAuth),
          })
          return
        case VOCABULARY_E2E.paths.readingHistory:
          await respond(VOCABULARY_E2E.emptyHistory)
          return
        case VOCABULARY_E2E.paths.vocabularyState:
          await respond(
            isPrepared
              ? {
                  ...VOCABULARY_STATE,
                  pendingCount: VOCABULARY_CLIENT.zero,
                  readyCount: VOCABULARY_CLIENT.one,
                }
              : VOCABULARY_STATE,
          )
          return
        case VOCABULARY_E2E.paths.vocabularyWords:
          await respond({
            needsApproval: [],
            ready: isPrepared ? [VOCABULARY_REVIEW_STATE.currentCard] : [],
          })
          return
        case VOCABULARY_E2E.paths.prepareCards:
          isPrepared = true
          await respond(VOCABULARY_PREPARED)
          return
        case VOCABULARY_E2E.paths.reviewState:
          await respond(
            isReviewed
              ? {
                  ...VOCABULARY_EMPTY_REVIEW_STATE,
                  totalReadyCount: VOCABULARY_CLIENT.one,
                }
              : VOCABULARY_REVIEW_STATE,
          )
          return
        case VOCABULARY_E2E.paths.reviewWord:
          reviewCalls += VOCABULARY_CLIENT.one
          isReviewed = true
          await respond(VOCABULARY_E2E.reviewResult)
          return
      }
    }
    unexpectedRequests.push(request.url())
    await route.abort()
  })

  return {
    get reviewCalls() {
      return reviewCalls
    },
    unexpectedRequests,
  }
}

for (const theme of VOCABULARY_E2E.themes) {
  test(`${theme} mobile vocabulary prepares a card and reviews it once`, async ({
    page,
  }) => {
    const calls = await installVocabularyMocks({ page, theme })
    await page.goto(BOOTSTRAP_MOCKS.homePath)
    await page
      .locator('nav')
      .getByRole('button', { name: VOCABULARY_CLIENT.materialsNav })
      .click()
    await page
      .getByRole('button', { name: VOCABULARY_CLIENT.prepareButton })
      .click()
    await expect(page.getByText(VOCABULARY_CLIENT.word)).toBeVisible()

    await page
      .locator('nav')
      .getByRole('button', { name: VOCABULARY_CLIENT.reviewNav })
      .click()
    await page.screenshot({ path: `tools/test-temp/vocabulary-${theme}.png` })
    await page
      .getByRole('button', { name: VOCABULARY_CLIENT.revealButton })
      .click()
    await page
      .getByRole('button', { name: VOCABULARY_CLIENT.reviewButton })
      .click()
    await expect(
      page.getByRole('heading', { name: VOCABULARY_CLIENT.completeHeading }),
    ).toBeVisible()
    expect(calls.reviewCalls).toBe(VOCABULARY_CLIENT.one)

    await page
      .locator('nav')
      .getByRole('button', { name: VOCABULARY_CLIENT.homeNav })
      .click()
    await page
      .locator('nav')
      .getByRole('button', { name: VOCABULARY_CLIENT.reviewNav })
      .click()
    await expect(
      page.getByRole('heading', { name: VOCABULARY_CLIENT.completeHeading }),
    ).toBeVisible()
    expect(calls.reviewCalls).toBe(VOCABULARY_CLIENT.one)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(VOCABULARY_E2E.mobileWidth)
    expect(calls.unexpectedRequests).toEqual([])
  })
}
