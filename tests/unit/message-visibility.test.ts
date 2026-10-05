// tests/unit/message-visibility.test.ts
// Run: npm run test:unit
//
// Which admin messages (and threads) a user may see (lib/messages/visibility.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSeeAdminMessage, escapeHtml, visibleReply } from '../../lib/messages/visibility.ts';

const ME = '11111111-1111-4111-8111-111111111111';
const THEM = '22222222-2222-4222-8222-222222222222';
const viewer = { id: ME, status: 'monthly', createdAt: '2026-06-01T00:00:00Z' };

test('direct messages: only the addressee', () => {
  assert.equal(canSeeAdminMessage({ recipient_scope: 'user', recipient_user_id: ME }, viewer), true);
  assert.equal(canSeeAdminMessage({ recipient_scope: 'user', recipient_user_id: THEM }, viewer), false);
  assert.equal(canSeeAdminMessage({ recipient_scope: 'user', recipient_user_id: null }, viewer), false);
});

test('broadcasts: everyone or the viewer\'s status, sent after they joined', () => {
  assert.equal(canSeeAdminMessage({ recipient_scope: 'all', created_at: '2026-07-01T00:00:00Z' }, viewer), true);
  assert.equal(canSeeAdminMessage({ recipient_scope: 'monthly', created_at: '2026-07-01T00:00:00Z' }, viewer), true);
  assert.equal(canSeeAdminMessage({ recipient_scope: 'lifetime', created_at: '2026-07-01T00:00:00Z' }, viewer), false);
  assert.equal(canSeeAdminMessage({ recipient_scope: 'all', created_at: '2026-01-01T00:00:00Z' }, viewer), false);
  assert.equal(canSeeAdminMessage({ recipient_scope: 'free' }, { ...viewer, status: null }), true);
});

test('nothing for a missing message, an unknown scope or no viewer', () => {
  assert.equal(canSeeAdminMessage(null, viewer), false);
  assert.equal(canSeeAdminMessage({ recipient_scope: null }, viewer), false);
  assert.equal(canSeeAdminMessage({ recipient_scope: 'all' }, { ...viewer, id: '' }), false);
});

test('replies: the admin\'s and the viewer\'s own, not other users\'', () => {
  assert.equal(visibleReply({ is_admin: true, sender_id: THEM }, ME), true);
  assert.equal(visibleReply({ is_admin: false, sender_id: ME }, ME), true);
  assert.equal(visibleReply({ is_admin: false, sender_id: THEM }, ME), false);
  assert.equal(visibleReply({ is_admin: false, sender_id: null }, ''), false);
});

test('escapeHtml', () => {
  assert.equal(escapeHtml(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
});
