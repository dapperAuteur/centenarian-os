# CentenarianOS Blog — User Guide

## What Is the Blog?

The Blog is your public writing space inside CentenarianOS. Share what you're learning about longevity, document your health journey, write recipes, or publish thought leadership — everything lives at `/blog` and is readable by anyone on the internet.

Your posts are tied to your profile. Visitors who enjoy your writing can follow the link to your author page (`/blog/[username]`) and see everything you've published.

---

## Getting Started — Set Your Username

Before you can publish anything, you need a username. If you haven't set one yet, you'll be prompted the first time you try to publish.

1. Go to **Dashboard → Profile** and set a username (lowercase letters, numbers, hyphens only).
2. Your username becomes part of your post URLs: `/blog/yourname/post-slug`.
3. Username cannot be changed after you've published posts, so choose carefully.

---

## Creating Your First Post

### Step 1 — Open the Editor

Navigate to **Dashboard → Blog** and click **New Post** (or go directly to `/dashboard/blog/new`).

### Step 2 — Write Your Title

The title field is at the top. It's large and prominent — write something clear and specific. The URL slug is auto-generated from your title (e.g., "My 30-Day Walking Experiment" → `my-30-day-walking-experiment`). You can edit the slug manually if you want something shorter.

### Step 3 — Add a Cover Image

Click the cover image area to upload a photo from your device. Images are stored on Cloudinary. The cover displays at the top of your post and in the post card on the blog listing. Recommended aspect ratio: 16:9 or wider.

### Step 4 — Write Your Content

The editor is a rich-text editor (Tiptap) with a toolbar. Key features:

- **Headings** — H1, H2, H3 for structure
- **Bold, Italic, Underline, Strikethrough** — inline emphasis
- **Bullet lists and numbered lists**
- **Block quotes** — great for citing research or highlighting a key insight
- **Code blocks** — for sharing formulas, data, or scripts
- **Links** — paste a URL and select text to hyperlink
- **Images** — embed additional images inline using the toolbar image button (Cloudinary upload)
- **Horizontal rule** — section dividers
- **Undo/Redo** — Cmd+Z / Cmd+Shift+Z

**Writing tip:** Use H2 headings to break your post into sections. Posts with clear structure are easier to read and perform better.

### Step 5 — Add an Excerpt

The excerpt is a short summary (up to 500 characters) that appears in post cards on the blog listing and in social share previews. Write 1–3 sentences that make someone want to click.

### Step 6 — Add Tags

Tags help readers find related content. Type a tag and press Enter to add it. Use specific tags like `sleep`, `hrv`, `walking`, `longevity`, `nutrition`. Tags are searchable on the blog listing page. Aim for 3–6 tags per post.

### Step 7 — Set Visibility

Choose how your post is published:

| Visibility | Who Can Read |
|---|---|
| **Draft** | Only you. Not listed anywhere. |
| **Public** | Everyone, including non-logged-in visitors. |
| **Members Only** | Only logged-in CentenarianOS users. |
| **Scheduled** | Goes public automatically at a date/time you set. |

### Step 8 — Publish

Click **Publish** to make your post live (or **Save Draft** to keep working). You'll see a confirmation and a link to view the live post.

---

## Editing a Published Post

Go to **Dashboard → Blog**, find your post in the list, and click **Edit**. Changes save immediately when you click **Update Post**. Edits to published posts go live right away — there's no re-approval needed.

---

## Scheduling a Post

To schedule a post for future publication:

1. Set **Visibility → Scheduled**.
2. Pick a future date and time using the date picker that appears.
3. Click **Save**. The post will be invisible to readers until the scheduled time, at which point it automatically becomes public.

---

## Importing Markdown Posts

If you already have posts written in Markdown (from a blog tool like Ghost, Obsidian, or Notion exports), you can import them in bulk.

1. Go to **Dashboard → Blog → Import** (or `/dashboard/blog/import`).
2. Paste or upload your Markdown content.
3. The importer converts Markdown to the rich editor format automatically.
4. Review the imported post and adjust formatting before publishing.

---

## Understanding Your Analytics

Every post has an analytics view. Click **Analytics** on any post in the Dashboard.

### Metrics tracked:

| Metric | What It Means |
|---|---|
| **Views** | How many times the post was opened |
| **Read 25% / 50% / 75% / 100%** | How far readers scrolled through your content |
| **Share — Copy Link** | How many times the link was copied |
| **Share — Email** | Shares via email |
| **Share — LinkedIn** | LinkedIn shares |
| **Country** | Where your readers are coming from |
| **Referrer** | What website or search engine sent them |

**Read depth** is the most valuable signal — if most readers hit 25% but drop off before 50%, your post may be losing people early. Consider a stronger hook or clearer structure.

---

## Sharing Your Post

Each post has a **Share Bar** at the bottom with:
- **Copy Link** — copies the full URL to your clipboard
- **Email** — opens your email client with a pre-filled subject and link
- **LinkedIn** — opens LinkedIn's share dialog with your post title

You can also share your author page link (`/blog/[username]`) on social media to drive traffic to all your posts at once.

---

## Liking and Saving Posts

As a reader, you can:
- **Like** a post (heart icon) — shows the author their content resonates
- **Save** a post (bookmark icon) — adds it to your personal saved list at Dashboard → Blog → Saved

Your own liked and saved posts are visible on your dashboard under the **Liked** and **Saved** tabs.

---

## Reading Time

Reading time is automatically calculated from your post length and displayed on the post card and at the top of the post. It estimates approximately 200 words per minute. Longer posts (8–15 min read) tend to perform well in longevity and health niches where readers are engaged and curious.

---

## Tips for High-Performing Posts

1. **Be specific** — "How I lowered my resting heart rate from 68 to 54 in 90 days" outperforms "About heart rate."
2. **Share your data** — CentenarianOS readers are data-curious. Include actual numbers from your metrics.
3. **Use structure** — Lead with a hook, break into H2 sections, end with a clear takeaway.
4. **Tag consistently** — Use the same tags across related posts to build topic clusters on your author page.
5. **Publish on a schedule** — Consistency builds audience. Even one post per week compounds over time.
6. **Cross-post your recipes** — Link from a blog post to a related recipe you've published, and vice versa.

---

## Frequently Asked Questions

**Can I delete a post?**
Yes. In Dashboard → Blog, click the menu (three dots) on any post and select Delete. Deletion is permanent.

**Can I have multiple authors on one post?**
Currently, posts are single-author. You can quote or credit co-authors inside the post body.

**Does my draft auto-save?**
The editor saves on every change. If you close the browser, your draft is preserved.

**Can readers comment on my posts?**
Comments are not yet available. Engagement currently happens through likes, saves, and shares.

**Will my post appear in search engines?**
Public posts are indexable by search engines. Your post URL, title, excerpt, and cover image are used for SEO metadata automatically.

**What's the character limit for posts?**
There is no hard limit on post length. The excerpt is capped at 500 characters.
