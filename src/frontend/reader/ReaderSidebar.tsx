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
    <div className="flex w-[27rem] shrink-0 flex-col border-r bg-white">
      <div className="flex items-center border-b">
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`flex shrink-0 items-center gap-1 whitespace-nowrap px-2 py-2 text-sm ${
                t.key === current?.key ? 'border-b-2 border-black font-medium' : 'text-gray-500'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" aria-label="Close panel" onClick={onClose} className="shrink-0 px-2 text-gray-500">
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{current?.render()}</div>
    </div>
  )
}
