'use client';

// components/ui/FloatingActionsMenu.tsx
// Speed-dial FAB that consolidates Help (RAG chat) + Feedback into one corner button.
// Replaces the standalone feedback bubble in dashboard/layout.tsx and adds Help to academy pages.
// Opens upward: main button (Plus) → Help (HelpCircle) → Feedback (MessageCircle)

import { useState } from 'react';
import { Plus, X, HelpCircle, MessageCircle } from 'lucide-react';
import FeedbackModal from '@/components/FeedbackModal';
import HelpDrawer from '@/components/ui/HelpDrawer';

interface Props {
  userRole?: string;
}

export default function FloatingActionsMenu({ userRole }: Props) {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  function openHelp() {
    setOpen(false);
    setHelpOpen(true);
  }

  function openFeedback() {
    setOpen(false);
    setFeedbackOpen(true);
  }

  return (
    <>
      {/* Speed-dial stack */}
      <div className="fixed bottom-22 lg:bottom-6 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none">
        {/* Help action */}
        <div
          className={`flex items-center gap-2.5 transition-all duration-200 ${
            open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4'
          }`}
        >
          <span className="bg-gray-900 text-gray-200 text-xs font-medium px-2.5 py-1 rounded-full shadow border border-gray-700">
            Help
          </span>
          <button
            onClick={openHelp}
            title="Open help chat"
            className="min-h-11 min-w-11 bg-gray-800 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-700 border border-gray-700 transition-colors"
            aria-label="Open help chat"
          >
            <HelpCircle className="w-5 h-5 text-fuchsia-400" />
          </button>
        </div>

        {/* Feedback action */}
        <div
          className={`flex items-center gap-2.5 transition-all duration-200 delay-75 ${
            open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4'
          }`}
        >
          <span className="bg-gray-900 text-gray-200 text-xs font-medium px-2.5 py-1 rounded-full shadow border border-gray-700">
            Feedback
          </span>
          <button
            onClick={openFeedback}
            title="Share feedback"
            className="min-h-11 min-w-11 bg-gray-800 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-700 border border-gray-700 transition-colors"
            aria-label="Share feedback"
          >
            <MessageCircle className="w-5 h-5 text-fuchsia-400" />
          </button>
        </div>

        {/* Main toggle button */}
        <button
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Close menu' : 'Help & Feedback'}
          className="min-h-11 min-w-11 bg-fuchsia-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-fuchsia-700 transition-colors pointer-events-auto"
          aria-label={open ? 'Close menu' : 'Help & Feedback'}
          aria-expanded={open}
        >
          {open
            ? <X className="w-5 h-5" />
            : <Plus className="w-5 h-5" />
          }
        </button>
      </div>

      <HelpDrawer isOpen={helpOpen} onClose={() => setHelpOpen(false)} userRole={userRole} />
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
