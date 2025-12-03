#!/usr/bin/env node

/**
 * Script to clear user-uploaded files from S3 storage
 * 
 * This script should be run BEFORE the migration 064_clear_all_user_data.sql
 * because once the database records are deleted, we won't have the s3_key values.
 * 
 * Usage:
 *   node scripts/clear-user-data-s3.js
 * 
 * Environment variables required:
 *   - AWS_ACCESS_KEY_ID
 *   - AWS_SECRET_ACCESS_KEY
 *   - AWS_REGION (defaults to us-east-1)
 *   - AWS_S3_BUCKET (defaults to smart-reader-documents)
 *   - VITE_SUPABASE_URL or SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'smart-reader-documents';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Initialize S3 client
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// Supabase client will be initialized in main() with proper URL

/**
 * Get all S3 keys from database
 */
async function getS3KeysFromDatabase(supabase) {
  console.log('📊 Fetching S3 keys from database...');
  
  const { data: books, error } = await supabase
    .from('user_books')
    .select('id, s3_key, file_name')
    .not('s3_key', 'is', null);

  if (error) {
    console.error('❌ Error fetching books:', error);
    throw error;
  }

  console.log(`✅ Found ${books?.length || 0} books with S3 keys`);
  return books || [];
}

/**
 * Delete files from S3 by key
 */
async function deleteS3Files(keys) {
  if (keys.length === 0) {
    console.log('ℹ️  No files to delete from S3');
    return;
  }

  console.log(`🗑️  Deleting ${keys.length} files from S3...`);

  // S3 DeleteObjects can handle up to 1000 objects per request
  const batchSize = 1000;
  let deletedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    
    const objectsToDelete = batch.map(key => ({ Key: key }));
    
    try {
      const command = new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: objectsToDelete,
          Quiet: false,
        },
      });

      const response = await s3Client.send(command);
      
      if (response.Deleted) {
        deletedCount += response.Deleted.length;
        console.log(`  ✅ Deleted batch ${Math.floor(i / batchSize) + 1}: ${response.Deleted.length} files`);
      }

      if (response.Errors && response.Errors.length > 0) {
        errorCount += response.Errors.length;
        console.error(`  ⚠️  Errors in batch ${Math.floor(i / batchSize) + 1}:`, response.Errors);
      }
    } catch (error) {
      console.error(`  ❌ Error deleting batch ${Math.floor(i / batchSize) + 1}:`, error);
      errorCount += batch.length;
    }
  }

  console.log(`\n📈 Summary:`);
  console.log(`   ✅ Successfully deleted: ${deletedCount} files`);
  if (errorCount > 0) {
    console.log(`   ❌ Errors: ${errorCount} files`);
  }
}

/**
 * Alternative: Delete all files in books/ and documents/ prefixes
 * Use this if you want to clear everything regardless of database state
 */
async function deleteAllS3FilesByPrefix() {
  console.log('🗑️  Deleting all files from S3 with books/ and documents/ prefixes...');

  const prefixes = ['books/', 'documents/'];
  let totalDeleted = 0;

  for (const prefix of prefixes) {
    console.log(`\n📁 Processing prefix: ${prefix}`);
    let continuationToken = undefined;
    let batchCount = 0;

    do {
      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        });

        const listResponse = await s3Client.send(listCommand);
        
        if (!listResponse.Contents || listResponse.Contents.length === 0) {
          console.log(`  ℹ️  No files found in ${prefix}`);
          break;
        }

        const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key }));
        
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: {
            Objects: objectsToDelete,
            Quiet: false,
          },
        });

        const deleteResponse = await s3Client.send(deleteCommand);
        batchCount++;
        
        if (deleteResponse.Deleted) {
          totalDeleted += deleteResponse.Deleted.length;
          console.log(`  ✅ Batch ${batchCount}: Deleted ${deleteResponse.Deleted.length} files`);
        }

        if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
          console.error(`  ⚠️  Errors in batch ${batchCount}:`, deleteResponse.Errors);
        }

        continuationToken = listResponse.NextContinuationToken;
      } catch (error) {
        console.error(`  ❌ Error processing ${prefix}:`, error);
        break;
      }
    } while (continuationToken);

    console.log(`  ✅ Completed ${prefix}: ${totalDeleted} files deleted`);
  }

  console.log(`\n📈 Total files deleted: ${totalDeleted}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🧹 Starting S3 cleanup...\n');

  // Check for required environment variables
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('❌ Error: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required');
    process.exit(1);
  }

  // Try both VITE_SUPABASE_URL and SUPABASE_URL
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  // Update supabase client with correct URL
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const mode = process.argv[2] || 'database';

  try {
    if (mode === 'all' || mode === 'prefix') {
      // Delete all files by prefix (more aggressive, doesn't need database)
      await deleteAllS3FilesByPrefix();
    } else {
      // Delete files based on database records (safer, only deletes what's in DB)
      const books = await getS3KeysFromDatabase(supabase);
      const s3Keys = books
        .map(book => book.s3_key)
        .filter(key => key && key.trim() !== '');

      if (s3Keys.length > 0) {
        await deleteS3Files(s3Keys);
      } else {
        console.log('ℹ️  No S3 keys found in database');
      }
    }

    console.log('\n✅ S3 cleanup completed!');
    console.log('💡 Next step: Run migration 064_clear_all_user_data.sql to clear database records');
  } catch (error) {
    console.error('\n❌ Error during S3 cleanup:', error);
    process.exit(1);
  }
}

// Run if executed directly
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
