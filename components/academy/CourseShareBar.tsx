'use client';

import { useState } from 'react';
import { Link2, Mail, Linkedin } from 'lucide-react';

interface CourseShareBarProps {
  courseUrl: string;
  courseTitle: string;
  emailUrl: string;
  linkedinUrl: string;
  facebookUrl: string;
}

export default function CourseShareBar({
  courseUrl,
  courseTitle,
  emailUrl,
  linkedinUrl,
  facebookUrl,
}: CourseShareBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(courseUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = courseUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEmail = () => {
    window.location.href = emailUrl;
  };

  const handleLinkedIn = () => {
    window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
  };

  const handleFacebook = () => {
    window.open(facebookUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-2 mt-3">
      <span className="text-xs text-gray-400 font-medium">Share this course</span>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleCopy}
          aria-label={copied ? 'Link copied' : `Copy link to ${courseTitle}`}
          className="min-h-11 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-300 hover:text-sky-300 hover:bg-gray-700 bg-gray-800 border border-gray-700 rounded-xl transition"
        >
          <Link2 className="w-4 h-4" aria-hidden="true" />
          {copied ? 'Copied!' : 'Copy link'}
        </button>

        <button
          onClick={handleEmail}
          aria-label={`Share "${courseTitle}" via email`}
          className="min-h-11 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-300 hover:text-sky-300 hover:bg-gray-700 bg-gray-800 border border-gray-700 rounded-xl transition"
        >
          <Mail className="w-4 h-4" aria-hidden="true" />
          Email
        </button>

        <button
          onClick={handleLinkedIn}
          aria-label={`Share "${courseTitle}" on LinkedIn`}
          className="min-h-11 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-300 hover:text-blue-300 hover:bg-gray-700 bg-gray-800 border border-gray-700 rounded-xl transition"
        >
          <Linkedin className="w-4 h-4" aria-hidden="true" />
          LinkedIn
        </button>

        <button
          onClick={handleFacebook}
          aria-label={`Share "${courseTitle}" on Facebook`}
          className="min-h-11 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-300 hover:text-[#4599FF] hover:bg-gray-700 bg-gray-800 border border-gray-700 rounded-xl transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
          </svg>
          Facebook
        </button>
      </div>
    </div>
  );
}
