/**
 * Converts a markdown string to a Tiptap JSON document.
 *
 * Process:
 *   markdown → tokens (via `marked.lexer()`)
 *             → Tiptap JSON (direct token-to-node mapping)
 *
 * Works in both browser and Node.js — no DOM required.
 */

import { marked, type Token, type Tokens } from 'marked';

// --- Inline token → Tiptap mark/text conversion ---

interface TiptapTextNode {
  type: 'text';
  text: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

type TiptapInline = TiptapTextNode | { type: string; attrs?: Record<string, unknown> };

function inlineTokensToNodes(
  tokens: Token[],
  parentMarks: { type: string; attrs?: Record<string, unknown> }[] = [],
): TiptapInline[] {
  const nodes: TiptapInline[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'text': {
        const t = token as Tokens.Text;
        const text = t.text;
        if (text) {
          nodes.push({
            type: 'text',
            text,
            ...(parentMarks.length > 0 ? { marks: [...parentMarks] } : {}),
          });
        }
        break;
      }
      case 'strong': {
        const t = token as Tokens.Strong;
        const marks = [...parentMarks, { type: 'bold' }];
        nodes.push(...inlineTokensToNodes(t.tokens, marks));
        break;
      }
      case 'em': {
        const t = token as Tokens.Em;
        const marks = [...parentMarks, { type: 'italic' }];
        nodes.push(...inlineTokensToNodes(t.tokens, marks));
        break;
      }
      case 'codespan': {
        const t = token as Tokens.Codespan;
        nodes.push({
          type: 'text',
          text: t.text,
          marks: [...parentMarks, { type: 'code' }],
        });
        break;
      }
      case 'link': {
        const t = token as Tokens.Link;
        const marks = [
          ...parentMarks,
          { type: 'link', attrs: { href: t.href, target: '_blank', rel: 'noopener noreferrer nofollow' } },
        ];
        nodes.push(...inlineTokensToNodes(t.tokens, marks));
        break;
      }
      case 'image': {
        const t = token as Tokens.Image;
        nodes.push({
          type: 'image',
          attrs: { src: t.href, alt: t.text || null, title: t.title || null },
        });
        break;
      }
      case 'br': {
        nodes.push({ type: 'hardBreak' } as TiptapInline);
        break;
      }
      case 'escape': {
        const t = token as Tokens.Escape;
        nodes.push({
          type: 'text',
          text: t.text,
          ...(parentMarks.length > 0 ? { marks: [...parentMarks] } : {}),
        });
        break;
      }
      default: {
        // Fallback: use raw text if available
        const raw = (token as { raw?: string }).raw || (token as { text?: string }).text;
        if (raw) {
          nodes.push({
            type: 'text',
            text: raw,
            ...(parentMarks.length > 0 ? { marks: [...parentMarks] } : {}),
          });
        }
        break;
      }
    }
  }

  return nodes;
}

// --- Block token → Tiptap node conversion ---

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: (TiptapNode | TiptapInline)[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

function blockTokenToNode(token: Token): TiptapNode | null {
  switch (token.type) {
    case 'heading': {
      const t = token as Tokens.Heading;
      const level = Math.min(t.depth, 3);
      const content = inlineTokensToNodes(t.tokens);
      return {
        type: 'heading',
        attrs: { level },
        ...(content.length > 0 ? { content } : {}),
      };
    }
    case 'paragraph': {
      const t = token as Tokens.Paragraph;
      const content = inlineTokensToNodes(t.tokens);
      return {
        type: 'paragraph',
        ...(content.length > 0 ? { content } : {}),
      };
    }
    case 'blockquote': {
      const t = token as Tokens.Blockquote;
      const children = tokensToNodes(t.tokens);
      return {
        type: 'blockquote',
        ...(children.length > 0 ? { content: children } : {}),
      };
    }
    case 'code': {
      const t = token as Tokens.Code;
      return {
        type: 'codeBlock',
        attrs: { language: t.lang || null },
        content: t.text ? [{ type: 'text', text: t.text }] : [],
      };
    }
    case 'list': {
      const t = token as Tokens.List;
      const listType = t.ordered ? 'orderedList' : 'bulletList';
      const items = t.items.map((item) => {
        const children = tokensToNodes(item.tokens);
        return {
          type: 'listItem',
          ...(children.length > 0 ? { content: children } : {}),
        };
      });
      return {
        type: listType,
        ...(items.length > 0 ? { content: items } : {}),
      };
    }
    case 'hr': {
      return { type: 'horizontalRule' };
    }
    case 'space': {
      return null; // skip whitespace tokens
    }
    case 'html': {
      // Wrap raw HTML as a paragraph with the text
      const t = token as Tokens.HTML;
      const text = t.text.trim();
      if (!text) return null;
      return {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      };
    }
    default: {
      // Fallback: wrap unknown blocks as paragraph
      const raw = (token as { raw?: string }).raw?.trim();
      if (raw) {
        return {
          type: 'paragraph',
          content: [{ type: 'text', text: raw }],
        };
      }
      return null;
    }
  }
}

function tokensToNodes(tokens: Token[]): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  for (const token of tokens) {
    const node = blockTokenToNode(token);
    if (node) nodes.push(node);
  }
  return nodes;
}

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
 * Uses marked's lexer to tokenize, then maps tokens directly to Tiptap JSON.
 * No DOM required — works in Node.js API routes.
 */
export function markdownToTiptapJSON(markdown: string): object {
  const tokens = marked.lexer(markdown);
  const content = tokensToNodes(tokens);
  return { type: 'doc', content };
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
