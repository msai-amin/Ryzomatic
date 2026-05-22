#!/usr/bin/env node

/**
 * Ensures Rollup optional dependency is installed
 * This fixes the npm bug with optional dependencies on Linux
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

if (process.platform !== 'linux' || process.arch !== 'x64') {
  console.log(`ℹ️  Skipping Rollup Linux-x64 check on ${process.platform}/${process.arch}`);
  process.exit(0);
}

const rollupPath = path.join(process.cwd(), 'node_modules', '@rollup', 'rollup-linux-x64-gnu');

if (!fs.existsSync(rollupPath)) {
  console.log('⚠️  Rollup optional dependency @rollup/rollup-linux-x64-gnu is missing');
  console.log('📦 Installing @rollup/rollup-linux-x64-gnu...');
  
  try {
    execSync('npm install --no-save --no-audit --force @rollup/rollup-linux-x64-gnu', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    // Verify it was installed
    if (fs.existsSync(rollupPath)) {
      console.log('✅ Rollup optional dependency installed successfully');
    } else {
      console.error('❌ Failed to install Rollup optional dependency');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error installing Rollup optional dependency:', error.message);
    process.exit(1);
  }
} else {
  console.log('✅ Rollup optional dependency already installed');
}

