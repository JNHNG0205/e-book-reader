import { expect, test } from 'vitest'
import { flattenToc } from './epubToc'

test('flattens nested toc with increasing level', () => {
  const nav = [
    { label: 'Ch 1', href: 'c1.xhtml', subitems: [
      { label: 'Ch 1.1', href: 'c1.xhtml#s1', subitems: [] },
    ] },
    { label: 'Ch 2', href: 'c2.xhtml', subitems: [] },
  ]
  expect(flattenToc(nav)).toEqual([
    { label: 'Ch 1', href: 'c1.xhtml', level: 0 },
    { label: 'Ch 1.1', href: 'c1.xhtml#s1', level: 1 },
    { label: 'Ch 2', href: 'c2.xhtml', level: 0 },
  ])
})

test('trims labels and tolerates missing subitems', () => {
  const nav = [{ label: '  Intro  ', href: 'i.xhtml' }]
  expect(flattenToc(nav)).toEqual([{ label: 'Intro', href: 'i.xhtml', level: 0 }])
})
