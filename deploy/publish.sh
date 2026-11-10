#!/usr/bin/env bash
# Run manually on the authorized server with an already extracted, reviewed release.
set -euo pipefail
[[ ${1:-} = --apply && -n ${2:-} ]] || { echo '用法：sudo bash publish.sh --apply 已核验的解压目录'; exit 1; }
source_dir=$(realpath "$2")
[[ -f "$source_dir/dist/index.html" && -d "$source_dir/dist/assets" && -f "$source_dir/server/build/index.js" ]]
[[ -z $(find "$source_dir" -type l -print -quit) ]]
site=/var/www/qiulegeqiu
base=/opt/qiulegeqiu-api
[[ $(realpath "$site") = "$site" && -d "$site" && ! -L "$base" ]]
[[ -z $(find "$site" -type l -print -quit) ]]
[[ -f /etc/qiulegeqiu-api.env && -f /etc/systemd/system/qiulegeqiu-api.service ]]
release_id=$(date -u +%Y%m%dT%H%M%SZ)
release="$base/releases/$release_id"
install -d -m 755 "$release"
cp -r "$source_dir/server" "$release/server"
(cd "$release/server" && npm ci --omit=dev)
if [[ -L "$base/current" ]]; then readlink -f "$base/current" > "$release/PREVIOUS"; fi
# Assets are additive; HTML is switched only after API health passes.
cp -r "$site/index.html" "$release/previous-index.html"
cp -r "$source_dir/dist/assets/." "$site/assets/"
ln -s "$release" "$base/current.new"
mv -Tf "$base/current.new" "$base/current"
systemctl restart qiulegeqiu-api
if ! curl --fail --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:8091/api/health; then
  echo 'API健康检查失败。请执行回滚脚本；HTML尚未切换。'; exit 1
fi
install -m 644 "$source_dir/dist/index.html" "$site/.index.html.new"
mv -f "$site/.index.html.new" "$site/index.html"
printf '发布完成，版本目录：%s。未修改Nginx或其他游戏服务。\n' "$release"
