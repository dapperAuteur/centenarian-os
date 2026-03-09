# CentenarianOS — Code Style & Quality Guidelines

## Dark Theme Contrast Rules

This project uses dark-themed pages (`bg-neutral-950`, `bg-neutral-900`) for the contractor (JobHub) and lister (CrewOps) products. All text, icons, and interactive elements on these backgrounds **must** meet WCAG 2.1 AA contrast requirements (4.5:1 for normal text, 3:1 for large text and UI components).

### Allowed text colors on dark backgrounds (bg-neutral-950 / bg-neutral-900):
- `text-neutral-100` — primary text (headings, body)
- `text-neutral-200` — strong secondary text
- `text-neutral-300` — secondary text, form labels
- `text-neutral-400` — tertiary text, descriptions, placeholders
- `text-neutral-500` — minimum for any visible text (footers, counters, timestamps, icons)

### NEVER use on dark backgrounds:
- `text-neutral-600` — fails contrast on bg-neutral-900/950
- `text-neutral-700`, `text-neutral-800`, `text-neutral-900` — invisible
- `text-gray-*` variants (designed for light backgrounds)

### Border colors on dark backgrounds:
- Use `border-neutral-700` or `border-neutral-800` — never `border-gray-*`

### Accent colors by product:
- **Contractor (JobHub):** `amber` — buttons: `bg-amber-600 hover:bg-amber-500`, text: `text-amber-400`, focus: `focus:ring-amber-500`
- **Lister (CrewOps):** `indigo` — buttons: `bg-indigo-600 hover:bg-indigo-500`, text: `text-indigo-400`, focus: `focus:ring-indigo-500`
- **Main CentOS:** `sky` for actions, `fuchsia` for branding

### Form inputs on dark backgrounds:
```
border-neutral-700 bg-neutral-800 text-neutral-100 focus:ring-{accent}-500
```
Never use `border-gray-300` or `bg-white` on dark-themed pages.

---

## Mobile-First & Touch Targets

- All interactive elements (buttons, links acting as buttons, icon buttons) must have a **minimum touch target of 44x44px** (`min-h-11 min-w-11`)
- Use `min-h-11` on all `<button>` and `<Link>` elements that act as buttons
- Icon-only buttons: `min-h-11 min-w-11 flex items-center justify-center`
- Stack buttons vertically on mobile, horizontally on desktop: `flex flex-col sm:flex-row`
- Keep primary action buttons within thumb reach (bottom of viewport on mobile)

---

## ARIA & Accessibility

- Every `<button>` without visible text must have `aria-label`
- Decorative icons: `aria-hidden="true"`
- Loading states: `aria-label="Loading..."` or `role="status"` with screen-reader text
- Lists of items: `role="list"` on container when semantic `<ul>` is not used
- Form inputs: always pair with `<label>` using `htmlFor`/`id`
- Error messages: `role="alert"` on error containers
- Expandable menus: `aria-expanded` on toggle buttons

---

## Subdomain-Aware Pages

Login, signup, and public pages must detect the subdomain via `useAppMode()` hook and render product-appropriate branding:
- Contractor subdomain: JobHub logo (HardHat icon), amber accent, dark theme
- Lister subdomain: CrewOps logo (Users icon), indigo accent, dark theme
- Main domain: CentenarianOS branding, light theme

Post-login redirects must respect the subdomain:
- Contractor → `/dashboard/contractor`
- Lister → `/dashboard/contractor/lister`
- Main → `/dashboard/planner`

---

## General Code Patterns

- Use `.maybeSingle()` not `.single()` for Supabase queries that may return no rows
- Service role client (`SUPABASE_SERVICE_ROLE_KEY`) for API routes bypassing RLS
- Tailwind v4: `shrink-0` not `flex-shrink-0`, `bg-linear-to-b` not `bg-gradient-to-b`
- Never use `text-neutral-600` or darker on dark backgrounds — this is the single most common contrast bug
