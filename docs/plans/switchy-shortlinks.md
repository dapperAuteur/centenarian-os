# Switchy.io Short Link Integration — Implementation Plan

## Goal

Every piece of published content on CentenarianOS (blog posts, recipes, courses) gets a short link
automatically created via the Switchy.io REST API using the custom domain `i.centenarianos.com`.
Share bars (Copy Link, Email, LinkedIn, Facebook) use the short link instead of the full URL, so
every share is tracked through Switchy's analytics dashboard.

---

## Switchy API Facts (v1)

| | |
|---|---|
| **Create link** | `POST https://api.switchy.io/v1/links/create` |
| **Update link** | `PUT https://api.switchy.io/v1/links/:LINK_ID` |
| **Auth header** | `Api-Authorization: YOUR_TOKEN` |
| **Rate limits** | 10,000 links/day · 1,000 links/hour |

### Create body fields

| Field | Required | Notes |
|---|---|---|
| `url` | ✅ | Destination (full centenarianos.com URL) |
| `domain` | ✅ | `i.centenarianos.com` |
| `id` | No | Custom slug — `b-post-slug`, `r-recipe-slug`, `c-course-slug` |
| `title` | No | OG title shown in Switchy dashboard and social previews |
| `description` | No | OG description |
| `image` | No | OG image URL (must be a URL, not base64) |
| `tags` | No | Array — `["blog"]`, `["recipe"]`, `["course"]` |

### Update body (nested under `link` key)

```json
{
  "link": {
    "url": "https://...",
    "title": "New Title",
    "description": "New excerpt",
    "image": "https://cloudinary.com/..."
  }
}
```

### Short URL format

`https://i.centenarianos.com/[id]`

**Slug conventions to avoid collisions:**
- Blog post: `b-{post.slug}` → `https://i.centenarianos.com/b-longevity-habits`
- Recipe: `r-{recipe.slug}` → `https://i.centenarianos.com/r-roasted-salmon`
- Course: `c-{course.slug}` (slugified title) → `https://i.centenarianos.com/c-fda-longevity-basics`

> If the slug has already been taken in Switchy (collision), fall back to `b-{post.id.slice(0,8)}`.

---

## What Needs to Be Built

### 1. Environment variable

```
SWITCHY_API_TOKEN=your_token_here   # from Switchy → Workspace Settings → Integrations
SWITCHY_DOMAIN=i.centenarianos.com  # your custom short-link domain configured in Switchy
```

Add both to `.env.local`, `.env.example`, and Vercel environment variables.

---

### 2. Database — Migration `047_shortlinks.sql`

Add two columns to each content table to store the Switchy link state:

```sql
-- Blog posts
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS short_link_id  TEXT,   -- Switchy internal link ID (for updates)
  ADD COLUMN IF NOT EXISTS short_link_url TEXT;   -- full short URL shown to users

-- Recipes
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS short_link_id  TEXT,
  ADD COLUMN IF NOT EXISTS short_link_url TEXT;

-- Courses
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS short_link_id  TEXT,
  ADD COLUMN IF NOT EXISTS short_link_url TEXT;
```

No RLS changes needed — these columns are only written by API routes using the service role.

---

### 3. `lib/switchy.ts` — API helper

Central module, never imported client-side.

```ts
// lib/switchy.ts
// Server-only — never import from client components.

const API_BASE = 'https://api.switchy.io/v1';

function headers() {
  return {
    'Content-Type': 'application/json',
    'Api-Authorization': process.env.SWITCHY_API_TOKEN!,
  };
}

export interface SwitchyLink {
  id: string;       // Switchy internal ID (used for updates)
  short_url: string;
}

interface CreateParams {
  url: string;
  slug: string;        // desired custom id (e.g. "b-longevity-habits")
  title?: string;
  description?: string;
  image?: string;
  tags?: string[];
}

/**
 * Creates a short link in Switchy. Retries with a random suffix if the slug is taken.
 */
export async function createShortLink(params: CreateParams): Promise<SwitchyLink | null> {
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

/** Slugifies a title for use as a Switchy link id. */
export function toSwitchySlug(prefix: 'b' | 'r' | 'c', text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${prefix}-${slug}`;
}
```

---

### 4. Trigger points — where short links get created and updated

#### A. Blog Posts — `app/api/blog/[id]/route.ts` PATCH handler

**Create short link** when:
- `body.visibility === 'public'` AND `existing.visibility !== 'public'` (first publish)
- Call `createShortLink(...)` in the background after the DB update (non-blocking — don't fail the PATCH if Switchy is down)
- Save returned `id` and `short_url` back to `blog_posts`

**Update short link metadata** when:
- Post is already published (`short_link_id` exists) AND title, excerpt, or cover image changed
- Call `updateShortLink(...)` in the background

Key data to pass from `blog_posts`:
- `url`: `${SITE_URL}/blog/${username}/${post.slug}`
- `slug`: `toSwitchySlug('b', post.slug)`
- `title`: `post.title`
- `description`: `post.excerpt` (if column exists) or first 160 chars of content
- `image`: `post.cover_image_url`
- `tags`: `['blog']`

#### B. Recipes — `app/api/recipes/[id]/route.ts` PATCH handler

Same pattern:
- Create on first publish (`visibility` goes to `'public'`)
- Update on title/image changes after publish
- `slug`: `toSwitchySlug('r', recipe.slug)`
- `url`: `${SITE_URL}/recipes/cooks/${username}/${recipe.slug}`
- `tags`: `['recipe']`

#### C. Courses — `app/api/academy/courses/[id]/route.ts` PATCH handler

- Create when `is_published` changes from `false` to `true`
- `slug`: `toSwitchySlug('c', course.title)` (courses don't have user-defined slugs)
- `url`: `${SITE_URL}/academy/${course.id}`
- `tags`: `['course']`

#### D. Non-blocking pattern (important)

All Switchy calls must be fire-and-forget so a Switchy outage never breaks publishing:

```ts
// After successful DB update — DON'T await this
createShortLink({ ... }).then(async (link) => {
  if (link) {
    await db.from('blog_posts')
      .update({ short_link_id: link.id, short_link_url: link.short_url })
      .eq('id', postId);
  }
}).catch(() => { /* swallow — non-critical */ });
```

---

### 5. Share bars — use short link when available

#### `lib/blog/share.ts`

```ts
export function buildShareUrls(
  post: Pick<BlogPost, 'title' | 'slug' | 'short_link_url'>,
  username: string,
): ShareUrls {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const fullUrl = `${base}/blog/${username}/${post.slug}`;
  const shareUrl = post.short_link_url ?? fullUrl;   // short link if available

  return {
    postUrl: shareUrl,
    email: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
  };
}
```

`lib/recipes/share.ts` — same pattern with `recipe.short_link_url`.

#### Blog post page / recipe page

The page fetches the post from the DB (which now includes `short_link_url`) and passes it to `buildShareUrls`. No changes needed to `ShareBar.tsx` or `RecipeShareBar.tsx` — the short URL is just the URL the bar receives.

---

### 6. Admin sync page — `/admin/shortlinks`

For posts/recipes/courses published before this feature ships, a one-time backfill is needed.

**Route:** `POST /api/admin/shortlinks/sync`
- Auth: admin only
- Accepts optional `type` query param: `blog | recipe | course | all`
- Fetches all public content where `short_link_id IS NULL`
- Iterates and calls `createShortLink` for each (rate-limit aware — 100ms delay between calls)
- Returns `{ created: N, failed: N }`

**Page:** `app/admin/shortlinks/page.tsx`
- Shows counts: X blog posts with short links, Y without
- Same for recipes and courses
- "Sync Blog Posts" / "Sync Recipes" / "Sync Courses" / "Sync All" buttons
- Progress feedback (shows count returned from API)
- Table of recently created short links with click-through to Switchy dashboard

---

## Implementation Order

| Step | What | Files |
|---|---|---|
| 1 | Add env vars to `.env.local`, `.env.example`, Vercel | `.env.local`, `.env.example` |
| 2 | DB migration | `supabase/migrations/047_shortlinks.sql` |
| 3 | Switchy helper lib | `lib/switchy.ts` |
| 4 | Blog publish trigger | `app/api/blog/[id]/route.ts` |
| 5 | Recipe publish trigger | `app/api/recipes/[id]/route.ts` |
| 6 | Course publish trigger | `app/api/academy/courses/[id]/route.ts` |
| 7 | Update share URL builders | `lib/blog/share.ts`, `lib/recipes/share.ts` |
| 8 | Admin sync page | `app/admin/shortlinks/page.tsx`, `app/api/admin/shortlinks/sync/route.ts` |

---

## Prerequisites in Switchy Dashboard

Before any of this works in production:

1. Log into Switchy → Workspace Settings → Integrations → generate an API token → add to Vercel as `SWITCHY_API_TOKEN`
2. Add `i.centenarianos.com` as a custom domain in Switchy and verify DNS (CNAME pointing to Switchy)
3. Set `SWITCHY_DOMAIN=i.centenarianos.com` in Vercel

---

## Verification Checklist

- [ ] Publish a blog post → `blog_posts.short_link_url` is populated → Share bar Copy link copies the short URL → Switchy dashboard shows the link with click tracking
- [ ] Publish a recipe → same
- [ ] Publish a course → same
- [ ] Edit a published post's title → Switchy link title updates (visible in Switchy dashboard preview)
- [ ] Run Admin Sync → all previously published content without short links gets backfilled
- [ ] Switchy outage simulation (invalid token) → publish still succeeds, `short_link_url` stays null, share bar falls back to full URL

---

## Notes / Decisions

- **Slug collisions**: Retry with a 6-char random suffix on 409/422. This is rare — slugs are prefixed (`b-`, `r-`, `c-`) so cross-content collisions don't happen.
- **Switchy ID vs URL**: We store both `short_link_id` (the Switchy-internal ID, needed for `PUT` updates) and `short_link_url` (the full short URL shown to users and used in share bars).
- **No short links for drafts**: Only trigger on publish. Draft content stays private; Switchy links pointing at private content would be confusing.
- **Course URL**: Courses use their UUID as the path (`/academy/[courseId]`). The Switchy slug uses a slugified version of the course title to make it human-readable.
- **Learning paths**: Can be added in a follow-up — same pattern with prefix `p-` and `/academy/paths/[pathId]` as destination.
