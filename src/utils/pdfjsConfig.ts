/**
 * PDF.js configuration
 * Centralized configuration for PDF.js worker to ensure consistency
 */

/**
 * Get PDF.js worker source URL
 * Uses CDN worker for production to avoid deployment issues
 */
export function getPDFWorkerSrc(): string {
  // Use CDN for production to ensure correct version
  if (import.meta.env.PROD) {
    return 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.296/pdf.worker.min.mjs';
  }
  
  // Use local worker for development
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

