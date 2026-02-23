'use client';

// app/dashboard/teaching/messages/page.tsx
// Teacher DM inbox: conversation list + message thread for all courses.

import { useEffect, useState, useRef } from 'react';
import {
  MessageCircle, Send, Loader2, ChevronLeft,
} from 'lucide-react';

interface Conversation {
  course_id: string;
  course_title: string;
  partner_id: string;
  partner_name: string;
  partner_avatar: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  course_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  media_url: string | null;
  is_read: boolean;
  created_at: string;
}

export default function TeacherMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConv, setActiveConv] = useState<{ courseId: string; partnerId: string; partnerName: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setUserId(d?.id ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/academy/messages')
      .then((r) => r.json())
      .then((d) => { setConversations(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeConv) return;
    setLoadingMessages(true);
    fetch(`/api/academy/courses/${activeConv.courseId}/messages?partner_id=${activeConv.partnerId}`)
      .then((r) => r.json())
      .then((d) => {
        setMessages(Array.isArray(d) ? d : []);
        setLoadingMessages(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .catch(() => setLoadingMessages(false));
  }, [activeConv]);

  async function handleSend() {
    if (!newMessage.trim() || !activeConv || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/academy/courses/${activeConv.courseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: activeConv.partnerId, body: newMessage.trim() }),
      });
      if (r.ok) {
        const msg = await r.json();
        setMessages((prev) => [...prev, msg]);
        setNewMessage('');
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch { /* ignore */ }
    setSending(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <MessageCircle className="w-6 h-6 text-fuchsia-400" /> Student Messages
      </h1>

      <div className="flex flex-col lg:flex-row gap-4 min-h-[60vh]">
        {/* Conversation list */}
        <div className={`w-full lg:w-72 shrink-0 ${activeConv ? 'hidden lg:block' : ''}`}>
          {conversations.length === 0 ? (
            <div className="text-center py-12 bg-gray-900 border border-dashed border-gray-800 rounded-xl">
              <MessageCircle className="w-10 h-10 mx-auto mb-3 text-gray-700" />
              <p className="text-gray-500 text-sm">No messages yet.</p>
              <p className="text-gray-600 text-xs mt-1">Students will message you from course pages.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => {
                const isActive = activeConv?.courseId === conv.course_id && activeConv?.partnerId === conv.partner_id;
                return (
                  <button
                    key={`${conv.course_id}:${conv.partner_id}`}
                    type="button"
                    onClick={() => setActiveConv({ courseId: conv.course_id, partnerId: conv.partner_id, partnerName: conv.partner_name })}
                    className={`w-full text-left p-3 rounded-xl transition ${
                      isActive ? 'bg-fuchsia-900/30 border border-fuchsia-700/50' : 'bg-gray-900 border border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {conv.partner_avatar ? (
                        <img src={conv.partner_avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 text-xs font-bold shrink-0">
                          {conv.partner_name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-white truncate">{conv.partner_name}</p>
                          {conv.unread_count > 0 && (
                            <span className="bg-fuchsia-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{conv.course_title}</p>
                        <p className="text-xs text-gray-600 truncate mt-0.5">{conv.last_message}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Thread */}
        <div className={`flex-1 flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden ${!activeConv ? 'hidden lg:flex' : ''}`}>
          {activeConv ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
                <button
                  type="button"
                  onClick={() => setActiveConv(null)}
                  className="lg:hidden p-1 text-gray-400 hover:text-white transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <p className="font-medium text-white text-sm">{activeConv.partnerName}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0" style={{ maxHeight: 'calc(60vh - 8rem)' }}>
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-fuchsia-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm">
                    No messages yet.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === userId;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          isMine
                            ? 'bg-fuchsia-600 text-white rounded-br-md'
                            : 'bg-gray-800 text-gray-200 rounded-bl-md'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                          <p className={`text-[10px] mt-1 ${isMine ? 'text-fuchsia-200' : 'text-gray-500'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-800 p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-fuchsia-500 min-h-11"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!newMessage.trim() || sending}
                    className="p-2.5 bg-fuchsia-600 text-white rounded-xl hover:bg-fuchsia-700 transition disabled:opacity-50 min-h-11 min-w-11 flex items-center justify-center"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
              Select a conversation to view messages
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
