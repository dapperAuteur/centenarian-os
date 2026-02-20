'use client';

// components/ui/HelpDrawer.tsx
// Slide-in drawer with RAG-powered Academy help chat.

import { useEffect, useRef, useState } from 'react';
import { X, Send, Loader2, HelpCircle, BookOpen } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string; // 'student' | 'teacher' | 'admin' | undefined
}

const SUGGESTIONS = [
  'How do I enroll in a course?',
  'How do I submit an assignment?',
  'What is CYOA mode?',
  'How do I track my progress?',
];

export default function HelpDrawer({ isOpen, onClose, userRole }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => setMessages([]), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  async function sendMessage(text: string) {
    const question = text.trim();
    if (!question || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const res = await fetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, role: userRole ?? null }),
      });
      const data = await res.json();
      const answer = res.ok
        ? (data.answer ?? 'No response.')
        : (data.error ?? 'Something went wrong. Please try again.');
      setMessages((prev) => [...prev, { role: 'assistant', text: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Could not reach the help service. Please check your connection.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-sm z-50 bg-gray-950 border-l border-gray-800 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-fuchsia-400" />
            <span className="font-semibold text-white text-sm">Academy Help</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-fuchsia-600 flex items-center justify-center shrink-0 mt-0.5">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-800 rounded-xl rounded-tl-none px-4 py-3 text-sm text-gray-200 leading-relaxed">
                  Hi! I can answer questions about Centenarian Academy — how to enroll, watch lessons, submit assignments, create courses, and more. What do you need help with?
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-500 px-1">Suggested questions</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-fuchsia-600 hover:text-white transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-fuchsia-600 flex items-center justify-center shrink-0 mt-0.5">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[85%] px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-fuchsia-700/80 text-white rounded-tr-none ml-auto'
                    : 'bg-gray-800 text-gray-200 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-fuchsia-600 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className="bg-gray-800 rounded-xl rounded-tl-none px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-800 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(input); }}
              placeholder="Ask anything about the Academy…"
              disabled={loading}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="p-2.5 bg-fuchsia-600 text-white rounded-xl hover:bg-fuchsia-700 transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2 text-center">
            Answers are generated from Academy documentation.
          </p>
        </div>
      </div>
    </>
  );
}
