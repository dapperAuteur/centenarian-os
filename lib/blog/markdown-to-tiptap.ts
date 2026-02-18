/**
 * Converts a markdown string to a Tiptap JSON document.
 *
 * Process:
 *   markdown → HTML (via `marked`)
 *             → Tiptap JSON (via `generateJSON` from @tiptap/core)
 *
 * Works in both browser and Node.js (no DOM required for `marked`).
 * `generateJSON` requires Node.js JSDOM or browser — call this only in
 * client components or server components that run in Node.
 */

import { marked } from 'marked';
import { generateJSON } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CodeBlock from '@tiptap/extension-code-block';
import Heading from '@tiptap/extension-heading';

// Same extension list as the editor (minus React-specific / client-only ones)
const extensions = [
  StarterKit.configure({ codeBlock: false, heading: false }),
  Heading.configure({ levels: [1, 2, 3] }),
  CodeBlock,
  Link.configure({ openOnClick: false }),
  Image,
];

/**
 * Parses frontmatter from a markdown string.
 * Returns { frontmatter, body } where frontmatter is a key-value map
 * and body is the remaining markdown after the --- block.
 */
export function parseFrontmatter(raw: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!fmMatch) return { frontmatter: {}, body: raw };

  const frontmatter: Record<string, string> = {};
  fmMatch[1].split('\n').forEach((line) => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const key = line.slice(0, colonIdx).trim();
    const value = line
      .slice(colonIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, ''); // strip surrounding quotes
    if (key) frontmatter[key] = value;
  });

  return { frontmatter, body: fmMatch[2] };
}

/**
 * Converts a markdown string to a Tiptap JSON document object.
 * Strips the H1 title from the body if it matches the post title
 * (to avoid duplication since PostForm has its own title field).
 */
export function markdownToTiptapJSON(markdown: string): object {
  // marked returns a string synchronously with default options
  const html = marked(markdown, { async: false }) as string;
  return generateJSON(html, extensions);
}

/**
 * Extracts a title from the markdown:
 * 1. From frontmatter `title:` field
 * 2. From the first `# Heading` in the body
 * 3. Falls back to empty string
 */
export function extractTitle(frontmatter: Record<string, string>, body: string): string {
  if (frontmatter.title) return frontmatter.title;
  const match = body.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : '';
}

/**
 * Extracts tags from frontmatter.
 * Supports both YAML array format (tags: [a, b]) and comma-separated (tags: a, b).
 */
export function extractTags(frontmatter: Record<string, string>): string[] {
  const raw = frontmatter.tags || frontmatter.categories || '';
  if (!raw) return [];
  // Handle [a, b, c] array notation
  const stripped = raw.replace(/^\[|\]$/g, '');
  return stripped.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
}

/**
 * Strips the first H1 heading from a markdown body string.
 * Used so the title isn't duplicated in the editor content.
 */
export function stripTitleFromBody(body: string): string {
  return body.replace(/^#\s+.+\n?/, '').trimStart();
}
