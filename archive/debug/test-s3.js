// Simple S3 test script
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET;

async function testS3() {
  try {
    // Test upload
    const testContent = 'Hello from Smart Reader!';
    const testKey = `test/connection-test-${Date.now()}.txt`;
    
    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    });
    
    await s3Client.send(uploadCommand);
    console.log('✅ Upload successful:', testKey);
    
    // Test download
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
    });
    
    const response = await s3Client.send(getCommand);
    const content = await response.Body.transformToString();
    
    if (content === testContent) {
      console.log('✅ Download successful:', content);
      console.log('🎉 S3 is configured correctly!');
    } else {
      console.log('❌ Content mismatch');
    }
    
  } catch (error) {
    console.error('❌ S3 test failed:', error.message);
  }
}

testS3();
