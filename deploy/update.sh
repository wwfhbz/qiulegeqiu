#!/usr/bin/env bash
# 球球出击 一键更新：在腾讯云服务器上以 ubuntu 用户运行
#   bash /home/ubuntu/qiulegeqiu/deploy/update.sh
# 拉取 GitHub main → 测试 → 打包校验 → 规则兼容检查（必要时两阶段桥接）→ 发布 → 线上验证。
# 从不重置或回滚数据库。
#
# 整个流程放在 main 函数里、在文件末尾才调用：第2步 git merge 可能改写本文件，
# bash 必须先读完全部函数体再执行，才不会读到半新半旧的脚本。
set -Eeuo pipefail
umask 077

main() {
trap 'rc=$?; echo "❌ 更新中断，退出码：$rc。不要重置数据库。" >&2; exit "$rc"' ERR

local REPO=${QIULEGEQIU_REPO:-/home/ubuntu/qiulegeqiu}
local NODE_HOME=${QIULEGEQIU_NODE_HOME:-/home/ubuntu/.local/opt/node-v24.19.0}
local NODE="$NODE_HOME/bin/node"
local NPM_CLI="$NODE_HOME/lib/node_modules/npm/bin/npm-cli.js"
local URL=${QIULEGEQIU_URL:-https://ball.gmgnclaw.com}

echo "========== 1/9 环境检查 =========="
test "$(id -un)" = ubuntu
cd "$REPO"

test "$(git rev-parse --show-toplevel)" = "$PWD"
test "$(git branch --show-current)" = main
test -z "$(git status --porcelain)"
test -x "$NODE"
test -f "$NPM_CLI"
test "$("$NODE" -v)" = v24.19.0

case "$(git remote get-url origin)" in
  https://github.com/wwfhbz/qiulegeqiu|\
https://github.com/wwfhbz/qiulegeqiu.git|\
git@github.com:wwfhbz/qiulegeqiu.git) ;;
  *) echo "❌ GitHub仓库不匹配"; exit 1 ;;
esac

export PATH="$NODE_HOME/bin:$PATH"
export QIULEGEQIU_TEST_NODE="$NODE"
export QIULEGEQIU_TEST_NPM_CLI="$NPM_CLI"
unset NODE_OPTIONS NODE_PATH

sudo -n true
sudo -n test -s /var/lib/qiulegeqiu/leaderboard.sqlite
sudo -n test -L /opt/qiulegeqiu-api/current
sudo -n systemctl is-active --quiet qiulegeqiu-api.service

echo "========== 2/9 拉取GitHub最新版 =========="
git fetch origin main
git merge --ff-only origin/main

local COMMIT
COMMIT=$(git rev-parse HEAD)
echo "本次更新提交：$COMMIT"
git log -1 --format='%h %s'

echo "========== 3/9 安装依赖 =========="
npm ci --include=dev
npm ci --prefix server --include=dev

echo "========== 4/9 自动化测试 =========="
for i in 1 2 3; do
  echo "道具回放测试 $i/3"
  npm test --prefix server -- tests/power-replay.test.ts
done

npm run test:wechat
npm run test:minigame

echo "========== 5/9 完整测试与构建 =========="
bash deploy/package.sh

local PACKAGE="$REPO/work/qiulegeqiu-release.tar.gz"
test -s "$PACKAGE"

local SHA
SHA=$(sha256sum "$PACKAGE" | awk '{print $1}')

echo "========== 6/9 校验发布包 =========="
python3 deploy/release-integrity.py \
  --package "$PACKAGE" \
  --sha256 "$SHA" \
  --commit "$COMMIT" \
  --repo "$REPO"

local STAGE
STAGE=$(mktemp -d "$REPO/work/update.XXXXXXXX")
tar --no-same-owner -xzf "$PACKAGE" -C "$STAGE"

test -f "$STAGE/server/build/index.js"
test -f "$STAGE/dist/index.html"
test -f "$STAGE/deploy/publish.sh"
test -f "$STAGE/deploy/leaderboard-contract.mjs"
test -f "$STAGE/RULES_VERSION"
test "$(cat "$STAGE/SOURCE_COMMIT")" = "$COMMIT"

echo "========== 7/9 规则兼容检查 =========="
local OLD NEW
OLD=$(sudo -n cat /opt/qiulegeqiu-api/current/RULES_VERSION)
NEW=$(cat "$STAGE/RULES_VERSION")

echo "线上规则：$OLD"
echo "新包规则：$NEW"

if [ "$OLD" = "$NEW" ]; then
  echo "规则版本一致，直接发布"

# 已审核的规则切换以发布包内 deploy/leaderboard-contract.mjs 的 REVIEWED_TRANSITIONS 为准，
# 与 publish.sh 自身的检查同源，不在脚本里写死版本号。
elif "$NODE" --input-type=module - "$STAGE/deploy/leaderboard-contract.mjs" "$OLD" "$NEW" <<'JS'
import {pathToFileURL} from 'node:url';
const {REVIEWED_TRANSITIONS}=await import(pathToFileURL(process.argv[2]));
const from=process.argv[3].trim(),to=process.argv[4].trim();
process.exit(Array.isArray(REVIEWED_TRANSITIONS)&&REVIEWED_TRANSITIONS.some(([a,b])=>a===from&&b===to)?0:1);
JS
then
  echo "执行已审核的两阶段兼容升级：$OLD → $NEW"
  # 第一阶段：只安装同时接受新旧规则的后端，网页文件不变。
  sudo -n bash "$STAGE/deploy/publish.sh" \
    --apply "$STAGE" --api-only

  sudo -n systemctl is-active --quiet qiulegeqiu-api.service

  curl -fsS --retry 5 --retry-delay 1 \
    --max-time 20 "$URL/api/health" -o "$STAGE/bridge-health.json"

  "$NODE" --input-type=module - "$STAGE" "$NEW" <<'JS'
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const [dir,rules]=process.argv.slice(2);
const {verifyCompatibilityBridgeHealth}=await import(pathToFileURL(dir+'/deploy/leaderboard-contract.mjs'));
verifyCompatibilityBridgeHealth(JSON.parse(readFileSync(dir+'/bridge-health.json','utf8')),rules);
console.log('✅ 兼容后端已同时支持上一赛季与新规则');
JS

else
  echo "❌ 检测到未经审核的规则版本变化"
  echo "为保护历史成绩和排行榜，停止发布"
  exit 1
fi

echo "========== 8/9 正式发布 =========="
sudo -n bash "$STAGE/deploy/publish.sh" \
  --apply "$STAGE"

echo "========== 9/9 验证线上服务 =========="
sudo -n systemctl is-active --quiet qiulegeqiu-api.service
sudo -n systemctl is-enabled --quiet qiulegeqiu-api.service

curl -fsS --retry 5 --retry-delay 1 \
  --max-time 20 "$URL/api/health" \
  -o "$STAGE/health.json"

curl -fsS --retry 5 --retry-delay 1 \
  --max-time 20 \
  "$URL/api/leaderboard?board=global&limit=20" \
  -o "$STAGE/board.json"

"$NODE" --input-type=module - "$STAGE" "$NEW" <<'JS'
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const [dir,rules]=process.argv.slice(2);
const {verifyLeaderboardHealth,verifyLeaderboardPage}=await import(pathToFileURL(dir+'/deploy/leaderboard-contract.mjs'));
verifyLeaderboardHealth(JSON.parse(readFileSync(dir+'/health.json','utf8')),rules);
verifyLeaderboardPage(JSON.parse(readFileSync(dir+'/board.json','utf8')),rules);
console.log('✅ API和排行榜协议校验通过');
JS

test "$(curl -sS --max-time 20 \
  -o /dev/null -w '%{http_code}' "$URL/")" = 200

curl -fsS --max-time 20 \
  https://game.gmgnclaw.com/ -o /dev/null

echo
echo "========================================"
echo "✅ 球球出击最新版更新完成"
echo "Git Commit: $COMMIT"
echo "规则版本: $NEW"
echo "发布包SHA256: $SHA"
echo "游戏地址: $URL"
echo "未执行数据库重置"
echo "========================================"
}

main "$@"
