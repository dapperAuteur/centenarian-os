-- 055_lesson_content_format.sql
-- Adds content_format column to lessons to support both markdown and Tiptap WYSIWYG content.

ALTER TABLE lessons
  ADD COLUMN content_format TEXT NOT NULL DEFAULT 'markdown'
    CHECK (content_format IN ('markdown', 'tiptap'));
