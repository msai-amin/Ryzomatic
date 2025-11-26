import { TourStep } from './SpotlightTour'

/**
 * Text-to-Speech Tour Steps
 * Guides users through the audio reading features
 */
export const TTS_TOUR_STEPS: TourStep[] = [
  {
    targetId: 'onboarding-audio-widget',
    title: 'Text-to-Speech Audio Widget',
    body: 'The audio widget provides comprehensive controls for listening to your documents. Use the tabs at the top to select reading mode: "Paragraph" for current paragraph, "Page" for the entire page, or "Continue" to read from your last position. The play button starts reading, and you can see the status indicator showing "Ready" when the system is prepared.',
    buttonLabel: 'Next',
    icon: '🔊',
    visualHint: 'audio',
    image: '/onboarding-images/02.tts-audio-widget-detail.png',
  },
  {
    targetId: 'onboarding-tts-play',
    title: 'Play & Pause Controls',
    body: 'Click the play button to start reading from your current position. The audio will highlight words as they\'re spoken, helping you follow along visually. Use the stop button to pause playback at any time.',
    buttonLabel: 'Next',
    icon: '▶️',
  },
  {
    targetId: 'onboarding-tts-speed',
    title: 'Adjust Reading Speed',
    body: 'Control how fast the text is read. Speed up for quick review or slow down for complex content. The speed range is from 0.75x to 2.0x. Adjust using the settings icon or speed controls.',
    buttonLabel: 'Next',
    icon: '⚡',
  },
  {
    targetId: 'onboarding-tts-voice',
    title: 'Voice Selection',
    body: 'Choose from multiple high-quality voices optimized for academic content. Each voice is trained to handle technical terminology and proper pronunciation. Access voice settings through the settings icon.',
    buttonLabel: 'Next',
    icon: '🎙️',
  },
  {
    targetId: 'onboarding-tts-modes',
    title: 'Reading Modes',
    body: 'Select how much to read using the tabs at the top: "Paragraph" for current paragraph, "Page" for the entire page, or "Continue" to read from your last position. Perfect for resuming long reading sessions.',
    buttonLabel: 'Continue to Related Documents',
    icon: '📖',
    image: '/onboarding-images/03-main-UI-after-upload.png',
  },
]

/**
 * Related Documents & Graphs Tour Steps
 * Guides users through document relationships and graph visualization
 */
export const RELATED_DOCS_TOUR_STEPS: TourStep[] = [
  {
    targetId: 'onboarding-related-docs-panel',
    title: 'Related Documents Panel',
    body: 'As you read, Ryzomatic automatically analyzes your library to find related documents. This panel shows papers that are semantically similar, cite each other, or cover related topics.',
    buttonLabel: 'Next',
    icon: '🔗',
    visualHint: 'document',
    image: '/onboarding-images/04-related-documents1.png',
  },
  {
    targetId: 'onboarding-related-doc-card',
    title: 'Related Document Cards',
    body: 'When a related document is found, it appears as a card showing the title and file type. The AI automatically builds relationships between your documents as you read. You\'ll see "AI is building the relationship..." while analysis is in progress.',
    buttonLabel: 'View Analysis',
    action: 'openRelevanceAnalysis',
    icon: '📋',
    image: '/onboarding-images/05-related-documents2.png',
  },
  {
    targetId: 'onboarding-relevance-analysis',
    title: 'Relevance Analysis',
    body: 'Click on any related document card to see a detailed relevance analysis. The analysis shows overall relevance percentage and breaks it down by keywords, topics, themes, and summary. Higher percentages indicate stronger connections between documents.',
    buttonLabel: 'View Graph',
    action: 'openGraph',
    icon: '📊',
    image: '/onboarding-images/06-related-documents3.png',
  },
  {
    targetId: 'onboarding-document-graph',
    title: 'Document Relationship Graph',
    body: 'Visualize how your documents connect in a graph view. Nodes represent documents, and edges show relationships. Edge thickness and color indicate relevance strength: green for high (≥80%), orange for medium (50-79%), and gray for low (<50%).',
    buttonLabel: 'Next',
    action: 'closeGraph',
    icon: '📊',
    visualHint: 'graph',
    image: '/onboarding-images/07-related-documents4.png',
  },
  {
    targetId: 'onboarding-graph-navigation',
    title: 'Graph Navigation',
    body: 'Click and drag nodes to rearrange the graph. Hover over edges to see relationship details. Click a node to open that document. Scroll to zoom in and out. The graph helps you build a mental map of your research field.',
    buttonLabel: 'Continue to Peer Review',
    icon: '🧭',
  },
]

/**
 * Peer Review Tour Steps
 * Guides users through the peer review features
 */
export const PEER_REVIEW_TOUR_STEPS: TourStep[] = [
  {
    targetId: 'onboarding-peer-review-setup',
    title: 'Get Started with Peer Review',
    body: 'To use Peer Review, you need a document open. Upload a document from the Library or as a new file. Once a document is loaded, the Peer Review button will appear in the header.',
    buttonLabel: 'Continue',
    action: 'waitForDocument',
    icon: '📄',
    image: '/onboarding-images/03-main-UI-after-upload.png',
  },
  {
    targetId: 'onboarding-peer-review-btn',
    title: 'Peer Review Mode',
    body: 'Click the "Peer Review" button in the header to enter editorial mode. This opens a split-view interface perfect for writing academic peer reviews while referencing the document.',
    buttonLabel: 'Open Peer Review',
    action: 'openPeerReview',
    icon: '📝',
  },
  {
    targetId: 'onboarding-editorial-layout',
    title: 'Split-View Layout',
    body: 'The document is on the left and your review editor is on the right. Scroll through the document while writing your review for easy reference. Perfect for detailed analysis.',
    buttonLabel: 'Next',
    icon: '👁️',
    visualHint: 'editor',
    image: '/onboarding-images/08.Peer-review-before-applying-AI-Referee.jpeg',
  },
  {
    targetId: 'onboarding-ai-auto-review',
    title: 'AI-Powered Auto Review',
    body: 'Click the sparkles icon to generate an AI-powered peer review automatically. The AI analyzes the document and creates a structured review with strengths, weaknesses, and recommendations.',
    buttonLabel: 'Next',
    icon: '✨',
    image: '/onboarding-images/09.peer-review-ai-referee.png',
  },
  {
    targetId: 'onboarding-review-editor',
    title: 'Rich Text Editor',
    body: 'Write your review with full formatting support. Use the toolbar for bold, italic, lists, quotes, and more. Your review auto-saves as you type, so you never lose your work.',
    buttonLabel: 'Next',
    icon: '✍️',
    visualHint: 'editor',
  },
  {
    targetId: 'onboarding-review-customization',
    title: 'Customize Your Review',
    body: 'Adjust font family, size, and theme (light/dark) to match your preferences. Changes apply instantly to your review. Choose settings that make you most productive.',
    buttonLabel: 'Next',
    icon: '⚙️',
  },
  {
    targetId: 'onboarding-download-review',
    title: 'Download Your Review',
    body: 'Export your review as a DOCX file with one click. Perfect for submitting to journals, sharing with colleagues, or archiving your peer review work.',
    buttonLabel: 'Complete Tour',
    action: 'finishTour',
    icon: '📥',
    image: '/onboarding-images/10. peer-review-final-step.png',
  },
]

/**
 * Welcome step (shown before tour selection)
 */
export const WELCOME_STEP: TourStep = {
  targetId: 'onboarding-welcome',
  title: 'Welcome to Ryzomatic',
  body: 'Your intelligent research companion. Let\'s explore the key features that make Ryzomatic powerful for academic research. Choose a tour to get started, or skip to explore on your own.',
  buttonLabel: 'Get Started',
  icon: '📚',
  image: '/onboarding-images/01-main-UI.png',
}

