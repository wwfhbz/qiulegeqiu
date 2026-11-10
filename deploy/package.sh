#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -z $(git status --porcelain) ]] || { echo '请先提交待审核代码，再生成可追溯的发布包';exit 1; }
npm run typecheck
npm test
npm run build
npm run typecheck --prefix server
npm test --prefix server
npm run build --prefix server
npm run regions
npm run test:deploy
mkdir -p work
stage=$(mktemp -d "$PWD/work/release.XXXXXX")
install -d "$stage/server"
cp -r dist "$stage/dist"
cp -r server/build server/data server/migrations "$stage/server/"
cp server/package.json server/package-lock.json "$stage/server/"
git archive HEAD deploy | tar -x -C "$stage"
# A release must carry its audited dependency installer, runtime gate and rollback implementation.
for helper in install-production-deps.sh verify-runtime.mjs leaderboard-contract.mjs reset-database.mjs reset-preflight.mjs first-install-rollback-lib.sh;do
 [[ -f "$stage/deploy/$helper" ]] || { echo "发布包缺少运行时门禁：$helper";exit 1; }
done
cp server/.env.example "$stage/deploy/qiulegeqiu-api.env.example"
# Explicit whitelist excludes DBs, .env, source files and all node_modules.
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1]+"/VERSION",JSON.parse(fs.readFileSync("package.json")).version+"\n")' "$stage"
node --input-type=module - "$stage" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const match=readFileSync('shared/Challenge.ts','utf8').match(/^export const RULES_VERSION = '([^']+)'/m);if(!match)throw Error('缺少规则版本');writeFileSync(process.argv[2]+'/RULES_VERSION',match[1]+'\n');
JS
git rev-parse HEAD > "$stage/SOURCE_COMMIT"
git rev-parse HEAD^{tree} > "$stage/SOURCE_TREE"
python3 deploy/release-integrity.py --manifest "$stage"
tar -C "$stage" -czf work/qiulegeqiu-release.tar.gz dist server deploy VERSION RULES_VERSION SOURCE_COMMIT SOURCE_TREE RELEASE_MANIFEST.json
tar -tzf work/qiulegeqiu-release.tar.gz > work/release-files.txt
if rg '(^|/)(node_modules|\.env|[^/]*\.sqlite[^/]*|[^/]*\.db)$' work/release-files.txt; then exit 1; fi
sha256sum work/qiulegeqiu-release.tar.gz
printf '已打包至work/qiulegeqiu-release.tar.gz；未部署。\n'
