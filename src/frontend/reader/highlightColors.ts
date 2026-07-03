export interface HighlightColor {
  key: string
  label: string
  value: string
}

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  { key: 'yellow', label: 'Yellow', value: '#fde047' },
  { key: 'green', label: 'Green', value: '#86efac' },
  { key: 'pink', label: 'Pink', value: '#f9a8d4' },
  { key: 'blue', label: 'Blue', value: '#93c5fd' },
]

export function colorValue(key: string): string {
  return HIGHLIGHT_COLORS.find((c) => c.key === key)?.value ?? HIGHLIGHT_COLORS[0].value
}
