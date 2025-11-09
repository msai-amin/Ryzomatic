import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { extractEpub } from '../src/services/epubExtractionOrchestrator'

async function createTestEpub(sections: Array<{ id: string; title: string; body: string }>): Promise<ArrayBuffer> {
  const zip = new JSZip()

  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
      </rootfiles>
    </container>`
  )

  const manifestItems = sections
    .map(
      (section) =>
        `<item id="${section.id}" href="${section.id}.xhtml" media-type="application/xhtml+xml"/>`
    )
    .join('\n')

  const spineItems = sections.map((section) => `<itemref idref="${section.id}"/>`).join('\n')

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
    <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>Test EPUB</dc:title>
        <dc:creator>Vitest</dc:creator>
        <dc:language>en</dc:language>
      </metadata>
      <manifest>
        ${manifestItems}
      </manifest>
      <spine>
        ${spineItems}
      </spine>
    </package>`
  )

  for (const section of sections) {
    zip.file(
      `OEBPS/${section.id}.xhtml`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <title>${section.title}</title>
        </head>
        <body>
          <h1>${section.title}</h1>
          <p>${section.body}</p>
        </body>
      </html>`
    )
  }

  return zip.generateAsync({ type: 'arraybuffer' })
}

describe('extractEpub', () => {
  it('extracts chapters and content from a minimal EPUB archive', async () => {
    const buffer = await createTestEpub([
      { id: 'chapter1', title: 'Chapter 1', body: 'This is the first chapter.' },
      { id: 'chapter2', title: 'Chapter 2', body: 'This is the second chapter.' }
    ])

    const result = await extractEpub(buffer)

    expect(result.success).toBe(true)
    expect(result.sections).toHaveLength(2)
    expect(result.sections[0]).toContain('This is the first chapter.')
    expect(result.sections[1]).toContain('This is the second chapter.')
    expect(result.sectionsHtml).toHaveLength(2)
    expect(result.sectionsHtml[0]).toMatch(/<p[^>]*>This is the first chapter\./)
    expect(result.metadata.title).toBe('Test EPUB')
    expect(result.metadata.chapters).toHaveLength(2)
  })

  it('returns a failure result when the EPUB structure is invalid', async () => {
    const zip = new JSZip()
    zip.file('invalid.txt', 'not an epub')
    const buffer = await zip.generateAsync({ type: 'arraybuffer' })

    const result = await extractEpub(buffer)

    expect(result.success).toBe(false)
    expect(result.sections).toHaveLength(0)
    expect(result.sectionsHtml).toHaveLength(0)
    expect(result.content).toBe('')
  })
})

