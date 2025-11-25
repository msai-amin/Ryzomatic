import React, { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Quote, LayoutTemplate, Sun, Moon, Sparkles, Loader2, Download } from 'lucide-react'
import { autoReviewService } from '../../services/ai/autoReviewService'
import { useAppStore } from '../../store/appStore'
import { asBlob } from 'html-docx-js-typescript'
import { saveAs } from 'file-saver'

export const ReviewPanel: React.FC = () => {
  const { reviewCitations, reviewContent, setReviewContent, currentDocument, user } = useAppStore()
  const [showTemplates, setShowTemplates] = useState(false)
  const [editorTheme, setEditorTheme] = useState<'light' | 'dark'>('dark')
  const [isAutoReviewing, setIsAutoReviewing] = useState(false)

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
          editorTheme === 'dark' ? 'prose-invert' : ''
        }`,
      },
    },
  })

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
        // Generate review using Gemini
        const reviewHtml = await autoReviewService.generateAutoReview(currentDocument.id, user.id)
        
        editor?.commands.setContent(reviewHtml)
        setReviewContent(reviewHtml)
    } catch (error) {
        console.error('Auto-review failed:', error)
        alert('Failed to generate review. Please ensure the document has text content.')
    } finally {
        setIsAutoReviewing(false)
    }
  }

  // Download as DOCX
  const handleDownloadReview = async () => {
    if (!reviewContent) {
        alert('Review content is empty.')
        return
    }

    try {
        const htmlString = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Referee Report</title>
                <style>
                    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; }
                    h3 { font-size: 14pt; font-weight: bold; margin-top: 1em; margin-bottom: 0.5em; }
                    p { margin-bottom: 1em; }
                    ul, ol { margin-bottom: 1em; margin-left: 1.5em; }
                    li { margin-bottom: 0.5em; }
                </style>
            </head>
            <body>
                <h2>Referee Report</h2>
                <p><strong>Document:</strong> ${currentDocument?.name || 'Untitled'}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                <hr/>
                ${reviewContent}
            </body>
            </html>
        `

        // @ts-ignore: asBlob type definition mismatch
        const blob = await asBlob(htmlString)
        saveAs(blob as Blob, `Referee_Report_${currentDocument?.name || 'draft'}.docx`)
        
    } catch (error) {
        console.error('DOCX generation failed:', error)
        alert('Failed to generate DOCX file.')
    }
  }

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
          
          {/* Theme Toggle */}
          <button
            onClick={() => setEditorTheme(editorTheme === 'dark' ? 'light' : 'dark')}
            className={`p-2 rounded hover:bg-[var(--color-background)] transition-colors text-[var(--color-text-secondary)]`}
            title={`Switch to ${editorTheme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {editorTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
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
            <h3 className="text-[var(--color-text-primary)] mb-4 font-medium">General Comments</h3>
            <div 
              className={`min-h-[300px] p-4 rounded-lg border border-[var(--color-border)] transition-colors duration-200 ${
                editorTheme === 'dark' 
                  ? 'bg-[var(--color-background)] text-[var(--color-text-primary)]' 
                  : 'bg-white text-gray-900'
              }`}
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
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            Auto-saved just now
          </span>
          <button 
            onClick={handleDownloadReview}
            className="px-4 py-2 bg-[var(--color-primary)] text-white rounded hover:bg-[var(--color-primary-hover)] font-medium shadow-lg shadow-[var(--color-primary)]/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
          >
            <Download size={16} />
            Submit Review
          </button>
        </div>
      </div>
    </div>
  )
}
