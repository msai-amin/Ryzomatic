#!/usr/bin/env node

/**
 * Check if required environment variables are set for local development
 * Usage: node scripts/check-env.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Required environment variables for local development
const requiredVars = {
  'VITE_SUPABASE_URL': 'Supabase Project URL',
  'VITE_SUPABASE_ANON_KEY': 'Supabase Anonymous Key',
};

const optionalVars = {
  'VITE_GOOGLE_CLIENT_ID': 'Google OAuth Client ID',
  'VITE_GEMINI_API_KEY': 'Gemini API Key',
  'VITE_OPENAI_API_KEY': 'OpenAI API Key',
  'SUPABASE_SERVICE_ROLE_KEY': 'Supabase Service Role Key (server-side only)',
};

// Check if .env.local exists
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envLocalExists = fs.existsSync(envLocalPath);

console.log('🔍 Checking environment variables for local development...\n');

if (!envLocalExists) {
  console.log('❌ .env.local file not found!');
  console.log('📝 Create .env.local file with required variables.');
  console.log('   See LOCAL_AUTH_SETUP.md for instructions.\n');
  process.exit(1);
}

console.log('✅ .env.local file exists\n');

// Read .env.local file
const envLocalContent = fs.readFileSync(envLocalPath, 'utf-8');
const envVars = {};

// Parse .env.local file (simple parsing, doesn't handle quotes properly)
envLocalContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!value.startsWith('your_') && !value.includes('_here')) {
        envVars[key.trim()] = value;
      }
    }
  }
});

// Check required variables
console.log('📋 Required Variables:');
let allRequiredSet = true;

Object.entries(requiredVars).forEach(([key, description]) => {
  const value = envVars[key] || process.env[key];
  if (value && !value.includes('your_') && !value.includes('_here')) {
    console.log(`   ✅ ${key}: SET`);
  } else {
    console.log(`   ❌ ${key}: NOT SET (${description})`);
    allRequiredSet = false;
  }
});

console.log('\n📋 Optional Variables:');
Object.entries(optionalVars).forEach(([key, description]) => {
  const value = envVars[key] || process.env[key];
  if (value && !value.includes('your_') && !value.includes('_here')) {
    console.log(`   ✅ ${key}: SET`);
  } else {
    console.log(`   ⚠️  ${key}: NOT SET (${description})`);
  }
});

console.log('');

if (!allRequiredSet) {
  console.log('❌ Some required environment variables are missing!');
  console.log('📝 See LOCAL_AUTH_SETUP.md for setup instructions.\n');
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set!');
  console.log('🚀 You can now run: npm run dev\n');
  process.exit(0);
}

