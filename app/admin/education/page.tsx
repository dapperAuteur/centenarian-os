'use client';

// app/admin/education/page.tsx
// Admin AI chat for codebase education — interview, pitch, onboarding, and demo prep.

import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { marked } from 'marked';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const MODES = [
  { key: 'interview', label: 'Interview' },
  { key: 'investor', label: 'Investor' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'demo', label: 'Demo' },
  { key: 'general', label: 'General' },
] as const;

type Mode = (typeof MODES)[number]['key'];

const SUGGESTIONS: Record<Mode, string[]> = {
  interview: [
    'Walk me through the system architecture and key design decisions.',
    'How does the Stripe integration handle subscriptions, webhooks, and edge cases?',
    'Explain the database design and Row-Level Security strategy.',
    'What are the most technically challenging parts of this codebase?',
  ],
  investor: [
    'Give me a 30-second elevator pitch for CentenarianOS.',
    'What is the revenue model and how does it scale?',
    'How does this platform differentiate from competitors?',
    'What is the technical moat that makes this hard to replicate?',
  ],
  onboarding: [
    'How is the project structured? Walk me through the directory layout.',
    'What are the key coding conventions and patterns used?',
    'Where do I find the API routes and how do they work?',
    'How do I add a new module to the dashboard?',
  ],
  demo: [
    'Suggest a compelling demo flow for the finance module.',
    'What features are most impressive to show in a live demo?',
    'How should I demo the AI coaching system?',
    'Create a script for a 5-minute product walkthrough.',
  ],
  general: [
    'What modules does CentenarianOS include?',
    'How does the AI integration work across the platform?',
    'Explain the LMS / Academy system architecture.',
    'What wearable integrations are supported and how do they work?',
  ],
};

// Configure marked for safe rendering
marked.setOptions({ breaks: true, gfm: true });

const MAX_HISTORY = 30;

export default function AdminEducationPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('general');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const question = text.trim();
    if (!question || loading) return;

    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', text: question }];
    setMessages(newMessages);
    setLoading(true);

    // Build history for API (last MAX_HISTORY messages, excluding the new one)
    const history = newMessages.slice(0, -1).slice(-MAX_HISTORY).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    try {
      const res = await fetch('/api/admin/education/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, history, mode }),
      });
      const data = await res.json();
      const reply = res.ok
        ? (data.message ?? 'No response.')
        : (data.error ?? 'Something went wrong.');
      setMessages((prev) => [...prev, { role: 'model', text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: 'Could not reach the AI service. Please check your connection.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function renderMarkdown(text: string) {
    return { __html: marked.parse(text) as string };
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-screen">
      {/* Header */}
      <div className="shrink-0 px-4 py-4 sm:px-6 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-6 h-6 text-fuchsia-400" />
          <h1 className="text-xl font-bold text-white">Education Prep</h1>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                mode === m.key
                  ? 'bg-fuchsia-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            {/* Welcome */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-fuchsia-600 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-800 rounded-xl rounded-tl-none px-4 py-3 text-sm text-gray-200 leading-relaxed">
                I know your entire codebase. Ask me anything to prepare for interviews, investor meetings, team onboarding, or feature demos. Pick a mode above to get tailored guidance.
              </div>
            </div>

            {/* Suggestions */}
            <div className="space-y-2">
              <p className="text-xs text-gray-400 px-1">Suggested questions</p>
              {SUGGESTIONS[mode].map((s) => (
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
            {msg.role === 'model' && (
              <div className="w-7 h-7 rounded-full bg-fuchsia-600 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
            {msg.role === 'user' ? (
              <div className="max-w-[85%] px-4 py-3 rounded-xl rounded-tr-none text-sm leading-relaxed whitespace-pre-wrap bg-fuchsia-700/80 text-white ml-auto">
                {msg.text}
              </div>
            ) : (
              <div
                className="max-w-[85%] px-4 py-3 rounded-xl rounded-tl-none text-sm leading-relaxed bg-gray-800 text-gray-200 prose prose-sm prose-invert max-w-none [&_pre]:bg-gray-900 [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-fuchsia-300 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_p]:my-1.5"
                dangerouslySetInnerHTML={renderMarkdown(msg.text)}
              />
            )}
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
      <div className="shrink-0 px-4 py-3 sm:px-6 border-t border-gray-800">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your codebase…"
            disabled={loading}
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 disabled:opacity-50 resize-none"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="p-2.5 bg-fuchsia-600 text-white rounded-xl hover:bg-fuchsia-700 transition disabled:opacity-50 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Responses are generated from a static codebase reference.
        </p>
      </div>
    </div>
  );
}
