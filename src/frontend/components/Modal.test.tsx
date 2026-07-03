import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Modal } from './Modal'

test('renders title and children', () => {
  render(
    <Modal title="My Title" onClose={vi.fn()}>
      <p>hello content</p>
    </Modal>,
  )
  expect(screen.getByText('My Title')).toBeInTheDocument()
  expect(screen.getByText('hello content')).toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: 'My Title' })).toBeInTheDocument()
})

test('Escape calls onClose', async () => {
  const onClose = vi.fn()
  render(
    <Modal title="My Title" onClose={onClose}>
      <p>hello content</p>
    </Modal>,
  )
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('clicking the backdrop calls onClose', async () => {
  const onClose = vi.fn()
  const { container } = render(
    <Modal title="My Title" onClose={onClose}>
      <p>hello content</p>
    </Modal>,
  )
  const backdrop = container.firstElementChild as Element
  await userEvent.click(backdrop)
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('clicking inside the card does not call onClose', async () => {
  const onClose = vi.fn()
  render(
    <Modal title="My Title" onClose={onClose}>
      <p>hello content</p>
    </Modal>,
  )
  await userEvent.click(screen.getByText('hello content'))
  expect(onClose).not.toHaveBeenCalled()
})
