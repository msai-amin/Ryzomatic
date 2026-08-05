/**
 * Tests for markdownToPlainText — the guard that stops extractor markup from
 * being read aloud by TTS.
 *
 * The fixtures at the bottom are verbatim output captured from the real
 * libraries, so the suite fails if either changes its rendering in a way that
 * would reach `pageTexts`.
 */

import { describe, it, expect } from 'vitest'
import { markdownToPlainText, findMarkdownMarkers } from '../../src/utils/markdownToPlainText'

describe('headings', () => {
  it('strips ATX headings at every level', () => {
    expect(markdownToPlainText('# One')).toBe('One')
    expect(markdownToPlainText('###### Six')).toBe('Six')
  })

  it('strips closing hashes', () => {
    expect(markdownToPlainText('## Title ##')).toBe('Title')
  })

  it('leaves a hash that is not a heading alone', () => {
    expect(markdownToPlainText('issue #42 is open')).toBe('issue #42 is open')
  })
})

describe('emphasis', () => {
  it('removes bold, italic, strike and inline code', () => {
    expect(markdownToPlainText('**bold** and *italic* and ~~gone~~ and `code`')).toBe(
      'bold and italic and gone and code'
    )
  })

  it('handles bold-italic combinations', () => {
    expect(markdownToPlainText('***both***')).toBe('both')
    expect(markdownToPlainText('___both___')).toBe('both')
  })

  it('preserves snake_case identifiers — the naive-stripping trap', () => {
    // A blanket _..._ rule turns this into "pagetextscleaned". Extracted
    // technical documents are full of identifiers like this.
    expect(markdownToPlainText('the page_texts_cleaned column')).toBe(
      'the page_texts_cleaned column'
    )
    expect(markdownToPlainText('call extract_pages_markdown() now')).toBe(
      'call extract_pages_markdown() now'
    )
  })

  it('still strips genuine underscore italics', () => {
    expect(markdownToPlainText('a _stressed_ word')).toBe('a stressed word')
  })
})

describe('links and images', () => {
  it('keeps link text and drops the target', () => {
    expect(markdownToPlainText('see [the docs](https://example.com/x) now')).toBe(
      'see the docs now'
    )
  })

  it('keeps image alt text', () => {
    expect(markdownToPlainText('![a diagram](img.png)')).toBe('a diagram')
  })

  it('handles reference links and autolinks', () => {
    expect(markdownToPlainText('[label][ref]')).toBe('label')
    expect(markdownToPlainText('<https://example.com>')).toBe('https://example.com')
  })
})

describe('tables — structure preserved as punctuation', () => {
  it('turns rows into comma-joined sentences and drops the delimiter row', () => {
    const md = [
      '| Migration | Name | Description |',
      '| --- | --- | --- |',
      '| 001 | initial_schema | Core tables |',
    ].join('\n')

    expect(markdownToPlainText(md)).toBe(
      'Migration, Name, Description\n001, initial_schema, Core tables'
    )
  })

  it('handles alignment markers in the delimiter row', () => {
    const md = ['| A | B |', '|:--|--:|', '| 1 | 2 |'].join('\n')
    expect(markdownToPlainText(md)).toBe('A, B\n1, 2')
  })

  it('strips inline markup inside cells', () => {
    const md = ['| **Bold** | `code` |', '| --- | --- |'].join('\n')
    expect(markdownToPlainText(md)).toBe('Bold, code')
  })
})

describe('lists, quotes, rules, code', () => {
  it('drops bullets but keeps ordered-list numbers', () => {
    // "1." is meaningful when spoken; a bullet glyph is not.
    expect(markdownToPlainText('- alpha\n* beta\n+ gamma')).toBe('alpha\nbeta\ngamma')
    expect(markdownToPlainText('1. first\n2. second')).toBe('1. first\n2. second')
  })

  it('drops task-list checkboxes', () => {
    expect(markdownToPlainText('- [ ] todo\n- [x] done')).toBe('todo\ndone')
  })

  it('unwraps blockquotes including nested ones', () => {
    expect(markdownToPlainText('> quoted')).toBe('quoted')
    expect(markdownToPlainText('> > deeply')).toBe('deeply')
  })

  it('keeps fenced code content but drops the fences', () => {
    expect(markdownToPlainText('```js\nconst x = 1\n```')).toBe('const x = 1')
  })

  it('removes horizontal rules', () => {
    expect(markdownToPlainText('a\n\n---\n\nb')).toBe('a\n\nb')
  })
})

describe('whitespace and edge cases', () => {
  it('is safe on empty and nullish input', () => {
    expect(markdownToPlainText('')).toBe('')
    expect(markdownToPlainText(null)).toBe('')
    expect(markdownToPlainText(undefined)).toBe('')
  })

  it('collapses excessive blank lines into one paragraph break', () => {
    expect(markdownToPlainText('a\n\n\n\n\nb')).toBe('a\n\nb')
  })

  it('leaves plain prose untouched', () => {
    const prose = 'Nietzsche was interrogating the near and distant future.'
    expect(markdownToPlainText(prose)).toBe(prose)
  })
})

describe('real extractor output — the regression this guards', () => {
  it('cleans pdf-inspector output captured from this repo', () => {
    // Verbatim from @firecrawl/pdf-inspector v1.12.0 against
    // docs/architecture/SMART_READER_DATABASE_GUIDE.pdf
    const real =
      '## B TABLE QUICK REFERENCE\n\n' +
      '# Migration Reference\n\n' +
      '|Migration|Name|Description|\n' +
      '|---|---|---|\n' +
      '|001|initial_schema|Core tables: profiles, documents|\n'

    const out = markdownToPlainText(real)

    expect(findMarkdownMarkers(out)).toEqual([])
    expect(out).toContain('B TABLE QUICK REFERENCE')
    expect(out).toContain('001, initial_schema, Core tables: profiles, documents')
    expect(out).not.toContain('|')
    expect(out).not.toContain('#')
  })

  it('cleans anydoc CSV output captured from the corpus fixture', () => {
    // Verbatim from @firecrawl/anydoc v0.1.6 against tests/fixtures/corpus/table.csv
    const real =
      '| Migration | Name | Description |\n' +
      '| --- | --- | --- |\n' +
      '| 001 | initial_schema | Core tables |\n' +
      '| 002 | add_profile_policy | RLS for profiles |\n'

    const out = markdownToPlainText(real)

    expect(findMarkdownMarkers(out)).toEqual([])
    expect(out).toBe(
      'Migration, Name, Description\n' +
        '001, initial_schema, Core tables\n' +
        '002, add_profile_policy, RLS for profiles'
    )
  })
})

describe('findMarkdownMarkers', () => {
  it('names what leaked rather than just reporting failure', () => {
    expect(findMarkdownMarkers('## h')).toContain('heading')
    expect(findMarkdownMarkers('**b**')).toContain('bold')
    expect(findMarkdownMarkers('| a | b |')).toContain('table-row')
    expect(findMarkdownMarkers('```js')).toContain('code-fence')
    expect(findMarkdownMarkers('[x](y)')).toContain('link')
    expect(findMarkdownMarkers('![x](y)')).toContain('image')
  })

  it('reports nothing for clean prose', () => {
    expect(findMarkdownMarkers('Plain text, with punctuation: fine.')).toEqual([])
  })
})
