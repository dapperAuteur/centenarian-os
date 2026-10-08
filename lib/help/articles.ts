// lib/help/articles.ts
// Chunked tutorial content for the Academy RAG help system.
// Role: 'student' | 'teacher' | 'admin' | 'all'
// Each chunk is embedded and stored in help_articles via /api/admin/help/ingest.

export interface HelpArticle {
  title: string;
  content: string;
  role: 'student' | 'teacher' | 'admin' | 'all';
  app?: 'centenarian' | 'contractor';
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
    content: `To receive payouts from paid course enrollments, go to Dashboard > Teaching > Payouts and click Connect with Stripe. Complete the Stripe Express onboarding including identity verification and bank details. Once onboarded your payout status shows Connected. Platform fees (10%) are deducted automatically at checkout and the remainder is sent to your bank. Free courses do not require Stripe Connect.`,
  },
  {
    role: 'teacher',
    title: 'How to create a course',
    content: `Go to /dashboard/teaching/courses/new. Fill in the title, description, category, cover image, price type (free, one-time, or subscription), and price amount for paid courses. Choose Navigation Mode: Linear (standard sequential order) or CYOA (Choose Your Own Adventure crossroads after each lesson). Click Create. Your course starts as a draft and is not visible to students until you publish it. Visibility options: Public (anyone), Members Only (logged-in members), or Scheduled (goes live at a specific date).`,
  },
  {
    role: 'teacher',
    title: 'How to add modules and lessons to a course',
    content: `The course editor is organized into tabs: Info, Pricing, Structure, Curriculum, Extras, Prerequisites, and Review. To add content, go to the Curriculum tab. Click Add Module and enter the module title. Under each module click Add Lesson. Fill in the title, lesson type (video, text, audio, slides, quiz), content URL, optional duration, and toggle Free Preview on if you want non-enrolled visitors to access this lesson. For video lessons, paste a YouTube URL (upload to YouTube first as Unlisted) — the app auto-detects YouTube and renders a branded player with custom controls, chapters, and transcript sync. When your curriculum is ready, go to the Review tab to check content health and publish.`,
  },
  {
    role: 'teacher',
    title: 'How to add video and audio content',
    content: `For video lessons, the recommended approach is YouTube: upload your video to YouTube as Unlisted, restrict embedding to your domain (YouTube Studio > Distribution > Embedding), then paste the YouTube URL into the lesson content URL field. The app renders a fully branded custom player (no YouTube controls visible) with chapter markers, transcript sync, playback speed, and progress tracking. For auto-generated transcripts, click "Pull Captions" after saving — this pulls YouTube's auto-captions into the transcript field. You can also upload directly to Cloudinary for non-YouTube video or audio files. For slides lessons, paste an embed code (Google Slides, Canva, or any iframe). For text lessons, type directly in the rich text editor.`,
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
    content: `Go to Dashboard → Scan. Take a photo or upload an image of a receipt, fuel receipt, maintenance invoice, recipe, or medical document. The AI automatically detects the document type, extracts key data (line items, totals, dates, vendors), and lets you save the results to the appropriate module. For receipts, individual line items are tracked with price history per vendor — you can see how prices change over time. Scanned documents can be linked to contacts and financial transactions. When you save a receipt as a transaction and the vendor has a learned category (you answered "Always" to the categorize prompt for that vendor), the transaction gets that category. Otherwise the AI's suggested category becomes the transaction's budget category if it matches the name of one of your categories (capitalization doesn't matter); if it matches none, it is saved as a tag.`,
  },

  // ─── DATA HUB ───────────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to import and export data with the Data Hub',
    content: `Go to Dashboard → Data Hub. You will see cards for all modules: Finance, Health Metrics, Trips, Fuel, Maintenance, Vehicles, Equipment, Contacts, Tasks, and Workouts. Each card has Import, Export, and Template buttons. Click Template to download a CSV template with example rows. Fill in your data and use Import to upload it, or switch to the Google Sheets tab and paste the link of a sheet that is published to the web. Finance is the exception: its Import button opens the bank statement import, which reads the CSV your bank gives you into the account you choose (see "How to import a bank statement (CSV)"); the Finance template imports there too. Exports support date range filtering.`,
  },

  // ─── LIFE CATEGORIES ───────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to tag activities with Life Categories',
    content: `Life Categories (life areas) let you tag any activity across all modules with labels like Health, Finance, Career, Relationships, etc. They are the top level of one category tree: your budget categories sit under them, so a transaction gets its life area from its budget category without a second step (see "One set of categories: life areas and budget categories"). Go to Dashboard → Categories to view analytics (spending by life area, activity distribution) and find uncategorized items for batch tagging, and to Organize categories to place budget categories under life areas. You can also tag items directly from the Activity Linker modal when editing tasks, workouts, transactions, or any other entity. Each category has a custom icon and color. Default life areas are auto-created on first use.`,
  },

  // ─── EQUIPMENT TRACKER ─────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to track equipment and asset valuations',
    content: `Go to Dashboard → Equipment. You can add gear, electronics, fitness equipment, and other assets with purchase price, brand, model, condition, and category. Track current valuations over time — add a new valuation entry whenever the value changes, and the detail page shows a chart of value history. Equipment can be linked to financial transactions (the purchase transaction) and to other modules via Activity Links. Categories are auto-seeded with defaults (Electronics, Fitness, Travel, etc.) and you can add your own.`,
  },
  {
    role: 'all',
    title: 'Equipment depreciation',
    content: `Every equipment item and vehicle (bikes and shoes too) can show how much value it loses over time. Open an item from Dashboard → Equipment, or a vehicle's "value" link on Dashboard → Travel, and fill in the Depreciation section: the method, the expected life in years and/or in uses (miles for a vehicle), a salvage value (what it will still be worth at the end), and the in-service date. For equipment, the cost and in-service date default to the purchase price and purchase date; vehicles have no price, so enter the cost. Methods: Straight line (the default) spreads cost minus salvage evenly over the years. Declining balance takes a fixed share of the remaining value each year (factor 2 = double declining balance) and switches to straight line when that is larger, so it reaches the salvage value at the end of its life. Units of use charges a fixed amount per use or per mile: (cost minus salvage) divided by the expected uses. The value never drops below the salvage value, and nothing depreciates before the in-service date. The section shows book value today, depreciation so far, this year to date, when it is fully depreciated (or the cost per use or mile), a book value chart and a schedule table by calendar year. The equipment list shows each item's book value, and a summary shows total book value, this year's depreciation to date and the work share. These are estimates to help you plan, not tax advice: tax depreciation follows different rules, so check with a tax professional before using them on a return. Needs migration 214; until it is applied the section says "Run migration 214 first".`,
  },
  {
    role: 'all',
    title: 'Work equipment: uses, work share and cost per use',
    content: `Tick "Used for work" in an item's Work use section, then record what you use it for. In a planner task (including events synced from Google Calendar, which become planner tasks), open the task and use "Used equipment": choose the item, tick "for work" if it was work, and click Add. Each linked task, workout, trip or focus session counts as one use; the Work or Personal button on a linked item switches it. Uses that happened outside the app can be typed in, with how many were for work. The section shows all uses, work uses, your work share this year (work uses divided by all uses; set a work share override in percent if you track it another way), the cost per use (depreciation so far divided by uses, or the units-of-use rate), and the work-share depreciation for the year so far, which you can keep with your business expense records. Vehicles count miles from their trips instead: trips with purpose "work" or tax category "business" are work miles. Estimates, not tax advice.`,
  },
  {
    role: 'all',
    title: 'Save for replacing equipment',
    content: `On an item's Depreciation section (or a vehicle's value page), enter a replacement cost and a "replace by" date, then click Save for replacement. It opens a new savings goal prefilled with "Replace (item name)", the replacement cost as the target and the date as the target date, linked to the item. Pick the account the money sits in and save. See "Savings goals: envelopes inside a real account" for how goals work.`,
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
    content: `Pages you've opened while online are cached in your browser, so you can still view them if you lose your connection. That includes tutorials and academy lessons. Many saves are queued while you're offline and sent automatically when you reconnect: finance (transactions, transfers, accounts, invoices, recurring payments), travel (trips, fuel, maintenance), workouts, equipment, health metrics, creating a planner task (Add Task), recurring tasks and schedules, the actions offered after you complete a task (except Log Focus Time), and pain log entries (adding, editing and deleting). Add Task, Add Transaction, recurring tasks, the task-completion actions, and saving a scanned receipt or recipe tell you when a save was only queued; the item appears once it syncs. A task queued without a goal goes to your Inbox when it syncs, and if the goal you picked was deleted in the meantime it goes to the Inbox instead of being lost. Some things still need a connection for now: reviewing, linking, and unlinking transfers between your accounts; editing or completing a planner task; roadmaps, goals, and milestones; Focus Engine sessions and debriefs; Fuel meal logs, meal prep, ingredients, and inventory; the recipe editor; and scanning a document.`,
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
    content: `Saved contacts let you store frequently-used vendors, customers, and locations across all modules. Add one at /dashboard/contacts/new (name, an optional address saved as its main location, and notes), or use the contact autocomplete on any form that supports it (finance transactions, travel trips, planner tasks). Contacts have a type (vendor, customer, or location), optional default budget category, and notes. When you select a saved vendor on a transaction, its default category auto-fills. The default category is also what "Always" sets when you answer the categorize prompt after categorizing a transaction, and it is applied automatically to that vendor's new transactions from receipt scans and CSV imports. Contacts also support sub-locations — for example, a venue contact can have multiple addresses (main entrance, loading dock, parking lot). Import contacts in bulk via the Data Hub. If you use RideWitUS, it reads your vendors from CentenarianOS when you log fuel or a service (it never creates or changes them), and shows recent prices you scanned at that vendor; its "Add it in CentenarianOS" link opens the add-contact page with the vendor's name filled in. RideWitUS can only see your vendors after you have signed in to CentenarianOS once with "Sign in with WitUS".`,
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

  // ─── PAIN LOG ─────────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to log pain (as often as you notice it)',
    content: `Open Dashboard → Engine → Pain Tracking (/dashboard/engine/pain). Every time you press Add entry, a new pain entry is saved, so you can log pain several times a day: in the morning, after a workout, at night. Each entry has a time (it starts at the current time; change it to log something from earlier, or press Now to go back to the current time), an intensity from 1 (no discomfort) to 10 (acute, debilitating pain), the affected locations, the sensation, aggravating activities (one per line) and notes. Locations include hip flexors, glutes, SI joint, lower and mid back, neck, shoulders, left hamstring, right knee, and Left Hand, Right Hand, Left Foot and Right Foot; pick both sides when both hurt. Sensations are Tightness, Pinching, Dull Ache, Sharp Stab, Burning and Numbness. Today's entries are listed below the form, newest first, with the day's highest intensity; use the pencil to edit one in place or the bin to delete it. Saving works offline: the entry shows "Waiting to sync" and is sent when you reconnect. Photos, voice notes, links and life categories on the form belong to the whole day, not to one entry.`,
  },
  {
    role: 'all',
    title: 'How to review past pain entries',
    content: `Open Dashboard → Engine → History → Pain Tracking, or press Pain history on the pain form (/dashboard/engine/history/pain). Every entry is listed newest first and grouped by day; each day shows its highest intensity and how many entries it has. Filter by a date range (From and To), an intensity range (Intensity from ... to), a location, or words in the notes. The location filter has each location on its own and an "either side" choice for paired body parts, such as Hand (left or right) or Foot (left or right). The list loads 50 entries at a time and keeps loading as you scroll, or press Load more, so there is no limit on how far back you can go. Edit or delete any entry in place; the day's summary updates straight away. The chart at the top shows each day's highest intensity for the chosen dates. Open "Links & categories" on a day to link it to other activities or tag it with life categories.`,
  },
  {
    role: 'all',
    title: 'How the daily pain summary works',
    content: `Correlations, the AI weekly review, Coaching Gems and the Engine history card read one pain summary per day. After you add, edit or delete an entry, that day's summary is recalculated: the intensity is the day's highest entry; locations, sensations and activities are everything logged that day, each listed once in the order first logged; notes are every entry's notes, oldest first, separated by a blank line. Deleting the last entry of a day clears its pain summary but keeps the day's debrief. Pain logged before several entries a day were possible was copied in once as one entry per day, marked "From the daily log"; those entries show "Time not recorded" because only the date was saved. If the database update (migration 222) has not been applied yet, the form says "Run migration 222 first" and keeps the old behavior of one pain log per day, where saving again replaces that day's entry.`,
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
    title: 'How to bring in wearable and health data',
    content: `Go to Dashboard → Health Metrics → Import (or Dashboard → Settings → Wearables, which links to the same import). Choose the source (Garmin, Apple Health, Oura, WHOOP, Google Health, InBody, Hume Health, a generic CSV, or Manual Entry), upload or paste the CSV, then click Check rows. Nothing is saved yet: you see how many days are new, how many are already imported, how many will gain values in fields that are blank today, and how many have different values (those keep what you already have). Import turns on after the check. Tick "Replace existing values" only when the file should win; a blank cell never erases anything. Each source keeps its own row per day, so Garmin, Apple Health and your own entries are never added together, and a date listed twice in one file is merged into one day. Direct Garmin sync is coming soon and shows as Coming Soon in Settings; Oura and WHOOP connections are not offered yet, so use their CSV exports. Garmin activities (rides, runs, walks, hikes) are imported as trips from Travel → Import (see "What happens if I import the same fitness data twice?").`,
  },

  {
    role: 'all',
    title: 'What happens if I import the same fitness data twice?',
    content: `Nothing is added twice, and every fitness import shows what it will do before it saves. Daily health metrics (Health Metrics → Import, or Data Hub → Health Metrics): one row per day per source; a day you already have is skipped when nothing changed, gains values only in its blank fields, and keeps your stored values when the file differs, unless you tick "Replace existing values". Garmin activities (Travel → Import → Garmin Activities CSV): click Check file first. An activity is recognised by its start time, so one you already imported is skipped even if you renamed it in Garmin Connect or changed the trip's date since; an activity listed twice in the file counts once; and one that looks like a trip you logged yourself (same type, distance within 5% or at least 0.1 mile, or time within 5 minutes, with a round trip counted both ways and a multi-stop trip's legs added up; a trip logged that day with no distance or time; or a close one dated a day before or after, which a template logged late in the evening can carry) is listed as a possible match and skipped unless you tick "Import possible matches too". Workouts (Data Hub → Workouts): a workout already logged under the same name on the same day is skipped; tick "Import anyway" for a real second session, like a morning and an evening walk. InBody scans: a scan is recognised by its measurement time, so re-importing the same export adds only the new scans, and a blank cell never erases a stored value. Duplicates made before these checks existed are not deleted automatically; they can be listed with a read-only report and cleaned up after review.`,
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
    title: 'How to manage financial accounts',
    content: `Go to Dashboard → Finance → Accounts to add and manage your financial accounts: checking, savings, credit card, loan, and cash accounts. Each account tracks institution name, last four digits, interest rate, credit limit, opening balance, monthly fees, and due/statement dates. Balance is calculated as the starting (opening) balance plus income minus expenses; when the starting balance has an "as of" date, only transactions after that day count (see "Setting an account's starting balance"). On a credit card or loan the balance is what you owe, so an expense raises it and an income entry (a payment) lowers it. To check an account against its bank or card statement each month, see "How do I reconcile an account each month?". Fill in the institution and last four digits: two accounts can have the same name, and the app uses those to tell them apart in pickers and to recognize transfers between your accounts (see "How are transfers, card payments, and loan payments tracked?"). An optional Nickname (for example visa) is a short name used in calendar events as @nickname to pick the account ("Dinner #expense $40 @visa"); it starts with a letter, has up to 20 letters, digits, - or _, no two active accounts can share one, and pickers show it next to the last four digits (see "Recording calendar expenses into several accounts"). CentenarianOS does not connect to your bank, so bank transactions never arrive on their own: enter them by hand, or download a statement CSV from your bank and import it: each account on the Accounts page has an Import statement link that opens the import with that account chosen (see "How to import a bank statement (CSV)"). Deactivated accounts preserve transaction history but hide from active views.`,
  },

  // ─── PLANNER DETAILS ──────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to use the goal hierarchy and roadmap',
    content: `The Planner uses a four-level hierarchy: Roadmaps → Goals → Milestones → Tasks. Start by creating a Roadmap (your big-picture vision, e.g., "Health Optimization 2026"). Add Goals under it (e.g., "Run a half marathon"). Break goals into Milestones (e.g., "Complete Couch to 5K"). Then create Tasks under milestones (e.g., "Run 2 miles today"). You don't have to build the hierarchy first: a task saved without a goal goes to your Inbox, a roadmap the app creates for you. Tasks appear in your daily/weekly planner views. Each level shows completion progress based on child items. You can archive and restore items. Roadmaps the app creates on its own (Inbox, and Work.WitUS Sync for invoice and payment tasks) show an "Auto" badge on the Roadmap page and can't be permanently deleted. The AI Weekly Review analyzes your task completion patterns.`,
  },
  {
    role: 'all',
    title: 'How to add a task quickly (the Inbox)',
    content: `Go to Dashboard → Planner and click Add Task. The cursor starts in the Activity field: type what needs doing and press Enter (or click Create Task). That's all a task needs. Date is the day you're viewing in the planner, time is the next quarter-hour, and the task goes to your Inbox unless you choose otherwise. To file it under a goal, tap the "Goal: Inbox" chip, search by roadmap, goal, or milestone name, and pick one. Description, tag, and priority are under More. The form remembers the goal, tag, and priority you used last. The first time you save a task to the Inbox, the app creates an Inbox roadmap, goal, and milestone for you; it shows an "Auto" badge on the Roadmap page. To see what's waiting to be sorted, use the Inbox (N) filter on the planner, and move a task to a goal by editing it and choosing a new milestone. Add Task also works offline: the task is queued, the planner tells you so, and it appears once you reconnect.`,
  },

  // ─── BANK TRANSACTIONS ────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to import a PDF statement',
    content: `You can import a card or bank statement PDF the same way as a CSV. Go to Dashboard → Finance and click Import bank statement (or Import statement on an account, or choose the file in the Statements box on Settings), then choose the PDF in step 1. Privacy: the PDF is read inside CentenarianOS itself. It is never sent to any other company or service, and no AI reads it. Only the transactions you import and the statement's summary numbers are saved. What works: text PDFs, the kind you download from your bank's website, up to 10 MB. A scanned or photographed statement has no text to read, and the import says "This PDF has no readable text; scanned statements aren't supported". A password-protected PDF is refused: save a copy without the password first. Recognized statements: Best Buy credit card statements from Citibank are read section by section (the account summary, every purchase, payment, credit, fee and interest charge, the interest rate table, and promotional balances). Transaction lists printed to PDF from a card website are recognized too: Capital One cards (such as the REI Co-op Mastercard) and Discover cards printed from the Capital One website, and PayPal Credit activity. Those are lists, not monthly statements, so there are no balances to check: the review says so and nothing needs confirming; pending transactions and canceled payments on them are left out with a note. Excel workbooks can't be read; use the PDF statement instead (a card site's ".xls" download that is really plain text, like Best Buy's, imports like a CSV). Any other statement is read by looking for lines that have a date, a description and an amount; it is marked as an unrecognized layout, so check every row and its direction before importing. The statement prints the account's last four digits, and when exactly one of your accounts ends in those digits it is chosen for you; otherwise choose it, and the review step warns you if the account you chose ends in different digits. A PDF has no columns to map, so it goes straight from step 1 to review. Rows follow card conventions and use card words in the review: charges (purchases and cash advances), interest and fees add to what you owe; payments and refunds or credits lower it. A payment is linked as a transfer to the account it was paid from (see "How are card statements and card payments imported?"). The review step shows the statement summary (previous balance, payments, other credits, purchases, cash advances, fees, interest, new balance, minimum payment and due date), whether it adds up, the interest rates (APR) for each kind of balance, and each promotional balance with the date it expires and the deferred interest that would be charged if it isn't paid off by then. The check is: previous balance − payments − credits + purchases + cash advances + fees + interest = new balance, and the rows found must add up to each of those totals. A green "Adds up" note means everything matched; otherwise an amber "Needs your attention" box lists each difference, and you have to tick "Import anyway: I've checked the differences" before Import statement works. Everything else matches the CSV import: duplicates are skipped, rows that match an entry you made are linked to it, and importing the same statement twice adds nothing new. After the import, the summary, interest rates and promotional balances are saved with the account, one record per statement period; undoing the import removes that record along with the transactions. Saving the summary needs a database update (migration 209); until it is applied, PDF import says "Run migration 209 first".`,
  },
  {
    role: 'all',
    title: 'How are card statements and card payments imported?',
    content: `When the account you import into is a credit card or a loan, the statement import uses card words instead of expense and income. Charge, Interest and Fee add to what you owe (stored as expenses on the card); Payment and Refund or credit (on a loan, Credit) lower it (stored as income on the card). Interest and fees are recognized from the wording, such as "INTEREST CHARGED TO STANDARD PURCH" or "LATE FEE", and a PDF statement's own sections say which rows they are; change any row with "What is this row?" in the review step. The sign question in the Columns step is worded the same way, for example "Charges appear as positive numbers", and the sample counts charges, payments, refunds, interest and fees. Payments are transfers, not income: a card or loan payment moves money from another of your accounts. Each payment row has "Paid from", which starts with the account your last linked payment to this card came from (or, for a card with no history, the account you last paid any card from), so if you pay every card from one checking account you choose it once. "Paid from, for all payments" sets every payment of the statement at once. On import, if the paying account already has the matching withdrawal (the same amount within 5 days), the two are linked as a card payment (or loan payment). If it doesn't, and "Record the payment on the other account if it isn't there yet" is ticked (the default), the withdrawal is added there so both balances are right; when you later import that account's statement, its row links to the recorded payment instead of being added twice. On a bank statement, money out whose wording names a card or loan ("PAYMENT THANK YOU", "CITI CARD ONLINE", "Transfer To Loan") offers "This paid": choose the card or loan and it is linked the same way instead of counting as spending; when the wording names exactly one of your cards or loans it is chosen for you. A refund on a card is less spending, never earnings: the Finance dashboard and Budgets subtract it from its category (or Uncategorized). The result after the import says how many payments were linked, how many were recorded on the other account, and any that couldn't be linked. Undoing the import takes those transfers apart: a payment it recorded on another account is deleted, and a withdrawal that was already there just loses the link. Linking needs the transfer columns in the database (migrations 202 and 203); without them the rows are still imported, as ordinary transactions, and the result says why they weren't linked.`,
  },
  {
    role: 'all',
    title: 'How to import a bank statement (CSV)',
    content: `CentenarianOS does not connect to your bank, and nothing is imported on its own. To bring in bank or card transactions, download a CSV of your account activity from your bank's website, then go to Dashboard → Finance and click Import bank statement. You can also open Finance → Accounts and click Import statement on an account, which opens the import with that account already chosen. The import has four steps, and nothing is saved until you press Import statement at the end of step 3. Step 1, Account and file: choose the account the statement belongs to. This is required, and each option shows the bank, the account name, and the last four digits. Then choose the CSV file, or paste its text and click Use pasted text. A PDF statement goes in the same box (see "How to import a PDF statement"). The file is read on your device first and the page says what it found: the bank layout it recognized, which line the header row is on, and how many rows there are. The box is green only when a known layout was recognized and nothing needs checking; it is amber ("Needs your attention") when the columns couldn't be worked out, the file is damaged, or it looks like a card export going into a bank account (or the other way round). Layouts recognized from real exports: Citi credit cards, PayPal activity, Arizona Federal Credit Union (checking, credit card and loan), Navy Federal, and the Best Buy (Citibank) text download; Chase, American Express, Capital One, Apple Card, Discover, Bank of America and Wells Fargo are recognized from their known layouts. In a PayPal export, rows that move no money (item lines, authorizations, holds, voids, denied payments and the other-currency side of a conversion) are left out and counted separately, not as errors. One import takes up to 5,000 rows and 4,000,000 characters; split a longer statement into shorter date ranges. Step 2, Columns: confirm which column is the date, the description, and the amount. The lists are filled in from the file, or from the settings saved for that account last time. Optional columns are posted date, merchant, memo, details (added after the description and used for the store name, for banks such as Arizona Federal that put the store in Memo), category, bank ID, and status. A Payee column counts as the merchant when the file also has a Description column, and a row whose description is empty uses the merchant instead, so it isn't rejected. A TxnID or Txn ID column is read as the bank ID, which keeps re-imports from adding duplicates. Then say how the file shows a purchase (the sign convention; on a credit card or loan worded as charges, for example "Charges appear as positive numbers"): purchases are negative numbers, purchases are positive numbers, separate debit and credit columns, or a type column that says debit or credit. A credit card account starts with "purchases are positive" when the file itself gives no clue. Choose the date order (MM/DD, DD/MM, or YYYY-MM-DD); when every date in the file could be read both ways, you have to choose before continuing. Rows the bank marks as pending are left out unless you tick Include pending transactions. A sample shows how the first five rows will be read, each marked Expense or Income, so a wrong sign or date order is obvious before you continue. Leave Remember these settings for this account ticked to have them filled in next time. Step 3, Review: every row has a status. New will be added. Already imported is in the account already and is skipped. Possible duplicate (amber) was recognized only by its date, amount, and vendor: check it, and choose Import anyway if it is a second real purchase. Repeated in this file has the same bank ID as an earlier row of the file. Matches an entry you made means you had already typed or scanned that purchase: the row shows your entry's date, amount, and name, and by default the statement row is linked to your entry instead of adding a second copy. Can't import shows the reason, and rows that could not be read at all are listed with their row number in the file and why. For each row you can choose what to do (import, link to my entry, or skip, depending on the row), switch it between expense and income (on a credit card or loan: choose Charge, Payment, Refund or credit, Interest or Fee), and pick a category. On a bank statement, money out whose wording names a card or loan offers "This paid" so it is linked as a card or loan payment instead of counting as spending (see "How are card statements and card payments imported?"). Colors: green is done and fine, amber means check this, red is an error, blue is information, and every one has an icon and words. A category that came from a vendor you taught with "Always" is marked Learned from this vendor. Tick several rows to set one category on all of them or to skip them. The tabs filter by status, a statement over 200 rows is shown 200 at a time, and the line at the top keeps count, for example "Will add 42, link 3, skip 7". Step 4, Done: the result shows how many rows were imported, linked, skipped as duplicates, and rejected, with the reasons. Undo this import asks you to confirm, then deletes the transactions that import added, keeps and lists any you edited afterwards, and unlinks the entries it had linked, which stay in your transactions. Import history, shown under the first and last steps, lists every import with its counts and an Undo button. Importing the same file again is safe: rows that are already in the account show as Already imported and are skipped, so overlapping statement dates do not create duplicates. No bank export? Step 1 has a simple template (date, amount, type, description, vendor, category) that imports the same way. Statement import needs a connection and is not queued while you are offline. Transactions that came from the earlier bank-linking feature are still in your history: their source reads "Bank import", and the Bank import option of the source filter on the Transactions page lists them.`,
  },

  // ─── DEBT PAYOFF, INTEREST PAID AND DUE DATES ─────────────────────────────

  {
    role: 'all',
    title: 'How much interest am I paying on my cards and loans?',
    content: `Go to Dashboard → Finance and click Debt payoff (also under Life → Debt Payoff in the menu). The top of the page shows what you owe in total, your minimum payments each month, and the interest you have paid this year. Each card and loan shows its interest paid this year, and the Interest paid section lists every account month by month, with a year picker for earlier years. Where the numbers come from: when you have imported a statement PDF, the interest charged that the statement prints is used, exactly, and it counts in the month the statement closed. For months with no imported statement, the interest is the sum of transactions marked as interest on that account (an interest refund is subtracted). A transaction inside a statement's period is not counted twice. The APR shown for each debt is the purchase APR from the latest statement, otherwise the highest APR the statement lists, otherwise the interest rate saved on the account ("from account"). Only active credit card and loan accounts are included.`,
  },
  {
    role: 'all',
    title: 'How do I use the payoff calculator?',
    content: `On Finance → Debt payoff, the Payoff calculator works on one debt at a time. Pick the debt; its balance and APR fill in, and you can change them to try other numbers without changing the account. Then choose what to work out. "When it is paid off, paying a set amount": enter a monthly payment and the calculator shows the payoff date, the number of payments and the total interest. If the payment doesn't cover the first month's interest, it says so, because the balance would never go down. "The payment to be done by a date": pick a date and it shows the monthly payment needed and the interest it costs; a date less than a month away means paying the whole balance now. The calculator figures interest as balance × APR ÷ 12 each month, with no new purchases or fees, so the result is an estimate. Cards really charge interest on the average daily balance, so paying earlier in the cycle saves a little: about amount × APR ÷ 365 × days early (for example, paying $500 ten days early at 23.99% saves about $3.29).`,
  },
  {
    role: 'all',
    title: 'How does the debt-free plan work, and which strategy should I pick?',
    content: `On Finance → Debt payoff, the Debt-free plan spreads one monthly budget over all your cards and loans: every debt's minimum payment plus an extra amount you choose. When a debt is paid off, its minimum moves to the next one, so the budget stays the same until you are debt-free. Strategies: Highest interest first (avalanche), the default, puts the extra money on the debt charging the highest interest right now, which pays the least interest overall. It also protects deferred-interest promotions (for example "no interest if paid in full in 12 months" on a store card): each promo balance is paid down fast enough to be cleared one payment before its deadline, because any balance left after the deadline is charged all of the deferred interest at once. Smallest balance first (snowball) pays off small balances first for quick wins and usually costs more interest. Promo deadlines first puts all extra money on promo balances, earliest deadline first, then highest interest. My own order lets you move debts up and down; debts you leave out follow in highest-interest order. The checkbox "Clear deferred-interest promo balances before their deadline first" is on by default for every strategy. The plan shows your debt-free date, the interest you will pay, the interest saved and months saved compared with paying only the minimums, a chart of the balance over time (this plan against minimums only), and a month-by-month schedule of what to pay on each debt. If a promo would still be missed, or the budget doesn't cover the interest, it says so in an amber notice. Save this plan stores the settings and what the plan expects you to pay each month from today; open a saved plan later to see whether you are on track: the payments planned so far against the card and loan payments you have made, counting only payments linked as transfers. Saving plans needs a database update (migration 211); until it is applied the page says "Run migration 211 first", and the plan still works without saving.`,
  },
  {
    role: 'all',
    title: 'Payment due dates in the planner, and due-date reminders',
    content: `CentenarianOS turns each credit card and loan payment due date into a planner task, under Inbox › Inbox › Bills. The due date and amounts come from the latest imported statement: the task reads like "Pay Best Buy — $40.00 minimum ($1,150.00 statement balance to avoid interest) — due Oct 21", and its notes estimate what paying early saves. Later due dates on the account's due day of the month (set on the account) get a task too, without amounts until that statement is imported. Each deferred-interest promotion gets its own task 30 days before it expires, with the monthly amount needed to clear it and the deferred interest at risk. Tasks are created for the next 45 days, checked every morning and whenever you open the Debt payoff page. A task is marked done on its own when payments linked to that card or loan (a Transfer, or "This is a payment to…") during that cycle add up to the minimum. If a newer statement moves a due date, the old task is archived and a new one is made. Reminders: a Due soon banner on the Finance page and the Debt payoff page lists payments due in the next 3 days and on the day itself, until they are paid. You can also get an email: under Reminders on the Debt payoff page choose Off (the default), 3 days before, 1 day before, or Both. Planner tasks and email reminders need a database update (migration 211); until it is applied the page says "Run migration 211 first".`,
  },
  {
    role: 'all',
    title: 'Are the debt payoff numbers exact?',
    content: `No. Payoff dates, interest totals, interest saved, early-payment savings and deferred interest are estimates to help you plan, not financial advice and not what your lender will charge. The rules: interest each month is the interest-bearing balance × APR ÷ 12; cards really use the average daily balance, so the difference is a few cents a month. Minimum payments stay at today's amount (the latest statement's minimum, or an estimate of the larger of $25 and 1% of the balance plus a month's interest when there is no statement). No new purchases, fees or rate changes are assumed. Money above the minimum is assumed to go to the balance the plan chooses; under US card rules (the CARD Act) issuers apply it to the highest-rate balance and to a deferred-interest balance in its last two billing cycles, or when you ask them to, so call your issuer if you want extra payments on a promo balance sooner. Deferred interest uses the figure your statement prints when there is one; otherwise it is estimated as the promo balance × APR ÷ 12 for each month since the promotion started. Interest paid is exact only for months with an imported statement.`,
  },

  // ─── TRANSFERS BETWEEN YOUR OWN ACCOUNTS ──────────────────────────────────

  {
    role: 'all',
    title: 'How are transfers, card payments, and loan payments tracked?',
    content: `Money that moves between two of your own accounts is a transfer, not spending or income. That covers moving money from checking to savings, paying a credit card from a bank account, and paying a loan. A transfer is two transactions that are linked to each other: an expense on the account the money left and an income on the account it reached. On a credit card or loan, that income entry is the payment, and it lowers what you owe. Linked transfers do not count as spending or income: they are left out of the Finance dashboard totals, the monthly trend, budget progress, brand P&L, Life Categories spending, the AI coach's finance data, and the Life Retrospective. They still count in each account's balance, and exports still include them. On the Transactions page and on a transaction's own page, a linked transaction shows a badge reading "Transfer ↔" followed by the other account's institution, name, and last four digits; click it to open the other side. There are three ways to record a transfer. (1) A new one: click Transfer on the Finance dashboard or the Accounts page, pick the From and To accounts, the amount, and the date; both sides are created together. (2) Both sides already exist, for example after importing statements for both accounts: open either transaction, click "Mark as transfer…", and pick the matching transaction, or use the Possible transfers panel on the Transactions page. Both transactions stay as they are, so balances do not change. (3) Only one side exists, for example a payment to a loan you don't import statements for: open the payment, click "This is a payment to…", and choose the account. One entry for the same amount and date is added on that account, so its balance goes down by the payment. (4) While importing a statement: on a card or loan statement each payment has "Paid from", and on a bank statement a payment to a card or loan has "This paid"; the import links it to the matching row or records the missing side for you (see "How are card statements and card payments imported?").`,
  },
  {
    role: 'all',
    title: 'How do I review possible transfers?',
    content: `Go to Dashboard → Finance → Transactions. When some of your transactions look like money moving between your own accounts, a Possible transfers panel appears above the list; click Review to open it. A pair is suggested when one account has an expense and another account has an income for exactly the same amount within 5 days. Each suggestion shows both transactions with date, amount, account (institution, name, and last four digits, because two accounts can share a name), and description, plus why it was suggested. "High confidence" means each transaction has only one possible match and a description supports it: wording such as transfer or payment, or the other account's last four digits. "Check this one" means more than one transaction could be the other side, or nothing in the descriptions says it is a transfer. Round amounts such as $300 often collide, so look before you link. Click Link to link a pair, or Not a transfer to dismiss it. Dismissals are saved to your account (after the database update, migration 219; before it they are remembered in the browser you are using), so the Review page and every device agree, and "Show dismissed" brings them back. "Link all high-confidence" links every high-confidence pair at once. Nothing is linked until you click. Below the pairs, "Payments with no matching transaction" lists expenses that read like a card or loan payment when the other account has no transaction for them: choose the account under "Paid to" and click Record payment to add the missing side. Setting a date range in the page's filters narrows what is checked. Linking needs a connection; it is not queued offline.`,
  },
  {
    role: 'all',
    title: 'How do I unlink, edit, or delete a transfer?',
    content: `Open either side of the transfer from the Transactions page and use the Transfer card. Unlink removes the link and keeps both transactions, which then count as spending and income again. If one side was added by "This is a payment to…", Unlink asks whether to remove that added entry or keep it. Deleting one side of a transfer asks what to do with the other side: "Delete both sides" removes the transfer from both accounts, and "Unlink and delete only this one" keeps the other transaction as an ordinary one. The amount and type of a linked transaction are locked, because the two sides have to match; unlink first to change them. Category, notes, date, vendor, and description can be changed at any time. Duplicating a linked transaction makes a plain copy that is not part of the transfer.`,
  },

  // ─── FINANCE REVIEW PAGE, SAVED IMPORTS AND EDITING AN IMPORT (plans/63 A) ─

  {
    role: 'all',
    title: 'What is the finance Review page?',
    content: `Go to Dashboard → Finance and click Review (the amber number next to it counts what is waiting), or open Life → Finance Review in the menu. The Review page lists everything in Finance that waits for a decision, worked out from your saved transactions, so you can stop at any time and pick up later. Sections: Unfinished imports (statement reviews you started and didn't finish); Possible transfers (two transactions with the same amount a few days apart on two of your accounts: Link them, or Not a transfer); Card and loan payments with no other side (a payment on a card or loan with no "Paid from" account, or money out of a bank account worded like a card or loan payment with no "Paid to": choose the account and Link; the matching transaction there is linked, or, with "Record the payment on the other account if it isn't there yet" ticked, the other side is added there); Imported rows that match an entry you made (a statement row and a transaction you typed or scanned that look like the same purchase: Same purchase keeps your entry with its notes and receipt, gives it the statement's details and removes the imported copy; Not the same keeps both); and Uncategorized (spending and income with no budget category; transfers are not listed). Every section shows its count, pages through long lists 25 at a time, and has "Select all on this page" with actions for the selected items. "Not a transfer", "Not a payment" and "Not the same" are saved to your account, so the suggestion is not offered again. Choose a date range at the top to check older history: transfers, payments and matches look at your newest 5,000 transactions without one. If the page says "Run migration 219 first", the database update for saved answers and saved imports hasn't been applied yet; everything else on the page still works.`,
  },
  {
    role: 'all',
    title: 'How do I finish an import later (resume a saved import)?',
    content: `When you reach step 3 (Review) of Import bank statement, the review is saved as you go: every choice you make (import or skip, type, category, Paid from, the "Import anyway" box for a PDF that doesn't add up) is saved a moment after you make it, and again when you leave the page. A line above the rows says "Your choices are saved." To pick it up again, open Import bank statement: Unfinished imports at the top lists it with the file name, account, number of rows and when it was saved; click Resume import. It is also listed on the finance Review page. Resuming checks every row again against your transactions as they are now, so a row that was imported some other way since then shows as Already imported, and the page says how many rows changed. Then finish as usual with Import statement, or click Discard this import to throw the review away (nothing is imported). If you choose the same file for the same account again, the page offers to resume the saved review; starting over replaces it. What is kept: only the rows read from the file (date, amount, direction, description) and your choices, plus a PDF statement's summary. The file itself, CSV or PDF, is never stored. A saved import is kept for 30 days after you last worked on it, then deleted. Importing it or discarding it deletes it at once.`,
  },
  {
    role: 'all',
    title: 'How do I change a past import (Import history)?',
    content: `Go to Finance → Import bank statement and click "Import history and editing", or "See every import, and edit one" above the history list. Import history lists every statement import with its date, account, file, counts (added, linked, duplicates, rejected) and whether it was undone. Click Open on one to see its rows in statement order, 100 at a time. For each row you can change the vendor, the type (expense or income) and the category, then click Save changes; link it as one side of a transfer (Link as a transfer shows the transactions on your other accounts with the same amount within 5 days) or Unlink it; and delete it, if the import added it. An entry you made yourself that the import only linked is marked "Your entry, linked by this import" and is never deleted from here. Tick rows (or "Select all on this page") to set one category, type or vendor on all of them, or to delete them. One side of a transfer keeps its type: unlink it first. Re-run transfer matching checks this import's rows for transfers again, which helps after you import the other account's statement: clear pairs are linked at once and the rest are listed on the Review page. Undo this import works as on the Import page. A row you change here counts as edited, so a later Undo keeps it and lists it. The Transactions page links here too: with the "From one import" filter, click "Edit this import".`,
  },

  // ─── MULTI-CURRENCY ───────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How do accounts in other currencies work?',
    content: `Every financial account has a currency. When you add an account (Dashboard → Finance → Accounts → Add Account), the Currency list starts on your home currency; pick another one for cash you carry on a trip, for example a Mexican pesos cash account in MXN. The opening balance and every transaction on that account are entered in its currency, and its balance is kept in that currency. On the Accounts page a foreign-currency account shows its balance in its own currency and, under it, what that is worth in your home currency, with "rate as of" the date of the rate used and where it came from. A currency can be changed only while the account has no transactions, because changing it later would read every amount on the account in the new currency; create a new account instead. Your home currency (Settings → Currencies) is the currency totals are reported in. When you save a transaction on a foreign-currency account, CentenarianOS looks up the exchange rate for the transaction's date and stores the converted amount with it. The Finance dashboard totals, the monthly trend, budgets, brand P&L and Life Categories spending all add up those converted amounts, so 350 pesos counts as about $20, not $350. The Transactions list shows a foreign row's amount in its own currency with the converted amount under it (≈ $20.00). If no rate exists yet for that currency and date, the row shows "no rate yet" and is left out of totals until a rate exists; the dashboard says how many rows are waiting. Press Update rates now on Settings → Currencies, or enter your own rate, and they are converted. Transactions imported from a statement into a foreign-currency account stay in that account's currency and are converted when they are imported, using the rate for each row's date; any row with no rate yet is converted later by Update rates now or the daily refresh. Changing your home currency recomputes the converted amounts. Moving money between two accounts in the same currency is still a Transfer; between different currencies use Exchange money (see "How do I record exchanging money while traveling?"). Accounts in other currencies need a database update (migration 210); until it is applied, every account is in USD.`,
  },
  {
    role: 'all',
    title: 'How do I record exchanging money while traveling?',
    content: `When you swap money into another currency at a booth, a bank, or an ATM abroad, record it with Exchange money on Dashboard → Finance → Accounts. First have an account in each currency, for example your USD checking (or USD cash) and a cash account in the local currency. In Exchange money choose the From account (the money you handed over or that left your bank), the To account (the foreign cash account; only accounts in a different currency are offered), the amount you handed over, the amount you received, any fee, and the date. The form shows the rate you got both ways, for example 1 USD = 17.50 MXN (1 MXN = 0.0571 USD). Saving records a transfer between your own accounts: an expense on the From account and an income on the To account, linked to each other, so the exchange itself is never counted as spending or income. Both balances change in their own currencies. The fee, if you entered one, is saved as its own expense on the From account, because it is money you spent. The rate you got (received ÷ handed over) is saved as your own rate for that date, so later spending from that cash is valued at what the cash really cost you rather than at the bank's reference rate. You can see and delete it under Settings → Currencies → History. Paying with the foreign cash afterwards is an ordinary expense on the cash account, entered in that currency. To change cash back at the end of a trip, use Exchange money again the other way round. A plain Transfer between accounts in different currencies is refused, because the same amount on both sides would be wrong. Exchanges need a connection; they are not queued offline.`,
  },
  {
    role: 'all',
    title: 'Where do exchange rates come from, and how do I override them?',
    content: `CentenarianOS uses two free sources, both read by our server, never by your browser, and keeps what it reads so it doesn't ask twice. First, Frankfurter (frankfurter.dev), which publishes the European Central Bank's reference rates for about 30 major currencies once per working day, including past dates, so a transaction from last month is converted at that month's rate. Second, for currencies Frankfurter doesn't cover, ExchangeRate-API's free service (exchangerate-api.com, "Rates By Exchange Rate API"), which covers about 160 currencies and updates once a day but only has today's rates. Rates are refreshed every day, and Update rates now on Settings → Currencies refreshes the currencies you hold right away (currencies already updated today or yesterday are skipped). Wherever a fetched rate is shown, its date and source are shown with it, for example "rate as of Oct 5, 2026 (ECB via Frankfurter)". These are reference rates: the rate a booth or an ATM gives you is different. Your own rates always win. Enter one on Settings → Currencies → Add a rate (1 unit of one currency equals so much of another, on a date), or let Exchange money save the rate you got. For a transaction, your rate for that date is used, else your most recent earlier rate; only when you have none is a fetched rate used: the one for that date, else the nearest earlier one up to 7 days old, else a fresh fetch. If nothing is found at all, an older stored rate is used and marked "may be out of date". Rates between two currencies other than US dollars are worked out through US dollars. You can add any currency, even one neither source covers (Settings → Currencies → Add a currency, with its three-letter code, name and symbol); it is marked "Your rates only", and amounts in it are converted only with rates you enter. History on each currency lists the stored rates, yours and fetched, newest first, and lets you delete your own.`,
  },

  // ─── BUDGETS ──────────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How budgets work (and how suggestions are calculated)',
    content: `Go to Dashboard → Finance → Budgets (also in the Life menu, and the Budgets button on the Finance dashboard). Use the arrows to pick any month, not just this one. Each budget category shows its budget for that month, what you spent, what's left (or how much you're over), a small line of your spending over the last few months, and a suggested budget. Spending means expense transactions in that category; transfers between your own accounts, card payments, and loan payments never count. A refund (an income entry in a category where you mostly spend, such as a store refund filed under Groceries) lowers that category's spending in the month it arrived, but never below $0. Income in a category that is mostly income, such as Salary, is not treated as a refund. Transactions with no category appear on their own Uncategorized line: they count toward the total spent but not toward any category's budget; click "Categorize these" to open that month's uncategorized expenses on the Transactions page. How suggestions are calculated: choose the window (the last 3, 6, or 12 complete months before the month you're looking at) and the method (Average or Median); the default is the average of the last 6 months. A month in the window with no spending in that category counts as $0, but months before your very first transaction are left out, so a new account isn't pulled down by months you weren't tracking. Months that haven't finished yet are left out too. The result is rounded to the nearest dollar. If a category's spending swings a lot from month to month (its standard deviation is more than half its average, with at least 3 months of history), it's marked "Varies a lot": the median, or a longer window, is usually a better guide there. Click Accept to use one suggestion, or "Accept all suggestions" for every category whose suggestion differs from its budget. Budgets by month: typing a budget and clicking Save sets it for that month only, so earlier months keep the budget they had. Tick "Changes also apply to later months (and become the default)" to also use the new amount for every later month and as the category's monthly budget; past months that had no budget of their own keep the old one. Clear the box and save to go back to the default for that month. Rollover: tick "Carry what's left (or overspent) into next month" and whatever is left at the end of the month is added to next month's budget (an overspend is taken off it). It stays on for later months until you turn it off. The Budget Progress bars on the Finance dashboard show this month's budgets from the same numbers.`,
  },

  // ─── SAVINGS GOALS ────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'Savings goals: envelopes inside a real account',
    content: `Go to Dashboard → Finance → Savings goals (also Savings in the Life menu). A savings goal is a virtual envelope inside one real account, usually a savings account: one account's balance is split across several goals, such as a trip, an emergency fund and a house down payment. Click New goal and fill in a name, what it's for (equipment, house, trip, emergency fund, vehicle, education, other), a target amount, an optional target date, the account the money sits in (shown with its institution and last four digits, so two accounts with the same name can be told apart), a priority (1 = first claim on your monthly surplus), and optionally a planned trip or an equipment item it's for. "Already saved for this" puts money that is already in the account into the goal. Each goal card shows saved vs. target with a progress bar, how much is needed each month, your pace (net money added over the last three months), the projected date at that pace, and On track or Behind (in amber). Behind means the projected date is after the target date, or nothing has been added lately. From a goal you can Add money, Take out, Move money to another goal in the same account, Edit, Pause, Mark done, Archive (which returns what the goal holds to unallocated), or Delete (which also returns its money). On a planned trip's page or an equipment item's page, Save for this opens a new goal prefilled with the trip's budget or the item's price. Tick "Note milestones in my planner" on a goal to add a completed note to the planner Inbox when it reaches 25%, 50%, 75% and 100% (once per level).`,
  },
  {
    role: 'all',
    title: 'How savings allocations work with the real account',
    content: `Envelopes never move money between your real accounts. Each account with goals shows its Balance (opening balance plus income minus expenses, the same number as on the Accounts page), In goals (what all its goals hold: each goal's starting amount plus everything put in, minus everything taken out), and Unallocated (balance minus in goals). Add money takes from Unallocated and can't take more than is there. Take out returns money to Unallocated; it stays in the account. Move shifts money between two goals in the same account; goals in different accounts can't swap money, because that would be a real transfer: record the transfer on the Transactions page, then allocate it. To fill a goal, move real money into its account first (a transfer from checking, or an imported statement). Deposits into the account appear under "Recent deposits to allocate", marked Transfer when they are one side of a transfer from another of your accounts. Click Allocate to split a deposit across goals; you can't allocate more than the deposit, and a partly allocated deposit stays on the list with what's left. If you spend from the savings account, the goals can hold more than the balance. The account is then marked over-allocated in amber with the shortfall: take that much out of one or more goals so the envelopes match the real balance. Nothing is taken out for you.`,
  },
  {
    role: 'all',
    title: 'Does this savings goal fit? (monthly needed and surplus)',
    content: `Monthly needed = (target − saved) ÷ months left, where months left counts whole calendar months to the target date and is at least 1 while the date is still ahead. A goal without a target date has no monthly figure. If the target date has passed, the whole remainder is shown as due now. Your monthly surplus is income minus spending for each complete month, with transfers between your own accounts (including card and loan payments) left out. Pick the months (the last 3, 6 or 12 complete months) and the method (Average or Median) at the top of the Savings page; the default is the average of the last 6 months, the same choice as the Budgets page. Months before your first transaction are left out. Goals take the surplus in priority order (1 first; ties go to the earlier target date, then the name). Only active goals with a target date that aren't reached yet take a share. A goal fits when its monthly need is no more than what's left of the surplus after the goals before it. When it doesn't fit, the card says how much is left for it and the date it would be reached saving that much each month. If higher-priority goals use the whole surplus, raise this goal's priority, move its date, or lower its target. Paused, done and archived goals take nothing from the surplus.`,
  },

  // ─── CASH ON HAND ─────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'Cash accounts and the Cash on hand card',
    content: `A cash account (Dashboard → Finance → Accounts → Add Account, type Cash) tracks physical cash: a wallet, a cash jar, or pesos for a trip. Its balance works like any account: opening balance plus income minus expenses, in the account's own currency. The Finance dashboard has a Cash on hand card listing each active cash account with its balance in its own currency (and about how much that is in your home currency when it is foreign), when you last counted it, and three buttons: Count (see "How do I count my cash?"), Paid cash (see "How do I record paying cash?") and Withdraw, which opens Transfer with that cash account as the To account, for cash you took out of a bank account. "Last counted" turns amber when you have never counted that account or the last count was more than 30 days ago. If you have no cash account, the card is replaced by a small "Track cash on hand" button that creates a cash account named Wallet in your home currency; rename it any time. Each cash account on the Accounts page also has Count and Paid cash.`,
  },
  {
    role: 'all',
    title: 'How do I count my cash?',
    content: `Press Count on a cash account (the Cash on hand card on the Finance dashboard, or the Accounts page). Enter the cash you actually have, either as a total or, for US dollars, Mexican pesos, euros, British pounds, Canadian dollars and Japanese yen, as how many of each bill and coin. The dialog shows the recorded balance next to what you counted. When you save, the difference is recorded as one entry on that account, so the balance matches your count: less cash than recorded becomes an expense called "Unrecorded cash spending", more becomes an income called "Cash found". Pick a category for it if you know where the money went; otherwise it stays Uncategorized. The entry is tagged cash-count and dated with the date of the count (today unless you change it). A count that matches records no entry but is still kept. Count history in the same dialog lists every count with what you counted, the recorded balance and the difference. Undo latest count removes the most recent count and deletes its entry, so the balance goes back to what it was before; older counts can't be undone, because later counts started from them. Counting needs a connection. It needs a database update (migration 213): until it is applied the dialog says "Run migration 213 first" and nothing is saved.`,
  },
  {
    role: 'all',
    title: 'How are ATM withdrawals handled when I import a bank statement?',
    content: `When you import a checking or savings statement, rows whose wording means cash was taken out are recognized: ATM, CASH WITHDRAWAL, WITHDRAWAL AT BRANCH, TELLER WITHDRAWAL, the Spanish RETIRO, CAJERO and DISPOSICION DE EFECTIVO, and "CASH BACK" when your bank lists it as its own line. ATM fees, surcharges, fee rebates, deposits, purchases (including a purchase with cash back on the same line) and Spanish transfers (SPEI, TRANSFERENCIA) are not. A recognized row gets "Cash withdrawal → into" with a list of your cash accounts in the same currency as the bank account. It starts on the cash account that last received a transfer (else the cash account you used last, else your only one); choose "Not a cash withdrawal" to import it as ordinary spending. When you import, the withdrawal is recorded as a transfer: if the cash account already has the same amount coming in within 5 days, the two are linked; otherwise the cash coming in is added to the cash account as "Cash withdrawal from <bank account>". Either way it is not counted as spending, and the cash shows up in Cash on hand. ATM fees on their own line stay expenses. If your cash accounts are all in another currency, the row says so: record that cash with Exchange money instead. If you already recorded the withdrawal with Withdraw (a transfer), the imported row links to it rather than adding it twice. Undoing the import removes the cash side it recorded.`,
  },
  {
    role: 'all',
    title: 'How do I record paying cash?',
    content: `Use Paid cash, the short form at the bottom of the Cash on hand card on the Finance dashboard (or Paid cash on a cash account on the Accounts page). Enter the amount, what it was for (a vendor or a description), an optional category, and the date (today unless you change it). The cash account starts on the one you used last on this device, and the amount is in that account's currency. If you have taught CentenarianOS a category for that vendor ("Always categorize this vendor as ..."), it is filled in for you, marked "Learned from this vendor". Save cash payment records an expense on the cash account. It works offline: without a connection the payment is queued and saved when you reconnect, and the form says so. Pressing Paid cash on an account in the card picks that account and jumps to the amount.`,
  },

  // ─── STARTING BALANCES AND RECONCILING ────────────────────────────────────

  {
    role: 'all',
    title: "Setting an account's starting balance",
    content: `An account's balance is its starting balance plus the income and minus the expenses recorded on it. The starting balance can have an "as of" date: the balance at the end of that day. When it has one, only transactions dated after that day count toward the balance; older ones stay in your history and reports but no longer change the balance. Without a date, every transaction on the account counts (how balances always worked). This lets an account start part-way through its history when you never import the older statements. Set it on Dashboard → Finance → Accounts (Add Account or Edit: "Starting balance" and "As of"), or on the account's Reconcile page with Set starting balance. Importing statements? Use the balance on your first imported statement's start date: the beginning (previous) balance printed on it, dated the day before the statement period starts (the day the earlier statement closed). On the Reconcile page, "Use my first imported statement" fills both in from the earliest PDF statement saved for the account. For a credit card or loan, enter what you owed (a positive number). The balance is always in the account's own currency. The date needs a database update (migration 221): until it is applied, saving a date says "Run migration 221 first" and balances keep counting every transaction.`,
  },
  {
    role: 'all',
    title: 'How do I reconcile an account each month?',
    content: `Reconciling checks your records against the bank or card statement, so the balance in CentenarianOS is the real one. Open Dashboard → Finance → Accounts and click Reconcile on the account (or follow the Finance dashboard's "Reconcile your accounts" card, which lists active accounts not reconciled in the last 30 days in amber, never-reconciled ones first; cash accounts are left out because counting your cash is their check). 1. Enter the statement's closing date and its ending balance. For a credit card or loan, enter the new balance printed on the statement, which is what you owe; a credit balance is a negative number. When you imported the statement as a PDF, both are filled in from it (pick another imported statement in the list), and right after a PDF import the import page offers "Reconcile to this statement's balance". 2. Click Compare. You see the balance your records give for that date (transactions dated on or before it, after the starting balance date), the difference from the statement, and the period's transactions: after the last reconciled statement (or the starting balance date) through the closing date. 3. Tick Cleared on each transaction that appears on the statement. The page shows how many are ticked and what the unticked ones add up to. 4. Click Finish. With no difference the statement is reconciled, and the account shows "Reconciled through" that date. With a difference, choose what to do with it (see "My account doesn't match the statement: what now?"). Transactions dated inside a reconciled period show a Reconciled badge; editing or deleting one asks you first, because it can put that reconciliation out of balance. If you change one anyway, reconcile that statement again. The Reconciliations list on the page shows every statement with its status, and Unreconcile opens one again (optionally deleting its adjustment). Do it once a month, when each statement arrives. Reconciling needs a connection and a database update (migration 221): until it is applied the page says "Run migration 221 first" and nothing is saved.`,
  },
  {
    role: 'all',
    title: "My account doesn't match the statement: what now?",
    content: `First look for the cause on the Reconcile page: a transaction that is missing (add it), entered twice (delete one), has the wrong amount, or is dated after the closing date when the statement includes it (fix the date). The unticked total helps: if the transactions you could not tick add up to the difference, they have not reached the bank yet or belong to another statement. Fixing a transaction updates the comparison when you click Compare again. When you can't find it, choose one of three ways to finish: Add an adjustment records one transaction named "Reconciliation adjustment" on the closing date, tagged reconcile-adjustment, for exactly the difference, so your records match the statement. On a checking, savings or cash account more money on the statement is an income and less is an expense; on a credit card or loan more owed on the statement is a charge (an expense) and less owed is a credit (an income). Adjustments count in spending and income like any transaction; give it a category if you know what it was. Change the starting balance moves the starting balance by the difference. Use it when the starting balance was a guess, on the first statement you reconcile; it is not offered once an earlier statement is reconciled, because it would put that one out of balance. Leave it open saves the statement with its difference and changes nothing, so you can come back after finding the cause; the account and the dashboard card show it as left open. Every reconciliation keeps the statement balance, the balance your records gave, the difference and what you chose.`,
  },

  // ─── RETIREMENT AND LIFE INSURANCE ─────────────────────────────────────────

  {
    role: 'all',
    title: 'Retirement accounts: 401(k), IRA, HSA, brokerage and pensions',
    content: `Go to Dashboard → Finance → Retirement (also Retirement in the Life menu). Click Add account and pick the kind: 401(k), 403(b), 457(b), Traditional IRA, Roth IRA, SEP IRA, SIMPLE IRA, HSA, Brokerage, Pension, Annuity, Whole life cash value, or Other. Give it a name, and optionally the institution, last four digits and currency (it defaults to your home currency). These accounts are kept apart from your bank, card and loan accounts. Your contribution is either a fixed amount each time (weekly, every two weeks, twice a month, monthly, quarterly or yearly) or a percent of pay; enter your yearly pay for a percent contribution. The employer match is entered as a rule: the match rate (for example 100%), up to a percent of pay (for example 4%), and an optional yearly cap. The match is that rate of what you put in, counting only what you put in up to that percent of your pay, at most the cap. A match limited to a percent of pay needs your yearly pay; without it the match counts as 0 and the account says so. You can also give the account its own expected yearly return; leave it blank to use the planner's preset. Balances are typed in by hand: click Add balance on an account and enter the date, the balance from your statement and, optionally, what you have contributed this year. One balance per account per date (entering the same date again replaces it); the latest one is the account's current balance, and Balance history lists earlier ones. Untick "Still contributing / open" for an old account: it keeps growing in the projection but gets no new contributions. Importing these balances from statements may come later. Retirement accounts need a database update (migration 215); until it is applied the page says "Run migration 215 first".`,
  },
  {
    role: 'all',
    title: 'The retirement planner and its assumptions',
    content: `Everything on the Retirement page is an estimate from your own numbers and the assumptions shown. It is not a forecast and not financial advice. Under Planner settings, enter your birth year (or age), the age you plan to retire (65 if blank) and the age to plan to (90 if blank). Projection: each account grows every month at the monthly equivalent of its yearly return, and one twelfth of the yearly contributions plus employer match goes in at the end of each month. Contributions stay the same in dollars until retirement (raises are not assumed). The presets are round-number assumptions, not predictions or sourced figures: Conservative 4%, Middle 6% and Optimistic 8% a year before inflation, with inflation at 3% a year; change any of them. "Your plan" uses each account's own return when it has one, otherwise the preset you select; the three preset lines apply one rate to every account so they compare like for like. The chart and the headline figures are in today's dollars (the balance divided by inflation over the years); the figure before inflation is shown under the projection. Show as a table gives the same numbers every five years. Target: choose your yearly spending in retirement in today's dollars, either an amount or a multiple of what you spend now (your average month over the last 12 months, transfers left out, times 12). "Spending × years in retirement" adds up each year from your retirement age to the age you plan to, minus Social Security from the age it starts; no growth during retirement is assumed. "Withdrawal-rate rule of thumb" divides the yearly need after Social Security by the withdrawal rate (4% means about 25 times the yearly need), plus Social Security's amount for each year between retiring and its start age; it is a rule of thumb, not a guarantee. Social Security is the monthly estimate you type in from your own statement, in today's dollars, and it lowers the target from its start age (your retirement age if blank); the page shows by how much. Gap = target minus the projected balance in today's dollars. When there is a gap, the page shows about how much more a month would close it, figured at the selected preset's return after inflation, and the total a month including what goes in now. At or past your retirement age there is no per-month figure. Net worth (estimate) at the bottom adds your account balances (cards and loans subtracted), retirement balances and the cash value of permanent life policies; accounts in another currency without an exchange rate are left out and counted. Taxes, fees, market swings and benefit changes are not modeled.`,
  },
  {
    role: 'all',
    title: 'Life insurance policies, premiums and term-end warnings',
    content: `Go to Dashboard → Finance → Insurance (also Insurance in the Life menu). Click Add policy and pick the kind (term life, whole life, universal life or other), the insurer, the last four of the policy number, the coverage (death benefit), the premium and how often it is due (monthly, quarterly, twice a year or yearly), the start date (the first premium) and, for term life, the date the term ends. For whole and universal life you can enter the cash value and its date. Beneficiaries are free text, as on the policy. Premium payments are found in your transactions: link the budget category and/or the vendor name the premium shows up as. A transaction counts as a premium payment when it is an expense in that category or naming that vendor, its amount is within 2% of the premium (at least $1), and it is dated no more than 30 days before the start date. Each policy shows what you have paid to date and this year, the last payment, the next due date (due dates repeat from the start date on the same day of the month, or the month's last day), and whether that next due date is already paid: a matching payment after the previous due date covers it. Tick "Add premium due dates to the planner" to add the next due date as a task under Inbox › Bills; it is marked done when a matching payment is found, and the task is brought up to date each time you open the Insurance page. The top of the page totals coverage per group, never across groups: Life coverage always shows, and Property, Liability or Other coverage shows when you have a policy of that kind, because a death benefit and the limit on a house or a liability policy are different things. It also totals yearly premiums and permanent-policy cash value, for policies in force in your home currency. A term policy ending within a year is outlined in amber with a notice, so you can decide whether you still need the coverage. Cash value also counts toward net worth on the Retirement page; if you also track it as a "Whole life cash value" retirement account, keep it in one place only so it isn't counted twice. Policies need a database update (migration 215); until it is applied the page says "Run migration 215 first".`,
  },

  // ─── WALLET AND BUSINESS PAGES (plans/66 W1) ──────────────────────────────

  {
    role: 'all',
    title: 'Your Wallet: net worth, cash, credit, loans, assets and retirement',
    content: `The Wallet puts what you have and what you owe on one page. Open it from Dashboard → Finance → Wallet (the Wallet button at the top of the Finance dashboard), or Wallet in the Life menu (/dashboard/finance/wallet). Every figure is an estimate, not advice, and every amount is in your home currency, the one set in Settings → My currencies. Net worth (estimate) is at the top: cash + checking and savings + retirement + life policy cash value + assets, minus what you owe on credit cards, lines of credit and loans. Cash means physical cash only: your cash accounts, each with how long ago you last counted it; a pocket not counted in over 30 days (or never) shows an amber "Count cash" link to the Cash on hand card, and a pocket below zero is amber. Checking and savings are a separate card with checking and savings subtotals; "Set aside in savings goals" shows what your goals hold in those accounts, and it is not subtracted because the money is still there. Credit cards and lines of credit shows how much of your limits you use (see "Credit used vs limit on the Wallet and the Debt page"). Loans have their own section (see "Loans on the Wallet: payoff date and trying a bigger payment"). Assets and insurance totals the equipment you own and your own vehicles: each item shows its resale value and its depreciated book value (from its depreciation settings) side by side. The resale value is the value you entered with Add Valuation (Value History on the equipment item) (or a current value you changed by hand); you enter it yourself for now, and a lookup from resellers such as eBay comes later. An item you never revalued has no resale value yet, because adding an item only copies its purchase price. The total uses the resale value, else the book value, else the purchase price; a vehicle has only a book value for now, so set up its depreciation to give it one. Items with no value are listed in amber. Equipment and vehicles have no currency, so they count in your home currency. The same card lists the coverage of policies in force per group (life, and property or liability once you have them). Retirement shows what your retirement accounts hold and the years left to your retirement age (65 marked "assumed" when you have not set one), green "On track" when the planner's gap is zero or less, otherwise amber "Short by" with about how much more a month; the figures match the Retirement page. Accounts in another currency are converted at today's rate (the same rates as the Accounts page). An amount with no rate yet is never added at face value: it is left out of every total and listed in an amber box with an Update rates link. Businesses lists each business (brand) with this year's money in, out and net; see "Business pages: cash flow, profit and loss, invoices and expected income". Accounts, equipment and policies can't be tagged to a business yet, so for now they all count in the cards above.`,
  },
  {
    role: 'all',
    title: 'Credit used vs limit on the Wallet and the Debt page',
    content: `The Wallet's "Credit cards and lines of credit" card shows how much of your credit limits you use. A line of credit is a loan account that has a credit limit; a loan with no limit is shown under Loans instead. So leave Credit Limit empty on a car, student or home loan (fill it in only for a revolving line such as a HELOC); if a loan has a limit typed on the account, the Loans section names it with a link to clear it, so it gets its payoff date back. A card's limit is the Credit Limit on the account (Finance → Accounts → Edit); when that is empty, the credit limit printed on the latest imported statement that shows one is used, and the card says "Limit from the latest statement". The Debt payoff page uses the same limit and shows "Credit limit $X · N% used" under each card. Used = what you owe on each card or line that has a known limit, added up; a card you overpaid counts as zero, so its credit never hides another card's balance. % used = used divided by the total of those limits, and available = limits minus used. A card with no known limit is listed ("1 card has no limit; its $X owed isn't in the %") with a link to add it. Each card and line has its own bar and %. Using 30% or more of a limit, on one card or overall, is shown in amber: that is a common rule of thumb, not a rule. Being over a limit is amber too. A card in another currency shows its owed and limit in that currency; both convert at the same rate, so its % is exact.`,
  },
  {
    role: 'all',
    title: 'Loans on the Wallet: payoff date and trying a bigger payment',
    content: `The Wallet lists loans in their own section, apart from credit cards and lines of credit. Each loan shows: Starting balance, the account's starting balance and the day it is as of (or the day you added the account when no starting date is set; set it under Finance → Accounts → Edit, "Starting balance as of"). When the starting balance is 0, the first charge on the loan and its date are used instead, such as the loan amount recorded as a charge when it was paid out. This is where your records of the loan start, which is not always the amount you first borrowed (for example when you set it from your first imported statement); a separate original amount and date for each loan come with a later update. Owed now is worked out from the starting balance and every payment and charge recorded since, as of the latest transaction, with how much has been paid down. Monthly payment shows the date the loan would be paid off at that payment and about how much interest that costs. The monthly payment is the minimum on the latest imported statement; with no statement it is your last payment into the loan (a payment recorded as a transfer to it, or linked by transfer tracking, with its date). The Wallet never guesses a loan's payment with the credit-card minimum formula, which would put a fixed-payment loan's payoff years too late: with no statement and no linked payment it says "Not known yet" and shows no payoff date. To try a different amount, type it under "Try a monthly payment": the Wallet shows the new payoff date, the interest, and how much interest you would save and how many months sooner you would finish compared with the monthly payment (or how much more it costs, for a smaller payment). A payment that does not cover a month's interest never pays the loan off, and the Wallet says so. A payment that covers the interest but would need more than 50 years (for example a small payment on a large mortgage, or a loan with no APR) shows "Takes more than 50 years" instead of a date, and no savings are compared against it. All of it is an estimate: interest is worked out monthly at the APR shown (the latest statement's, else the account's own Interest Rate), with the first payment a month from today. A loan with no APR counts no interest and shows an amber "Add the APR" line. The Debt payoff page has the full payoff calculator and the debt-free plan for all your cards and loans together.`,
  },
  {
    role: 'all',
    title: 'Business pages: cash flow, profit and loss, invoices and expected income',
    content: `Each business (brand) has its own page. Open it from the Businesses card on the Wallet, or Open next to a brand on Finance → Brands (/dashboard/finance/brands/[id]). Money is counted from what is tagged to the business today: transactions with the business in their Brand field (tag many at once with Find similar and bulk edit on the Transactions page), invoices and trips with the business, and expected income for it. Transfers between your own accounts, including card and loan payments, are never money in or out. Amounts are in your home currency; a transaction in another currency with no exchange rate yet is left out and counted in a note. This year shows money in, money out and net from January 1 to today. Cash flow shows the same three figures per period, newest first: Monthly is the last 12 months, Quarterly the last 8 quarters (Q1 is January to March), Yearly the last 5 years, each including the current one, with a Total row; a period with nothing shows zeros. Profit and loss takes any From and To dates: Apply shows income, expenses and net, and Export PDF downloads it with every transaction, totals in your home currency and each transaction in its own currency. The P&L reads every transaction in the range, however many there are (it used to stop at 1,000). Open invoices shows what is owed to you (sent or overdue receivables, total minus paid) and what you owe (payables). Expected income adds up the payments expected in the next 90 days. Tagged to this business counts its transactions, invoices and trips. The Wallet shows one row per business with this year's money in, out and net, open invoices and expected income, and the net of all businesses together. Accounts, equipment, vehicles, insurance policies and retirement accounts can't be tagged to a business yet; when they can, the business page will also show the business's own cash, credit, assets and insurance.`,
  },

  // ─── FIND SIMILAR, BULK EDIT AND UNDO ─────────────────────────────────────

  {
    role: 'all',
    title: 'How do I find similar transactions?',
    content: `Find similar finds your other transactions that share details with one transaction or a search, so you can fix them all at once. Open it three ways: the Find similar button (magnifier) on a row of Dashboard → Finance → Transactions; Find similar in the Actions card of a transaction's page; or type a search on the Transactions page and click Find similar and edit in bulk. Tick the details the others must share; the count updates as you tick. Same vendor matches the vendor name the way the app compares vendors: case, punctuation, store numbers and card-processor tags such as "SQ *" are ignored, so "CHIPOTLE #1234", "TST* Chipotle 0876" and "Chipotle" match, but "Chipotle Grill" does not. Similar description matches when every word you type appears in the description or the vendor, in any case (punctuation in your words is ignored). Same amount matches within the give-or-take you set, in each account's own currency (0 means to the cent). Same account, Same category (or Uncategorized), Same type (expense or income) and Date range do what they say. Starting from a transaction ticks its vendor (or, with no vendor, the telling words of its description) and its type; the other details are filled in but not ticked. The search runs on the server across all your transactions, so it works with years of imported statements: it checks up to the newest 30,000 that pass the other details (tick a date range to narrow a bigger search) and up to 10,000 matches can be selected at once. Every match starts selected; untick any you want to leave out, or use Select all and Select none, and page through the list. Transfer sides are marked, and the count says how many there are. Click a match's open button to see that transaction. Nothing changes until you apply an edit (see "How do I edit many transactions at once?").`,
  },
  {
    role: 'all',
    title: 'How do I edit many transactions at once (bulk edit)?',
    content: `In the Find similar panel on Dashboard → Finance → Transactions, under "Change the N selected transactions", choose what to change; anything left on "Leave as is" or blank stays as it is. Category (or No category), Rename vendor to (for example turn "SQ *BLUE BOTTLE 0042" into "Blue Bottle Coffee"), Type (expense or income), Brand (or No brand), Add life category, Remove life category, Add tags and Remove tags (separated by commas; any case), and Unlink the selected transfers. Then click Apply. More than 200 transactions are sent in batches of 200 with a progress bar, as one edit you can undo. Rules that keep your books right: the type never changes on one side of a transfer, because the two sides must stay an expense and an income (the result says how many kept their type; unlink them in the same edit to change them). Unlinking a transfer always unlinks both sides, even when only one side was selected; both stay, and count as spending and income again. Marking new transfers is still done on a transaction's page or in the Possible transfers panel. Only your own transactions, categories, brands and life categories can be used; a transaction deleted in the meantime is skipped and counted. Remember for future imports (shown once you pick a category) saves the category as a learned rule for the selected vendors, under the vendor names your bank statements use and, after a rename, under the new name too, so new and imported transactions from those vendors are categorized automatically, as with "Always categorize this vendor as...". The plain checkbox bar above the list (Set category, Set brand, Life tag) still works for the rows on one page, and its edits can be undone too.`,
  },
  {
    role: 'all',
    title: 'How do I undo a bulk edit?',
    content: `After a bulk edit, Undo last bulk edit appears in the Find similar panel (and under the bulk bar on the Transactions page) with what the edit changed, how many transactions it touched, and when. Click it to put those transactions back as they were. Undo is careful: a transaction is put back only if it still has exactly what the edit gave it. If you changed one of them by hand afterwards, it is left as it is now, and the result says how many were left alone. A transfer the edit unlinked is linked again only when both sides can be; if one side was deleted or linked to something else since, both stay unlinked. Deleted transactions can't be put back. Large edits are undone in steps, with a running count. The last 10 bulk edits are kept, so after undoing the latest you can undo the one before it. Undo needs a database update: until migration 220 has been run, bulk edits still work but the panel says "Run migration 220 first" and they cannot be undone. Learned rules saved with Remember for future imports are not removed by undo; change them on the vendor's saved contact.`,
  },

  // ─── TRAVEL MODULE ────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to log a trip',
    content: `Go to Dashboard → Travel and click Add Trip, or go to the Trip History page and click Add Trip. The unified trip form lets you create simple A-to-B trips or multi-stop routes. By default you see two stops (origin and destination). Click "Add stop" to create a multi-stop route. For each leg you can set mode (car, bike, plane, train, bus, etc.), distance, duration, cost, and optionally select a vehicle. Use the status toggle at the top to mark trips as Planned, In Progress, or Completed. Check "Round trip" to automatically add a return leg. Give the trip a name and tick "Save as reusable template" to log the same trip again later with one tap (see "How to save and reuse a trip template").`,
  },
  {
    role: 'all',
    title: 'How to save and reuse a trip template',
    content: `A trip template is a trip you take often (a commute, a gym run, a weekly errand loop) saved so you can log it again in one tap. To save one, click Add Trip on Dashboard → Travel or Trip History, enter the stops with each leg's mode, miles, minutes and cost, tick Round trip if you come back to the start, give the trip a name, tick "Save as reusable template", and save. The trip is logged and the template is saved from it with the distance and time of every leg, including the return leg Add Trip adds for a round trip. Stops are stored this way: the first stop is where you start, and every later stop holds the leg that arrives there, so a round trip Home → Gym → Home keeps the way there on Gym and the way back on the last Home. To use a template: press the play button (Quick log) on it under My Templates in Trip History, tap it in the Quick Re-log card on the Travel dashboard, or choose it in Add Trip's "Load from template" list to fill the form and change anything before saving. Quick log logs the trip for today: a multi-stop or round-trip template becomes a route with one trip per leg, and a single-leg template becomes one trip. It says what it logged (for example "Logged Gym run: 10.0 mi · 24 min"); if any leg can't be saved, nothing is saved and it says why. Each leg keeps its saved vehicle while that vehicle is still yours or a public transport one; a leg saved with no vehicle, such as a rental car, logs with no vehicle, so its miles never count toward one of yours. A template marked Round trip whose stops don't end at the start gets a return leg with the outbound miles, minutes and cost added together. A single-leg template that ends where it starts (a loop, Home to Home) is the whole trip, so Quick log records it once even with Round trip ticked. Quick log does not create a finance transaction for a leg's cost; to record the expense, use Load from template and save through Add Trip. Template cards and the template list show the total miles and time Quick log will record, a Round trip or Multi-stop label, and how many times you used it. Edit a template with the pencil (stops, each leg's mode, vehicle, miles, minutes and cost, round trip, purpose: commute, leisure, work, errand, exercise or other, category, tax category, brand, notes); a line under the stops shows what Quick log will record. Delete it with the trash can; trips you already logged stay. Round-trip and multi-stop templates saved before October 2026 stored each leg one stop too early and logged too few miles and minutes; if a template's totals look wrong, correct each leg's mode, vehicle, miles and minutes in Edit Template. A leg corrected there before it had a vehicle choice has none; pick the vehicle you drove if its miles should count toward it. Templates saved in Work.WitUS's Add Trip also show here, and for now Work.WitUS still saves them the old way; check their totals and correct the legs in Edit Template.`,
  },
  {
    role: 'all',
    title: 'How to use booking details for flights, hotels, and rentals',
    content: `When adding or editing a trip, each leg has a collapsible "Booking Details" section. Click it to expand fields for: confirmation number, carrier/airline name, flight seat assignment, terminal, and gate (shown for plane mode), hotel/accommodation name and address with room type and check-in/check-out dates, pickup and return addresses with times (for car rentals), loyalty program and member number, and booking URL. These details also appear on the trip detail page and in shared itineraries.`,
  },
  {
    role: 'all',
    title: 'What are public transport vehicles?',
    content: `CentenarianOS includes a built-in public transport library available to all users. When selecting a vehicle for a trip leg, the dropdown is grouped into "Your Vehicles" (your personal cars, bikes, etc.) and "Public Transport" (Commercial Flight, Passenger Train, City Bus, Ferry, Rideshare, Taxi, Subway/Metro, Intercity Bus, Light Rail/Tram). Selecting a public transport vehicle automatically sets the correct trip mode. You can still add your own private vehicles in the Vehicles section of the Travel dashboard.`,
  },
  {
    role: 'all',
    title: 'How to share a trip itinerary',
    content: `On any trip detail page, click the Share button. Set an optional expiration date, pick which sections to include, and click Create share link. The link opens a read-only itinerary showing the route, dates, booking details, and packing notes. Copy it from the Active Shares list and send it yourself: anyone who has the link can view the itinerary without signing in. CentenarianOS does not email the link or limit it to a particular person. To stop sharing, revoke the link from the Active Shares list; revoked and expired links stop working.`,
  },
  {
    role: 'all',
    title: 'How to set a trip budget',
    content: `When creating or editing a trip, the form includes a Budget field where you can set a spending target. The budget appears on the trip detail page alongside actual costs from each leg. For multi-stop routes, each leg's cost contributes to the total. You can also associate trips with a Brand for brand-sponsored travel tracking.`,
  },

  // ─── MEDIA TRACKER ────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'Where did the Media Tracker go?',
    content: `The Media Tracker has moved to Stream.WitUS (stream.witus.online), the WitUS app for tracking books, TV, movies, music, and podcasts. Media is no longer in the CentenarianOS menu, and your existing list is read-only here: you can still open /dashboard/media to browse your items, notes, and podcast episodes, but there are no add, edit, or delete controls. To take your list with you, open /dashboard/media, click "Export my media (CSV)", then open your media page in Stream.WitUS and choose Import CSV. Importing the same file again skips items you already have, so it is safe to retry. The file includes titles, types, status, ratings, dates, genres, tags, links, progress, season and episode numbers, favorites, visibility, and each item's notes field. Categories and entries in an item's Notes section are not included, so copy anything you need from those by hand.`,
  },

  // ─── SOCIAL FEATURES ──────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to like, share, and discover public content',
    content: `Equipment can be set to Public visibility, making it browsable on the Discover page. Visit Discover to browse public equipment collections from other users. Click the heart icon to like, the share icon to share via link or social media, and the bookmark icon to save for later. Like and share counts are visible on public items. Your own likes and bookmarks are accessible from your profile. (Public media lists moved to Stream.WitUS along with the Media Tracker.)`,
  },

  // ─── EQUIPMENT TRACKER ────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to track equipment and gear',
    content: `Go to Dashboard → Equipment to catalog your gear and possessions. Add items with name, category (auto-seeded defaults like Electronics, Sports, Kitchen, etc.), purchase price, and purchase date. Link to the original financial transaction if you tracked the purchase. Track value over time by adding valuations — the detail page shows a value chart. Upload photos, videos, and audio to each item's media gallery. Use the ActivityLinker to connect equipment to workouts, trips, or other activities.`,
  },

  // ─── WORKOUTS & EXERCISES ─────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to use the exercise library and log workouts',
    content: `Go to Dashboard → Exercises to browse 110+ pre-loaded exercises organized by category (Push, Pull, Legs, Core, Cardio, etc.). Each exercise has instructions, form cues, and optional video/audio media. Create custom exercises and categories too. To log a workout, go to Dashboard → Workouts and click Log Workout. Add exercises from the library, set reps, sets, weight, and use advanced fields like RPE, tempo, supersets, circuits, and more. Templates let you save workout structures for quick re-use.`,
  },

  // ─── SMART SCAN ───────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to scan receipts and documents',
    content: `Go to Dashboard → Scan to use the universal document scanner. Upload or photograph a receipt, recipe, fuel receipt, maintenance invoice, or medical document. The AI (Gemini Vision) auto-detects the document type and extracts relevant data: receipt line items with pricing, fuel amounts and odometer readings, recipe ingredients, etc. Scanned receipts track historical prices per vendor and item. Link scanned documents to contacts, financial transactions, and other entities.`,
  },

  // ─── LIFE CATEGORIES ──────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to tag items with Life Categories',
    content: `Life Categories let you tag any item across all modules with life areas like Health, Finance, Career, Relationships, etc. Go to Dashboard → Categories to view the analytics dashboard with spending breakdowns and activity charts. To tag an item, look for the Life areas section on any detail page or edit modal: + Tag opens the category picker showing your life areas; click × on a chip to remove it. A transaction's life area comes from its budget category and shows as "Health · from Groceries"; change the category to change it. Use batch tagging on the Categories dashboard to tag uncategorized items. Create, rename, merge and recolor life areas on Organize categories (/dashboard/categories/organize).`,
  },

  // ─── BLOG & RECIPE SEARCH ─────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to search and filter blog posts and recipes',
    content: `On Dashboard → Blog or Dashboard → Recipes, use the search bar at the top to search by title, description, or tags. Filter by visibility status using the pill buttons: All, Draft, Public, Private (blog only), Members Only (blog only), or Scheduled. Sort by newest, recently edited, or title A-Z. The result count updates as you filter. When editing or creating a post or recipe, click the back arrow in the header to return to the list.`,
  },

  // ─── INVOICES ──────────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to create and manage invoices',
    content: `Go to Dashboard → Finance → Invoices to manage your invoices. Click Create Invoice to start a new one. Select a brand (business entity) from your brands list, enter client details (name, email, address), set issue and due dates, then add line items with description, quantity, and unit price. Optionally set a tax rate. Save as draft, or send directly. Invoices track status: Draft, Sent, Paid, Overdue. When marking an invoice as paid, enter the paid date. You can also create reusable invoice templates from Dashboard → Finance → Invoice Templates.`,
  },

  // ─── FUEL & NCV FRAMEWORK ─────────────────────────────────────────────────

  {
    role: 'all',
    title: 'What is the Fuel module and NCV framework?',
    content: `The Fuel module at Dashboard → Fuel tracks your nutrition using the NCV (Nutrient-to-Calorie Value) framework. NCV scores rate foods as Green (nutrient-dense), Yellow (moderate), or Red (low nutrient density). Build recipes with the ingredient builder, which calculates total macros (calories, protein, carbs, fat, fiber) and NCV score automatically. Import recipes from any URL using the recipe import feature. Track meal prep sessions and manage your ingredient inventory. Each recipe supports servings, prep/cook time, tags, and visibility settings.`,
  },

  // ─── BUDGET FORECASTING ───────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to use budget forecasting',
    content: `Go to Dashboard → Finance → Forecast to view your budget projections. The forecasting tool analyzes your historical income and spending patterns across budget categories to project future balances. It shows estimated monthly spending per category, projected account balances, and highlights categories trending over budget. Use this to plan ahead and adjust spending before the month ends. Forecasting works best with at least 30 days of transaction history and properly categorized expenses.`,
  },

  // ─── WEEKLY REVIEW ────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to do a Weekly Review',
    content: `Go to Dashboard → Weekly Review to reflect on your week. The review pulls in your health metrics, spending totals, workout stats, and task completion rate. Write a free-form reflection covering what went well, what to improve, and your focus for next week. AI-powered review (if enabled) generates insights from your cross-module data. Weekly reviews are stored and searchable — look back at past weeks to spot trends in your habits and progress toward goals.`,
  },

  // ─── GETTING STARTED ──────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'Getting started with CentenarianOS',
    content: `After signing up and choosing a plan, you land on your dashboard. Start by setting your home page in Dashboard → Settings — choose which module you want to see first. The interactive walkthrough guides you through each module on first visit. Key first steps: (1) Add your first task in the Planner by typing a title (it goes to your Inbox), then build a roadmap and goals when you're ready, (2) Add a financial account and a few transactions, (3) Log your first health metrics or import a wearable's CSV export, (4) Try the demo account at /demo to see how a fully populated dashboard looks. Use the Help button (bottom-right) to ask questions anytime.`,
  },

  // ─── SETTINGS & BILLING ───────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to manage settings and billing',
    content: `Go to Dashboard → Settings to configure your preferences: home page, clock format (12h/24h), fiscal year start, social sharing visibility, and scan auto-save. Set up multi-factor authentication (MFA) for account security. Go to Dashboard → Billing to manage your subscription — view your current plan, see payment history, or cancel. Lifetime members never see recurring charges. Dashboard → Settings → Wearables lists the health data sources and their CSV templates: import Garmin, Apple Health, Google Health, InBody and Hume Health exports from there. Direct Garmin sync is marked Coming Soon.`,
  },

  // ─── LINK TRACKING & MARKETING ──────────────────────────────────────────────

  {
    role: 'admin',
    title: 'How short links work in CentenarianOS',
    content: `Every blog post, recipe, and course automatically gets a tracked short link (i.centenarianos.com/...) when published. The Switchy.io API creates the link and stores its ID and URL in the database. Share bars on content pages use the short link when available, so every click is measured. OG metadata (title, description, image) is synced to Switchy whenever you edit published content. If Switchy is down, publishing still works — the short link is simply skipped and can be backfilled later from Admin → Links & Traffic.`,
  },
  {
    role: 'admin',
    title: 'How to backfill short links for existing content',
    content: `Go to Admin → Links & Traffic. The Short Link Management section shows how many blog posts, recipes, and courses have short links vs. missing them. Click the Sync button next to any content type to create missing links, or click Sync All Content at the bottom. Feature pages are also synced. The process runs one link at a time to respect API rate limits. Failed links can be retried by running Sync again — it only targets items that still have no short link.`,
  },
  {
    role: 'admin',
    title: 'Reading the traffic dashboard',
    content: `The Links & Traffic page (Admin → Links & Traffic) shows total page views, unique pages, average views per day, and total short links. Filter by date range, path prefix (Blog, Recipes, Academy, Features, etc.), and user type (exclude admin and demo traffic with checkboxes). The Traffic Over Time chart shows daily view counts. Top Pages lists the most viewed paths. The Referrer Breakdown and UTM Sources sections show where traffic originates. Visitor types (anonymous, real, admin, demo, tutorial) are displayed as percentage bars.`,
  },
  {
    role: 'all',
    title: 'How to share content with tracked links',
    content: `Blog posts, recipes, and courses each have a Share section with Copy Link, Email, LinkedIn, and Facebook buttons. These buttons use tracked short links (i.centenarianos.com/...) so every share click is measured. Clicking Copy Link copies the short URL to your clipboard. Clicking Email opens your email client with the title and link pre-filled. LinkedIn and Facebook buttons open a share dialog in a new tab. If no short link exists yet (e.g. the content was published before link tracking was enabled), the full URL is used as a fallback.`,
  },

  // ─── EQUIPMENT TRACKER ──────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to track equipment and assets',
    content: `Go to Dashboard → Equipment to manage your gear, tools, and possessions. Click Add Equipment to create an item with name, category, purchase date, purchase price, and notes. Categories are auto-seeded on first access and you can create custom ones. Link an equipment item to an existing financial transaction to attribute cost. The hub page shows total value and category breakdown.`,
  },
  {
    role: 'all',
    title: 'How to track equipment valuations',
    content: `On an equipment detail page (/dashboard/equipment/[id]), click Add Valuation to record the current market value. Each valuation creates a timestamped snapshot. A chart shows value over time. The most recent valuation updates the item's current_value field. Use this to track depreciation or appreciation of assets like vehicles, cameras, or musical instruments.`,
  },
  {
    role: 'all',
    title: 'Equipment media gallery',
    content: `Each equipment item has a media gallery where you can upload photos, videos, and audio recordings. Drag items to reorder, rename files, and upload multiple at once. The first gallery item automatically becomes the cover thumbnail shown on the equipment list.`,
  },

  // ─── LIFE CATEGORIES ──────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'What are Life Categories?',
    content: `Life Categories are user-defined life areas (Health, Finance, Career, etc.) that you can apply to any item across all modules — tasks, trips, transactions, workouts, recipes, and more. They help you see how your time and energy are distributed across life areas. They are also the top level of your one category tree: each budget category sits under a life area, and a transaction takes its life area from its budget category. Eight default life areas are auto-seeded, and you can create your own with custom icons and colors.`,
  },
  {
    role: 'all',
    title: 'How to tag items with Life Categories',
    content: `Look for the Life areas section on any item detail page or edit modal. It shows the item's life areas as chips; + Tag opens the same category picker used everywhere, showing life areas only, and × removes a tag you added. On a transaction, the life area that comes from its budget category is marked "from <category>" and has no ×: change the category to change it. You can also batch-tag items from the Categories dashboard (/dashboard/categories) by viewing uncategorized items.`,
  },
  {
    role: 'all',
    title: 'Life Categories analytics dashboard',
    content: `Visit /dashboard/categories to see summary cards for each life area, a Spending by Life Area pie chart, and an activity bar chart showing how many items are in each life area. A transaction counts toward the life area its budget category sits under plus any life area it is tagged with, once each, and transactions count by their date within the 7, 30 or 90 days you choose; other items count by when they were tagged. Transfers between your own accounts never count as spending. The uncategorized items view lets you quickly tag items that haven't been assigned to any life area yet; a transaction whose budget category sits under a life area is already categorized.`,
  },

  // ─── DATA HUB ──────────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'What is the Data Hub?',
    content: `The Data Hub (/dashboard/data) is a centralized import/export center for all modules. It supports 10+ module types: finance, health metrics, trips, fuel, maintenance, vehicles, equipment, contacts, tasks, and workouts. Import from CSV files or Google Sheets. Export to CSV with optional date-range filtering.`,
  },
  {
    role: 'all',
    title: 'How to import data via CSV',
    content: `Go to Dashboard → Data Hub and click Import on the module card you want. Download the CSV template to see the expected columns and example data. Fill in your data, then choose the CSV file, or switch to the Google Sheets tab and paste the link of a sheet that is published to the web. The importer validates rows and shows a preview before committing. Health Metrics and Workouts add a Check rows step that shows what is new and what is already there before Import turns on (see "What happens if I import the same fitness data twice?"). Finance works differently: its Import button opens the bank statement import, where you choose an account, confirm the columns, and review every row before anything is saved (see "How to import a bank statement (CSV)"). Bulk imports do NOT auto-create linked finance transactions.`,
  },
  {
    role: 'all',
    title: 'Where imported planner tasks go (CSV and Google Calendar)',
    content: `Every task belongs to a milestone, so imported tasks are filed for you. In a Tasks CSV (Data Hub → Tasks → Import), rows that name a roadmap, goal, and milestone go there, and any level that doesn't exist yet is created: a new roadmap without dates starts today and runs 10 years, a new goal needs goal_category and goal_target_year, and a new milestone needs milestone_target_date. CSV rows without those columns go to an "Imported Tasks" milestone. Google Calendar imports (Data Hub → Import .ics) and Google Calendar sync (Settings → Calendar Sync) go to a "Google Calendar: <calendar name>" milestone. Those milestones are created under the first active goal of your oldest roadmap (an "Imported" goal is added if that roadmap has none), and later imports reuse them. Roadmaps the app creates for you, Inbox and Work.WitUS Sync (the ones with an "Auto" badge), are never used for this. If you have no roadmap of your own yet, the tasks go to your Inbox instead; the import result says so, and the planner's Inbox (N) filter lists them for sorting into goals. The planner's Calendar filter shows tasks in "Google Calendar:" milestones, so calendar events filed in the Inbox show under Inbox until you move them. All-day calendar events are scheduled at 09:00.`,
  },
  {
    role: 'all',
    title: 'How to connect Google Calendar',
    content: `Go to Dashboard → Operate → Calendar Sync (/dashboard/settings/calendar) and press Connect Google Calendar. Google asks you to choose an account and approve read-only access; leave the calendar permission ticked, and you are sent back to CentenarianOS. The connection is one-way, Google to CentenarianOS: CentenarianOS can only read your calendars and never creates, changes, or deletes anything in Google Calendar. You can connect more than one Google account, for example a personal and a business account: press "Connect another Google account" and pick the other account on Google's screen. Each account gets its own card with its own list of calendars. Tick the calendars you want to sync; every calendar starts switched off, and "Refresh list from Google" reloads an account's list after you add or remove a calendar in Google. What gets synced: each event on a ticked calendar becomes a planner task in a milestone called "Google Calendar: <calendar name>" (in your Inbox if you have no roadmap of your own yet). The first sync of a calendar reads 30 days back and 180 days ahead; after that only changes are read. All-day events are scheduled at 09:00, and times use the event's own time zone. When an event moves in Google, its task moves; when an event is cancelled or deleted, its task is archived, never deleted. Tasks you complete stay completed, and a synced task you delete is not brought back. Tagged events also create a record, linked to their task: #expense and #income a transaction (in a finance account ticked on that Google account's card under "Accounts for #expense and #income"; see "Recording calendar expenses into several accounts"), #meal a meal log, and #workout a workout log. #trip events stay tasks: the trip details are saved and will go to RideWitUS. A record follows later changes to its event (a new amount, a new date) until you edit the record in CentenarianOS; after that the sync leaves it alone. When an event is cancelled, its transaction is never deleted, and a meal or workout log is removed only if you had not changed it. Whatever the sync leaves for you to check appears under "Needs a look" on the Calendar Sync page, with links to the task and the record; press Done once you have looked. To write titles CentenarianOS can read, use the event builder (Calendar Sync → Event builder). When it syncs: automatically once a day, and whenever you press Sync now on an account (or Sync all to sync every account). Each card shows when the account last synced, how many tasks and records the last run created, how many tasks it updated and archived, how many items were flagged (a tag with missing data, such as #expense without an amount), and any errors. If an account says "Needs reconnecting", Google has stopped accepting its saved authorization, for example because access was removed in your Google Account; the page checks this each time you open it. Press Reconnect on that account and approve again; its calendar choices are kept. To stop syncing an account, press Disconnect on it and confirm: CentenarianOS asks Google to remove its access, then deletes that account's saved connection and calendar choices. Your other accounts and the tasks already created stay. Nothing in Google Calendar changes. If the page says Google Calendar is not available on this site yet, the site owner has not finished the Google setup; you can still bring events in with the one-time file import (Data Hub → Import .ics). Each switched-on calendar also has a "Share with RideWitUS" switch, off by default; see "Sharing calendar activities with RideWitUS".`,
  },
  {
    role: 'all',
    title: 'Sharing calendar activities with RideWitUS',
    content: `RideWitUS, the WitUS travel app, can suggest the trips to and from your calendar activities (work, workouts, appointments, classes) so you do not have to log them from memory. It never connects to Google itself: CentenarianOS already reads your calendars, so it sends RideWitUS the events it needs, only from calendars you choose. How to turn it on: go to Dashboard → Operate → Calendar Sync (/dashboard/settings/calendar). Under each switched-on calendar there are two switches. "Share with RideWitUS" is off for every calendar until you switch it on, so a personal calendar and a work calendar can be treated differently. "Hide titles" (only when sharing is on) sends the word "Event" instead of the event title. What happens next: when you switch sharing on, that calendar's events with a location from the past 14 days and the next 30 days are sent straight away; after that, every sync (daily, or Sync now) sends the events that were added, changed, moved or cancelled. Put the place in the event's Location field: an event without a location is never sent, because there is nothing to travel to, and that includes all-day events. A #trip tag in the title is sent too, as the trip's distance, mode and duration. Changing "Hide titles" resends the calendar's events with the new titles. When you switch sharing off, CentenarianOS tells RideWitUS to drop that calendar's events, and RideWitUS removes the trip suggestions it made from them; trips you already confirmed in RideWitUS stay there, because they are your travel record. If you remove the location from an event in Google, the next sync tells RideWitUS to drop it as well. RideWitUS knows it is you through your WitUS account: sign in to CentenarianOS with WitUS once, or nothing can be matched and nothing is sent. If the switches are greyed out with "not available on this site yet", the site owner has not finished the setup.`,
  },
  {
    role: 'all',
    title: 'What CentenarianOS sends to RideWitUS, and what it never sends (calendar privacy)',
    content: `Only events from calendars where you switched on "Share with RideWitUS" (Calendar Sync), and only those that have a location and start within the past 14 days or the next 30 days. For each such event RideWitUS gets: the start and end time with its time zone, whether it is all-day, the location exactly as you typed it in Google, the calendar's name as it appears in your list, the title without its #tags (or the word "Event" when "Hide titles" is on), whether the event is confirmed or cancelled, the details of a #trip tag (distance, mode, duration), and your WitUS account id so RideWitUS can match it to you. Each event is identified by a code made from CentenarianOS's own record, not by Google's id. Never sent: the event description, attendees, meeting links, Google's event or calendar ids, your Google account email, events without a location, events outside the 14-day and 30-day window, and anything from a calendar you do not share. Nothing is ever written to your Google Calendar. When you stop sharing a calendar, RideWitUS receives only "no longer active" for that calendar's events, with no details, and removes its suggestions from them. Your home location in RideWitUS is set there and is never sent to CentenarianOS. Every message to RideWitUS is signed, so RideWitUS can check it came from CentenarianOS and was not changed on the way.`,
  },
  {
    role: 'all',
    title: 'Recording calendar expenses into several accounts',
    content: `Each connected Google account can record #expense and #income events into as many of your finance accounts as you like. Go to Dashboard → Operate → Calendar Sync (/dashboard/settings/calendar). On each Google account's card, "Accounts for #expense and #income" lists all your active finance accounts, grouped by type (checking, savings, credit cards, cash, loans), with the institution, last four digits and currency. Tick the ones calendar events may use, and mark one of them Default: the first account you tick becomes the default, and you can move it with the Default button next to any ticked account. Choosing the account in a title: a title without an account uses the default ("Lunch Chipotle #expense $12.40"). To use another ticked account, add @ and its last four digits ("Lunch Chipotle #expense $12.40 @1234"), or the account's nickname ("Dinner #expense $40 @visa"). Nicknames are set on the account itself: Finance → Accounts (/dashboard/finance/accounts), Add Account or Edit, field "Nickname". A nickname starts with a letter and has up to 20 letters, digits, - or _, and no two of your active accounts can share one (capital letters do not matter). Account pickers across Finance show it next to the last four digits, and each ticked account on the Calendar Sync card shows the @ word to use. Give a nickname when two ticked accounts end in the same four digits, or when an account has no last four digits. If the Nickname field says to run migration 218 first, the site owner has not applied that database update yet; until then, titles name accounts by their last four digits only. The amount is read in the chosen account's currency. Never a guess: if the @account is not ticked for that Google account, matches no account, matches two ticked accounts, or the title has two different @accounts, no transaction is created and the event is listed under "Needs a look" with the reason; fix the title or the ticks and the transaction is created on the next sync. Right after a meal word, @word is still read as the vendor ("Dinner @Nobu #expense $90"), unless it is four digits. Changing the @account on an event moves its transaction to the new account on the next sync, as long as you have not edited the transaction in CentenarianOS; if you have, the transaction is left alone and flagged. Unticking the default leaves no default until you pick one; until then a title without @ is saved with no account. If you had chosen one account before this change, it stays ticked and stays the default. The event builder (Calendar Sync → Event builder) has an Account picker that lists only the ticked accounts and adds the @ part for you.`,
  },
  // ─── Calendar event titles (event builder, templates) ──────────────────────
  {
    role: 'all',
    title: 'How to write calendar events CentenarianOS can read',
    content: `Add a #tag and a few details to a Google Calendar event's title, and the Calendar Sync reads them when the event syncs (Dashboard → Operate → Calendar Sync). The tags are #expense, #income, #trip, #meal, #workout and #task, and the Spanish #gasto, #ingreso, #viaje, #comida, #entreno (or #ejercicio) and #tarea; both languages always work, whatever your language setting. What each kind needs: an expense or income needs an amount ("Groceries Corner Market #expense $42.18"; write the $ so no other number is mistaken for it; 12.40 and 12,40 also work). A trip needs a distance in miles or kilometers ("To the trailhead #trip 7.8mi", "Al parque #viaje 12.5km"); kilometers are converted to miles and stored rounded to 0.1 mi. Add mode:bike, mode:car, mode:bus, mode:train, mode:plane, mode:walk, mode:run, mode:ferry, mode:rideshare or mode:other for the mode, or let a word in the title such as Drive, bici or Uber name it. A meal reads Breakfast, Lunch, Dinner or Snack (Desayuno, Almuerzo, Cena, Merienda) from the title ("Lunch Corner Cafe #meal"); without one, the start time decides (05:00-10:29 breakfast, 10:30-14:29 lunch, 17:00-21:29 dinner, otherwise snack). Any tagged title can carry a duration such as 45min, 1h or 1h 30min. A title without a tag is a plain task. What happens when an event syncs: every synced event becomes a planner task named after the title without its tags, and the details are saved with the synced event. A tagged title also creates a record linked to the task: #expense and #income a transaction in the default account ticked in Calendar Sync, or in the ticked account named by @ and its last four digits or nickname ("Lunch Chipotle #expense $12.40 @1234"), #meal a meal log, #workout a workout log. #trip creates no trip: the trip details are saved and will go to RideWitUS. A title with missing details (an #expense with no amount, a #trip with no distance), two kind tags, two different @accounts, or a #word CentenarianOS does not know is flagged: only the task is created, its description says what to check, and it is listed under Needs a look. Fix the title in Google Calendar and the record is created on the next sync. Put the place in the event's Location field, not in the title: it is added to the task's description, and it is what RideWitUS uses. For a calendar you share with RideWitUS (Calendar Sync, off by default), events with a location are sent so RideWitUS can suggest trips to and from them; events without a location are never sent. See "Sharing calendar activities with RideWitUS". The easiest way to get a title right is the event builder (Calendar Sync → Event builder, /dashboard/settings/calendar/event-builder): pick a kind, fill in the fields, and it shows the exact title and what CentenarianOS will read from it, with any warnings. Copy the title, or press Open in Google Calendar to open Google's new-event form already filled in (title, date, time and location); check which calendar it saves to, because only calendars switched on in Calendar Sync are read.`,
  },
  {
    role: 'all',
    title: 'Calendar event cheat sheet and example events',
    content: `The calendar event cheat sheet is one printable page of copy-paste titles in English and Spanish, plus every word the sync reads: open it from the event builder (Calendar Sync → Event builder → Printable cheat sheet, /dashboard/settings/calendar/event-builder/cheat-sheet) and press Print, or download it as a Markdown file (/templates/calendar-event-cheat-sheet.md). Copy-paste titles: "Groceries Corner Market #expense $42.18" (Spanish "Compras Mercado Central #gasto $42.18"); "Client payment Acme Studio #income $1500.00" ("Pago de cliente Acme Studio #ingreso $1500.00"); "To the trailhead #trip 7.8mi mode:bike" ("Al parque #viaje 12.5km mode:bici"); "Lunch Corner Cafe #meal" ("Almuerzo Café de la Esquina #comida"); "Strength session #workout 45min" ("Sesión de fuerza #entreno 45min"); "Call the plumber #task" ("Llamar al plomero #tarea"). To record an expense or income into a ticked account other than the default, add @ and its last four digits or nickname: "Lunch Chipotle #expense $12.40 @1234". To try the sync safely, press Download examples (.ics) in the event builder. The file holds each example in English and Spanish, dated in the coming week, with titles starting "Example:". Import it into a separate test calendar, not your main one: in Google Calendar on a computer, create a new calendar, then open Settings → Import & export, choose the file and pick the test calendar. Switch the test calendar on in Calendar Sync and press Sync now: each example becomes a planner task, and the expense, income, meal and workout examples also create their records (the expense and income go to that Google account's default account, so delete them afterwards); the trip example stays a task. Delete the test calendar when you are done. The examples have to fall inside the window the first sync reads (30 days back to 180 days ahead), which is why the builder dates them from the coming Monday; a fixed copy dated the week of 4 January 2027 is at /templates/calendar-event-examples.ics.`,
  },
  {
    role: 'all',
    title: 'How to export data to CSV',
    content: `Go to Dashboard → Data Hub and click Export on any module card. Set optional date range filters (from/to) and click Download CSV. The export includes all fields for the module. You can use exported CSVs for backup, analysis in Excel or Google Sheets, or migrating to another system.`,
  },

  // ─── EXERCISE LIBRARY ──────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to use the Exercise Library',
    content: `The Exercise Library (/dashboard/exercises) is your personal catalog of exercises. Each exercise has a name, category, instructions, form cues, muscle groups, default sets/reps/weight, and optional media (video URL, image, audio). Use the ExercisePicker in workout forms to quickly select exercises. Categories are auto-seeded with 10 defaults (Push, Pull, Legs, Core, Cardio, etc.) and can be customized.`,
  },
  {
    role: 'all',
    title: 'How to link exercises to equipment',
    content: `Exercises can be linked to equipment items via the equipment junction table. On an exercise detail page, select which equipment is needed (barbell, dumbbell, resistance band, etc.). When you pick an exercise in a workout template, you can also specify which specific equipment item from your Equipment Tracker to use.`,
  },
  {
    role: 'all',
    title: 'Advanced workout fields explained',
    content: `Workout templates and logs support advanced fields: RPE (Rate of Perceived Exertion, 1-10), Tempo (e.g. 3-1-2-0 for eccentric-pause-concentric-pause seconds), Superset Groups (group exercises together), boolean flags (Circuit, Negatives, Isometric, To Failure, Balance, Unilateral), and Distance in miles. These fields are optional and appear in the Advanced section of each exercise row.`,
  },

  // ─── NOMAD LONGEVITY OS ────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'What is the Nomad Longevity OS?',
    content: `The Nomad Longevity OS (/dashboard/workouts/nomad) is a collection of pre-built workout protocols designed for travelers and home exercisers. It includes AM (morning), PM (evening), Hotel (bodyweight), and Gym (full equipment) workout categories. The Friction Protocol helps you start with minimal commitment — just 2 minutes — and build momentum.`,
  },
  {
    role: 'all',
    title: 'Post-workout feedback system',
    content: `After completing a workout (from Nomad OS or any workout log), you are prompted to rate your workout. The WorkoutFeedbackModal asks for mood before/after (1-5), perceived difficulty, instruction preference, and optional written feedback. This data helps track how workouts affect your mental state over time.`,
  },

  // ─── ACTIVITY LINKS ───────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to link activities across modules',
    content: `Activity Links let you connect items across different modules — for example, linking a trip to a transaction, a workout to an equipment item, or a task to a recipe. Use the ActivityLinker component on any item detail page. Search for items by type and name, then click to create a bidirectional link. Linked items appear as pills that navigate to the connected item.`,
  },
  {
    role: 'all',
    title: 'What types of items can be linked?',
    content: `Activity links support 11 entity types: task, trip, route, transaction, recipe, fuel_log, maintenance, invoice, workout, equipment, and focus_session. Links are bidirectional — linking A→B automatically creates B→A. Use the ActivityLinker component or the /api/activity-links endpoint to manage links.`,
  },

  // ─── CONTACTS & LOCATIONS ──────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to manage saved contacts',
    content: `Contacts (/dashboard/contacts or via the ContactAutocomplete component) let you save vendors, customers, and locations. Each contact has a name, type, optional default category, and notes. When you type a vendor name in a finance transaction, the autocomplete suggests saved contacts. Selecting a contact with a default_category_id auto-fills the transaction category. The same default category is the vendor's learned category, set by answering "Always" to the categorize prompt.`,
  },
  {
    role: 'all',
    title: 'How do I make a vendor always get the same category?',
    content: `When you pick or change a transaction's category, CentenarianOS asks, right on the page: "Always categorize 'CHIPOTLE' as Dining?" with two buttons. Always makes that the vendor's learned category: new transactions from that vendor that arrive without a category get it automatically, whether you add them by hand, scan a receipt, or import a CSV. Just this once changes nothing else. After Always, you can apply the category to the vendor's past transactions; the prompt shows how many there are (and how many have no category) before anything changes, and you can update all of them or only the uncategorized ones. The prompt appears after Add Transaction, after editing a transaction's category in the transaction list, and after a bulk category change when every selected transaction is from the same vendor. It doesn't appear when the vendor already has that category. Vendor names are matched ignoring capitalization, store numbers, and punctuation, so "CHIPOTLE #1234" and "Chipotle" count as the same vendor. Expenses use your saved vendors and income uses your saved customers. The learned category is stored as the vendor contact's default category, so you can change or clear it by editing the contact. A category you choose yourself always wins over a learned one.`,
  },
  {
    role: 'all',
    title: 'How to add locations to contacts',
    content: `Each contact can have multiple sub-locations with address, latitude/longitude, label, and notes. On a contact detail page, click Add Location. Set one location as the default — it will be pre-selected when you choose that contact in trip origins/destinations. Locations are sortable by drag order.`,
  },

  // ─── CORRELATIONS & ANALYTICS ─────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to use the Correlations module',
    content: `The Correlations module (/dashboard/correlations) finds statistical relationships between data from different modules. For example, it can show whether sleep hours correlate with next-day focus ratings, or whether exercise frequency correlates with mood. Select two metrics from the dropdowns, set a date range, and view the scatter plot with a trend line and correlation coefficient.`,
  },
  {
    role: 'all',
    title: 'Cross-module analytics dashboard',
    content: `The Analytics page (/dashboard/analytics) shows aggregated daily and weekly views across all modules. See how many tasks you completed, miles you traveled, calories you logged, and workouts you did — all in one place. Charts show trends over time and help you spot patterns across your entire lifestyle.`,
  },

  // ─── BLOG PUBLISHING ──────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to publish a blog post',
    content: `Go to Dashboard → Blog and click New Post. Write your content using the rich text editor. Add a cover image, excerpt, and tags. Set visibility to Public to make it discoverable on /blog, or Private to keep it in your dashboard only. Click Publish to go live. Your post gets a public URL at /blog/[username]/[slug] and a tracked short link for sharing.`,
  },
  {
    role: 'all',
    title: 'Blog sharing and engagement',
    content: `Published blog posts show like and save buttons for logged-in readers. The share bar includes Copy Link (tracked short URL), Email, LinkedIn, and Facebook buttons. Your public author profile at /profiles/[username] lists all your published posts. Reading progress events are tracked so you can see how many people read to the end.`,
  },

  // ─── RECIPE PUBLISHING ─────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to create and publish a recipe',
    content: `Go to Dashboard → Recipes and click Create Recipe. Add a title, description, cover image, prep/cook time, servings, and ingredients using the ingredient builder. Write instructions in the text area. Set visibility to Public to list it on /recipes. Published recipes appear on your cook profile at /recipes/cooks/[username]/[slug].`,
  },
  {
    role: 'all',
    title: 'How to import a recipe from a URL',
    content: `On the recipe creation page, paste a URL from any recipe website and click Import. CentenarianOS scrapes the page for schema.org/Recipe JSON-LD structured data and auto-fills the title, description, ingredients, instructions, prep/cook times, and servings. Review and edit the imported data, then save. The source_url is stored for reference.`,
  },

  // ─── MEDIA LIBRARY ────────────────────────────────────────────────────────

  {
    role: 'all',
    title: 'How to add podcast links',
    content: `Podcast episodes can store multi-platform links (Spotify, Apple Podcasts, YouTube, etc.) in a JSONB field. When viewing a podcast entry, click the platform icons to open the episode on that service. Teachers can also add podcast links to course lessons for supplementary listening.`,
  },

  // ─── ONE CATEGORY TREE (migration 223) ─────────────────────────────────────

  {
    role: 'all',
    title: 'One set of categories: life areas and budget categories',
    content: `CentenarianOS has one category tree. Life areas (your life categories, such as Health, Home, Travel, Career) are the top level, and budget categories (Groceries, Rent, Gas...) sit under them, so Groceries can live under Health. Budgets stay on the budget categories. A transaction gets its life area from its budget category automatically: pick Groceries and it counts toward Health too, with no second tag to add. Tasks, trips, workouts and other items that have no budget meaning are still tagged with a life area directly. Every place you choose a category (adding or editing a transaction, the bulk bar, the statement import review, budgets, recurring payments, invoices, cash) uses the same picker, which lists life areas with their budget categories under them. Budget categories that are not placed yet appear under "No life area" until you organize them on Organize categories (/dashboard/categories/organize). This needs a database update (migration 223); until it is applied the two lists work as before and the Organize screen says "Run migration 223 first".`,
  },
  {
    role: 'all',
    title: 'How to organize categories (put budget categories under life areas)',
    content: `Go to Dashboard → Categories and click Organize categories (or the link in the Finance dashboard's category window or on Budgets). At the top, "Needs a life area" lists budget categories that have no life area yet. For each one: click "Use Health" (a suggestion from the category's name, such as Groceries → Health or Gas → Travel), pick a life area from its list, or drag it onto a life area card. Nothing is placed until you choose; "Use all suggestions" accepts every suggestion at once. Each life area card lists its budget categories; drag one to another card or change its list to move it, and its transactions move with it (their life area follows). Add a budget category under a life area with the box at the bottom of its card, and add a new life area at the bottom of the page. The pencil button on a budget category or life area lets you rename, merge or delete it.`,
  },
  {
    role: 'all',
    title: 'How a transaction gets its life area',
    content: `A transaction's life area is the life area its budget category sits under. If Groceries is under Health, every Groceries transaction counts toward Health on the Categories dashboard, including transactions categorized before you placed Groceries there. When you save a transaction with a category (by hand, in bulk, from a statement import, a receipt scan, the calendar or the AI coach), the app also adds that life area as a tag marked "from Groceries", so it shows on the transaction. If you change the category, that automatic tag moves to the new category's life area. Tags you added yourself are never removed by the app: a transaction can still have extra life areas, such as Travel on a grocery run during a trip. Tagging a life area by hand that the app had already added makes it yours, so it stays even if the category changes later. A transaction counts once per life area, never twice for the same one.`,
  },
  {
    role: 'all',
    title: 'Using the category picker',
    content: `The category picker shows life areas as headings with their budget categories under them, and "No life area" for budget categories not placed yet. Click it (or press the down arrow) and type to search: typing a life area's name shows all of its budget categories, typing part of a category's name shows the matches under their life area, and accents and capitals don't matter. Use the up and down arrows to move, Enter to pick, Escape to close. If nothing matches, "Add “…”" creates a new budget category and asks which life area it goes under. On the Transactions bulk bar the picker also offers each life area on its own ("life area only"), which tags the selected transactions with that life area without changing their budget category. On tasks, trips, workouts and other items it lists life areas only.`,
  },
  {
    role: 'all',
    title: 'How to merge or delete categories',
    content: `On Organize categories, click the pencil next to a budget category or life area. Merge into moves everything to the other one and then deletes the first. Merging budget categories moves its transactions, recurring payments, invoices and invoice templates, vendors' default (learned) categories, cash counts, insurance premiums and schedule pay settings; the category you keep keeps its own budgets by month, and the merged category's month-by-month budgets are dropped. Merging life areas moves its budget categories and every tag to the other life area. Delete removes the category without moving anything: a deleted budget category's transactions become uncategorized (and lose the life area that came from it), and a deleted life area's budget categories go back to "Needs a life area" and its tags are removed. Merge instead of delete when you want to keep the history together.`,
  },
];
