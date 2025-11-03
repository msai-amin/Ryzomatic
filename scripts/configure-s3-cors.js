#!/usr/bin/env node

/**
 * Configure S3 CORS for Smart Reader
 * This script sets up CORS headers for the S3 bucket
 */

import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const AWS_REGION = process.env.AWS_REGION || 'us-east-2';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || 'smart-reader-documents';

const s3Client = new S3Client({
  region: AWS_REGION,
});

const corsConfig = {
  Bucket: AWS_S3_BUCKET,
  CORSConfiguration: {
    CORSRules: [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
        AllowedOrigins: [
          'https://ryzomatic.net',
          'https://smart-reader-serverless.vercel.app',
          'http://localhost:5173',
          'http://localhost:3001'
        ],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 3000
      }
    ]
  }
};

async function configureCORS() {
  try {
    console.log('🚀 Configuring S3 CORS...');
    console.log(`Bucket: ${AWS_S3_BUCKET}`);
    console.log(`Region: ${AWS_REGION}`);
    console.log('');
    
    const command = new PutBucketCorsCommand(corsConfig);
    await s3Client.send(command);
    
    console.log('✅ CORS configuration applied successfully!');
    console.log('');
    console.log('Allowed origins:');
    corsConfig.CORSConfiguration.CORSRules[0].AllowedOrigins.forEach(origin => {
      console.log(`  - ${origin}`);
    });
    console.log('');
    console.log('⏳ Please wait 1-2 minutes for AWS to propagate changes...');
    console.log('Then hard refresh your browser (Cmd+Shift+R) and try downloading a book.');
    
  } catch (error) {
    console.error('❌ Failed to configure CORS:', error.message);
    console.error('');
    console.error('Make sure:');
    console.error('1. AWS credentials are set in .env.local');
    console.error('2. AWS_ACCESS_KEY_ID has S3 permissions');
    console.error('3. The bucket name is correct');
    console.error('');
    console.error('Alternatively, configure CORS manually in AWS Console:');
    console.error('1. Go to: https://console.aws.amazon.com/s3/');
    console.error('2. Click: smart-reader-documents bucket');
    console.error('3. Permissions → CORS');
    console.error('4. Paste the config from S3_CORS_FIX.md');
    process.exit(1);
  }
}

configureCORS();

