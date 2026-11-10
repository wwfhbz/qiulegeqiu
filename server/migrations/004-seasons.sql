-- New rules get a separate best-score pointer. No existing score or legacy pointer is rewritten.
CREATE TABLE IF NOT EXISTS season_player_bests(
 rules_version TEXT NOT NULL,
 player_id TEXT NOT NULL REFERENCES players(id),
 score_id TEXT NOT NULL UNIQUE REFERENCES scores(id),
 PRIMARY KEY(rules_version,player_id)
);
