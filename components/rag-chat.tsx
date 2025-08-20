'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Sparkles, Search, Eye, CheckCircle, XCircle, Clock, MessageSquare, Zap } from 'lucide-react';

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
}

interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'error';
  data: string | StreamEventData;
}

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
        return toolCall.summary ? `${toolCall.summary.resultsCount} results found` : 'Complete';
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
              </div>
            </div>
          )}

          {toolCall.result?.results && toolCall.result.results.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-600 mb-2">Top Results</div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {toolCall.result.results.slice(0, 3).map((result, idx) => (
                  <div key={idx} className="text-xs p-2 bg-slate-50/60 rounded-lg border border-slate-100">
                    <div className="font-medium text-slate-800 mb-1">
                      {result.interview_title || `Interview ${result.interview_id}`}
                    </div>
                    <div className="text-slate-600 line-clamp-2">
                      {result.paragraph_text?.substring(0, 80)}...
                    </div>
                    <div className="text-slate-500 mt-1 flex items-center gap-2">
                      <span>Score: {result.score?.toFixed(2)}</span>
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

    // Simulate API call with mock data
    setTimeout(() => {
      const mockResponse = `Based on the interview data, I can provide insights about participant experiences. The search revealed several key themes including technology adoption challenges, user interface preferences, and workflow optimization strategies. Participants consistently mentioned the importance of intuitive design and seamless integration with existing systems.`;

      setStreamingMessage(mockResponse);
      setIsLoading(false);

      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'assistant', content: mockResponse }]);
        setStreamingMessage('');
      }, 1000);
    }, 2000);
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
                    <div className={`text-sm leading-relaxed ${message.role === 'user' ? 'text-white' : 'text-slate-800'}`}>
                      {message.content}
                    </div>
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
                    <div className="text-sm leading-relaxed text-slate-800">
                      {streamingMessage}
                      <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-1 animate-pulse" />
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

