'use client';

// app/admin/education/page.tsx
// Admin AI chat for codebase education — persistent sessions with search, tags, and notes.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Send, Loader2, Sparkles, Plus, Search, MessageSquare,
  Trash2, Tag, StickyNote, X, ChevronLeft,
} from 'lucide-react';
import { marked } from 'marked';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface Message {
  id?: string;
  role: 'user' | 'model';
  text: string;
}

interface Chat {
  id: string;
  mode: string;
  title: string;
  tags: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

/* ── Constants ─────────────────────────────────────────────────────────────── */

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

marked.setOptions({ breaks: true, gfm: true });
const MAX_HISTORY = 30;

function staleBadge(iso: string | null) {
  if (!iso) return { text: 'Never synced', color: 'text-red-400' };
  const hours = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (hours < 24) return { text: `Updated ${Math.round(hours)}h ago`, color: 'text-green-400' };
  const days = Math.round(hours / 24);
  if (days <= 7) return { text: `Updated ${days}d ago`, color: 'text-amber-400' };
  return { text: `Updated ${days}d ago`, color: 'text-red-400' };
}

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function AdminEducationPage() {
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('general');
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Session state
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chatList, setChatList] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Edit state for title/tags/notes
  const [editingMeta, setEditingMeta] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    fetch('/api/admin/knowledge/status')
      .then((r) => r.json())
      .then((d) => setLastSynced(d.lastSyncedAt ?? null))
      .catch(() => {});
  }, []);

  /* ── Chat list ───────────────────────────────────────────────────────────── */

  const loadChats = useCallback(async () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (filterTag) params.set('tag', filterTag);
    const res = await fetch(`/api/admin/education/chats?${params}`);
    if (res.ok) {
      const { chats } = await res.json();
      setChatList(chats);
    }
  }, [searchQuery, filterTag]);

  useEffect(() => { loadChats(); }, [loadChats]);

  /* ── Create / load / delete chat ─────────────────────────────────────────── */

  async function loadChat(chatId: string) {
    const res = await fetch(`/api/admin/education/chats/${chatId}`);
    if (res.ok) {
      const { chat, messages: msgs } = await res.json();
      setActiveChat(chat);
      setMode(chat.mode as Mode);
      setMessages(msgs.map((m: { id: string; role: 'user' | 'model'; text: string }) => ({
        id: m.id,
        role: m.role,
        text: m.text,
      })));
    }
  }

  async function deleteChat(chatId: string) {
    await fetch(`/api/admin/education/chats/${chatId}`, { method: 'DELETE' });
    if (activeChat?.id === chatId) {
      setActiveChat(null);
      setMessages([]);
    }
    loadChats();
  }

  /* ── Tags / Notes editing ────────────────────────────────────────────────── */

  function openMetaEditor() {
    if (!activeChat) return;
    setEditTitle(activeChat.title);
    setEditTags(activeChat.tags.join(', '));
    setEditNotes(activeChat.notes);
    setTagInput('');
    setEditingMeta(true);
  }

  async function saveMeta() {
    if (!activeChat) return;
    const tags = editTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const res = await fetch(`/api/admin/education/chats/${activeChat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle.trim() || activeChat.title, tags, notes: editNotes }),
    });
    if (res.ok) {
      const { chat } = await res.json();
      setActiveChat(chat);
      setEditingMeta(false);
      loadChats();
    }
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    const current = editTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (!current.includes(tag)) {
      setEditTags([...current, tag].join(', '));
    }
    setTagInput('');
  }

  /* ── Send message ────────────────────────────────────────────────────────── */

  async function sendMessage(text: string) {
    const question = text.trim();
    if (!question || loading) return;

    // Auto-create a chat session if none active
    let chatId = activeChat?.id;
    if (!chatId) {
      const res = await fetch('/api/admin/education/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (res.ok) {
        const { chat } = await res.json();
        setActiveChat(chat);
        chatId = chat.id;
        loadChats();
      }
    }

    setInput('');
    const newMessages: Message[] = [...messages, { role: 'user', text: question }];
    setMessages(newMessages);
    setLoading(true);

    const history = newMessages.slice(0, -1).slice(-MAX_HISTORY).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    try {
      const res = await fetch('/api/admin/education/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, history, mode, chatId }),
      });
      const data = await res.json();
      const reply = res.ok
        ? (data.message ?? 'No response.')
        : (data.error ?? 'Something went wrong.');
      setMessages((prev) => [...prev, { role: 'model', text: reply }]);

      // Refresh chat list to pick up auto-title
      if (newMessages.length === 1) loadChats();
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

  function startNewChat() {
    setActiveChat(null);
    setMessages([]);
  }

  /* ── All unique tags for filter ──────────────────────────────────────────── */
  const allTags = Array.from(new Set(chatList.flatMap((c) => c.tags))).sort();

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-screen">
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <div
        className={`${
          sidebarOpen ? 'w-72' : 'w-0'
        } shrink-0 border-r border-gray-800 bg-gray-950 flex flex-col transition-all duration-200 overflow-hidden`}
      >
        {/* Sidebar header */}
        <div className="p-3 border-b border-gray-800 space-y-2">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-sm font-medium rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-fuchsia-500"
            />
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {filterTag && (
                <button
                  onClick={() => setFilterTag('')}
                  className="flex items-center gap-1 px-2 py-0.5 bg-fuchsia-600/30 text-fuchsia-300 text-xs rounded-full"
                >
                  {filterTag} <X className="w-3 h-3" />
                </button>
              )}
              {!filterTag && allTags.slice(0, 8).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTag(t)}
                  className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded-full hover:bg-gray-700 hover:text-gray-200 transition"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {chatList.length === 0 && (
            <p className="text-xs text-gray-500 p-4 text-center">No chats yet</p>
          )}
          {chatList.map((chat) => (
            <div
              key={chat.id}
              onClick={() => loadChat(chat.id)}
              className={`group flex items-start gap-2 px-3 py-2.5 cursor-pointer border-b border-gray-800/50 hover:bg-gray-800/50 transition ${
                activeChat?.id === chat.id ? 'bg-gray-800' : ''
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-200 truncate">{chat.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-500">{chat.mode}</span>
                  <span className="text-[10px] text-gray-600">{relativeTime(chat.updated_at)}</span>
                </div>
                {chat.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {chat.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0 text-[10px] bg-gray-700/60 text-gray-400 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition"
                title="Delete chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main chat area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 sm:px-6 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-gray-800 transition text-gray-400"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
            </button>
            <Sparkles className="w-5 h-5 text-fuchsia-400" />
            <h1 className="text-lg font-bold text-white">Education Prep</h1>
            {(() => {
              const b = staleBadge(lastSynced);
              return <span className={`text-xs ${b.color}`}>{b.text}</span>;
            })()}

            {/* Tags / Notes button */}
            {activeChat && (
              <button
                onClick={openMetaEditor}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-fuchsia-300 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
              >
                <Tag className="w-3.5 h-3.5" />
                <StickyNote className="w-3.5 h-3.5" />
                Tags & Notes
              </button>
            )}
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

          {/* Active chat info */}
          {activeChat && activeChat.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {activeChat.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 text-[11px] bg-fuchsia-600/20 text-fuchsia-300 rounded-full">
                  {t}
                </span>
              ))}
              {activeChat.notes && (
                <span className="text-[11px] text-gray-500 ml-2 truncate max-w-xs" title={activeChat.notes}>
                  {activeChat.notes}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-fuchsia-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-800 rounded-xl rounded-tl-none px-4 py-3 text-sm text-gray-200 leading-relaxed">
                  I know your entire codebase. Ask me anything to prepare for interviews, investor meetings, team onboarding, or feature demos. Pick a mode above to get tailored guidance.
                </div>
              </div>

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
            <div key={msg.id || i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
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
              placeholder="Ask about your codebase..."
              disabled={loading}
              rows={1}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 disabled:opacity-50 resize-none"
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
            {activeChat && <span className="text-gray-600"> &middot; Chat saved</span>}
          </p>
        </div>
      </div>

      {/* ── Tags & Notes modal ─────────────────────────────────────────────── */}
      {editingMeta && activeChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingMeta(false)}>
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md mx-4 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Edit Chat</h2>
              <button onClick={() => setEditingMeta(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Title</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Chat title..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-fuchsia-500"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tags</label>
              <div className="flex flex-wrap gap-1 mb-2">
                {editTags
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 px-2 py-0.5 text-xs bg-fuchsia-600/20 text-fuchsia-300 rounded-full"
                    >
                      {t}
                      <button
                        onClick={() => {
                          const tags = editTags.split(',').map((x) => x.trim()).filter((x) => x && x !== t);
                          setEditTags(tags.join(', '));
                        }}
                        className="hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="Add tag..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-fuchsia-500"
                />
                <button onClick={addTag} className="px-3 py-1.5 bg-gray-800 text-gray-300 text-xs rounded-lg hover:bg-gray-700 transition">
                  Add
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes to help find this chat later..."
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-fuchsia-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingMeta(false)}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={saveMeta}
                className="px-4 py-2 bg-fuchsia-600 text-white text-xs font-medium rounded-lg hover:bg-fuchsia-700 transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
