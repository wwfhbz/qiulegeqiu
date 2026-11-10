#!/usr/bin/env bash
set -euo pipefail
[[ ${1:-} = --apply && ${2:-} = /var/backups/qiulegeqiu/*.sqlite ]] || { echo '用法：sudo bash restore.sh --apply /var/backups/qiulegeqiu/备份.sqlite'; exit 1; }
backup=$(realpath "$2")
[[ "$backup" = /var/backups/qiulegeqiu/*.sqlite && -f "$backup" && ! -L "$2" ]]
node --input-type=module - "$backup" <<'JS'
import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(process.argv[2],{readOnly:true});
if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw Error('备份校验未通过');db.close();
JS
node "$(dirname "$0")/backup.mjs"
systemctl stop qiulegeqiu-api
db=/var/lib/qiulegeqiu/leaderboard.sqlite
stamp=$(date -u +%Y%m%dT%H%M%SZ)
for suffix in '' -wal -shm; do if [[ -f "$db$suffix" ]]; then mv "$db$suffix" "$db$suffix.retired-$stamp"; fi; done
install -o qiulegeqiu -g qiulegeqiu -m 600 "$backup" "$db"
systemctl start qiulegeqiu-api
curl --fail --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:8091/api/health
