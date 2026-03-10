export type VideoProvider = 'youtube' | 'viloud' | 'mux' | 'cloudinary' | 'unknown';

export interface EmbedResult {
  provider: VideoProvider;
  embedUrl: string | null;
}

const YOUTUBE_ID_RE =
  /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/;

export function getEmbedUrl(url: string | null | undefined): EmbedResult {
  if (!url || !url.trim()) {
    return { provider: 'unknown', embedUrl: null };
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { provider: 'unknown', embedUrl: null };
  }

  const host = parsed.hostname.toLowerCase();

  // YouTube
  const ytMatch = url.match(YOUTUBE_ID_RE);
  if (ytMatch) {
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`,
    };
  }

  // Viloud.tv
  if (host.includes('viloud.tv')) {
    return { provider: 'viloud', embedUrl: url.trim() };
  }

  // Mux
  if (host.includes('stream.mux.com') || host.includes('mux.com')) {
    return { provider: 'mux', embedUrl: url.trim() };
  }

  // Cloudinary (direct video file — rendered as <video>, not iframe)
  if (host.includes('cloudinary.com') || host.includes('res.cloudinary.com')) {
    return { provider: 'cloudinary', embedUrl: null };
  }

  return { provider: 'unknown', embedUrl: null };
}
