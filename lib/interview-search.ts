import Turbopuffer from '@turbopuffer/turbopuffer';
import OpenAI from 'openai';
import { RankByVector, RankByText, Row, Filter } from '@turbopuffer/turbopuffer/resources';

// Types for the interview search system
export interface SearchResult {
  id: string | number;
  score: number;
  interview_id?: string;
  participant_id?: string;
  interview_title?: string;
  paragraph_title?: string;
  paragraph_text?: string;
}

export interface VectorSearchResult extends SearchResult {
  vector_score?: number;
  keyword_score?: number;
}

interface FilterOptions {
  interview_id?: string;
  participant_id?: string;
  [key: string]: string | undefined;
}

// Placeholder for embedding generation function
// You'll need to implement this based on your embedding service (OpenAI, Cohere, etc.)
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const openaiClient = await new OpenAI();

  const response = await openaiClient.embeddings.create({
    input: texts,
    model: 'text-embedding-ada-002'
  });

  return response.data.map(item => item.embedding);
}

export class InterviewSearchSystem {
  private client: Turbopuffer;
  private namespace: ReturnType<Turbopuffer['namespace']>;

  constructor(apiKey?: string, baseURL?: string) {
    /**
     * Initialize the Turbopuffer client for interview data indexing and search.
     * 
     * @param apiKey - Turbopuffer API key (defaults to environment variable)
     * @param baseURL - Turbopuffer base URL (default: https://api.turbopuffer.com)
     */
    this.client = new Turbopuffer({
      apiKey: apiKey || process.env.TURBOPUFFER_API_KEY,
      baseURL: baseURL || process.env.TURBOPUFFER_BASE_URL || 'https://api.turbopuffer.com',
    });

    const namespaceName = '2025_aug_interview_contextualized';
    this.namespace = this.client.namespace(namespaceName);
  }

  async vectorSearch(
    queryText: string,
    filters?: FilterOptions,
    topK = 10
  ): Promise<SearchResult[]> {
    /**
     * Perform vector similarity search on interview data.
     * 
     * @param queryText - Text of the search query
     * @param filters - Optional filters to apply (e.g., interview_id, participant_id)
     * @param topK - Number of results to return
     * 
     * @returns List of similar documents with similarity scores
     */
    const queryVector = (await generateEmbeddings([queryText]))[0];

    // Build filter array from object
    const filterArray = filters ? this.buildFilterArray(filters) : undefined;

    const result = await this.namespace.query({
      rank_by: ['vector', 'ANN', queryVector],
      top_k: topK,
      filters: filterArray,
      include_attributes: [
        'interview_id',
        'participant_id',
        'interview_title',
        'paragraph_title',
        'paragraph_text'
      ]
    });

    return result.rows?.map((row: Row) => ({
      id: row.id,
      score: 1 - (row.$dist || 0),
      interview_id: row.interview_id as string,
      participant_id: row.participant_id as string,
      interview_title: row.interview_title as string,
      paragraph_title: row.paragraph_title as string,
      paragraph_text: row.paragraph_text as string,
    })) || [];
  }

  async keywordSearch(
    queryText: string,
    filters?: FilterOptions,
    topK = 10,
    boostTitle = 2.0
  ): Promise<SearchResult[]> {
    /**
     * Perform BM25 full-text search on interview data.
     * 
     * @param queryText - Text query for keyword search
     * @param filters - Optional filters to apply
     * @param topK - Number of results to return
     * @param boostTitle - Multiplier for title field relevance
     * 
     * @returns List of relevant documents with BM25 scores
     */
    // Build filter array from object
    const filterArray = filters ? this.buildFilterArray(filters) : undefined;

    // Multi-field BM25 search with title boosting
    const rankBy = [
      'Sum',
      [
        ['Product', [boostTitle, ['interview_title', 'BM25', queryText]]],
        ['Product', [boostTitle, ['paragraph_title', 'BM25', queryText]]],
        ['paragraph_text', 'BM25', queryText]
      ]
    ];

    const result = await this.namespace.query({
      rank_by: rankBy as RankByText,
      top_k: topK,
      filters: filterArray,
      include_attributes: [
        'interview_id',
        'participant_id',
        'interview_title',
        'paragraph_title',
        'paragraph_text'
      ]
    });

    return result.rows?.map((row: Row) => ({
      id: row.id,
      score: row.$dist || 0,
      interview_id: row.interview_id as string,
      participant_id: row.participant_id as string,
      interview_title: row.interview_title as string,
      paragraph_title: row.paragraph_title as string,
      paragraph_text: row.paragraph_text as string,
    })) || [];
  }

  async hybridSearch(
    queryText: string,
    filters?: FilterOptions,
    topK = 10,
    alpha = 0.5
  ): Promise<VectorSearchResult[]> {
    /**
     * Perform hybrid search combining vector similarity and BM25 keyword search.
     * 
     * @param queryText - Text query for search
     * @param filters - Optional filters to apply
     * @param topK - Number of results to return per search type
     * @param alpha - Weight for combining scores (0.0 = only keyword, 1.0 = only vector)
     * 
     * @returns List of documents with combined relevance scores
     */
    const queryVector = (await generateEmbeddings([queryText]))[0];

    // Build filter array from object
    const filterArray = filters ? this.buildFilterArray(filters) : undefined;

    // Use multi-query for efficient hybrid search
    const multiQuery = [
      {
        label: 'vector_search',
        rank_by: ['vector', 'ANN', queryVector] as RankByVector,
        top_k: Math.ceil(topK * alpha),
        filters: filterArray,
        include_attributes: [
          'interview_id',
          'participant_id',
          'interview_title',
          'paragraph_title',
          'paragraph_text'
        ]
      },
      {
        label: 'keyword_search',
        rank_by: [
          'Sum',
          [
            ['paragraph_text', 'BM25', queryText]
          ]
        ] as [
            "Sum",
            RankByText[]
          ],
        top_k: Math.ceil(topK * (1 - alpha)),
        filters: filterArray,
        include_attributes: [
          'interview_id',
          'participant_id',
          'interview_title',
          'paragraph_title',
          'paragraph_text'
        ]
      }
    ];

    const result = await this.namespace.multiQuery({
      queries: multiQuery
    });

    // Combine results using weighted scoring
    const combinedResults: { [id: string]: VectorSearchResult } = {};

    // Process vector search results
    if (result.results && result.results[0]) {
      for (const row of result.results[0]?.rows as Row[]) {
        const docId = row?.id.toString();
        const vectorScore = 1 - (row?.$dist || 0); // Convert distance to similarity

        combinedResults[docId] = {
          id: row.id,
          vector_score: vectorScore,
          keyword_score: 0.0,
          score: alpha * vectorScore,
          interview_id: row.interview_id as string,
          participant_id: row.participant_id as string,
          interview_title: row.interview_title as string,
          paragraph_title: row.paragraph_title as string,
          paragraph_text: row.paragraph_text as string,
        };
      }
    }

    // Process keyword search results
    if (result.results && result.results[1]) {
      for (const row of result.results[1].rows as Row[]) {
        const docId = row.id.toString();
        const keywordScore = row.$dist || 0;

        if (combinedResults[docId]) {
          combinedResults[docId].keyword_score = keywordScore;
          combinedResults[docId].score = (
            alpha * combinedResults[docId].vector_score! +
            (1 - alpha) * keywordScore
          );
        } else {
          combinedResults[docId] = {
            id: row.id,
            vector_score: 0.0,
            keyword_score: keywordScore,
            score: (1 - alpha) * keywordScore,
            interview_id: row.interview_id as string,
            participant_id: row.participant_id as string,
            interview_title: row.interview_title as string,
            paragraph_title: row.paragraph_title as string,
            paragraph_text: row.paragraph_text as string,
          };
        }
      }
    }

    // Sort by combined score and return top results
    const sortedResults = Object.values(combinedResults)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return sortedResults;
  }

  private buildFilterArray(filters: FilterOptions): Filter | undefined {
    /**
     * Convert filter object to Turbopuffer filter array format
     */
    const filterConditions: [string, "Eq", string][] = Object.entries(filters)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, 'Eq', value as string]);

    if (filterConditions.length === 0) {
      return undefined;
    }
    if (filterConditions.length === 1) {
      return filterConditions[0];
    } else {
      return ['And', filterConditions];
    }
  }
}

// Example usage for Next.js
export default InterviewSearchSystem;
