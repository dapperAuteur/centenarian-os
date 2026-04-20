-- supabase/sql-snippets/find-broken-document-urls.sql
-- One-off audit: list every lesson document whose url isn't an
-- absolute http(s) link.
--
-- Root cause tracked back to the BVC Coffee CSV bulk import — the
-- seed data wrote local paths like "/docs/bvc/s1/coffee-geography.pdf"
-- for each data sheet, on the assumption those files would be served
-- out of the Next.js /public/ directory. They're not, so the student
-- viewer hits them and 404s.
--
-- Run in the Supabase SQL editor. For each row returned, open the
-- lesson in the teacher editor, delete the broken document entry, and
-- re-upload the PDF through the upload widget — that writes the
-- correct https://res.cloudinary.com/ URL.

WITH broken AS (
  SELECT
    l.id          AS lesson_id,
    l.title       AS lesson_title,
    l.course_id,
    c.title       AS course_title,
    (doc->>'id')          AS doc_id,
    (doc->>'title')       AS doc_title,
    (doc->>'url')         AS doc_url
  FROM lessons l
  JOIN courses c ON c.id = l.course_id
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(l.documents, '[]'::jsonb)) AS doc
  WHERE
    doc->>'url' IS NOT NULL
    AND doc->>'url' <> ''
    AND doc->>'url' !~* '^https?://'
)
SELECT *
FROM broken
ORDER BY course_title, lesson_title, doc_title;

-- Once you have the list, you can patch a specific document URL in
-- place without re-running the full upload flow. Example — replace
-- the Coffee Geography Data Sheet url on lesson ce2c93c9-… with the
-- new Cloudinary URL:
--
-- UPDATE lessons
-- SET documents = (
--   SELECT jsonb_agg(
--     CASE
--       WHEN doc->>'id' = '<doc id from query above>'
--       THEN jsonb_set(doc, '{url}', '"https://res.cloudinary.com/devdash54321/raw/upload/v1776721073/centos-feedback/hxrmc2xjiigdbst9p7jz.pdf"')
--       ELSE doc
--     END
--   )
--   FROM jsonb_array_elements(documents) AS doc
-- ),
-- updated_at = NOW()
-- WHERE id = 'ce2c93c9-e8e6-4e6c-a931-39835e42b135';
