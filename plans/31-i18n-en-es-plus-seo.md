# Plan 31 — Internationalization (EN + ES) and SEO Metadata

> **Status:** Backlog. No code yet.
> **Source:** owner request 2026-04-16.
> **Effort:** large — estimate 1–2 weeks of focused work depending on surface area.

---

## 1. Context

Two adjacent concerns the owner wants bundled:

1. **i18n:** every user-facing string in the app needs to live in a dictionary file so it can be translated. Ship English and Spanish as the first two locales. Target audience is US + Latin American users.
2. **SEO:** every routable page — marketing, blog posts, academy course pages, public teacher pages — should have proper `<title>`, `<meta description>`, OG tags, Twitter cards, canonical URLs, and structured data where relevant (schema.org/Course, schema.org/Recipe, schema.org/Article).

These go together because a translated page needs its metadata translated too. Splitting them into two plans risks shipping Spanish strings with English meta descriptions.

## 2. Scope

**i18n scope:**
- Use Next.js App Router's built-in i18n routing with `/en/*` and `/es/*` prefixes OR a middleware-based locale detection that rewrites internally without URL prefixes. **Prefer prefixed routes** — better for SEO, better for shareable language-specific URLs.
- Ship with `next-intl` or a lightweight custom dictionary loader. `next-intl` is well-supported and integrates with App Router — recommended unless the school dev network blocks the npm install (known constraint per CLAUDE.md context).
- Dictionaries organized by route or feature: `locales/en/common.json`, `locales/en/academy.json`, `locales/en/planner.json`, etc. One file per major feature area to keep diffs reviewable.
- Spanish translations are NOT Claude's to write — they need a native Spanish speaker or a translation service. Ship EN-only dictionary strings first; ES files are placeholders (copied from EN) until translations come back.
- All user-facing strings in code replaced with `t('key')` calls. This is the biggest chunk of work.

**SEO scope:**
- Every page.tsx exports `generateMetadata()` returning `Metadata` with title, description, openGraph, twitter, alternates (canonical + language alternates), and (where applicable) `structuredData`.
- Blog posts and Academy courses get schema.org/Article and schema.org/Course JSON-LD.
- Recipes already have schema.org/Recipe import (from existing recipe import feature) — add generation for outbound pages too.
- Sitemap: `app/sitemap.ts` enumerates every public URL (including /en and /es variants) for both English and Spanish surfaces.
- robots.txt reviewed; `hreflang` tags in HTML head.

**Out of scope:**
- Additional locales (FR, PT, etc.) — design allows expansion but only EN/ES ship.
- RTL layouts — both EN and ES are LTR.
- Translating user-generated content (blog posts, course content, recipes authored by users). That's a user-side task, potentially with a "Translate with AI" button as a follow-up feature.

## 3. Phased approach

Trying to convert 500+ strings and ship SEO metadata in one branch is a bad idea. Phase it:

### Phase 1 — infrastructure
- Add `next-intl` (or fallback dict loader) + middleware locale detection.
- Set up dictionary file structure under `locales/`.
- Add `<html lang={locale}>` and the locale context provider to root layout.
- Migrate **one** surface (recommendation: marketing home page + pricing) to prove the pattern end-to-end.
- Ship SEO metadata for those same pages.

### Phase 2 — marketing + public surfaces
- Public blog, blog post detail, public Academy catalog, course detail, teacher profile.
- Each gets a translated dictionary file and full SEO metadata + JSON-LD.

### Phase 3 — authenticated app
- Dashboard surfaces: Planner, Finance, Travel, Workouts, etc.
- This is the biggest chunk (~70% of strings).
- SEO doesn't really apply here (authenticated routes are `noindex`).

### Phase 4 — error, email, legal
- Error boundaries, transactional emails (receipt, notification), privacy policy, terms.

Each phase is its own branch. Phase 1 is ~1 day; phases 2–3 are ~3–5 days each depending on scope audit.

## 4. Database + content implications

- User-facing content stored in the database (course titles, blog post titles, recipe names) does **not** auto-translate. Two options:
  1. Add a `translations` JSONB column to each user-content table (`courses.translations = { es: { title: "..." } }`) and let authors enter both.
  2. Wrap it in a separate `translations` table keyed by (entity_type, entity_id, locale, field).
- **Recommendation:** option 1 for now — lower migration cost. Revisit if it turns ugly.
- Navigation labels, button labels, system strings all come from dictionaries — no DB changes.

## 5. SEO structured-data targets

| Entity | Schema.org type |
|---|---|
| Blog post | Article |
| Course | Course |
| Course lesson | LearningResource |
| Recipe | Recipe (already imported, add outbound generation) |
| Teacher profile | Person |
| Podcast | PodcastSeries / PodcastEpisode |
| FAQ on pricing | FAQPage |

## 6. Pre-flight open questions

- Does the school dev network block `next-intl` installation? If yes, custom dict loader (pattern already used for `fuse.js` per context).
- Is there a preferred translation partner? Machine translation (DeepL, Google Translate API) vs. human? **Recommendation:** machine translate the first pass for ES, then have a native speaker review the top-20-traffic pages before formally launching ES.
- SEO audit: has anyone run the current site through Lighthouse / Ahrefs / Screaming Frog? Useful baseline before we start tagging.

## 7. Next actions for the human

1. Decide locale URL strategy: prefixed `/es/*` (SEO) vs. cookie-based (cleaner URLs, worse SEO). **Recommendation: prefixed.**
2. Decide translation source: machine + human review, or human-only from day one?
3. Identify the 20 most-trafficked public pages (owner has analytics via Umami) — those are Phase 2's priority.
4. Greenlight Phase 1 when ready.
