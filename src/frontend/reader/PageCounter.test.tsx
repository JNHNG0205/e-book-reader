import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { PageCounter } from './PageCounter'

test('shows the current page and total', () => {
  render(<PageCounter current={12} total={340} onGoTo={() => {}} />)
  expect(screen.getByLabelText('Go to page')).toHaveValue('12')
  expect(screen.getByText('/ 340')).toBeInTheDocument()
})

test('typing a page and pressing Enter jumps to it', async () => {
  const onGoTo = vi.fn()
  render(<PageCounter current={1} total={340} onGoTo={onGoTo} />)
  const input = screen.getByLabelText('Go to page')
  await userEvent.clear(input)
  await userEvent.type(input, '150{Enter}')
  expect(onGoTo).toHaveBeenCalledWith(150)
})

test('rejects an out-of-range page and resets the field', async () => {
  const onGoTo = vi.fn()
  render(<PageCounter current={5} total={10} onGoTo={onGoTo} />)
  const input = screen.getByLabelText('Go to page')
  await userEvent.clear(input)
  await userEvent.type(input, '999{Enter}')
  expect(onGoTo).not.toHaveBeenCalled()
  expect(input).toHaveValue('5')
})

test('shows a placeholder while the total is unknown', () => {
  render(<PageCounter current={0} total={0} onGoTo={() => {}} />)
  expect(screen.queryByLabelText('Go to page')).not.toBeInTheDocument()
  expect(screen.getByText('…')).toBeInTheDocument()
})
