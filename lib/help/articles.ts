// lib/help/articles.ts
// Chunked tutorial content for the Academy RAG help system.
// Role: 'student' | 'teacher' | 'admin' | 'all'
// Each chunk is embedded and stored in help_articles via /api/admin/help/ingest.

export interface HelpArticle {
  title: string;
  content: string;
  role: 'student' | 'teacher' | 'admin' | 'all';
}

export const HELP_ARTICLES: HelpArticle[] = [
  // ─── STUDENT ─────────────────────────────────────────────────────────────────

  {
    role: 'student',
    title: 'What is Centenarian Academy?',
    content: `Centenarian Academy is the learning platform inside CentenarianOS. Members can enroll in courses taught by longevity experts, health coaches, and community teachers. Courses include video lessons, text content, audio tracks, assignments, live sessions, and an optional Choose-Your-Own-Adventure (CYOA) learning path. The Academy is accessible at /academy from the main navigation.`,
  },
  {
    role: 'student',
    title: 'How to browse and find courses',
    content: `Visit /academy to see the course catalog. You can browse all published courses in a card grid, filter by category (Nutrition, Movement, Mindset, etc.), and search by keyword using the search bar at the top. Each course card shows the cover image, title, instructor name, pricing (Free, one-time, or subscription), and category tag. Click any card to open the course detail page.`,
  },
  {
    role: 'student',
    title: 'How to enroll in a course',
    content: `On the course detail page (/academy/[courseId]), click Enroll or Subscribe. Free courses enroll you immediately with no payment. Paid one-time courses redirect to Stripe Checkout — complete payment and you are enrolled. Subscription courses bill you monthly or annually through Stripe. If your instructor gave you a promo code, enter it in the discount field on the Stripe Checkout page.`,
  },
  {
    role: 'student',
    title: 'How to watch a lesson',
    content: `After enrolling, click any lesson in the curriculum on the course detail page. Lessons open at /academy/[courseId]/lessons/[lessonId]. Video lessons have a player — watch and scrub freely. Audio lessons have an inline player. Text lessons are scrollable articles. Slides lessons show an embedded slide deck. Free preview lessons are visible without enrolling and are marked with a Preview badge. A lesson is marked complete automatically when you reach the end, or you can click Mark Complete manually.`,
  },
  {
    role: 'student',
    title: 'What is CYOA Choose Your Own Adventure mode?',
    content: `Some courses have CYOA mode enabled. After completing each lesson in a CYOA course, you see a Crossroads screen instead of a simple Next button. The Crossroads shows up to 5 paths: (1) Continue — next lesson in standard order, (2) and (3) Related paths — semantically similar lessons chosen by AI, (4) Surprise Me — a random lesson, (5) View Course Map — see the full module list and jump anywhere. CYOA lets you follow your curiosity and build a personalized learning journey.`,
  },
  {
    role: 'student',
    title: 'How to track your course progress',
    content: `Visit /academy/my-courses to see all your enrollments. Each course shows a progress bar with lessons completed out of total lessons, a percentage, and the instructor and enrollment date. Click Continue to jump back to where you left off. When a course reaches 100% it is marked Complete with a green badge.`,
  },
  {
    role: 'student',
    title: 'How to submit an assignment',
    content: `Assignments appear on the course detail page under the Assignments section once you are enrolled. Click an assignment to open it at /academy/[courseId]/assignments/[id]. Read the instructions at the top. Type your response in the text area. Attach files if needed (images, video, audio, PDF, Word, Markdown, CSV — up to 5 files). Click Save Draft to save without submitting (your instructor is not notified). Click Submit to send your work to the instructor for grading.`,
  },
  {
    role: 'student',
    title: 'Draft vs Submitted assignment status',
    content: `Draft status means your work is saved on the server but your instructor has not been notified. You can come back later and keep editing. Submitted status means your instructor can see and grade your work. After submitting you can still click Update Submission to revise your work. The status badge (Draft or Submitted) appears in the top navigation bar of the assignment page.`,
  },
  {
    role: 'student',
    title: 'Assignment grades and feedback',
    content: `When your instructor grades your submission, a grade banner appears at the top of the assignment page showing your grade (for example A, 85/100, or Excellent) and written feedback. A Feedback Thread below the assignment form lets you have a back-and-forth conversation with your instructor about your work. You can send messages and your instructor will reply in the same thread.`,
  },
  {
    role: 'student',
    title: 'What file types can I attach to assignments?',
    content: `Assignment submissions support: images (JPG, PNG, GIF, WEBP, SVG, HEIC), video (MP4, MOV, WEBM, AVI, MKV, M4V), audio (MP3, WAV, OGG, M4A, AAC, FLAC), and documents (PDF, DOC, DOCX, TXT, MD, CSV, XLS, XLSX, PPT, PPTX). You can attach up to 5 files per submission. Files are uploaded to Cloudinary.`,
  },
  {
    role: 'student',
    title: 'How to watch live sessions',
    content: `Live sessions from the CentenarianOS team are at /live. The page shows upcoming and currently live sessions. When a session is live the Join Live button activates and opens the embedded video stream. Per-course live sessions scheduled by your instructor appear on the course detail page.`,
  },
  {
    role: 'student',
    title: 'Troubleshooting enrollment and progress issues',
    content: `If you enrolled but lessons are still locked, refresh the page. If the issue persists, sign out and sign back in. If your progress bar is not updating, reload the My Courses page — progress is saved server-side. If you cannot upload a file, check the supported formats (images, video, audio, PDF, DOC, DOCX, TXT, MD, CSV, XLS, XLSX, PPT, PPTX) and ensure you have fewer than 5 files. Unsaved draft changes are lost if you close the page without clicking Save Draft.`,
  },

  // ─── TEACHER ─────────────────────────────────────────────────────────────────

  {
    role: 'teacher',
    title: 'How to become a teacher on Centenarian Academy',
    content: `To publish courses you need a Teacher account. From your dashboard go to Teaching in the sidebar. If you do not have a teacher plan, you will be prompted to subscribe. Complete Stripe Checkout for the teacher subscription. Once payment is confirmed your account is upgraded to teacher role. You can then create and publish courses.`,
  },
  {
    role: 'teacher',
    title: 'How to connect Stripe for payouts',
    content: `To receive payouts from paid course enrollments, go to Dashboard > Teaching > Payouts and click Connect with Stripe. Complete the Stripe Express onboarding including identity verification and bank details. Once onboarded your payout status shows Connected. Platform fees (default 15%) are deducted automatically at checkout and the remainder is sent to your bank. Free courses do not require Stripe Connect.`,
  },
  {
    role: 'teacher',
    title: 'How to create a course',
    content: `Go to /dashboard/teaching/courses/new. Fill in the title, description, category, cover image, price type (free, one-time, or subscription), and price amount for paid courses. Choose Navigation Mode: Linear (standard sequential order) or CYOA (Choose Your Own Adventure crossroads after each lesson). Click Create. Your course starts as a draft and is not visible to students until you publish it. Visibility options: Public (anyone), Members Only (logged-in members), or Scheduled (goes live at a specific date).`,
  },
  {
    role: 'teacher',
    title: 'How to add modules and lessons to a course',
    content: `On the course editor page (/dashboard/teaching/courses/[id]), click Add Module and enter the module title. Under each module click Add Lesson. Fill in the title, lesson type (video, text, audio, slides), content upload or embed URL, optional duration, and toggle Free Preview on if you want non-enrolled visitors to access this lesson. Drag lessons and modules to reorder them. When your curriculum is ready, toggle Published in the Settings panel to make the course live.`,
  },
  {
    role: 'teacher',
    title: 'How to upload video and audio content',
    content: `For video and audio lessons, drag your file onto the upload area or click to browse. Cloudinary handles transcoding automatically so your video will be playable on any device. For slides lessons, paste an embed code (Google Slides, Canva, or any iframe). For text lessons, type directly in the rich text editor on the lesson form.`,
  },
  {
    role: 'teacher',
    title: 'How to set up CYOA AI paths',
    content: `When your course has Navigation Mode set to CYOA, add all your lessons first. Then click Generate AI Paths on the course editor page. The system sends each lesson's content to Gemini for embedding and stores semantic similarity scores. Students then get AI-suggested related lessons at the Crossroads after each lesson. Run Generate AI Paths again whenever you add new lessons. CYOA courses work best with 10 or more lessons across diverse but related topics.`,
  },
  {
    role: 'teacher',
    title: 'How to create and manage assignments',
    content: `Click Assignments in the course editor header to go to /dashboard/teaching/courses/[id]/assignments. Click New Assignment and fill in the title, detailed instructions, and optional due date. Assignments appear on the course detail page for all enrolled students. To grade a submission, expand the assignment row and click on a submission. Read the student's response and attachments, enter a grade and feedback text, and click Save Grade. The student sees the grade immediately on their assignment page.`,
  },
  {
    role: 'teacher',
    title: 'How to create promo codes',
    content: `Go to Dashboard > Teaching > Promo Codes. Enter the code string (e.g. LAUNCH50), discount percentage (e.g. 50 for 50% off), optional maximum number of uses, and optional expiration date. Codes are created as Stripe Coupons and applied automatically at Stripe Checkout when students enter them. Share codes with your audience for launch promotions, community groups, or scholarships.`,
  },
  {
    role: 'teacher',
    title: 'How to schedule a live session',
    content: `Go to Dashboard > Teaching > Live. Click Schedule Session. Enter the title, description, scheduled date and time, and paste your embed code from Zoom, Google Meet, Mux, or any iframe-embeddable streaming service. Toggle Is Live when the session goes live so students can join. Students enrolled in the associated course see the session on the course detail page.`,
  },
  {
    role: 'teacher',
    title: 'Teacher tips for better courses',
    content: `Start with a free preview lesson to show potential students your teaching style. Use CYOA mode for exploratory topics like nutrition, mindset, and lifestyle where non-linear paths make sense. Keep video lessons under 15 minutes for higher completion rates. Write detailed assignment instructions — students produce better work when expectations are clear. Respond to feedback threads within 48 hours to improve student satisfaction and retention.`,
  },

  // ─── ADMIN ───────────────────────────────────────────────────────────────────

  {
    role: 'admin',
    title: 'How to configure Academy platform settings',
    content: `Go to /admin/academy/settings. The Platform Fee % (default 15) is the percentage of each paid enrollment kept by the platform — changing it affects all future checkouts. The Teacher Stripe Price ID is the Stripe Price ID for the teacher subscription plan. In Stripe, create a Product called Centenarian Academy Teacher with monthly or annual prices, copy the Price ID (starts with price_), paste it here, and set the same value as TEACHER_MONTHLY_PRICE_ID in your environment variables.`,
  },
  {
    role: 'admin',
    title: 'How to manage live sessions as admin',
    content: `Go to /admin/live to manage platform-wide CentenarianOS Team sessions. Click New Session, enter title, description, scheduled time, and paste the full iframe embed code from your streaming provider (Viloud.tv, Mux, Zoom, etc.). Set visibility to Public or Members Only. When your stream starts, click the Is Live toggle — this activates the Join Live button for users at /live. Toggle it off when the stream ends. Viloud.tv embed format: <iframe src="https://player.viloud.tv/embed/live/YOUR_CHANNEL_ID?autoplay=1&controls=1" width="100%" height="100%" frameborder="0" allowfullscreen allow="autoplay"></iframe>`,
  },
  {
    role: 'admin',
    title: 'How to manage user roles',
    content: `User roles: member (can enroll in courses), teacher (can create and publish courses, grade assignments, receive payouts), admin (full platform access). To manually promote a user to teacher go to /admin/users, find the user, and update their role. This bypasses the Stripe subscription requirement — use for staff or beta teachers only. To promote to admin, set profiles.role = 'admin' directly in Supabase. Normally the webhook sets role to teacher automatically when a user subscribes to the teacher plan.`,
  },
  {
    role: 'admin',
    title: 'Academy database migrations',
    content: `Run these migrations in the Supabase SQL Editor in order if not already applied: 039_lms_schema.sql (core LMS tables: courses, lessons, enrollments, lesson_progress, assignments, submission_messages, live_sessions), 040_visibility.sql (adds visibility and published_at to courses and live_sessions), 041_submission_drafts.sql (adds draft status and multi-file media_urls to assignment_submissions), 042_help_rag.sql (creates help_articles table with vector(768) for the in-app RAG help system).`,
  },
  {
    role: 'admin',
    title: 'Required environment variables for Academy',
    content: `Required environment variables for the Academy feature: TEACHER_MONTHLY_PRICE_ID (Stripe Price ID for teacher subscription), STRIPE_ACADEMY_WEBHOOK_SECRET (webhook secret for the academy Stripe webhook endpoint), GOOGLE_GEMINI_API_KEY (for CYOA embeddings and help RAG chat), NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET (for lesson content and submission file uploads). Existing variables also needed: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.`,
  },
  {
    role: 'admin',
    title: 'How to ingest help articles for the RAG system',
    content: `The in-app help chat uses a RAG (Retrieval-Augmented Generation) system. To load help content: go to /admin/academy/settings and click Ingest Help Articles. This embeds all tutorial article chunks using Gemini text-embedding-004 and stores them in the help_articles table. Run this once after initial setup and again whenever the tutorial content is updated. Requires GOOGLE_GEMINI_API_KEY to be set.`,
  },

  // ─── ALL ROLES ───────────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to use the in-app help chat',
    content: `The Help button appears as part of the floating action menu (the fuchsia button in the bottom-right corner). Click the button to expand it, then click the question mark (Help) option. A chat drawer opens where you can ask any question about using Centenarian Academy. The system searches the tutorial documentation and uses AI to give you a direct answer. The chat is context-aware — ask things like How do I submit an assignment, How do I create a CYOA course, or How do I set up Stripe payouts.`,
  },
  {
    role: 'all',
    title: 'How to submit platform feedback',
    content: `Click the floating action button (fuchsia circle in the bottom-right corner) and select the Feedback (message) option. Choose a category: Bug Report (something is broken), Feature Request (suggest an improvement), or General. Write your message and optionally attach a screenshot or video. Click Send Feedback. You can view your submitted feedback at /dashboard/feedback. The team reviews every submission and will reply in the feedback thread.`,
  },
];
