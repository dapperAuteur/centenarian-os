-- Admin education chat persistence
-- Stores chat sessions and messages so admin can resume and search past conversations

CREATE TABLE admin_chats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode        TEXT NOT NULL DEFAULT 'general',
  title       TEXT NOT NULL DEFAULT 'New Chat',
  tags        TEXT[] NOT NULL DEFAULT '{}',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     UUID NOT NULL REFERENCES admin_chats(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'model')),
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_chats_user ON admin_chats(user_id);
CREATE INDEX idx_admin_chats_updated ON admin_chats(updated_at DESC);
CREATE INDEX idx_admin_chats_tags ON admin_chats USING GIN (tags);

-- Full-text search on chat title + notes
ALTER TABLE admin_chats ADD COLUMN chat_search_vector TSVECTOR
  GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || notes)) STORED;
CREATE INDEX idx_admin_chats_search ON admin_chats USING GIN (chat_search_vector);
CREATE INDEX idx_admin_chat_messages_chat ON admin_chat_messages(chat_id, created_at);

-- Full-text search on message content
ALTER TABLE admin_chat_messages ADD COLUMN search_vector TSVECTOR
  GENERATED ALWAYS AS (to_tsvector('english', text)) STORED;
CREATE INDEX idx_admin_chat_messages_search ON admin_chat_messages USING GIN (search_vector);

-- RLS — admin only via service role key (bypasses RLS), but add policies for safety
ALTER TABLE admin_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_chats_owner" ON admin_chats
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "admin_chat_messages_owner" ON admin_chat_messages
  FOR ALL USING (chat_id IN (SELECT id FROM admin_chats WHERE user_id = auth.uid()));
