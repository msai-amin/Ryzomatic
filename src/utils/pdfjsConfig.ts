/**
 * PDF.js configuration
 * Centralized configuration for PDF.js worker to ensure consistency
 */

/**
 * Get PDF.js worker source URL
 * Uses local worker file for both dev and production
 * The worker file is copied from node_modules during setup
 */
export function getPDFWorkerSrc(): string {
  // Use local worker file - it's copied from node_modules/pdfjs-dist/build/pdf.worker.min.js
  // This ensures version match and avoids CDN/CORS issues
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

