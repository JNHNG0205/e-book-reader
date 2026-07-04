import { useEffect, type ReactNode } from 'react'

export function Modal({
  title, onClose, children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-xl border border-line bg-paper-raised p-5 shadow-[0_24px_60px_-24px_rgba(27,26,23,0.6)]"
      >
        <h3 className="mb-3 font-serif text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h3>
        {children}
      </div>
    </div>
  )
}
