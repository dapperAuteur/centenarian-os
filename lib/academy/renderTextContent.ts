// lib/academy/renderTextContent.ts
// Shared utility: renders markdown or tiptap JSON string to sanitized HTML.

import { marked } from 'marked';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import TiptapCodeBlock from '@tiptap/extension-code-block';
import TiptapHeading from '@tiptap/extension-heading';
import DOMPurify from 'dompurify';

const TIPTAP_EXTENSIONS = [
  StarterKit.configure({ codeBlock: false, heading: false }),
  TiptapHeading.configure({ levels: [1, 2, 3] }),
  TiptapCodeBlock,
  TiptapLink.configure({ openOnClick: false }),
  TiptapImage,
];

export function renderTextContent(text_content: string | null, content_format?: string): string {
  if (!text_content) return '';
  if (content_format === 'tiptap') {
    try {
      const html = generateHTML(JSON.parse(text_content), TIPTAP_EXTENSIONS);
      return DOMPurify.sanitize(html);
    } catch {
      return '';
    }
  }
  const html = marked.parse(text_content, { async: false }) as string;
  return DOMPurify.sanitize(html);
}
