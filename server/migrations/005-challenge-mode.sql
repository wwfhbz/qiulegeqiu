-- Additive only: preserve all identities, scores, rule versions and per-rule audit pointers.
ALTER TABLE challenges ADD COLUMN mode TEXT NOT NULL DEFAULT 'campaign' CHECK(mode IN ('campaign','endless'));
UPDATE challenges SET mode='endless' WHERE rules_version LIKE 'endless-%';
CREATE INDEX challenges_mode ON challenges(mode,id);
-- Compatibility for older binaries writing the same DB without the new mode column.
CREATE TRIGGER challenges_legacy_endless_mode AFTER INSERT ON challenges
WHEN NEW.mode='campaign' AND NEW.rules_version LIKE 'endless-%'
BEGIN
 UPDATE challenges SET mode='endless' WHERE id=NEW.id;
END;
