#!/usr/bin/env bash
# Production mutation entry point. Requires a separate, explicit deployment approval.
set -euo pipefail
umask 077
[[ ${1:-} = --apply && -n ${2:-} ]] || { echo '用法：sudo bash publish.sh --apply 已核验的解压目录'; exit 1; }
[[ $EUID = 0 ]]
source_dir=$(realpath "$2")
site=/var/www/qiulegeqiu
base=/opt/qiulegeqiu-api
runtime="$base/node/bin"
db=/var/lib/qiulegeqiu/leaderboard.sqlite
[[ -f "$source_dir/dist/index.html" && -d "$source_dir/dist/assets" && -f "$source_dir/server/build/index.js" && -f "$source_dir/RULES_VERSION" ]]
[[ -z $(find "$source_dir" -type l -print -quit) ]]
[[ $(realpath "$site") = "$site" && -d "$site" && ! -L "$base" && $(realpath "$base") = "$base" ]]
[[ -z $(find "$site" -type l -print -quit) && ! -L /var/lib/qiulegeqiu && ! -L "$db" ]]
[[ -f /etc/systemd/system/qiulegeqiu-api.service && ! -L /etc/systemd/system/qiulegeqiu-api.service && ! -L /etc/qiulegeqiu-api.env && -x "$runtime/node" ]]
[[ $("$runtime/node" --version) = v24.19.0 ]]
"$runtime/node" "$source_dir/deploy/check-production-env.mjs"
exec 9>/run/lock/qiulegeqiu-rollout.lock
flock -n 9 || { echo '本项目另一次发布尚未结束';exit 1; }
if [[ ! -f "$db" ]]; then
 legacy=$(find /home/ubuntu/qiulegeqiu -maxdepth 5 -type f \( -name '*.sqlite' -o -name '*.db' \) -not -path '*/node_modules/*' -print -quit)
 [[ -z "$legacy" ]] || { echo '发现旧数据库，先确认迁移源；不创建空榜覆盖旧数据';exit 1; }
 if systemctl is-active --quiet qiulegeqiu-api; then echo '旧API正在运行但标准路径无数据库，需核对旧数据路径';exit 1;fi
fi
service_uid=$(id -u qiulegeqiu)
[[ $(stat -c %u /var/lib/qiulegeqiu) = "$service_uid" && $(stat -c %u /var/backups/qiulegeqiu) = "$service_uid" ]]
if [[ -f "$db" ]];then [[ $(stat -c %u "$db") = "$service_uid" ]] || { echo '旧数据库属主不同，先单独备份并审核权限迁移';exit 1; };fi
release_id=$(date -u +%Y%m%dT%H%M%SZ)-$$
release="$base/releases/$release_id"
previous=''
if [[ -e "$base/current" ]];then [[ -L "$base/current" ]];previous=$(readlink -f "$base/current");[[ "$previous" = "$base/releases/"* && -f "$previous/server/build/index.js" ]];fi
install -d -m 755 "$release"
cp -r "$source_dir/server" "$source_dir/deploy" "$release/"
cp "$source_dir/VERSION" "$source_dir/RULES_VERSION" "$release/"
find "$release" -type d -exec chmod 755 {} +
find "$release" -type f -exec chmod 644 {} +
[[ -z "$previous" ]] || printf '%s\n' "$previous" > "$release/PREVIOUS"
cp "$site/index.html" "$release/previous-index.html"
# Online snapshot is mandatory BEFORE dependency installation, migration, symlink or service changes.
if [[ -f "$db" ]];then
 runuser -u qiulegeqiu -- /usr/bin/flock --exclusive /var/lib/qiulegeqiu/.maintenance.lock "$runtime/node" "$release/deploy/backup.mjs" | tee "$release/predeploy-backup.json"
else
 printf '{"event":"first_install_no_database","existingDatabaseBackedUp":false}\n' > "$release/predeploy-backup.json"
fi
(cd "$release/server" && env PATH="$runtime:$PATH" "$runtime/npm" ci --omit=dev --ignore-scripts --cache "$release/.npm-cache")
install -d -m 755 "$site/assets"
cp -r "$source_dir/dist/assets/." "$site/assets/"
find "$site/assets" -type d -exec chmod 755 {} +
find "$site/assets" -type f -exec chmod 644 {} +
switched=0
html_switched=0
on_failure(){
 local status=$?
 trap - ERR
 echo '发布失败。只回退本API代码/HTML，不恢复或覆盖数据库。' >&2
 if [[ "$switched" = 1 ]];then
  if [[ -n "$previous" ]];then ln -s "$previous" "$base/current.failed-$$";mv -Tf "$base/current.failed-$$" "$base/current";systemctl restart qiulegeqiu-api || true
  else systemctl stop qiulegeqiu-api || true;fi
 fi
 if [[ "$html_switched" = 1 ]];then install -m 644 "$release/previous-index.html" "$site/.index.html.failed-$$";mv -f "$site/.index.html.failed-$$" "$site/index.html";fi
 exit "$status"
}
trap on_failure ERR
ln -s "$release" "$base/current.new-$$"
mv -Tf "$base/current.new-$$" "$base/current"
switched=1
systemctl restart qiulegeqiu-api
curl --fail --max-time 3 --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:8091/api/health > "$release/health.json"
"$runtime/node" --input-type=module - "$release/health.json" "$release/RULES_VERSION" <<'JS'
import {readFileSync} from 'node:fs';const data=JSON.parse(readFileSync(process.argv[2],'utf8'));if(!data.ok||data.database!=='ready'||data.rulesVersion!==readFileSync(process.argv[3],'utf8').trim())throw Error('API与前端规则版本或数据库检查不一致');
JS
main_pid=$(systemctl show qiulegeqiu-api -p MainPID --value)
listeners=$(ss -H -lntp '( sport = :8091 )')
[[ "$main_pid" -gt 0 && "$listeners" = *"127.0.0.1:8091"* && "$listeners" = *"pid=$main_pid,"* ]]
[[ "$listeners" != *"0.0.0.0:8091"* && "$listeners" != *"[::]:8091"* && "$listeners" != *"*:8091"* ]]
install -m 644 "$source_dir/dist/index.html" "$site/.index.html.new-$$"
mv -f "$site/.index.html.new-$$" "$site/index.html"
html_switched=1
trap - ERR
printf '发布完成：%s；数据库保留；尚需执行已审核的Nginx配置与上线验收。\n' "$release"
