'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Sparkles, Search, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SearchResult } from '@/lib/interview-search';
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ToolCallInput {
  query: string;
  searchType: string;
  topK?: number;
  alpha?: number;
}

interface ToolCallResult {
  results: SearchResult[];
  summary?: {
    query: string;
    searchType: string;
    resultsCount: number;
    hasError: boolean;
  };
  error?: string;
}


interface ToolCall {
  id: string;
  name: string;
  status: 'start' | 'input_update' | 'executing' | 'completed' | 'error';
  input?: ToolCallInput;
  result?: ToolCallResult;
  summary?: {
    query: string;
    searchType: string;
    resultsCount: number;
    hasError: boolean;
  };
  error?: string;
}

interface StreamEventData {
  id: string;
  name: string;
  status: 'start' | 'input_update' | 'executing' | 'completed' | 'error';
  input?: ToolCallInput;
  result?: ToolCallResult;
  summary?: {
    query: string;
    searchType: string;
    resultsCount: number;
    hasError: boolean;
  };
  message?: string;
};
interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'error';
  data: string | StreamEventData;
}

interface RAGChatProps {
  className?: string;
}

const ToolCallDisplay: React.FC<{ toolCall: ToolCall }> = ({ toolCall }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusIcon = () => {
    switch (toolCall.status) {
      case 'start':
      case 'input_update':
      case 'executing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (toolCall.status) {
      case 'start':
        return 'Initializing search...';
      case 'input_update':
        return 'Processing query...';
      case 'executing':
        return 'Searching interviews...';
      case 'completed':
        return toolCall.summary ?
          `Found ${toolCall.summary.resultsCount} results using ${toolCall.summary.searchType} search` :
          'Search completed';
      case 'error':
        return toolCall.error || 'Search failed';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = () => {
    switch (toolCall.status) {
      case 'start':
      case 'input_update':
      case 'executing':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className={`border rounded-lg p-3 my-2 ${getStatusColor()}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-2 cursor-pointer hover:bg-black/5 p-1 rounded">
            {getStatusIcon()}
            <Search className="h-4 w-4" />
            <span className="font-medium text-sm">{toolCall.name}</span>
            <Badge variant="outline" className="text-xs">
              {getStatusText()}
            </Badge>
            <Eye className="h-3 w-3 ml-auto" />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 space-y-3">
          {/* Tool Input */}
          {toolCall.input && (
            <div className="bg-white/50 rounded p-2">
              <div className="text-xs font-medium mb-1 flex items-center gap-1">
                <span>Input:</span>
                {toolCall.status === 'input_update' && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
              </div>
              <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}

          {/* Tool Result */}
          {toolCall.result && (
            <div className="bg-white/50 rounded p-2">
              <div className="text-xs font-medium mb-1">Result Summary:</div>
              {toolCall.summary && (
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <span className="font-medium">Query:</span> {toolCall.summary.query}
                  </div>
                  <div>
                    <span className="font-medium">Search Type:</span> {toolCall.summary.searchType}
                  </div>
                  <div>
                    <span className="font-medium">Results:</span> {toolCall.summary.resultsCount}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>
                    {toolCall.summary.hasError ? (
                      <span className="text-red-600 ml-1">Error</span>
                    ) : (
                      <span className="text-green-600 ml-1">Success</span>
                    )}
                  </div>
                </div>
              )}

              {toolCall.result.results && toolCall.result.results.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-medium mb-1">Top Results:</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {toolCall.result.results.map((result: SearchResult, idx: number) => (
                      <div key={idx} className="text-xs p-1 bg-gray-50 rounded">
                        <div className="font-medium">
                          {result.interview_title || `Interview ${result.interview_id}`}
                        </div>
                        <div className="text-gray-600 truncate">
                          {result.paragraph_text?.substring(0, 100)}...
                        </div>
                        <div className="text-gray-500">
                          Score: {result.score?.toFixed(3)} |
                          Participant: {result.participant_id}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {toolCall.error && (
            <div className="bg-red-50 border border-red-200 rounded p-2">
              <div className="text-xs font-medium text-red-700 mb-1">Error:</div>
              <div className="text-xs text-red-600">{toolCall.error}</div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export const RAGChat: React.FC<RAGChatProps> = ({ className = '' }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [currentToolCalls, setCurrentToolCalls] = useState<Record<string, ToolCall>>({});
  const [completedToolCalls, setCompletedToolCalls] = useState<ToolCall[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, currentToolCalls]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const newMessage: Message = { role: 'user', content: inputValue.trim() };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsLoading(true);
    setStreamingMessage('');
    setCurrentToolCalls({});
    setCompletedToolCalls([]);

    try {
      const response = await fetch('/api/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }),
      });

      if (!response.ok) {
        throw new Error(`RAG request failed: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body available');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const eventData = line.slice(6);
            if (eventData === '[DONE]') {
              continue;
            }

            try {
              const event: StreamEvent = JSON.parse(eventData);
              console.log('Received SSE event:', event);

              switch (event.type) {
                case 'text':
                  assistantMessage += event.data;
                  setStreamingMessage(assistantMessage);
                  break;

                case 'tool_call':
                  const toolCallData = event.data as StreamEventData;
                  setCurrentToolCalls(prev => ({
                    ...prev,
                    [toolCallData.id]: {
                      id: toolCallData.id,
                      name: toolCallData.name,
                      status: toolCallData.status,
                      input: toolCallData.input || prev[toolCallData.id]?.input,
                      result: prev[toolCallData.id]?.result,
                      summary: prev[toolCallData.id]?.summary,
                      error: prev[toolCallData.id]?.error
                    }
                  }));
                  break;

                case 'tool_result':
                  const toolResultData = event.data as StreamEventData;
                  setCurrentToolCalls(prev => ({
                    ...prev,
                    [toolResultData.id]: {
                      ...prev[toolResultData.id],
                      status: 'completed',
                      result: toolResultData.result,
                      summary: toolResultData.summary
                    }
                  }));

                  // Move to completed tools after a delay
                  setTimeout(() => {
                    setCurrentToolCalls(prev => {
                      const { [toolResultData.id]: completed, ...remaining } = prev;
                      if (completed) {
                        setCompletedToolCalls(prevCompleted => [...prevCompleted, completed]);
                      }
                      return remaining;
                    });
                  }, 2000);
                  break;

                case 'error':
                  const errorData = event.data as StreamEventData;
                  if (errorData.id) {
                    setCurrentToolCalls(prev => ({
                      ...prev,
                      [errorData.id]: {
                        ...prev[errorData.id],
                        status: 'error',
                        error: errorData.message
                      }
                    }));
                  } else {
                    assistantMessage += `\n\n[Error: ${errorData.message}]`;
                    setStreamingMessage(assistantMessage);
                  }
                  break;
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', eventData, e);
            }
          }
        }
      }

      // Add the complete assistant message to the conversation
      if (assistantMessage) {
        const assistantMsg: Message = { role: 'assistant', content: assistantMessage };
        setMessages(prev => [...prev, assistantMsg]);
        setStreamingMessage('');
      }

    } catch (error) {
      console.error('RAG error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setStreamingMessage('');
    setCurrentToolCalls({});
    setCompletedToolCalls([]);
    inputRef.current?.focus();
  };

  return (
    <Card className={`flex flex-col h-[700px] ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600" />
          RAG Interview Assistant
          <Sparkles className="h-4 w-4 text-yellow-500" />
        </CardTitle>
        <p className="text-sm text-gray-600">
          Ask questions about the interview data. The AI will search for relevant context and provide comprehensive answers.
        </p>
        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearChat}
            className="w-fit self-end"
          >
            Clear Chat
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.length === 0 && !streamingMessage && Object.keys(currentToolCalls).length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <Bot className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-medium mb-2">Welcome to RAG Chat!</p>
              <p className="text-sm">
                Ask me anything about the interview data. I&apos;ll search for relevant information and provide detailed answers.
              </p>
              <div className="mt-4 text-xs text-gray-400 space-y-1">
                <p>Example questions:</p>
                <p>&quot;What are the main themes discussed in the interviews?&quot;</p>
                <p>&quot;Tell me about participant experiences with technology&quot;</p>
                <p>&quot;What challenges were mentioned most frequently?&quot;</p>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Bot className="h-4 w-4 text-blue-600" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
                  }`}
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))}

          {/* Show completed tool calls for context */}
          {completedToolCalls.length > 0 && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4 text-blue-600" />
              </div>
              <div className="max-w-[80%]">
                {completedToolCalls.map((toolCall) => (
                  <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
                ))}
              </div>
            </div>
          )}

          {/* Show active tool calls */}
          {Object.keys(currentToolCalls).length > 0 && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4 text-blue-600" />
              </div>
              <div className="max-w-[80%]">
                {Object.values(currentToolCalls).map((toolCall) => (
                  <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
                ))}
              </div>
            </div>
          )}

          {/* Streaming Message */}
          {streamingMessage && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4 text-blue-600" />
              </div>
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100 text-gray-900">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {streamingMessage}
                  <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && !streamingMessage && Object.keys(currentToolCalls).length === 0 && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              </div>
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100 text-gray-900">
                <div className="text-sm text-gray-500">
                  Initializing search...
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex gap-2 pt-2 border-t">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about the interview data..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            size="sm"
            className="px-3"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RAGChat;