#!/usr/bin/env bash
set -euo pipefail
[[ ${1:-} = --apply ]] || { echo '用法：sudo bash rollback.sh --apply'; exit 1; }
base=/opt/qiulegeqiu-api
current=$(readlink -f "$base/current")
[[ "$current" = "$base/releases/"* && -f "$current/previous-index.html" ]]
if [[ ! -f "$current/PREVIOUS" ]]; then
  systemctl stop qiulegeqiu-api
  install -m 644 "$current/previous-index.html" /var/www/qiulegeqiu/.index.html.rollback
  mv -f /var/www/qiulegeqiu/.index.html.rollback /var/www/qiulegeqiu/index.html
  echo '首次上线已恢复旧HTML并停止本排行榜API；数据库与静态资源保留。'
  exit 0
fi
previous=$(cat "$current/PREVIOUS")
[[ "$previous" = "$base/releases/"* && -f "$previous/server/build/index.js" ]]
"$base/node/bin/node" --input-type=module - "$current/deploy/leaderboard-contract.mjs" "$current/RULES_VERSION" "$previous/RULES_VERSION" <<'JS'
import {readFileSync,existsSync} from 'node:fs';import {pathToFileURL} from 'node:url';const {verifyRollbackCompatibility}=await import(pathToFileURL(process.argv[2]));verifyRollbackCompatibility(readFileSync(process.argv[3],'utf8'),existsSync(process.argv[4])?readFileSync(process.argv[4],'utf8'):undefined);
JS
ln -s "$previous" "$base/current.rollback"
mv -Tf "$base/current.rollback" "$base/current"
systemctl restart qiulegeqiu-api
curl --fail --max-time 3 --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:8091/api/health
install -m 644 "$current/previous-index.html" /var/www/qiulegeqiu/.index.html.rollback
mv -f /var/www/qiulegeqiu/.index.html.rollback /var/www/qiulegeqiu/index.html
printf '已恢复上一API与HTML；保留全部资源和数据库，未触及其他服务。\n'
