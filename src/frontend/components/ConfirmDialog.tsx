import { Modal } from '@frontend/components/Modal'

export function ConfirmDialog({
  title, message, confirmLabel, cancelLabel, danger, onConfirm, onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="mb-4 text-sm text-gray-700">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="rounded border px-3 py-1.5"
          onClick={onCancel}
        >
          {cancelLabel ?? 'Cancel'}
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1.5 ${danger ? 'bg-red-600 text-white' : 'bg-black text-white'}`}
          onClick={onConfirm}
        >
          {confirmLabel ?? 'Confirm'}
        </button>
      </div>
    </Modal>
  )
}
