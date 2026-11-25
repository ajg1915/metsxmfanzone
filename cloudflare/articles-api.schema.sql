-- D1 database "metsxm-articles": the home of every MetsXMFanZone article since Nov 2026.
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT,
  excerpt TEXT,
  featured_image_url TEXT,
  audio_url TEXT,
  category TEXT,
  tags TEXT NOT NULL DEFAULT '[]',            -- JSON array of strings
  published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,                          -- ISO 8601 UTC
  created_at TEXT NOT NULL,
  updated_at TEXT,
  scheduled_publish_at TEXT,
  is_draft INTEGER NOT NULL DEFAULT 0,
  approval_status TEXT,                       -- pending | approved | rejected | NULL
  meta_description TEXT,
  saved_via TEXT NOT NULL DEFAULT 'supabase-copy',
  synced_to_supabase INTEGER NOT NULL DEFAULT 1,
  mirrored_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS blog_posts_created_idx ON blog_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_pub_idx ON blog_posts(published, published_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_user_idx ON blog_posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_sched_idx ON blog_posts(scheduled_publish_at) WHERE published = 0;

-- Every article deleted from the admin is kept here so a wrong tap can be undone.
CREATE TABLE IF NOT EXISTS deleted_blog_posts (
  id TEXT PRIMARY KEY,
  deleted_at TEXT NOT NULL,
  deleted_by TEXT,
  row_json TEXT NOT NULL
);
