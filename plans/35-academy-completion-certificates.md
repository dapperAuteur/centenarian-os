# Plan 35 — Academy Completion Certificates

> **Status:** Backlog. Not blocking BVC Episode 1 launch; valuable for the grades 9-12 audience once Episode 1 is live.
> **Source:** owner request 2026-04-16 — close the "final 10%" of Academy polish. Listed in [`ecosystem/centenarianos-direction.md §3.2`](ecosystem/centenarianos-direction.md) as a minor gap.
> **Effort:** Medium — estimate 2–3 days. Breaks into schema + generation + delivery.

---

## 1. Context

Students who complete a course should receive a shareable, verifiable certificate. For the BVC Season 1 grades-9–12 audience this doubles as evidence for school portfolios, college applications, and homeschool record-keeping. For adult podcast listeners it's a social signal they can share on LinkedIn.

Academy already tracks completion via `lesson_progress.completed_at` per lesson. A course is "completed" when all non-optional lessons have `completed_at` set. There is no certificate artifact today.

---

## 2. Scope

**In scope:**
- New table `course_completions` (one row per user × course). Created by trigger or API endpoint when the last lesson is completed.
- Certificate PDF generation pipeline. HTML → PDF rendering via headless Chromium (Puppeteer) OR `@react-pdf/renderer`. Whichever doesn't hit the npm-install block and works on Vercel's Node runtime.
- Cloudinary storage for rendered PDFs (folder `academy/certificates/<year>/`).
- Public verification URL pattern: `/academy/verify/<token>` renders a read-only cert with the student name, course title, completion date, and a CentenarianOS hash signature so third parties can confirm authenticity.
- Student UI: download button on completed course page, certificate badge in user profile + /academy/my-courses.
- Email delivery: on completion, send a congratulations email with the PDF attached. Uses existing Resend integration + templates from the transactional email system.

**Out of scope:**
- Printable diploma-style aesthetic variants. Ship one branded template; iterate later.
- Paper mail delivery. Digital only.
- Integration with third-party credential registries (Credly, Accredible). Add if demand materializes.
- Teacher-signed certificates. The course teacher's name appears on the PDF, but there's no cryptographic signing beyond the verification hash.

## 3. Data model

```sql
-- supabase/migrations/183_course_completions.sql (next number after 182 starter_tier)
CREATE TABLE IF NOT EXISTS public.course_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  certificate_url TEXT,        -- Cloudinary URL, populated after PDF generation
  verification_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  UNIQUE (user_id, course_id)
);
CREATE INDEX IF NOT EXISTS course_completions_user_idx ON public.course_completions(user_id);
ALTER TABLE public.course_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own completions + public verification" ON public.course_completions
  FOR SELECT USING (user_id = auth.uid() OR true);  -- verification URL is public-by-token
```

## 4. Trigger for auto-creation

Option A (DB trigger): after every `lesson_progress` insert/update, check if all non-optional lessons for the course have `completed_at`. If yes, upsert `course_completions`. Keeps the logic atomic but harder to test.

Option B (API endpoint): `POST /api/academy/courses/[id]/complete` called from the lesson-completion client code. Simpler, explicit, testable.

**Recommendation:** Option B. Client fires when lesson progress upsert returns `all_lessons_completed: true` (add that to the response).

## 5. Generation pipeline

1. `POST /api/academy/courses/[id]/complete` creates the row with `certificate_url = NULL`.
2. Background job (or inline if fast enough): render HTML template → PDF → upload to Cloudinary → patch `certificate_url`.
3. Trigger email via Resend with the PDF attached.

Template lives in `templates/academy-certificate.html` — CentenarianOS branding, student name, course title + teacher name, completion date, verification URL + hash, QR code linking to verification page.

## 6. Verification URL

Public page at `/academy/verify/<token>` — no auth required. Fetches the `course_completions` row by token, renders a minimal read-only view. Third parties can confirm authenticity.

## 7. Files to add

- `supabase/migrations/183_course_completions.sql`
- `app/api/academy/courses/[id]/complete/route.ts`
- `lib/academy/certificate-template.ts` (HTML template + render function)
- `app/academy/verify/[token]/page.tsx`
- `components/academy/CertificateDownloadButton.tsx`

## 8. Verification

1. Enroll in a test course, complete all lessons.
2. `course_completions` row appears within ~5 seconds. `certificate_url` populated within ~30 seconds.
3. Open the course page → download button appears. Downloaded PDF is branded, readable, has student name.
4. Email arrives with PDF attached.
5. Visit `/academy/verify/<token>` in a different browser → renders the same data publicly.
6. Edit the token or change a character → verification page shows "not found".

## 9. Risks + follow-ups

- **Puppeteer on Vercel:** cold-start overhead. Acceptable for v1 since PDF generation is async; if it becomes a problem, switch to `@react-pdf/renderer` (pure JS, no Chromium).
- **PDF template versioning:** once an older cert is generated, reprinting it should match the original template. Store the template version alongside; regenerate from the same version if requested.
- **Fraud:** the verification-hash design prevents simple URL-guessing forgery. Actual PDF tampering is possible; not worth solving at v1 — the verification page is the authoritative source.
