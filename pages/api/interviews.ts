import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

// Simple in-memory cache to avoid re-reading file excessively
let cache: { interviews: any[]; mtime: number } | null = null;

async function loadInterviews() {
  const filePath = path.join(process.cwd(), 'data', 'interviews.json');
  const stat = await fs.stat(filePath);
  if (!cache || cache.mtime !== stat.mtimeMs) {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    cache = { interviews: data, mtime: stat.mtimeMs };
  }
  return cache.interviews;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const interviews = await loadInterviews();

    if (req.method === 'GET') {
      const { id } = req.query;
      if (id) {
        const interview = interviews.find((i: any) => i._id === id || i.id === id);
        if (!interview) return res.status(404).json({ error: 'Interview not found' });
        const { _id, ...rest } = interview;
        return res.status(200).json({ interview: { id: _id ?? interview.id, ...rest } });
      }
      // List
      const list = interviews.map((i: any) => ({ id: i._id ?? i.id, participant_id: i.participant_id }));
      return res.status(200).json({ interviews: list });
    }

    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    console.error('Interviews endpoint error', e);
    return res.status(500).json({ error: 'Failed to load interviews' });
  }
}
