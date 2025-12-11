#!/usr/bin/env node

/**
 * Comprehensive Embedding Generation Script
 * Generates embeddings for existing notes, highlights, documents, and papers
 * 
 * Usage: 
 *   node scripts/generate-embeddings.js [command] [options]
 * 
 * Commands:
 *   notes       - Queue embeddings for all notes without embeddings
 *   highlights  - Queue embeddings for all highlights without embeddings
 *   documents   - Generate embeddings for documents without descriptions
 *   papers      - Pre-compute paper embeddings
 *   all         - Process all types (notes, highlights, documents)
 *   status      - Show embedding generation status
 *   process      - Manually process pending embedding jobs (runs background worker)
 */

// Load .env files synchronously
import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const envFiles = ['.env.local', '.env'];

for (const envFile of envFiles) {
  const envPath = join(projectRoot, envFile);
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
    break;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  process.exit(1);
}

if (!SUPABASE_URL) {
  console.error('❌ Error: SUPABASE_URL or VITE_SUPABASE_URL environment variable not set');
  process.exit(1);
}

// Import Supabase client
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Queue embeddings for all notes without embeddings
 */
async function queueNoteEmbeddings(limit = null) {
  console.log('\n📝 Queueing embeddings for notes without embeddings...\n');
  
  try {
    let query = supabase
      .from('user_notes')
      .select('id, user_id, content')
      .is('embedding', null)
      .not('content', 'is', null);
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data: notes, error } = await query;
    
    if (error) {
      throw error;
    }
    
    if (!notes || notes.length === 0) {
      console.log('✅ All notes already have embeddings!');
      return { queued: 0, total: 0 };
    }
    
    console.log(`📊 Found ${notes.length} notes without embeddings`);
    console.log('🔄 Queueing embedding jobs...');
    
    let queued = 0;
    let failed = 0;
    
    for (const note of notes) {
      if (!note.content || note.content.trim().length === 0) {
        continue;
      }
      
      try {
        const { error: queueError } = await supabase.rpc('queue_embedding_job', {
          p_user_id: note.user_id,
          p_item_type: 'note',
          p_item_id: note.id,
          p_priority: 5,
        });
        
        if (queueError) {
          console.error(`   ❌ Failed to queue note ${note.id}: ${queueError.message}`);
          failed++;
        } else {
          queued++;
          if (queued % 100 === 0) {
            process.stdout.write(`   ✅ Queued ${queued} notes...\r`);
          }
        }
      } catch (err) {
        console.error(`   ❌ Error queueing note ${note.id}:`, err.message);
        failed++;
      }
    }
    
    console.log(`\n✅ Queued ${queued} note embedding jobs (${failed} failed)`);
    return { queued, total: notes.length, failed };
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

/**
 * Queue embeddings for all highlights without embeddings
 */
async function queueHighlightEmbeddings(limit = null) {
  console.log('\n🖍️  Queueing embeddings for highlights without embeddings...\n');
  
  try {
    let query = supabase
      .from('user_highlights')
      .select('id, user_id, highlighted_text')
      .is('embedding', null)
      .not('highlighted_text', 'is', null)
      .eq('is_orphaned', false);
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data: highlights, error } = await query;
    
    if (error) {
      throw error;
    }
    
    if (!highlights || highlights.length === 0) {
      console.log('✅ All highlights already have embeddings!');
      return { queued: 0, total: 0 };
    }
    
    console.log(`📊 Found ${highlights.length} highlights without embeddings`);
    console.log('🔄 Queueing embedding jobs...');
    
    let queued = 0;
    let failed = 0;
    
    for (const highlight of highlights) {
      if (!highlight.highlighted_text || highlight.highlighted_text.trim().length === 0) {
        continue;
      }
      
      try {
        const { error: queueError } = await supabase.rpc('queue_embedding_job', {
          p_user_id: highlight.user_id,
          p_item_type: 'highlight',
          p_item_id: highlight.id,
          p_priority: 5,
        });
        
        if (queueError) {
          console.error(`   ❌ Failed to queue highlight ${highlight.id}: ${queueError.message}`);
          failed++;
        } else {
          queued++;
          if (queued % 100 === 0) {
            process.stdout.write(`   ✅ Queued ${queued} highlights...\r`);
          }
        }
      } catch (err) {
        console.error(`   ❌ Error queueing highlight ${highlight.id}:`, err.message);
        failed++;
      }
    }
    
    console.log(`\n✅ Queued ${queued} highlight embedding jobs (${failed} failed)`);
    return { queued, total: highlights.length, failed };
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

/**
 * Show documents that need embeddings (processed by background service)
 */
async function generateDocumentEmbeddings(limit = 10) {
  console.log('\n📄 Documents without embeddings...\n');
  
  try {
    const { data: books, error } = await supabase
      .from('user_books')
      .select('id, user_id, text_content')
      .not('text_content', 'is', null)
      .is('description_embedding', null)
      .limit(limit);
    
    if (error) {
      throw error;
    }
    
    if (!books || books.length === 0) {
      console.log('✅ All documents already have embeddings!');
      return { processed: 0, total: 0 };
    }
    
    console.log(`📊 Found ${books.length} documents without embeddings`);
    console.log('\n💡 Document embeddings are generated automatically by the background service.');
    console.log('   The service processes up to 10 documents per cycle (every 60 seconds).');
    console.log('   No manual action needed - they will be processed automatically.\n');
    
    return { processed: 0, total: books.length, queued: true };
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

/**
 * Show paper embedding info (use dedicated script for pre-computation)
 */
async function precomputePaperEmbeddings(limit = 10000, batchSize = 100) {
  console.log('\n📚 Paper Embedding Pre-computation\n');
  console.log('💡 Use the dedicated paper embedding script for pre-computation:');
  console.log('   node scripts/precompute-paper-embeddings.js precompute\n');
  console.log('   Or check status:');
  console.log('   node scripts/precompute-paper-embeddings.js status\n');
  
  // Show current status
  try {
    const { data: stats } = await supabase.rpc('get_embedding_coverage_stats');
    if (stats && stats.length > 0) {
      const s = stats[0];
      console.log('📊 Current Status:');
      console.log(`   Total papers: ${s.total_papers || 0}`);
      console.log(`   Pre-computed: ${s.precomputed_count || 0}`);
      console.log(`   Coverage: ${s.coverage_percentage || 0}%\n`);
    }
  } catch (err) {
    // Function might not exist
  }
  
  return { processed: 'use_dedicated_script' };
}

/**
 * Show pending jobs status (processing happens automatically via background service)
 */
async function showPendingJobs() {
  console.log('\n⚙️  Pending Embedding Jobs Status\n');
  
  try {
    const { data: pendingJobs, error } = await supabase
      .from('embedding_generation_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(20);
    
    if (error) throw error;
    
    const { count: totalPending } = await supabase
      .from('embedding_generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    const { count: processing } = await supabase
      .from('embedding_generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');
    
    console.log(`📊 Total pending: ${totalPending || 0}`);
    console.log(`⚙️  Currently processing: ${processing || 0}`);
    
    if (pendingJobs && pendingJobs.length > 0) {
      console.log('\n📋 Next jobs to be processed:');
      pendingJobs.slice(0, 10).forEach((job, idx) => {
        console.log(`   ${idx + 1}. ${job.item_type} (priority: ${job.priority}) - ${job.item_id.substring(0, 8)}...`);
      });
    }
    
    console.log('\n💡 Jobs are processed automatically by the background service every 60 seconds.');
    console.log('   No manual action needed - just wait for them to complete.');
    
    return { pending: totalPending || 0, processing: processing || 0 };
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

/**
 * Show embedding generation status
 */
async function showStatus() {
  console.log('\n📊 Embedding Generation Status\n');
  
  try {
    // Notes status
    const { count: notesTotal } = await supabase
      .from('user_notes')
      .select('*', { count: 'exact', head: true });
    
    const { count: notesWithEmbeddings } = await supabase
      .from('user_notes')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);
    
    const notesWithout = (notesTotal || 0) - (notesWithEmbeddings || 0);
    const notesPercentage = notesTotal > 0 
      ? Math.round((notesWithEmbeddings / notesTotal) * 100) 
      : 100;
    
    // Highlights status
    const { count: highlightsTotal } = await supabase
      .from('user_highlights')
      .select('*', { count: 'exact', head: true })
      .eq('is_orphaned', false);
    
    const { count: highlightsWithEmbeddings } = await supabase
      .from('user_highlights')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null)
      .eq('is_orphaned', false);
    
    const highlightsWithout = (highlightsTotal || 0) - (highlightsWithEmbeddings || 0);
    const highlightsPercentage = highlightsTotal > 0 
      ? Math.round((highlightsWithEmbeddings / highlightsTotal) * 100) 
      : 100;
    
    // Documents status
    const { count: documentsTotal } = await supabase
      .from('user_books')
      .select('*', { count: 'exact', head: true })
      .not('text_content', 'is', null);
    
    const { count: documentsWithEmbeddings } = await supabase
      .from('user_books')
      .select('*', { count: 'exact', head: true })
      .not('description_embedding', 'is', null)
      .not('text_content', 'is', null);
    
    const documentsWithout = (documentsTotal || 0) - (documentsWithEmbeddings || 0);
    const documentsPercentage = documentsTotal > 0 
      ? Math.round((documentsWithEmbeddings / documentsTotal) * 100) 
      : 100;
    
    // Pending jobs
    const { count: pendingJobs } = await supabase
      .from('embedding_generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    const { count: processingJobs } = await supabase
      .from('embedding_generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');
    
    // Paper embeddings status
    let paperStats = null;
    try {
      const { data: stats } = await supabase.rpc('get_embedding_coverage_stats');
      if (stats && stats.length > 0) {
        paperStats = stats[0];
      }
    } catch (err) {
      // Function might not exist, that's okay
    }
    
    console.log('📝 Notes:');
    console.log(`   Total: ${notesTotal || 0}`);
    console.log(`   With embeddings: ${notesWithEmbeddings || 0} (${notesPercentage}%)`);
    console.log(`   Without embeddings: ${notesWithout}`);
    
    console.log('\n🖍️  Highlights:');
    console.log(`   Total: ${highlightsTotal || 0}`);
    console.log(`   With embeddings: ${highlightsWithEmbeddings || 0} (${highlightsPercentage}%)`);
    console.log(`   Without embeddings: ${highlightsWithout}`);
    
    console.log('\n📄 Documents:');
    console.log(`   Total: ${documentsTotal || 0}`);
    console.log(`   With embeddings: ${documentsWithEmbeddings || 0} (${documentsPercentage}%)`);
    console.log(`   Without embeddings: ${documentsWithout}`);
    
    console.log('\n⚙️  Embedding Jobs:');
    console.log(`   Pending: ${pendingJobs || 0}`);
    console.log(`   Processing: ${processingJobs || 0}`);
    
    if (paperStats) {
      console.log('\n📚 Paper Embeddings:');
      console.log(`   Total papers: ${paperStats.total_papers || 0}`);
      console.log(`   Pre-computed: ${paperStats.precomputed_count || 0}`);
      console.log(`   Coverage: ${paperStats.coverage_percentage || 0}%`);
    }
    
    console.log('\n💡 Tip: Run "node scripts/generate-embeddings.js all" to queue all missing embeddings');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

/**
 * Process all types
 */
async function processAll(options = {}) {
  console.log('\n🚀 Processing all embedding types...\n');
  
  const results = {
    notes: null,
    highlights: null,
    documents: null,
  };
  
  try {
    // Queue notes
    if (options.includeNotes !== false) {
      results.notes = await queueNoteEmbeddings(options.notesLimit);
    }
    
    // Queue highlights
    if (options.includeHighlights !== false) {
      results.highlights = await queueHighlightEmbeddings(options.highlightsLimit);
    }
    
    // Generate document embeddings
    if (options.includeDocuments !== false) {
      results.documents = await generateDocumentEmbeddings(options.documentsLimit || 10);
    }
    
    console.log('\n✅ All embedding jobs queued!');
    console.log('\n📊 Summary:');
    if (results.notes) {
      console.log(`   Notes: ${results.notes.queued} queued`);
    }
    if (results.highlights) {
      console.log(`   Highlights: ${results.highlights.queued} queued`);
    }
    if (results.documents) {
      console.log(`   Documents: ${results.documents.processed} processed`);
    }
    
    console.log('\n💡 Background service will process these jobs automatically every 60 seconds.');
    console.log('   Check status with: node scripts/generate-embeddings.js status');
    
    return results;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Main handler
const command = process.argv[2] || 'help';
const options = {
  notesLimit: process.argv[3] ? parseInt(process.argv[3]) : null,
  highlightsLimit: process.argv[3] ? parseInt(process.argv[3]) : null,
  documentsLimit: process.argv[3] ? parseInt(process.argv[3]) : 10,
};

async function main() {
  switch (command) {
    case 'notes':
      await queueNoteEmbeddings(options.notesLimit);
      break;
    case 'highlights':
      await queueHighlightEmbeddings(options.highlightsLimit);
      break;
    case 'documents':
      await generateDocumentEmbeddings(options.documentsLimit);
      break;
    case 'papers':
      const limit = process.argv[3] ? parseInt(process.argv[3]) : 10000;
      const batchSize = process.argv[4] ? parseInt(process.argv[4]) : 100;
      await precomputePaperEmbeddings(limit, batchSize);
      break;
    case 'all':
      await processAll(options);
      break;
    case 'process':
    case 'pending':
      await showPendingJobs();
      break;
    case 'status':
      await showStatus();
      break;
    case 'help':
    default:
      console.log(`
🔮 Comprehensive Embedding Generation Script

Usage: node scripts/generate-embeddings.js [command] [options]

Commands:
  notes [limit]       - Queue embeddings for notes without embeddings
  highlights [limit]  - Queue embeddings for highlights without embeddings
  documents [limit]    - Generate embeddings for documents (default: 10)
  papers [limit] [batchSize] - Pre-compute paper embeddings (default: 10000, 100)
  all                - Process all types (notes, highlights, documents)
  pending            - Show pending embedding jobs status
  status             - Show embedding generation status
  help               - Show this help message

Examples:
  # Check current status
  node scripts/generate-embeddings.js status

  # Queue embeddings for all notes
  node scripts/generate-embeddings.js notes

  # Queue embeddings for first 1000 highlights
  node scripts/generate-embeddings.js highlights 1000

  # Generate embeddings for 20 documents
  node scripts/generate-embeddings.js documents 20

  # Pre-compute embeddings for 50,000 papers
  node scripts/generate-embeddings.js papers 50000 100

  # Process all types
  node scripts/generate-embeddings.js all

  # Check pending jobs status
  node scripts/generate-embeddings.js pending

Environment Variables Required:
  SUPABASE_SERVICE_ROLE_KEY  - Your Supabase service role key
  SUPABASE_URL or VITE_SUPABASE_URL - Your Supabase URL
  GEMINI_API_KEY              - For generating embeddings

Note: The background processing service runs automatically every 60 seconds.
      Jobs are queued and processed automatically - no manual processing needed.
      `);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

