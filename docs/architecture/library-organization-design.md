# Library Organization Enhancements – Design Notes

## Goals
- Make collections/tag management in `ModernLibraryModal` fast and discoverable.
- Support drag-and-drop ordering, inline edits, and richer bulk actions without leaving the modal.
- Rely on existing Supabase tables (`user_collections`, `book_tags`, `book_collections`, `book_tag_assignments`) and extend service helpers where gaps exist.

## Collections
- **Inline rename**: Edit directly in the tree; persist via `libraryOrganizationService.updateCollection`.
- **Color & icon picker**: Small popover in the context menu; update `color`/`icon` values.
- **Drag & drop order**: Use `@dnd-kit` to reorder siblings and move nodes between parents. Persist:
  - `libraryOrganizationService.reorderCollections(parentId, orderedIds)` (new helper).
  - Existing `moveCollection` handles parent changes.
- **Quick actions**:
  - “Add to collection” action in bulk toolbar opens picker populated from tree.
  - Context menu includes favorite toggle and delete confirmation.

## Tags
- **Inline rename & color**: Surfaced in `TagList`; call `libraryOrganizationService.updateTag`.
- **Bulk assign/remove**:
  - Add “Add tags”, “Remove tags” bulk actions leveraging new `libraryOrganizationService.batchAddTags`/`batchRemoveTags`.
  - Provide multi-select tag picker with typeahead.
- **Tag management panel**:
  - Scrollable list with usage counts, edit/delete buttons, filter by category (future-ready).

## Modal UX
- **Layout**: Left rail (collections), center (documents), right rail (details/recent). Collections rail gains drag handles and “+ New Collection” button.
- **Feedback**: Toasts for rename/move/delete success or failure via existing `logger` + new `useToast`.
- **Loading states**: Skeleton rows for collections/tags while fetching.

## State & Services
- Extend `useAppStore`:
  - Track `collectionDragState`, `tagManagerOpen`, `pendingAssignmentTargets`.
  - Methods for opening tag modal, updating optimistic state after service calls.
- `libraryOrganizationService` additions:
  - `reorderCollections(parentId: string | null, orderedIds: string[]): Promise<void>`
  - `batchRemoveTags(bookIds: string[], tagIds: string[]): Promise<void>`
  - Ensure existing batch helpers guard against unauthenticated access.
- `librarySearchService` unaffected; refresh triggered after mutations via `refreshLibrary`.

## Testing
- Unit tests for new service methods (Vitest).
- Component tests for `CollectionTree` drag-drop and inline rename.
- Manual QA checklist:
  - Create, rename, recolor, reorder collections (nested + root).
  - Assign/remove tags in bulk; verify counts update.
  - Bulk add/remove collections from selected books.
  - Ensure Supabase rejects unauthorized requests (test logged-out state).


