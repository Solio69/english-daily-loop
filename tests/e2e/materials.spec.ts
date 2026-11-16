import { expect, test, type Page } from '@playwright/test'
import { HTTP_CONTENT_TYPE, HTTP_METHOD, HTTP_STATUS } from '../fixtures/http'
import { BOOTSTRAP_MOCKS } from '../mocks/bootstrap'
import {
  APP_SHELL,
  APP_SHELL_AUTH,
  APP_SHELL_EMPTY_WORDS,
  APP_SHELL_FIRST_PAGE,
  APP_SHELL_FIRST_SETUP_AUTH,
  APP_SHELL_HISTORY_ERROR,
  APP_SHELL_SECOND_PAGE,
  APP_SHELL_VOCABULARY_STATE,
  appShellSuccessResponse,
} from '../mocks/appShell'

const installAppShellMocks = async ({
  page,
  telegramTheme,
  failSecondPageOnce,
  failFirstPage,
  authResponse = APP_SHELL_AUTH,
}: {
  page: Page
  telegramTheme: 'light' | 'dark'
  failSecondPageOnce: boolean
  failFirstPage?: boolean
  authResponse?: unknown
}) => {
  const historyBodies: unknown[] = []
  const unexpectedRequests: string[] = []
  let secondPageFailures = 0

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
      colorScheme: telegramTheme,
      telegramGlobal: APP_SHELL.telegramGlobal,
    },
  )

  await page.route(APP_SHELL.pathPattern, async (route) => {
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
        body: APP_SHELL.emptyBody,
      })
      return
    }
    if (url.origin === BOOTSTRAP_MOCKS.apiURL) {
      if (request.method() === HTTP_METHOD.options) {
        await route.fulfill({
          status: HTTP_STATUS.noContent,
          headers: BOOTSTRAP_MOCKS.corsHeaders,
        })
        return
      }
      const respond = async (data: unknown) =>
        route.fulfill({
          status: HTTP_STATUS.ok,
          contentType: HTTP_CONTENT_TYPE.json,
          headers: BOOTSTRAP_MOCKS.authCorsHeaders,
          body: JSON.stringify(appShellSuccessResponse(data)),
        })
      if (url.pathname === BOOTSTRAP_MOCKS.authPath) {
        await route.fulfill({
          status: HTTP_STATUS.ok,
          contentType: HTTP_CONTENT_TYPE.json,
          headers: BOOTSTRAP_MOCKS.authCorsHeaders,
          body: JSON.stringify(authResponse),
        })
        return
      }
      if (url.pathname === APP_SHELL.vocabularyStatePath) {
        await respond(APP_SHELL_VOCABULARY_STATE)
        return
      }
      if (url.pathname === APP_SHELL.vocabularyWordsPath) {
        await respond(APP_SHELL_EMPTY_WORDS)
        return
      }
      if (url.pathname === APP_SHELL.historyPath) {
        const body = request.postDataJSON() as { cursor?: string | null }
        historyBodies.push(body)
        if (!body.cursor && failFirstPage) {
          await route.fulfill({
            status: HTTP_STATUS.serverError,
            contentType: HTTP_CONTENT_TYPE.json,
            headers: BOOTSTRAP_MOCKS.authCorsHeaders,
            body: JSON.stringify(APP_SHELL_HISTORY_ERROR),
          })
          return
        }
        if (body.cursor === APP_SHELL.firstCursor) {
          if (failSecondPageOnce && secondPageFailures === 0) {
            secondPageFailures += 1
            await route.fulfill({
              status: HTTP_STATUS.serverError,
              contentType: HTTP_CONTENT_TYPE.json,
              headers: BOOTSTRAP_MOCKS.authCorsHeaders,
              body: JSON.stringify(APP_SHELL_HISTORY_ERROR),
            })
            return
          }
          await respond(APP_SHELL_SECOND_PAGE)
          return
        }
        await respond(APP_SHELL_FIRST_PAGE)
        return
      }
    }
    unexpectedRequests.push(request.url())
    await route.abort()
  })

  return { historyBodies, unexpectedRequests }
}

test('mobile materials keep tabs, expansion, cursor retry and back navigation', async ({
  page,
}) => {
  const requests = await installAppShellMocks({
    page,
    telegramTheme: APP_SHELL.lightTheme,
    failSecondPageOnce: true,
  })
  await page.goto(APP_SHELL.homePath)
  await page.getByText(APP_SHELL.textsShortcut, { exact: true }).click()
  await expect(
    page.getByRole(APP_SHELL.headingRole, { name: APP_SHELL.materialsHeading }),
  ).toBeVisible()
  await expect(
    page.getByRole(APP_SHELL.tabRole, { name: APP_SHELL.textsTab }),
  ).toHaveAttribute(APP_SHELL.selectedAttribute, APP_SHELL.trueValue)
  await expect(page.getByText(APP_SHELL.firstTitle)).toBeVisible()
  await expect(page.getByText(APP_SHELL.completedAtLabel)).toBeVisible()
  await page
    .getByRole(APP_SHELL.buttonRole, { name: APP_SHELL.expandButton })
    .click()
  await expect(
    page.getByRole(APP_SHELL.buttonRole, { name: APP_SHELL.collapseButton }),
  ).toHaveAttribute(APP_SHELL.expandedAttribute, APP_SHELL.trueValue)

  await page
    .getByRole(APP_SHELL.buttonRole, { name: APP_SHELL.loadMoreButton })
    .click()
  await expect(page.getByText(APP_SHELL.errorMessage)).toBeVisible()
  await expect(page.getByText(APP_SHELL.firstTitle)).toBeVisible()
  await page
    .getByRole(APP_SHELL.buttonRole, { name: APP_SHELL.loadMoreButton })
    .click()
  await expect(page.getByText(APP_SHELL.secondTitle)).toBeVisible()
  await expect(
    page.getByRole(APP_SHELL.buttonRole, { name: APP_SHELL.collapseButton }),
  ).toHaveAttribute(APP_SHELL.expandedAttribute, APP_SHELL.trueValue)
  const vocabularyTab = page.getByRole(APP_SHELL.tabRole, {
    name: APP_SHELL.vocabularyTab,
  })
  await vocabularyTab.focus()
  await page.keyboard.press(APP_SHELL.enterKey)
  await expect(vocabularyTab).toHaveAttribute(
    APP_SHELL.selectedAttribute,
    APP_SHELL.trueValue,
  )
  expect(requests.historyBodies).toContainEqual(APP_SHELL.firstHistoryRequest)
  expect(requests.historyBodies).toContainEqual(APP_SHELL.secondHistoryRequest)

  await page
    .getByRole(APP_SHELL.buttonRole, { name: APP_SHELL.backButton })
    .click()
  await expect(
    page.getByRole(APP_SHELL.headingRole, { name: APP_SHELL.homeHeading }),
  ).toBeVisible()
  await page
    .locator('nav')
    .getByRole(APP_SHELL.buttonRole, { name: APP_SHELL.materialsNav })
    .click()
  await expect(
    page.getByRole(APP_SHELL.tabRole, { name: APP_SHELL.vocabularyTab }),
  ).toHaveAttribute(APP_SHELL.selectedAttribute, APP_SHELL.trueValue)
  expect(requests.unexpectedRequests).toEqual([])
})

test('Telegram system theme yields to explicit choice and restores it on reload', async ({
  page,
}) => {
  const requests = await installAppShellMocks({
    page,
    telegramTheme: APP_SHELL.darkTheme,
    failSecondPageOnce: false,
  })
  await page.goto(APP_SHELL.homePath)
  await expect(page.locator(APP_SHELL.htmlTag)).toHaveClass(APP_SHELL.darkClass)
  await page
    .getByRole(APP_SHELL.role, { name: APP_SHELL.lightThemeButton })
    .click()
  await expect(page.locator(APP_SHELL.htmlTag)).not.toHaveClass(
    APP_SHELL.darkClass,
  )
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key),
      APP_SHELL.themeStorageKey,
    ),
  ).toBe(APP_SHELL.lightTheme)
  await page.reload()
  await expect(page.locator(APP_SHELL.htmlTag)).not.toHaveClass(
    APP_SHELL.darkClass,
  )
  await page
    .getByRole(APP_SHELL.role, { name: APP_SHELL.systemThemeButton })
    .click()
  await expect(page.locator(APP_SHELL.htmlTag)).toHaveClass(APP_SHELL.darkClass)
  expect(requests.unexpectedRequests).toEqual([])
})

test('first setup keeps materials closed', async ({ page }) => {
  const requests = await installAppShellMocks({
    page,
    telegramTheme: APP_SHELL.lightTheme,
    failSecondPageOnce: false,
    authResponse: APP_SHELL_FIRST_SETUP_AUTH,
  })
  await page.goto(APP_SHELL.homePath)
  await page
    .locator('nav')
    .getByRole(APP_SHELL.buttonRole, { name: APP_SHELL.materialsNav })
    .click()
  await expect(page.getByText(APP_SHELL.onboardingMessage)).toBeVisible()
  await expect(
    page.getByRole(APP_SHELL.headingRole, { name: APP_SHELL.materialsHeading }),
  ).not.toBeVisible()
  expect(requests.unexpectedRequests).toEqual([])
})

test('a first history failure shows the error without the empty state', async ({
  page,
}) => {
  const requests = await installAppShellMocks({
    page,
    telegramTheme: APP_SHELL.lightTheme,
    failSecondPageOnce: false,
    failFirstPage: APP_SHELL.firstPageFailure,
  })
  await page.goto(APP_SHELL.homePath)
  await page.getByText(APP_SHELL.textsShortcut, { exact: true }).click()
  await expect(page.getByText(APP_SHELL.errorMessage)).toBeVisible()
  await expect(
    page.getByRole(APP_SHELL.headingRole, { name: APP_SHELL.emptyHeading }),
  ).not.toBeVisible()
  expect(requests.historyBodies).toContainEqual(APP_SHELL.firstHistoryRequest)
  expect(requests.unexpectedRequests).toEqual([])
})
