'use client';

// components/academy/LessonBodyEditor.tsx
// Body editor for text-type academy lessons, used in the course editor's
// Curriculum tab (both the add-new-lesson form and the inline edit form).
// Two modes with a toggle:
//   • Markdown (default) — a textarea + live preview (renderTextContent).
//   • Rich text          — the Tiptap WYSIWYG (LessonTextEditor).
// The source of truth is (text_content, content_format). Markdown stores raw
// markdown; rich text stores Tiptap JSON. Switching Markdown → Rich converts
// losslessly (marked → generateJSON). Switching Rich → Markdown restores the
// last markdown we held (rich-only edits are dropped — noted in the UI) to
// avoid a lossy HTML→markdown round-trip we have no serializer for.

import { useRef, useState } from 'react';
import { marked } from 'marked';
import { generateJSON } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import TiptapCodeBlock from '@tiptap/extension-code-block';
import TiptapHeading from '@tiptap/extension-heading';
import { FileCode, Type } from 'lucide-react';
import LessonTextEditor from './LessonTextEditor';
import { renderTextContent } from '@/lib/academy/renderTextContent';

// Must match the extension set in renderTextContent.ts / LessonTextEditor.tsx
// so a markdown→rich conversion produces JSON the renderer understands.
const TIPTAP_EXTENSIONS = [
  StarterKit.configure({ codeBlock: false, heading: false }),
  TiptapHeading.configure({ levels: [1, 2, 3] }),
  TiptapCodeBlock,
  TiptapLink.configure({ openOnClick: false }),
  TiptapImage,
];

interface Props {
  textContent: string | null;
  contentFormat: string | null | undefined; // 'markdown' | 'tiptap'
  onChange: (next: { text_content: string; content_format: 'markdown' | 'tiptap' }) => void;
}

export default function LessonBodyEditor({ textContent, contentFormat, onChange }: Props) {
  const mode: 'markdown' | 'tiptap' = contentFormat === 'tiptap' ? 'tiptap' : 'markdown';
  const [showPreview, setShowPreview] = useState(true);
  // The markdown we held before converting to rich, so Rich → Markdown is
  // non-lossy for content originally authored in markdown.
  const lastMarkdown = useRef<string>(mode === 'markdown' ? textContent ?? '' : '');

  function toRich() {
    if (mode === 'tiptap') return;
    const md = textContent ?? '';
    lastMarkdown.current = md;
    let json: string;
    try {
      const html = marked.parse(md, { async: false }) as string;
      json = JSON.stringify(generateJSON(html, TIPTAP_EXTENSIONS));
    } catch {
      json = JSON.stringify({ type: 'doc', content: [] });
    }
    onChange({ text_content: json, content_format: 'tiptap' });
  }

  function toMarkdown() {
    if (mode === 'markdown') return;
    onChange({ text_content: lastMarkdown.current, content_format: 'markdown' });
  }

  const tabBtn = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-2 text-xs min-h-11 transition ${
      active ? 'bg-fuchsia-600 text-white' : 'text-gray-300 hover:bg-gray-700'
    }`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="inline-flex rounded-lg border border-gray-700 overflow-hidden" role="group" aria-label="Lesson body editor mode">
          <button type="button" onClick={toMarkdown} className={tabBtn(mode === 'markdown')} aria-pressed={mode === 'markdown'}>
            <FileCode className="w-3.5 h-3.5" aria-hidden="true" /> Markdown
          </button>
          <button type="button" onClick={toRich} className={tabBtn(mode === 'tiptap')} aria-pressed={mode === 'tiptap'}>
            <Type className="w-3.5 h-3.5" aria-hidden="true" /> Rich text
          </button>
        </div>
        {mode === 'markdown' && (
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="text-xs text-gray-400 hover:text-white min-h-11 px-2"
          >
            {showPreview ? 'Hide preview' : 'Show preview'}
          </button>
        )}
      </div>

      {mode === 'markdown' ? (
        <div className={`grid gap-3 ${showPreview ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
          <textarea
            value={textContent ?? ''}
            onChange={(e) => onChange({ text_content: e.target.value, content_format: 'markdown' })}
            rows={16}
            aria-label="Lesson text (Markdown)"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent"
            placeholder={'Write lesson text in Markdown.\n\n## A section heading\n\nA paragraph with **bold** text and a [link](https://example.com).\n\n- a list item\n- another item'}
          />
          {showPreview && (
            <div
              className="prose prose-invert prose-sm max-w-none bg-gray-900 border border-gray-800 rounded-lg p-3 overflow-auto prose-headings:text-white prose-p:leading-relaxed"
              // Sanitized in renderTextContent (DOMPurify) before it reaches here.
              dangerouslySetInnerHTML={{ __html: renderTextContent(textContent, 'markdown') || '<p class="text-gray-500">Preview appears here.</p>' }}
            />
          )}
        </div>
      ) : (
        <>
          <LessonTextEditor
            content={textContent}
            onChange={(json) => onChange({ text_content: json, content_format: 'tiptap' })}
            placeholder="Write your lesson content…"
          />
          <p className="text-xs text-gray-500">
            Rich text is stored as its own format. Switching back to Markdown restores your last Markdown version and drops edits made here.
          </p>
        </>
      )}
    </div>
  );
}
