import JSZip from 'jszip'

interface SpineItem {
  idref: string
}

interface ManifestItem {
  id: string
  href: string
  mediaType: string
}

export interface EpubExtractionResult {
  success: boolean
  content: string
  sections: string[]
  sectionsHtml: string[]
  totalSections: number
  metadata: {
    title?: string
    author?: string
    language?: string
    chapters: Array<{
      id: string
      href: string
      title?: string
    }>
  }
}

const WHITESPACE_REGEX = /\s+/g

function cleanText(text: string): string {
  return text.replace(WHITESPACE_REGEX, ' ').trim()
}

function getFirstTextContent(doc: Document, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const node = doc.querySelector(selector)
    const value = node?.textContent
    if (value && cleanText(value)) {
      return cleanText(value)
    }
  }
  return undefined
}

function resolvePath(basePath: string, relativePath: string): string {
  if (!basePath) return relativePath
  if (relativePath.startsWith('/')) return relativePath.slice(1)
  const segments = basePath.split('/').filter(Boolean)
  const relativeSegments = relativePath.split('/')

  for (const segment of relativeSegments) {
    if (segment === '..') {
      segments.pop()
    } else if (segment !== '.') {
      segments.push(segment)
    }
  }

  return segments.join('/')
}

export async function extractEpub(
  file: File | ArrayBuffer | Uint8Array
): Promise<EpubExtractionResult> {
  try {
    const arrayBuffer =
      file instanceof File
        ? await file.arrayBuffer()
        : file instanceof Uint8Array
          ? file.buffer
          : file

    const zip = await JSZip.loadAsync(arrayBuffer)

    const containerFile = zip.file('META-INF/container.xml')
    if (!containerFile) {
      throw new Error('container.xml not found in EPUB archive')
    }

    const containerXml = await containerFile.async('string')
    const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml')
    const rootfileElement = containerDoc.querySelector('rootfile')
    const rootfilePath = rootfileElement?.getAttribute('full-path')

    if (!rootfilePath) {
      throw new Error('Unable to locate package (OPF) file')
    }

    const opfFile = zip.file(rootfilePath)
    if (!opfFile) {
      throw new Error(`Package file ${rootfilePath} missing from EPUB`)
    }

    const opfXml = await opfFile.async('string')
    const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml')

    const manifest: Record<string, ManifestItem> = {}
    const manifestItems = Array.from(opfDoc.getElementsByTagName('item')) as Element[]
    manifestItems.forEach((item) => {
      const id = item.getAttribute('id')
      const href = item.getAttribute('href')
      const mediaType = item.getAttribute('media-type')
      if (id && href && mediaType) {
        manifest[id] = { id, href, mediaType }
      }
    })

    const spineItems = Array.from(opfDoc.getElementsByTagName('itemref')) as Element[]
    const spine: SpineItem[] = spineItems
      .map((item) => {
        const idref = item.getAttribute('idref')
        return idref ? { idref } : null
      })
      .filter(Boolean) as SpineItem[]

    if (spine.length === 0) {
      throw new Error('EPUB spine is empty')
    }

    const metadataNode = opfDoc.getElementsByTagName('metadata')?.[0]
    const title = metadataNode
      ? getFirstTextContent(metadataNode, ['dc\\:title', 'title'])
      : undefined
    const author = metadataNode
      ? getFirstTextContent(metadataNode, ['dc\\:creator', 'creator', 'author'])
      : undefined
    const language = metadataNode
      ? getFirstTextContent(metadataNode, ['dc\\:language', 'language'])
      : undefined

    const opfDir =
      rootfilePath.lastIndexOf('/') >= 0 ? rootfilePath.slice(0, rootfilePath.lastIndexOf('/') + 1) : ''

    const sections: string[] = []
    const sectionsHtml: string[] = []
    const chapters: EpubExtractionResult['metadata']['chapters'] = []

    for (const spineItem of spine) {
      const manifestItem = manifest[spineItem.idref]
      if (!manifestItem) continue

      // Skip non XHTML content (e.g., images, stylesheets)
      if (
        !manifestItem.mediaType.includes('html') &&
        manifestItem.mediaType !== 'application/xhtml+xml' &&
        manifestItem.mediaType !== 'application/xml'
      ) {
        continue
      }

      const entryPath = resolvePath(opfDir, manifestItem.href)
      const entryFile = zip.file(entryPath)
      if (!entryFile) continue

      const entryContent = await entryFile.async('string')
      const contentDoc = new DOMParser().parseFromString(entryContent, 'application/xhtml+xml')

      // Remove scripts/styles
      contentDoc.querySelectorAll('script').forEach((node) => node.remove())
      contentDoc.querySelectorAll('style').forEach((node) => node.remove())

      const bodyElement = contentDoc.body
      const bodyText = cleanText(bodyElement?.textContent || '')
      const rawHtml = bodyElement?.innerHTML?.trim() || ''

      if (!bodyText && !rawHtml) {
        continue
      }

      sections.push(bodyText)
      sectionsHtml.push(rawHtml)

      const chapterTitle =
        cleanText(
          contentDoc.querySelector('h1,h2,h3,h4,h5,h6,title')?.textContent || ''
        ) || undefined

      chapters.push({
        id: manifestItem.id,
        href: entryPath,
        title: chapterTitle
      })
    }

    const content = sections.join('\n\n').trim()

    return {
      success: true,
      content,
      sections,
      sectionsHtml,
      totalSections: sections.length,
      metadata: {
        title,
        author,
        language,
        chapters
      }
    }
  } catch (error) {
    console.error('EPUB extraction failed:', error)

    return {
      success: false,
      content: '',
      sections: [],
      sectionsHtml: [],
      totalSections: 0,
      metadata: {
        chapters: []
      }
    }
  }
}

