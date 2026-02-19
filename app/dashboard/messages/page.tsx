'use client';

// app/dashboard/messages/page.tsx
// User message inbox — shows admin messages addressed to this user

import { useEffect, useState } from 'react';
import { Bell, CheckCircle } from 'lucide-react';

interface Message {
  id: string;
  subject: string;
  body: string;
  recipient_scope: string;
  created_at: string;
  is_read: boolean;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/messages')
      .then((r) => r.json())
      .then((d) => { setMessages(d.messages ?? []); setLoading(false); });
  }, []);

  async function openMessage(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
    const msg = messages.find((m) => m.id === id);
    if (msg && !msg.is_read) {
      await fetch(`/api/messages/${id}/read`, { method: 'POST' });
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, is_read: true } : m));
    }
  }

  const unread = messages.filter((m) => !m.is_read).length;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-2">
        <Bell className="w-6 h-6 text-fuchsia-600" />
        <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
        {unread > 0 && (
          <span className="px-2 py-0.5 bg-fuchsia-600 text-white text-xs font-bold rounded-full">{unread} new</span>
        )}
      </div>
      <p className="text-gray-500 mb-8">Messages from the CentenarianOS team.</p>

      {messages.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No messages yet. Check back later!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl border transition cursor-pointer ${m.is_read ? 'bg-white border-gray-200' : 'bg-fuchsia-50 border-fuchsia-200'}`}
              onClick={() => openMessage(m.id)}
            >
              <div className="flex items-start gap-3 p-5">
                {!m.is_read && <div className="w-2 h-2 rounded-full bg-fuchsia-600 mt-1.5 flex-shrink-0" />}
                {m.is_read && <CheckCircle className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-0.5">
                    <p className={`font-semibold truncate ${m.is_read ? 'text-gray-700' : 'text-gray-900'}`}>{m.subject}</p>
                    <p className="text-xs text-gray-400 flex-shrink-0">{new Date(m.created_at).toLocaleDateString()}</p>
                  </div>
                  {expanded !== m.id && (
                    <p className="text-sm text-gray-500 truncate">{m.body.split('\n')[0]}</p>
                  )}
                </div>
              </div>

              {expanded === m.id && (
                <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                  {m.body.split('\n').map((line, i) =>
                    line.trim() === '' ? <br key={i} /> : <p key={i} className="text-gray-700 text-sm mb-2">{line}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-4">— CentenarianOS Team</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
