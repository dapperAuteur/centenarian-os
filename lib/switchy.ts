// lib/switchy.ts
// Server-only — Switchy.io short link API helper.
// Non-blocking: callers should fire-and-forget so Switchy outages never break publishing.

const API_BASE = 'https://api.switchy.io/v1';

function headers() {
  return {
    'Content-Type': 'application/json',
    'Api-Authorization': process.env.SWITCHY_API_TOKEN!,
  };
}

export interface SwitchyLink {
  id: string;
  short_url: string;
}

interface CreateParams {
  url: string;
  slug: string;
  title?: string;
  description?: string;
  image?: string;
  tags?: string[];
}

/**
 * Creates a short link in Switchy. Retries with a random suffix if slug is taken.
 * Returns null on failure (caller should handle gracefully).
 */
export async function createShortLink(params: CreateParams): Promise<SwitchyLink | null> {
  if (!process.env.SWITCHY_API_TOKEN) return null;

  const domain = process.env.SWITCHY_DOMAIN ?? 'i.centenarianos.com';

  const body = {
    url: params.url,
    domain,
    id: params.slug,
    title: params.title,
    description: params.description,
    image: params.image,
    tags: params.tags,
  };

  const res = await fetch(`${API_BASE}/links/create`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Slug collision — retry with 6-char random suffix
    if (res.status === 409 || res.status === 422) {
      const suffix = Math.random().toString(36).slice(2, 8);
      const retry = await fetch(`${API_BASE}/links/create`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ ...body, id: `${params.slug}-${suffix}` }),
      });
      if (!retry.ok) return null;
      return retry.json();
    }
    return null;
  }

  return res.json();
}

interface UpdateParams {
  linkId: string;
  url?: string;
  title?: string;
  description?: string;
  image?: string;
}

/**
 * Updates OG metadata and/or destination URL for an existing Switchy link.
 */
export async function updateShortLink(params: UpdateParams): Promise<boolean> {
  if (!process.env.SWITCHY_API_TOKEN) return false;

  const res = await fetch(`${API_BASE}/links/${params.linkId}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({
      link: {
        url: params.url,
        title: params.title,
        description: params.description,
        image: params.image,
      },
    }),
  });
  return res.ok;
}

/** Slugifies a title for use as a Switchy link id with a content-type prefix. */
export function toSwitchySlug(prefix: 'b' | 'r' | 'c' | 'i' | 'o', text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${prefix}-${slug}`;
}
