'use client';

// app/dashboard/teaching/courses/[id]/page.tsx
// Course editor — tabbed wizard layout.

import { useParams } from 'next/navigation';
import CourseEditorLayout from '@/components/academy/course-editor/CourseEditorLayout';

export default function CourseEditorPage() {
  const { id: courseId } = useParams<{ id: string }>();
  return <CourseEditorLayout courseId={courseId} />;
}
