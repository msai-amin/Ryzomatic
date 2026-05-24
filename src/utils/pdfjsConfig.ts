/**
 * PDF.js configuration
 * Centralized configuration for PDF.js worker to ensure consistency
 */

/**
 * Get PDF.js worker source URL
 * Always uses the local worker file (public/pdf.worker.min.js) to avoid
 * CDN failures due to network restrictions or Content Security Policy blocks.
 * The file is served from the root in both dev (Vite dev server) and production (Vercel).
 */
export function getPDFWorkerSrc(): string {
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

