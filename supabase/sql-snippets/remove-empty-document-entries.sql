-- supabase/sql-snippets/remove-empty-document-entries.sql
-- Clean-up for lessons.documents JSONB arrays that contain entries
-- with empty / missing `url` fields.
--
-- Background: an earlier audit NULL-ed out the `url` field on every
-- document whose href was a local `/docs/bvc/…` path (see
-- find-broken-document-urls.sql). Those entries now exist as
-- `{ "id": "…", "title": "…", "url": "", … }` objects — still visible
-- as cards in the student viewer, still click-through to the "This
-- document hasn't been uploaded yet." fallback. If the teacher
-- uploaded a REPLACEMENT PDF into a NEW document row instead of
-- editing the existing empty one, both end up sitting in the array.
--
-- This snippet does two things:
--   1. SELECT: show every lesson + doc whose url is empty/missing so
--      the teacher can see what will be removed.
--   2. UPDATE: drop those elements from the JSONB array (NOT just
--      null the field — actually remove the object).
--
-- Run the SELECT first. If the output matches your expectation, run
-- the UPDATE. Both are safe to re-run (the UPDATE is idempotent).

-- ── Preview ────────────────────────────────────────────────────────

SELECT
  c.title       AS course_title,
  l.id          AS lesson_id,
  l.title       AS lesson_title,
  doc->>'id'    AS doc_id,
  doc->>'title' AS doc_title,
  doc->>'url'   AS doc_url
FROM lessons l
JOIN courses c ON c.id = l.course_id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(l.documents, '[]'::jsonb)) AS doc
WHERE doc->>'url' IS NULL OR TRIM(doc->>'url') = ''
ORDER BY course_title, lesson_title, doc_title;

-- ── Remove (run after reviewing the SELECT above) ──────────────────

-- UPDATE lessons
-- SET
--   documents = (
--     SELECT COALESCE(jsonb_agg(doc), '[]'::jsonb)
--     FROM jsonb_array_elements(documents) AS doc
--     WHERE doc->>'url' IS NOT NULL AND TRIM(doc->>'url') <> ''
--   ),
--   updated_at = NOW()
-- WHERE documents::text ~ '"url"\s*:\s*""'
--    OR documents::text ~ '"url"\s*:\s*null';

-- ── Verify ──────────────────────────────────────────────────────────
-- After running the UPDATE, the SELECT above should return zero rows.
-- Students whose lesson pages still show "not uploaded" after this
-- cleanup need the teacher to re-upload the missing PDF — the empty
-- placeholder is gone, so the resource list matches what's actually
-- available.
