#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run typecheck
npm test
npm run build
npm run typecheck --prefix server
npm test --prefix server
npm run build --prefix server
mkdir -p work
stage=$(mktemp -d "$PWD/work/release.XXXXXX")
install -d "$stage/server"
cp -r dist "$stage/dist"
cp -r server/build server/data server/migrations "$stage/server/"
cp server/package.json server/package-lock.json "$stage/server/"
cp -r deploy "$stage/deploy"
# Explicit whitelist excludes DBs, .env, source files and all node_modules.
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1]+"/VERSION",JSON.parse(fs.readFileSync("package.json")).version+"\n")' "$stage"
tar -C "$stage" -czf work/qiulegeqiu-release.tar.gz dist server deploy VERSION
tar -tzf work/qiulegeqiu-release.tar.gz > work/release-files.txt
if rg '(^|/)(node_modules|\.env|[^/]*\.sqlite[^/]*|[^/]*\.db)$' work/release-files.txt; then exit 1; fi
sha256sum work/qiulegeqiu-release.tar.gz
printf '已打包至work/qiulegeqiu-release.tar.gz；未部署。\n'
