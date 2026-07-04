import type { ChangeEvent } from 'react'
import type { BookFormat } from '@shared/types'
import { PlusIcon } from '@frontend/reader/icons'

function inferFormat(filename: string): BookFormat | null {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.epub')) return 'epub'
  return null
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '')
}

export function UploadButton({
  onUpload,
  onReject,
}: {
  onUpload: (file: File, meta: { title: string; format: BookFormat }) => void
  onReject?: (message: string) => void
}) {
  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const format = inferFormat(file.name)
    if (!format) {
      onReject?.('Only PDF and EPUB files are supported.')
      return
    }
    onUpload(file, { title: stripExtension(file.name), format })
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-deep">
      <PlusIcon className="h-4 w-4" />
      Add book
      <input
        type="file" accept=".pdf,.epub" aria-label="Add book"
        className="hidden" onChange={onChange}
      />
    </label>
  )
}
