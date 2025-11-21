# UI Navigation Refresh

## Overview
- Consolidated legacy hamburger, chip, and account bars into a two-tier header.
- Tier 1 now presents global actions: logo/home, library entry point, search, AI assistant, and primary upload CTA.
- Tier 2 focuses on the active document with a `< Library` back control, title, typography settings, and a contextual panel toggle.
- Left navigation is now a collapsible icon rail (collapsed by default) that remembers the user's choice across sessions.
- Introduced a unified user dropdown for account, settings, help, and sign-out actions.
- Right-side notes/highlights panel opens on demand, pushes the reader surface, and persists its open/tab state.
- Retired floating quick note / AI buttons—actions now live in the header or contextual panel.

## User Experience Improvements
- Reduced cognitive load by eliminating redundant logout/account entry points.
- Clarified navigation hierarchy; logo + library act as home, while document bar handles reading controls.
- Created obvious primary action (`+ New Material`) and tooltip-backed icon buttons for secondary tasks.
- Dynamic header height updates keep PDF/EPUB toolbars aligned without layout shifts.
- Collections/Tags management now uses dedicated modals (name, color, icon) with in-app confirmations for destructive actions and toast-based feedback for bulk operations.

## QA & Regression
- ESLint: `npm run lint`
- Unit tests: `npm run test`
- Manual smoke:
  - Toggle AI assistant, upload modal, typography settings.
  - Open/close library modal from logo and library link.
  - Collapse/expand the left navigation rail; refresh the page to confirm the preference persists.
  - Use the document header button and note context actions to open/close the right panel; ensure content resizes and last-opened tab persists.
  - Confirm header height adjusts between dashboard (no document) and active reader states.
  - In library modal: create/edit/delete collections and tags via the new modals; verify toast + confirm dialog flows for delete/move/favorite.
  - Exercise bulk toolbar (add to collection, tag assign/remove, favorite, archive, delete) and confirm toast messaging + confirm dialogs.

## Rollout Notes
- Apply Supabase migrations `049_fix_update_reading_progress.sql` & `050_library_sidebar_tx.sql` before enabling the new sidebar flows.
- Existing keyboard shortcuts and Pomodoro controls remain available.
- Preview deploys must include updated `VITE_SUPABASE_*` variables for auth to function.
