'use client';

// app/live/page.tsx
// CentOS Team live sessions — public page with Viloud.tv embed support.

import { useEffect, useState } from 'react';
import { Radio, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

interface LiveSession {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  embed_code: string;
  is_live: boolean;
}

export default function LivePage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/live?host_type=centos_team')
      .then((r) => r.json())
      .then((d) => { setSessions(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Auto-expand the first live session
  useEffect(() => {
    const live = sessions.find((s) => s.is_live);
    if (live) setExpanded(live.id);
  }, [sessions]);

  const liveSessions = sessions.filter((s) => s.is_live);
  const upcomingSessions = sessions.filter((s) => !s.is_live);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <Radio className="w-6 h-6 text-red-500" />
            <h1 className="text-3xl font-bold">Live Sessions</h1>
          </div>
          <p className="text-gray-400">Join CentenarianOS Team for live training, Q&amp;A, and coaching.</p>
        </div>

        {/* Live now */}
        {liveSessions.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h2 className="font-bold text-red-400 uppercase tracking-wide text-sm">Live Now</h2>
            </div>
            <div className="space-y-4">
              {liveSessions.map((session) => (
                <div key={session.id} className="bg-gray-900 border border-red-800/50 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === session.id ? null : session.id)}
                    className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-800/50 transition text-left"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-white">{session.title}</p>
                      {session.description && <p className="text-gray-400 text-sm mt-0.5">{session.description}</p>}
                    </div>
                    {expanded === session.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {expanded === session.id && (
                    <div className="px-6 pb-6">
                      <div
                        className="w-full"
                        dangerouslySetInnerHTML={{ __html: session.embed_code }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {upcomingSessions.length > 0 && (
          <div>
            <h2 className="font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-fuchsia-400" /> Upcoming Sessions
            </h2>
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <div key={session.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === session.id ? null : session.id)}
                    className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-800/50 transition text-left"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-white">{session.title}</p>
                      {session.scheduled_at && (
                        <p className="text-gray-500 text-sm mt-0.5">
                          {new Date(session.scheduled_at).toLocaleString('en-US', {
                            weekday: 'short', month: 'short', day: 'numeric',
                            hour: 'numeric', minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                    {expanded === session.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {expanded === session.id && (
                    <div className="px-6 pb-6">
                      {session.description && <p className="text-gray-400 text-sm mb-4">{session.description}</p>}
                      <div
                        className="w-full"
                        dangerouslySetInnerHTML={{ __html: session.embed_code }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && (
          <div className="text-center py-20 text-gray-600">
            <Radio className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No live sessions scheduled yet. Check back soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}
