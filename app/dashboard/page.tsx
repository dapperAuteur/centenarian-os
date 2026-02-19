// app/dashboard/page.tsx
// /dashboard has no content of its own — redirect to the blog dashboard (free for all users)

import { redirect } from 'next/navigation';

export default function DashboardIndexPage() {
  redirect('/dashboard/blog');
}
