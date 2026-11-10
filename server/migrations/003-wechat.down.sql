-- Execute ONLY via rollbackWechatEmpty / manage rollback-wechat-empty. Not sqlite3 .read.
-- Optional empty-only reversal. Recommended rollback: old API + KEEP additive tables/data.
-- This refuses to drop any populated WeChat table. Never delete players, scores or sessions.
BEGIN IMMEDIATE;
CREATE TEMP TABLE rollback_wechat_guard(n INTEGER CHECK(n=0));
INSERT INTO rollback_wechat_guard SELECT
 (SELECT COUNT(*) FROM wechat_sessions)+(SELECT COUNT(*) FROM wechat_identities)+
 (SELECT COUNT(*) FROM wechat_login_codes)+(SELECT COUNT(*) FROM account_link_tickets);
DROP TABLE account_link_tickets;
DROP TABLE wechat_login_codes;
DROP TABLE wechat_sessions;
DROP TABLE wechat_identities;
DELETE FROM schema_migrations WHERE version=3;
DROP TABLE rollback_wechat_guard;
COMMIT;
