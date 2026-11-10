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
ln -s "$previous" "$base/current.rollback"
mv -Tf "$base/current.rollback" "$base/current"
systemctl restart qiulegeqiu-api
curl --fail --max-time 3 --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:8091/api/health
install -m 644 "$current/previous-index.html" /var/www/qiulegeqiu/.index.html.rollback
mv -f /var/www/qiulegeqiu/.index.html.rollback /var/www/qiulegeqiu/index.html
printf '已恢复上一API与HTML；保留全部资源和数据库，未触及其他服务。\n'
