import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'node:fs';

// Debug-only log sink for local reproduction.
// Writes NDJSON lines to: /Users/aminamouhadi/smart-reader-serverless/.cursor/debug.log
// NOTE: In production, this endpoint is disabled by default.

const LOG_PATH = '/Users/aminamouhadi/smart-reader-serverless/.cursor/debug.log';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow in non-production unless explicitly enabled.
  const enabled =
    process.env.DEBUG_LOGGING_ENABLED === 'true' ||
    process.env.VERCEL_ENV !== 'production';

  if (!enabled) {
    return res.status(404).end();
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const line = JSON.stringify({
      ...body,
      receivedAt: Date.now(),
    });

    // Basic size guard to avoid accidental large writes
    if (line.length > 10_000) {
      return res.status(413).json({ error: 'Payload too large' });
    }

    fs.mkdirSync('/Users/aminamouhadi/smart-reader-serverless/.cursor', { recursive: true });
    fs.appendFileSync(LOG_PATH, line + '\n', 'utf8');
  } catch {
    // swallow
  }

  return res.status(204).end();
}

