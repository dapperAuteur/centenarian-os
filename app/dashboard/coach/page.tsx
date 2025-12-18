/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/dashboard/coach/page.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GemPersona, GeminiMessage } from '@/lib/types';
import { Send, Plus, BrainCircuit, User, Loader2, Bot, MessagesSquare } from 'lucide-react';

/**
 * A component to render a single chat message
 */
function ChatMessage({ role, text }: { role: 'user' | 'model'; text: string }) {
  const isUser = role === 'user';
  
  // Apply styles consistent with your app
  return (
    <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center">
          <Bot className="w-5 h-5" />
        </div>
      )}
      <div 
        className={`max-w-xl p-4 rounded-2xl ${
          isUser 
            ? 'bg-sky-600 text-white rounded-br-lg' 
            : 'bg-gray-100 text-gray-900 rounded-bl-lg'
        }`}
      >
        {/* whitespace-pre-wrap respects newlines and spacing from the AI */}
        <p className="text-sm whitespace-pre-wrap">{text}</p>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center">
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
  
  // Sessions are the list of past chats
  type SessionStub = { id: string; created_at: string; first_message: string };
  const [sessions, setSessions] = useState<SessionStub[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<GeminiMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  
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

  // Load all Gems (for the dropdown) and session history
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
      // Default to selecting the first Gem
      if (gemRes.data.length > 0) {
        setSelectedGemId(gemRes.data[0].id);
      }
    }
    if (sessionRes.data) {
      const sessionStubs = sessionRes.data.map(s => ({
        id: s.id,
        created_at: s.created_at,
        // Get the first user message as a preview
        first_message: (s.messages as GeminiMessage[]).find(m => m.role === 'user')?.parts[0].text.substring(0, 50) + '...' || 'New Chat'
      }));
      setSessions(sessionStubs);
    }
    
    setIsLoadingGems(false);
  }, [supabase]);

  // Load full message history for a selected session
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
      setMessages(data.messages as GeminiMessage[]);
      // Automatically select the Gem this session was with
      if (data.gem_persona_id) {
        setSelectedGemId(data.gem_persona_id);
      }
    }
    setIsLoadingSession(false);
  }, [supabase]);

  // Initial load
  useEffect(() => {
    loadGemsAndSessions();
  }, [loadGemsAndSessions]);

  // Start a new chat
  const handleNewChat = () => {
    setSelectedSessionId(null);
    setMessages([]);
    setError(null);
    if (gems.length > 0) {
      setSelectedGemId(gems[0].id); // Default to first gem
    }
  };

  // Handle sending a message
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim() || isSendingMessage || !selectedGemId) return;

    setIsSendingMessage(true);
    setError(null);
    const messageText = currentInput.trim();
    setCurrentInput('');

    // Optimistic update of the user's message
    const userMessage: GeminiMessage = { role: 'user', parts: [{ text: messageText }] };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          gemPersonaId: selectedGemId,
          sessionId: selectedSessionId
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to get response');
      }

      const result = await response.json();
      
      const modelMessage: GeminiMessage = { role: 'model', parts: [{ text: result.message }] };
      setMessages(prev => [...prev, modelMessage]);

      if (!selectedSessionId && result.sessionId) {
        // This was a new chat, now we have a session ID
        setSelectedSessionId(result.sessionId);
        // Refresh session list in sidebar
        loadGemsAndSessions();
      }

    } catch (err: any) {
      setError(err.message);
      // Remove optimistic message on error? (Or add error message)
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    // Main layout
    <div className="max-w-7xl mx-auto p-6 h-[calc(100vh-100px)] flex gap-6">
      
      {/* Sidebar: Gem Selection & Session History */}
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
            disabled={isLoadingGems || !!selectedSessionId} // Lock if in a session
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
        <div className="flex-grow overflow-y-auto space-y-2">
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
      <div className="w-2/3 flex-grow bg-white rounded-2xl shadow-lg flex flex-col">
        {isLoadingGems ? (
          <div className="flex-grow flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
          </div>
        ) : gems.length === 0 ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
            <BrainCircuit className="w-16 h-16 text-sky-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No AI Gems Found</h2>
            <p className="text-gray-600">
              Please go to the &quot;Gem Manager&quot; page to create your first AI persona.
            </p>
          </div>
        ) : (
          <>
            {/* Chat Messages */}
            <div ref={chatContainerRef} className="flex-grow p-6 space-y-6 overflow-y-auto">
              {messages.length === 0 && !isLoadingSession && (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
                  <MessagesSquare className="w-16 h-16 text-gray-400 mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {gems.find(g => g.id === selectedGemId)?.name || 'AI Coach'}
                  </h2>
                  <p className="text-gray-600">
                    Start a new conversation by typing below.
                  </p>
                </div>
              )}
              {isLoadingSession && (
                <div className="flex-grow flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
                </div>
              )}
              {!isLoadingSession && messages.map((msg, index) => (
                <ChatMessage 
                  key={index} 
                  role={msg.role} 
                  text={msg.parts[0].text} 
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
              <form onSubmit={handleSubmit} className="flex items-start gap-3">
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
                  className="form-input flex-grow resize-none"
                  rows={2}
                />
                <button
                  type="submit"
                  disabled={isSendingMessage || !currentInput.trim()}
                  className="flex-shrink-0 px-4 py-2 h-full bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition font-semibold disabled:opacity-50"
                  style={{ minHeight: '52px' }} // Match textarea height
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
