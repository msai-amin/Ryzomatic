#!/usr/bin/env node

/**
 * Direct pre-computation script (bypasses API, calls services directly)
 * Use this if the API endpoint isn't working yet
 * Usage: node scripts/precompute-paper-embeddings-direct.js [identify|precompute|status]
 */

// Load .env files
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

// Import services after env is loaded
// Note: This requires running with: npx tsx scripts/precompute-paper-embeddings-direct.js
const action = process.argv[2] || 'help';

// Import services dynamically after env is set
let paperPopularityService, paperEmbeddingService, createClient;
let supabase;

async function identifyPopularPapers(limit = 50000, email) {
  // Import services now that env is loaded
  if (!paperPopularityService) {
    const module = await import('../lib/paperPopularityService.ts');
    paperPopularityService = module.paperPopularityService;
  }
  
  console.log(`\n🔍 Identifying ${limit} popular papers (direct service call)...\n`);
  
  try {
    const popularPapers = await paperPopularityService.identifyPopularPapers(limit, email);
    await paperPopularityService.storePopularPapers(popularPapers);
    
    console.log('✅ Success!');
    console.log(`📊 Papers identified: ${popularPapers.length}`);
    console.log(`\n📝 Sample papers:`);
    popularPapers.slice(0, 5).forEach(p => {
      console.log(`   - ${p.title.substring(0, 60)}... (score: ${p.popularity_score.toFixed(2)})`);
    });
    console.log(`\n💡 Next step: Run 'node scripts/precompute-paper-embeddings-direct.js precompute'`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      console.error('\n⚠️  Migration not applied! Please apply migration 073_paper_embeddings.sql first.');
    }
    process.exit(1);
  }
}

async function precomputeEmbeddings(limit = 50000, batchSize = 100) {
  // Import services now that env is loaded
  if (!paperEmbeddingService) {
    const module = await import('../lib/paperEmbeddingService.ts');
    paperEmbeddingService = module.paperEmbeddingService;
  }
  
  console.log(`\n🚀 Starting pre-computation for ${limit} papers (batch size: ${batchSize})...\n`);
  console.log(`🔄 Continuous mode: Will process ALL remaining papers until complete\n`);
  
  try {
    const progress = await paperEmbeddingService.precomputeFromPopularPapers(limit, batchSize, false, true);
    
    console.log('\n✅ Pre-computation complete!');
    console.log(`📊 Processed: ${progress.processed}/${progress.total}`);
    console.log(`❌ Failed: ${progress.failed}`);
    console.log(`📈 Success rate: ${Math.round((progress.processed / progress.total) * 100)}%`);
    console.log(`\n💰 Estimated cost: ~$${((progress.processed * 0.00015).toFixed(2))}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      console.error('\n⚠️  Migration not applied! Please apply migration 073_paper_embeddings.sql first.');
    }
    process.exit(1);
  }
}

async function checkStatus() {
  // Import supabase client now that env is loaded
  if (!supabase) {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    supabase = createSupabaseClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  
  console.log(`\n📊 Checking pre-computation status...\n`);
  
  try {
    const { data: stats, error } = await supabase.rpc('get_embedding_coverage_stats');
    
    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('relation')) {
        console.log('❌ Migration not applied. Function get_embedding_coverage_stats does not exist.');
        console.log('Please apply migration 073_paper_embeddings.sql first.');
        return;
      }
      throw error;
    }
    
    if (stats && stats.length > 0) {
      const s = stats[0];
      console.log('📈 Coverage Statistics:');
      console.log(`   Total papers: ${s.total_papers || 0}`);
      console.log(`   Pre-computed: ${s.precomputed_count || 0}`);
      console.log(`   Coverage: ${s.coverage_percentage || 0}%`);
      console.log(`   Popular papers: ${s.popular_papers_count || 0}`);
      console.log(`   Popular pre-computed: ${s.popular_papers_precomputed || 0}`);
      if (s.latest_precomputation) {
        console.log(`   Last pre-computation: ${new Date(s.latest_precomputation).toLocaleString()}`);
      }
    }
    
    // Check popular_papers table
    const { data: popularPapers, error: ppError } = await supabase
      .from('popular_papers')
      .select('count')
      .limit(1);
    
    if (ppError) {
      if (ppError.code === '42P01') {
        console.log('\n❌ Migration not applied: popular_papers table does not exist');
      } else {
        console.log(`\n⚠️  Error checking popular_papers: ${ppError.message}`);
      }
    } else {
      const { count } = await supabase
        .from('popular_papers')
        .select('*', { count: 'exact', head: true });
      console.log(`\n📚 Popular papers in database: ${count || 0}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    console.error('Make sure .env.local exists and contains SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
    console.error('Error: SUPABASE_URL or VITE_SUPABASE_URL environment variable not set');
    process.exit(1);
  }
  
  switch (action) {
    case 'identify':
      await identifyPopularPapers(50000, process.env.OPENALEX_EMAIL);
      break;
    case 'precompute':
      await precomputeEmbeddings(50000, 100);
      break;
    case 'status':
      await checkStatus();
      break;
    case 'help':
    default:
      console.log(`
📚 Paper Embedding Pre-computation Script (Direct Service Calls)

This script calls the services directly, bypassing the API endpoint.
Use this if the API endpoint isn't working yet.

Usage: node scripts/precompute-paper-embeddings-direct.js [command]

Commands:
  identify    - Identify 50,000 popular papers from OpenAlex
  precompute  - Pre-compute embeddings for popular papers
  status      - Check status of pre-computation
  help        - Show this help message

Environment Variables Required:
  SUPABASE_SERVICE_ROLE_KEY  - Your Supabase service role key
  SUPABASE_URL or VITE_SUPABASE_URL - Your Supabase URL
  OPENALEX_EMAIL              - Your email for OpenAlex polite pool (optional)

Examples:
  # Step 1: Identify popular papers
  node scripts/precompute-paper-embeddings-direct.js identify

  # Step 2: Pre-compute embeddings
  node scripts/precompute-paper-embeddings-direct.js precompute

  # Check status
  node scripts/precompute-paper-embeddings-direct.js status

⚠️  IMPORTANT: Migration 073_paper_embeddings.sql must be applied first!
      `);
  }
}

main().catch(console.error);

