# Supabase Database Migration Guide

## Overview
This guide will help you apply the new database schema to your Supabase project to support user books and TTS metadata storage.

## Prerequisites
- Supabase project set up
- Supabase CLI installed (`npm install -g supabase`)
- Access to your Supabase project

## Migration Steps

### 1. Apply the Database Migration

Run the following command in your project root to apply the new migration:

```bash
supabase db push
```

Or if you prefer to run the migration manually, execute the SQL in `supabase/migrations/003_add_user_books_table.sql` in your Supabase SQL editor.

### 2. Verify the Migration

After applying the migration, verify that the following tables were created:

- `user_books` - Main table for storing user's books
- `user_notes` - Table for user annotations and notes
- `user_audio` - Table for TTS-generated audio files

You can check this in your Supabase dashboard under the "Table Editor" section.

### 3. Test Row Level Security (RLS)

The migration includes RLS policies. Test that users can only access their own data:

1. Go to Authentication > Users in your Supabase dashboard
2. Create a test user or use an existing one
3. Verify that the user can only see their own books, notes, and audio

### 4. Update Environment Variables

Make sure your environment variables are set correctly:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Test the New Storage Service

The new `supabaseStorageService` is ready to use. To switch from localStorage to Supabase:

1. Update your app to use `supabaseStorageService` instead of `storageService`
2. Initialize the service with the current user ID
3. Test book upload, storage, and retrieval

## Database Schema Details

### user_books Table
- Stores user's uploaded books (PDF and text files)
- Includes `page_texts` array for TTS functionality
- Tracks reading progress and last read page
- Stores PDF data as base64 for persistence

### user_notes Table
- Stores user annotations and notes
- Links to specific book and page
- Supports positioning for UI placement

### user_audio Table
- Stores TTS-generated audio files
- Links to specific book and page
- Includes voice settings for regeneration

## Key Features

### Reading Progress Tracking
- Automatic calculation of reading progress percentage
- Last read page tracking
- Reading statistics via `get_user_reading_stats()` function

### Data Security
- Row Level Security (RLS) ensures users only access their own data
- All operations require authentication
- Proper foreign key constraints

### Performance
- Optimized indexes for common queries
- Efficient base64 storage for binary data
- Pagination support for large datasets

## Troubleshooting

### Migration Fails
- Check that you have the necessary permissions
- Ensure all previous migrations have been applied
- Verify your Supabase connection

### RLS Issues
- Check that RLS is enabled on all tables
- Verify that policies are correctly applied
- Test with different user accounts

### Data Conversion Issues
- Ensure ArrayBuffer to base64 conversion is working correctly
- Check that PDF data is being stored and retrieved properly
- Verify pageTexts are being preserved

## Next Steps

1. Apply the migration to your Supabase project
2. Test the new storage service with sample data
3. Update your application to use Supabase storage
4. Monitor performance and adjust as needed

## Support

If you encounter any issues:
1. Check the Supabase logs in your dashboard
2. Verify your RLS policies are working correctly
3. Test with a fresh user account
4. Check the browser console for any errors

The new schema provides a robust foundation for storing user books and TTS metadata in a production environment.
