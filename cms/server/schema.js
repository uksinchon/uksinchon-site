export const TRASH_SCHEMA=`CREATE TABLE IF NOT EXISTS cms_post_trash (post_id TEXT PRIMARY KEY REFERENCES cms_posts(id), trashed_by TEXT NOT NULL REFERENCES cms_users(id), trashed_at TEXT NOT NULL, published_revision INTEGER)`;
export const SCHEMA = [
`CREATE TABLE IF NOT EXISTS cms_bootstrap (id INTEGER PRIMARY KEY CHECK(id=1), created_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS cms_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','author')), password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS cms_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES cms_users(id), expires_at TEXT NOT NULL)`,
`CREATE INDEX IF NOT EXISTS cms_sessions_user ON cms_sessions(user_id)`,
`CREATE TABLE IF NOT EXISTS cms_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS cms_posts (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL REFERENCES cms_users(id), status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','published')), revision INTEGER NOT NULL, published_revision INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT, save_token TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS cms_versions (post_id TEXT NOT NULL REFERENCES cms_posts(id), revision INTEGER NOT NULL, snapshot TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES cms_users(id), created_at TEXT NOT NULL, PRIMARY KEY(post_id,revision))`,
`CREATE TABLE IF NOT EXISTS cms_media (id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES cms_posts(id), owner_id TEXT NOT NULL REFERENCES cms_users(id), mime TEXT NOT NULL, data BLOB NOT NULL, bytes INTEGER NOT NULL, created_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS cms_public_media (post_id TEXT NOT NULL REFERENCES cms_posts(id), media_id TEXT NOT NULL REFERENCES cms_media(id), PRIMARY KEY(post_id,media_id))`,
`CREATE INDEX IF NOT EXISTS cms_public_media_image ON cms_public_media(media_id)`,
`CREATE TABLE IF NOT EXISTS cms_events (id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES cms_posts(id), actor_id TEXT NOT NULL REFERENCES cms_users(id), action TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL)`,
TRASH_SCHEMA
];
