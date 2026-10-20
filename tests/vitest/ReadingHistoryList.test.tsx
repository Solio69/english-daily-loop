import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReadingHistoryList } from '../../src/components/materials/ReadingHistoryList'
import {
  APP_SHELL,
  APP_SHELL_FIRST_TEXT,
  APP_SHELL_LIST_CASES,
} from '../mocks/appShell'

describe('ReadingHistoryList', () => {
  it('shows a completed text, expands it and keeps pagination action', async () => {
    const onToggleExpanded = vi.fn()
    const onLoadMore = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <ReadingHistoryList
        {...APP_SHELL_LIST_CASES.firstPage}
        onToggleExpanded={onToggleExpanded}
        onLoadMore={onLoadMore}
      />,
    )

    expect(screen.getByText(APP_SHELL.firstTitle)).toBeVisible()
    expect(screen.getByText(APP_SHELL.completedAtLabel)).toBeVisible()
    expect(screen.getByText(APP_SHELL.modelLabel)).toBeVisible()
    const expand = screen.getByRole(APP_SHELL.buttonRole, {
      name: APP_SHELL.expandButton,
    })
    expect(expand).toHaveAttribute(
      APP_SHELL.expandedAttribute,
      APP_SHELL.falseValue,
    )
    await user.click(expand)
    expect(onToggleExpanded).toHaveBeenCalledWith(APP_SHELL_FIRST_TEXT.id)

    rerender(
      <ReadingHistoryList
        {...APP_SHELL_LIST_CASES.expandedFirstPage}
        onToggleExpanded={onToggleExpanded}
        onLoadMore={onLoadMore}
      />,
    )
    expect(
      screen.getByRole(APP_SHELL.buttonRole, {
        name: APP_SHELL.collapseButton,
      }),
    ).toHaveAttribute(APP_SHELL.expandedAttribute, APP_SHELL.trueValue)
    await user.click(
      screen.getByRole(APP_SHELL.buttonRole, {
        name: APP_SHELL.loadMoreButton,
      }),
    )
    expect(onLoadMore).toHaveBeenCalledOnce()
  })

  it('shows an empty state without an error and an error without an empty state', () => {
    const onToggleExpanded = vi.fn()
    const onLoadMore = vi.fn()
    const { rerender } = render(
      <ReadingHistoryList
        {...APP_SHELL_LIST_CASES.empty}
        onToggleExpanded={onToggleExpanded}
        onLoadMore={onLoadMore}
      />,
    )
    expect(
      screen.getByRole(APP_SHELL.headingRole, {
        name: APP_SHELL.emptyHeading,
      }),
    ).toBeVisible()

    rerender(
      <ReadingHistoryList
        {...APP_SHELL_LIST_CASES.error}
        onToggleExpanded={onToggleExpanded}
        onLoadMore={onLoadMore}
      />,
    )
    expect(
      screen.getByRole(APP_SHELL.headingRole, {
        name: APP_SHELL.errorHeading,
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole(APP_SHELL.headingRole, {
        name: APP_SHELL.emptyHeading,
      }),
    ).not.toBeInTheDocument()
  })
})
