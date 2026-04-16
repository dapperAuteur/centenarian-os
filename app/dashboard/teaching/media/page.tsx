'use client';

// app/dashboard/teaching/media/page.tsx
// Teacher media library page. All state + logic lives inside MediaLibrary;
// this page is just the mount point.

import MediaLibrary from '@/components/academy/media-library/MediaLibrary';

export default function MediaLibraryPage() {
  return <MediaLibrary />;
}
