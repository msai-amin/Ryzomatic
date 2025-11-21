# EPUB Support Deployment Notes

## Overview

This release introduces first-class EPUB ingestion and viewing across the platform:

- Client-side EPUB parsing with `extractEpub` orchestrator.
- Server-side text extraction during upload for search/RAG.
- Library support for the new `epub` file type in filters, cards, and modals.
- A dedicated `EPUBViewer` component with chapter navigation, typography controls, and AI context menu integration.

## Prerequisites

1. Install new runtime dependencies:

   ```bash
   npm install
   ```

   New packages:
   - `jszip`
   - `fast-xml-parser`

2. Apply the new Supabase migration after pulling code:

   ```bash
   supabase db push
   # or manually apply: supabase/migrations/048_add_epub_support.sql
   ```

## Smoke Tests

1. Run the new unit tests to validate the EPUB extraction pipeline:

   ```bash
   npm run test -- tests/epubExtractionOrchestrator.test.ts
   ```

2. Manual QA checklist:
   - Upload an EPUB and confirm chapter detection plus preview text.
   - Verify the EPUB viewer (chapter dropdown, prev/next navigation, AI context menu).
   - Confirm library filters (All/PDF/EPUB/Text) work and icons render correctly.
   - Ensure EPUB uploads appear in Supabase with `file_type = 'epub'`.

## Rollback Considerations

- Migration `048_add_epub_support.sql` only widens enum/check constraints; rollback requires restoring the previous constraint definitions.
- If necessary, revert the branch and apply a manual SQL script to drop `'epub'` from the `file_type` check constraints.

## Post-Deployment Monitoring

- Track Supabase `usage_records` for action type `document_upload` to confirm EPUB uploads are flowing.
- Monitor logs for `EPUB extraction failed` messages to catch malformed files early.

