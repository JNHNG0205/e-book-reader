import { BookmarkSimple } from '@phosphor-icons/react'

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
      <BookmarkSimple className="h-5 w-5" weight={active ? 'fill' : 'regular'} />
    </button>
  )
}
