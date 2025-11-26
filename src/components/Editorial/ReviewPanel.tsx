import React, { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Quote, LayoutTemplate, Sun, Moon, Sparkles, Loader2, Download, Type, Menu, X } from 'lucide-react'
import { autoReviewService } from '../../services/ai/autoReviewService'
import { peerReviewService } from '../../services/peerReviewService'
import { useAppStore } from '../../store/appStore'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import { saveAs } from 'file-saver'

const FONT_FAMILIES = [
  'Times New Roman',
  'Arial',
  'Helvetica',
  'Georgia',
  'Courier New',
  'Verdana',
  'Calibri',
  'Garamond',
] as const

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24] as const

const TEMPLATES = {
  standard: {
    label: 'Standard Review',
    content: `
      <h3>Summary</h3>
      <p>Provide a concise summary of the paper's main contribution, methodology, and key findings.</p>
      
      <h3>General Assessment</h3>
      <p>Offer a high-level evaluation of the paper's overall quality, significance, novelty, and potential impact.</p>
      
      <h3>Major Points</h3>
      <ul>
        <li>Identify critical issues that must be addressed for the paper to be acceptable.</li>
        <li>Provide specific references to sections, figures, or tables where applicable.</li>
      </ul>
      
      <h3>Minor Points</h3>
      <ul>
        <li>List smaller issues that would improve clarity, presentation, or robustness.</li>
        <li>Include typos, grammatical errors, or suggestions for improved phrasing.</li>
      </ul>
      
      <h3>Recommendation</h3>
      <p>State your recommendation: Accept, Minor Revisions, Major Revisions, or Reject.</p>
    `,
  },
  neurips: {
    label: 'NeurIPS Style',
    content: `
      <h3>Summary</h3>
      <p>Brief summary of the paper's contribution.</p>
      
      <h3>Strengths</h3>
      <ul>
        <li>List the main strengths of the paper.</li>
      </ul>
      
      <h3>Weaknesses</h3>
      <ul>
        <li>Identify areas where the paper could be improved.</li>
      </ul>
      
      <h3>Questions for Authors</h3>
      <ul>
        <li>Pose specific questions for clarification during the rebuttal phase.</li>
      </ul>
      
      <h3>Rating</h3>
      <p>Overall rating and recommendation.</p>
    `,
  },
  medical: {
    label: 'Medical Journal',
    content: `
      <h3>Summary</h3>
      <p>Summarize the research question, methods, results, and conclusions.</p>
      
      <h3>Methodology</h3>
      <p>Evaluate the study design, sample size, statistical methods, and potential biases.</p>
      
      <h3>Results</h3>
      <p>Assess the presentation and interpretation of results, including figures and tables.</p>
      
      <h3>Discussion</h3>
      <p>Evaluate the discussion of limitations, clinical significance, and future directions.</p>
      
      <h3>Recommendation</h3>
      <p>Accept, Minor Revisions, Major Revisions, or Reject.</p>
    `,
  },
} as const

export const ReviewPanel: React.FC = () => {
  const { 
    reviewCitations, 
    reviewContent, 
    setReviewContent,
    reviewFontFamily,
    reviewFontSize,
    reviewTheme,
    setReviewFontFamily,
    setReviewFontSize,
    setReviewTheme,
    currentDocument, 
    user 
  } = useAppStore()
  const [showTemplates, setShowTemplates] = useState(false)
  const [isAutoReviewing, setIsAutoReviewing] = useState(false)
  const [showFontMenu, setShowFontMenu] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Write your referee report here...',
      }),
    ],
    content: reviewContent,
    onUpdate: ({ editor }) => {
      setReviewContent(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: `prose max-w-none focus:outline-none min-h-[200px] ${
          reviewTheme === 'dark' ? 'prose-invert' : ''
        }`,
        style: `font-family: ${reviewFontFamily}; font-size: ${reviewFontSize}pt;`,
      },
    },
  })

  // Update editor style when font settings change
  useEffect(() => {
    if (editor?.view?.dom) {
      const editorElement = editor.view.dom as HTMLElement
      editorElement.style.fontFamily = reviewFontFamily
      editorElement.style.fontSize = `${reviewFontSize}pt`
    }
  }, [editor, reviewFontFamily, reviewFontSize])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showMenu && !target.closest('[data-menu-container]')) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  // Auto-Review Function
  const handleAutoReview = async () => {
    if (!currentDocument || !user) {
        alert('Please open a document and sign in first.')
        return
    }
    
    if (!editor?.isEmpty && !window.confirm('This will replace current content with an AI-generated review. Continue?')) {
        return
    }

    setIsAutoReviewing(true)
    
    try {
        console.log('🔍 Auto Review: Starting', { documentId: currentDocument.id, userId: user.id })
        
        // Generate review using Gemini (with fallback to in-memory pageTexts)
        const reviewHtml = await autoReviewService.generateAutoReview(
            currentDocument.id, 
            user.id,
            currentDocument.pageTexts // Fallback if DB fetch fails
        )
        
        if (!reviewHtml) {
            throw new Error('AI returned empty review')
        }
        
        console.log('✅ Auto Review: Success', { reviewLength: reviewHtml.length })
        editor?.commands.setContent(reviewHtml)
        setReviewContent(reviewHtml)
    } catch (error: any) {
        console.error('❌ Auto-review failed:', error)
        const errorMessage = error?.message || 'Unknown error occurred'
        alert(`Failed to generate review: ${errorMessage}\n\nCheck console for details.`)
    } finally {
        setIsAutoReviewing(false)
    }
  }

  // Download as DOCX and submit review
  const handleDownloadReview = async () => {
    // Get the latest content directly from the editor to ensure we have the most up-to-date content
    const currentContent = editor?.getHTML() || reviewContent || ''
    
    // Better validation: check if content is actually meaningful (not just empty tags)
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = currentContent
    const textContent = tempDiv.textContent || tempDiv.innerText || ''
    const hasContent = textContent.trim().length > 0

    if (!currentContent || !hasContent) {
        alert('Review content is empty. Please write your review before downloading.')
        return
    }

    if (!currentDocument?.id || !user?.id) {
        alert('Document or user information missing.')
        return
    }

    try {
        // Submit review to database
        await peerReviewService.submitReview(currentDocument.id, user.id)

        // Get clean content from editor
        const rawContent = (editor?.getHTML() || reviewContent || '').trim()
        
        // Convert HTML to docx structure
        const contentDiv = document.createElement('div')
        contentDiv.innerHTML = rawContent
        
        // Helper to convert HTML nodes to docx paragraphs
        const htmlToParagraphs = (node: Node): Paragraph[] => {
          const paragraphs: Paragraph[] = []
          
          if (node.nodeType === Node.TEXT_NODE) {
            const text = (node.textContent || '').trim()
            if (text) {
              paragraphs.push(new Paragraph({ 
                children: [new TextRun({ text, color: "000000" })],
                spacing: { after: 200 } 
              }))
            }
            return paragraphs
          }
          
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element
            const tagName = el.tagName.toLowerCase()
            const text = el.textContent || ''
            
            switch (tagName) {
              case 'h1':
                return [new Paragraph({ 
                  children: [new TextRun({ text, color: "000000" })],
                  heading: HeadingLevel.HEADING_1, 
                  spacing: { after: 200 } 
                })]
              case 'h2':
                return [new Paragraph({ 
                  children: [new TextRun({ text, color: "000000" })],
                  heading: HeadingLevel.HEADING_2, 
                  spacing: { after: 200 } 
                })]
              case 'h3':
                return [new Paragraph({ 
                  children: [new TextRun({ text, color: "000000" })],
                  heading: HeadingLevel.HEADING_3, 
                  spacing: { after: 200 } 
                })]
              case 'h4':
              case 'h5':
              case 'h6':
                return [new Paragraph({ 
                  children: [new TextRun({ text, color: "000000" })],
                  heading: HeadingLevel.HEADING_4, 
                  spacing: { after: 200 } 
                })]
              case 'p':
                // Handle formatting within paragraphs
                const runs: TextRun[] = []
                const processNode = (n: Node) => {
                  if (n.nodeType === Node.TEXT_NODE) {
                    const t = n.textContent || ''
                    if (t.trim()) runs.push(new TextRun({ text: t, color: "000000" }))
                  } else if (n.nodeType === Node.ELEMENT_NODE) {
                    const e = n as Element
                    const tag = e.tagName.toLowerCase()
                    const content = e.textContent || ''
                    if (tag === 'strong' || tag === 'b') {
                      runs.push(new TextRun({ text: content, bold: true, color: "000000" }))
                    } else if (tag === 'em' || tag === 'i') {
                      runs.push(new TextRun({ text: content, italics: true, color: "000000" }))
                    } else if (tag === 'u') {
                      runs.push(new TextRun({ text: content, underline: {}, color: "000000" }))
                    } else {
                      Array.from(e.childNodes).forEach(processNode)
                    }
                  }
                }
                Array.from(el.childNodes).forEach(processNode)
                if (runs.length > 0) {
                  return [new Paragraph({ children: runs, spacing: { after: 200 } })]
                }
                return [new Paragraph({ 
                  children: [new TextRun({ text, color: "000000" })],
                  spacing: { after: 200 } 
                })]
              case 'ul':
              case 'ol':
                const items: Paragraph[] = []
                el.querySelectorAll('li').forEach(li => {
                  items.push(new Paragraph({ 
                    children: [new TextRun({ text: li.textContent || '', color: "000000" })],
                    bullet: { level: 0 },
                    spacing: { after: 100 }
                  }))
                })
                return items
              case 'li':
                return [new Paragraph({ 
                  children: [new TextRun({ text, color: "000000" })],
                  bullet: { level: 0 }, 
                  spacing: { after: 100 } 
                })]
              case 'br':
                return [new Paragraph({ text: '' })]
              case 'div':
                // Process children
                const childParas: Paragraph[] = []
                Array.from(el.childNodes).forEach(child => {
                  childParas.push(...htmlToParagraphs(child))
                })
                return childParas
              default:
                // For other tags, just get text content
                if (text.trim()) {
                  return [new Paragraph({ 
                    children: [new TextRun({ text, color: "000000" })],
                    spacing: { after: 200 } 
                  })]
                }
                return []
            }
          }
          
          return []
        }
        
        // Convert all content to paragraphs
        const contentParagraphs: Paragraph[] = []
        Array.from(contentDiv.childNodes).forEach(node => {
          contentParagraphs.push(...htmlToParagraphs(node))
        })
        
        // If no paragraphs, create one from text
        if (contentParagraphs.length === 0) {
          contentParagraphs.push(new Paragraph({ 
            children: [new TextRun({ text: textContent, color: "000000" })],
            spacing: { after: 200 } 
          }))
        }

        // Create document
        const docName = currentDocument?.name || 'Untitled'
        const reviewerName = user?.full_name || user?.email || 'Anonymous'
        const reportDate = new Date().toLocaleDateString()

        const doc = new Document({
          sections: [{
            properties: {},
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Referee Report', color: "000000" })],
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 400 }
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Document: ', bold: true, color: "000000" }),
                  new TextRun({ text: docName, color: "000000" })
                ],
                spacing: { after: 200 }
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Date: ', bold: true, color: "000000" }),
                  new TextRun({ text: reportDate, color: "000000" })
                ],
                spacing: { after: 200 }
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Reviewer: ', bold: true, color: "000000" }),
                  new TextRun({ text: reviewerName, color: "000000" })
                ],
                spacing: { after: 400 }
              }),
              new Paragraph({
                children: [new TextRun({ text: '─────────────────────────────────────────', color: "000000" })],
                spacing: { after: 400 }
              }),
              ...contentParagraphs
            ]
          }],
          styles: {
            default: {
              document: {
                run: {
                  font: reviewFontFamily,
                  size: reviewFontSize * 2, // docx uses half-points
                  color: "000000", // Default black color
                },
              },
            },
          },
        })

        console.log('Generating DOCX with docx package:', {
          contentLength: rawContent.length,
          paragraphsCount: contentParagraphs.length
        })

        // Generate blob using Packer
        const blob = await Packer.toBlob(doc)
        
        if (!blob || blob.size === 0) {
            throw new Error('Generated DOCX blob is empty')
        }

        console.log('DOCX blob generated:', { 
            size: blob.size, 
            type: blob.type,
            sizeKB: (blob.size / 1024).toFixed(2) + ' KB'
        })
        
        const fileName = `Referee_Report_${(currentDocument?.name || 'draft').replace(/[^a-z0-9]/gi, '_')}.docx`
        saveAs(blob, fileName)
        
        console.log('DOCX file download initiated:', fileName)
        
    } catch (error) {
        console.error('DOCX generation failed:', error)
        console.error('Error details:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        })
        alert(`Failed to generate DOCX file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Load review from database on mount
  useEffect(() => {
    if (currentDocument?.id && user?.id) {
      peerReviewService.loadReview(currentDocument.id, user.id).then((review) => {
        if (review && editor) {
          setReviewContent(review.review_content)
          setReviewFontFamily(review.font_family)
          setReviewFontSize(review.font_size)
          // Always default to light theme, even if saved review has dark
          // User can manually change it if they prefer dark
          setReviewTheme('light')
          editor.commands.setContent(review.review_content)
        } else {
          // No review found - ensure default is light
          setReviewTheme('light')
        }
      }).catch((error) => {
        console.error('Failed to load review:', error)
        // On error, ensure default is light
        setReviewTheme('light')
      })
    } else {
      // No document or user - ensure default is light
      setReviewTheme('light')
    }
  }, [currentDocument?.id, user?.id, editor, setReviewTheme])

  // Auto-save review to database
  useEffect(() => {
    if (!currentDocument?.id || !user?.id || !reviewContent) return

    const saveTimeout = setTimeout(async () => {
      setIsSaving(true)
      try {
        await peerReviewService.saveReview(
          currentDocument.id,
          user.id,
          {
            review_content: reviewContent,
            citations: reviewCitations,
            font_family: reviewFontFamily,
            font_size: reviewFontSize,
            theme: reviewTheme,
            status: 'draft',
          }
        )
      } catch (error) {
        console.error('Failed to auto-save review:', error)
      } finally {
        setIsSaving(false)
      }
    }, 2000) // Debounce: save 2 seconds after last change

    return () => clearTimeout(saveTimeout)
  }, [reviewContent, reviewCitations, reviewFontFamily, reviewFontSize, reviewTheme, currentDocument?.id, user?.id])

  // Sync content if store changes externally (optional safety)
  useEffect(() => {
    if (editor && reviewContent !== editor.getHTML()) {
      // Only set content if it's drastically different (e.g. load/reset)
      // to avoid cursor jumping issues during active typing
       if (editor.isEmpty && reviewContent) {
           editor.commands.setContent(reviewContent)
       }
    }
  }, [reviewContent, editor])

  if (!editor) {
    return null
  }

  return (
    <div 
      id="onboarding-review-panel"
      data-onboarding="onboarding-review-panel"
      className="flex flex-col h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] text-[var(--color-text-primary)]">
      {/* Toolbar */}
      <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface)] sticky top-0 z-10">
        <h2 className="font-semibold text-lg">Reviewer Editor</h2>
        <div className="flex items-center gap-4">
          {/* AI-Referee Button - Separated */}
          <button
            id="onboarding-ai-auto-review"
            data-onboarding="onboarding-ai-auto-review"
            onClick={handleAutoReview}
            disabled={isAutoReviewing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isAutoReviewing 
                ? 'opacity-50 cursor-not-allowed' 
                : 'text-[var(--color-primary)] hover:scale-105'
            }`}
            style={{
              boxShadow: isAutoReviewing 
                ? 'none' 
                : '0 0 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2)',
              textShadow: isAutoReviewing 
                ? 'none' 
                : '0 0 8px rgba(59, 130, 246, 0.6)'
            }}
            title="Generate Auto Review (AI)"
          >
            {isAutoReviewing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            <span className="text-sm font-semibold">AI-Referee</span>
          </button>

          {/* Hamburger Menu */}
          <div className="relative" data-menu-container>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              title="Menu"
              aria-label="Toggle menu"
              aria-expanded={showMenu}
            >
              {showMenu ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl z-50 overflow-hidden">
                {/* Text Formatting Section */}
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Text Formatting
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        editor.chain().focus().toggleBold().run()
                        setShowMenu(false)
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        editor.isActive('bold')
                          ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                          : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
                      }`}
                    >
                      <Bold size={18} />
                      <span>Bold</span>
                      {editor.isActive('bold') && (
                        <span className="ml-auto text-xs text-[var(--color-text-tertiary)]">Active</span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        editor.chain().focus().toggleItalic().run()
                        setShowMenu(false)
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        editor.isActive('italic')
                          ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                          : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
                      }`}
                    >
                      <Italic size={18} />
                      <span>Italic</span>
                      {editor.isActive('italic') && (
                        <span className="ml-auto text-xs text-[var(--color-text-tertiary)]">Active</span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="h-px bg-[var(--color-border)]" />

                {/* Lists Section */}
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Lists
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        editor.chain().focus().toggleBulletList().run()
                        setShowMenu(false)
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        editor.isActive('bulletList')
                          ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                          : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
                      }`}
                    >
                      <List size={18} />
                      <span>Bullet List</span>
                      {editor.isActive('bulletList') && (
                        <span className="ml-auto text-xs text-[var(--color-text-tertiary)]">Active</span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        editor.chain().focus().toggleOrderedList().run()
                        setShowMenu(false)
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        editor.isActive('orderedList')
                          ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                          : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
                      }`}
                    >
                      <ListOrdered size={18} />
                      <span>Numbered List</span>
                      {editor.isActive('orderedList') && (
                        <span className="ml-auto text-xs text-[var(--color-text-tertiary)]">Active</span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="h-px bg-[var(--color-border)]" />

                {/* Font Settings Section */}
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Font Settings
                  </div>
                  <div className="space-y-3 px-3 py-2">
                    <div>
                      <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">
                        Font Family
                      </label>
                      <select
                        value={reviewFontFamily}
                        onChange={(e) => {
                          setReviewFontFamily(e.target.value)
                        }}
                        className="w-full px-2 py-1.5 text-sm rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      >
                        {FONT_FAMILIES.map((font) => (
                          <option key={font} value={font} style={{ fontFamily: font }}>
                            {font}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">
                        Font Size
                      </label>
                      <select
                        value={reviewFontSize}
                        onChange={(e) => {
                          setReviewFontSize(Number(e.target.value))
                        }}
                        className="w-full px-2 py-1.5 text-sm rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      >
                        {FONT_SIZES.map((size) => (
                          <option key={size} value={size}>
                            {size}pt
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-[var(--color-border)]" />

                {/* Templates Section */}
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Templates
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setShowTemplates(!showTemplates)
                        if (!showTemplates) {
                          setShowMenu(false)
                        }
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      <LayoutTemplate size={18} />
                      <span>Insert Template</span>
                    </button>
                  </div>
                </div>

                <div className="h-px bg-[var(--color-border)]" />

                {/* Theme Section */}
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Appearance
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setReviewTheme(reviewTheme === 'dark' ? 'light' : 'dark')
                        setShowMenu(false)
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      {reviewTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                      <span>Switch to {reviewTheme === 'dark' ? 'Light' : 'Dark'} Mode</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Templates Dropdown (separate from menu) */}
            {showTemplates && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl z-50 overflow-hidden">
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Review Templates
                  </div>
                  <div className="space-y-1">
                    {Object.entries(TEMPLATES).map(([key, template]) => (
                      <button
                        key={key}
                        onClick={() => {
                          if (editor) {
                            if (!editor.isEmpty && !window.confirm('This will replace current content. Continue?')) {
                              return
                            }
                            editor.commands.setContent(template.content)
                            setReviewContent(template.content)
                            setShowTemplates(false)
                            setShowMenu(false)
                          }
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] rounded-md transition-colors"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Editor */}
        <div className="mb-8">
            <div 
              id="onboarding-review-editor"
              data-onboarding="onboarding-review-editor"
              className={`min-h-[300px] max-h-[600px] p-4 rounded-lg border border-[var(--color-border)] transition-colors duration-200 overflow-y-auto ${
                reviewTheme === 'dark' 
                  ? 'bg-[var(--color-background)] text-[var(--color-text-primary)]' 
                  : 'bg-white text-gray-900'
              }`}
              style={{ fontFamily: reviewFontFamily, fontSize: `${reviewFontSize}pt` }}
            >
                <EditorContent editor={editor} />
            </div>
        </div>

        {/* Citations List */}
        {reviewCitations.length > 0 && (
          <div className="my-8 pt-6 border-t border-[var(--color-border)]">
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">Included Citations</h4>
            <div className="space-y-4">
                {reviewCitations.map((citation, index) => (
                    <div key={index} className="group relative pl-4 border-l-2 border-[var(--color-primary)] bg-[var(--color-surface-hover)]/30 p-3 rounded-r-lg">
                        <p className="text-sm italic text-[var(--color-text-secondary)]">
                            {citation}
                        </p>
                        <button 
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--color-surface-hover)] rounded text-xs text-[var(--color-text-tertiary)]"
                            onClick={() => {
                                editor.chain().focus().insertContent(`\n> ${citation}\n`).run()
                            }}
                        >
                            Insert into text
                        </button>
                    </div>
                ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-background-secondary)]">
        <div className="flex justify-between items-center">
          <span className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isSaving ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
            {isSaving ? 'Saving...' : 'Auto-saved'}
          </span>
          <button 
            id="onboarding-download-review"
            data-onboarding="onboarding-download-review"
            onClick={handleDownloadReview}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded hover:bg-[var(--color-primary-hover)] font-medium shadow-lg shadow-[var(--color-primary)]/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
          >
            <Download size={16} />
                    Download Review
          </button>
        </div>
      </div>
    </div>
  )
}
