/**
 * Server-safe Tiptap → HTML renderer.
 * Uses @tiptap/html's generateHTML which works in Node.js without a DOM.
 *
 * IMPORTANT: Import this only in server components or API routes.
 * Never import in 'use client' files.
 */
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import CodeBlock from '@tiptap/extension-code-block';
import Heading from '@tiptap/extension-heading';

// Extensions that work with generateHTML (no React, no DOM required)
const serverExtensions = [
  StarterKit,
  Link.configure({ openOnClick: false }),
  Image,
  Youtube.configure({ nocookie: true }),
  CodeBlock,
  Heading.configure({ levels: [1, 2, 3] }),
];

export function renderTiptapToHTML(content: object): string {
  try {
    return generateHTML(content, serverExtensions);
  } catch {
    return '<p>Content could not be rendered.</p>';
  }
}
