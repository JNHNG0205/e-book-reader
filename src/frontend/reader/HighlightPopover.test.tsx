import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { HighlightPopover } from './HighlightPopover'

test('create mode: picks a color', async () => {
  const onPickColor = vi.fn()
  render(<HighlightPopover x={10} y={10} mode="create" onPickColor={onPickColor} onClose={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /green/i }))
  expect(onPickColor).toHaveBeenCalledWith('green')
})

test('edit mode: saves a note and deletes', async () => {
  const onSaveNote = vi.fn(); const onDelete = vi.fn()
  render(
    <HighlightPopover x={0} y={0} mode="edit" color="yellow" note="old"
      onPickColor={() => {}} onSaveNote={onSaveNote} onDelete={onDelete} onClose={() => {}} />,
  )
  const box = screen.getByRole('textbox')
  await userEvent.clear(box)
  await userEvent.type(box, 'my note')
  await userEvent.click(screen.getByRole('button', { name: /save note/i }))
  expect(onSaveNote).toHaveBeenCalledWith('my note')
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDelete).toHaveBeenCalled()
})

test('cancel button closes without highlighting', async () => {
  const onClose = vi.fn(); const onPickColor = vi.fn()
  render(<HighlightPopover x={0} y={0} mode="create" onPickColor={onPickColor} onClose={onClose} />)
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
  expect(onClose).toHaveBeenCalled()
  expect(onPickColor).not.toHaveBeenCalled()
})

test('closes on Escape', async () => {
  const onClose = vi.fn()
  render(<HighlightPopover x={0} y={0} mode="create" onPickColor={() => {}} onClose={onClose} />)
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalled()
})
