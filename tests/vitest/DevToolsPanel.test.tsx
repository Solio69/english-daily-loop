import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DevToolsPanel } from '../../src/components/DevToolsPanel'

describe('DevToolsPanel', () => {
  it('renders all eight actions and forwards the selected review step', async () => {
    const onRunAction = vi.fn()
    const user = userEvent.setup()
    render(<DevToolsPanel runningAction={null} onRunAction={onRunAction} />)

    await user.click(screen.getByRole('button', { name: /Dev tools/ }))
    expect(screen.getByRole('button', { name: /Сброс текстов/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Сброс подписок/ })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /1 день/ }))
    expect(onRunAction).toHaveBeenCalledWith(
      'complete_today_vocabulary_reviews_at_step',
      { reviewStep: '1_day' },
    )
    await user.click(screen.getByRole('button', { name: /Сброс текстов/ }))
    expect(onRunAction).toHaveBeenCalledWith('reset_generation_attempts')
  })

  it('blocks action buttons while a request is running', async () => {
    const user = userEvent.setup()
    const onRunAction = vi.fn()
    render(
      <DevToolsPanel
        runningAction="reset_generation_attempts"
        onRunAction={onRunAction}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Dev tools/ }))
    expect(
      screen.getByRole('button', { name: /Сброс подписок/ }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: /1 день/ })).toBeDisabled()
    expect(onRunAction).not.toHaveBeenCalled()
  })
})
