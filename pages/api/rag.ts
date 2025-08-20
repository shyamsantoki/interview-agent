import { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import { InterviewSearchSystem, VectorSearchResult } from '@/lib/interview-search';
import { promises as fs } from 'fs';
import path from 'path';

interface Interview {
  _id: string;
  id: string;
  participant_id: string;
  [key: string]: unknown;
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Tool definition for searching interviews
const searchTool = {
  name: "search_interviews",
  description: "Search for relevant interview content using vector similarity, keyword search, or hybrid approach",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "The search query to find relevant interview content"
      },
      searchType: {
        type: "string",
        enum: ["vector", "keyword", "hybrid"],
        description: "Type of search to perform",
        default: "hybrid"
      },
      filters: {
        type: "object",
        properties: {
          interview_id: { type: "string" },
          participant_id: { type: "string" }
        },
        description: "Optional filters to apply to the search"
      },
      topK: {
        type: "number",
        description: "Number of results to return",
        default: 10
      }
    },
    required: ["query"]
  }
};

interface SearchParams {
  query: string;
  searchType?: 'vector' | 'keyword' | 'hybrid';
  filters?: {
    interview_id?: string;
    participant_id?: string;
  };
  topK?: number;
  alpha?: number;
}

async function searchInterviews(params: SearchParams): Promise<string> {
  try {
    const { query, searchType = 'hybrid', filters = {}, topK = 10, alpha = 0.5 } = params;

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

    // Load interview metadata
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

    // Format the search results for the AI
    const formattedResults = results?.map((result, index) => ({
      rank: index + 1,
      score: result.score,
      interview_id: result.interview_id,
      participant_id: result.participant_id,
      interview_title: result.interview_title,
      paragraph_title: result.paragraph_title,
      paragraph_text: result.paragraph_text,
    })) || [];

    return JSON.stringify({
      query,
      searchType,
      resultsCount: formattedResults.length,
      results: formattedResults,
      interviews
    });
  } catch (error) {
    console.error('Search error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return JSON.stringify({ error: 'Failed to search interviews', details: errorMessage });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Set up streaming response
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const defaultSystemPrompt = `You are an AI assistant specialized in analyzing interview data. You have access to a search tool that can find relevant interview content based on user queries.

When answering questions:
1. Use the search_interviews tool to find relevant context from the interview database
2. Analyze the search results carefully and extract key insights
3. Provide comprehensive answers based on the retrieved information
4. Cite specific interviews and participants when relevant
5. If the search doesn't return sufficient information, indicate this in your response

Always be precise and reference specific interview content when making claims.`;

    // Create the message stream with tool calling
    const stream = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      system: systemPrompt || defaultSystemPrompt,
      messages,
      tools: [searchTool],
      stream: true,
    });

    let toolUseId: string | null = null;
    let toolName: string | null = null;
    let toolInput: string = '';

    for await (const chunk of stream) {
      if (chunk.type === 'message_start') {
        // Message started
        continue;
      } else if (chunk.type === 'content_block_start') {
        if (chunk.content_block.type === 'tool_use') {
          toolUseId = chunk.content_block.id;
          toolName = chunk.content_block.name;
        }
      } else if (chunk.type === 'content_block_delta') {
        if (chunk.delta.type === 'text_delta') {
          // Stream text content
          res.write(chunk.delta.text);
        } else if (chunk.delta.type === 'input_json_delta') {
          // Accumulate tool input
          toolInput += chunk.delta.partial_json;
        }
      } else if (chunk.type === 'content_block_stop') {
        if (toolUseId && toolName === 'search_interviews') {
          try {
            // Execute the tool
            const parsedInput = JSON.parse(toolInput);
            const toolResult = await searchInterviews(parsedInput);

            // Continue the conversation with tool result
            const followUpStream = await anthropic.messages.create({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 4000,
              system: systemPrompt || defaultSystemPrompt,
              messages: [
                ...messages,
                {
                  role: 'assistant',
                  content: [
                    {
                      type: 'tool_use',
                      id: toolUseId,
                      name: toolName,
                      input: parsedInput,
                    },
                  ],
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'tool_result',
                      tool_use_id: toolUseId,
                      content: toolResult,
                    },
                  ],
                },
              ],
              stream: true,
            });

            // Stream the follow-up response
            for await (const followUpChunk of followUpStream) {
              if (followUpChunk.type === 'content_block_delta' && followUpChunk.delta.type === 'text_delta') {
                res.write(followUpChunk.delta.text);
              }
            }
          } catch (error) {
            console.error('Tool execution error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            res.write(`\n\n[Error executing search: ${errorMessage}]`);
          }

          // Reset tool state
          toolUseId = null;
          toolName = null;
          toolInput = '';
        }
      } else if (chunk.type === 'message_stop') {
        // Message completed
        break;
      }
    }

    res.end();
  } catch (error) {
    console.error('RAG endpoint error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (!res.headersSent) {
      res.status(500).json({ error: 'RAG processing failed', details: errorMessage });
    } else {
      res.write(`\n\n[Error: ${errorMessage}]`);
      res.end();
    }
  }
}