'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Sparkles, Search, Eye, CheckCircle, XCircle, Clock, MessageSquare, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

interface SearchResult {
  interview_title?: string;
  interview_id: string;
  paragraph_text?: string;
  participant_id: string;
  score?: number;
}

interface ToolCallResult {
  query?: string;
  searchType?: string;
  resultsCount?: number;
  results?: SearchResult[];
  error?: string;
  details?: string;
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
}

interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'error';
  data: string | StreamEventData;
}

// Markdown Component with Custom Styling
const MarkdownContent: React.FC<{ content: string; isStreaming?: boolean }> = ({
  content,
  isStreaming = false
}) => {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headers
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-6 mb-4 text-slate-900 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold mt-5 mb-3 text-slate-800 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-4 mb-2 text-slate-700 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold mt-3 mb-2 text-slate-700 first:mt-0">
              {children}
            </h4>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="mb-3 text-slate-800 leading-relaxed last:mb-0">
              {children}
            </p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="mb-3 space-y-1 last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 space-y-1 list-decimal list-inside last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-slate-800 leading-relaxed ml-4 relative">
              <span className="absolute -left-4 text-indigo-500">•</span>
              {children}
            </li>
          ),

          // Emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-700">
              {children}
            </em>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-indigo-300 pl-4 py-2 my-3 bg-indigo-50/50 italic text-slate-700">
              {children}
            </blockquote>
          ),

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border border-slate-200 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-50">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="bg-white">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-slate-200 last:border-b-0">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-sm font-semibold text-slate-900 border-r border-slate-200 last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-sm text-slate-800 border-r border-slate-200 last:border-r-0">
              {children}
            </td>
          ),

          // Links
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2 hover:underline-offset-4 transition-all duration-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),

          // Horizontal Rule
          hr: () => (
            <hr className="my-4 border-t border-slate-200" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>

      {/* Streaming cursor */}
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-1 animate-pulse" />
      )}
    </div>
  );
};

const ToolCallDisplay: React.FC<{ toolCall: ToolCall }> = ({ toolCall }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusIcon = () => {
    switch (toolCall.status) {
      case 'start':
      case 'input_update':
      case 'executing':
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />;
      case 'completed':
        return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
      case 'error':
        return <XCircle className="h-3.5 w-3.5 text-rose-500" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  const getStatusText = () => {
    switch (toolCall.status) {
      case 'start':
        return 'Initializing...';
      case 'input_update':
        return 'Processing...';
      case 'executing':
        return 'Searching...';
      case 'completed':
        return toolCall.summary ?
          `${toolCall.summary.resultsCount} results found` :
          toolCall.result?.resultsCount ?
            `${toolCall.result.resultsCount} results found` :
            'Complete';
      case 'error':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  return (
    <div className="group relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-2 bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl cursor-pointer hover:bg-white/90 hover:border-slate-300/60 transition-all duration-200 shadow-sm"
      >
        {getStatusIcon()}
        <Search className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Interview Search</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-100/80 rounded-full">
            {getStatusText()}
          </span>
          <Eye className="h-3 w-3 text-slate-400" />
        </div>
      </div>

      {isOpen && (
        <div className="mt-2 p-3 bg-white/95 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-sm">
          {toolCall.input && (
            <div className="mb-3">
              <div className="text-xs font-medium text-slate-600 mb-1">Search Query</div>
              <div className="text-sm text-slate-800 bg-slate-50/80 p-2 rounded-lg">
                `{toolCall.input.query}`
                {toolCall.input.searchType && (
                  <div className="text-xs text-slate-600 mt-1">
                    Search type: {toolCall.input.searchType}
                    {toolCall.input.topK && ` • Top ${toolCall.input.topK} results`}
                  </div>
                )}
              </div>
            </div>
          )}

          {toolCall.result?.results && toolCall.result.results.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-600 mb-2">Top Results</div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {toolCall.result.results.map((result, idx) => (
                  <div key={idx} className="text-xs p-2 bg-slate-50/60 rounded-lg border border-slate-100">
                    <div className="font-medium text-slate-800 mb-1">
                      {result.interview_title || `Interview ${result.interview_id}`}
                    </div>
                    <div className="text-slate-600 line-clamp-2">
                      {result.paragraph_text}
                    </div>
                    <div className="text-slate-500 mt-1 flex items-center gap-2">
                      <span>Score: {result.score?.toFixed(5)}</span>
                      <span>•</span>
                      <span>ID: {result.participant_id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const RAGChat: React.FC = () => {
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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
                        setCompletedToolCalls(prevCompleted => {
                          if (!prevCompleted.some(tc => tc.id === completed.id)) {
                            return [...prevCompleted, completed];
                          }
                          return prevCompleted;
                        });
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

  const exampleQuestions = [
    "What are the main themes in the interviews?",
    "Tell me about user experience challenges",
    "What technology trends were discussed?"
  ];

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center">
                <Sparkles className="h-2.5 w-2.5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Interview Assistant</h1>
              <p className="text-sm text-slate-600">AI-powered research insights</p>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 rounded-lg transition-all duration-200"
            >
              New Chat
            </button>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {messages.length === 0 && !streamingMessage && Object.keys(currentToolCalls).length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                  <MessageSquare className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 mb-2">
                  Welcome to Interview Assistant
                </h2>
                <p className="text-slate-600 mb-8 max-w-md">
                  Ask me anything about your interview data. I will search through conversations and provide detailed insights.
                </p>

                <div className="grid gap-3 w-full max-w-lg">
                  <div className="text-sm font-medium text-slate-700 mb-2">Try asking:</div>
                  {exampleQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => setInputValue(question)}
                      className="group p-4 bg-white/80 hover:bg-white border border-slate-200/60 hover:border-slate-300/60 rounded-xl text-left transition-all duration-200 hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Zap className="h-4 w-4 text-indigo-500 group-hover:text-indigo-600 transition-colors" />
                        <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
                          {question}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className="flex-shrink-0">
                    {message.role === 'assistant' ? (
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>

                  <div
                    className={`max-w-3xl ${message.role === 'user'
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                      : 'bg-white border border-slate-200/60'
                      } rounded-2xl px-5 py-4 shadow-sm`}
                  >
                    {message.role === 'user' ? (
                      <div className="text-sm leading-relaxed text-white">
                        {message.content}
                      </div>
                    ) : (
                      <div className="text-sm leading-relaxed">
                        <MarkdownContent content={message.content} />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Tool Calls */}
              {(Object.keys(currentToolCalls).length > 0 || completedToolCalls.length > 0) && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    {Object.values(currentToolCalls).map((toolCall) => (
                      <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
                    ))}
                    {completedToolCalls.map((toolCall) => (
                      <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
                    ))}
                  </div>
                </div>
              )}

              {/* Streaming Message */}
              {streamingMessage && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="max-w-3xl bg-white border border-slate-200/60 rounded-2xl px-5 py-4 shadow-sm">
                    <div className="text-sm leading-relaxed">
                      <MarkdownContent content={streamingMessage} isStreaming={true} />
                    </div>
                  </div>
                </div>
              )}

              {/* Loading */}
              {isLoading && !streamingMessage && Object.keys(currentToolCalls).length === 0 && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200/60 rounded-2xl px-5 py-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150" />
                      </div>
                      <span className="text-sm text-slate-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="flex-shrink-0 px-6 py-4 bg-white/80 backdrop-blur-sm border-t border-slate-200/60">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <div className="relative">
                  <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about the interview data..."
                    disabled={isLoading}
                    className="w-full px-4 py-3 pr-12 bg-white border border-slate-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200 text-sm placeholder-slate-500 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <button
                      onClick={sendMessage}
                      disabled={!inputValue.trim() || isLoading}
                      className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 rounded-lg flex items-center justify-center transition-all duration-200 shadow-sm disabled:shadow-none group"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 text-white animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

