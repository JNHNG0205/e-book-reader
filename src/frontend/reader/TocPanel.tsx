import type { TocItem } from './epubToc'

export function TocPanel({
  items, onNavigate, activeHref, onClose,
}: {
  items: TocItem[]
  onNavigate: (href: string) => void
  activeHref?: string | null
  onClose?: () => void
}) {
  return (
    <nav className="w-64 shrink-0 overflow-auto border-r bg-white p-2 text-sm">
      <div className="mb-2 flex items-center justify-between px-2">
        <span className="font-semibold text-gray-500">Contents</span>
        {onClose && (
          <button
            type="button"
            aria-label="Close contents"
            onClick={onClose}
            className="rounded px-1 text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="px-2 text-gray-400">No contents available.</p>
      ) : (
        <ul>
          {items.map((item, i) => {
            const isActive = item.href === activeHref
            return (
              <li key={`${item.href}-${i}`}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.href)}
                  className={`block w-full truncate rounded px-2 py-1 text-left hover:bg-gray-100 ${
                    isActive ? 'bg-blue-100 text-blue-700 font-medium' : ''
                  }`}
                  style={{ paddingLeft: `${0.5 + item.level * 0.75}rem` }}
                >
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </nav>
  )
}
