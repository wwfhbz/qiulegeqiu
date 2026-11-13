-- Additive audit only; no score, identity, rule or existing nickname is rewritten.
CREATE TABLE nickname_changes(id INTEGER PRIMARY KEY,player_id TEXT NOT NULL REFERENCES players(id),changed_at INTEGER NOT NULL);
CREATE INDEX nickname_changes_player_time ON nickname_changes(player_id,changed_at);
