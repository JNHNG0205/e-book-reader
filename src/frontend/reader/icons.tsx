import type { ReactNode } from 'react'

interface IconProps {
  className?: string
}

// Small inline outline icons (currentColor, sized via className). Kept as SVG rather than
// emoji so they render consistently and inherit text color/size.
function Svg({ className = 'h-4 w-4', children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

// A left-panel / sidebar glyph for the "open the reading panel" toggle.
export function PanelIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </Svg>
  )
}

// Table of contents — a bulleted list.
export function ContentsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="16" y2="18" />
      <circle cx="4" cy="6" r="0.6" />
      <circle cx="4" cy="12" r="0.6" />
      <circle cx="4" cy="18" r="0.6" />
    </Svg>
  )
}

export function BookmarkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3h12v18l-6-4-6 4V3z" />
    </Svg>
  )
}

// A marker/pen for highlights.
export function HighlightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </Svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  )
}

// Download-with-check glyph for "available offline" badges.
export function OfflineIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v10" />
      <path d="M8 9l4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h5" />
      <path d="M15 19l2 2 4-4" />
    </Svg>
  )
}
