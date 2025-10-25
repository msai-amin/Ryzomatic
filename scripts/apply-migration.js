#!/usr/bin/env node

/**
 * Migration script to apply the document_relationships table to production Supabase
 * This script reads the migration file and applies it directly to the database
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Get environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // You'll need to set this

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
    console.log('🚀 Starting migration: document_relationships table');
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '015_add_document_relationships.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            console.error(`❌ Error executing statement ${i + 1}:`, error);
            console.error('Statement:', statement);
            throw error;
          }
          
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (error) {
          console.error(`❌ Failed to execute statement ${i + 1}:`, error);
          throw error;
        }
      }
    }
    
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('✅ document_relationships table created');
    console.log('✅ Indexes created');
    console.log('✅ RLS policies applied');
    console.log('✅ Functions created');
    console.log('');
    console.log('The Related Documents feature should now work properly.');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Check if we have the exec_sql function available
async function checkExecSqlFunction() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    if (error) {
      console.log('⚠️  exec_sql function not available, trying alternative approach...');
      return false;
    }
    return true;
  } catch (error) {
    console.log('⚠️  exec_sql function not available, trying alternative approach...');
    return false;
  }
}

// Alternative approach using direct SQL execution
async function runMigrationAlternative() {
  try {
    console.log('🚀 Starting migration (alternative method): document_relationships table');
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '015_add_document_relationships.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    console.log('');
    console.log('⚠️  Since exec_sql is not available, please run this SQL manually in your Supabase dashboard:');
    console.log('');
    console.log('='.repeat(80));
    console.log(migrationSQL);
    console.log('='.repeat(80));
    console.log('');
    console.log('📋 Instructions:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the SQL above');
    console.log('4. Click "Run" to execute the migration');
    console.log('');
    console.log('After running the SQL, the Related Documents feature will work properly.');
    
  } catch (error) {
    console.error('💥 Failed to read migration file:', error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log('🔍 Checking migration capabilities...');
  
  const hasExecSql = await checkExecSqlFunction();
  
  if (hasExecSql) {
    await runMigration();
  } else {
    await runMigrationAlternative();
  }
}

main().catch(console.error);
