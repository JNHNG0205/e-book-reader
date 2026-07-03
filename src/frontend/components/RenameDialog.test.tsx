import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { RenameDialog } from './RenameDialog'

test('input is prefilled with initialValue', () => {
  render(<RenameDialog initialValue="Dune" onSave={vi.fn()} onCancel={vi.fn()} />)
  expect(screen.getByRole('textbox')).toHaveValue('Dune')
})

test('Save calls onSave with the edited value', async () => {
  const onSave = vi.fn()
  render(<RenameDialog initialValue="Dune" onSave={onSave} onCancel={vi.fn()} />)
  const input = screen.getByRole('textbox')
  await userEvent.clear(input)
  await userEvent.type(input, 'Dune Messiah')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(onSave).toHaveBeenCalledWith('Dune Messiah')
})

test('Save is disabled when input cleared to empty', async () => {
  render(<RenameDialog initialValue="Dune" onSave={vi.fn()} onCancel={vi.fn()} />)
  const input = screen.getByRole('textbox')
  await userEvent.clear(input)
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
})

test('submitting via Enter works', async () => {
  const onSave = vi.fn()
  render(<RenameDialog initialValue="Dune" onSave={onSave} onCancel={vi.fn()} />)
  const input = screen.getByRole('textbox')
  await userEvent.clear(input)
  await userEvent.type(input, 'Dune Messiah{Enter}')
  expect(onSave).toHaveBeenCalledWith('Dune Messiah')
})

test('Cancel calls onCancel', async () => {
  const onCancel = vi.fn()
  render(<RenameDialog initialValue="Dune" onSave={vi.fn()} onCancel={onCancel} />)
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onCancel).toHaveBeenCalledTimes(1)
})
