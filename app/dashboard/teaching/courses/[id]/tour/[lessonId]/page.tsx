'use client';

// app/dashboard/teaching/courses/[id]/tour/[lessonId]/page.tsx
// Full-screen scene editor for a virtual_tour lesson. Fetches the existing
// tour via GET, lets the teacher add/edit/delete scenes, hotspots, and
// scene links, and persists changes via PUT. Lives outside the tabbed
// CourseEditorLayout because the editor needs the full viewport for the
// PSV preview.

import { useParams } from 'next/navigation';
import TourEditor from '@/components/academy/tour-editor/TourEditor';

export default function TourEditorPage() {
  const { id: courseId, lessonId } = useParams<{ id: string; lessonId: string }>();
  return <TourEditor courseId={courseId} lessonId={lessonId} />;
}
