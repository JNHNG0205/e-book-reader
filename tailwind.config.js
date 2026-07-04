/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // "Editions" design tokens — ink-blue on laid paper, a shelf of fine printings.
      colors: {
        paper: '#f2f1ec',
        'paper-raised': '#fbfaf6',
        ink: '#1b1a17',
        'ink-soft': '#6b665c',
        'ink-faint': '#9a948a',
        line: '#ddd8cc',
        'line-soft': '#e7e3d9',
        accent: '#2c2d8c',
        'accent-deep': '#202168',
        'accent-tint': '#e3e3f1',
        seal: '#8a6d2f',
      },
      fontFamily: {
        // Reading/display serif — the faces book apps actually render with.
        serif: ['New York', 'Charter', 'Iowan Old Style', 'Palatino Linotype', 'Palatino', 'Georgia', 'serif'],
        // Interface sans.
        sans: ['SF Pro Text', '-apple-system', 'system-ui', 'Helvetica Neue', 'Arial', 'sans-serif'],
        // Page counts / percentages, with tabular figures.
        mono: ['SF Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
