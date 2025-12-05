#!/usr/bin/env node

/**
 * Script to pre-compute embeddings for 50,000 popular papers
 * Usage: node scripts/precompute-paper-embeddings.js [identify|precompute|status]
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
      // Skip comments and empty lines
      if (trimmed && !trimmed.startsWith('#')) {
        // Match KEY=VALUE (with optional quotes)
        const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          // Only set if not already in process.env
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
    break; // Use first found file
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Determine API base URL
let API_BASE_URL = process.env.API_BASE_URL;
if (!API_BASE_URL) {
  if (process.env.VERCEL_URL && !process.env.VERCEL_URL.includes('localhost')) {
    API_BASE_URL = `https://${process.env.VERCEL_URL}`;
  } else if (process.env.VITE_APP_URL && process.env.VITE_APP_URL.includes('vercel')) {
    API_BASE_URL = process.env.VITE_APP_URL;
  } else {
    // Default to production URL
    API_BASE_URL = 'https://smart-reader-serverless.vercel.app';
    console.log('⚠️  Using production API URL. Set API_BASE_URL to use a different endpoint.');
  }
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  process.exit(1);
}

const action = process.argv[2] || 'help';

async function identifyPopularPapers(limit = 50000, email) {
  console.log(`\n🔍 Identifying ${limit} popular papers...\n`);
  console.log(`📡 API URL: ${API_BASE_URL}/api/precompute-paper-embeddings?action=identify-popular\n`);
  
  const response = await fetch(`${API_BASE_URL}/api/precompute-paper-embeddings?action=identify-popular`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ limit, email }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`❌ API Error (${response.status}): ${response.statusText}`);
    console.error(`Response: ${text.substring(0, 500)}`);
    process.exit(1);
  }

  const data = await response.json();
  
  if (response.ok) {
    console.log('✅ Success!');
    console.log(`📊 Papers identified: ${data.papersIdentified}`);
    console.log(`\n📝 Sample papers:`);
    if (data.papers && data.papers.length > 0) {
      data.papers.slice(0, 5).forEach(p => {
        console.log(`   - ${p.title.substring(0, 60)}... (score: ${p.popularity_score.toFixed(2)})`);
      });
    }
    console.log(`\n💡 Next step: Run 'node scripts/precompute-paper-embeddings.js precompute'`);
  } else {
    console.error('❌ Error:', data.error);
    console.error(data.message);
    process.exit(1);
  }
}

async function precomputeEmbeddings(limit = 50000, batchSize = 100) {
  console.log(`\n🚀 Starting pre-computation for ${limit} papers (batch size: ${batchSize})...\n`);
  
  const response = await fetch(`${API_BASE_URL}/api/precompute-paper-embeddings?action=precompute-from-popular`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ limit, batchSize }),
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log('✅ Pre-computation started!');
    console.log(`📋 Job ID: ${data.jobId}`);
    console.log(`📊 Total papers: ${data.totalPapers || data.limit}`);
    console.log(`\n💡 Monitor progress with: node scripts/precompute-paper-embeddings.js status`);
    console.log(`\n⏱️  This will take approximately 5-10 hours to complete.`);
    console.log(`💰 Estimated cost: ~$7.50 for ${limit} embeddings`);
  } else {
    console.error('❌ Error:', data.error);
    console.error(data.message);
    process.exit(1);
  }
}

async function checkStatus() {
  console.log(`\n📊 Checking pre-computation status...\n`);
  
  const response = await fetch(`${API_BASE_URL}/api/precompute-paper-embeddings?action=status`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log('📋 Recent Jobs:');
    if (data.recentJobs && data.recentJobs.length > 0) {
      data.recentJobs.forEach(job => {
        const status = job.status === 'completed' ? '✅' : 
                      job.status === 'processing' ? '⏳' : 
                      job.status === 'failed' ? '❌' : '⏸️';
        console.log(`\n${status} ${job.job_type} (${job.status})`);
        console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
        if (job.status === 'processing' || job.status === 'completed') {
          const percentage = job.papers_total > 0 
            ? Math.round((job.papers_processed / job.papers_total) * 100)
            : 0;
          console.log(`   Progress: ${job.papers_processed}/${job.papers_total} (${percentage}%) - ${job.papers_failed} failed`);
        }
        if (job.error_message) {
          console.log(`   Error: ${job.error_message}`);
        }
      });
    } else {
      console.log('   No jobs found');
    }
    
    if (data.coverageStats && data.coverageStats.length > 0) {
      const stats = data.coverageStats[0];
      console.log(`\n📈 Coverage Statistics:`);
      console.log(`   Total papers: ${stats.total_papers || 0}`);
      console.log(`   Pre-computed: ${stats.precomputed_count || 0}`);
      console.log(`   Coverage: ${stats.coverage_percentage || 0}%`);
      console.log(`   Popular papers: ${stats.popular_papers_count || 0}`);
      console.log(`   Popular pre-computed: ${stats.popular_papers_precomputed || 0}`);
      if (stats.latest_precomputation) {
        console.log(`   Last pre-computation: ${new Date(stats.latest_precomputation).toLocaleString()}`);
      }
    }
  } else {
    console.error('❌ Error:', data.error);
    console.error(data.message);
    process.exit(1);
  }
}

async function main() {
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
📚 Paper Embedding Pre-computation Script

Usage: node scripts/precompute-paper-embeddings.js [command]

Commands:
  identify    - Identify 50,000 popular papers from OpenAlex
  precompute  - Pre-compute embeddings for popular papers
  status      - Check status of pre-computation jobs
  help        - Show this help message

Environment Variables Required:
  SUPABASE_SERVICE_ROLE_KEY  - Your Supabase service role key
  SUPABASE_URL                - Your Supabase URL (optional, for direct DB access)
  API_BASE_URL                - Your API base URL (default: http://localhost:3000)
  OPENALEX_EMAIL              - Your email for OpenAlex polite pool (optional but recommended)

Examples:
  # Step 1: Identify popular papers
  node scripts/precompute-paper-embeddings.js identify

  # Step 2: Pre-compute embeddings
  node scripts/precompute-paper-embeddings.js precompute

  # Check status
  node scripts/precompute-paper-embeddings.js status
      `);
  }
}

main().catch(console.error);

