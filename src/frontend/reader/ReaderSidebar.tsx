import { useState, type ReactNode } from 'react'

export interface SidebarTab {
  key: string
  label: string
  icon?: ReactNode
  render: () => ReactNode
}

export function ReaderSidebar({ tabs, onClose }: { tabs: SidebarTab[]; onClose: () => void }) {
  const [active, setActive] = useState(tabs[0]?.key)
  const current = tabs.find((t) => t.key === active) ?? tabs[0]

  return (
    <div className="flex w-[27rem] shrink-0 flex-col border-r border-line-soft bg-paper-raised">
      <div className="flex items-center border-b border-line-soft">
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-2.5 text-sm transition-colors ${
                t.key === current?.key
                  ? 'border-b-2 border-accent font-semibold text-ink'
                  : 'border-b-2 border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center text-ink-soft hover:text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
            <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{current?.render()}</div>
    </div>
  )
}
