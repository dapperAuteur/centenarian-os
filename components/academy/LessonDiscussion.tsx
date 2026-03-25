'use client';

// components/academy/LessonDiscussion.tsx
// Threaded discussion section for lessons.
// Shows top-level posts with inline replies, compose box, pin badges, teacher badges.

import { useEffect, useState } from 'react';
import { MessageSquare, Pin, Send, Reply, Trash2, Edit2, Shield, Loader2 } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface Author {
  display_name: string;
  avatar_url: string | null;
}

interface DiscussionPost {
  id: string;
  lesson_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  is_pinned: boolean;
  is_teacher: boolean;
  created_at: string;
  updated_at: string;
  author: Author;
  replies: DiscussionPost[];
}

interface LessonDiscussionProps {
  courseId: string;
  lessonId: string;
  currentUserId: string | null;
  isTeacher: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function LessonDiscussion({ courseId, lessonId, currentUserId, isTeacher }: LessonDiscussionProps) {
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBody, setNewBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const apiBase = `/api/academy/courses/${courseId}/lessons/${lessonId}/discussions`;

  useEffect(() => {
    setLoading(true);
    offlineFetch(apiBase)
      .then((r) => r.json())
      .then((d) => setPosts(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiBase]);

  async function submitPost() {
    if (!newBody.trim() || submitting) return;
    setSubmitting(true);
    try {
      const r = await offlineFetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newBody.trim() }),
      });
      if (r.ok) {
        const post = await r.json();
        setPosts((prev) => [...prev, post]);
        setNewBody('');
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  }

  async function submitReply(parentId: string) {
    if (!replyBody.trim() || submitting) return;
    setSubmitting(true);
    try {
      const r = await offlineFetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyBody.trim(), parent_id: parentId }),
      });
      if (r.ok) {
        const reply = await r.json();
        setPosts((prev) => prev.map((p) =>
          p.id === parentId ? { ...p, replies: [...p.replies, reply] } : p,
        ));
        setReplyBody('');
        setReplyTo(null);
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  }

  async function saveEdit(postId: string, parentId: string | null) {
    if (!editBody.trim() || submitting) return;
    setSubmitting(true);
    try {
      const r = await offlineFetch(`${apiBase}/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editBody.trim() }),
      });
      if (r.ok) {
        const updated = await r.json();
        if (parentId) {
          setPosts((prev) => prev.map((p) =>
            p.id === parentId
              ? { ...p, replies: p.replies.map((r) => r.id === postId ? { ...r, body: updated.body, updated_at: updated.updated_at } : r) }
              : p,
          ));
        } else {
          setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, body: updated.body, updated_at: updated.updated_at } : p));
        }
        setEditingId(null);
        setEditBody('');
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  }

  async function deletePost(postId: string, parentId: string | null) {
    try {
      const r = await offlineFetch(`${apiBase}/${postId}`, { method: 'DELETE' });
      if (r.ok) {
        if (parentId) {
          setPosts((prev) => prev.map((p) =>
            p.id === parentId ? { ...p, replies: p.replies.filter((r) => r.id !== postId) } : p,
          ));
        } else {
          setPosts((prev) => prev.filter((p) => p.id !== postId));
        }
      }
    } catch { /* ignore */ }
  }

  async function togglePin(postId: string, currentlyPinned: boolean) {
    try {
      const r = await offlineFetch(`${apiBase}/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !currentlyPinned }),
      });
      if (r.ok) {
        setPosts((prev) => {
          const updated = prev.map((p) => p.id === postId ? { ...p, is_pinned: !currentlyPinned } : p);
          // Re-sort: pinned first
          return updated.sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
        });
      }
    } catch { /* ignore */ }
  }

  function renderPost(post: DiscussionPost, isReply = false) {
    const isAuthor = currentUserId === post.user_id;
    const canEdit = isAuthor;
    const canDelete = isAuthor || isTeacher;
    const initial = (post.author.display_name || '?')[0].toUpperCase();

    return (
      <div key={post.id} className={`${isReply ? 'ml-8 sm:ml-12' : ''}`}>
        <div className={`flex gap-3 py-3 ${post.is_pinned && !isReply ? 'bg-fuchsia-950/20 -mx-3 px-3 rounded-lg' : ''}`}>
          {/* Avatar */}
          {post.author.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={post.author.avatar_url} alt="" className="w-8 h-8 rounded-full shrink-0 object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">
              {initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white">{post.author.display_name || 'Anonymous'}</span>
              {post.is_teacher && (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-fuchsia-400 bg-fuchsia-900/30 px-1.5 py-0.5 rounded">
                  <Shield className="w-2.5 h-2.5" aria-hidden="true" /> Instructor
                </span>
              )}
              {post.is_pinned && !isReply && (
                <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                  <Pin className="w-2.5 h-2.5" aria-hidden="true" /> Pinned
                </span>
              )}
              <span className="text-xs text-gray-400">{timeAgo(post.created_at)}</span>
              {post.updated_at !== post.created_at && (
                <span className="text-xs text-gray-400">(edited)</span>
              )}
            </div>

            {editingId === post.id ? (
              <div className="mt-1.5 space-y-2">
                <textarea
                  autoFocus
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-fuchsia-500 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(post.id, post.parent_id)}
                    disabled={submitting}
                    className="px-3 py-1.5 bg-fuchsia-600 text-white rounded-lg text-xs font-semibold hover:bg-fuchsia-700 transition disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setEditBody(''); }}
                    className="px-3 py-1.5 bg-gray-800 text-gray-400 rounded-lg text-xs hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-300 mt-0.5 whitespace-pre-wrap break-words">{post.body}</p>
            )}

            {/* Actions */}
            {editingId !== post.id && currentUserId && (
              <div className="flex items-center gap-3 mt-1.5">
                {!isReply && (
                  <button
                    onClick={() => { setReplyTo(replyTo === post.id ? null : post.id); setReplyBody(''); }}
                    className="flex items-center gap-1 min-h-11 text-xs text-gray-400 hover:text-fuchsia-400 transition"
                    aria-label="Reply to post"
                  >
                    <Reply className="w-3 h-3" aria-hidden="true" /> Reply
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => { setEditingId(post.id); setEditBody(post.body); }}
                    className="flex items-center gap-1 min-h-11 text-xs text-gray-400 hover:text-blue-400 transition"
                    aria-label="Edit post"
                  >
                    <Edit2 className="w-3 h-3" aria-hidden="true" /> Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => deletePost(post.id, post.parent_id)}
                    className="flex items-center gap-1 min-h-11 text-xs text-gray-400 hover:text-red-400 transition"
                    aria-label="Delete post"
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" /> Delete
                  </button>
                )}
                {isTeacher && !isReply && (
                  <button
                    onClick={() => togglePin(post.id, post.is_pinned)}
                    className={`flex items-center gap-1 min-h-11 text-xs transition ${post.is_pinned ? 'text-amber-400 hover:text-amber-300' : 'text-gray-400 hover:text-amber-400'}`}
                    aria-label={post.is_pinned ? 'Unpin post' : 'Pin post'}
                  >
                    <Pin className="w-3 h-3" aria-hidden="true" /> {post.is_pinned ? 'Unpin' : 'Pin'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Inline reply compose */}
        {replyTo === post.id && (
          <div className="ml-8 sm:ml-12 mb-2">
            <div className="flex gap-2">
              <textarea
                autoFocus
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(post.id); } }}
                placeholder="Write a reply…"
                rows={2}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-fuchsia-500 resize-none"
              />
              <button
                onClick={() => submitReply(post.id)}
                disabled={submitting || !replyBody.trim()}
                className="min-h-11 min-w-11 flex items-center justify-center bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition disabled:opacity-50 self-end"
                aria-label="Send reply"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Replies */}
        {post.replies?.map((reply) => renderPost({ ...reply, replies: [] }, true))}
      </div>
    );
  }

  const postCount = posts.reduce((acc, p) => acc + 1 + (p.replies?.length ?? 0), 0);

  return (
    <div className="border border-gray-800 rounded-xl sm:rounded-2xl bg-gray-900 p-4 sm:p-6">
      <h2 className="text-base font-bold mb-4 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-fuchsia-400" aria-hidden="true" />
        Discussion
        {postCount > 0 && <span className="text-xs text-gray-400 font-normal">({postCount})</span>}
      </h2>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      ) : (
        <>
          {/* Compose new post */}
          {currentUserId && (
            <div className="flex gap-2 mb-4">
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitPost(); } }}
                placeholder="Join the discussion…"
                rows={2}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-fuchsia-500 resize-none"
              />
              <button
                onClick={submitPost}
                disabled={submitting || !newBody.trim()}
                className="min-h-11 min-w-11 flex items-center justify-center bg-fuchsia-600 text-white rounded-xl hover:bg-fuchsia-700 transition disabled:opacity-50 self-end"
                aria-label="Send post"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {posts.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">No discussion yet. Be the first to post!</p>
          ) : (
            <div className="divide-y divide-gray-800" role="list" aria-label="Discussion posts">
              {posts.map((post) => renderPost(post))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
