import { NextApiRequest, NextApiResponse } from 'next';
import { InterviewSearchSystem, VectorSearchResult } from '@/lib/interview-search';
import { promises as fs } from 'fs';
import path from 'path';

interface Interview {
  _id: string;
  id: string;
  [key: string]: unknown;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, searchType = 'hybrid', filters = {}, topK = 10, alpha = 0.5 } = req.body;

    const searchSystem = new InterviewSearchSystem();

    let results: VectorSearchResult[];
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
    // Load interviews data and attach matching interviews
    const interviewIds = Array.from(
      new Set(
        (results || [])
          .map((r) => r.interview_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    let interviews: Interview[] = [];
    try {
      const filePath = path.join(process.cwd(), 'data', 'interviews.json');
      const raw = await fs.readFile(filePath, 'utf-8');
      const all = JSON.parse(raw) as Interview[];
      interviews = interviewIds
        .map(id => {
          const found = all.find((it) => it._id === id || it.id === id);
          if (!found) return null;
          const responseInterview = { ...found, id: found._id ?? found.id };
          delete (responseInterview as Partial<Interview>)._id;
          return responseInterview;
        })
        .filter((i): i is Interview => Boolean(i));
    } catch (e) {
      console.warn('Failed to load interviews.json:', e);
    }

    res.status(200).json({ chunks: results, interviews });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
}
