import type { TocItem } from './epubToc'

export function TocPanel({
  items, onNavigate, activeHref,
}: {
  items: TocItem[]
  onNavigate: (href: string) => void
  activeHref?: string | null
}) {
  if (items.length === 0) {
    return <p className="p-3 text-sm text-ink-faint">No contents available.</p>
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
              className={`block w-full truncate rounded-md px-3 py-1.5 text-left ${
                active
                  ? 'bg-accent-tint font-serif font-semibold text-accent-deep'
                  : 'text-ink hover:bg-line-soft'
              }`}
              style={{ paddingLeft: `${0.75 + item.level * 0.75}rem` }}
            >
              {item.label}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
