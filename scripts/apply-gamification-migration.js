#!/usr/bin/env node

/**
 * Migration script to apply the pomodoro gamification system to production Supabase
 * This script reads migration 007 and applies it directly to the database
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local
function loadEnvFile() {
  try {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });
    return envVars;
  } catch (error) {
    console.error('Failed to load .env.local:', error.message);
    return {};
  }
}

const envVars = loadEnvFile();

// Get environment variables
const supabaseUrl = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- VITE_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY in your environment or .env file');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Starting migration: Pomodoro Gamification System');
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '007_add_pomodoro_gamification.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute the entire migration as one SQL block
    console.log('⚡ Executing migration SQL...');
    
    try {
      const { error } = await supabase.rpc('exec', { sql: migrationSQL });
      
      if (error) {
        console.error('❌ Error executing migration:', error);
        throw error;
      }
      
      console.log('✅ Migration executed successfully');
    } catch (error) {
      console.error('❌ Failed to execute migration:', error);
      throw error;
    }
    
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('✅ pomodoro_achievements table created');
    console.log('✅ pomodoro_streaks table created');
    console.log('✅ Indexes created');
    console.log('✅ RLS policies applied');
    console.log('✅ RPC functions created (including get_achievement_progress)');
    console.log('');
    console.log('The Pomodoro Gamification system should now work properly.');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Check if we have the exec function available
async function checkExecFunction() {
  try {
    const { data, error } = await supabase.rpc('exec', { sql: 'SELECT 1' });
    if (error) {
      console.error('❌ exec function not available. Please create it first:');
      console.error('');
      console.error('CREATE OR REPLACE FUNCTION exec(sql text)');
      console.error('RETURNS void');
      console.error('LANGUAGE plpgsql');
      console.error('SECURITY DEFINER');
      console.error('AS $$');
      console.error('BEGIN');
      console.error('  EXECUTE sql;');
      console.error('END;');
      console.error('$$;');
      console.error('');
      console.error('GRANT EXECUTE ON FUNCTION exec(text) TO service_role;');
      process.exit(1);
    }
    return true;
  } catch (error) {
    console.error('❌ Failed to check exec function:', error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log('🔍 Checking exec function availability...');
  await checkExecFunction();
  console.log('✅ exec function is available');
  
  await runMigration();
}

main().catch(console.error);
