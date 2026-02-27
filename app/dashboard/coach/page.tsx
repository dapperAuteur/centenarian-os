/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/dashboard/coach/page.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GemPersona, GeminiMessage, ActionResult, AttachmentMeta } from '@/lib/types';
import {
  Send, Plus, BrainCircuit, User, Loader2, Bot,
  MessagesSquare, Database, Zap, CheckCircle2, XCircle,
  Paperclip, X as XIcon, FileText, Image as ImageIcon,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const ACCEPTED_TYPES = '.csv,.txt,.md,.pdf,.png,.jpg,.jpeg,.webp,.gif';

// ── Pending file type ────────────────────────────────────────────────
interface PendingFile {
  file: File;
  name: string;
  mimeType: string;
  size: number;
}

/**
 * Renders a single action result card
 */
function ActionResultCard({ action }: { action: ActionResult }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
        action.success
          ? 'bg-green-50 border border-green-200 text-green-800'
          : 'bg-red-50 border border-red-200 text-red-800'
      }`}
    >
      {action.success ? (
        <CheckCircle2 className="w-4 h-4 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 shrink-0" />
      )}
      <span className="font-medium">
        {action.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}:
      </span>
      <span>{action.message}</span>
    </div>
  );
}

/**
 * A component to render a single chat message
 */
function ChatMessage({
  role, text, actions, attachments,
}: {
  role: 'user' | 'model';
  text: string;
  actions?: ActionResult[];
  attachments?: AttachmentMeta[];
}) {
  const isUser = role === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center">
          <Bot className="w-5 h-5" />
        </div>
      )}
      <div className="max-w-xl space-y-2">
        {/* Attachment badges */}
        {attachments && attachments.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 ${isUser ? 'justify-end' : ''}`}>
            {attachments.map((att, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-sky-50 text-sky-700 rounded-full border border-sky-200"
              >
                {att.mimeType.startsWith('image/') ? (
                  <ImageIcon className="w-3 h-3" />
                ) : (
                  <Paperclip className="w-3 h-3" />
                )}
                {att.name}
              </span>
            ))}
          </div>
        )}
        <div
          className={`p-4 rounded-2xl ${
            isUser
              ? 'bg-sky-600 text-white rounded-br-lg'
              : 'bg-gray-100 text-gray-900 rounded-bl-lg'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{text}</p>
        </div>
        {actions && actions.length > 0 && (
          <div className="space-y-1">
            {actions.map((action, i) => (
              <ActionResultCard key={i} action={action} />
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center">
          <User className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}

/**
 * Main AI Coach Page
 */
export default function CoachPage() {
  const [gems, setGems] = useState<GemPersona[]>([]);
  const [selectedGemId, setSelectedGemId] = useState<string>('');

  type SessionStub = { id: string; created_at: string; first_message: string };
  const [sessions, setSessions] = useState<SessionStub[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Messages now include optional action results and attachments
  type MessageWithActions = GeminiMessage & { actions?: ActionResult[] };
  const [messages, setMessages] = useState<MessageWithActions[]>([]);
  const [currentInput, setCurrentInput] = useState('');

  // File attachments
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoadingGems, setIsLoadingGems] = useState(true);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const loadGemsAndSessions = useCallback(async () => {
    setIsLoadingGems(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setIsLoadingGems(false);
      return;
    }

    const [gemRes, sessionRes] = await Promise.all([
      supabase.from('gem_personas').select('*').eq('user_id', user.id).order('name'),
      supabase.from('language_coach_sessions').select('id, created_at, messages').eq('user_id', user.id).order('created_at', { ascending: false })
    ]);

    if (gemRes.data) {
      setGems(gemRes.data);
      if (gemRes.data.length > 0) {
        setSelectedGemId(gemRes.data[0].id);
      }
    }
    if (sessionRes.data) {
      const sessionStubs = sessionRes.data.map(s => ({
        id: s.id,
        created_at: s.created_at,
        first_message: (s.messages as GeminiMessage[]).find(m => m.role === 'user')?.parts[0].text.substring(0, 50) + '...' || 'New Chat'
      }));
      setSessions(sessionStubs);
    }

    setIsLoadingGems(false);
  }, [supabase]);

  const loadChatSession = useCallback(async (sessionId: string) => {
    if (!sessionId) return;

    setIsLoadingSession(true);
    setSelectedSessionId(sessionId);

    const { data, error: sessionError } = await supabase
      .from('language_coach_sessions')
      .select('messages, gem_persona_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !data) {
      setError('Could not load session.');
      setMessages([]);
    } else {
      setMessages(data.messages as MessageWithActions[]);
      if (data.gem_persona_id) {
        setSelectedGemId(data.gem_persona_id);
      }
    }
    setIsLoadingSession(false);
  }, [supabase]);

  useEffect(() => {
    loadGemsAndSessions();
  }, [loadGemsAndSessions]);

  const handleNewChat = () => {
    setSelectedSessionId(null);
    setMessages([]);
    setPendingFiles([]);
    setError(null);
    if (gems.length > 0) {
      setSelectedGemId(gems[0].id);
    }
  };

  // ── File handling ──────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;

    const remaining = MAX_FILES - pendingFiles.length;
    const toAdd = selected.slice(0, remaining);

    const valid: PendingFile[] = [];
    for (const file of toAdd) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" exceeds 10MB limit`);
        continue;
      }
      valid.push({ file, name: file.name, mimeType: file.type, size: file.size });
    }
    setPendingFiles(prev => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ── Message submission ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim() || isSendingMessage || !selectedGemId) return;

    setIsSendingMessage(true);
    setError(null);
    const messageText = currentInput.trim();
    const filesToSend = [...pendingFiles];
    setCurrentInput('');
    setPendingFiles([]);

    // Build optimistic user message with attachment metadata
    const userMessage: MessageWithActions = {
      role: 'user',
      parts: [{ text: messageText }],
      ...(filesToSend.length > 0 && {
        attachments: filesToSend.map(f => ({
          name: f.name,
          mimeType: f.mimeType,
          size: f.size,
        })),
      }),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      let response: Response;

      if (filesToSend.length > 0) {
        // Use FormData for multipart upload
        const formData = new FormData();
        formData.append('message', messageText);
        formData.append('gemPersonaId', selectedGemId);
        if (selectedSessionId) formData.append('sessionId', selectedSessionId);
        for (const pf of filesToSend) {
          formData.append('files', pf.file);
        }
        response = await fetch('/api/coach', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Standard JSON request (backward compatible)
        response = await fetch('/api/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageText,
            gemPersonaId: selectedGemId,
            sessionId: selectedSessionId
          })
        });
      }

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to get response');
      }

      const result = await response.json();

      const modelMessage: MessageWithActions = {
        role: 'model',
        parts: [{ text: result.message }],
        actions: result.actions,
      };
      setMessages(prev => [...prev, modelMessage]);

      if (!selectedSessionId && result.sessionId) {
        setSelectedSessionId(result.sessionId);
        loadGemsAndSessions();
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const selectedGem = gems.find(g => g.id === selectedGemId);

  return (
    <div className="max-w-7xl mx-auto p-6 h-[calc(100vh-100px)] flex gap-6">

      {/* Sidebar */}
      <div className="w-1/3 max-w-sm bg-white rounded-2xl shadow-lg p-4 flex flex-col">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Coach</h2>

        <button
          onClick={handleNewChat}
          className="flex items-center justify-center w-full px-4 py-2 mb-4 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition font-semibold"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Chat
        </button>

        <div className="mb-4">
          <label htmlFor="gem-select" className="block text-sm font-medium text-gray-700 mb-1">
            Select Gem
          </label>
          <select
            id="gem-select"
            value={selectedGemId}
            onChange={e => setSelectedGemId(e.target.value)}
            disabled={isLoadingGems || !!selectedSessionId}
            className="form-input"
          >
            {isLoadingGems && <option>Loading Gems...</option>}
            {gems.length === 0 && !isLoadingGems && <option>No Gems found</option>}
            {gems.map(gem => (
              <option key={gem.id} value={gem.id}>{gem.name}</option>
            ))}
          </select>
          {selectedSessionId && (
            <p className="text-xs text-gray-500 mt-1">
              Start a new chat to change Gems.
            </p>
          )}
        </div>

        <h3 className="text-lg font-semibold text-gray-800 mb-2 border-t pt-4">History</h3>
        <div className="grow overflow-y-auto space-y-2">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => loadChatSession(session.id)}
              className={`w-full text-left p-3 rounded-lg transition ${
                selectedSessionId === session.id
                  ? 'bg-sky-100 border-sky-500'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <p className="text-sm font-medium text-gray-900 truncate">{session.first_message}</p>
              <p className="text-xs text-gray-500">{new Date(session.created_at).toLocaleString()}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="w-2/3 grow bg-white rounded-2xl shadow-lg flex flex-col">
        {isLoadingGems ? (
          <div className="grow flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
          </div>
        ) : gems.length === 0 ? (
          <div className="grow flex flex-col items-center justify-center text-center p-8">
            <BrainCircuit className="w-16 h-16 text-sky-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No AI Gems Found</h2>
            <p className="text-gray-600">
              Please go to the &quot;Gem Manager&quot; page to create your first AI persona.
            </p>
          </div>
        ) : (
          <>
            {/* Data source badges header */}
            {selectedGem && (selectedGem.data_sources?.length > 0 || selectedGem.can_take_actions) && (
              <div className="px-6 py-3 border-b flex items-center gap-2 flex-wrap">
                {selectedGem.data_sources?.length > 0 && (
                  <>
                    <Database className="w-4 h-4 text-gray-400" />
                    {selectedGem.data_sources.map((src) => (
                      <span
                        key={src}
                        className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
                      >
                        {src}
                      </span>
                    ))}
                  </>
                )}
                {selectedGem.can_take_actions && (
                  <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded flex items-center gap-0.5">
                    <Zap className="w-3 h-3" />
                    actions enabled
                  </span>
                )}
              </div>
            )}

            {/* Chat Messages */}
            <div ref={chatContainerRef} className="grow p-6 space-y-6 overflow-y-auto">
              {messages.length === 0 && !isLoadingSession && (
                <div className="grow flex flex-col items-center justify-center text-center p-8">
                  <MessagesSquare className="w-16 h-16 text-gray-400 mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {selectedGem?.name || 'AI Coach'}
                  </h2>
                  <p className="text-gray-600">
                    Start a new conversation by typing below.
                  </p>
                </div>
              )}
              {isLoadingSession && (
                <div className="grow flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
                </div>
              )}
              {!isLoadingSession && messages.map((msg, index) => (
                <ChatMessage
                  key={index}
                  role={msg.role}
                  text={msg.parts[0].text}
                  actions={msg.actions}
                  attachments={msg.attachments}
                />
              ))}
            </div>

            {/* Input Area */}
            <div className="p-6 border-t bg-gray-50 rounded-b-2xl">
              {error && (
                <div className="bg-red-100 border border-red-300 text-red-700 p-3 rounded-lg mb-4 text-sm">
                  <strong>Error:</strong> {error}
                </div>
              )}

              {/* Pending file preview strip */}
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {pendingFiles.map((pf, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1.5 rounded-lg text-sm border border-gray-200"
                    >
                      {pf.mimeType.startsWith('image/') ? (
                        <ImageIcon className="w-3.5 h-3.5 text-gray-500" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-gray-500" />
                      )}
                      <span className="text-gray-700 max-w-35 truncate">{pf.name}</span>
                      <span className="text-gray-400 text-xs">
                        ({pf.size < 1024 ? `${pf.size}B` : `${(pf.size / 1024).toFixed(0)}KB`})
                      </span>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-gray-400 hover:text-red-500 transition"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex items-start gap-3">
                {/* Attach button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSendingMessage || pendingFiles.length >= MAX_FILES}
                  className="shrink-0 p-2 mt-1 text-gray-400 hover:text-sky-600 transition disabled:opacity-30 rounded-lg hover:bg-gray-100"
                  title="Attach files (CSV, PDF, images, text)"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_TYPES}
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <textarea
                  value={currentInput}
                  onChange={e => setCurrentInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  disabled={isSendingMessage}
                  placeholder="Send a message..."
                  className="form-input grow resize-none"
                  rows={2}
                />
                <button
                  type="submit"
                  disabled={isSendingMessage || !currentInput.trim()}
                  className="shrink-0 px-4 py-2 h-full bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition font-semibold disabled:opacity-50"
                  style={{ minHeight: '52px' }}
                >
                  {isSendingMessage ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
