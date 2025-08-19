import { NextApiRequest, NextApiResponse } from 'next';
import { InterviewSearchSystem } from '@/lib/interview-search';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, searchType = 'hybrid', filters = {}, topK = 10, alpha = 0.5 } = req.body;

    const searchSystem = new InterviewSearchSystem();

    let results;
    switch (searchType) {
      case 'vector':
        results = await searchSystem.vectorSearch(query, filters, topK);
        break;
      case 'keyword':
        results = await searchSystem.keywordSearch(query, filters, topK);
        break;
      case 'hybrid':
      default:
        results = await searchSystem.hybridSearch(query, filters, topK, alpha);
        break;
    }

    res.status(200).json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
}
