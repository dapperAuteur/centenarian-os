'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2, Send, AlertTriangle, FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { document: string; union_local: string | null; section: number; similarity: number }[];
}

const DISCLAIMER = 'This is an AI-generated summary for reference only. It is not legal advice. Always consult your union representative or the official contract document for authoritative answers.';

export default function UnionChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [unionFilter, setUnionFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    const q = input.trim();
    if (!q || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    const res = await fetch('/api/contractor/union/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, union_local: unionFilter.trim() || undefined }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer, sources: data.sources },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.error ?? 'Something went wrong.' },
      ]);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-4xl flex-col p-4">
      {/* Header */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link
              href="/dashboard/contractor/union"
              className="mb-1 inline-flex items-center gap-1 min-h-11 py-2 text-sm text-neutral-500 hover:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
              aria-label="Back to documents"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Documents
            </Link>
            <h1 className="text-2xl font-bold text-neutral-100">Union Contract Chat</h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-500" htmlFor="union-filter">Filter:</label>
            <input
              id="union-filter"
              type="text"
              value={unionFilter}
              onChange={(e) => setUnionFilter(e.target.value)}
              placeholder="Union local..."
              className="w-36 rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>
        </div>

        {/* Disclaimer banner */}
        <div className="rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-2.5 flex gap-2" role="alert">
          <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-yellow-300">{DISCLAIMER}</p>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 p-4"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <div className="max-w-sm space-y-3">
              <FileText size={32} className="mx-auto text-neutral-700" aria-hidden="true" />
              <p className="text-neutral-500 text-sm">
                Ask questions about your uploaded union contracts, bylaws, and work rules.
              </p>
              <div className="space-y-1 text-xs text-neutral-500">
                <p>&quot;What&apos;s the OT threshold for my local?&quot;</p>
                <p>&quot;What are my meal penalty rights?&quot;</p>
                <p>&quot;What&apos;s the turnaround time between shifts?&quot;</p>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-amber-600 text-white'
                  : 'bg-neutral-800 text-neutral-200'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 border-t border-neutral-700 pt-2">
                  <p className="text-xs text-neutral-500 mb-1">Sources:</p>
                  <div className="space-y-0.5">
                    {msg.sources.map((s, j) => (
                      <p key={j} className="text-xs text-neutral-500">
                        {s.document}
                        {s.union_local && ` (${s.union_local})`}
                        {' '}— Section {s.section}
                        <span className="text-neutral-500"> ({Math.round(s.similarity * 100)}% match)</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-neutral-800 px-4 py-3">
              <Loader2 size={16} className="animate-spin text-neutral-500" aria-label="Loading..." />
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Ask about your union contract..."
          disabled={loading}
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50"
          aria-label="Type your question"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="min-h-11 min-w-11 flex items-center justify-center rounded-lg bg-amber-600 px-4 py-3 text-white hover:bg-amber-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
          aria-label="Send message"
        >
          {loading ? <Loader2 size={18} className="animate-spin" aria-label="Loading..." /> : <Send size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
