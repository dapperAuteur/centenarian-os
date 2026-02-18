'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { isAdmin } from '@/lib/blog/admin';
import MarkdownImporter from '@/components/blog/MarkdownImporter';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ImportPostPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin(user.email)) {
      router.replace('/dashboard/blog');
    } else {
      setChecked(true);
    }
  }, [user, loading, router]);

  if (!checked) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/dashboard/blog"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Import from Markdown</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste markdown content to import it as a blog post. Admin only.
        </p>
      </div>

      <MarkdownImporter />
    </div>
  );
}
