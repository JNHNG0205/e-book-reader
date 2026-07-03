export interface TocItem {
  label: string
  href: string
  level: number
}

export interface NavItem {
  label: string
  href: string
  subitems?: NavItem[]
}

export function flattenToc(navToc: NavItem[], level = 0): TocItem[] {
  const out: TocItem[] = []
  for (const item of navToc) {
    out.push({ label: item.label.trim(), href: item.href, level })
    if (item.subitems && item.subitems.length > 0) {
      out.push(...flattenToc(item.subitems, level + 1))
    }
  }
  return out
}
