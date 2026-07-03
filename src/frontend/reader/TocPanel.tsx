import type { TocItem } from './epubToc'

export function TocPanel({
  items, onNavigate, activeHref,
}: {
  items: TocItem[]
  onNavigate: (href: string) => void
  activeHref?: string | null
}) {
  if (items.length === 0) {
    return <p className="p-3 text-sm text-gray-400">No contents available.</p>
  }
  return (
    <ul className="p-2 text-sm">
      {items.map((item, i) => {
        const active = item.href === activeHref
        return (
          <li key={`${item.href}-${i}`}>
            <button
              type="button"
              onClick={() => onNavigate(item.href)}
              className={`block w-full truncate rounded px-2 py-1 text-left hover:bg-gray-100 ${
                active ? 'bg-blue-100 font-medium text-blue-700' : ''
              }`}
              style={{ paddingLeft: `${0.5 + item.level * 0.75}rem` }}
            >
              {item.label}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
