'use client';

import { useState } from 'react';
import { Link2, Mail, Linkedin } from 'lucide-react';

interface RecipeShareBarProps {
  recipeUrl: string;
  recipeTitle: string;
  recipeId: string;
  emailUrl: string;
  linkedinUrl: string;
  facebookUrl: string;
}

async function logShareEvent(recipeId: string, eventType: string) {
  try {
    await fetch('/api/recipes/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipeId, eventType, sessionId: getSessionId() }),
    });
  } catch {
    // Non-critical — swallow errors
  }
}

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  const key = 'recipe_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export default function RecipeShareBar({
  recipeUrl,
  recipeTitle,
  recipeId,
  emailUrl,
  linkedinUrl,
  facebookUrl,
}: RecipeShareBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recipeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      logShareEvent(recipeId, 'share_copy');
    } catch {
      const el = document.createElement('textarea');
      el.value = recipeUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      logShareEvent(recipeId, 'share_copy');
    }
  };

  const handleEmail = () => {
    logShareEvent(recipeId, 'share_email');
    window.location.href = emailUrl;
  };

  const handleLinkedIn = () => {
    logShareEvent(recipeId, 'share_linkedin');
    window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
  };

  const handleFacebook = () => {
    logShareEvent(recipeId, 'share_facebook');
    window.open(facebookUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-gray-500 font-medium mr-1">Share:</span>

      <button
        onClick={handleCopy}
        title="Copy link"
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50 border border-gray-200 rounded-lg transition"
      >
        <Link2 className="w-4 h-4" />
        {copied ? 'Copied!' : 'Copy link'}
      </button>

      <button
        onClick={handleEmail}
        title={`Share "${recipeTitle}" via email`}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50 border border-gray-200 rounded-lg transition"
      >
        <Mail className="w-4 h-4" />
        Email
      </button>

      <button
        onClick={handleLinkedIn}
        title={`Share "${recipeTitle}" on LinkedIn`}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-700 hover:bg-blue-50 border border-gray-200 rounded-lg transition"
      >
        <Linkedin className="w-4 h-4" />
        LinkedIn
      </button>

      <button
        onClick={handleFacebook}
        title={`Share "${recipeTitle}" on Facebook`}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-[#1877F2] hover:bg-blue-50 border border-gray-200 rounded-lg transition"
      >
        {/* Facebook brand icon */}
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
        </svg>
        Facebook
      </button>
    </div>
  );
}
