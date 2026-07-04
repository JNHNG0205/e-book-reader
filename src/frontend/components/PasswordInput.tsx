import { useState } from 'react'
import { EyeIcon, EyeSlashIcon } from '@frontend/reader/icons'

// A labelled password field with a show/hide toggle. The wrapping <label> keeps the input
// reachable by its visible label; the toggle button is interactive content, so clicking it
// flips visibility without also focusing the field.
export function PasswordInput({
  label, value, onChange, autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <label className="block">
      <span className="u-label">{label}</span>
      <div className="relative mt-1.5">
        <input
          type={show ? 'text' : 'password'}
          required
          minLength={6}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 pr-10 text-ink focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-faint hover:text-ink-soft"
        >
          {show ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </div>
    </label>
  )
}
