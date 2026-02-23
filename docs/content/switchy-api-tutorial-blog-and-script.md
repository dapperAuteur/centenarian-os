# How to Auto-Create Tracked Short Links for Every Blog Post, Recipe, and Course You Publish — Using the Switchy.io API

*Published on BrandAnthonyMcDonald.com*
*Category: Developer Tutorials / Marketing Tech*

---

## Introduction

If you share content online — blog posts, recipes, course pages, landing pages — you're probably using a link shortener to track clicks. Switchy.io is one of the best for this because it gives you a clean dashboard, custom domains, and per-link analytics.

But most people use Switchy manually: copy the URL, paste it into the Switchy dashboard, pick a slug, hit create. That's fine for one link. When you're publishing dozens of posts or have a platform with hundreds of pieces of content, doing it by hand every time is a productivity killer.

This tutorial shows you how I automated this for my app **CentenarianOS** (centenarianos.com) — and how you can do the same for any Next.js application or really any server-side web app.

By the end of this post you will have:
- A short link automatically created in Switchy the moment any piece of content goes live
- Your custom domain (`i.yourdomain.com`) used for every link
- OG metadata (title, description, image) automatically set from your content
- Share buttons on your site that copy/share the short link so every share is tracked
- An admin page to backfill short links for all previously published content
- A clean TypeScript helper you can drop into any project

Let's go.

---

## Part 1: How the Switchy.io API Works

Switchy uses **GraphQL** for reads and **REST endpoints** for mutations (creating and updating links). As of 2026, the REST endpoints are the only way to create or update links — GraphQL mutations for links aren't exposed yet.

### The two endpoints you need

**Create a link:**
```
POST https://api.switchy.io/v1/links/create
```

**Update a link:**
```
PUT https://api.switchy.io/v1/links/:LINK_ID
```

### Authentication

Every request needs one header:
```
Api-Authorization: YOUR_TOKEN_HERE
```

Get your token:
1. Log into [switchy.io](https://switchy.io)
2. Go to your workspace
3. Settings → Integrations tab
4. Click **Generate a token**
5. Copy it — you won't see it again

Tokens are workspace-specific. If you have multiple workspaces (e.g., separate brands), each one has its own token.

### Creating a link — the request body

```json
{
  "url": "https://www.centenarianos.com/blog/anthony/longevity-habits",
  "domain": "i.centenarianos.com",
  "id": "b-longevity-habits",
  "title": "10 Longevity Habits That Actually Work",
  "description": "Science-backed habits from the world's longest-lived populations.",
  "image": "https://res.cloudinary.com/mycloud/image/upload/v123/longevity.jpg",
  "tags": ["blog"],
  "autofill": false
}
```

Field notes:
- `url` — the destination URL (required)
- `domain` — your custom short-link domain (required). Default is `hi.switchy.io` if you omit it, but you want your own domain here
- `id` — the custom slug. The final URL will be `https://i.centenarianos.com/b-longevity-habits`. If you omit this, Switchy generates a random ID
- `title`, `description`, `image` — open graph metadata shown in Switchy's dashboard and used for social preview cards
- `tags` — array of strings for organizing links in the Switchy dashboard
- `autofill: false` — tells Switchy not to try to auto-scrape metadata from the destination URL. Since we're providing everything explicitly, we set this to false

The response looks like this:
```json
{
  "id": "sw_abc123xyz",
  "short_url": "https://i.centenarianos.com/b-longevity-habits",
  "url": "https://www.centenarianos.com/blog/anthony/longevity-habits",
  "title": "10 Longevity Habits That Actually Work",
  ...
}
```

Save both `id` (the internal Switchy ID — you need this for updates later) and `short_url` (the short link users will see and share) to your database.

### Updating a link

When a post title changes or you update the cover image, you want Switchy's preview to reflect that:

```
PUT https://api.switchy.io/v1/links/sw_abc123xyz
```

Body:
```json
{
  "link": {
    "title": "Updated Title Here",
    "description": "Updated description",
    "image": "https://new-image-url.com/photo.jpg"
  }
}
```

Note the body is nested under a `link` key for updates (unlike creates where fields are top-level). This is a quirk of the Switchy API you need to know.

### Rate limits

- 10,000 links/day
- 1,000 links/hour

For most platforms this is plenty. If you're bulk-syncing thousands of posts, add a small delay between calls (100ms is enough to stay well under the hourly limit).

### Custom domain setup (required before any of this works)

1. In your DNS provider (Cloudflare, Namecheap, etc.), add a CNAME record:
   - **Name:** `i` (or whatever subdomain you want)
   - **Value:** the CNAME target Switchy provides (check their domain settings page)
2. In Switchy, go to Settings → Custom Domains → add `i.yourdomain.com`
3. Wait for DNS propagation (usually under 5 minutes on Cloudflare)
4. Verify it shows as "Active" in Switchy

---

## Part 2: Setting Up the Project

I'm building this in **Next.js 15** with TypeScript, but the pattern works in any Node.js environment. The concepts translate directly to Express, Nuxt, SvelteKit, or plain Node.

### Environment variables

Add these to your `.env.local` (and to Vercel / whatever host you use):

```bash
# Switchy
SWITCHY_API_TOKEN=your_token_from_switchy_settings
SWITCHY_DOMAIN=i.yourcustomdomain.com
```

Never expose `SWITCHY_API_TOKEN` to the client. It lives only in server-side code.

---

## Part 3: The Database Migration

We need two columns on each content table:

- `short_link_id` — the internal Switchy ID (like `sw_abc123xyz`). We need this to call the update endpoint later.
- `short_link_url` — the full short URL (`https://i.centenarianos.com/b-longevity-habits`). This is what we show users and put in share buttons.

```sql
-- 047_shortlinks.sql

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS short_link_id  TEXT,
  ADD COLUMN IF NOT EXISTS short_link_url TEXT;

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS short_link_id  TEXT,
  ADD COLUMN IF NOT EXISTS short_link_url TEXT;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS short_link_id  TEXT,
  ADD COLUMN IF NOT EXISTS short_link_url TEXT;
```

Run this in your Supabase SQL editor or as a migration file.

---

## Part 4: The Switchy Helper Library

Create `lib/switchy.ts`. This is the only file that talks to the Switchy API. Everything else calls functions from here.

```typescript
// lib/switchy.ts
// Server-only — never import this from client components or pages.

const API_BASE = 'https://api.switchy.io/v1';

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Api-Authorization': process.env.SWITCHY_API_TOKEN!,
  };
}

export interface SwitchyLink {
  id: string;         // Switchy internal ID — save this for updates
  short_url: string;  // The short link users see
}

interface CreateParams {
  url: string;        // Full destination URL
  slug: string;       // Custom slug for the short link
  title?: string;
  description?: string;
  image?: string;
  tags?: string[];
}

/**
 * Creates a short link. Retries with a random suffix if the chosen slug is already taken.
 * Returns null if Switchy is unreachable — callers should handle this gracefully.
 */
export async function createShortLink(params: CreateParams): Promise<SwitchyLink | null> {
  const domain = process.env.SWITCHY_DOMAIN ?? 'hi.switchy.io';

  const body = {
    url: params.url,
    domain,
    id: params.slug,
    title: params.title ?? undefined,
    description: params.description ?? undefined,
    image: params.image ?? undefined,
    tags: params.tags ?? [],
    autofill: false,
  };

  const res = await fetch(`${API_BASE}/links/create`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Slug already taken — retry once with a 6-char random suffix
    if (res.status === 409 || res.status === 422) {
      const suffix = Math.random().toString(36).slice(2, 8);
      const fallbackSlug = `${params.slug}-${suffix}`;
      const retry = await fetch(`${API_BASE}/links/create`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ ...body, id: fallbackSlug }),
      });
      if (!retry.ok) return null;
      return retry.json() as Promise<SwitchyLink>;
    }

    console.error('[Switchy] create failed:', res.status, await res.text());
    return null;
  }

  return res.json() as Promise<SwitchyLink>;
}

interface UpdateParams {
  linkId: string;     // The Switchy internal ID from when you created the link
  url?: string;       // Update destination URL (optional)
  title?: string;
  description?: string;
  image?: string;
}

/**
 * Updates metadata (title, description, image) or destination URL for an existing link.
 */
export async function updateShortLink(params: UpdateParams): Promise<boolean> {
  const res = await fetch(`${API_BASE}/links/${params.linkId}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({
      link: {
        ...(params.url && { url: params.url }),
        ...(params.title && { title: params.title }),
        ...(params.description && { description: params.description }),
        ...(params.image && { image: params.image }),
      },
    }),
  });

  if (!res.ok) {
    console.error('[Switchy] update failed:', res.status, await res.text());
    return false;
  }

  return true;
}

/**
 * Converts a title or slug into a Switchy-safe link ID.
 * Prefixed by content type to prevent collisions across blog/recipes/courses.
 *
 * Examples:
 *   toSwitchySlug('b', 'longevity-habits')    → 'b-longevity-habits'
 *   toSwitchySlug('r', 'Roasted Salmon Tacos') → 'r-roasted-salmon-tacos'
 *   toSwitchySlug('c', 'FDA Longevity Basics') → 'c-fda-longevity-basics'
 */
export function toSwitchySlug(prefix: 'b' | 'r' | 'c', text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${prefix}-${slug}`;
}
```

**Why the prefix system?**

You need the prefixes (`b-`, `r-`, `c-`) because Switchy slugs are global to your custom domain. If you have a blog post called "salmon" and a recipe called "salmon", both would try to claim `https://i.yourdomain.com/salmon`. The prefix makes them `b-salmon` and `r-salmon` — no conflict.

**Why the retry?**

If you've ever used "longevity-habits" as a slug before, it might already exist in Switchy. The retry appends 6 random alphanumeric characters to guarantee uniqueness without you having to think about it.

**Why `null` on failure?**

A Switchy API outage should never prevent your users from publishing content. The helper returns `null` on any unrecoverable error, and the calling code handles this by just not saving a short link. The share button falls back to the full URL. No broken UX.

---

## Part 5: Triggering Short Link Creation on Publish

The pattern is the same for every content type. I'll show the blog post version in detail.

```typescript
// app/api/blog/[id]/route.ts (PATCH handler — simplified)

import { createShortLink, updateShortLink, toSwitchySlug } from '@/lib/switchy';

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  // ... auth checks, DB update ...

  const body = await request.json();
  const { data: existing } = await supabase.from('blog_posts')
    .select('visibility, slug, title, excerpt, cover_image_url, short_link_id, username')
    .eq('id', id).single();

  // Apply the update to the database first
  const { data: updated } = await supabase.from('blog_posts')
    .update({ ...body })
    .eq('id', id)
    .select()
    .single();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  // CASE 1: First time this post is being published
  const justPublished = body.visibility === 'public' && existing?.visibility !== 'public';
  if (justPublished && !existing?.short_link_id) {
    // Fire-and-forget: don't block the response
    createShortLink({
      url: `${siteUrl}/blog/${existing.username}/${existing.slug}`,
      slug: toSwitchySlug('b', existing.slug),
      title: existing.title,
      description: existing.excerpt ?? undefined,
      image: existing.cover_image_url ?? undefined,
      tags: ['blog'],
    }).then(async (link) => {
      if (link) {
        await supabase.from('blog_posts')
          .update({ short_link_id: link.id, short_link_url: link.short_url })
          .eq('id', id);
      }
    }).catch(() => { /* Switchy being down never breaks publishing */ });
  }

  // CASE 2: Post is already published and metadata changed — update Switchy
  const alreadyPublished = existing?.visibility === 'public' && existing?.short_link_id;
  const metaChanged = body.title || body.excerpt || body.cover_image_url;
  if (alreadyPublished && metaChanged) {
    updateShortLink({
      linkId: existing.short_link_id,
      title: body.title ?? existing.title,
      description: body.excerpt ?? existing.excerpt,
      image: body.cover_image_url ?? existing.cover_image_url,
    }).catch(() => {});
  }

  return NextResponse.json(updated);
}
```

The key design decisions here:

1. **Database update happens first.** If Switchy fails, the post is still published. The short link is a bonus, not a blocker.
2. **`.then()` instead of `await`.** The Switchy call runs in the background. The HTTP response returns immediately. Your users don't wait for Switchy.
3. **We save both `short_link_id` and `short_link_url`** back to the database so we have what we need for future updates.
4. **We check `existing?.short_link_id` before creating** to avoid double-creating if the same post is saved multiple times.

Repeat this exact pattern in your recipe and course PATCH handlers, changing the slug prefix and the URL path:

- Recipe: `toSwitchySlug('r', recipe.slug)`, tags: `['recipe']`
- Course: `toSwitchySlug('c', course.title)`, tags: `['course']`

---

## Part 6: Using the Short Link in Share Buttons

Now that short links are stored in the database, we need to use them in share bars instead of the full URL.

Update the share URL builder:

```typescript
// lib/blog/share.ts

export function buildShareUrls(
  post: { title: string; slug: string; short_link_url?: string | null },
  username: string,
): ShareUrls {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const fullUrl = `${base}/blog/${username}/${post.slug}`;

  // Use the Switchy short link if it exists; fall back to the full URL
  const shareUrl = post.short_link_url ?? fullUrl;

  return {
    postUrl: shareUrl,
    email: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
  };
}
```

That's it. The share bar component doesn't need to change at all — it just receives whatever URL the builder produces. If a post was published before you added this feature and doesn't have a short link yet, it silently falls back to the full URL. No broken buttons, no error states.

Make sure your page server component selects `short_link_url` when it fetches the post:

```typescript
const { data: post } = await supabase
  .from('blog_posts')
  .select('title, slug, short_link_url, ...')
  .eq('slug', slug)
  .single();
```

---

## Part 7: The Admin Backfill Page

Your existing published content doesn't have short links yet. The admin backfill page lets you create them in bulk.

```typescript
// app/api/admin/shortlinks/sync/route.ts

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createShortLink, toSwitchySlug } from '@/lib/switchy';

export async function POST(request: NextRequest) {
  // Admin auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { type = 'all' } = await request.json().catch(() => ({}));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  let created = 0;
  let failed = 0;

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  if (type === 'blog' || type === 'all') {
    const { data: posts } = await db
      .from('blog_posts')
      .select('id, slug, title, excerpt, cover_image_url, profiles(username)')
      .eq('visibility', 'public')
      .is('short_link_id', null);

    for (const post of posts ?? []) {
      const username = (post.profiles as any)?.username ?? 'unknown';
      const link = await createShortLink({
        url: `${siteUrl}/blog/${username}/${post.slug}`,
        slug: toSwitchySlug('b', post.slug),
        title: post.title,
        description: post.excerpt ?? undefined,
        image: post.cover_image_url ?? undefined,
        tags: ['blog'],
      });

      if (link) {
        await db.from('blog_posts')
          .update({ short_link_id: link.id, short_link_url: link.short_url })
          .eq('id', post.id);
        created++;
      } else {
        failed++;
      }

      await delay(120); // ~8 req/sec — well within the 1,000/hour limit
    }
  }

  // Repeat for recipes and courses...

  return NextResponse.json({ created, failed });
}
```

The admin page at `/admin/shortlinks` shows counts and a button for each content type:

```
Blog posts:    47 with short links · 12 without
Recipes:       23 with short links · 4 without
Courses:       5 with short links · 0 without

[Sync Blog Posts]  [Sync Recipes]  [Sync Courses]  [Sync All]
```

Clicking "Sync Blog Posts" calls the API with `{ type: 'blog' }` and shows the returned `{ created, failed }`.

---

## Part 8: Seeing Your Clicks in Switchy

Once this is live, every share button click that results in someone clicking the short link shows up in your Switchy dashboard. You can see:

- Total clicks per link
- Geographic breakdown
- Device type (mobile vs desktop)
- Referring domain (did they click from Facebook? LinkedIn? A newsletter?)
- Clicks over time

Since all four share buttons (Copy Link, Email, LinkedIn, Facebook) use the same short link, Switchy consolidates all clicks in one place. You can compare your blog posts, recipes, and courses side by side to see which content actually drives traffic.

---

## Summary

Here's the full flow in plain English:

1. You publish a blog post by setting it to public
2. Your server updates the database — post is live
3. In the background, `createShortLink()` calls Switchy, gets back a short URL like `https://i.centenarianos.com/b-longevity-habits`
4. That short URL gets saved to the `short_link_url` column in your database
5. Next time anyone loads the blog post page, the share bar uses the short URL
6. When someone clicks "Copy Link" or shares to LinkedIn, they're sharing `https://i.centenarianos.com/b-longevity-habits`
7. Every click on that short link shows up in your Switchy dashboard with full analytics

The whole thing is about 80 lines of application code once you have the helper library written.

---

## The Code

All the code from this tutorial is in my open planning docs. I'm using this exact integration on CentenarianOS — so if you want to see how it fits into a real production Next.js app, that's a good reference.

---

*Anthony McDonald — BrandAnthonyMcDonald.com*

---
---
---

# VIDEO SCRIPT

**Title:** Auto-Create Tracked Short Links for Every Post You Publish — Switchy.io API Tutorial

**Format:** Screen share + talking head / voiceover
**Target length:** 18–22 minutes
**Audience:** Developers building content-heavy apps who want link tracking without manual work

---

## [INTRO — Talking head, 0:00–1:30]

Hey, what's up — Anthony McDonald here.

If you run a blog, a recipe site, an online course platform, or really any kind of content app, you're probably using a link shortener to track how your links perform when you share them on LinkedIn, Facebook, email, or anywhere else.

Switchy.io is my go-to for this. Custom domains, clean analytics, easy dashboard.

The problem is doing it manually is a pain. You publish a post, then you go to Switchy, paste the URL, set up the slug, add the title and image — it's like five steps every single time.

So I built an integration that does all of this automatically. The second I publish a blog post or a recipe on my app — CentenarianOS — it calls the Switchy API, creates the short link, saves it to my database, and from that point on every share button on that page is using the tracked short link.

Today I'm going to walk you through the whole thing. By the end of this video you'll be able to do this in any Node.js or Next.js app. Let's go.

---

## [SECTION 1 — Screen share: Switchy dashboard, 1:30–4:00]

Before we write any code, let me show you how the Switchy API works.

**[Show Switchy dashboard]**

This is the Switchy dashboard. You can see all my links here — each one has click counts, the destination, the short URL.

For our integration we need two things from Switchy: the API token and a custom domain.

**[Navigate to Settings → Integrations]**

Click on Settings, then the Integrations tab. Click Generate Token. Copy this — you'll never see it again. Paste it somewhere safe. This goes in your environment variables as `SWITCHY_API_TOKEN`.

**[Navigate to Settings → Custom Domains]**

Now Custom Domains. I've already set up `i.centenarianos.com`. To do this yourself, you add a CNAME record in your DNS provider pointing to whatever Switchy tells you here. On Cloudflare this propagates in about 30 seconds.

If you don't have a custom domain set up, Switchy will use `hi.switchy.io` by default, but you really want your own domain because that's what your users see in the share preview.

---

## [SECTION 2 — Screen share: API docs / Postman, 4:00–7:00]

Now let me show you the actual API calls before we build the helper.

**[Open a terminal or show a curl command]**

Creating a link is a POST to `https://api.switchy.io/v1/links/create`. The only required header is `Api-Authorization` with your token. The body is JSON.

Let me show you the minimal version first:

```bash
curl -X POST https://api.switchy.io/v1/links/create \
  -H "Content-Type: application/json" \
  -H "Api-Authorization: YOUR_TOKEN" \
  -d '{
    "url": "https://www.centenarianos.com/blog/anthony/longevity-habits",
    "domain": "i.centenarianos.com",
    "id": "b-longevity-habits"
  }'
```

Run that and Switchy comes back with a JSON object including `id` — that's the internal Switchy ID — and `short_url` — that's the actual link your users will click.

**[Show the response]**

Two things to save: the `id` for later updates, and the `short_url` to show in your share buttons.

Now let me show you how to update a link. You hit the `PUT /v1/links/:LINK_ID` endpoint — note the internal Switchy ID in the URL, not the slug. And notice the body is nested under a `link` key — this is different from the create call. This trips people up.

```bash
curl -X PUT https://api.switchy.io/v1/links/SWITCHY_INTERNAL_ID \
  -H "Content-Type: application/json" \
  -H "Api-Authorization: YOUR_TOKEN" \
  -d '{
    "link": {
      "title": "Updated Post Title",
      "image": "https://new-cover-image-url.com"
    }
  }'
```

Okay, that's the API. Now let's wrap this in TypeScript.

---

## [SECTION 3 — Screen share: VS Code, writing lib/switchy.ts, 7:00–12:00]

**[Open VS Code, navigate to lib/]**

I'm going to create `lib/switchy.ts`. This is the only file in the whole app that knows how to talk to Switchy.

**[Type out the file live, talking through each section]**

Let me walk you through what I'm building here.

First, the `headers()` function. This just returns the two headers every Switchy request needs. I'm pulling the token from environment variables — never hardcode this.

```typescript
function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Api-Authorization': process.env.SWITCHY_API_TOKEN!,
  };
}
```

Next, `createShortLink`. This is the main function.

The slug is the `id` field in Switchy — it's the custom part after your domain. I have a naming convention here: all blog post slugs start with `b-`, recipes with `r-`, courses with `c-`. That's because slugs are global to your domain. If you have a blog post called "salmon" and a recipe called "salmon" and they both try to use `/salmon`, you've got a conflict. The prefix prevents that.

**[Talk through the retry logic]**

Now this bit is important. What happens if the slug is already taken? Switchy returns a 409 conflict. We catch that and retry with a random 6-character suffix appended to the slug. Something like `b-longevity-habits-a7f3bz`. It's not as clean as the original but it works.

**[Talk through the return null pattern]**

The function returns `null` if Switchy is down or the create fails after retry. This is intentional. When I call this from my publish handler, I do NOT let a Switchy failure prevent the content from publishing. The short link is a bonus — the content going live is what matters. So: return null, handle null gracefully in the caller.

**[Write the toSwitchySlug helper]**

This utility converts any string into a URL-safe slug. Standard stuff — lowercase, replace non-alphanumeric with hyphens, trim hyphens from edges, cap at 50 characters.

---

## [SECTION 4 — Screen share: triggering on publish, 12:00–16:00]

**[Open app/api/blog/[id]/route.ts]**

Now I'm going to add the Switchy call to my blog post PATCH handler. This is the API route that runs when someone saves a blog post in the editor.

**[Scroll to where the DB update happens]**

The key here is timing. I do the database update first. The post is already saved and published before Switchy ever gets called. Then I call Switchy in the background using `.then()` — not `await`. This means the HTTP response goes back to the browser immediately, and Switchy runs in parallel.

**[Type out the publish trigger block]**

```typescript
const justPublished = body.visibility === 'public' && existing?.visibility !== 'public';

if (justPublished && !existing?.short_link_id) {
  createShortLink({
    url: `${siteUrl}/blog/${username}/${post.slug}`,
    slug: toSwitchySlug('b', post.slug),
    title: post.title,
    description: post.excerpt,
    image: post.cover_image_url,
    tags: ['blog'],
  }).then(async (link) => {
    if (link) {
      await supabase.from('blog_posts')
        .update({ short_link_id: link.id, short_link_url: link.short_url })
        .eq('id', postId);
    }
  }).catch(() => {});
}
```

Notice: we check `existing?.short_link_id` first. If this post somehow already has a short link, we don't create another one.

We also handle the update case — if the post is already published and the title or cover image changes, we call `updateShortLink` in the same background fashion. The Switchy preview card stays accurate.

---

## [SECTION 5 — Screen share: share buttons, 16:00–18:30]

**[Open lib/blog/share.ts]**

Last piece: making the share buttons actually use the short link.

All I'm doing here is one line. Instead of building `shareUrl` from the full URL every time, I check if `post.short_link_url` exists. If it does, use that. If not, fall back to the full URL.

```typescript
const shareUrl = post.short_link_url ?? fullUrl;
```

That's literally it. The share bar component doesn't change at all. It just gets a different URL to work with.

**[Show the Switchy dashboard with a few test clicks]**

And here's what you see in Switchy after testing. Every time someone clicks the short link from any platform, it shows up here. You can see total clicks, where people are coming from geographically, what device they're on, and whether they came from LinkedIn, Facebook, email, or direct.

---

## [OUTRO — Talking head, 18:30–20:00]

That's the whole integration. To recap:

- Switchy API: POST to create, PUT to update, `Api-Authorization` header, your custom domain in the `domain` field
- Keep a `short_link_id` and `short_link_url` in your database for every piece of content
- Trigger creation on publish — fire and forget, don't block your publish handler
- Use the short link in share buttons with a graceful fallback to the full URL
- One admin page to backfill everything that was published before you set this up

The big thing I want you to take away is the **fire-and-forget pattern**. A Switchy outage, a rate limit hit, a bad API response — none of those should ever stop your users from publishing content. The short link is a marketing feature. Your core functionality has to work regardless.

If this was helpful, share it. The code is all in the blog post at BrandAnthonyMcDonald.com if you want to copy-paste.

See you in the next one.

---

## VIDEO PRODUCTION NOTES

**Screen share sections:**
- Switchy dashboard (workspace overview, Settings → Integrations, Settings → Custom Domains)
- Terminal running the curl commands from Section 2
- VS Code writing `lib/switchy.ts` (Section 3)
- VS Code editing the PATCH handler (Section 4)
- VS Code editing `lib/blog/share.ts` (Section 5)
- Switchy analytics dashboard showing test clicks (end of Section 5)

**B-roll suggestions:**
- Phone showing a shared link on LinkedIn / Facebook
- Dashboard loading with click counts going up in real time

**Thumbnail idea:**
- Code on left: `createShortLink({ url: '...' })`
- Arrow pointing right
- Switchy dashboard showing click analytics
- Text overlay: "Auto-tracked short links for every post"

**Tags:** switchy.io, link shortener API, Next.js tutorial, link tracking, marketing automation, TypeScript, short links custom domain
