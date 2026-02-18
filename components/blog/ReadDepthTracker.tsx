'use client';

import { useEffect, useRef } from 'react';

interface ReadDepthTrackerProps {
  postId: string;
}

function getSessionId(): string {
  const key = 'blog_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

async function logEvent(postId: string, eventType: string) {
  try {
    await fetch('/api/blog/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId,
        eventType,
        sessionId: getSessionId(),
        referrer: document.referrer || null,
      }),
    });
  } catch {
    // Non-critical — swallow errors
  }
}

/**
 * Fires engagement events for this post:
 * - 'view' on mount (once per session)
 * - 'read_25', 'read_50', 'read_75', 'read_100' as user scrolls into each sentinel
 *
 * Sentinel elements are placed at 25/50/75/100% of the article's height
 * by the parent page. This component observes them.
 */
export default function ReadDepthTracker({ postId }: ReadDepthTrackerProps) {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const sessionKey = `blog_viewed_${postId}`;
    if (!sessionStorage.getItem(sessionKey)) {
      logEvent(postId, 'view');
      sessionStorage.setItem(sessionKey, '1');
    }
  }, [postId]);

  useEffect(() => {
    const sentinels = document.querySelectorAll<HTMLElement>('[data-read-depth]');
    if (!sentinels.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const depth = (entry.target as HTMLElement).dataset.readDepth;
          if (!depth || firedRef.current.has(depth)) return;
          firedRef.current.add(depth);
          logEvent(postId, `read_${depth}`);
        });
      },
      { threshold: 0.1 }
    );

    sentinels.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [postId]);

  return null;
}
