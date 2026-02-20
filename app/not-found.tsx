// app/not-found.tsx
// Custom 404 page shown for any unmatched route

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Number */}
        <p className="text-8xl font-bold text-gray-200 select-none">404</p>

        {/* Message */}
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-3 text-gray-500 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard/blog"
            className="w-full sm:w-auto flex items-center justify-center px-5 py-2.5 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 transition"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/blog"
            className="w-full sm:w-auto flex items-center justify-center px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            Browse Blog
          </Link>
          <Link
            href="/recipes"
            className="w-full sm:w-auto flex items-center justify-center px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
          >
            Browse Recipes
          </Link>
        </div>
      </div>
    </div>
  );
}
