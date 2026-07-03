export function BookmarkStar({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const label = active ? 'Remove bookmark' : 'Add bookmark'
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={`text-2xl leading-none ${active ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-600'}`}
    >
      {active ? '★' : '☆'}
    </button>
  )
}
