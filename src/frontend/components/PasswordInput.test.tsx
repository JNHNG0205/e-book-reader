import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { PasswordInput } from './PasswordInput'

test('starts hidden and toggles visibility with the show/hide button', async () => {
  render(<PasswordInput label="Password" value="secret12" onChange={vi.fn()} />)
  const input = screen.getByLabelText('Password')
  expect(input).toHaveAttribute('type', 'password')

  await userEvent.click(screen.getByRole('button', { name: 'Show password' }))
  expect(input).toHaveAttribute('type', 'text')

  await userEvent.click(screen.getByRole('button', { name: 'Hide password' }))
  expect(input).toHaveAttribute('type', 'password')
})

test('reports typed characters through onChange', async () => {
  const onChange = vi.fn()
  render(<PasswordInput label="Password" value="" onChange={onChange} />)
  await userEvent.type(screen.getByLabelText('Password'), 'a')
  expect(onChange).toHaveBeenCalledWith('a')
})
