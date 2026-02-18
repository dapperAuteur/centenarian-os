'use client';

import { useState } from 'react';
import { Link2, Mail, Linkedin } from 'lucide-react';

interface ShareBarProps {
  postUrl: string;
  postTitle: string;
  postId: string;
  emailUrl: string;
  linkedinUrl: string;
}

async function logShareEvent(postId: string, eventType: string) {
  try {
    await fetch('/api/blog/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, eventType, sessionId: getSessionId() }),
    });
  } catch {
    // Non-critical — swallow errors
  }
}

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  const key = 'blog_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export default function ShareBar({ postUrl, postTitle, postId, emailUrl, linkedinUrl }: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      logShareEvent(postId, 'share_copy');
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement('textarea');
      el.value = postUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      logShareEvent(postId, 'share_copy');
    }
  };

  const handleEmail = () => {
    logShareEvent(postId, 'share_email');
    window.location.href = emailUrl;
  };

  const handleLinkedIn = () => {
    logShareEvent(postId, 'share_linkedin');
    window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 font-medium mr-1">Share:</span>

      <button
        onClick={handleCopy}
        title="Copy link"
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-sky-600 hover:bg-sky-50 border border-gray-200 rounded-lg transition"
      >
        <Link2 className="w-4 h-4" />
        {copied ? 'Copied!' : 'Copy link'}
      </button>

      <button
        onClick={handleEmail}
        title={`Share "${postTitle}" via email`}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-sky-600 hover:bg-sky-50 border border-gray-200 rounded-lg transition"
      >
        <Mail className="w-4 h-4" />
        Email
      </button>

      <button
        onClick={handleLinkedIn}
        title={`Share "${postTitle}" on LinkedIn`}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-700 hover:bg-blue-50 border border-gray-200 rounded-lg transition"
      >
        <Linkedin className="w-4 h-4" />
        LinkedIn
      </button>
    </div>
  );
}
