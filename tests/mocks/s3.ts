/**
 * Mock AWS S3 client for testing
 */

import { vi } from 'vitest';

export const createMockS3Client = () => {
  return {
    send: vi.fn(),
    config: {
      region: 'us-east-1',
    },
  };
};

export const mockS3Response = (data: any, error: any = null) => {
  if (error) {
    return Promise.reject(error);
  }
  return Promise.resolve({ ...data, $metadata: { httpStatusCode: 200 } });
};

export const createMockPresigner = () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://test-signed-url.s3.amazonaws.com/test-key'),
});

