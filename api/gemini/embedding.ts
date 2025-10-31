import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

const geminiKey = process.env.GEMINI_API_KEY;

if (!geminiKey) throw new Error('GEMINI_API_KEY is not set');

const genAI = new GoogleGenerativeAI(geminiKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { text, texts } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: 'models/text-embedding-004' });
    if (typeof text === 'string') {
      const result = await model.embedContent(text);
      res.status(200).json({ embedding: result.embedding.values });
      return;
    }
    if (Array.isArray(texts)) {
      if (texts.length === 0) {
        res.status(400).json({ error: 'texts array must not be empty' });
        return;
      }
      const results = await Promise.all(texts.map((t: string) => model.embedContent(t)));
      res.status(200).json({ embeddings: results.map(r => r.embedding.values) });
      return;
    }
    res.status(400).json({ error: 'Must provide "text" (string) or "texts" (array)' });
  } catch (error: any) {
    console.error('Gemini embedding error:', error);
    res.status(500).json({ error: 'Embedding failed', details: error.message || error.toString() });
  }
}
