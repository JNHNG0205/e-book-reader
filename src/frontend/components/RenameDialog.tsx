import { useEffect, useRef, useState } from 'react'
import { Modal } from '@frontend/components/Modal'

export function RenameDialog({
  title, initialValue, onSave, onCancel,
}: {
  title?: string
  initialValue: string
  onSave: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  const trimmed = value.trim()

  return (
    <Modal title={title ?? 'Rename'} onClose={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!trimmed) return
          onSave(trimmed)
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mb-4 w-full rounded border px-2 py-1.5"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="rounded border px-3 py-1.5" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!trimmed}
            className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
