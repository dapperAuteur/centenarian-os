interface CourseShareUrls {
  courseUrl: string;
  email: string;
  linkedin: string;
  facebook: string;
}

/**
 * Builds share URLs for a course.
 * Uses the Switchy short link when available, falling back to the full URL.
 */
export function buildCourseShareUrls(
  course: { id: string; title: string; short_link_url?: string | null },
): CourseShareUrls {
  const raw = process.env.NEXT_PUBLIC_APP_URL || '';
  const base = raw ? `https://${raw.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : '';
  const fullUrl = `${base}/academy/${course.id}`;
  const courseUrl = course.short_link_url ?? fullUrl;

  return {
    courseUrl,
    email: `mailto:?subject=${encodeURIComponent(course.title)}&body=${encodeURIComponent(courseUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(courseUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(courseUrl)}`,
  };
}
