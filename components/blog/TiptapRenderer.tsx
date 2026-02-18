// components/blog/TiptapRenderer.tsx
// Server-safe Tiptap JSON → HTML renderer. No 'use client' — works in RSC.
import { renderTiptapToHTML } from '@/lib/blog/tiptap-renderer';

interface TiptapRendererProps {
  content: object;
  className?: string;
}

export default function TiptapRenderer({ content, className }: TiptapRendererProps) {
  const html = renderTiptapToHTML(content);
  return (
    <div
      className={`blog-content ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
