'use client';
import { RAGChat } from '@/components/rag-chat';

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="max-w-4xl w-full p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">RAG Chat Interface</h1>
        <RAGChat />
      </div>
    </div>
  )
}