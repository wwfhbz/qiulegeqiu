#!/usr/bin/env bash
# Installs only into the explicit release server directory, never global/ancestor node_modules.
set -Eeuo pipefail
[[ $# = 2 ]] || { echo '用法：install-production-deps.sh 独立Node绝对路径 release/server绝对路径' >&2;exit 1; }
node=$(realpath -e "$1")
server=$(realpath -e "$2")
[[ -f "$server/package.json" && -f "$server/package-lock.json" && -f "$server/build/index.js" && ! -L "$server/node_modules" ]]
[[ $(env -u NODE_OPTIONS -u NODE_PATH "$node" --version) = v24.19.0 ]] || { echo '生产依赖安装必须使用审核的Node v24.19.0' >&2;exit 1; }
npm_cli=$(dirname "$node")/../lib/node_modules/npm/bin/npm-cli.js
[[ -f "$npm_cli" ]]
# Preserve only transport settings. Inherited npm prefix/global/workspaces/NODE_PATH/NODE_OPTIONS
# must not redirect installation or hide broken module resolution.
install -d -m 700 "$server/../.npm-config"
: > "$server/../.npm-config/user.npmrc"
: > "$server/../.npm-config/global.npmrc"
transport=()
for key in HTTPS_PROXY HTTP_PROXY ALL_PROXY NO_PROXY https_proxy http_proxy all_proxy no_proxy NODE_EXTRA_CA_CERTS SSL_CERT_FILE SSL_CERT_DIR;do
 if [[ -v "$key" ]];then transport+=("$key=${!key}");fi
done
(
 cd "$server"
 # Outer deployment umask stays 077 for secrets. Public, root-owned code must be service-readable.
 umask 022
 env -i "${transport[@]}" PATH="$(dirname "$node"):/usr/bin:/bin" HOME="$server/../.npm-home" \
  "$node" "$npm_cli" ci --prefix "$server" --global=false --workspaces=false \
  --omit=dev --include=optional --ignore-scripts --no-audit --no-fund \
  --userconfig="$server/../.npm-config/user.npmrc" --globalconfig="$server/../.npm-config/global.npmrc" --cache "$server/../.npm-cache"
)
[[ -d "$server/node_modules" && ! -L "$server/node_modules" ]]
# npm or a package's tar metadata can retain restrictive modes even with umask 022.
# Only code in this new release is touched; never chmod any database, env file or other release.
find "$server/node_modules" -type d -exec chmod 755 {} +
find "$server/node_modules" -type f -exec chmod a+rX,u+w,go-w {} +
printf '生产依赖已按锁文件安装到：%s/node_modules；下一步必须以服务用户验收\n' "$server"
