/**
 * Custom Tiptap node for video embeds.
 * Stores only the video URL — auto-detects provider (YouTube, Viloud, Mux, Cloudinary)
 * and renders the correct embed format.
 *
 * Isomorphic: works in both client (editor) and server (generateHTML) contexts.
 */
import { Node, mergeAttributes } from '@tiptap/core';
import { getEmbedUrl } from '@/lib/video/getEmbedUrl';

export const VideoEmbedNode = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-video-embed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const src = HTMLAttributes.src || '';
    const { provider, embedUrl } = getEmbedUrl(src);

    const wrapperAttrs = mergeAttributes(
      { 'data-video-embed': src },
      {
        class: 'video-embed-block my-4',
        style:
          'position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:0.5rem;background:#000;',
      },
    );

    if (provider !== 'unknown' && embedUrl) {
      return [
        'div',
        wrapperAttrs,
        [
          'iframe',
          {
            src: embedUrl,
            style: 'position:absolute;top:0;left:0;width:100%;height:100%;border:0;',
            allowfullscreen: 'true',
            allow:
              'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
            loading: 'lazy',
          },
        ],
      ];
    }

    // Direct video file (Cloudinary, self-hosted, etc.)
    return [
      'div',
      wrapperAttrs,
      [
        'video',
        {
          src,
          controls: 'true',
          style: 'position:absolute;top:0;left:0;width:100%;height:100%;',
        },
      ],
    ];
  },
});
