'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import CodeBlock from '@tiptap/extension-code-block';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import { Node, mergeAttributes } from '@tiptap/core';
import { useState } from 'react';
import EditorToolbar from './EditorToolbar';
import MediaEmbedModal from './MediaEmbedModal';

/**
 * Custom Tiptap node for social media embeds.
 * Stores raw sanitized embed HTML as a data attribute.
 * SocialEmbedBlock (client component) hydrates it on the public page.
 */
const SocialEmbed = Node.create({
  name: 'socialEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      html: { default: '' },
      platform: { default: 'unknown' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-social-embed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-social-embed': 'true',
        class: 'social-embed-block my-4',
      }),
    ];
  },
});

interface TiptapEditorProps {
  content: object | null;
  onChange: (json: object) => void;
  placeholder?: string;
}

export type { Editor };

export default function TiptapEditor({ content, onChange, placeholder }: TiptapEditorProps) {
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Disable built-in codeBlock so our extension takes precedence
        codeBlock: false,
        heading: false,
      }),
      Heading.configure({ levels: [1, 2, 3] }),
      CodeBlock,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ allowBase64: false }),
      Youtube.configure({ width: 640, height: 360, nocookie: true }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing your post…',
      }),
      SocialEmbed,
    ],
    content: content || undefined,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: 'blog-content min-h-[400px] px-6 py-4 focus:outline-none',
      },
    },
  });

  const handleMediaInsert = (payload: {
    type: 'youtube' | 'social' | 'image' | 'video';
    url?: string;
    html?: string;
    platform?: string;
    publicId?: string;
  }) => {
    if (!editor) return;

    switch (payload.type) {
      case 'youtube':
        editor.chain().focus().setYoutubeVideo({ src: payload.url! }).run();
        break;
      case 'social':
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'socialEmbed',
            attrs: { html: payload.html!, platform: payload.platform || 'unknown' },
          })
          .run();
        break;
      case 'image':
        editor.chain().focus().setImage({ src: payload.url!, alt: '' }).run();
        break;
      case 'video':
        // Insert video as a social embed node with a <video> tag
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'socialEmbed',
            attrs: {
              html: `<video controls class="w-full rounded-lg" src="${payload.url}"></video>`,
              platform: 'cloudinary',
            },
          })
          .run();
        break;
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <EditorToolbar editor={editor} onInsertMedia={() => setMediaModalOpen(true)} />
      <EditorContent editor={editor} />
      <MediaEmbedModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        onInsert={handleMediaInsert}
      />
    </div>
  );
}
