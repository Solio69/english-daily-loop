import { expect, test, type Page } from '@playwright/test'
import {
  HTTP_CONTENT_TYPE,
  HTTP_METHOD,
  HTTP_STATUS,
} from '../fixtures/http.ts'

import {
  BOOTSTRAP_MOCKS,
  MOCK_SAVED_SETTINGS,
  MOCK_SUCCESSFUL_AUTH,
  MOCK_VOCABULARY_STATE_RESPONSE,
} from '../mocks/bootstrap.ts'

const installMocks = async ({
  page,
  authResponse,
  authStatus,
  recoveryResponse,
  settingsResponse,
  devResponse,
  devStatus = HTTP_STATUS.ok,
  supportResponse,
  supportStatus = HTTP_STATUS.ok,
}: {
  page: Page
  authResponse: unknown
  authStatus: number
  recoveryResponse?: unknown
  settingsResponse?: unknown
  devResponse?: unknown
  devStatus?: number
  supportResponse?: unknown
  supportStatus?: number
}) => {
  const unexpectedRequests: string[] = []
  const authBodies: unknown[] = []
  const settingsBodies: unknown[] = []
  const devBodies: unknown[] = []
  const supportBodies: unknown[] = []
  let firstAuthRequest = true

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
      const shouldFail = firstAuthRequest || !recoveryResponse
      firstAuthRequest = false
      await route.fulfill({
        status: shouldFail ? authStatus : HTTP_STATUS.ok,
        contentType: HTTP_CONTENT_TYPE.json,
        headers: BOOTSTRAP_MOCKS.authCorsHeaders,
        body: JSON.stringify(shouldFail ? authResponse : recoveryResponse),
      })
      return
    }
    if (
      settingsResponse &&
      url.origin === BOOTSTRAP_MOCKS.apiURL &&
      url.pathname === BOOTSTRAP_MOCKS.saveSettingsPath
    ) {
      if (request.method() === HTTP_METHOD.options) {
        await route.fulfill({
          status: HTTP_STATUS.noContent,
          headers: BOOTSTRAP_MOCKS.corsHeaders,
        })
        return
      }
      settingsBodies.push(request.postDataJSON())
      await route.fulfill({
        status: HTTP_STATUS.ok,
        contentType: HTTP_CONTENT_TYPE.json,
        headers: BOOTSTRAP_MOCKS.authCorsHeaders,
        body: JSON.stringify(settingsResponse),
      })
      return
    }
    if (
      devResponse &&
      url.origin === BOOTSTRAP_MOCKS.apiURL &&
      url.pathname === BOOTSTRAP_MOCKS.devToolsPath
    ) {
      if (request.method() === HTTP_METHOD.options) {
        await route.fulfill({
          status: HTTP_STATUS.noContent,
          headers: BOOTSTRAP_MOCKS.corsHeaders,
        })
        return
      }
      devBodies.push(request.postDataJSON())
      await route.fulfill({
        status: devStatus,
        contentType: HTTP_CONTENT_TYPE.json,
        headers: BOOTSTRAP_MOCKS.authCorsHeaders,
        body: JSON.stringify(devResponse),
      })
      return
    }
    if (
      supportResponse &&
      url.origin === BOOTSTRAP_MOCKS.apiURL &&
      url.pathname === BOOTSTRAP_MOCKS.supportReportPath
    ) {
      if (request.method() === HTTP_METHOD.options) {
        await route.fulfill({
          status: HTTP_STATUS.noContent,
          headers: BOOTSTRAP_MOCKS.corsHeaders,
        })
        return
      }
      supportBodies.push(request.postDataJSON())
      await route.fulfill({
        status: supportStatus,
        contentType: HTTP_CONTENT_TYPE.json,
        headers: BOOTSTRAP_MOCKS.authCorsHeaders,
        body: JSON.stringify(supportResponse),
      })
      return
    }
    if (
      settingsResponse &&
      url.origin === BOOTSTRAP_MOCKS.apiURL &&
      url.pathname === BOOTSTRAP_MOCKS.vocabularyStatePath
    ) {
      if (request.method() === HTTP_METHOD.options) {
        await route.fulfill({
          status: HTTP_STATUS.noContent,
          headers: BOOTSTRAP_MOCKS.corsHeaders,
        })
        return
      }
      await route.fulfill({
        status: HTTP_STATUS.ok,
        contentType: HTTP_CONTENT_TYPE.json,
        headers: BOOTSTRAP_MOCKS.authCorsHeaders,
        body: JSON.stringify(MOCK_VOCABULARY_STATE_RESPONSE),
      })
      return
    }

    unexpectedRequests.push(request.url())
    await route.abort()
  })

  return {
    unexpectedRequests,
    authBodies,
    settingsBodies,
    devBodies,
    supportBodies,
  }
}

test('settings submit a support report and show its confirmation', async ({
  page,
}) => {
  const requests = await installMocks({
    page,
    authResponse: MOCK_SUCCESSFUL_AUTH,
    authStatus: HTTP_STATUS.ok,
    supportResponse: {
      ok: true,
      data: {
        reportId: BOOTSTRAP_MOCKS.supportReportId,
        createdAt: BOOTSTRAP_MOCKS.supportCreatedAt,
      },
    },
  })
  await page.goto(BOOTSTRAP_MOCKS.homePath)
  await page
    .getByRole('button', { name: BOOTSTRAP_MOCKS.settingsButton })
    .first()
    .click()
  await page
    .getByRole('button', {
      name: BOOTSTRAP_MOCKS.supportOpenButton,
      exact: true,
    })
    .click()
  await page
    .getByPlaceholder(BOOTSTRAP_MOCKS.supportPlaceholder)
    .fill(BOOTSTRAP_MOCKS.supportComment)
  await page
    .getByRole('button', { name: BOOTSTRAP_MOCKS.supportSubmitButton })
    .click()

  await expect(page.getByText(BOOTSTRAP_MOCKS.supportSuccessText)).toBeVisible()
  expect(requests.supportBodies).toHaveLength(1)
  expect(requests.supportBodies[0]).toMatchObject({
    initData: BOOTSTRAP_MOCKS.fakeInitData,
    comment: BOOTSTRAP_MOCKS.supportComment,
  })
  expect(requests.unexpectedRequests).toEqual([])
})

test('admin can use mocked dev tools and refreshes the profile', async ({
  page,
}) => {
  const adminAuth = {
    ...MOCK_SUCCESSFUL_AUTH,
    data: {
      ...MOCK_SUCCESSFUL_AUTH.data,
      user: { ...MOCK_SUCCESSFUL_AUTH.data.user, role: 'admin' },
    },
  }
  const requests = await installMocks({
    page,
    authResponse: adminAuth,
    authStatus: HTTP_STATUS.ok,
    devResponse: {
      ok: true,
      data: {
        action: 'reset_generation_attempts',
        today: '2026-10-20',
        changes: { generationAttempts: 2 },
      },
    },
  })

  await page.goto(BOOTSTRAP_MOCKS.homePath)
  await page
    .getByRole('button', { name: BOOTSTRAP_MOCKS.settingsButton })
    .first()
    .click()
  await page.getByRole('button', { name: /Dev tools/ }).click()
  await page.getByRole('button', { name: /Сброс текстов/ }).click()

  await expect(page.getByText('Dev-действие выполнено.')).toBeVisible()
  await expect.poll(() => requests.authBodies.length).toBe(2)
  expect(requests.devBodies).toContainEqual({
    initData: BOOTSTRAP_MOCKS.fakeInitData,
    action: 'reset_generation_attempts',
  })
  expect(requests.unexpectedRequests).toEqual([])
})

test('ordinary users do not see dev tools in settings', async ({ page }) => {
  const requests = await installMocks({
    page,
    authResponse: MOCK_SUCCESSFUL_AUTH,
    authStatus: HTTP_STATUS.ok,
  })
  await page.goto(BOOTSTRAP_MOCKS.homePath)
  await page
    .getByRole('button', { name: BOOTSTRAP_MOCKS.settingsButton })
    .first()
    .click()
  await expect(
    page.getByRole('button', { name: /Dev tools/ }),
  ).not.toBeVisible()
  expect(requests.unexpectedRequests).toEqual([])
})

test('a denied dev action shows a safe error without refreshing the profile', async ({
  page,
}) => {
  const adminAuth = {
    ...MOCK_SUCCESSFUL_AUTH,
    data: {
      ...MOCK_SUCCESSFUL_AUTH.data,
      user: { ...MOCK_SUCCESSFUL_AUTH.data.user, role: 'admin' },
    },
  }
  const deniedMessage = 'Dev tools require admin access.'
  const requests = await installMocks({
    page,
    authResponse: adminAuth,
    authStatus: HTTP_STATUS.ok,
    devStatus: HTTP_STATUS.forbidden,
    devResponse: {
      ok: false,
      error: { code: 'DEV_TOOLS_ADMIN_REQUIRED', message: deniedMessage },
    },
  })

  await page.goto(BOOTSTRAP_MOCKS.homePath)
  await page
    .getByRole('button', { name: BOOTSTRAP_MOCKS.settingsButton })
    .first()
    .click()
  await page.getByRole('button', { name: /Dev tools/ }).click()
  await page.getByRole('button', { name: /Сброс текстов/ }).click()

  await expect(page.getByText(deniedMessage)).toBeVisible()
  expect(requests.authBodies).toHaveLength(1)
  expect(requests.unexpectedRequests).toEqual([])
})

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

test('auth retry opens the app only after a successful response', async ({
  page,
}) => {
  const requests = await installMocks({
    page,
    authResponse: BOOTSTRAP_MOCKS.authError,
    authStatus: HTTP_STATUS.unauthorized,
    recoveryResponse: MOCK_SUCCESSFUL_AUTH,
  })

  await page.goto(BOOTSTRAP_MOCKS.homePath)
  await expect(
    page.getByText(BOOTSTRAP_MOCKS.authError.error.message),
  ).toBeVisible()
  await expect(
    page.getByRole(BOOTSTRAP_MOCKS.headingRole, {
      name: BOOTSTRAP_MOCKS.homeHeading,
    }),
  ).not.toBeVisible()

  await page
    .getByRole(BOOTSTRAP_MOCKS.buttonRole, {
      name: BOOTSTRAP_MOCKS.retryButton,
    })
    .click()

  await expect(
    page.getByRole(BOOTSTRAP_MOCKS.headingRole, {
      name: BOOTSTRAP_MOCKS.homeHeading,
    }),
  ).toBeVisible()
  expect(requests.authBodies).toHaveLength(BOOTSTRAP_MOCKS.retryRequestCount)
  expect(requests.unexpectedRequests).toEqual([])
})

test('first setup saves settings and keeps subscription entry hidden', async ({
  page,
}) => {
  const requests = await installMocks({
    page,
    authResponse: MOCK_SUCCESSFUL_AUTH,
    authStatus: HTTP_STATUS.ok,
    settingsResponse: MOCK_SAVED_SETTINGS,
  })

  await page.goto(BOOTSTRAP_MOCKS.homePath)
  await page
    .getByRole(BOOTSTRAP_MOCKS.buttonRole, {
      name: BOOTSTRAP_MOCKS.settingsButton,
    })
    .first()
    .click()
  const level = page.getByRole(BOOTSTRAP_MOCKS.buttonRole, {
    name: BOOTSTRAP_MOCKS.levelOption,
  })
  const minutes = page.getByRole(BOOTSTRAP_MOCKS.buttonRole, {
    name: BOOTSTRAP_MOCKS.minutesOption,
  })
  await level.click()
  await minutes.click()
  await expect(level).toHaveAttribute('aria-pressed', BOOTSTRAP_MOCKS.pressed)
  await expect(minutes).toHaveAttribute('aria-pressed', BOOTSTRAP_MOCKS.pressed)
  await page
    .getByRole(BOOTSTRAP_MOCKS.buttonRole, {
      name: BOOTSTRAP_MOCKS.saveButton,
    })
    .click()

  await expect(
    page.getByRole(BOOTSTRAP_MOCKS.headingRole, {
      name: BOOTSTRAP_MOCKS.homeHeading,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole(BOOTSTRAP_MOCKS.buttonRole, {
      name: BOOTSTRAP_MOCKS.hiddenSubscriptionButton,
    }),
  ).not.toBeVisible()
  expect(requests.settingsBodies).toContainEqual({
    initData: BOOTSTRAP_MOCKS.fakeInitData,
    settings: MOCK_SAVED_SETTINGS.data.settings,
  })
  expect(requests.unexpectedRequests).toEqual([])
})
