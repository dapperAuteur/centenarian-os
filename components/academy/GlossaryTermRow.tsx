'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { renderTextContent } from '@/lib/academy/renderTextContent';

export interface GlossaryTerm {
  id: string;
  course_id: string;
  lesson_id: string | null;
  term: string;
  phonetic: string | null;
  definition: string | null;
  definition_format: 'markdown' | 'tiptap';
  sort_order: number;
}

export default function GlossaryTermRow({ term }: { term: GlossaryTerm }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-4 sm:px-5 py-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white">{term.term}</span>
          {term.phonetic && (
            <span className="ml-2 text-xs text-gray-500 italic">({term.phonetic})</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-600 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && term.definition && (
        <div
          className="mt-2 prose prose-invert prose-sm max-w-none text-gray-300"
          dangerouslySetInnerHTML={{ __html: renderTextContent(term.definition, term.definition_format) }}
        />
      )}
    </div>
  );
}
