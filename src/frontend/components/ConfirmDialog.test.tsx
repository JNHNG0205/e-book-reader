import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

test('shows the message', () => {
  render(
    <ConfirmDialog
      title="Delete book"
      message="Delete this book?"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  )
  expect(screen.getByText('Delete this book?')).toBeInTheDocument()
})

test('Confirm calls onConfirm', async () => {
  const onConfirm = vi.fn()
  render(
    <ConfirmDialog
      title="Delete book"
      message="Delete this book?"
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
})

test('Cancel calls onCancel', async () => {
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      title="Delete book"
      message="Delete this book?"
      onConfirm={vi.fn()}
      onCancel={onCancel}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onCancel).toHaveBeenCalledTimes(1)
})

test('danger renders a red confirm button', () => {
  render(
    <ConfirmDialog
      title="Delete book"
      message="Delete this book?"
      confirmLabel="Delete"
      danger
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  )
  const button = screen.getByRole('button', { name: 'Delete' })
  expect(button.className).toContain('bg-red-600')
})
