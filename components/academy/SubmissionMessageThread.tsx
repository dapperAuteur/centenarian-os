'use client';

// components/academy/SubmissionMessageThread.tsx
// Reusable message thread for assignment submissions — used by both student and teacher views.

import { useEffect, useState, useRef, useCallback } from 'react';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Message {
  id: string;
  is_teacher: boolean;
  body: string;
  created_at: string;
  profiles: { username: string; display_name: string | null } | null;
}

interface SubmissionMessageThreadProps {
  assignmentId: string;
  submissionId: string;
  isTeacher: boolean;
}

export default function SubmissionMessageThread({
  assignmentId,
  submissionId,
  isTeacher,
}: SubmissionMessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputId = `msg-input-${submissionId}`;

  const fetchMessages = useCallback(async () => {
    try {
      const r = await offlineFetch(
        `/api/academy/assignments/${assignmentId}/submissions/${submissionId}/messages`,
      );
      if (r.ok) {
        const d = await r.json();
        setMessages(Array.isArray(d) ? d : []);
      }
    } catch {
      // silently fail on refresh
    } finally {
      setLoading(false);
    }
  }, [assignmentId, submissionId]);

  // Initial fetch + auto-refresh every 30s
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 30_000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const r = await offlineFetch(
        `/api/academy/assignments/${assignmentId}/submissions/${submissionId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: newMessage.trim() }),
        },
      );
      if (r.ok) {
        const msg = await r.json();
        setMessages((prev) => [...prev, msg]);
        setNewMessage('');
      }
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-fuchsia-500" aria-label="Loading messages" />
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
      <h3 className="font-semibold text-white mb-4 flex items-center gap-2 text-sm">
        <MessageCircle className="w-4 h-4 text-fuchsia-400" aria-hidden="true" />
        Feedback Thread
      </h3>

      {/* Messages container */}
      <div role="log" aria-label="Submission message thread" className="space-y-3 mb-4 max-h-96 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-gray-600 text-sm">
            No messages yet.{' '}
            {isTeacher
              ? 'Send feedback to the student.'
              : 'Your teacher will respond here once they review your submission.'}
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = isTeacher ? msg.is_teacher : !msg.is_teacher;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'flex-row-reverse' : ''}`}>
                <div className={`max-w-sm ${isMine ? 'ml-auto' : ''}`}>
                  <div
                    className={`inline-block px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                      msg.is_teacher
                        ? 'bg-fuchsia-700/80 text-white rounded-tl-none'
                        : 'bg-gray-800 text-gray-200 rounded-tr-none'
                    }`}
                  >
                    {msg.body}
                  </div>
                  <p className={`text-gray-600 text-xs mt-1 ${isMine ? 'text-right' : ''}`}>
                    {msg.is_teacher
                      ? (msg.profiles?.display_name ?? msg.profiles?.username ?? 'Teacher')
                      : (msg.profiles?.display_name ?? msg.profiles?.username ?? 'Student')}{' '}
                    · {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 mt-2">
        <label htmlFor={inputId} className="sr-only">
          Message
        </label>
        <input
          id={inputId}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) handleSend();
          }}
          placeholder={isTeacher ? 'Send feedback...' : 'Message your teacher...'}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-fuchsia-500 min-h-11"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !newMessage.trim()}
          aria-label="Send message"
          className="min-h-11 min-w-11 flex items-center justify-center bg-fuchsia-600 text-white rounded-xl hover:bg-fuchsia-700 transition disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
