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
