export function BookmarkStar({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const label = active ? 'Remove bookmark' : 'Add bookmark'
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={`grid h-9 w-9 place-items-center rounded-md border border-line bg-paper-raised/90 shadow-sm backdrop-blur-sm transition-colors ${
        active ? 'text-accent' : 'text-ink-faint hover:text-ink-soft'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.7}
        className="h-5 w-5"
      >
        <path d="M6 3h12v18l-6-4-6 4V3z" />
      </svg>
    </button>
  )
}
