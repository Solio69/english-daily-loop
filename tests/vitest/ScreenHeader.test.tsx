import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ScreenHeader } from '../../src/components/ScreenHeader'

describe('ScreenHeader', () => {
  it('shows its title and lets the user go back', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()

    render(<ScreenHeader title="Словарь" onBack={onBack} />)
    await user.click(screen.getByRole('button', { name: 'Назад' }))

    expect(screen.getByRole('heading', { name: 'Словарь' })).toBeVisible()
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('prevents navigation while disabled', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()

    render(<ScreenHeader title="Словарь" onBack={onBack} disabled />)
    const backButton = screen.getByRole('button', { name: 'Назад' })
    await user.click(backButton)

    expect(backButton).toBeDisabled()
    expect(onBack).not.toHaveBeenCalled()
  })
})
