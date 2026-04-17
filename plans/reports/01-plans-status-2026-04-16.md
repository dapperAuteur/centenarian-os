# Plans Status Report — 2026-04-16

> Generated before the style-guide branching-rule update. Will be appended
> with the style-guide change at the bottom once the commit lands.

---

## 1. Shipped to `main`

All 360° / virtual-tour work is merged and running. Migrations 175–179 are required; 179 was the most recent and should be in the DB.

### Plan 20 — Academy 360° video lessons
Ships as four separate branches (foundation + three downstream):

| Branch | Commit | What |
|---|---|---|
| `feat/academy-360-video` | `2df3c46` | Migration 175 (`lesson_type='360video'`, `video_360_autoplay`), `Lesson360VideoPlayer`, PSV deps, CSS shim |
| `feat/academy-360-learner` | `aa8e2b9` | Wires player into `app/academy/[courseId]/lessons/[lessonId]/page.tsx` |
| `feat/academy-360-teacher` | `9ad6418` | 360° Video option in the pre-CurriculumTab teacher editor |
| `feat/academy-360-upload` | `8bfaf63` | `Cloudinary360Uploader` with 500 MB cap (later tightened) + chunked upload |

### Plan 21 — Academy 360° photo lessons
Single branch.

| Branch | Commit | What |
|---|---|---|
| `feat/academy-360-photos` | `e85d50a` | Migration 176 (`photo_360` lesson type), `Lesson360PhotoPlayer`, uploader extended to `resourceType='image'` |

### Plan 22 — 360° poster fallback
Single branch.

| Branch | Commit | What |
|---|---|---|
| `feat/academy-360-poster-fallback` | `4a91cd8` | Migration 177 (`video_360_poster_url`), `lib/cloudinary/poster.ts`, player loading-state image, poster persistence |

### Plan 23 — Virtual tours
Shipped in three sequential branches following the plan's own 23a/23b/23c guidance.

| Branch | Commit | What |
|---|---|---|
| `feat/academy-virtual-tours-foundation` | `bf19863` | Migration 178 (`tour_scenes`, `tour_hotspots`, `tour_scene_links` + `lesson_type='virtual_tour'`), API (`GET/PUT /api/academy/courses/[id]/lessons/[lessonId]/tour`), `VirtualTourPlayer`, `lib/academy/tour-types.ts` + `assembleTour.ts`, teacher dropdown option |
| `feat/academy-virtual-tour-editor` | `c8aca62` | Full-screen scene editor at `/dashboard/teaching/courses/[id]/tour/[lessonId]` — scene CRUD, hotspot form modal, scene-link form modal, publishing guard |
| `feat/academy-tour-completion-tracking` | `57bcf56` | Migration 179 (`tour_progress JSONB` on `lesson_progress`), progress GET/POST handlers extended, hotspot visit tracking, "N of M hotspots visited" badge, completion on all-visited |

### Shipped bug fixes and infrastructure

| Branch | Commit | What |
|---|---|---|
| `chore/style-guide` | — | Initial STYLE_GUIDE.md |
| `docs/style-guide-gitignored-dirs` | `e5535ec` | Added `docs/` branch prefix + documented that `plans/` and `content/` are gitignored |
| `docs/style-guide-validation-files` | `75cc6f6` | Required matching `plans/validate/NN-slug.md` for every plan |
| `chore/rename-cloudinary-sign-route` | `066d97f` | Consolidated duplicate signing routes into `/api/cloudinary/sign` |
| `bug/dropdown-contrast` | `8eb8fec` | First pass at dark-dropdown styling (option CSS) |
| `bug/dropdown-contrast-color-scheme` | `f8e58d3` | Reliable fix via `color-scheme: dark` |
| `bug/course-editor-contrast` | `0000e49` | Swept 31 × `text-gray-600/700` → `text-gray-400/500` across course editor tabs |
| `bug/cloudinary-key-and-form-contrast` | `14015cf` | `next.config.mjs` aliases `CLOUDINARY_API_KEY` to `NEXT_PUBLIC_CLOUDINARY_API_KEY` at build time + 19 × placeholder contrast |
| `bug/upload-lrv-format` | `f6f0ec2` | First attempt adding LRV to uploader (later reverted — LRV is a flat proxy, not 360°) |
| `bug/360-upload-lrv-and-100mb` | `ccffa33` | Removed LRV from allowlist, dropped cap to 100 MB to match Cloudinary free tier, added helper explaining Insta360 Studio export |
| `feat/curriculum-tab-lesson-editing` | `7b80af1` | Pencil-edit on lesson rows + content_url input + 360° options (bridged the gap between two parallel editors) |
| `chore/consolidate-course-editors` | `bfb7662` | Deleted the username-prefixed editor (−1,298 lines); pointed course list to canonical `/dashboard/teaching/courses/[id]` |
| `feat/inline-lesson-chapter-editing` | `da7bd65` | Chapter marker + transcript editor inside the inline-edit flow |
| `feat/icon-button-tooltips` | `fcd6a02` | `title` attrs on icon-only buttons in course editor and media players |
| `feat/360video-chapter-markers` | `d5a21f9` | Enabled chapter editor for `lesson_type='360video'` |
| `bug/cloudinary-api-key-env-rename` | `e493ffb` | Server-side usage moved to `CLOUDINARY_API_KEY` (no NEXT_PUBLIC prefix) |
| `bug/tour-editor-ux` | `4a5bafc` | Modals docked right, live yaw/pitch readout on preview, "place hotspot/link here" capture buttons, yaw/pitch input bounds |
| `bug/tour-403-diagnostic-and-chapter-labels` | `69cb5f6` | Tour auth returns `{ reason }` codes; chapter inputs got labels + help text |
| `bug/restore-tour-reason-parsing` | `86b2847` | Restored the client-side reason handler that got dropped in conflict resolution |

---

## 2. Backlog (written, not started)

Each has a matching `plans/validate/NN-slug.md` sign-off file.

| # | Plan | Size | Notes |
|---|---|---|---|
| 24 | Academy 360° transcripts | small (~2 days) | Extract shared `TranscriptPanel`; wire into `Lesson360VideoPlayer`. No migration needed. |
| 25 | Academy 360° offline caching | medium (~1 week) | Service Worker + IndexedDB. Migration 179 is taken; next is 180. iOS Safari blob test flagged as risk. |
| 26 | Academy Insta360 import | medium, **blocked** | §3 external research required before coding (SDK availability, NDA, usage data). May collapse into a drag-and-drop one-day feature. |
| 27 | Academy media library | large (~2 weeks) | Per-teacher library with naming, tagging, fuzzy search, delete/replace. Migration 181. |
| 28 | — | **deleted** | Was destinations/scenes search; belonged to the Wanderlearn project. |
| 29 | Error handling UI/UX/DX | medium | Custom 404/500 pages, error boundaries, toast system, analytics 404 suppression. |

---

## 3. Infrastructure & open blockers

- **Migrations 175–179** must be applied to the deployment. Running 179 is the most recent ask.
- **Analytics 404** at `/a/script.js` and `/a/api/send` — `next.config.mjs` rewrites for PostHog/Plausible are misconfigured or the service endpoint changed. **Not a code issue.** Plan 29 covers graceful handling.
- **School network npm install** — `lightspeed.hseschools.org` intercepts `registry.npmjs.org` and returns HTML, breaking `npm install`. User works around this from home. Type shims were used once (plan 23a) and removed once plugins landed.
- **Cloudinary env var** — set `CLOUDINARY_API_KEY` (no `NEXT_PUBLIC_` prefix) on Vercel and locally. `next.config.mjs` aliases it to `NEXT_PUBLIC_CLOUDINARY_API_KEY` at build time for the upload widget.

---

## 4. Documentation state

- [STYLE_GUIDE.md](../../STYLE_GUIDE.md) — collaboration rules
- [CLAUDE.md](../../CLAUDE.md) — code style and a11y mandates
- `plans/NN-slug.md` — 9 active plans (20–27, 29), 1 deleted (28)
- `plans/validate/NN-slug.md` — validation checklists for each plan
- `content/tutorials/academy/14-360-video-lessons.md` — learner tutorial for 360° lessons
- `content/tutorials/teaching/16-publishing-360-videos.md` — teacher tutorial

---

## 5. Recommended next actions

In order of priority:

1. **Run migration 179** if not already applied (`tour_progress JSONB` on `lesson_progress`).
2. **Plan 24 (360° transcripts)** — smallest remaining piece in the 360° arc; extracts the shared TranscriptPanel and wires it into the video player. Estimated 2 days.
3. **Plan 29 (error handling)** — user-surfaced need after the "black screen on error" report. Medium effort.
4. **Plan 27 (media library)** — large but high-value: naming/tagging/search solves the "LRV_20260408_164622_01_015" readability problem.
5. **Plan 25 (offline)** or **Plan 26 (Insta360)** — defer until 24/27 land and 26's research is unblocked.

---

## 6. Session outcome

### Style guide update — `docs/style-guide-stricter-branching-rule` (`56cccb0`)

Committed to `docs/style-guide-stricter-branching-rule` on 2026-04-16. Awaiting user merge to `main`.

**Files changed (2 insertions, 0 deletions):**

- `STYLE_GUIDE.md` — +18 lines
  - New **§0 "The golden rule: branch first, commit last"** at the top of the document. Spells out the exact five-step workflow (checkout main → pull → branch → edit → commit), names the recovery move for anyone who catches themselves editing on `main` (stash + branch + pop + continue), and states "No exceptions, no direct commits to main, no 'it's just a tiny fix.'"
  - §3 Conventional Commits prefaced with an explicit instruction: **write the commit message at the END of the work**, describing the changes that were actually made — not intent, not ticket title, not plan. Rewrite the body if the diff disagrees.
- `CLAUDE.md` — +2 lines
  - Added a second blockquote at the top summarizing the golden rule with a link to STYLE_GUIDE.md §0, so readers who open the code-style doc first also see the workflow rule.

**Tests:** docs-only change, no typecheck needed (confirmed clean anyway).

**Commit message (actual):**
```
docs(style): make branch-first + descriptive-commit rules unmissable
```
with a three-paragraph body describing the §0 addition, the §3 preface, and the CLAUDE.md link-back.

### Impact on existing plans

None of the plans 20–29 require edits — they were already written and executed assuming these rules were in effect. The update codifies what was already practiced, closes the ambiguity for the next contributor, and gives future-me a clear line to point at if anyone tries to commit to `main`.

### What to do next (unchanged from §5 above)

1. Merge `docs/style-guide-stricter-branching-rule` (`56cccb0`) to `main`. ✓ **Done.**
2. Run migration 179 if not already applied.
3. Proceed with plan 24 (360° transcripts) as the smallest remaining item in the 360° arc. ✓ **Done — see §7 below.**

---

## 7. Plan 24 shipped — `feat/academy-360-transcripts` (`c199b89`)

Committed 2026-04-16. Awaiting user merge to `main`.

**Files changed (5 files, +160 / −93 lines):**

- `components/academy/TranscriptPanel.tsx` (new, 97 lines) — extracted shared transcript UI with click-to-seek, auto-scroll to active segment, and `aria-live="polite"` announcements. Takes `{ transcript, currentTime, onSeek, onCollapse }`.
- `components/academy/VideoPlayer.tsx` (−32 lines net) — removed inline transcript JSX + `transcriptRef` + auto-scroll effect; renders `<TranscriptPanel>` when toggled. No behavior change.
- `components/academy/AudioPlayer.tsx` (−38 lines net) — same refactor. No behavior change.
- `components/academy/Lesson360VideoPlayer.tsx` (+43 lines) — new optional `transcript` prop; VideoPlugin reference captured in a ref so TranscriptPanel's `onSeek` can call `plugin.setTime()`; `currentTime` state updated in the existing 'progress' event listener; new transcript toggle button overlayed top-right on the player; renders `<TranscriptPanel>` below when toggled.
- `app/academy/[courseId]/lessons/[lessonId]/page.tsx` — passes `lesson.transcript_content` through to `Lesson360VideoPlayer` (Lesson type already had `transcript_content` from plan 23).

**No migration. No new env vars. No new packages.** Typecheck clean.

**Behavior delivered:**

- A 360° video lesson whose `transcript_content` JSONB is populated now shows a document-icon toggle in the top-right of the player. Tapping it slides out the shared transcript panel below the player.
- Active segment highlights in fuchsia and auto-scrolls into view as the video plays (same behavior as flat video).
- Clicking a transcript segment calls `VideoPlugin.setTime(segment.startTime)`, seeking the 360° video to that timestamp. The pan orientation is preserved (learner stays looking at the same point in the scene).
- `VideoPlayer` and `AudioPlayer` continue to behave identically to before this branch, just with less code duplication.

**Impact on other plans:**

- Plan 25 (offline caching) — the shared TranscriptPanel is a natural candidate for caching alongside the media; worth a mention in plan 25's validation.
- Plan 27 (media library) — unaffected.
- Plan 29 (error handling) — TranscriptPanel is a leaf component with no error paths beyond parent props; no change needed.

### Remaining backlog (unchanged priorities)

- Plan 25 (offline) — medium, ~1 week
- Plan 27 (media library) — large, ~2 weeks
- Plan 29 (error handling UX) — medium
- Plan 26 (Insta360) — blocked on §3 research

### Commit chain since last report

| Commit | Branch | Description |
|---|---|---|
| `56cccb0` | `docs/style-guide-stricter-branching-rule` | Strengthened branching + commit-message rules |
| `c199b89` | `feat/academy-360-transcripts` | Shared TranscriptPanel + 360° video transcript |
| `41ea63a` | `feat/error-handling-ux` | Error boundaries, toast system, structured error logger |
| `4056efb` | `feat/academy-media-library-foundation` | Media library schema, API, page, auto-register on upload |
| `fa5f4cf` | `feat/academy-media-library-search-picker` | Fuzzy search, tag filter, library picker in lesson editor |

---

## 8. Plan 29 shipped — `feat/error-handling-ux` (`41ea63a`)

Committed 2026-04-16. Awaiting user merge to `main`.

**Files changed (7 files, +512 / −12 lines):**

- `app/error.tsx` (new) — client error boundary catching uncaught errors below `/app`. Branded card with "Try again" (calls `reset()`) + "Go home" actions, shows Next.js error digest.
- `app/global-error.tsx` (new) — last-resort boundary for errors inside the root layout. Dependency-free, inline styles only (globals.css may not have loaded when this fires).
- `app/academy/error.tsx` (new) — academy-specific boundary with "Your progress is safe" copy and "Back to Academy" link. Takes precedence over `app/error.tsx` for `/academy/*`.
- `app/dashboard/error.tsx` (new) — dashboard-specific boundary using the dark palette so dashboard pages don't flash from dark to light on error.
- `lib/error-logging.ts` (new) — single `logError(err, { module, digest, context })` entry point. Dev emits grouped console output; prod emits single-line JSON prefixed `[centos-error]` for log aggregators. One place to add Sentry later.
- `components/ui/ToastProvider.tsx` (new) — custom lightweight toast system. `useToast()` hook exposes `success` / `error` / `info` / `dismiss`. Success + info auto-dismiss after 5s; errors stick (users need to actually read them). `aria-live="polite"`; error-kind toasts get `role="alert"`.
- `app/layout.tsx` — wraps children in `<ToastProvider>`; tightens the Umami analytics script condition so `/a/script.js` only mounts when `NEXT_PUBLIC_UMAMI_SCRIPT_URL` or `UMAMI_HOST_URL` is set (previously it mounted whenever the site ID was present, causing the `/a/script.js` and `/a/api/send` 404s in dev).

**Existing `app/not-found.tsx` was adequate and was left untouched.**

### Behavior delivered

- Any uncaught error below `/app/` renders the branded `app/error.tsx` recovery surface instead of a black screen. Academy routes get the academy-specific version; dashboard routes get the dark-themed version.
- Errors in the root layout itself fall through to `app/global-error.tsx` with inline styles, so the UI still comes up even if globals.css or the layout provider tree is broken.
- Every boundary logs the error through the shared `logError` helper so future Sentry integration is a one-file change.
- Toast system is mounted globally; any client component can now call `useToast()` and surface success/error/info messages without writing a mini-provider per feature.
- Umami analytics 404 noise in dev is gone — the script only mounts when there's actually somewhere for it to go.

### Impact on other plans

- **Plan 27 (media library)** — can use `useToast()` for upload/delete/replace feedback without wiring its own notification layer.
- **Plan 25 (offline caching)** — failed fetches should call `useToast().error('You\u2019re offline')` for instant feedback.
- **All future features** — use `logError()` instead of bare `console.error()` so production logs stay greppable.

### Follow-up work (not in this branch)

- A global CSS rewrite returning 204 for `/a/script.js` would be belt-and-suspenders for the analytics suppression. The `next.config.mjs` approach wasn't strictly needed once the layout condition was tightened — the 404 no longer happens.
- `useToast()` adoption sweep: replace scattered `console.error` + silent-catch patterns across the app with toasts. Follow-up branch after this ships.

### Remaining backlog (unchanged priorities)

- Plan 25 (offline) — medium, ~1 week
- Plan 27 (media library) — large, ~2 weeks
- Plan 26 (Insta360) — blocked on §3 research

---

## 9. Plan 27a shipped — `feat/academy-media-library-foundation` (`4056efb`)

Committed 2026-04-16. Awaiting user merge to `main`. **Migration 180 must run after merge.**

Plan 27 split into two branches per the plan's own guidance; this is 27a (foundation). Plan 27b (search + tags + picker) is the next queued item.

**Files changed (10 files, +935 / −1 lines):**

- `supabase/migrations/180_media_assets.sql` (new) — `media_assets` table keyed by `(owner_id, cloudinary_public_id)`. `pg_trgm` extension + GIN indexes on `name` (trigram) and `tags` so plan 27b's fuzzy search already has its indexes. RLS: owner-only.
- `lib/academy/media-types.ts` (new) — `MediaAsset`, `MediaAssetReference`, `AssetKind` types.
- `app/api/academy/media/route.ts` (new) — GET list (owner-scoped, optional `kind` filter), POST upsert on `(owner_id, public_id)`.
- `app/api/academy/media/[id]/route.ts` (new) — PATCH name/description/tags, DELETE with 409 + reference count when any lesson still uses the URL.
- `app/api/academy/media/[id]/references/route.ts` (new) — lists lessons referencing the asset via `content_url` or `video_360_poster_url`, each tagged with the matching field.
- `app/dashboard/teaching/media/page.tsx` (new) — mount point.
- `components/academy/media-library/MediaLibrary.tsx` (new) — top-level container with list/select/save/delete/references wiring; uses `useToast()` for user-visible errors and `logError()` for structured logging.
- `components/academy/media-library/MediaGrid.tsx` (new) — responsive 2/3/4-column thumbnail grid. Image/panorama_image show their own URL; videos show the Cloudinary `so_0` first-frame transform; audio/document/other get icon tiles.
- `components/academy/media-library/MediaDetailPanel.tsx` (new) — right-side panel with editable name/description/tags, read-only metadata, Cloudinary link, collapsible "Lessons using this asset" (lazy-loaded), delete with explicit "Cloudinary file untouched" note.
- `components/academy/Cloudinary360Uploader.tsx` — fire-and-forget POST to `/api/academy/media` after a successful upload. Failures are swallowed + logged via `logError` so they never block the lesson save path. Existing `onUploadSuccess` callback signature is unchanged — no caller edits needed.

### Behavior delivered

- Every 360° upload a teacher makes through `Cloudinary360Uploader` now registers automatically in the library with filename, dimensions, duration, and byte size. Existing 360° lessons that uploaded before this branch won't retroactively appear (one-time backfill is a separate task if you want it).
- Navigating to `/dashboard/teaching/media` shows the library as a grid of thumbnails. Click a tile → right-side panel opens with the full asset details.
- Rename an asset ("IMG_20260411_143022_001" → "Main hall walkthrough"), add a description and tags, save → the grid tile updates.
- Delete an asset with no references → gone. Delete one that's referenced → blocked with "Can't delete — this asset is referenced by N lessons. Unwire those lessons first."
- "Lessons using this asset" expands into a clickable list of the exact lesson + course pairs, each tagged content/poster so the teacher knows where to find it.
- All error paths toast via `useToast()` (plan 29's system) and log structured via `logError()` — zero bare `console.error()` calls.

### Plan 27b (deferred to next branch)

- **Fuzzy search** — Fuse.js over name + description + tags. Indexes already exist in the DB; 27b just needs the client integration and a search bar in the library header.
- **Tag filter chips** — clickable chips in the header that narrow the grid to assets carrying the selected tag(s).
- **"Pick from library" button** — new flow in the CurriculumTab URL input for 360° lesson types. Opens a `MediaPickerModal` that reuses the grid + search.
- **Replace-file action** — upload a new version of an existing asset; all referring lessons auto-pick-up the new URL via `media_assets` join (design decision pending — simpler path may be to keep the public_id stable and overwrite, so content_url doesn't even need to change).

### Merge order

1. Merge `feat/error-handling-ux` (`41ea63a`) first — media library imports `useToast` and `logError` from it.
2. Merge `feat/academy-media-library-foundation` (`4056efb`).
3. Run `psql ... -f supabase/migrations/180_media_assets.sql`.
4. Visit `/dashboard/teaching/media` — empty state.
5. Upload a 360° asset via any existing lesson → refresh the library page → the asset appears.

---

## 10. Plan 27b shipped — `feat/academy-media-library-search-picker` (`fa5f4cf`)

Committed 2026-04-16. Awaiting user merge to `main`. **Run `npm install` from a working network before merging** — the school Lightspeed filter blocked `fuse.js` the same way it blocked PSV plugins during plan 23a. Package.json references the dep; a local type shim keeps `tsc` green until the real package lands.

Plan 27 is now fully shipped (27a foundation + 27b this branch).

**Files changed (7 files, +484 / −8 lines):**

- `lib/academy/media-search.ts` (new) — `filterAssets(assets, query, tags)` combines AND-tag-filter with fuzzy Fuse.js search over name/description/tags. `uniqueTags()` returns the sorted distinct set. Threshold 0.4, minMatchCharLength 2, ignoreLocation — tuned for a teacher's library of a few hundred files.
- `components/academy/media-library/MediaFilterBar.tsx` (new) — shared search input + tag chip row. Controlled props so MediaLibrary and MediaPickerModal each own their own filter state independently. `aria-live` on the result-count so screen readers pick up filtering.
- `components/academy/media-library/MediaPickerModal.tsx` (new) — reusable modal wrapping the grid + filter bar. Accepts `allowedKinds` to pre-filter (e.g. `['panorama_video']` for a 360° video lesson). Fires `onPick(asset)` with the full `MediaAsset`; caller handles state change + close.
- `types/fuse-js-shim.d.ts` (new) — local module shim. Same dev-network workaround as plan 23a's PSV shim. Delete once `npm install` lands the real types.
- `components/academy/media-library/MediaLibrary.tsx` — adds `query` + `selectedTags` state, wires `MediaFilterBar`, uses `filterAssets()` to drive the grid. Empty-filter-result renders a dashed placeholder.
- `components/academy/course-editor/CurriculumTab.tsx` — single `pickerState` drives one `MediaPickerModal` shared across all four 360° upload sites (add × video, add × photo, edit × video, edit × photo). "Pick from library" button renders next to each `Cloudinary360Uploader` for 360° lesson types. Picking sets both `content_url` and the derived `video_360_poster_url`.
- `package.json` — adds `fuse.js` at `^7.0.0`.

### Behavior delivered

- The library page header now has a search input (name + description + tags, fuzzy) and a row of clickable tag chips. Both filters compose — search inside a tag-filtered subset. "Clear filters" link appears when any filter is active and the result count differs from the total.
- In the teacher course editor, every 360° upload site (add/edit × video/photo) has a new **"Pick from library"** button below the Cloudinary upload button. Clicking opens a modal with the library pre-filtered to matching `asset_kind` (`panorama_video` or `panorama_image`). Pick → modal closes → the lesson's content_url + poster fill in.
- The picker is the fast path to reuse: a teacher with 30 MUCHO Museo panoramas can now stamp any of them into a new lesson without re-uploading.

### Merge order (updated)

1. **Run `npm install` from home** to pull `fuse.js`. Confirm `node_modules/fuse.js` exists before pushing the merge.
2. Merge `fa5f4cf` to `main`.
3. Delete `types/fuse-js-shim.d.ts` in a tiny follow-up `chore/` commit once `npm ls fuse.js` confirms the real package is present.

### Plan 27 follow-ups NOT in this branch

- **Replace-file action** — upload a new version of an existing asset. Options: (a) overwrite Cloudinary at same public_id so URL stays stable and referring lessons auto-pickup, (b) new public_id + UPDATE all referring lesson rows in a transaction. Deferred; low-priority until a teacher asks.
- **Kind filter in UI** — the API already supports `?kind=`; the library page doesn't expose a UI control. Add if teachers with mixed libraries ask.
- **Chip-input for tags** — plan 27a's detail panel uses a comma-separated text input. Parse-on-Enter chip-input would be nicer polish.

### Remaining backlog

| Plan | Status | Notes |
|---|---|---|
| 25 (offline) | 25a shipped; 25b queued | 25a in §11 below. |
| 26 (Insta360) | blocked | §3 research required. |

---

## 11. Plan 25a shipped — `feat/academy-360-offline-foundation` (`39bc60a`)

Committed 2026-04-16. Awaiting user merge to `main`. **Migration 181 must run after merge.**

Plan 25 split into 25a (foundation — IndexedDB blob cache, player resolver, per-asset save) shipping now, plus 25b (Service Worker shell cache, full-course batch save, storage manager, enrollment-revocation purge) queued.

### Commit chain update

| Commit | Branch | Description |
|---|---|---|
| `39bc60a` | `feat/academy-360-offline-foundation` | IndexedDB blob cache + save-per-asset + player resolver for 360° |

**Files changed (8 files, +525 / −15 lines):**

- `supabase/migrations/181_offline_assets.sql` (new) — `offline_assets` ledger table. Server tracks what each user has cached; bytes live in the browser.
- `lib/offline/blob-store.ts` (new) — raw IndexedDB wrapper (no `idb` package — school network workaround). `putBlob` / `getBlob` / `deleteBlob` / `listBlobs` / `totalCachedBytes` / `downloadAndCache`. SSR-safe.
- `lib/offline/asset-resolver.ts` (new) — `resolveAssetUrl(url)` returns a `blob:` URL if cached, the original URL otherwise. `releaseResolvedUrl` to revoke on cleanup.
- `app/api/offline/assets/route.ts` (new) — GET list, POST upsert on `(user_id, asset_url)`, DELETE by `{ asset_url }`.
- `components/academy/SaveOfflineButton.tsx` (new) — per-asset toggle with three states: uncached / downloading / cached-with-remove. Pre-flight `navigator.storage.estimate()` quota check hard-refuses below 200 MB free.
- `components/academy/Lesson360VideoPlayer.tsx` — calls `resolveAssetUrl(src)` before PSV init. Plays from blob URL when cached.
- `components/academy/Lesson360PhotoPlayer.tsx` — same resolver integration.
- `app/academy/[courseId]/lessons/[lessonId]/page.tsx` — renders `<SaveOfflineButton>` below the player for 360° lesson types. `dynamic({ ssr: false })` since it touches IndexedDB.

### Behavior delivered

- Every 360° video or photo lesson has a **"Save for offline"** button below the player. Click once → downloads the blob into IndexedDB + registers in the server ledger. Button turns green with a checkmark ("Saved offline") + a trash icon to remove.
- Subsequent visits to that lesson: the player resolves the content URL to the cached blob and streams locally. Works with network disabled.
- Hard-refuse when the browser reports less than 200 MB free so a blown-quota save doesn't leave a half-downloaded blob.
- All error paths toast via `useToast()` (plan 29); all logs structured via `logError()`.

### Plan 25b (queued for next branch)

- **Service Worker** — cache the learner route HTML/JS/CSS so the lesson page itself loads offline (right now only media is cached; the shell still needs network).
- **"Save course for offline"** button on course detail page. Batch-downloads every 360° asset across every lesson in the course.
- **Storage management UI** in account settings — total cached size, per-course breakdown, per-asset list, "clear all offline data" action.
- **Enrollment-revocation purge** — when an enrollment goes inactive (Stripe cancellation, teacher revoke), the next app load reads the user's ledger for that course and deletes the corresponding blobs.
- **iOS Safari validation pass** — real-device test with 50 MB and 150 MB blobs per the plan §11 checklist.

### Merge order

1. Merge `39bc60a` to `main`.
2. Run `psql ... -f supabase/migrations/181_offline_assets.sql`.
3. Open a 360° lesson → click "Save for offline" → confirm green "Saved offline" state.
4. DevTools → Network → Offline → refresh → lesson should still play.
5. DevTools → Application → IndexedDB → `centos-offline` DB should contain the blob keyed by its Cloudinary URL.

### Remaining backlog

| Plan | Status |
|---|---|
| 25b (offline shell + course save + manager) | next |
| 26 (Insta360 import) | blocked on §3 research |

---

## 12. Plan 25b shipped — `feat/academy-360-offline-manager` (`4f180f1`)

Batch save + storage management. Sits on top of 25a's per-asset plumbing so a learner can save a whole 360° course in one click and see (or reclaim) what's on the device.

**Scope split:** 25b = course-level save + storage manager; **25c (deferred)** = Service Worker shell cache, enrollment-revocation purge, iOS Safari validation pass.

### Files added

- `lib/offline/storage-usage.ts` — merges IndexedDB blob inventory + `/api/offline/assets` ledger into grouped-by-course view. Exposes `getStorageSummary()`, `purgeAsset()`, `purgeCourseGroup()`, and a `formatBytes` helper. Surfaces drift (orphan blobs / orphan ledger) so the UI can offer cleanup.
- `components/academy/offline/OfflineStorageManager.tsx` — learner-facing UI. Per-course sections, per-asset rows with filename + kind + size, per-asset and per-course trash actions. Top card shows `navigator.storage.estimate()` quota with color-coded progress bar (sky/amber/red at 65/85%).
- `app/academy/offline/page.tsx` — hosts the manager at `/academy/offline`.
- `components/academy/offline/SaveCourseOfflineButton.tsx` — course-level batch download. Walks the lesson list sequentially (no parallel — 100+ MB videos would thrash), writes blobs + posts ledger rows, shows progress bar + cancel button. Pre-flight refuses when storage headroom < max(250 MB, 1.25× guess).

### Files modified

- `app/academy/[courseId]/page.tsx` — computes `offlineAssets` (360° + posters) for enrolled, unlocked lessons and renders `<SaveCourseOfflineButton>` next to the curriculum heading. `Lesson` interface gained `content_url` + `video_360_poster_url`.
- `app/academy/my-courses/page.tsx` — "Offline storage" button top-right linking to `/academy/offline`.

### Behavior delivered

- Enrolled learners see **"Save all N lessons for offline"** above the curriculum. Click → sequential download with "Saving lesson X of N — X.Y MB" progress and a cancel button. Cancellation is clean (AbortController + flag) and preserves already-downloaded assets as a resumable partial state.
- When every asset is already cached, the button collapses to a green "All N assets saved offline" pill + "Manage offline storage" link.
- `/academy/offline` shows total cached bytes, browser quota bar, and every cached asset grouped by course (with course titles looked up via `/api/academy/my-courses`). Orphans (blob-without-ledger, ledger-without-blob) call themselves out with an amber banner and can be purged from the same rows.
- `purgeAsset()` + `purgeCourseGroup()` delete from both client IDB and server ledger via `Promise.allSettled` so a single-side failure doesn't wedge the row.
- All errors route through `useToast()` + `logError()` (plan 29).

### Merge order

1. Merge `4f180f1` to `main`.
2. No new migration — reuses 181 (offline_assets) from plan 25a.
3. As enrolled learner: open a course with 360° lessons → click "Save all" → confirm progress bar + eventual green all-cached state.
4. `/academy/offline` → confirm course group shows every cached asset + correct total → click "Remove all" → rows disappear.
5. DevTools → Application → IndexedDB → `centos-offline` → blobs deleted after purge.
6. Quota bar: visible on browsers that implement `navigator.storage.estimate()` (Chromium + recent Safari).

### Plan 25c (deferred follow-ups)

- **Service Worker** for the learner route shell (HTML/JS/CSS) so the page itself loads fully offline — today only media is cached.
- **Enrollment-revocation purge** — when an enrollment goes inactive, next app load reads the user's ledger for that course and deletes the blobs automatically.
- **iOS Safari validation** — real-device test with 50 MB + 150 MB panorama videos per plan 25 §11 checklist.

### Remaining backlog

| Plan | Status |
|---|---|
| 25c (SW shell + revocation purge + iOS validation) | next |
| 26 (Insta360 import) | blocked on §3 research |

---

## 13. Plan 25c shipped — `feat/academy-360-offline-service-worker` (`a4e12c8`)

Finishes the offline trilogy. Turns out the Service Worker half was already in place from earlier site-wide work, so the substantive new code is the enrollment-revocation purge; iOS validation stays a manual sign-off.

### Pre-existing, confirmed adequate for plan 25c

- `public/sw.js` — `CACHE_VERSION = 'centos-v5'`, handles navigation (network-first with `/offline.html` fallback), static assets (cache-first), and API (stale-while-revalidate). Registered in production by `components/ServiceWorkerRegistration.tsx` from the root layout. No bump needed — the SW has no offline-plan-specific logic that needs updating.
- `public/offline.html` — minimal branded fallback page; copy already makes sense for academy users ("Previously visited pages are still available").

### Files added

- `app/api/offline/assets/purge-revoked/route.ts` — POST endpoint. Server computes the set difference `(user's ledger rows with course_id) ∖ (user's active enrollments)` and deletes those rows. Returns `{ revoked_urls, count }` so the client can mirror the purge into IndexedDB. Trust boundary sits on the server — the ledger is authoritative; the client is untrusted.
- `lib/offline/purge-revoked.ts` — `purgeRevoked()` wraps the endpoint and fans the returned URLs into `deleteBlob(url)` calls via `Promise.allSettled`. Failed local deletes show up later as orphan blobs in the storage manager, which is fine.
- `components/academy/offline/RevokedAssetsPurger.tsx` — invisible mount component. Runs once per SPA session (module-level flag de-dupes across academy navigations), waits 1.5s so it doesn't compete with auth/enrollment mount-time work, and toasts the user when any lessons were removed so the shrink isn't silent.

### Files modified

- `app/academy/layout.tsx` — mounts `<RevokedAssetsPurger />`. Non-academy surfaces keep zero overhead.

### Behavior delivered

- When a teacher revokes a student's enrollment (or a Stripe subscription cancels, or the student unenrolls themselves), the student's next visit to any `/academy/*` page triggers an auto-purge. Ledger rows vanish server-side immediately; matching IndexedDB blobs are deleted client-side a second later.
- User sees a gentle info toast: "Removed N offline lessons from courses you no longer have access to." — no modal, no blocker, just a notice.
- Re-enrolling in the same course after revocation lets them re-save lessons normally. Cache key is the Cloudinary URL, so if the teacher hasn't replaced the media, a fresh save is a no-op download (browser HTTP cache may even serve it instantly).
- Rows with `course_id = null` (posters unlinked from a lesson, stray uploads) are never auto-purged — enrollment gating doesn't apply to them. Users can still purge manually in the storage manager.

### What's NOT in this branch (out of scope for a code-only plan)

- **iOS Safari real-device validation** — `plans/validate/25-academy-360-offline.md §11` already lists the exact checklist (50 MB video, 150 MB video, safari close/reopen, cross-domain navigation). Needs real hardware, sign off after merge.
- **Periodic orphan URL cleanup** — `plan 25 §10`: when a teacher replaces a lesson's `content_url`, the old ledger row becomes orphaned (no lesson references it). Out of scope here — the storage manager already flags these for user cleanup and a background cron is overkill for v1.

### Merge order

1. Merge `a4e12c8` to `main` (depends on `4f180f1` from plan 25b — merge that first if not already).
2. No new migration. Reuses 181 (offline_assets).
3. As enrolled student: save a 360° lesson offline → confirm blob + ledger exist.
4. As admin/teacher: `UPDATE enrollments SET status='cancelled' WHERE user_id=...` for that student's row (or cancel via the teacher UI if it exists).
5. As the student: reload any `/academy/*` page → within ~2 s, see the "Removed N offline lessons…" toast. IndexedDB + ledger should both be empty for that course.
6. Re-enroll → `SaveCourseOfflineButton` appears again and works.

### Remaining backlog

| Plan | Status |
|---|---|
| 25 iOS validation pass | open — needs device |
| 26 (Insta360 import) | blocked on §3 research |

---

## 14. Plan 26 research brief — `research/academy-insta360-import` (`2ac89b2`)

Not code. Desk research answering three of four §3 questions from [plan 26](../26-academy-insta360-import.md) using public Insta360 documentation and GitHub repos. Brief lives at [plans/26-academy-insta360-import-research.md](../26-academy-insta360-import-research.md).

### Findings at a glance

| §3 question | Answer | Confidence |
|---|---|---|
| 1. Public SDK / documented file format? | **Yes.** Self-service application, ~3 business day approval. | High |
| 2. Mobile share path from Insta360 app? | **No.** Hardcoded YouTube/Facebook/Street View only; no OS share sheet, no URL scheme. | High |
| 3. NDA or commercial licensing? | No public evidence. Need direct confirmation for commercial SaaS redistribution. | Medium |
| 4. Insta360 dominant among our teachers? | **Unknown — needs survey.** | — |

### What's in the brief

- **Findings for §3.1–§3.3** with source links (insta360.com/developer, onlinemanual.insta360.com, github.com/Insta360Develop).
- **Devrel email draft** — three short questions covering the remaining commercial-terms gap. Ready to paste into a mail client, fill `{Name}`/`{Title}`, and send.
- **Teacher-camera survey** — 5 questions with decision thresholds: >60% Insta360 → pursue full plan 26 (desktop-only); 40–60% → smaller v1 only; <40% → cancel plan 26 proper.
- **Decision tree** mapping survey outcomes to action.

### Key discovery: mobile path is dead

Plan 26 §2 assumed a "Continue in CentenarianOS" deep-link from the Insta360 app's share menu. Insta360's app does not expose an OS share sheet or custom URL scheme — only hardcoded destinations. **Any mobile path requires users to export to Photos/Files first, which is the flow they already have.** If plan 26 proceeds at all, it's desktop-only.

### Key discovery: desktop integration is a native-companion project

The SDK doesn't expose a web/browser runtime. A real integration means shipping a native companion (Electron / Tauri) that uses the C++ CameraSDK to read Insta360 Studio exports and pipe them through our Cloudinary flow. That's a quarter-plus of work we haven't scoped — **if the survey unblocks the plan, we'd need to revisit prioritization before committing.**

### Recommended immediate action

Ship the **§4 smaller v1** (aspect-ratio warn + filename pattern title suggestion) on a separate branch. It's ~1 hour of work, zero external dependencies, valuable regardless of survey outcome. Run the survey and email devrel in parallel.

### Next human actions

1. Send the devrel email drafted in brief §4.
2. Launch the 5-question teacher survey (brief §5).
3. Greenlight the §4 smaller v1 branch independently.

Research phase is complete once the email is sent and the survey is live.

### Remaining backlog (updated)

| Plan | Status |
|---|---|
| 25 iOS validation pass | open — needs device |
| 26.0 smaller v1 (aspect ratio + filename hints) | ready — ~1 hour |
| 26 full (desktop native companion) | blocked on survey + devrel reply |
| 26 mobile deep-link | **cancelled** — Insta360 app doesn't expose it |

---

## 15. Plan 26.0 shipped — `feat/academy-360-upload-hints` (`6966c6b`)

The research-brief §4 smaller v1. Brand-agnostic upload quality-of-life that doesn't depend on any external research outcome.

### Files added

- `lib/academy/camera-filename.ts` — pattern matcher that recognizes common 360° camera filenames and produces a suggested lesson title:
  - Insta360 X/ONE X video: `VID_YYYYMMDD_HHMMSS_XX_XXX` → "Insta360 recording — {formatted date}"
  - Insta360 photo: `IMG_YYYYMMDD_HHMMSS_XX` → "Insta360 photo — {formatted date}"
  - GoPro Max: `GS######` → "GoPro Max recording"
  - Ricoh Theta (new): `R#####` → "Ricoh Theta recording"
  - Ricoh Theta (old, date-based): `yymmddhhmmss` → "Ricoh Theta — {date}"
  - Also exports `checkEquirectangularRatio(width, height)` returning `'ok' | 'suspect' | null` for the 2:1 check.

### Files modified

- `components/academy/Cloudinary360Uploader.tsx` — new `onTitleSuggestion` callback. After a successful upload, inspects `info.width / info.height` and shows a non-blocking amber warning if the ratio isn't in [1.95, 2.05] ("This file is W×H (X.YZ:1). Equirectangular 360° media should be 2:1 — export the stitched version from your camera's desktop app and re-upload."). Parses `info.original_filename` through `suggestTitleFromFilename` and fires the callback when a pattern matches.
- `components/academy/course-editor/CurriculumTab.tsx` — passes `onTitleSuggestion` into all four upload sites (edit/new × video/photo). Handler only applies the suggestion when the current title is empty, so teacher input is never clobbered.

### Why non-blocking on the ratio check

Half-sphere (180° VR180) and partial-sphere content is legitimately not 2:1 but still valuable. Raw dual-fisheye INSV files are 2:1 (two circles side by side) and would pass the ratio check despite being unplayable — so the ratio check alone isn't sufficient to guarantee equirectangular. We warn rather than reject so teachers can self-diagnose the "stretched / frozen preview" failure mode without being blocked when they know what they're doing.

### Verification

1. Open teacher course editor → add new lesson → pick 360 video type.
2. Upload a real Insta360 export (e.g. `VID_20260411_143022_00_012.mp4`). The lesson title should auto-fill "Insta360 recording — {date}" if it was blank; an existing title is preserved.
3. Upload a non-equirectangular file (e.g. a plain 16:9 MP4 — the widget rejects-not-equirectangular formats client-side but if you paste a Cloudinary URL directly, the check would only trigger via the upload path). Amber warning banner appears under the upload button.
4. Type a title first, then upload → title stays as typed.

### Remaining backlog (unchanged from §14 except 26.0 status)

| Plan | Status |
|---|---|
| 25 iOS validation pass | open — needs device |
| 26.0 smaller v1 | **shipped** (this branch) |
| 26 full (desktop native companion) | blocked on survey + devrel reply |
| 26 mobile deep-link | cancelled |

---

## 16. Starter tier design — `docs/starter-tier-access-design` (pre-code)

Design artifact, not code. Answers the key question: **how does the app restrict a Starter (pick-3) user to their chosen modules?** Also adds STYLE_GUIDE §5a codifying the "report-per-branch" rule.

Plan source: [plans/future/starter-tier-plan.md](../future/starter-tier-plan.md). This design doc converts it into a concrete access-control architecture before any code lands.

**Pricing (owner-confirmed, 2026-04-16):**
- Monthly: **$5.46/mo** (net $5 after Stripe fees) — env: `STRIPE_STARTER_MONTHLY_PRICE_ID`
- Annual: **$51.80/yr** (net $50 after Stripe fees) — env: `STRIPE_STARTER_ANNUAL_PRICE_ID`
- Annual savings: $65.52 (12 × monthly) − $51.80 = **$13.72/yr, ~21% off**
- Consistent with owner's "price net-of-Stripe-fees" pricing convention for all products.

All prices are **same modules, same gates** — only the billing cadence differs. The Pick-3 constraint applies identically to both.

### 16.1 — The good news: the enforcement primitive already exists

`app/dashboard/layout.tsx:54-102` already implements **exactly** the pattern we need, just under a different name. The "invited user" flow stores an array of allowed route prefixes in `profiles.invite_modules`, and the dashboard layout redirects users hitting a route not in that list. Starter tier is the same mechanism with a different source of truth — we reuse it verbatim.

Current flow for invited users:
1. `/api/auth/me` reads `profiles.invite_modules` and returns it as `inviteModules`.
2. Dashboard layout sets `allowedModules = isInvited && !isPaid && !isAdmin ? inviteModules : null`.
3. Redirect effect: if `allowedModules && !isFreeRoute(pathname)` and the current path isn't in the list, `router.push('/dashboard/planner')`.
4. `components/nav/NavConfig.ts:126-140` exports `getVisibleGroups(isAdmin, allowedModules)` which filters nav items client-side so users never see links to forbidden modules.

**We extend this path, we do not rebuild it.**

### 16.2 — Data model

Single migration (sequential with existing numbering — next available is `182` per [MEMORY.md](../../../.claude/projects/.../memory/MEMORY.md) noting `181_offline_assets.sql` was last):

```sql
-- 182_starter_tier.sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selected_modules TEXT[];

-- Drop + re-add the CHECK constraint on subscription_status to allow 'starter'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('free', 'monthly', 'lifetime', 'starter'));

COMMENT ON COLUMN public.profiles.selected_modules IS
  'Starter-tier users: array of module slugs they picked at checkout (max 3). NULL for all other tiers.';
```

TEXT[] rather than JSONB because we only store a flat array of strings and want Postgres-native array ops (`ANY`, `contains`) if we ever query "which users have module X selected".

### 16.3 — Module → route-prefix mapping

A Starter user picks **3 modules from 8**, but the layout enforces **route prefixes**. Each pickable module maps to one or more top-level dashboard routes. Mapping verified against the actual directory listing in `app/dashboard/`. Sub-routes are included automatically because the layout uses `pathname.startsWith(prefix + '/')`.

**Always-included (for Starter and every other tier) — don't count toward the 3:**

| Route | Reason |
|---|---|
| `/dashboard/planner`, `/dashboard/weekly-review`, `/dashboard/retrospective` | Owner decision 2026-04-16: Planner is universal baseline. |
| `/dashboard/roadmap` | Same — paired with Planner. |
| `/academy` | Decision C: Academy (student) always included; teachers bring content, platform takes fees on paid courses. |
| `/dashboard/categories` | Decision B: Life Categories unrestricted — makes every other module better, doesn't make sense as a separate gate. |
| `/dashboard/data` | Decision A: **full import/export unrestricted**. Users can export their entire data set — including modules they don't currently have access to. This is a data-rights call: locking someone out of their own data on downgrade is hostile. |
| `/dashboard/blog`, `/dashboard/recipes`, `/dashboard/discover`, `/dashboard/billing`, `/dashboard/messages`, `/dashboard/feedback`, `/dashboard/settings`, `/dashboard/teaching` | Existing `FREE_ROUTE_PREFIXES` in `app/dashboard/layout.tsx`. |

**Pickable modules (Starter picks 3 from 8):**

```ts
// lib/access/starter-modules.ts
export type ModuleSlug =
  | 'engine' | 'fuel' | 'metrics' | 'workouts'
  | 'finance' | 'travel' | 'equipment' | 'correlations';

export const STARTER_MODULES: Record<ModuleSlug, {
  label: string;
  prefixes: string[];
  description: string;
  icon: string;
}> = {
  engine:       { label: 'Engine',         prefixes: ['/dashboard/engine'],                               description: 'Focus sessions, analytics, doodle canvas',                    icon: 'Briefcase' },
  fuel:         { label: 'Fuel',           prefixes: ['/dashboard/fuel', '/dashboard/scan'],              description: 'Supplement protocols, daily fuel logs, ingredient scan',      icon: 'Utensils' },
  metrics:      { label: 'Health Metrics', prefixes: ['/dashboard/metrics'],                              description: 'RHR, steps, sleep, body composition, wearable sync',          icon: 'HeartPulse' },
  workouts:     { label: 'Workouts',       prefixes: ['/dashboard/workouts', '/dashboard/exercises'],     description: 'Exercise library, templates, logs, Nomad OS',                 icon: 'Dumbbell' },
  finance:      { label: 'Finance',        prefixes: ['/dashboard/finance'],                              description: 'Transactions, accounts, budgets, invoices, forecast',         icon: 'DollarSign' },
  travel:       { label: 'Travel',         prefixes: ['/dashboard/travel'],                               description: 'Trips, vehicles, fuel logs, maintenance, routes',             icon: 'Navigation' },
  equipment:    { label: 'Equipment',      prefixes: ['/dashboard/equipment', '/dashboard/media'],        description: 'Asset tracking, valuations, media library & gallery',        icon: 'Package' },
  correlations: { label: 'Correlations',   prefixes: ['/dashboard/correlations', '/dashboard/analytics'], description: 'Cross-module analytics, AI insights',                         icon: 'TrendingUp' },
};

export const STARTER_ALWAYS_INCLUDED_PREFIXES = [
  '/dashboard/planner',
  '/dashboard/weekly-review',
  '/dashboard/retrospective',
  '/dashboard/roadmap',
  '/academy',
  '/dashboard/categories',
  '/dashboard/data',
];

export function expandToPrefixes(slugs: string[]): string[] {
  const picked = slugs.flatMap((slug) => STARTER_MODULES[slug as ModuleSlug]?.prefixes ?? []);
  return [...STARTER_ALWAYS_INCLUDED_PREFIXES, ...picked];
}
```

**Bundled decisions (not asking):**
- Scan bundles with Fuel (scan reads ingredients / supplement labels — only useful alongside fuel logging).
- Media library bundles with Equipment (primary consumer — equipment media gallery is the heaviest user).
- Exercises bundles with Workouts (library is the builder surface for workouts).
- Analytics bundles with Correlations (same cross-module analytics surface).

### 16.4 — Enforcement: three layers, one source of truth

Defense-in-depth. Each layer serves a different purpose; they are not redundant.

| Layer | Where | Purpose | Bypass if broken |
|---|---|---|---|
| **1. Nav filter (UX)** | `NavConfig.getVisibleGroups(isAdmin, allowedPrefixes)` — already supports this signature | Users never see links to modules they can't access. Removes confusion. | User could still type `/dashboard/finance` into the address bar. |
| **2. Dashboard layout redirect (gate)** | `app/dashboard/layout.tsx` existing `useEffect` that redirects invited users — extend the condition to also run for Starter users | Authoritative access gate. Even a user who types the URL directly gets bounced. | Client-only; could theoretically be bypassed with JS disabled, but the APIs still enforce RLS. |
| **3. Dashboard index redirect (fallback)** | `app/dashboard/page.tsx` — when redirecting to default home, land on a selected module if possible | Starter user who'd normally get bounced to `/dashboard/planner` they don't own lands on their first selected module instead. | Cosmetic; layer 2 still catches this. |

**What we deliberately do NOT do:** route-level checks inside each module page. Reason: the dashboard layout already guards the entire dashboard subtree. Scattering access checks across 50+ page.tsx files is a maintenance burden and a footgun (miss one → silent bypass).

**Teaser pages:** when a Starter user tries a forbidden prefix, the layout currently redirects to `/dashboard/planner`. We change that target to a new `/dashboard/upgrade?from=<module>` page that shows:
- "Upgrade to unlock {Module}" headline
- One-click upgrade button (Stripe checkout at Pro / Lifetime price)
- "Or swap a module" link to the module picker

This is a better learner experience than a silent redirect to planner.

### 16.5 — isPaid logic changes

`lib/hooks/useSubscription.ts` currently exports `SubscriptionStatus = 'free' | 'monthly' | 'lifetime'`. Extend:

```ts
export type SubscriptionStatus = 'free' | 'monthly' | 'lifetime' | 'starter';
```

And in `app/dashboard/layout.tsx:47`:

```ts
// Before
const isPaid = subStatus === 'monthly' || subStatus === 'lifetime';

// After
const isPaid = subStatus === 'monthly' || subStatus === 'lifetime' || subStatus === 'starter';
const isStarter = subStatus === 'starter';
// Existing invite logic stays as-is; starter adds a parallel branch.
const allowedModules = isInvited && !isPaid && !isAdmin
  ? inviteModules
  : isStarter && !isAdmin
    ? expandToPrefixes(selectedModules ?? [])
    : null;
```

Admins bypass `allowedModules` entirely (they get the full app regardless of subscription). Lifetime and Monthly users have `allowedModules = null` which unlocks everything.

### 16.6 — Owner decisions (locked in 2026-04-16)

1. **Data Hub (import/export):** **full access, unrestricted.** Owner call — data-rights over product gating. A Starter user can export any data they own, including from modules they no longer have access to. `/dashboard/data` and `/api/*/export` endpoints do not filter by `selected_modules`.
2. **Life Categories:** **unrestricted.** `/dashboard/categories` always included.
3. **Academy (student):** **always included, does not count as 1 of 3.** `/academy` is always accessible. Teachers bring the content; platform revenue comes from fees on paid course enrollments, not from gating student access.
4. **Activity Links across locked modules:** **show + redirect + upgrade CTA.** When a Starter user with Finance (but not Travel) opens an Activity Link picker, Travel entities still appear. Clicking a linked Travel entity redirects to `/dashboard/upgrade?from=travel` which shows the upgrade prompt. Existing links stay visible on source entities (read-only) so the user's prior context isn't lost.

**Additional owner decision:** `/dashboard/planner` and `/dashboard/roadmap` (and the Operate-group sub-tools: weekly-review, retrospective) are **always included for every tier**. They are not part of the 3-picker.

Net effect: Starter picks **3 of 8** modules (Engine, Fuel, Metrics, Workouts, Finance, Travel, Equipment, Correlations). Every other tier gets all of those unrestricted.

### 16.7 — Implementation plan (ordered)

One branch per logical change per STYLE_GUIDE §1. Rough sequencing:

| # | Branch | Scope |
|---|---|---|
| 1 | `feat/starter-tier-schema` | Migration 182, `SubscriptionStatus` enum, `STARTER_MODULES` map in `lib/access/starter-modules.ts`. No UI changes. |
| 2 | `feat/starter-tier-gating` | Dashboard layout + NavConfig + `/api/auth/me` changes to enforce `allowedModules` for Starter users. Admins tested for regression. |
| 3 | `feat/starter-tier-upgrade-page` | `/dashboard/upgrade` teaser page. Forbidden-module redirects land here. |
| 4 | `feat/starter-tier-module-picker` | Client component on `/pricing` for Starter checkout. Max-3 checkbox grid with descriptions + lock icons. |
| 5 | `feat/starter-tier-stripe` | Both `STRIPE_STARTER_MONTHLY_PRICE_ID` + `STRIPE_STARTER_ANNUAL_PRICE_ID` env vars, checkout route handles `plan=starter-monthly` and `plan=starter-annual` with `selected_modules` metadata, webhook handler writes `subscription_status='starter'` and `profiles.selected_modules`. |
| 6 | `feat/starter-tier-admin-stats` | Admin dashboard: Starter subscriber count + top-3-module-combos widget. |

**Pre-flight gate:** confirm Stripe price creation + env var with owner before branch 5.

### 16.8 — Migration order for merge

1. Land branches in the order above (each PR rebased on the previous if needed).
2. Run `supabase/migrations/182_starter_tier.sql` against production before the branch-5 webhook deployment.
3. Create the Stripe price in dashboard; copy the `price_xxx` into `STRIPE_STARTER_PRICE_ID`.
4. Enable a feature flag `NEXT_PUBLIC_STARTER_TIER_ENABLED=true` (new) on the pricing page so we can stage the rollout.
5. Soft-launch: DM 3 existing free users, walk them through Starter checkout, confirm access behaves as designed.

### 16.9 — Risks + tradeoffs

- **Risk: a Starter user changes their mind and swaps modules, then loses data in a newly-locked module.** Data isn't deleted — only hidden. If they re-select the module later, everything is back. Clarify this in the picker: *"Your data isn't deleted — you can re-select a module anytime."*
- **Tradeoff: Option B (change anytime) from the plan doc wins.** No billing-cycle restriction, no change history. Reason: revenue from Starter is acquisition, not retention-via-lock-in. Friction around swapping modules would tank satisfaction without meaningfully protecting revenue.
- **Risk: cross-app shared DB (see CLAUDE.md).** `selected_modules` column is additive and has no semantic meaning outside CentenarianOS — safe. `subscription_status` gaining `'starter'` is a CHECK constraint change; any other app reading this column will silently ignore unknown values, which is the correct behavior.
- **Risk: feature flag toggled off mid-flight.** If a Starter user is already subscribed when we roll back the flag, they lose access. Mitigation: flag gates the **picker** (checkout path), not the **gating** (already-subscribed users). Users with `subscription_status='starter'` always get their modules regardless of flag state.

### 16.10 — All decisions locked

- ✅ Pricing: $5.46/mo, $51.80/yr (monthly + annual price IDs documented)
- ✅ Access mechanism: extend existing invited-user layer (§16.1, §16.4, §16.5)
- ✅ Data model: migration 182 (§16.2)
- ✅ Module list: 3-from-8 picker + 7 always-included prefixes (§16.3)
- ✅ Four open questions: owner-decided (§16.6)

**No further sign-off needed to open branch 1.** Owner still needs to create the two Stripe prices and share the IDs before branch 5 (Stripe integration) can land — branches 1–4 can proceed without them.

### 16.11 — Ready to code

Next: open `feat/starter-tier-schema` (branch 1 in §16.7), stacked on this design branch.

### Remaining backlog (updated)

| Plan | Status |
|---|---|
| 25 iOS validation pass | open — needs device |
| 26.0 smaller v1 | shipped |
| 26 full | blocked on survey + devrel reply |
| Starter tier branch 1 | see §17 below |

---

## 17. Starter tier branch 1 shipped — `feat/starter-tier-schema` (pending commit)

Schema + types only. Zero UI, zero behavior changes for existing users. Lays the data-model foundation for branches 2–6 to hang gating and UI off.

### Files added

- `supabase/migrations/182_starter_tier.sql` — adds `profiles.selected_modules TEXT[]` (nullable) and widens the `subscription_status` CHECK to include `'starter'`. Additive — no existing rows need migration, no other app that reads profiles is affected. Column comment documents the pick-3 semantics.
- `lib/access/starter-modules.ts` — the single source of truth for Starter access control. Exports:
  - `ModuleSlug` union of the 8 pickable slugs.
  - `STARTER_PICK_LIMIT = 3`.
  - `STARTER_MODULES` map: each slug → `{ label, prefixes[], description, icon }`. Mirrors §16.3 exactly.
  - `STARTER_ALWAYS_INCLUDED_PREFIXES` array: the 7 paid-tier routes that Starter gets unconditionally (planner family, academy, categories, data).
  - `STARTER_MODULE_SLUGS`, `isModuleSlug`, `expandToPrefixes(slugs)`, `isValidStarterSelection(slugs)` helpers.

### Files modified

- `lib/hooks/useSubscription.ts` — `SubscriptionStatus` gains `'starter'`. `SubscriptionState` gains `selectedModules: string[] | null`. The profile-fetch query selects `selected_modules` and stores it defensively (`Array.isArray(...) ? ... : null`) so a missing column (e.g. during migration rollout) doesn't break the hook.

### Behavior delivered

- **None.** This branch is infrastructure. A user flipping `subscription_status='starter'` directly in the DB would currently get treated as `free` by `isPaid = status === 'monthly' || status === 'lifetime'` (branch 2 changes that). Nothing in the UI exposes the new column.

### Merge order

1. Run `psql ... -f supabase/migrations/182_starter_tier.sql` against the Supabase project.
2. Merge `feat/starter-tier-schema` to `main`.
3. `npx tsc --noEmit --skipLibCheck` before and after — both should return clean (verified in this branch).

### Next branch

Branch 2 — see §18 below.

---

## 18. Starter tier branch 2 shipped — `feat/starter-tier-gating`

Gates. Extends the existing "invited user" access mechanism to cover Starter subscribers. Zero new UI surfaces — just wires the data from branch 1 into the already-built enforcement primitive in `app/dashboard/layout.tsx` and `components/nav/NavConfig.ts`.

### Files modified

- `app/dashboard/layout.tsx`:
  - Imports `expandToPrefixes` from `lib/access/starter-modules.ts`.
  - Reads `selectedModules` from `useSubscription()` (added in branch 1).
  - Extends `isPaid` to include `subStatus === 'starter'`.
  - New `isStarter` boolean derived from `subStatus`.
  - `allowedModules` now resolves as: `null` for admins → `expandToPrefixes(selectedModules)` for Starter → `inviteModules` for invited non-paid non-admin → `null` otherwise.
  - Redirect effect simplified: any user with a non-null `allowedModules` gets redirected off forbidden routes. Single code path covers both Starter and Invited (the two tiers that restrict).

### Files NOT modified (and why)

- `components/nav/NavConfig.ts` — already filters paid items against `allowedModules` with `href === m || href.startsWith(m + '/')`. The existing signature is exactly what Starter users need. Zero changes.
- `app/api/auth/me/route.ts` — subscription data comes through `useSubscription()`, not this endpoint. Keeping the separation: this endpoint is admin/teacher/invited flags; `useSubscription` is subscription tier + selected modules.

### Behavior delivered

- A user with `subscription_status='starter'` and `selected_modules=['finance','workouts','metrics']` can access:
  - All free routes (blog/recipes/billing/messages/feedback/settings/teaching).
  - All always-included paid routes (planner family, academy, categories, data).
  - The three picked module prefixes (finance/*, workouts/* + exercises/*, metrics/*).
  - Every other paid route redirects to `/dashboard/planner` (always-included for Starter, so never loops).
- Nav filters: Starter users don't see links to modules they can't access. Admins + Monthly + Lifetime users see everything (unchanged).
- **Invited-user behavior is unchanged** — the existing `inviteModules` flow still works identically.

### Known edge case (follow-up, not a regression)

A handful of NavConfig entries live under `/dashboard/settings/*` but are marked `paid: true` (e.g., Wearables at `/dashboard/settings/wearables`). The nav filter hides them from Starter/Invited users even when the underlying module is picked (because `/dashboard/settings/wearables` doesn't match any picked prefix). Users can still reach the page by URL because `/dashboard/settings` is in `FREE_ROUTE_PREFIXES`. This is a pre-existing issue that also affected invited users; worth addressing in a NavConfig cleanup branch but out of scope here.

### Merge order

1. Branch 1 (`feat/starter-tier-schema`) must be merged first — this branch depends on `SubscriptionStatus` gaining `'starter'` and `useSubscription` exposing `selectedModules`.
2. Migration 182 must be applied before this branch goes to production (subscription status check rejects 'starter' until it runs).
3. Then merge `feat/starter-tier-gating`.

### Verification

1. Open DB console: `UPDATE profiles SET subscription_status='starter', selected_modules=ARRAY['finance','workouts','metrics'] WHERE id='<your-user-id>';`
2. Refresh dashboard: nav shows only Finance, Workouts, Metrics paid items plus always-included (Planner family, Academy, Categories, Data).
3. Type `/dashboard/travel` → redirects to `/dashboard/planner`.
4. Type `/dashboard/finance` → loads normally.
5. `UPDATE` back to `'free'` → user is kicked to `/pricing`.
6. `UPDATE` to `'monthly'` → full access restored, no restrictions.

### Next branch

Branch 3 — `feat/starter-tier-upgrade-page`. Replaces the redirect target from `/dashboard/planner` to a new `/dashboard/upgrade?from=<module>` page with upgrade CTAs (Monthly / Annual / Lifetime). Same gate, friendlier UX.

### Remaining backlog (updated with plans 30 + 31)

| Plan | Status |
|---|---|
| 25 iOS validation pass | open — needs device |
| 26.0 smaller v1 | shipped |
| 26 full | blocked on survey + devrel reply |
| **30: Stripe fee calculator** | **new** — see `plans/30-stripe-fee-calculator.md`. Small component, shows live "You receive $X after fees" on every price input. Est ~1–2 hrs. Added per owner request 2026-04-16. |
| **31: i18n (EN + ES) + SEO metadata** | **new** — see `plans/31-i18n-en-es-plus-seo.md`. Phased: Phase 1 infra + pricing/home (1 day), Phase 2 public surfaces (3–5 days), Phase 3 authenticated app (5 days), Phase 4 errors/emails/legal (1–2 days). Added per owner request 2026-04-16. |
| Starter tier branch 3 | next — `/dashboard/upgrade?from=X` page |
| Starter tier branch 4 | pending — module picker on `/pricing` |
| Starter tier branch 5 | pending — Stripe checkout + webhook (needs price IDs) |
| Starter tier branch 6 | pending — admin stats |

---

## 19. Starter tier branch 3 shipped — `feat/starter-tier-upgrade-page`

Better UX for the gate from branch 2. A Starter user hitting a forbidden route now lands on a personalized upgrade page instead of being silently redirected to `/dashboard/planner`.

### Files added

- `app/dashboard/upgrade/page.tsx` — client component with a `Suspense` wrapper for `useSearchParams`. Reads `?from=<moduleSlug>`, validates against `isModuleSlug`, and:
  - Personalizes the headline ("Unlock Travel" vs. generic "Upgrade your plan" for direct hits).
  - Renders a chip row of the Starter user's current picks (if they have any).
  - Shows three CTA cards: **Swap a module** (→ `/pricing?action=swap`, branch 4 handles), **Pro Monthly** ($10.60/mo via existing `/api/stripe/checkout`), **Lifetime** ($103.29 via same endpoint).
  - Footer reassurance: "A locked module's data is hidden, not deleted — re-select it anytime and everything is back."

### Files modified

- `lib/access/starter-modules.ts` — new `pathToModuleSlug(pathname)` reverse-lookup helper. Scans `STARTER_MODULES` for a prefix match and returns the slug, or `null` if the path doesn't belong to any pickable module. Used by the layout redirect to build the `?from=` query.
- `app/dashboard/layout.tsx`:
  - Adds `/dashboard/upgrade` to `FREE_ROUTE_PREFIXES` (must be reachable by every authenticated tier; otherwise a Starter user would loop trying to reach the upgrade page).
  - Redirect effect now forks by tier: **Starter** → `/dashboard/upgrade?from=<slug>` (or `/dashboard/upgrade` when the slug can't be resolved). **Invited** → `/dashboard/planner` (their flow isn't part of the Starter funnel; their allowed_modules are free-text prefixes, not module slugs — reusing the upgrade page would show wrong copy).

### Behavior delivered

- Starter user picks Finance + Workouts + Metrics, clicks a `/dashboard/travel/trips/new` link → redirected to `/dashboard/upgrade?from=travel`. Page reads "Unlock Travel. Trips, vehicles, fuel logs, maintenance, routes. It's not one of your picked Starter modules — choose a path below." Current picks shown as chips. Three CTAs.
- Direct navigation to `/dashboard/upgrade` (no query param) shows generic "Upgrade your plan" copy. Still useful.
- Pro and Lifetime buttons fire the same `/api/stripe/checkout` endpoint the pricing page uses — no new infrastructure.
- Swap button routes to `/pricing?action=swap` (branch 4 will read this query param and scroll to the module picker).

### Merge order

1. Branches 1 + 2 must be merged first.
2. Migration 182 applied in prod.
3. Merge `feat/starter-tier-upgrade-page`.
4. No new migrations, no new env vars.

### Verification

1. Set your user to Starter with three picks (see §18 verification SQL).
2. Type `/dashboard/travel` → should land on `/dashboard/upgrade?from=travel` with personalized copy.
3. Type `/dashboard/upgrade` directly → generic copy, same three CTAs.
4. Click "Pro — all modules" → Stripe checkout opens for Monthly plan.
5. Click "Swap a module" → navigates to `/pricing?action=swap` (picker arrives in branch 4).
6. Revert to `'monthly'` → `/dashboard/upgrade` is still reachable directly (no redirect loop since `allowedModules === null` for Monthly tier).

### Next branch

Branch 4 — see §20 below.

---

## 20. Starter tier branch 4 shipped — `feat/starter-tier-module-picker`

The picker that was referenced by branches 2 + 3 as "TBD". New Starter-tier visual + flow on the pricing page, and the live swap path for existing subscribers. New-subscription checkout is wired to the expected API contract; branch 5 adds the backend half.

### Files added

- `components/pricing/StarterModulePicker.tsx` — presentational picker. Props: `mode` (`'new' | 'swap'`), `initialSelection`, `initialCadence`, `onSubmit`, `onCancel`, `externalError`. Internal state for picked set (max 3 enforced with friendly error when user hits cap), billing cadence, submitting flag. Renders 8 checkbox cards in a 2-col grid with per-module icons from the Lucide map, a live `X / 3` counter, a monthly/annual cadence toggle (hidden in swap mode — cadence changes go through Stripe's customer portal), and a fuchsia Continue button that resolves its label from cadence and mode.
- `app/api/user/starter-modules/route.ts` — `PATCH` endpoint. Enforces: auth, `isValidStarterSelection` (exactly 3 unique valid slugs), `subscription_status='starter'` (only Starter tier can set this column — Lifetime/Monthly aren't module-gated). Uses the service-role client after the explicit auth check.

### Files modified

- `app/pricing/page.tsx`:
  - New state `pickerMode: 'new' | 'swap' | null` + `pickerError`.
  - Reads subscription via `useSubscription()` to know current tier + current picks.
  - `SwapActionTrigger` child (Suspense-wrapped) reads `?action=swap` query from `/dashboard/upgrade`'s swap button and auto-opens the modal in swap mode; immediately strips the query via `router.replace` so refresh doesn't reopen.
  - New `handleStarterSubmit(slugs, cadence)` forks by mode: swap → PATCH; new → POST `/api/stripe/checkout` with `plan: 'starter-monthly' | 'starter-annual'` and `selected_modules` metadata. Auth failures open the `PurchaseModal` as with existing plans.
  - Grid layout: `md:grid-cols-2 max-w-3xl` → `md:grid-cols-2 lg:grid-cols-3 max-w-6xl`. Starter card is leftmost; Monthly (Popular) middle; Lifetime (Best Value) right.
  - Starter card: "Start Small" badge, $5.46/mo price + "or $51.80/year (save 21%)" secondary line, five feature bullets focused on flexibility. CTA text forks by subscription: existing Starter subscribers see "Change your 3 modules" (opens swap mode); everyone else sees "Pick my 3 modules" (opens new mode).
  - Modal mount at the end wraps `<StarterModulePicker>` with the shared `Modal` component (size lg).

### Behavior delivered

- **New signup path:** visitor clicks "Pick my 3 modules" → modal opens → visitor toggles cadence + picks 3 → Continue → `/api/stripe/checkout` fires with the Starter plan slug. Branch 5 must implement the backend handler for this request; until then, the response will 400 and the picker surfaces "Starter checkout is coming soon" via `externalError`. The picker UI is fully usable for validation.
- **Swap path (fully live):** existing Starter user on `/dashboard/upgrade` clicks "Swap a module" → lands on `/pricing?action=swap` → picker auto-opens in swap mode pre-populated with their current 3 picks → they change one → Continue → PATCH `/api/user/starter-modules` → subscription hook refreshes → modal closes → nav visibility updates within the same render cycle because layout reads from `useSubscription()`.
- **Edge cases handled:** trying to check a 4th module surfaces the "uncheck one to swap" message; canceling the modal resets state; submitting with <3 picks shows validation error; not-logged-in visitors hit the existing `PurchaseModal` auth flow on Continue.

### Swap-path accessibility notes

- Cadence toggle uses `<fieldset>` + `<legend className="sr-only">` + radio inputs hidden via `sr-only` with styled labels. Screen readers announce the group and current selection. Keyboard nav works via Tab + arrow keys (browser default for radios in a fieldset).
- Live counter has `aria-live="polite"` so screen readers announce the updated count on each pick.
- Each module card's label wraps the input with `aria-describedby` pointing at the description span — screen readers read label + description together.

### Merge order

1. Branches 1 + 2 + 3 must be merged first.
2. Migration 182 applied in prod.
3. Merge `feat/starter-tier-module-picker`.
4. No new env vars yet (those come with branch 5).

### Verification

1. Fresh Incognito session → visit `/pricing` → Starter card renders with "Start Small" badge, "Pick my 3 modules" CTA.
2. Click CTA → modal opens, 8 module cards in 2×4 grid, cadence toggle shows Monthly/Annual.
3. Pick 3 → Continue label becomes "Continue — $5.46/mo" → click → expect 400 until branch 5, friendly error visible in picker.
4. Toggle cadence to Annual → label changes to "Continue — $51.80/yr".
5. Log in as existing Starter user (seeded per §18 verification SQL) → pricing Starter card reads "Change your 3 modules".
6. Click → modal opens in swap mode, current 3 picks pre-checked, no cadence toggle.
7. Uncheck one + check another → Continue → PATCH fires → modal closes → reload page → picker reopened in swap mode shows the new selection.
8. Hit `/pricing?action=swap` directly (matches the `/dashboard/upgrade` swap button) → picker auto-opens in swap mode → URL updates to `/pricing` (no refresh loop).

### Next branch

Branch 5 — see §21 below.

---

## 21. Starter tier branch 5 shipped — `feat/starter-tier-stripe`

Wires the backend half of what branch 4's picker was already calling. End-to-end Starter signup now works: visitor picks 3 modules → Stripe checkout → webhook writes `subscription_status='starter'` + `selected_modules` → dashboard layout immediately gates correctly. Also handles the downgrade path (subscription cancellation clears `selected_modules` to keep the schema invariant).

### Env vars required (already set by owner in Vercel + `.env.local`)

- `STRIPE_STARTER_MONTHLY_PRICE_ID` — $5.46/mo recurring price
- `STRIPE_STARTER_ANNUAL_PRICE_ID` — $51.80/yr recurring price

### Files modified

- `app/api/stripe/checkout/route.ts`:
  - `VALID_PLANS` gains `'starter-monthly'`, `'starter-annual'`.
  - Body destructures `selected_modules` alongside `plan`. For Starter plans, validates with `isValidStarterSelection` before doing any Stripe work.
  - Two new guard clauses: block Starter checkout when user is already `'monthly'` ("cancel Monthly first") or `'starter'` ("use the picker to swap"). Lifetime block unchanged.
  - New Starter branch creates the checkout session with the resolved price ID, serializes the 3 slugs as a comma-joined string in metadata (Stripe metadata values are strings ≤500 chars; 3 slugs fit trivially), and stamps the same metadata on the subscription via `subscription_data.metadata` so downstream subscription events can route without re-fetching the session.
- `app/api/stripe/webhook/route.ts`:
  - New `parseSelectedModules(csv)` helper deserializes the CSV metadata and re-validates with `isValidStarterSelection` — defensive against truncation or manipulation.
  - New Starter branch in the `checkout.session.completed` switch: retrieves the subscription to get `current_period_end`, writes `subscription_status='starter'` + `selected_modules` + subscription id + expiry to `profiles`.
  - `customer.subscription.deleted` handler now clears `selected_modules` alongside the downgrade to `'free'`. Maintains the invariant "`selected_modules IS NULL` iff `subscription_status <> 'starter'`". Also implicitly arms plan 25c's revocation purger for any offline content tied to courses the downgraded user was enrolled in.
- `app/api/stripe/sync/route.ts`:
  - New Starter branch mirrors the webhook behavior for the billing-page-redirect fallback. Same CSV parse, same validation, same DB write. Returns `{ status: 'starter' }` on success.

### Behavior delivered — end-to-end Starter signup

1. Visitor lands on `/pricing`, clicks "Pick my 3 modules" → modal opens.
2. Picks 3 modules + cadence, clicks "Continue — $5.46/mo" (or annual).
3. Frontend POSTs `/api/stripe/checkout` with `{ plan: 'starter-monthly', selected_modules: ['finance','workouts','metrics'] }`.
4. Checkout route validates, creates customer if missing, creates session with the Starter price, stamps metadata on session + subscription, returns the URL.
5. Browser redirects to Stripe's hosted checkout.
6. Visitor completes payment.
7. Stripe fires `checkout.session.completed` → webhook parses `selected_modules` metadata, writes profile row.
8. Browser lands on `/dashboard/billing?success=true&session_id=cs_xxx`.
9. Billing page calls `/api/stripe/sync` as a safety net in case the webhook is delayed — idempotent; writes the same row if not already written.
10. User refreshes any dashboard page — `useSubscription()` reads `subscription_status='starter'` + `selected_modules`, dashboard layout gates accordingly, nav shows only picked + always-included items.

### Behavior delivered — downgrade

- User cancels via Stripe customer portal or billing page.
- Stripe fires `customer.subscription.deleted`.
- Webhook downgrades to `'free'` and clears `selected_modules`.
- User's next dashboard load: `hasAccess=false` (because `subStatus='free'`, not admin, not invited) → redirect to `/pricing`.
- Plan 25c's `RevokedAssetsPurger` runs on the next `/academy/*` visit → deletes any offline-cached lessons tied to courses the user was enrolled in via Starter.

### Merge order

1. Branches 1–4 merged.
2. Migration 182 applied.
3. **Owner: create two Stripe products / prices** (done per user confirmation 2026-04-16):
   - Starter Monthly — $5.46 USD recurring monthly
   - Starter Annual — $51.80 USD recurring yearly
4. **Owner: set env vars** `STRIPE_STARTER_MONTHLY_PRICE_ID` and `STRIPE_STARTER_ANNUAL_PRICE_ID` with the `price_xxx` values (done per user confirmation 2026-04-16).
5. Merge `feat/starter-tier-stripe`.

### Verification

1. `/pricing` → Starter card → "Pick my 3 modules" → pick 3 → Continue Monthly → real Stripe checkout loads (use Stripe test mode + card `4242 4242 4242 4242`).
2. Complete checkout → redirect to `/dashboard/billing?success=true&session_id=...`.
3. Inspect `profiles` row: `subscription_status='starter'`, `selected_modules` array matches picks, `stripe_subscription_id` populated, `subscription_expires_at` ~1 month out (or ~1 year for annual).
4. Navigate dashboard: only picked + always-included items in nav. `/dashboard/travel` (if not picked) → `/dashboard/upgrade?from=travel`.
5. From Stripe dashboard or billing page: cancel subscription → within seconds webhook fires → `profiles` row reverts to `'free'` with `selected_modules=null` → user is bounced to `/pricing`.
6. Try Starter checkout while already `'monthly'` → 400 with "Cancel your Monthly plan first".
7. Try Starter checkout while already `'starter'` → 400 with "use the module picker to swap".

### Next branch

Branch 6 — see §22 below.

---

## 22. Starter tier branch 6 shipped — `feat/starter-tier-admin-stats`

Final branch in the Starter-tier series. Adds visibility so the owner can watch Starter adoption and tune the module list based on actual picks.

### Files modified

- `app/api/admin/stats/route.ts`:
  - Imports `STARTER_MODULE_SLUGS` + `STARTER_MODULES` from the access-control lib so the API is the one source of truth for module labels.
  - Adds `starter` count alongside `free`/`monthly`/`lifetime` in the existing tier tally.
  - New per-user fetch of `selected_modules` scoped to `subscription_status='starter'` — small dataset, one round trip.
  - Computes `modulePopularity` (count + percentage per slug, sorted desc) and `topCombos` (top 5 3-module combinations, canonicalized by sorted-slug join so order-independent combinations are counted as the same combo).
  - `revenue.monthlyMRR` now includes `starter * 5.46` as a floor (annual subscribers contribute more because the $51.80 pre-pay offsets ~12 months of MRR accrual — we underreport monthly burn rate rather than overreport).
  - New `starter` response block: `{ total, modulePopularity, topCombos, estimatedMrrFloor }`. Rounded to 2 decimals.
- `app/admin/page.tsx`:
  - `Stats` interface extended with `starter` block and `users.starter`.
  - Top users grid widens from 4 to 5 columns on desktop to fit the new Starter card (Sparkles icon, sky color to match the pricing page Starter card).
  - New "Starter tier breakdown" section renders conditionally — only when `stats.starter.total > 0` so the overview stays clean before any Starter adoption.
  - Two cards inside the breakdown section:
    - **Module popularity:** progress-bar list with label + count + percentage, accessible via `role="progressbar"` + `aria-valuenow`.
    - **Top module combos:** ranked ordered list (1–5) showing the combo and the subscriber count.

### Behavior delivered

- Before Starter has any subscribers: admin overview shows the new Starter card with `0` and no breakdown section.
- After the first Starter signup: breakdown section appears, module popularity shows 100% for the three picked modules and 0% for the rest, combo #1 is that single user's picks.
- As adoption grows: owner can see at a glance which modules are being picked ("Finance is in 80% of Starter carts — we're not going to kill it") and which 3-module combinations cluster ("Finance + Workouts + Metrics is the dominant combo — maybe we should offer a 'Health + Money' preset").

### Merge order

1. Branches 1–5 merged.
2. Migration 182 applied.
3. Merge `feat/starter-tier-admin-stats`. No new env vars, no new migrations.

### Verification

1. As admin, visit `/admin` → `Starter ($5.46)` card shows current count.
2. With ≥1 active Starter subscriber (from branch 5 verification steps), Starter tier breakdown section appears.
3. Module popularity list is sorted with most-picked at top; percentages sum to ~300% when everyone picks exactly 3.
4. Top combos list groups users by canonical sorted-slug key — pick `['finance','workouts','metrics']` and a second user picks `['workouts','metrics','finance']` and they should count as the same combo.

### Starter tier series — done

Branches 1–6 ship a complete Pick-3-modules paid tier. Remaining work for the Starter tier is all operational (Stripe dashboard monitoring, customer support for swap questions) rather than engineering.

### Remaining backlog

| Plan | Status |
|---|---|
| 25 iOS validation pass | open — needs device |
| 26.0 smaller v1 | shipped |
| 26 full | blocked on survey + devrel reply |
| 30 Stripe fee calculator | ready — ~1–2 hrs |
| 31 i18n EN+ES + SEO | phased, 1–2 weeks |
| 32 admin email verification dashboard | shipped (this series, §23) |
| Starter tier | **fully shipped** (branches 1–6) |

---

## 23. Admin email verification — `feat/admin-email-verification`

Plan 32 shipped in one branch. Admin can see who hasn't verified and nudge them.

### Files added

- `plans/32-admin-email-verification.md` — plan doc with scope, API shapes, and verification checklist.
- `app/api/admin/users/[id]/resend-verification/route.ts` — POST endpoint. Admin-gated. Fetches the auth user by id, short-circuits when already verified, otherwise calls `auth.admin.generateLink({ type: 'magiclink', email })`. Magic link (not signup) because the target user already exists; clicking it both logs them in and confirms their email as a side effect.
- `app/api/admin/users/resend-all-unverified/route.ts` — POST endpoint. Admin-gated. Lists all auth users, filters to `!email_confirmed_at`, caps at 100 per call (returns 413 with a clear error above that), runs `generateLink` sequentially to respect Supabase's per-email rate limits. Returns `{ attempted, succeeded, failed, alreadyVerified, skippedMissingEmail }`.

### Files modified

- `app/api/admin/users/route.ts` — response rows now include `email_confirmed_at: string | null` drawn from `db.auth.admin.listUsers()`.
- `app/admin/users/page.tsx`:
  - `UserRow` gains `email_confirmed_at` + the `starter` status value.
  - New `Verified` column between `Email / Username` and `Plan`. Green checkmark with tooltip for verified users; amber `Resend` button (with `Mail` icon, `MailX` when no email on file, spinning loader while sending) for unverified.
  - New filter pill `✉ Unverified`. Also accepts `?filter=unverified` via URL.
  - New `starter` filter pill (was missing — needed for the pricing page to round-trip search URLs).
  - Header gains a `Resend to all unverified` button (only when ≥1 unverified user exists) with a confirmation modal before firing.
  - `STATUS_BADGE` map gains `starter: 'bg-sky-900/50 text-sky-300'`.
  - Summary line under the page title calls out the unverified count in amber.
  - Reload after per-row send (in case the user was already verified — toast explains).

### Behavior delivered

- Admin visits `/admin/users` — every row has a Verified cell. Header shows "X unverified" if any. Top-right shows a bulk resend button when there are unverified users.
- Filter by `✉ Unverified` — table collapses to the unverified subset.
- Click per-row `Resend` — toast "Verification email sent to foo@bar.com" (or "already verified — no email sent" if the status is stale). No refresh needed; users page reloads automatically to sync.
- Click `Resend to all unverified` — confirmation modal shows the count. Confirm → toast with the success/failure/skip breakdown.
- Over 100 unverified: the bulk endpoint returns 413 with a helpful message; admin should filter and resend per-row, or call again (each call processes the first 100 it sees).

### Merge order

1. Merge `feat/admin-email-verification`. No migrations, no new env vars.
2. Standalone feature — doesn't depend on the Starter-tier series and can land before or after those.

### Verification

1. DB inspect: an unverified user has `auth.users.email_confirmed_at = NULL`.
2. Admin `/admin/users` → their row shows the amber `Resend` button.
3. Click → toast success → check inbox (or Supabase dashboard → Auth → Logs) for the magic link.
4. Filter by `✉ Unverified` → only unverified users remain.
5. Click `Resend to all unverified` → modal → confirm → expect one email per unverified user.
6. As the user, click the magic link → log in + `email_confirmed_at` populated → admin sees green checkmark after reload.

---

## 24. Bug backlog (owner-reported 2026-04-16)

Not plans, just captured bugs. Each needs its own branch when worked on.

### 24.1 — "Recipe Ideas" button fixed (shipped in `feat/ai-recipe-generator`)

Owner decision 2026-04-16: option C — route to an AI recipe generator, with a secondary link to the public recipes hub.

**Surprise finding:** the full AI generator already existed at [app/dashboard/fuel/recipe-ideas/page.tsx](../../app/dashboard/fuel/recipe-ideas/page.tsx) with a live `/api/ai/recipe-ideas` Gemini-powered endpoint. The Fuel-page button had just been left pointing at `/tech-roadmap` with a `coming soon` flag. Zero new implementation needed — only wiring.

**Changes:**
- [app/dashboard/fuel/page.tsx](../../app/dashboard/fuel/page.tsx): Recipe Ideas card `href` → `/dashboard/fuel/recipe-ideas`, dropped the `comingSoon` flag and its UI branches (no other module used it).
- [app/dashboard/fuel/recipe-ideas/page.tsx](../../app/dashboard/fuel/recipe-ideas/page.tsx): header now has a secondary "Browse recipes" CTA linking to `/recipes` (the public hub) alongside the primary "Generate Ideas" button. Satisfies owner request for the public-hub link.

Bug closed.

### 24.2 — Finance scanner uses `/dashboard/scan` (shipped in `bug/finance-use-shared-scanner`)

Finance page was using the shared `ScanButton` component inline — captured receipt, pre-filled the Add Transaction modal with extracted fields (amount, vendor, date, line-item description). Simple but minimal.

`/dashboard/scan` has the richer flow: auto-routing (receipt → finance, recipe → recipes, maintenance → travel), ScanResultRouter for reviewing + editing extracted fields, line-item price history recording, receipt_line_items persistence, and contact attachment. Owner's assessment of "better UI/UX" tracks.

**Changes in [app/dashboard/finance/page.tsx](../../app/dashboard/finance/page.tsx):**
- Removed `ScanButton` + `ScanResult` + `ReceiptExtraction` imports.
- Removed `handleScanResult` handler (no longer needed — the scan page creates the transaction directly and links to the transaction detail page).
- Replaced the inline `<ScanButton>` with a `<Link href="/dashboard/scan">` styled identically (same purple button + ScanLine icon).

Transaction creation path now:
1. User on `/dashboard/finance` clicks "Scan Receipt" → routes to `/dashboard/scan`.
2. Capture/upload → Gemini OCR → `ScanResultRouter` preview.
3. Confirm → `/api/finance/transactions` POST + line item price records + receipt_line_items + source linking.
4. Success state links back to `/dashboard/finance/transactions/{id}` for review.

Bug closed.

### 24.3 — Landing-page checkmarks fixed (shipped in `bug/landing-checkmark-icons`)

Screenshot at [plans/bugs/Bugs-checkmarks-Screenshot 2026-04-16 at 18.02.41.png](../bugs/Bugs-checkmarks-Screenshot%202026-04-16%20at%2018.02.41.png) showed the literal string `&check;` rendering next to each feature bullet on the marketing pages. Root cause: JSX doesn't HTML-decode HTML entities the way raw HTML does — `&check;` inside a `<span>...</span>` JSX text node is emitted as the literal seven-character string.

**Fixed in [app/page.tsx:271](../../app/page.tsx#L271) and [app/features/page.tsx:80](../../app/features/page.tsx#L80):** replaced `&check;` with the Unicode checkmark `✓` (U+2713) and added `aria-hidden="true"` so screen readers don't announce it (the list-item text is the meaningful content).

Tech roadmap was also listed as broken but uses lucide's `CheckCircle2` component throughout — renders correctly with no fix needed. If the owner sees something different on `/tech-roadmap`, include a URL/screenshot and we'll reopen.

Bug closed.

---

## 25. Strategic pivot — `docs/bvc-direction-and-plan-33`

Owner-signed direction 2026-04-16 after reviewing `plans/ecosystem/`. Full detail at [`../ecosystem/centenarianos-direction.md`](../ecosystem/centenarianos-direction.md). Summary:

### 25.1 — Five directional decisions

1. **Stop adding Academy features; start producing BVC content.** Infrastructure audit (direction doc §3) puts Academy at ~90% complete for BVC Episode 1 needs. Ship Episode 1 against what exists; fix gaps only if encountered.
2. **Plan 26 full cancelled.** Native Insta360 companion would cross into Wanderlearn's scope. Plan 26.0 (already shipped) is the terminal work. Research brief stays as historical context.
3. **Starter tier stays CentOS-only for 90 days.** Re-evaluate propagation after subscription data comes in. Marketing must not claim "WitUS pricing" for the $5.46 tier until validated.
4. **Magic-link auth is a long-term priority.** Added as plan 34 (backlog stub). Every new auth change must move toward magic-link, not away.
5. **DB-sharing with Work.WitUS flagged as architectural debt.** Not deciding today — keep current shared-DB rules from CLAUDE.md, revisit when owner picks a direction.

### 25.2 — Files added

- [`../ecosystem/centenarianos-direction.md`](../ecosystem/centenarianos-direction.md) — captures the five decisions above + Academy infra completeness audit. Pointed at from STYLE_GUIDE §6a.
- [`../33-bvc-episode-1-coffee.md`](../33-bvc-episode-1-coffee.md) — content-production plan for the Academy's flagship episode. Strict editorial rules from the ecosystem doc. Lesson arc drafted for owner approval.
- [`../34-auth-magic-link-migration.md`](../34-auth-magic-link-migration.md) — backlog stub for the magic-link migration. Phased approach (A–D) so we can watch delivery reliability.

### 25.3 — Files modified

- [`../../STYLE_GUIDE.md`](../../STYLE_GUIDE.md): added **§6a — Ecosystem + direction docs are required reading before proposing features**. Claude must read the three ecosystem docs before scoping any new feature and surface conflicts before coding. Updated §7 gitignore exception list to include `plans/ecosystem/`.

### 25.4 — Remaining backlog (post-pivot)

| Plan | Status |
|---|---|
| **33** BVC Episode 1 (Coffee) | **ready — awaiting owner approval of lesson arc §4** |
| 25 iOS validation pass | open — needs device |
| 26.0 smaller v1 | shipped |
| **26 full** | **cancelled — see §25.1.2** |
| 30 Stripe fee calculator | ready — ~1–2 hrs |
| 31 i18n EN+ES + SEO | phased, 1–2 weeks |
| 32 admin email verification | shipped |
| **34** Magic-link auth migration | backlog stub |
| Starter tier | shipped, 90-day monitoring |
| BVC Episodes 2–7 | not planned — wait for Episode 1 validation |
| Academy → FlashLearnAI deep-link | not planned — post-Episode 1 |
| Academy → Wanderlearn preview blocks | not planned — post-Episode 1 |
| Fly.WitUS → CentOS activity import | not planned — post-Episode 1 |

### 25.5 — Next action for the human

Owner confirms the §4 lesson arc in [plan 33](../33-bvc-episode-1-coffee.md) (or revises), sets course pricing, starts drafting Lesson 1 content. Claude's role during plan 33 is primarily editorial assistance + Academy CSV-import wiring, not new code.

---

## 26. BVC Episode 1: Coffee — content load — `feat/bvc-coffee-content-load`

Strategic pivot from "add more Academy infrastructure" to "ship actual Academy content" per the ecosystem direction. Master doc at [plans/BVC/BVC_Episode_1_Coffee_MASTER.md](../BVC/BVC_Episode_1_Coffee_MASTER.md) converted to Academy-ready assets. **Audio recording deferred** — all lessons ship as text + data + maps first, upgrade to audio lesson type when MP3s drop.

### 26.1 — Decisions confirmed this branch

From owner review of `plans/BVC/`:

1. **Arc matches master doc**, not the chronological version I first drafted. Episode 1 has a subject-lens structure across all 7 Season 1 episodes: Cold Open → Geography → Social Studies → Economics → ELA → Closing → Quiz → Project.
2. **Audience: podcast listeners ages 25–45 primary; grades 9–12 IAS-aligned educational target secondary.** Marketing copy and Welcome lesson lead with adult podcast framing.
3. **Teacher resources:** attached as downloadable document on Lesson 1 (via `lessons.documents` JSONB) — not a separate role-gated module (that primitive doesn't exist yet; not built here).
4. **Duplicate file deleted:** `plans/BVC/BVC_Episode_1_Coffee_MASTER (1).md` removed (byte-identical to the canonical file).
5. **Season 2 + 3 content exists at `plans/BVC/BVC Season 2 and 3/`** — 7 more episodes (Beer, Wine, Whiskey, Rum, Tequila/Mezcal, Sake, Synthesis) + Season 3 forbidden-leaf plan (Tobacco, Cannabis, Opium, Coca, Psychedelics, Khat, Synthesis). Same 4-subject-lens structure. Out of scope for this branch — ship Episode 1 first, validate against real students, then scale.

### 26.2 — Files added

**Source-of-truth content (force-added under `content/`):**
- [`content/tutorials/bvc/coffee/01-welcome.md`](../../content/tutorials/bvc/coffee/01-welcome.md) through `08-project.md` — 8 student-facing lesson markdowns.
- [`content/tutorials/bvc/coffee/map.json`](../../content/tutorials/bvc/coffee/map.json) — Lesson 2 Geography `map_content`: 13 markers (top 10 producers + 3 historical trade ports), 3 trade-route polylines (Yemen→Ottoman, Ottoman→Europe, Colonial Atlantic), 2 Coffee Belt polygons (north + south halves).
- [`content/tutorials/bvc/coffee/quiz.json`](../../content/tutorials/bvc/coffee/quiz.json) — Lesson 7 `quiz_content`: 8 multiple-choice questions with explanations + APA citations, 75% passing score, unlimited attempts.
- [`content/tutorials/bvc/coffee/documents.json`](../../content/tutorials/bvc/coffee/documents.json) — Lesson 1 `documents` array: teacher resources (PDF placeholder) + 5 primary-source URLs with archive attribution.
- [`content/tutorials/bvc/coffee/teacher-resources.md`](../../content/tutorials/bvc/coffee/teacher-resources.md) — full teacher guide (IAS + Common Core alignment, 4 classroom activities, project rubrics, knowledge-check answers, differentiation, bibliography). Owner uploads this as PDF to Cloudinary and pastes the URL into `documents.json`.
- [`content/tutorials/bvc/coffee/glossary.csv`](../../content/tutorials/bvc/coffee/glossary.csv) — 21 glossary terms drawn from the master doc's Pronunciation Quick Reference + Geography/Social Studies/Economics/ELA vocabulary.

**Import-ready CSVs (tracked under `public/templates/`):**
- [`public/templates/bvc-episode-1-coffee-lessons.csv`](../../public/templates/bvc-episode-1-coffee-lessons.csv) — 8 lessons ready for owner import via `/dashboard/teaching/[username]/courses/[id]/import`. JSON cells (map_content, documents, quiz_content) minified and CSV-escaped; round-trip tested.
- [`public/templates/bvc-season-1-recording-schedule.csv`](../../public/templates/bvc-season-1-recording-schedule.csv) — 42 tasks across 7 episode goals in a single roadmap (`BVC Season 1 Recording`). Per-episode cadence: prep → record day 1 → record day 2 → edit → QA → publish. 2 weeks per episode, April 20 → August 14, 2026.

**Tooling:**
- [`scripts/generate-bvc-coffee-csv.mjs`](../../scripts/generate-bvc-coffee-csv.mjs) — regenerates the lessons CSV from the source markdown + JSON whenever content changes. Pattern for Episodes 2–7 when their time comes.

**Plan:**
- [`plans/33-bvc-episode-1-coffee.md`](../33-bvc-episode-1-coffee.md) — revised (content production pipeline, arc matching master doc, audio upgrade path, success criteria).

### 26.3 — Owner import steps

After merging this branch:

1. `/dashboard/teaching/[username]/courses/new` — create course:
   - Title: *Better Vice Club: Coffee*
   - Category: *Better Vice Club*
   - Navigation: `cyoa`
   - Price: decide (suggested $19.99 one-time or bundled in paid tier)
   - Cover image: origin-region or extraction photo (not a stock mug shot)
2. Import lessons: course editor → Import → upload `public/templates/bvc-episode-1-coffee-lessons.csv`, mode `create`.
3. Upload teacher-resources.md as a PDF (or markdown) to Cloudinary folder `academy/bvc/coffee/` and replace `REPLACE_WITH_CLOUDINARY_URL_AFTER_UPLOADING_teacher-resources.pdf` in the Lesson 1 documents array.
4. Import glossary via `/dashboard/teaching/[username]/courses/[id]/glossary` → upload `content/tutorials/bvc/coffee/glossary.csv`.
5. Publish: toggle `is_published = true`.
6. Import recording schedule: `/dashboard/data/import/planner` → upload `public/templates/bvc-season-1-recording-schedule.csv`.

### 26.4 — Audio upgrade path

When each segment's MP3 is recorded (per the schedule):

1. Upload MP3 to Cloudinary `academy/bvc/coffee/`.
2. Edit the lesson via the course editor:
   - Change `lesson_type` from `text` → `audio`.
   - Paste the Cloudinary secure URL into `content_url`.
   - Paste chapter markers (CUT-1A, CUT-1B, etc. with timestamps from the recording).
   - Paste synced transcript into `transcript_content`.
   - `text_content` (the data sheet) remains intact as reading material alongside the audio.

No code changes, no redeploy. The lesson page renders audio player + transcript + chapters + data sheet automatically based on `lesson_type`.

### 26.5 — Merge order

1. Owner reviews the lesson content, especially Lesson 2 Geography's map markers (lat/lon accuracy) and Lesson 7 quiz questions.
2. Merge `feat/bvc-coffee-content-load` to main.
3. Owner runs the import steps in §25.3.
4. Audio recording proceeds on the schedule in the second CSV.

### 26.6 — Remaining backlog

| Plan | Status |
|---|---|
| **33 BVC Episode 1 Coffee** | **content loaded this branch; awaiting owner import + audio recording** |
| 25 iOS validation pass | open — needs device |
| 26 full | cancelled (per direction doc, belongs to Wanderlearn) |
| 30 Stripe fee calculator | ready — ~1–2 hrs |
| 31 i18n EN+ES + SEO | phased |
| 32 admin email verification | shipped |
| 34 Magic-link auth migration | backlog stub |
| BVC Episodes 2–7 Season 1 | content exists at `plans/BVC/`, load after Episode 1 validates |
| BVC Season 2 (Episodes 8–14) — alcohol | content exists at `plans/BVC/BVC Season 2 and 3/`, load after Season 1 ships |
| BVC Season 3 (Episodes 15–21) — forbidden leaf | content exists, plan at `plans/BVC/BVC Season 2 and 3/BVC_Season_3_The_Forbidden_Leaf_MASTER_PLAN.md`, load after Season 2 ships |
| Starter tier | shipped, 90-day monitoring |

---

## 27. BVC launch polish + post-launch backlog — `feat/bvc-polish-and-post-launch-plans`

Closes the "final 10%" minor-gap list from [`ecosystem/centenarianos-direction.md §3.2`](../ecosystem/centenarianos-direction.md). One code change that was blocking Episode 1's marketing polish; four plan stubs for items that don't need to ship before launch but are the obvious next moves after Episode 1 validates.

### 27.1 — Code changes

- **[`components/academy/course-editor/CourseInfoTab.tsx`](../../components/academy/course-editor/CourseInfoTab.tsx) — `CATEGORY_OPTIONS`:** added `Better Vice Club` as the first option in the course-category datalist. Teachers creating BVC courses now get it as an autocomplete suggestion rather than having to type it freeform (risking typo drift across Episodes 1–7).

That's the only code change. Every other gap item is either backlog-plan material (§27.2) or already enforced in plan 33 (§27.3).

### 27.2 — Post-launch plan stubs added

Each is a backlog-ready design doc with scope, data model, files to add/modify, verification checklist, and risks. No code yet — open the branch when the plan reaches the top of the queue.

- [`plans/35-academy-completion-certificates.md`](../35-academy-completion-certificates.md) — `course_completions` table, HTML→PDF via Puppeteer or `@react-pdf/renderer`, Cloudinary storage, public verification URL, email delivery via existing Resend integration. Estimate 2–3 days.
- [`plans/36-academy-teacher-analytics.md`](../36-academy-teacher-analytics.md) — cohort heatmap (students × lessons) on the teacher course-detail page. Single aggregate endpoint + one grid component + CSV export. Estimate 1–2 days. Build when ≥5 real students per course.
- [`plans/37-a11y-axe-core-ci.md`](../37-a11y-axe-core-ci.md) — `@axe-core/playwright` smoke tests on top-10 routes, GitHub Actions on every PR against main. Phased: baseline scan → fix critical/serious → enable enforcement. Estimate 2–3 days. Ship before scaling BVC to schools that require WCAG AA.
- [`plans/38-classroom-family-plan.md`](../38-classroom-family-plan.md) — `family_plans` + `family_plan_members` tables, multi-seat Stripe tier, invitation flow, "covered by" billing messaging. **Explicitly blocked on demand validation** — don't build until at least one real teacher asks for bulk-enrollment. BVC Episode 1 tests the assumption that per-student enrollment is adequate.

### 27.3 — Content-production rules (already in place, not re-shipping)

Items from the gap list that are already enforced by the existing plan 33 §3 "Content rules (non-negotiable, per ecosystem doc)":

- **APA citations with working URLs** — plan 33 §3 rule 2. Enforced editorially.
- **Indigenous knowledge treated as valid and rigorous** — plan 33 §3 rule 4. Enforced editorially.
- **No-fabrication rule** — plan 33 §3 rule 1 (no Rosa, Mrs. Chen, Uncle Keoni, Elena, Dr. Martinez). Enforced editorially.
- **Peer-reviewed sources for scientific claims** — plan 33 §3 rule 3.
- **No sensationalism** — plan 33 §3 rule 5.

These are editorial gates, not code. Enforcement happens during content review before publish.

### 27.4 — Episode authoring workflow

Per the direction doc: **adequate for Episode 1**. Single-owner authoring via the course editor + bulk CSV import as the escape hatch. Plan 33's [CSV template](../../public/templates/bvc-episode-1-coffee-lessons.csv) + [generator script](../../scripts/generate-bvc-coffee-csv.mjs) make Episodes 2–7 a template exercise rather than from-scratch work.

No workflow changes needed. Revisit if multiple teachers need to co-author simultaneously.

### 27.5 — Merge order

1. This branch stacks on `feat/bvc-coffee-content-load` (§26). Merge 26 first, then 27.
2. Single tiny code change — safe to merge. Plan stubs are docs only.
3. No migrations, no new env vars.

### 27.6 — Remaining backlog (after §26 + §27 land)

| Plan | Status |
|---|---|
| **33 BVC Episode 1 Coffee** | content loaded (§26); owner to import + record audio per schedule |
| 25 iOS validation pass | open — needs device |
| 26 full | cancelled (belongs to Wanderlearn) |
| 30 Stripe fee calculator | ready — ~1–2 hrs |
| 31 i18n EN+ES + SEO | phased |
| 32 admin email verification | shipped |
| 34 Magic-link auth migration | backlog stub |
| **35 completion certificates** | **new** — backlog, 2–3 days |
| **36 teacher analytics heatmap** | **new** — backlog, 1–2 days, build at ≥5 students/course |
| **37 a11y axe-core CI** | **new** — backlog, 2–3 days, ship before school-scale |
| **38 classroom/family plan** | **new** — blocked on teacher demand signal |
| BVC Episodes 2–7 Season 1 | content exists; load after Episode 1 validates |
| BVC Season 2 + 3 | content exists; load after Season 1 ships |
| Starter tier | shipped, 90-day monitoring |
