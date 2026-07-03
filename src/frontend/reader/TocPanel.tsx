import type { TocItem } from './epubToc'

export function TocPanel({
  items, onNavigate,
}: {
  items: TocItem[]
  onNavigate: (href: string) => void
}) {
  return (
    <nav className="w-64 shrink-0 overflow-auto border-r bg-white p-2 text-sm">
      <div className="mb-2 px-2 font-semibold text-gray-500">Contents</div>
      {items.length === 0 ? (
        <p className="px-2 text-gray-400">No contents available.</p>
      ) : (
        <ul>
          {items.map((item, i) => (
            <li key={`${item.href}-${i}`}>
              <button
                type="button"
                onClick={() => onNavigate(item.href)}
                className="block w-full truncate rounded px-2 py-1 text-left hover:bg-gray-100"
                style={{ paddingLeft: `${0.5 + item.level * 0.75}rem` }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
