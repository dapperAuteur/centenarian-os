import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { markdownToTiptapJSON } from '@/lib/blog/markdown-to-tiptap';
import { generateSlug, makeUniqueSlug } from '@/lib/blog/slug';
import { estimateReadingTime } from '@/lib/blog/reading-time';
import { MAX_IMPORT_ROWS } from '@/lib/csv/helpers';

interface ImportRow {
  title: string;
  slug?: string;
  excerpt?: string;
  visibility?: string;
  tags?: string;
  video_url?: string;
  content?: string;
  scheduled_at?: string;
}

const VALID_VISIBILITY = ['draft', 'private', 'public', 'authenticated_only', 'scheduled'];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Admin-only: check email
  if (user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { rows } = (await req.json()) as { rows: ImportRow[] };
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ error: `Max ${MAX_IMPORT_ROWS} rows` }, { status: 400 });
  }

  const imported: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    if (!row.title?.trim()) {
      skipped.push(`Row ${rowNum}: missing title`);
      continue;
    }

    const title = row.title.trim();
    const baseSlug = row.slug?.trim() || generateSlug(title);
    const visibility = VALID_VISIBILITY.includes(row.visibility || '')
      ? row.visibility!
      : 'draft';

    // Parse tags from pipe-separated string
    const tags = row.tags
      ? row.tags.split('|').map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [];

    // Convert markdown content to Tiptap JSON
    const markdown = row.content?.trim() || '';
    let tiptapContent: object = { type: 'doc', content: [] };

    if (markdown) {
      try {
        tiptapContent = markdownToTiptapJSON(markdown);
      } catch {
        errors.push(`Row ${rowNum}: failed to parse markdown`);
        continue;
      }
    }

    // If video_url provided, append a videoEmbed node at the top of the content
    if (row.video_url?.trim()) {
      const doc = tiptapContent as { type: string; content: object[] };
      doc.content = [
        { type: 'videoEmbed', attrs: { src: row.video_url.trim() } },
        ...doc.content,
      ];
    }

    const readingTime = estimateReadingTime(tiptapContent);

    // Ensure unique slug
    const slug = await makeUniqueSlug(baseSlug, async (candidate) => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('user_id', user.id)
        .eq('slug', candidate)
        .maybeSingle();
      return !!data;
    });

    const now = new Date().toISOString();
    const publishedAt = visibility !== 'draft' ? now : null;
    const scheduledAt = visibility === 'scheduled' && row.scheduled_at
      ? row.scheduled_at
      : null;

    const { error } = await supabase.from('blog_posts').insert({
      user_id: user.id,
      title,
      slug,
      excerpt: row.excerpt?.trim() || null,
      content: tiptapContent,
      visibility,
      tags,
      reading_time_minutes: readingTime,
      published_at: publishedAt,
      scheduled_at: scheduledAt,
    });

    if (error) {
      errors.push(`Row ${rowNum} ("${title}"): ${error.message}`);
    } else {
      imported.push(title);
    }
  }

  return NextResponse.json({ imported: imported.length, skipped, errors });
}
