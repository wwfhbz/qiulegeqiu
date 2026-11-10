#!/usr/bin/env bash
set -euo pipefail
[[ ${1:-} = --apply && ${3:-} = --confirm-overwrite && ${2:-} = /var/backups/qiulegeqiu/*.sqlite ]] || { echo '用法：sudo bash restore.sh --apply /var/backups/qiulegeqiu/备份.sqlite --confirm-overwrite'; exit 1; }
exec 9>/run/lock/qiulegeqiu-rollout.lock
flock -n 9
[[ ! -L /var/lib/qiulegeqiu/.maintenance.lock ]]
if [[ ! -e /var/lib/qiulegeqiu/.maintenance.lock ]];then runuser -u qiulegeqiu -- bash -c 'umask 077; touch /var/lib/qiulegeqiu/.maintenance.lock';fi
exec 8>/var/lib/qiulegeqiu/.maintenance.lock
flock -x 8
backup=$(realpath "$2")
[[ "$backup" = /var/backups/qiulegeqiu/*.sqlite && -f "$backup" && ! -L "$2" ]]
/opt/qiulegeqiu-api/node/bin/node --input-type=module - "$backup" <<'JS'
import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(process.argv[2],{readOnly:true});
if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw Error('备份校验未通过');for(const table of ['players','scores','sessions','schema_migrations'])if(!db.prepare('SELECT 1 FROM sqlite_master WHERE type=\'table\' AND name=?').get(table))throw Error('不是本排行榜数据库');db.close();
JS
prepared=/var/lib/qiulegeqiu/.restore-prepared-$$.sqlite
install -o qiulegeqiu -g qiulegeqiu -m 600 "$backup" "$prepared"
/opt/qiulegeqiu-api/node/bin/node "$(dirname "$0")/backup.mjs"
systemctl stop qiulegeqiu-api
db=/var/lib/qiulegeqiu/leaderboard.sqlite
stamp=$(date -u +%Y%m%dT%H%M%SZ)
for suffix in '' -wal -shm; do if [[ -f "$db$suffix" ]]; then mv "$db$suffix" "$db$suffix.retired-$stamp"; fi; done
mv "$prepared" "$db"
systemctl start qiulegeqiu-api
curl --fail --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:8091/api/health
