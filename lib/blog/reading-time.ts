/**
 * Estimates reading time from a Tiptap JSON document.
 * Walks the content tree, collects all text nodes, counts words,
 * then divides by average reading speed (200 WPM). Returns minimum 1 minute.
 */

interface TiptapNode {
  type: string;
  text?: string;
  content?: TiptapNode[];
}

function extractText(node: TiptapNode): string {
  if (node.type === 'text' && node.text) return node.text;
  if (node.content) return node.content.map(extractText).join(' ');
  return '';
}

export function estimateReadingTime(content: object): number {
  const text = extractText(content as TiptapNode);
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}
