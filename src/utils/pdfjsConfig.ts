/**
 * PDF.js configuration
 * Centralized configuration for PDF.js worker to ensure consistency
 */

/**
 * Get PDF.js worker source URL
 * Uses CDN for production to avoid deployment issues, local file for development
 */
export function getPDFWorkerSrc(): string {
  // Use CDN for production to ensure correct version and avoid file deployment issues
  if (import.meta.env.PROD) {
    // Use jsdelivr CDN - matches pdfjs-dist version in package.json
    // Use .js instead of .mjs to avoid import.meta issues in worker context
    return 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.394/build/pdf.worker.min.js';
  }
  
  // Use local worker file for development
  return '/pdf.worker.min.js';
}

/**
 * Configure PDF.js worker for a loaded PDF.js library
 */
export function configurePDFWorker(pdfjsLib: any): void {
  if (pdfjsLib && 'GlobalWorkerOptions' in pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = getPDFWorkerSrc();
  }
}

