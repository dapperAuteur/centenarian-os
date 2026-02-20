'use client';

// app/dashboard/teaching/live/page.tsx
// Teacher live sessions — coming soon once Mux integration is available.

import { Video } from 'lucide-react';

export default function TeacherLivePage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-2">Live Sessions</h1>
      <p className="text-gray-400 text-sm mb-8">Host live sessions for your students.</p>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <Video className="w-12 h-12 mx-auto mb-4 text-gray-700" />
        <p className="text-white font-semibold mb-2">Coming Soon</p>
        <p className="text-gray-500 text-sm max-w-sm mx-auto">
          Teacher-hosted live sessions will be available once the platform upgrades to Mux live streaming.
          In the meantime, CentenarianOS Team sessions are available at{' '}
          <a href="/live" className="text-fuchsia-400 hover:underline">/live</a>.
        </p>
      </div>
    </div>
  );
}
