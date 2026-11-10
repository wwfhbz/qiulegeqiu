-- Additive only: preserve all web players, sessions, challenges and scores.
CREATE TABLE IF NOT EXISTS wechat_identities(
 id TEXT PRIMARY KEY, app_id TEXT NOT NULL, openid_hash TEXT NOT NULL,
 player_id TEXT REFERENCES players(id), created_at INTEGER NOT NULL,
 UNIQUE(app_id,openid_hash), UNIQUE(app_id,player_id)
);
CREATE TABLE IF NOT EXISTS wechat_sessions(
 session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
 identity_id TEXT NOT NULL REFERENCES wechat_identities(id)
);
CREATE TABLE IF NOT EXISTS wechat_login_codes(code_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS account_link_tickets(
 token_hash TEXT PRIMARY KEY,player_id TEXT NOT NULL REFERENCES players(id),
 session_id TEXT NOT NULL REFERENCES sessions(id),expires_at INTEGER NOT NULL,used_at INTEGER
);
CREATE INDEX IF NOT EXISTS wechat_sessions_identity ON wechat_sessions(identity_id);
CREATE INDEX IF NOT EXISTS wechat_codes_expiry ON wechat_login_codes(expires_at);
