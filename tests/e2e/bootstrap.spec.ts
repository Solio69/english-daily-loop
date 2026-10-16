import { expect, test, type Page } from '@playwright/test'
import {
  HTTP_CONTENT_TYPE,
  HTTP_METHOD,
  HTTP_STATUS,
} from '../fixtures/http.ts'

import { BOOTSTRAP_MOCKS, MOCK_SUCCESSFUL_AUTH } from '../mocks/bootstrap.ts'

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

  await page.addInitScript(
    ({ initData, colorScheme, telegramGlobal }) => {
      Object.defineProperty(window, telegramGlobal, {
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
    {
      initData: BOOTSTRAP_MOCKS.fakeInitData,
      colorScheme: BOOTSTRAP_MOCKS.colorScheme,
      telegramGlobal: BOOTSTRAP_MOCKS.telegramGlobal,
    },
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
        status: HTTP_STATUS.ok,
        contentType: HTTP_CONTENT_TYPE.javascript,
        body: BOOTSTRAP_MOCKS.emptyBody,
      })
      return
    }
    if (
      url.origin === BOOTSTRAP_MOCKS.apiURL &&
      url.pathname === BOOTSTRAP_MOCKS.authPath
    ) {
      if (request.method() === HTTP_METHOD.options) {
        await route.fulfill({
          status: HTTP_STATUS.noContent,
          headers: BOOTSTRAP_MOCKS.corsHeaders,
        })
        return
      }
      authBodies.push(request.postDataJSON())
      await route.fulfill({
        status: authStatus,
        contentType: HTTP_CONTENT_TYPE.json,
        headers: BOOTSTRAP_MOCKS.authCorsHeaders,
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
    authResponse: MOCK_SUCCESSFUL_AUTH,
    authStatus: HTTP_STATUS.ok,
  })

  await page.goto(BOOTSTRAP_MOCKS.homePath)

  await expect(
    page.getByRole(BOOTSTRAP_MOCKS.headingRole, {
      name: BOOTSTRAP_MOCKS.homeHeading,
    }),
  ).toBeVisible()
  await expect(
    page
      .getByRole(BOOTSTRAP_MOCKS.buttonRole, {
        name: BOOTSTRAP_MOCKS.settingsButton,
      })
      .first(),
  ).toBeVisible()
  expect(requests.authBodies).toContainEqual({
    initData: BOOTSTRAP_MOCKS.fakeInitData,
  })
  expect(requests.unexpectedRequests).toEqual([])
})

test('auth failure shows an actionable error without contacting a real backend', async ({
  page,
}) => {
  const requests = await installMocks({
    page,
    authResponse: BOOTSTRAP_MOCKS.authError,
    authStatus: HTTP_STATUS.unauthorized,
  })

  await page.goto(BOOTSTRAP_MOCKS.homePath)

  await expect(
    page.getByText(BOOTSTRAP_MOCKS.authError.error.message),
  ).toBeVisible()
  await expect(page.getByText(BOOTSTRAP_MOCKS.loadingText)).not.toBeVisible()
  expect(requests.authBodies).toContainEqual({
    initData: BOOTSTRAP_MOCKS.fakeInitData,
  })
  expect(requests.unexpectedRequests).toEqual([])
})
