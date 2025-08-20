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
        description: "The search query to find relevant interview content. make the query self-contained and clear, meaning, it should not require additional context to understand.",
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

// Stream event types
interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'error';
  data: unknown;
}

function writeStreamEvent(res: NextApiResponse, event: StreamEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
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

    // Set up Server-Sent Events streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt || defaultSystemPrompt,
      messages,
      tools: [searchTool],
      stream: true,
    });

    let toolUseId: string | null = null;
    let toolName: string | null = null;
    let toolInput: string = '';
    let currentToolInput: unknown = null;

    for await (const chunk of stream) {
      if (chunk.type === 'message_start') {
        // Message started
        continue;
      } else if (chunk.type === 'content_block_start') {
        if (chunk.content_block.type === 'tool_use') {
          toolUseId = chunk.content_block.id;
          toolName = chunk.content_block.name;
          toolInput = '';
          // Send tool call start event
          writeStreamEvent(res, {
            type: 'tool_call',
            data: {
              status: 'start',
              id: toolUseId,
              name: toolName
            }
          });
        }
      } else if (chunk.type === 'content_block_delta') {
        if (chunk.delta.type === 'text_delta') {
          // Stream text content
          writeStreamEvent(res, {
            type: 'text',
            data: chunk.delta.text
          });
        } else if (chunk.delta.type === 'input_json_delta') {
          // Accumulate tool input
          toolInput += chunk.delta.partial_json;

          // Try to parse partial JSON to show progress
          try {
            const partial = JSON.parse(toolInput);
            currentToolInput = partial;
            writeStreamEvent(res, {
              type: 'tool_call',
              data: {
                status: 'input_update',
                id: toolUseId,
                name: toolName,
                input: partial
              }
            });
          } catch (e) {
            // Partial JSON, continue accumulating
          }
        }
      } else if (chunk.type === 'content_block_stop') {
        if (toolUseId && toolName === 'search_interviews') {
          try {
            // Parse and execute the tool
            const parsedInput = JSON.parse(toolInput);
            currentToolInput = parsedInput;

            // Send tool call input complete event
            writeStreamEvent(res, {
              type: 'tool_call',
              data: {
                status: 'executing',
                id: toolUseId,
                name: toolName,
                input: parsedInput
              }
            });

            // Execute the tool
            const toolResult = await searchInterviews(parsedInput);
            const parsedResult = JSON.parse(toolResult);

            // Send tool result event
            writeStreamEvent(res, {
              type: 'tool_result',
              data: {
                id: toolUseId,
                name: toolName,
                result: parsedResult,
                summary: {
                  query: parsedResult.query,
                  searchType: parsedResult.searchType,
                  resultsCount: parsedResult.resultsCount,
                  hasError: !!parsedResult.error
                }
              }
            });

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
                writeStreamEvent(res, {
                  type: 'text',
                  data: followUpChunk.delta.text
                });
              }
            }
          } catch (error) {
            console.error('Tool execution error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            writeStreamEvent(res, {
              type: 'error',
              data: {
                message: `Search execution failed: ${errorMessage}`,
                toolId: toolUseId
              }
            });
          }

          // Reset tool state
          toolUseId = null;
          toolName = null;
          toolInput = '';
          currentToolInput = null;
        }
      } else if (chunk.type === 'message_stop') {
        // Message completed
        break;
      }
    }

    // Send end event
    writeStreamEvent(res, {
      type: 'text',
      data: ''
    });

    res.end();
  } catch (error) {
    console.error('RAG endpoint error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (!res.headersSent) {
      res.status(500).json({ error: 'RAG processing failed', details: errorMessage });
    } else {
      writeStreamEvent(res, {
        type: 'error',
        data: {
          message: `RAG processing failed: ${errorMessage}`
        }
      });
      res.end();
    }
  }
}