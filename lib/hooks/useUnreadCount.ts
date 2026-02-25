'use client';

import { useState, useEffect, useCallback } from 'react';

export function useUnreadCount(): number {
  const [unread, setUnread] = useState(0);
  const fetch_ = useCallback(() => {
    fetch('/api/messages?count=true')
      .then((r) => r.json())
      .then((d) => setUnread(d.unread ?? 0))
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetch_();
    const interval = setInterval(fetch_, 60_000);
    return () => clearInterval(interval);
  }, [fetch_]);
  return unread;
}
