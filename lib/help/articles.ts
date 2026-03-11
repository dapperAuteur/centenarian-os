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

  // ─── BLOG ────────────────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'What is the Blog and how do I access it?',
    content: `The Blog is a public writing space inside CentenarianOS where members share their health journeys, longevity research, recipes, and insights. The public blog listing is at /blog. To write your own posts, go to Dashboard → Blog or /dashboard/blog. Posts are tied to your username — visitors can see all your posts at /blog/[username]. You must set a username in Dashboard → Profile before you can publish.`,
  },
  {
    role: 'all',
    title: 'How to create and publish a blog post',
    content: `Go to Dashboard → Blog and click New Post (or /dashboard/blog/new). Fill in: Title (up to 300 characters), Cover Image (upload from your device), Content (rich text editor with headings, bold, lists, links, images, quotes, code blocks), Excerpt (short 1-3 sentence summary up to 500 characters), Tags (keywords readers can filter by), and Visibility. Visibility options: Draft (only you), Public (everyone), Members Only (logged-in users only), Scheduled (auto-publishes at a date you set). Click Publish to make it live or Save Draft to continue later.`,
  },
  {
    role: 'all',
    title: 'How to use the blog rich text editor',
    content: `The blog editor (Tiptap) has a toolbar above the writing area. Key tools: Heading levels (H1, H2, H3) for structure. Bold (Cmd+B), Italic (Cmd+I), Underline (Cmd+U). Bullet lists and numbered lists. Block quotes for highlighting insights or citations. Code blocks for formulas or scripts. Links — select text then click the link icon and paste a URL. Inline images — use the toolbar image button to upload additional photos. Horizontal rule for section dividers. Undo/Redo with Cmd+Z and Cmd+Shift+Z. Use H2 headings to break your post into clear sections for better readability.`,
  },
  {
    role: 'all',
    title: 'Blog visibility options and scheduling',
    content: `Each blog post has a visibility setting: Draft — only visible to you, not listed anywhere. Public — visible to everyone including visitors who are not logged in, indexed by search engines. Members Only (authenticated_only) — visible only to logged-in CentenarianOS members. Scheduled — set a future date and time; the post automatically becomes public at that time. To schedule a post: set Visibility to Scheduled, pick a date and time, click Save. The post stays hidden until the scheduled moment.`,
  },
  {
    role: 'all',
    title: 'How to import markdown posts to the blog',
    content: `If you have posts written in Markdown (from tools like Ghost, Obsidian, or Notion), you can import them. Go to Dashboard → Blog → Import (or /dashboard/blog/import). Paste or upload your Markdown content. The importer converts Markdown formatting to the rich editor format automatically. Review the imported post to check formatting, then publish or save as draft. This works with standard Markdown including headers, bold, italic, links, and code blocks.`,
  },
  {
    role: 'all',
    title: 'Blog analytics — understanding your post performance',
    content: `To view analytics for a post, go to Dashboard → Blog, find the post, and open Analytics. Metrics tracked: Views (how many times the post was opened), Read depth (25%, 50%, 75%, 100% of post scrolled), Share methods (copy link, email, LinkedIn), Country (where readers are from), Referrer (what site sent them). Read depth is the most valuable signal — if readers drop off before 50%, improve your opening hook or post structure. Analytics update in real-time.`,
  },
  {
    role: 'all',
    title: 'How to like, save, and share blog posts',
    content: `On any blog post you can Like it (heart icon) to show appreciation to the author, or Save it (bookmark icon) to add it to your personal saved list. Find your saved posts at Dashboard → Blog → Saved tab. Your liked posts are at the Liked tab. To share a post use the Share Bar at the bottom: Copy Link (copies the full URL), Email (opens email client pre-filled), LinkedIn (opens LinkedIn share dialog). Your author page at /blog/[username] shows all your public posts and can be shared directly.`,
  },

  // ─── RECIPES ─────────────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'What is the Recipes module?',
    content: `Recipes is the cooking and nutrition library inside CentenarianOS. Members can create, share, and discover longevity-focused recipes with automatic nutrition tracking. Every recipe gets a NCV (Nutritional Caloric Value) score — Green, Yellow, or Red — showing how nutrient-dense the calories are. The public recipe listing is at /recipes. Manage your own recipes at Dashboard → Recipes (/dashboard/recipes).`,
  },
  {
    role: 'all',
    title: 'How to create a recipe',
    content: `Go to Dashboard → Recipes and click New Recipe (or /dashboard/recipes/new). Fill in: Title and Description (short summary). Set Servings, Prep Time, and Cook Time. Add ingredients using the ingredient builder — search by name, pick from USDA or Open Food Facts database, enter quantity and unit. Nutrition data fills in automatically. Write step-by-step instructions in the rich text editor. Add tags (e.g., high-protein, anti-inflammatory, meal-prep). Upload a cover image and optional gallery photos. Set Visibility (Draft, Public, or Scheduled) and click Publish.`,
  },
  {
    role: 'all',
    title: 'How the ingredient builder and nutrition tracking work',
    content: `The ingredient builder lets you look up foods in the USDA Food Data Central (FDC) database or Open Food Facts. Type the ingredient name, select from the dropdown results, enter quantity and unit. Nutrition values (calories, protein, carbs, fat, fiber) are automatically scaled to your quantity. You can also scan a product barcode or enter nutrition manually for items not in the database. Drag ingredients to reorder them. The Nutrition Panel shows totals and per-serving breakdown for the whole recipe, updating live as you add ingredients.`,
  },
  {
    role: 'all',
    title: 'What is the NCV score on recipes?',
    content: `NCV stands for Nutritional Caloric Value. It measures how nutrient-dense a recipe is relative to its calories. Formula: NCV = (protein grams + fiber grams) ÷ total calories. Green NCV means high nutrient density — lots of protein and fiber for the calories (e.g., salmon with vegetables). Yellow means balanced macros. Red means calorie-dense with lower protein and fiber (e.g., pastries or heavy sauces). NCV helps you see at a glance whether a meal is optimized for longevity nutrition. It is one signal — context matters (a pre-workout meal may be high-carb by design).`,
  },
  {
    role: 'all',
    title: 'How to import a recipe from a website',
    content: `Go to Dashboard → Recipes → Import Recipe (or /dashboard/recipes/import). Paste the full URL of any recipe page from a major cooking website. Click Import. CentenarianOS reads the recipe's structured data (schema.org/Recipe format) and fills in title, description, ingredients, prep time, cook time, servings, and instructions automatically. Review and adjust the imported recipe — look up USDA nutrition data for each ingredient — then publish or save as draft. Works with most major recipe sites including AllRecipes, Food Network, and NYT Cooking.`,
  },
  {
    role: 'all',
    title: 'How to clone a recipe from another user',
    content: `On any public recipe detail page, click the Clone button. This copies the full recipe (title, ingredients, instructions, and media) to your own account as a draft. You own the copy and can edit it freely without affecting the original. Cloning is useful for adapting a community recipe to your dietary needs, using a recipe as a template, or keeping a personal copy of a favorite. Credit the original author in your description as a courtesy.`,
  },
  {
    role: 'all',
    title: 'How to like, save, and share recipes',
    content: `On any recipe you can Like it (heart icon) to show appreciation, or Save it (bookmark icon) to add to your personal collection. Find saved recipes at Dashboard → Recipes → Saved tab. Liked recipes are at the Liked tab. Share recipes using the Share Bar: Copy Link, Email, or LinkedIn. You can also add any recipe directly to your Fuel / meal tracker by clicking Add to Fuel on the recipe detail page — nutrition totals carry over automatically.`,
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

  // ─── SMART SCAN ─────────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to use Smart Scan for receipts and documents',
    content: `Go to Dashboard → Scan. Take a photo or upload an image of a receipt, fuel receipt, maintenance invoice, recipe, or medical document. The AI automatically detects the document type, extracts key data (line items, totals, dates, vendors), and lets you save the results to the appropriate module. For receipts, individual line items are tracked with price history per vendor — you can see how prices change over time. Scanned documents can be linked to contacts and financial transactions.`,
  },

  // ─── DATA HUB ───────────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to import and export data with the Data Hub',
    content: `Go to Dashboard → Data Hub. You will see cards for all modules: Finance, Health Metrics, Trips, Fuel, Maintenance, Vehicles, Equipment, Contacts, Tasks, and Workouts. Each card has Import, Export, and Template buttons. Click Template to download a CSV template with example rows. Fill in your data and use Import to upload it. You can also paste directly from Google Sheets. Exports support date range filtering. All imports use the service role client and bypass RLS for efficient bulk operations.`,
  },

  // ─── LIFE CATEGORIES ───────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to tag activities with Life Categories',
    content: `Life Categories let you tag any activity across all modules with life-area labels like Health, Finance, Career, Relationships, etc. Go to Dashboard → Categories to manage your categories, view analytics (spending by category, activity distribution), and find uncategorized items for batch tagging. You can also tag items directly from the Activity Linker modal when editing tasks, workouts, transactions, or any other entity. Each category has a custom icon and color. Default categories are auto-created on first use.`,
  },

  // ─── EQUIPMENT TRACKER ─────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to track equipment and asset valuations',
    content: `Go to Dashboard → Equipment. You can add gear, electronics, fitness equipment, and other assets with purchase price, brand, model, condition, and category. Track current valuations over time — add a new valuation entry whenever the value changes, and the detail page shows a chart of value history. Equipment can be linked to financial transactions (the purchase transaction) and to other modules via Activity Links. Categories are auto-seeded with defaults (Electronics, Fitness, Travel, etc.) and you can add your own.`,
  },

  // ─── COURSE PREREQUISITES ──────────────────────────────────────────────────

  {
    role: 'student',
    title: 'What are course prerequisites and how do override requests work',
    content: `Some courses have prerequisites — required or recommended courses you should complete first. When you try to enroll in a course with prerequisites, you will see which ones are met and which are not. If you have not completed a required prerequisite, you can submit an Override Request to the teacher. Fill out the teacher's questionnaire explaining your background, and the teacher will approve or deny your request. Recommended prerequisites are informational and do not block enrollment.`,
  },
  {
    role: 'teacher',
    title: 'How to set up course prerequisites and handle override requests',
    content: `When editing a course, go to the Prerequisites section. You can add required or recommended prerequisites from other published courses. Optionally, add override questions — a questionnaire students must fill out if they request to skip a prerequisite. Override requests appear in your Teaching Dashboard under the Overrides tab. Review the student's answers and approve or deny the request. Approved students can enroll immediately.`,
  },

  // ─── CROSS-COURSE CYOA ─────────────────────────────────────────────────────

  {
    role: 'teacher',
    title: 'How to enable cross-course CYOA navigation',
    content: `When editing a course, toggle the Allow Cross-Course CYOA option. When enabled, students in CYOA mode will see lesson suggestions from other courses (in addition to your own) at Crossroads screens. This uses semantic similarity matching across all published lessons with embeddings. It is a great way to connect related content across the Academy catalog and help students discover new courses organically.`,
  },

  // ─── CORRELATIONS ──────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to use correlations and analytics',
    content: `Go to Dashboard → Correlations. This module analyzes relationships between your health metrics, financial data, sleep, activity, and other tracked data using Pearson correlation analysis. Select two metrics to compare and see how strongly they are related. For example, you might discover that sleep hours correlate with lower spending, or that workout frequency correlates with higher recovery scores. The analytics view shows multi-metric trend lines over time.`,
  },

  // ─── VIDEO EMBEDDING ──────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to embed videos in blog posts',
    content: `The blog editor supports embedding videos directly into your posts. In the Tiptap rich text editor, click the media embed button (or use the toolbar). Paste a video URL from YouTube, Viloud.tv, Mux, or a direct Cloudinary video link. The editor inserts a VideoEmbed node that renders as an embedded player. YouTube URLs are automatically converted to embed format. You can also upload a video file directly via the Cloudinary uploader in the media embed modal. Videos appear inline in your post and are playable by readers on any device.`,
  },
  {
    role: 'all',
    title: 'How to embed videos in recipes',
    content: `Recipes support video embedding using the same VideoEmbed system as blog posts. In the recipe editor, use the media embed button to paste a YouTube, Viloud.tv, Mux, or Cloudinary video URL. The video appears at the top of your recipe content. This is great for cooking demonstrations, technique walkthroughs, or plating guides. Videos are responsive and work on mobile.`,
  },
  {
    role: 'all',
    title: 'Supported video providers for embedding',
    content: `CentenarianOS supports embedding videos from these providers: YouTube (paste any youtube.com or youtu.be link — automatically converted to embed format), Viloud.tv (paste the Viloud stream URL), Mux (paste the Mux playback URL), and Cloudinary (upload directly or paste a Cloudinary video URL — rendered with native HTML5 video player). For other providers, use the social embed tab in the media modal to paste raw HTML embed code (iframes).`,
  },

  // ─── EXERCISE & WORKOUT VIDEO ─────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to add videos to exercises',
    content: `Each exercise in your library has a video_url field. When creating or editing an exercise, paste a YouTube, Viloud, Mux, or direct video URL into the Video URL field. The video appears on the exercise detail page as an embedded player. You can also upload images via the Media field (Cloudinary) and audio cues via the Audio field. Exercises also support written instructions and form cues for text-based guidance. When you add an exercise to a workout template, the video is accessible from the workout view.`,
  },
  {
    role: 'all',
    title: 'How to share and like exercises and workouts',
    content: `Exercises and workouts can be set to public visibility. When public, other users can view, like, copy to their own library, and mark them as done. Like counts, copy counts, and done counts are tracked. You can share exercises and workouts via a shareable link — the share URL uses a public alias (no personal info exposed). Browse public exercises and workouts in the Discover pages at Dashboard → Exercises → Discover and Dashboard → Workouts → Discover. Your liked items are at Dashboard → Profile → Likes.`,
  },

  // ─── MODULE WALKTHROUGH ONBOARDING ────────────────────────────────────────

  {
    role: 'all',
    title: 'What are interactive feature walkthroughs?',
    content: `Every major module in CentenarianOS has an interactive walkthrough — a step-by-step guided tour that highlights key UI elements and explains how to use the feature. Walkthroughs are offered when you first visit a module. Each step shows a tooltip card with a title, description, and progress bar. You can advance with Next, skip individual steps with Skip, or exit anytime. Your progress is saved so you can resume where you left off. Walkthroughs cover the Planner, Finance, Travel, Health Metrics, Workouts, Equipment, Academy, and more.`,
  },
  {
    role: 'all',
    title: 'How to re-take a module tour',
    content: `You can re-take any module walkthrough at any time. Go to Settings (Dashboard → Settings or the gear icon) and scroll to the Module Tours section. You will see a list of all available tours with their status (completed, in progress, or not started). Click the Restart button next to any tour to reset it and start from step 1. You can also access tours from the "Re-take Tours" option in your user menu.`,
  },
  {
    role: 'all',
    title: 'How to explore features before signing up',
    content: `CentenarianOS has a public features page where you can explore each module before creating an account. Visit /features to see all CentenarianOS modules — Planner, Finance, Travel, Health Metrics, Workouts, Academy, and more. The features page shows detailed descriptions, screenshots, and highlights of what each module offers. These pages are accessible without signing up.`,
  },

  // ─── BLOG IMPORT ──────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to bulk import blog posts via CSV',
    content: `Admins can bulk import blog posts using CSV. Go to the admin blog management page and use the import function. The CSV format includes columns: title, slug, excerpt, visibility (draft/public/members/scheduled), tags (pipe-separated), video_url (optional YouTube/Viloud/Mux URL), and content (markdown body). If a video_url is provided, a VideoEmbed node is automatically inserted at the top of the post content. Download the template at /templates/blog-import-template.csv for the exact format. Each row creates one blog post.`,
  },

  // ─── OFFLINE SUPPORT ──────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How does offline mode work?',
    content: `CentenarianOS pages work offline. When you load any page while connected, data is automatically cached in your browser's IndexedDB. If you lose connectivity, cached data is displayed so you can still browse your dashboard content. Changes you make while offline (creating, editing, deleting) are queued and automatically replayed when your connection returns. Text-based pages like tutorials and academy lessons are also available offline once loaded. The offline system uses the offlineFetch wrapper around standard fetch calls.`,
  },

  // ─── WORKOUTS & NOMAD OS ──────────────────────────────────────────────────

  {
    role: 'all',
    title: 'What is Nomad Longevity OS?',
    content: `Nomad Longevity OS is a built-in fitness protocol inside CentenarianOS designed for people who travel frequently and need flexible workout routines. It includes 28 pre-loaded exercises and 12 workout templates organized into four programs: AM (morning mobility), PM (evening recovery), Hotel (bodyweight-only for hotel rooms), and Gym (full equipment). The Friction Protocol helps you choose the right workout based on your available time, equipment, and energy. Access it at Dashboard → Workouts → Nomad OS. All exercises include detailed instructions and form cues.`,
  },
  {
    role: 'all',
    title: 'How to use the exercise library',
    content: `The exercise library at Dashboard → Exercises stores all your exercises with detailed metadata: name, category (Push, Pull, Legs, Core, Cardio, etc.), instructions, form cues, video URL, images, audio cues, primary muscles, difficulty level, and equipment requirements. You start with 110+ system-seeded exercises and can add your own. Each exercise tracks usage count across your workouts. The library supports filtering by category, muscle group, difficulty, and equipment type. You can duplicate exercises to create variations and link equipment from your Equipment Tracker.`,
  },
  {
    role: 'all',
    title: 'How to use enhanced workout fields',
    content: `Workout templates and logs support 16+ enhanced tracking fields per exercise: RPE (rate of perceived exertion 1-10), tempo (e.g., 3-1-2-0 for eccentric-pause-concentric-pause), superset grouping, circuit flag, negatives, isometrics, to-failure, unilateral (single-limb), balance work, percent of max, distance, hold time, and side (left/right/both). These fields appear in a collapsible Advanced section on each exercise row. Workout logs also track overall feeling (1-5), purpose, warmup notes, and cooldown notes.`,
  },

  // ─── SAVED CONTACTS ───────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to use saved contacts',
    content: `Saved contacts let you store frequently-used vendors, customers, and locations across all modules. Go to Dashboard → Contacts or use the contact autocomplete on any form that supports it (finance transactions, travel trips, planner tasks). Contacts have a type (vendor, customer, or location), optional default budget category, and notes. When you select a saved vendor on a transaction, its default category auto-fills. Contacts also support sub-locations — for example, a venue contact can have multiple addresses (main entrance, loading dock, parking lot). Import contacts in bulk via the Data Hub.`,
  },

  // ─── COACHING GEMS ────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to create and use Coaching Gems',
    content: `Coaching Gems are custom AI personas you create for specific coaching needs. Go to Dashboard → Gems and click New Gem. Give it a name, system prompt (personality and instructions), and select which data sources it can access (health metrics, finance, workouts, recipes, planner, etc.). Then start a coaching session — the AI has access to your selected real data and can give personalized advice. Gems can also execute actions: create recipes, log workouts, create transactions, or generate flashcards from conversations. Upload files (CSV, images, PDFs) for the AI to analyze during sessions.`,
  },

  // ─── FOCUS ENGINE ─────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to use the Focus Engine',
    content: `The Focus Engine at Dashboard → Engine is a productivity timer with session tracking. Start a focus session with a task, duration, and optional template. Choose free-form timing or Pomodoro mode (25 min work / 5 min break cycles). After each session, complete a debrief rating your focus, energy, and mood. Log pain or body check data if relevant. View session history and analytics to identify your most productive times and patterns. Sessions can be linked to planner tasks and life categories. Templates let you save reusable session configurations.`,
  },

  // ─── SMART SCAN DETAILS ───────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How does receipt line item tracking work?',
    content: `When you scan a receipt with Smart Scan, the AI extracts individual line items with prices. These are stored in the item_prices table, creating a price history per item per vendor over time. On subsequent scans from the same vendor, you can see how prices have changed. The receipt overview shows total, tax, and vendor. Each line item can be linked to a financial transaction. This is useful for tracking grocery price inflation, comparing vendor pricing, and maintaining expense records for tax purposes.`,
  },

  // ─── HEALTH METRICS WEARABLES ─────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to connect wearables and sync health data',
    content: `CentenarianOS integrates with three wearable platforms via OAuth: Oura (ring), WHOOP (strap), and Garmin (watch). Go to Dashboard → Settings → Wearable Connections and click Connect next to your device. Complete the OAuth flow to authorize data sharing. Once connected, your daily metrics (resting heart rate, HRV, sleep duration, sleep score, steps, activity calories, respiratory rate) sync automatically each day. You can also import health data via CSV from Apple Health, Google Health, InBody, and Hume Health using the Data Hub import.`,
  },

  // ─── LIFE RETROSPECTIVE ───────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to use Life Retrospective with Google Calendar import',
    content: `Life Retrospective lets you import your Google Calendar history and have AI analyze patterns in how you spend your time. Go to Dashboard → Planner → Retrospective. Export your Google Calendar as an .ics file and upload it. The system parses all events using a pure TypeScript ICS parser (no external dependencies). The AI then identifies patterns like meeting frequency, time allocation across categories, and schedule evolution over time. This gives you a bird's-eye view of how your life priorities have shifted.`,
  },

  // ─── FINANCIAL ACCOUNTS ───────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to manage financial accounts and bank linking',
    content: `Go to Dashboard → Finance → Accounts to add and manage your financial accounts: checking, savings, credit card, loan, and cash accounts. Each account tracks institution name, last four digits, interest rate, credit limit, opening balance, monthly fees, and due/statement dates. Balance is calculated as opening balance plus income minus expenses. You can link bank accounts via the Teller API for automatic transaction syncing — click Connect Bank Account, complete the OAuth flow, and transactions import automatically. Deactivated accounts preserve transaction history but hide from active views.`,
  },

  // ─── PLANNER DETAILS ──────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to use the goal hierarchy and roadmap',
    content: `The Planner uses a four-level hierarchy: Roadmaps → Goals → Milestones → Tasks. Start by creating a Roadmap (your big-picture vision, e.g., "Health Optimization 2026"). Add Goals under it (e.g., "Run a half marathon"). Break goals into Milestones (e.g., "Complete Couch to 5K"). Then create Tasks under milestones (e.g., "Run 2 miles today"). Tasks appear in your daily/weekly planner views. Each level shows completion progress based on child items. You can archive and restore items. The AI Weekly Review analyzes your task completion patterns.`,
  },

  // ─── TELLER BANK SYNC ─────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How does Teller bank account syncing work?',
    content: `Teller is a bank account linking API that lets you automatically import transactions. Go to Dashboard → Finance → Accounts and click Connect Bank Account. Select your bank from the Teller enrollment flow and authorize access. Once connected, your transactions sync daily. Each synced transaction includes date, amount, description, and merchant. You can categorize synced transactions and link them to contacts. If you disconnect, historical synced transactions remain in your account. Teller supports most major US banks and credit unions.`,
  },
];
