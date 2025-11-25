import React, { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Quote, LayoutTemplate, Sun, Moon, Sparkles, Loader2, Download, Type } from 'lucide-react'
import { autoReviewService } from '../../services/ai/autoReviewService'
import { peerReviewService } from '../../services/peerReviewService'
import { useAppStore } from '../../store/appStore'
import { asBlob } from 'html-docx-js-typescript'
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
        
        // Convert TipTap HTML to simpler, more compatible HTML structure
        // The html-docx-js-typescript library has issues with complex HTML, so we simplify it
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = rawContent
        
        // Function to convert HTML nodes to simpler HTML
        const simplifyHTML = (node: Node): string => {
            if (node.nodeType === Node.TEXT_NODE) {
                return (node.textContent || '').replace(/\s+/g, ' ').trim()
            }
            
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as Element
                const tagName = el.tagName.toLowerCase()
                
                // Process children
                const children = Array.from(el.childNodes)
                    .map(simplifyHTML)
                    .filter(text => text.length > 0)
                    .join('')
                
                if (!children) return ''
                
                // Convert to simpler tags
                switch (tagName) {
                    case 'h1':
                    case 'h2':
                    case 'h3':
                    case 'h4':
                    case 'h5':
                    case 'h6':
                        return `<${tagName}>${children}</${tagName}>`
                    case 'p':
                        return `<p>${children}</p>`
                    case 'strong':
                    case 'b':
                        return `<strong>${children}</strong>`
                    case 'em':
                    case 'i':
                        return `<em>${children}</em>`
                    case 'u':
                        return `<u>${children}</u>`
                    case 'ul':
                        return `<ul>${children}</ul>`
                    case 'ol':
                        return `<ol>${children}</ol>`
                    case 'li':
                        return `<li>${children}</li>`
                    case 'br':
                        return '<br/>'
                    case 'blockquote':
                        return `<p style="margin-left: 20px; font-style: italic;">${children}</p>`
                    case 'div':
                        return children // Flatten divs
                    default:
                        return children // Return children for unknown tags
                }
            }
            
            return ''
        }
        
        // Convert to simplified HTML
        const simplifiedContent = Array.from(tempDiv.childNodes)
            .map(simplifyHTML)
            .filter(html => html.length > 0)
            .join('')
        
        // Escape HTML in metadata to prevent injection
        const docName = (currentDocument?.name || 'Untitled').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const reviewerName = (user?.full_name || user?.email || 'Anonymous').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const reportDate = new Date().toLocaleDateString()
        
        // Build simple, clean HTML string that the library can handle
        const htmlString = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Referee Report</title>
</head>
<body style="font-family: '${reviewFontFamily}', serif; font-size: ${reviewFontSize}pt; line-height: 1.5; margin: 40px;">
    <h2 style="font-size: ${reviewFontSize + 4}pt; font-weight: bold; margin-top: 0; margin-bottom: 20px;">Referee Report</h2>
    <p style="margin-bottom: 1em;"><strong>Document:</strong> ${docName}</p>
    <p style="margin-bottom: 1em;"><strong>Date:</strong> ${reportDate}</p>
    <p style="margin-bottom: 1em;"><strong>Reviewer:</strong> ${reviewerName}</p>
    <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;"/>
    <div style="margin-top: 20px;">
    ${simplifiedContent || rawContent}
    </div>
</body>
</html>`

        // Log the full HTML to help debug
        console.log('Generating DOCX from HTML:', {
            cleanContentLength: cleanContent.length,
            cleanContentPreview: cleanContent.substring(0, 200),
            cleanContentFull: cleanContent, // Log full content for debugging
            hasContent: hasContent,
            htmlLength: htmlString.length,
            htmlPreview: htmlString.substring(0, 500),
            htmlFull: htmlString // Log full HTML for debugging
        })

        // Generate DOCX blob - the library expects a complete HTML document
        const blob = await asBlob(htmlString)
        
        console.log('asBlob result:', {
            blob: blob,
            blobType: typeof blob,
            blobSize: blob instanceof Blob ? blob.size : 'not a blob',
            blobTypeProperty: blob instanceof Blob ? blob.type : 'N/A'
        })
        
        if (!blob) {
            throw new Error('asBlob returned null or undefined')
        }
        
        // Handle both Blob and Buffer (library can return either)
        let finalBlob: Blob
        if (blob instanceof Blob) {
            finalBlob = blob
        } else if (blob && typeof blob === 'object' && 'buffer' in blob) {
            // It's a Buffer (Node.js), convert to Blob
            finalBlob = new Blob([blob as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
        } else {
            // Try to create a Blob from whatever we got
            finalBlob = new Blob([blob as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
        }
        
        if (!finalBlob || finalBlob.size === 0) {
            throw new Error(`Generated DOCX blob is empty (size: ${finalBlob?.size || 0})`)
        }

        console.log('Final DOCX blob:', { 
            size: finalBlob.size, 
            type: finalBlob.type,
            sizeKB: (finalBlob.size / 1024).toFixed(2) + ' KB'
        })
        
        const fileName = `Referee_Report_${(currentDocument?.name || 'draft').replace(/[^a-z0-9]/gi, '_')}.docx`
        saveAs(finalBlob, fileName)
        
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
          setReviewTheme(review.theme)
          editor.commands.setContent(review.review_content)
        }
      }).catch((error) => {
        console.error('Failed to load review:', error)
      })
    }
  }, [currentDocument?.id, user?.id, editor])

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
    <div className="flex flex-col h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] text-[var(--color-text-primary)]">
      {/* Toolbar */}
      <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface)] sticky top-0 z-10">
        <h2 className="font-semibold text-lg">Review Editor</h2>
        <div className="flex gap-1 bg-[var(--color-surface-hover)] p-1 rounded-lg">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-[var(--color-background)] transition-colors ${editor.isActive('bold') ? 'text-[var(--color-primary)] bg-[var(--color-background)]' : 'text-[var(--color-text-secondary)]'}`}
            title="Bold"
          >
            <Bold size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-[var(--color-background)] transition-colors ${editor.isActive('italic') ? 'text-[var(--color-primary)] bg-[var(--color-background)]' : 'text-[var(--color-text-secondary)]'}`}
            title="Italic"
          >
            <Italic size={16} />
          </button>
          <div className="w-px bg-[var(--color-border)] mx-1 my-1" />
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded hover:bg-[var(--color-background)] transition-colors ${editor.isActive('bulletList') ? 'text-[var(--color-primary)] bg-[var(--color-background)]' : 'text-[var(--color-text-secondary)]'}`}
            title="Bullet List"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded hover:bg-[var(--color-background)] transition-colors ${editor.isActive('orderedList') ? 'text-[var(--color-primary)] bg-[var(--color-background)]' : 'text-[var(--color-text-secondary)]'}`}
            title="Ordered List"
          >
            <ListOrdered size={16} />
          </button>
          <div className="w-px bg-[var(--color-border)] mx-1 my-1" />
          
          {/* Font Controls */}
          <div className="relative">
            <button
              onClick={() => setShowFontMenu(!showFontMenu)}
              className={`p-2 rounded hover:bg-[var(--color-background)] transition-colors text-[var(--color-text-secondary)]`}
              title="Font Settings"
            >
              <Type size={16} />
            </button>
            {showFontMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl z-50 p-3">
                <div className="mb-3">
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">Font Family</label>
                  <select
                    value={reviewFontFamily}
                    onChange={(e) => {
                      setReviewFontFamily(e.target.value)
                      setShowFontMenu(false)
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
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">Font Size</label>
                  <select
                    value={reviewFontSize}
                    onChange={(e) => {
                      setReviewFontSize(Number(e.target.value))
                      setShowFontMenu(false)
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
            )}
          </div>

          <div className="w-px bg-[var(--color-border)] mx-1 my-1" />
          
          {/* Theme Toggle */}
          <button
            onClick={() => setReviewTheme(reviewTheme === 'dark' ? 'light' : 'dark')}
            className={`p-2 rounded hover:bg-[var(--color-background)] transition-colors text-[var(--color-text-secondary)]`}
            title={`Switch to ${reviewTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {reviewTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div className="w-px bg-[var(--color-border)] mx-1 my-1" />
          
          {/* Auto Review Button */}
          <button
            onClick={handleAutoReview}
            disabled={isAutoReviewing}
            className={`p-2 rounded hover:bg-[var(--color-background)] transition-colors ${isAutoReviewing ? 'opacity-50 cursor-not-allowed' : 'text-[var(--color-primary)]'}`}
            title="Generate Auto Review (AI)"
          >
            {isAutoReviewing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          </button>

          <div className="w-px bg-[var(--color-border)] mx-1 my-1" />
          <div className="relative">
            <button
                onClick={() => setShowTemplates(!showTemplates)}
                className={`p-2 rounded hover:bg-[var(--color-background)] transition-colors ${showTemplates ? 'text-[var(--color-primary)] bg-[var(--color-background)]' : 'text-[var(--color-text-secondary)]'}`}
                title="Insert Template"
            >
                <LayoutTemplate size={16} />
            </button>
            {showTemplates && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl z-50 overflow-hidden">
                    {Object.entries(TEMPLATES).map(([key, template]) => (
                        <button
                            key={key}
                            onClick={() => {
                                if (editor) {
                                    // Ask for confirmation if there is content
                                    if (!editor.isEmpty && !window.confirm('This will replace current content. Continue?')) {
                                        return
                                    }
                                    editor.commands.setContent(template.content)
                                    setReviewContent(template.content)
                                    setShowTemplates(false)
                                }
                            }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]"
                        >
                            {template.label}
                        </button>
                    ))}
                </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Editor */}
        <div className="mb-8">
            <h3 className="text-[var(--color-text-primary)] mb-4 font-medium">Review and Comments</h3>
            <div 
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
