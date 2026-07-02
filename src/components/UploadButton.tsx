import type { ChangeEvent } from 'react'
import type { BookFormat } from '../types'

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
}: {
  onUpload: (file: File, meta: { title: string; format: BookFormat }) => void
}) {
  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const format = inferFormat(file.name)
    if (!format) {
      window.alert('Only PDF and EPUB files are supported.')
      return
    }
    onUpload(file, { title: stripExtension(file.name), format })
  }

  return (
    <label className="cursor-pointer rounded bg-black px-4 py-2 text-sm text-white">
      Add book
      <input
        type="file" accept=".pdf,.epub" aria-label="Add book"
        className="hidden" onChange={onChange}
      />
    </label>
  )
}
