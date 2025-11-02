# Migration 026 Fix - Foreign Key Constraint Error

**Issue:** ERROR: 42703: column "document_id" referenced in foreign key constraint does not exist

**Root Cause:** The migration was trying to modify foreign key constraints after dropping the `documents` table, which caused constraint errors.

**Fix Applied:** Reordered the migration to:
1. Drop all foreign key constraints BEFORE dropping tables
2. Drop tables with CASCADE
3. Recreate foreign keys pointing to `user_books`

**Changes Made:**
- Step 3: Drop constraints from conversations, conversation_memories, memory_relationships, response_cache, document_embeddings
- Step 4: Drop tables (documents, document_embeddings, response_cache)
- Step 5: Recreate foreign keys referencing user_books

**Safe to Run:** ✅ Yes, the migration is now idempotent and safe to run.

