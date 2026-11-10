#!/usr/bin/env bash
# Only this game's resources are in scope. No SSH, Git writes, firewall or Docker commands.
set -Eeuo pipefail
umask 077
say(){ printf '【首次部署】%s\n' "$*"; }
fail(){ say "$*" >&2; exit 1; }
mode=dry-run
archive=/home/ubuntu/qiulegeqiu/work/qiulegeqiu-release.tar.gz
sha='';commit='';site=''
while (($#)); do
 case "$1" in
 --apply) mode=apply;shift;;
 --dry-run) mode=dry-run;shift;;
 --package|--sha256|--commit|--site-file)
  (($#>=2)) || fail '参数缺少值'
  case "$1" in --package) archive=$2;; --sha256) sha=$2;; --commit) commit=$2;; --site-file) site=$2;; esac;shift 2;;
 *) fail '参数：--dry-run 或 --apply，--package 路径 --sha256 审核哈希 --commit 审核提交 --site-file HTTPS站点文件';;
 esac
done
scripts=$(cd "$(dirname "$0")" && pwd)
repo=$(git -C "$scripts" rev-parse --show-toplevel)
[[ -n "$sha" && -n "$commit" && -n "$site" ]] || fail '必须提供外部审核的SHA256、完整提交SHA及准确HTTPS站点文件；不猜测站点'
for cmd in python3 node git nginx systemctl curl ss runuser flock tar sha256sum; do command -v "$cmd" >/dev/null || fail "缺少工具：$cmd"; done
say '先执行只读检查；尚未修改生产资源'
python3 "$scripts/release-integrity.py" --package "$archive" --sha256 "$sha" --commit "$commit" --repo "$repo"
[[ $EUID = 0 ]] || fail '需使用sudo读取受保护的配置；dry-run仍不修改生产资源'
[[ $(uname -m) = x86_64 ]] || fail '本安装流程只审核了x86_64服务器'
site=$(realpath -e "$site")
case "$site" in /etc/nginx/sites-available/*|/etc/nginx/conf.d/*) ;; *) fail '站点必须在独立Nginx站点目录';; esac
for path in /var/www/qiulegeqiu /var/lib/qiulegeqiu /var/backups/qiulegeqiu; do
 [[ -d "$path" && $(realpath "$path") = "$path" ]] || fail "目录缺失或含符号链接：$path"
done
[[ -f /var/www/qiulegeqiu/index.html ]] || fail '旧网页不存在，需先人工确认首次静态部署策略'
[[ -z $(find /var/www/qiulegeqiu -type l -print -quit) ]] || fail '网页目录含符号链接'
uid=$(id -u qiulegeqiu)
for path in /var/lib/qiulegeqiu /var/backups/qiulegeqiu; do
 [[ $(stat -c %u "$path") = "$uid" && $(stat -c %a "$path") = 700 ]] || fail '数据及备份目录必须为服务用户所有、权限700'
done
for path in /opt/qiulegeqiu-api /opt/qiulegeqiu-api/current /etc/qiulegeqiu-api.env /var/lib/qiulegeqiu/leaderboard.sqlite /var/backups/qiulegeqiu-install; do
 if [[ -L "$path" && "$path" != /opt/qiulegeqiu-api/current ]]; then fail "拒绝符号链接：$path"; fi
done
if [[ -e /opt/qiulegeqiu-api/current ]]; then
 [[ -L /opt/qiulegeqiu-api/current && $(readlink -f /opt/qiulegeqiu-api/current) = /opt/qiulegeqiu-api/releases/* ]] || fail '当前API指针不是本项目release'
fi
if [[ -e /etc/qiulegeqiu-api.env ]]; then
 node "$scripts/check-production-env.mjs"
 [[ $(stat -c %u /etc/qiulegeqiu-api.env) = 0 && $(stat -c %a /etc/qiulegeqiu-api.env) = 640 ]] || fail '既有环境文件应为root所有且权限640；请先人工审核'
fi
# Node22 supports this parser; do not load native node:sqlite until isolated Node24 is installed.
node --input-type=module - <<'JS'
import {existsSync,readFileSync} from 'node:fs';import {parseEnv} from 'node:util';
if(existsSync('/etc/qiulegeqiu-api.env')){const e=parseEnv(readFileSync('/etc/qiulegeqiu-api.env','utf8'));if(e.MODERATION_URL&&(!e.MODERATION_API_KEY||!e.MODERATION_URL.startsWith('https://')||e.MODERATION_URL.includes('.example')))throw Error('第三方审核配置不完整；请配置真实HTTPS地址及凭据');}
JS
# Existing service must belong to this installation, not an unrelated or legacy process.
if systemctl cat qiulegeqiu-api.service >/dev/null 2>&1;then
 unit_text=$(systemctl cat qiulegeqiu-api.service)
 [[ "$unit_text" = *'User=qiulegeqiu'* && "$unit_text" = *'ExecStart=/opt/qiulegeqiu-api/node/bin/node build/index.js'* ]] || fail '已有API服务定义不同，必须先人工审核升级方案'
 [[ $(systemctl show qiulegeqiu-api.service -p DropInPaths --value) = '' ]] || fail 'API存在未审核的systemd覆盖配置'
fi
nginx -t
scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
node "$scripts/nginx-plan.mjs" "$site" "$scratch/proposed.conf"
# Require the operator-selected file to actually be loaded; never edit a dormant lookalike.
nginx -T > "$scratch/nginx-loaded" 2>&1
python3 - "$site" "$scratch/nginx-loaded" <<'PYLOAD'
import pathlib,re,sys
paths=re.findall(r'^# configuration file (.+):$',pathlib.Path(sys.argv[2]).read_text(),re.M)
assert any(pathlib.Path(p).resolve()==pathlib.Path(sys.argv[1]) for p in paths),'所选站点未被加载'
PYLOAD

if [[ -e /etc/nginx/snippets/qiulegeqiu-api.conf ]]; then
 cmp -s "$scripts/nginx-api.conf.example" /etc/nginx/snippets/qiulegeqiu-api.conf || fail '现有API片段与审核版本不同，停止自动覆盖'
fi
if [[ ! -f /var/lib/qiulegeqiu/leaderboard.sqlite ]]; then
 [[ -z $(find /home/ubuntu/qiulegeqiu -maxdepth 5 -type f \( -name '*.db' -o -name '*.sqlite' \) -not -path '*/node_modules/*' -print -quit) ]] || fail '发现旧数据库，必须先审核数据路径'
 ! systemctl is-active --quiet qiulegeqiu-api.service || fail '旧API运行但标准数据库不存在'
fi
curl --fail --silent --show-error --max-time 15 https://game.gmgnclaw.com/ -o /dev/null
if [[ -L /opt/qiulegeqiu-api/current && -f /var/lib/qiulegeqiu/leaderboard.sqlite ]];then
 reviewed_rules=$(tar -xOf "$archive" RULES_VERSION)
 node --input-type=module - "$scripts/leaderboard-contract.mjs" "$reviewed_rules" /opt/qiulegeqiu-api/current/RULES_VERSION <<'JS'
import {readFileSync,existsSync} from 'node:fs';import {pathToFileURL} from 'node:url';const {verifyRollbackCompatibility}=await import(pathToFileURL(process.argv[2]));verifyRollbackCompatibility(process.argv[3],existsSync(process.argv[4])?readFileSync(process.argv[4],'utf8'):undefined);
JS
fi
say '检查完成：将保留既有环境和数据库；新增独立Node、API服务、ball站点代理及每日备份'
[[ "$mode" = apply ]] || { say 'dry-run完成；未安装、未备份、未重启或发布。只有--apply才会写入';exit 0; }
# A second independent installer cannot interleave; legacy helpers retain their own rollout locks.
exec 9>/run/lock/qiulegeqiu-rollout.lock
flock -n 9 || fail '另一次首次安装正在执行'
export QIULEGEQIU_LOCK_HELD=1
record=/var/backups/qiulegeqiu-install/$(date -u +%Y%m%dT%H%M%SZ)-$$
install -d -m 700 /var/backups/qiulegeqiu-install "$record" "$record/files"
tracked=("$site" /etc/nginx/snippets/qiulegeqiu-api.conf /etc/qiulegeqiu-api.env /etc/systemd/system/qiulegeqiu-api.service /etc/systemd/system/qiulegeqiu-backup.service /etc/systemd/system/qiulegeqiu-backup.timer)
for p in "${tracked[@]}"; do
 [[ ! -L "$p" ]] || fail "受管配置不能是符号链接：$p"
 if [[ -e "$p" ]]; then cp -a --parents "$p" "$record/files"; printf '%s\n' "$p" >> "$record/existing"; fi
done
cp -p /var/www/qiulegeqiu/index.html "$record/index.html"
previous=$(readlink -f /opt/qiulegeqiu-api/current || true)
[[ -L /opt/qiulegeqiu-api/current ]] || previous=''
printf '%s\n' "$previous" > "$record/previous"
for unit in qiulegeqiu-api.service qiulegeqiu-backup.timer; do
 if systemctl cat "$unit" >/dev/null 2>&1;then
  systemctl is-active "$unit" > "$record/$unit.active" 2>/dev/null || true
  systemctl is-enabled "$unit" > "$record/$unit.enabled" 2>/dev/null || true
 else
  printf 'inactive\n' > "$record/$unit.active"
  printf 'not-found\n' > "$record/$unit.enabled"
 fi
 state=$(cat "$record/$unit.enabled")
 [[ "$state" = enabled || "$state" = disabled || "$state" = not-found || -z "$state" ]] || fail '服务处于特殊启用状态，需人工审核'
done
# A durable journal records only resources this transaction attempts to change.
cp "$scripts/first-install-rollback-lib.sh" "$record/rollback-lib.sh"
source "$record/rollback-lib.sh"
rollback(){
 local status=$?
 trap - ERR INT TERM
 set +e
 say "安装失败，按事务记录回退本次修改；绝不回写数据库。记录：$record" >&2
 if rollback_install_resources "$record" /opt/qiulegeqiu-api /var/www/qiulegeqiu "$previous";then
  say '本次修改已回退；既有数据库保留。' >&2
 else
  say '部分回退失败，请按记录人工检查；数据库未执行恢复或删除。' >&2
 fi
 exit "$status"
}
{
 printf '#!/usr/bin/env bash\nset -Eeuo pipefail\n[[ ${1:-} = --apply ]] || { echo "用法：sudo bash rollback-install.sh --apply";exit 1; }\n'
 printf 'exec 9>/run/lock/qiulegeqiu-rollout.lock\nflock -n 9\n'
 printf 'source %q\n' "$record/rollback-lib.sh"
 printf 'rollback_install_resources %q /opt/qiulegeqiu-api /var/www/qiulegeqiu %q\n' "$record" "$previous"
} > "$record/rollback-install.sh"
trap rollback ERR
trap 'false' INT TERM
say '安装并校验独立Node运行时（不修改系统Node）'
system_node=$(sha256sum "$(readlink -f "$(command -v node)")")
bash "$scripts/install-runtime.sh" --apply
runtime=/opt/qiulegeqiu-api/node/bin/node
[[ "$system_node" = "$(sha256sum "$(readlink -f "$(command -v node)")")" ]]
"$runtime" -e 'const {DatabaseSync}=require("node:sqlite");new DatabaseSync(":memory:").close()'
# Archive was fully inspected; extract only now, under private temporary directory.
cp -- "$archive" "$scratch/release.tar.gz"
[[ $(sha256sum "$scratch/release.tar.gz" | cut -d' ' -f1) = "$sha" ]]
python3 - "$scratch/release.tar.gz" "$scratch/release" <<'PY'
import tarfile,sys
with tarfile.open(sys.argv[1]) as t:t.extractall(sys.argv[2])
PY
source_dir=$scratch/release
python3 "$scripts/release-integrity.py" --package "$archive" --sha256 "$sha" --commit "$commit" --repo "$repo"
if [[ ! -e /etc/qiulegeqiu-api.env ]];then
 say '创建必填生产配置；应用使用随机会话凭据，不需要伪造签名密钥'
 printf '%s\n' /etc/qiulegeqiu-api.env >> "$record/changed-files"
 install -m 640 -o root -g qiulegeqiu /dev/null /etc/qiulegeqiu-api.env
 printf '%s\n' NODE_ENV=production PORT=8091 PUBLIC_ORIGIN=https://ball.gmgnclaw.com DB_PATH=/var/lib/qiulegeqiu/leaderboard.sqlite > /etc/qiulegeqiu-api.env
fi
say '安装独立服务；发布工具在启动迁移之前强制在线备份旧库'
for unit in qiulegeqiu-api.service qiulegeqiu-backup.service qiulegeqiu-backup.timer; do
 printf '%s\n' "/etc/systemd/system/$unit" >> "$record/changed-files"
 install -m 644 "$source_dir/deploy/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
touch "$record/publish-attempted"
bash "$source_dir/deploy/publish.sh" --apply "$source_dir"
say '仅调整ball HTTPS站点并验证Nginx'
touch "$record/nginx-attempted"
printf '%s\n' "$site" /etc/nginx/snippets/qiulegeqiu-api.conf >> "$record/changed-files"
bash "$source_dir/deploy/activate-nginx.sh" --apply "$site"
touch "$record/qiulegeqiu-api.service.enable-attempted"
systemctl enable qiulegeqiu-api.service
say '启用每日在线备份（保留7天），立即执行一次'
touch "$record/timer-enable-attempted" "$record/qiulegeqiu-backup.timer.enable-attempted"
systemctl enable --now qiulegeqiu-backup.timer
systemctl start qiulegeqiu-backup.service
[[ $(systemctl show qiulegeqiu-backup.service -p Result --value) = success ]]
say '验证正式网页、API、TOP100、匿名身份查询和数据库重启持久性；不创建虚假玩家或分数'
curl --fail --silent --show-error --max-time 15 https://ball.gmgnclaw.com/ -o "$scratch/page"
curl --fail --silent --show-error --max-time 15 https://ball.gmgnclaw.com/api/health -o "$scratch/health"
curl --fail --silent --show-error --max-time 15 'https://ball.gmgnclaw.com/api/leaderboard?board=global&limit=20&offset=0' -o "$scratch/board"
curl --fail --silent --show-error --max-time 15 -c "$scratch/cookies" 'https://ball.gmgnclaw.com/api/me?board=global' -o "$scratch/me-before"
curl --fail --silent --show-error --max-time 15 -b "$scratch/cookies" 'https://ball.gmgnclaw.com/api/me/best?board=global' -o "$scratch/best"
[[ -s /var/lib/qiulegeqiu/leaderboard.sqlite ]]
db_inode=$(stat -c %i /var/lib/qiulegeqiu/leaderboard.sqlite)
systemctl restart qiulegeqiu-api.service
curl --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 1 --max-time 10 -b "$scratch/cookies" 'https://ball.gmgnclaw.com/api/me?board=global' -o "$scratch/me-after"
[[ "$db_inode" = "$(stat -c %i /var/lib/qiulegeqiu/leaderboard.sqlite)" ]]
for offset in 20 40 60 80; do
 curl --fail --silent --show-error --max-time 15 "https://ball.gmgnclaw.com/api/leaderboard?board=global&limit=20&offset=$offset" -o "$scratch/board-$offset"
done
"$runtime" --input-type=module - "$scratch" "$scripts/leaderboard-contract.mjs" <<'JS'
import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';const dir=process.argv[2],load=n=>JSON.parse(readFileSync(`${dir}/${n}`));const {verifyLeaderboardHealth,verifyLeaderboardPage,verifyIdentityPersistence}=await import(pathToFileURL(process.argv[3]));
const health=load('health');verifyLeaderboardHealth(health);verifyLeaderboardPage(load('board'),health.rulesVersion);
for(const offset of [20,40,60,80])verifyLeaderboardPage(load(`board-${offset}`),health.rulesVersion,offset);
if(load('best').board!=='global'||!('best' in load('best')))throw Error('个人排名接口无效');verifyIdentityPersistence(load('me-before'),load('me-after'));

JS
for unit in qiulegeqiu-api.service qiulegeqiu-backup.timer; do systemctl is-enabled --quiet "$unit";systemctl is-active --quiet "$unit";done
curl --fail --silent --show-error --max-time 15 https://game.gmgnclaw.com/ -o /dev/null
trap - ERR INT TERM
say "部署完成；回滚记录：$record。个人真实排名和跨设备真实成绩请使用已有账号人工验收；本脚本未伪造正式成绩。"
