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
 * Normalises the Switchy API response into our SwitchyLink shape.
 * The API may return the link nested under a `link` key or flat at the root.
 * short_url may be returned as `short_url`, `shortUrl`, or constructed from domain + id.
 */
function parseSwitchyResponse(json: Record<string, unknown>, domain: string): SwitchyLink | null {
  // Handle nested { link: { ... } } or flat response
  const data = (json.link ?? json) as Record<string, unknown>;
  const id = (data.id ?? data._id ?? '') as string;
  const shortUrl = (data.short_url ?? data.shortUrl ?? (id ? `https://${domain}/${id}` : '')) as string;

  if (!id || !shortUrl) {
    console.error('[switchy] Unexpected response shape:', JSON.stringify(json).slice(0, 300));
    return null;
  }
  return { id, short_url: shortUrl };
}

/**
 * Creates a short link in Switchy. Retries with a random suffix if slug is taken.
 * Returns null on failure (caller should handle gracefully).
 */
export async function createShortLink(params: CreateParams): Promise<SwitchyLink | null> {
  if (!process.env.SWITCHY_API_TOKEN) {
    console.warn('[switchy] SWITCHY_API_TOKEN not set — skipping link creation');
    return null;
  }

  const domain = process.env.SWITCHY_DOMAIN ?? 'i.centenarianos.com';

  const pixelIds = process.env.SWITCHY_PIXEL_IDS
    ? process.env.SWITCHY_PIXEL_IDS.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const link = {
    url: params.url,
    domain,
    id: params.slug,
    title: params.title,
    description: params.description,
    image: params.image,
    tags: params.tags,
    ...(pixelIds.length > 0 && { pixels: pixelIds }),
  };

  try {
    const res = await fetch(`${API_BASE}/links/create`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ link }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      // Slug collision — retry with 6-char random suffix
      if (res.status === 409 || res.status === 422) {
        const suffix = Math.random().toString(36).slice(2, 8);
        const retry = await fetch(`${API_BASE}/links/create`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ link: { ...link, id: `${params.slug}-${suffix}` } }),
        });
        if (!retry.ok) {
          console.error(`[switchy] Retry failed for slug ${params.slug}-${suffix}: ${retry.status}`);
          return null;
        }
        return parseSwitchyResponse(await retry.json(), domain);
      }
      console.error(`[switchy] Failed to create link for ${params.slug}: ${res.status} ${errorText}`);
      return null;
    }

    return parseSwitchyResponse(await res.json(), domain);
  } catch (err) {
    console.error(`[switchy] Network error creating link for ${params.slug}:`, err);
    return null;
  }
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
export function toSwitchySlug(prefix: 'b' | 'r' | 'c' | 'i' | 'o' | 'f', text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${prefix}-${slug}`;
}
