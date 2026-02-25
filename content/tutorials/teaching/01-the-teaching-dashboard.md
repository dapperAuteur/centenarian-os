# Lesson 01: The Teaching Dashboard

**Course:** Teaching on CentenarianOS
**Module:** Getting Started
**Duration:** ~3 min
**Lesson type:** text / video
**is_free_preview:** true
**CYOA navigation:** cyoa

---

## Narrator Script

The Teaching Dashboard is your home base as a teacher on CentenarianOS. This lesson covers the overview page and the navigation sidebar so you know where everything lives before diving into course creation.

---

### Accessing the Teaching Dashboard

Navigate to `/dashboard/teaching`. This page is only visible to accounts with the Teacher or Admin role. The sidebar on the left shows seven sections — this is your primary navigation for everything in your teacher workflow.

---

### The Sidebar

The seven sections in the teaching sidebar:

| Section | Route | Purpose |
|---------|-------|---------|
| **Overview** | `/dashboard/teaching` | Stats, recent courses, quick links |
| **Courses** | `/dashboard/teaching/courses` | All your courses — manage, publish, edit |
| **Students** | `/dashboard/teaching/students` | Roster of all enrolled students across courses |
| **Messages** | `/dashboard/teaching/messages` | Inbox for student messages |
| **Live Sessions** | `/dashboard/teaching/live` | Coming soon — will support live streaming |
| **Promo Codes** | `/dashboard/teaching/promo-codes` | Discount codes for student checkout |
| **Payouts** | `/dashboard/teaching/payouts` | Stripe Connect setup and payout status |

---

### The Overview Page

The main overview page has three areas:

**Stats row (three cards):**
- **Total Courses** — how many courses you've created (published + draft)
- **Published** — how many are live and visible to students
- **Enrollments** — total enrollments across all your courses

**Quick Links:**
Three shortcut buttons below the stats — Learning Paths, Students, and Live Sessions — for direct navigation.

**Recent Courses:**
A list of up to five of your most recently created courses. Each row shows:
- Course title
- Price: "Free" or "$X · one-time" or "$X · subscription"
- Status: **Published** (green badge) or **Draft** (gray badge)

---

### The Stripe Connect Banner

If you haven't completed Stripe onboarding, a yellow banner appears at the top of the overview page:

> "Connect your bank account — Complete Stripe onboarding to receive course payments."

The banner has a **Set Up Payouts** button that links to `/dashboard/teaching/payouts`. You can still create courses and publish them before completing onboarding, but students won't be able to enroll in paid courses until your Stripe account is active.

---

### Starting a New Course

The **New Course** button (fuchsia, top right of the overview and courses pages) opens the course creation form. Courses are covered in detail in the next two lessons.

---

## Screen Recording Notes

> [SCREEN: Navigate to /dashboard/teaching — show the overview page]

> [SCREENSHOT: Teaching dashboard — callouts: Sidebar (7 sections), Stats cards (Total Courses, Published, Enrollments), Quick Links row, Recent Courses list]

> [SCREEN: Point to each sidebar item — narrate its purpose]

> [SCREEN: Show the Stripe Connect banner (if visible) — point to Set Up Payouts]

> [SCREENSHOT: Overview page — callout: Stripe banner + "Set Up Payouts" button (if applicable)]

> [SCREEN: Click "New Course" — show the form (don't fill it out — that's the next lesson)]

> [SCREEN: End on the overview — end lesson]

---

## Key Takeaways

- Teaching Dashboard at /dashboard/teaching — Teacher and Admin roles only
- Sidebar has 7 sections: Overview, Courses, Students, Messages, Live, Promo Codes, Payouts
- Overview stats: Total Courses, Published count, Enrollments
- Stripe Connect banner appears until you complete payout onboarding — required for paid course enrollments
- "New Course" button (top right) is available from Overview and Courses pages
