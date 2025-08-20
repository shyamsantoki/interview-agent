'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, FileText, User, MessageSquare, Sparkles, Zap, Brain, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

// Types
interface SearchResult {
  id: string | number;
  score: number;
  interview_id?: string;
  participant_id?: string;
  interview_title?: string;
  paragraph_title?: string;
  paragraph_text?: string;
  vector_score?: number;
  keyword_score?: number;
}

type SearchType = 'hybrid' | 'vector' | 'keyword';

// Search service abstraction
class SearchService {
  private static async makeRequest(endpoint: string, data: any) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    return response.json();
  }

  static async search(params: {
    query: string;
    searchType: SearchType;
    topK: number;
    alpha: number;
    filters?: Record<string, any>;
  }) {
    return this.makeRequest('/api/search', params);
  }
}

const InterviewSearchFrontend: React.FC = () => {
  const [query, setQuery] = useState('');
  const [chunks, setChunks] = useState<SearchResult[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState<SearchType>('hybrid');
  const [alpha, setAlpha] = useState([0.5]);
  const [topK, setTopK] = useState('10');
  const [error, setError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const performSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      const data = await SearchService.search({
        query: query.trim(),
        searchType,
        topK: parseInt(topK),
        alpha: alpha[0],
        filters: {}
      });

      setChunks(data.chunks || []);
      setInterviews(data.interviews || []);
      setSearchTime(Date.now() - startTime);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setChunks([]);
      setInterviews([]);
      setSearchTime(null);
    } finally {
      setLoading(false);
    }
  }, [query, searchType, topK, alpha]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  const getSearchTypeConfig = (type: SearchType) => {
    const configs = {
      vector: { icon: Brain, label: 'Semantic', color: 'text-blue-600', bg: 'bg-blue-50' },
      keyword: { icon: Zap, label: 'Keyword', color: 'text-yellow-600', bg: 'bg-yellow-50' },
      hybrid: { icon: Sparkles, label: 'Hybrid', color: 'text-purple-600', bg: 'bg-purple-50' }
    };
    return configs[type];
  };

  const formatScore = (score: number) => (score).toFixed(1);

  const highlightText = (text: string, query: string) => {
    if (!query.trim() || searchType === 'vector') return text;

    const words = query.trim().split(/\s+/);
    let highlighted = text;

    words.forEach(word => {
      const regex = new RegExp(`(${word})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200/60 px-0.5 rounded-sm">$1</mark>');
    });

    return highlighted;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Elegant Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-6">
            <Search className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 bg-clip-text text-transparent mb-4">
            Interview Intelligence
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Discover insights across interview transcripts with AI-powered semantic search,
            keyword matching, and intelligent hybrid algorithms
          </p>
        </div>

        {/* Sophisticated Search Interface */}
        <Card className="backdrop-blur-sm bg-white/80 border-white/20 shadow-2xl mb-8">
          <CardContent className="p-8">
            {/* Main Search Input */}
            <div className="relative mb-8">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What insights are you looking for?"
                className="pl-10 pr-4 py-6 text-lg"
                disabled={loading}
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-500 animate-spin" />
              )}
            </div>

            {/* Advanced Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
              {/* Search Method Selection */}
              <div className="lg:col-span-5">
                <Label className="text-sm font-semibold text-gray-700 mb-3 block">
                  Search Method
                </Label>
                <RadioGroup
                  value={searchType}
                  onValueChange={(value) => setSearchType(value as SearchType)} // ✅ cast
                  className="grid grid-cols-3 gap-3"
                >
                  {(["vector", "keyword", "hybrid"] as const).map((type) => {
                    const config = getSearchTypeConfig(type);
                    const Icon = config.icon;
                    return (
                      <div
                        key={type}
                        className={`relative rounded-lg border-2 p-3 cursor-pointer transition-all ${searchType === type
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-accent"
                          }`}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value={type} id={type} />
                          <Label
                            htmlFor={type}
                            className="flex items-center space-x-2 cursor-pointer"
                          >
                            <Icon
                              className={`w-4 h-4 ${searchType === type ? "text-primary" : "text-muted-foreground"
                                }`}
                            />
                            <span className="text-sm font-medium">{config.label}</span>
                          </Label>
                        </div>
                      </div>
                    );
                  })}
                </RadioGroup>

              </div>

              {/* Results Count */}
              <div className="lg:col-span-2">
                <Label className="text-sm font-semibold text-gray-700 mb-3 block">
                  Results
                </Label>
                <Select value={topK} onValueChange={setTopK}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select results" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 results</SelectItem>
                    <SelectItem value="10">10 results</SelectItem>
                    <SelectItem value="20">20 results</SelectItem>
                    <SelectItem value="50">50 results</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Hybrid Balance Control */}
              <div className={`lg:col-span-3 ${searchType === 'hybrid' ? 'opacity-100' : 'opacity-50'}`}>
                <Label className="text-sm font-semibold text-gray-700 mb-3 block">
                  Search Balance
                </Label>
                <div className="space-y-3">
                  <Slider
                    value={alpha}
                    onValueChange={setAlpha}
                    max={1}
                    min={0}
                    step={0.1}
                    disabled={searchType !== 'hybrid'}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Keyword</span>
                    <span className="font-medium">{Math.round(alpha[0] * 100)}% Semantic</span>
                    <span>Semantic</span>
                  </div>
                </div>
              </div>

              {/* Search Action */}
              <div className="lg:col-span-2">
                <Button
                  onClick={performSearch}
                  disabled={loading || !query.trim()}
                  size="lg"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Searching
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Search Tips */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Target className="w-4 h-4" />
                <span className="font-medium">Pro tip:</span>
                <span>Use semantic search for concepts, keyword for exact terms, or hybrid for best of both</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-destructive/50 bg-destructive/5 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 text-destructive">
                <div className="w-2 h-2 bg-destructive rounded-full"></div>
                <span className="font-medium">Search Error:</span>
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Interviews Section */}
        {interviews.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4">Interviews ({interviews.length})</h2>
            <div className="space-y-4">
              {interviews.map(iv => (
                <Card key={iv.id} className="border-blue-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">Interview ID: {iv.id}</div>
                      {iv.participant_id && <Badge variant="outline">Participant {iv.participant_id}</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <details className="text-sm space-y-2">
                      <summary className="cursor-pointer text-blue-600">Transcript</summary>
                      <pre className="whitespace-pre-wrap text-xs max-h-80 overflow-auto p-2 bg-muted rounded-md">{iv.editedTranscript}
                      </pre>
                    </details>
                    {iv.aiGeneratedDocument && (
                      <details className="text-sm mt-4 space-y-2">
                        <summary className="cursor-pointer text-purple-600">AI Generated Document</summary>
                        <pre className="whitespace-pre-wrap text-xs max-h-80 overflow-auto p-2 bg-muted rounded-md">{iv.aiGeneratedDocument}
                        </pre>
                      </details>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}


        {/* Results Header */}
        {chunks.length > 0 && (
          <div className="flex items-center justify-between mb-6 mt-12">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold mb-4">Chunks ({chunks.length})</h2>
            </div>
          </div>
        )}

        {/* Elegant Results Display */}
        <div className="space-y-4">
          {chunks.map((result, index) => (
            <Card key={result.id} className="backdrop-blur-sm bg-white/90 border-white/20 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                {/* Result Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">
                          {result.interview_title || 'Untitled Interview'}
                        </h3>
                        {result.participant_id && (
                          <div className="flex items-center space-x-1 text-sm text-muted-foreground mt-1">
                            <User className="w-3 h-3" />
                            <span>Participant {result.participant_id}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {result.paragraph_title && (
                      <Badge variant="outline" className="mb-3">
                        {result.paragraph_title}
                      </Badge>
                    )}
                  </div>

                  {/* Sophisticated Score Display */}
                  <div className="text-right">
                    <div className="relative">
                      <div className="text-2xl font-bold bg-gradient-to-br from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        {formatScore(result.score)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">relevance</div>
                    </div>

                    {searchType === 'hybrid' && result.vector_score !== undefined && result.keyword_score !== undefined && (
                      <div className="mt-3 space-y-1 text-xs">
                        <div className="flex items-center justify-between space-x-2">
                          <span className="text-muted-foreground">Semantic:</span>
                          <span className="font-medium text-blue-600">{formatScore(result.vector_score)}</span>
                        </div>
                        <div className="flex items-center justify-between space-x-2">
                          <span className="text-muted-foreground">Keyword:</span>
                          <span className="font-medium text-purple-600">{formatScore(result.keyword_score)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content with Elegant Typography */}
                {result.paragraph_text && (
                  <div className="prose prose-gray max-w-none">
                    <div className="flex items-start space-x-3">
                      <div className="p-1.5 bg-muted rounded-lg mt-1">
                        <MessageSquare className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <p
                        className="text-foreground leading-relaxed text-base"
                        dangerouslySetInnerHTML={{
                          __html: highlightText(result.paragraph_text.replace(/</g, '{').replace(/>/g, '}'), query)
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Metadata Footer */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                    {result.interview_id && (
                      <Badge variant="secondary">
                        ID: {result.interview_id}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Result #{index + 1}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Elegant Empty States */}
        {!loading && chunks.length === 0 && query && !error && (
          <Card className="backdrop-blur-sm bg-white/80 border-white/20">
            <CardContent className="text-center py-16">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">No Results Found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                We couldn't find any interviews matching your search. Try adjusting your query or changing the search method.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Welcome State */}
        {!query && chunks.length === 0 && (
          <Card className="backdrop-blur-sm bg-white/80 border-white/20">
            <CardContent className="text-center py-16">
              <div className="flex justify-center space-x-4 mb-8">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Brain className="w-6 h-6 text-blue-600" />
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-4">
                Ready to Explore Interview Insights
              </h3>
              <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
                Enter your search query above to discover relevant insights from interview transcripts
                using our advanced AI-powered search capabilities.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default InterviewSearchFrontend;