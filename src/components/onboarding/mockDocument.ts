import { Document } from '../../store/appStore'
import { DocumentRelationshipWithDetails } from '../../../lib/supabase'

/**
 * Mock document for onboarding demonstration
 * Provides sample content and related documents so users can experience features
 * without uploading their own documents
 */
export const createMockDocument = (): Document => {
  const sampleContent = `
# Machine Learning in Academic Research

## Abstract

This paper explores the application of machine learning techniques in academic research settings. 
We present a comprehensive analysis of how modern AI systems can enhance scholarly workflows, 
from literature review to peer review processes.

## Introduction

Academic research has undergone significant transformation with the advent of machine learning technologies. 
Researchers now have access to powerful tools that can assist with data analysis, literature synthesis, 
and knowledge discovery.

## Methodology

Our study employed a mixed-methods approach, combining quantitative analysis of publication patterns 
with qualitative interviews of researchers using AI-assisted tools. We analyzed over 10,000 research papers 
across multiple disciplines to identify common patterns and challenges.

## Results

The findings reveal that researchers who integrate AI tools into their workflow report:
- 40% reduction in time spent on literature review
- 60% improvement in citation accuracy
- 35% increase in cross-disciplinary connections discovered

## Discussion

These results suggest that AI-assisted research tools can significantly enhance academic productivity 
while maintaining research quality. However, careful consideration must be given to ethical implications 
and the need for human oversight in critical research decisions.

## Conclusion

Machine learning technologies offer promising opportunities for enhancing academic research workflows. 
Future work should focus on developing more sophisticated tools that can better understand research context 
and provide more nuanced assistance to researchers.
`.trim()

  // Create more realistic page content for better visualization
  const pageTexts = [
    `# Machine Learning in Academic Research

## Abstract

This paper explores the application of machine learning techniques in academic research settings. We present a comprehensive analysis of how modern AI systems can enhance scholarly workflows, from literature review to peer review processes.

## Introduction

Academic research has undergone significant transformation with the advent of machine learning technologies. Researchers now have access to powerful tools that can assist with data analysis, literature synthesis, and knowledge discovery.

Our study employed a mixed-methods approach, combining quantitative analysis of publication patterns with qualitative interviews of researchers using AI-assisted tools.`,
    `## Methodology

We analyzed over 10,000 research papers across multiple disciplines to identify common patterns and challenges. The methodology included:

1. Systematic literature review
2. Survey of active researchers
3. Case studies of AI tool adoption
4. Statistical analysis of publication trends

## Results

The findings reveal that researchers who integrate AI tools into their workflow report significant improvements in productivity and research quality.`,
    `Key metrics include:
- 40% reduction in time spent on literature review
- 60% improvement in citation accuracy
- 35% increase in cross-disciplinary connections discovered

## Discussion

These results suggest that AI-assisted research tools can significantly enhance academic productivity while maintaining research quality. However, careful consideration must be given to ethical implications and the need for human oversight in critical research decisions.`,
    `## Conclusion

Machine learning technologies offer promising opportunities for enhancing academic research workflows. Future work should focus on developing more sophisticated tools that can better understand research context and provide more nuanced assistance to researchers.

## References

1. Smith, J. (2023). AI in Academic Research. Journal of Digital Scholarship.
2. Doe, A. (2024). Machine Learning Applications. Conference on Academic Technology.`
  ].filter(text => text.length > 0)

  return {
    id: 'mock-document-onboarding',
    name: 'Machine Learning in Academic Research (Demo)',
    content: sampleContent,
    type: 'pdf' as const,
    uploadedAt: new Date(),
    totalPages: pageTexts.length,
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

