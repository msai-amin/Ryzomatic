import { Document } from '../../store/appStore'
import { DocumentRelationshipWithDetails } from '../../../lib/supabase'

/**
 * Mock document for onboarding demonstration
 * Provides sample content and related documents so users can experience features
 * without uploading their own documents
 */
export const createMockDocument = (): Document => {
  // Create a minimal valid PDF as a blob
  // This PDF will display a simple page with text
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
70 700 Td
(Onboarding Demo Document) Tj
ET
endstream
endobj
5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000123 00000 n 
0000000208 00000 n 
0000000373 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
458
%%EOF`
  
  const pdfBlob = new Blob([pdfContent], { type: 'application/pdf' })
  
  // Create page texts for TTS
  const pageTexts = [
    'Onboarding Demo Document. This is a sample document used to demonstrate Ryzomatic features during the onboarding tour.',
    'Page 2: Additional content for demonstration purposes.',
    'Page 3: More sample content to show multi-page document handling.'
  ]

  return {
    id: 'mock-document-onboarding',
    name: 'Onboarding Demo Document',
    content: 'Mock document content for onboarding demonstration',
    type: 'pdf' as const,
    uploadedAt: new Date(),
    pdfData: pdfBlob, // Use PDF blob to render in PDF viewer (no markdown background)
    totalPages: 3,
    pageTexts: pageTexts,
    cleanedPageTexts: pageTexts,
    currentPage: 1,
    highlights: [],
    highlightsLoaded: false,
    ocrStatus: 'not_needed' as const,
  }
}

/**
 * Mock related documents for demonstration
 */
export const createMockRelatedDocuments = (): DocumentRelationshipWithDetails[] => {
  return [
    {
      relationship_id: 'mock-rel-1',
      related_document_id: 'mock-related-1',
      related_title: 'Deep Learning Foundations: A Comprehensive Survey',
      related_file_name: 'deep-learning-foundations.pdf',
      related_file_type: 'pdf',
      relationship_description: 'This paper builds upon foundational work in neural network architectures',
      relevance_percentage: 87,
      relevance_calculation_status: 'completed',
      created_at: new Date().toISOString(),
    },
    {
      relationship_id: 'mock-rel-2',
      related_document_id: 'mock-related-2',
      related_title: 'AI-Assisted Research Tools: A Comparative Study',
      related_file_name: 'ai-research-tools.pdf',
      related_file_type: 'pdf',
      relationship_description: 'Similar methodology applied to different research domain',
      relevance_percentage: 72,
      relevance_calculation_status: 'completed',
      created_at: new Date().toISOString(),
    },
    {
      relationship_id: 'mock-rel-3',
      related_document_id: 'mock-related-3',
      related_title: 'Experimental Validation of AI Research Workflows',
      related_file_name: 'experimental-validation.pdf',
      related_file_type: 'pdf',
      relationship_description: 'Extends the findings with additional experimental validation',
      relevance_percentage: 91,
      relevance_calculation_status: 'completed',
      created_at: new Date().toISOString(),
    },
  ]
}

