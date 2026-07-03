import { useState, type ReactNode } from 'react'

export interface SidebarTab {
  key: string
  label: string
  render: () => ReactNode
}

export function ReaderSidebar({ tabs, onClose }: { tabs: SidebarTab[]; onClose: () => void }) {
  const [active, setActive] = useState(tabs[0]?.key)
  const current = tabs.find((t) => t.key === active) ?? tabs[0]

  return (
    <div className="flex w-72 shrink-0 flex-col border-r bg-white">
      <div className="flex items-center justify-between border-b">
        <div className="flex">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`px-3 py-2 text-sm ${
                t.key === current?.key ? 'border-b-2 border-black font-medium' : 'text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" aria-label="Close panel" onClick={onClose} className="px-3 text-gray-500">
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{current?.render()}</div>
    </div>
  )
}
