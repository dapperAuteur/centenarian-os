# Centenarian Academy — Admin Guide

## Overview

As platform admin, you have full visibility and control over all Academy activity. The admin Academy section covers:

- Platform settings (teacher fee, Stripe Price ID)
- All courses regardless of publish status
- Live session management
- User role management (promote to teacher/admin)

---

## 1. Academy Platform Settings

**Path:** `/admin/academy/settings`

| Setting | Description |
|---|---|
| Teacher Fee % | Percentage of each paid enrollment kept by the platform (default: 15) |
| Teacher Stripe Price ID | The Stripe Price ID for the teacher subscription plan |

### Changing the Platform Fee

The platform fee is applied at Stripe Checkout for every paid course enrollment. Changing it here affects all future checkouts — existing enrollments are not retroactively adjusted.

1. Navigate to `/admin/academy/settings`
2. Update **Platform Fee %**
3. Click **Save Settings**

### Setting Up the Teacher Plan

1. In your Stripe dashboard, create a Product called "Centenarian Academy Teacher" with monthly and/or annual prices
2. Copy the Price ID(s) (e.g., `price_1AbCdEfGhIjKlMnO`)
3. Paste into **Teacher Stripe Price ID** on the settings page
4. Set the same Price ID in your `.env` as `TEACHER_MONTHLY_PRICE_ID`

When a user subscribes to this price through Stripe Checkout, the webhook sets `profiles.role = 'teacher'` automatically.

---

## 2. Courses Overview

**Path:** `/admin/academy`

The admin courses page lists all courses on the platform regardless of publish status:

| Column | Description |
|---|---|
| Title | Course name with link to detail page |
| Teacher | Instructor name |
| Status | Draft / Published |
| Visibility | Public / Members / Scheduled |
| Enrollments | Count of active student enrollments |
| Created | Creation date |

### Actions Available

- View any course detail page (including drafts)
- Unpublish a course that violates platform guidelines
- Delete a course (irreversible — confirm with teacher first)

---

## 3. Live Sessions

**Path:** `/admin/live`

Manage CentenarianOS Team live sessions (separate from teacher-led per-course sessions).

### Creating a Session

1. Click **New Session**
2. Fill in:
   - **Title** — public session name
   - **Description** — what the session covers
   - **Scheduled At** — date and time
   - **Embed Code** — full `<iframe>` HTML from your streaming provider (Viloud.tv, Mux, Zoom, etc.)
   - **Visibility** — Public (anyone) or Members Only
3. Click **Create**

### Going Live

When your stream starts:
1. Find the session in the list
2. Click the **Go Live** toggle
3. The session badge changes to a live indicator and the embed becomes visible to eligible users at `/live`

Click **End Session** when the stream is over to toggle it off.

### Viloud.tv Embed Format

```html
<iframe
  src="https://player.viloud.tv/embed/live/YOUR_CHANNEL_ID?autoplay=1&controls=1&random=1&title=0&share=0&playsinline=1"
  width="100%"
  height="100%"
  frameborder="0"
  allowfullscreen
  allow="autoplay"
></iframe>
```

Replace `YOUR_CHANNEL_ID` with your Viloud channel ID.

---

## 4. User Roles

**Path:** `/admin/users` (existing admin user management)

User roles on the platform:

| Role | Access |
|---|---|
| `member` | Can enroll in and take courses |
| `teacher` | Can create and publish courses, grade assignments, receive payouts |
| `admin` | Full platform access, can see all data |

### Promoting a User to Teacher Manually

In the admin user management page, find the user and update their role to `teacher`. This bypasses the Stripe subscription requirement — use for internal staff or beta teachers only.

### Promoting to Admin

Set `profiles.role = 'admin'` directly in the Supabase dashboard or via SQL. Use with caution — admin access grants full data visibility.

---

## 5. Monitoring Assignments & Submissions

Assignments and submissions are visible in the Supabase dashboard:

- `assignments` table — all assignments across all courses
- `assignment_submissions` table — all student submissions with grade and feedback
- `submission_messages` table — full message threads

For day-to-day operations, teachers manage their own assignment grading. Admin visibility here is for support, moderation, and dispute resolution.

---

## 6. Stripe Connect Oversight

When teachers complete Stripe Connect onboarding:
- Their `teacher_profiles.stripe_connect_account_id` is populated
- `teacher_profiles.stripe_connect_onboarded` is set to `true`

You can view all connected teacher accounts in your Stripe Dashboard under **Connect → Accounts**.

Platform fees flow to your main Stripe account. Teacher payouts are sent directly to the teacher's connected bank account.

---

## 7. Environment Variables Required

All of these must be set in `.env.local` (development) and Vercel environment variables (production):

```
# Existing Stripe
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...

# Academy additions
TEACHER_MONTHLY_PRICE_ID=price_...
STRIPE_ACADEMY_WEBHOOK_SECRET=whsec_...

# Cloudinary (also used for submission uploads)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=...

# Gemini (for CYOA embeddings)
GEMINI_API_KEY=...

# Supabase (existing)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 8. Pending Migrations

Run these in the Supabase SQL Editor in order if not already applied:

| Migration | What it does |
|---|---|
| `039_lms_schema.sql` | Core LMS tables (courses, lessons, enrollments, etc.) |
| `040_visibility.sql` | Adds visibility + published_at to courses and live_sessions |
| `041_submission_drafts.sql` | Adds draft status + multi-file media_urls to submissions |

---

## 9. Quick Reference

| Action | Path |
|---|---|
| Academy platform settings | `/admin/academy/settings` |
| All courses overview | `/admin/academy` |
| Live session management | `/admin/live` |
| User management | `/admin/users` |
| Feedback submissions | `/admin/feedback` |
| Stripe Dashboard | External link from payouts or `/admin` |
