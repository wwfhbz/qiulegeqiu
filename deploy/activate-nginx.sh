#!/usr/bin/env bash
set -euo pipefail
[[ ${1:-} = --apply && -n ${2:-} && $EUID = 0 ]] || { echo '用法：sudo bash activate-nginx.sh --apply 已核实的球了个球站点配置路径';exit 1; }
site_file=$(realpath "$2")
case "$site_file" in /etc/nginx/sites-available/*|/etc/nginx/conf.d/*) ;; *) echo '站点文件不在独立站点目录，需人工审核';exit 1;;esac
runtime=/opt/qiulegeqiu-api/node/bin/node
scripts=$(cd "$(dirname "$0")" && pwd)
backup_dir=/var/backups/qiulegeqiu-config
snippet=/etc/nginx/snippets/qiulegeqiu-api.conf
[[ ! -L "$snippet" && ! -L "$backup_dir" && -f "$site_file" ]]
if [[ ${QIULEGEQIU_LOCK_HELD:-} = 1 ]]; then
 [[ $(readlink /proc/self/fd/9) = /run/lock/qiulegeqiu-rollout.lock ]] && flock -n 9
else
 exec 9>/run/lock/qiulegeqiu-rollout.lock
 flock -n 9
fi
nginx -t
stage=$(mktemp -d)
"$runtime" "$scripts/nginx-plan.mjs" "$site_file" "$stage/proposed.conf"
install -d -m 700 "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)-$$
cp -p "$site_file" "$backup_dir/nginx-$stamp.conf"
chmod 600 "$backup_dir/nginx-$stamp.conf"
mode=$(stat -c %a "$site_file");uid=$(stat -c %u "$site_file");gid=$(stat -c %g "$site_file")
had_snippet=0
if [[ -f "$snippet" ]];then cp "$snippet" "$backup_dir/snippet-$stamp.conf";chmod 600 "$backup_dir/snippet-$stamp.conf";had_snippet=1;fi
rollback(){
 local status=$?
 trap - ERR
 install -m "$mode" -o "$uid" -g "$gid" "$backup_dir/nginx-$stamp.conf" "$site_file"
 if [[ "$had_snippet" = 1 ]];then install -m 644 "$backup_dir/snippet-$stamp.conf" "$snippet";else rm -f -- "$snippet";fi
 echo "Nginx验证/重载失败，已恢复原配置：$backup_dir/nginx-$stamp.conf" >&2
 exit "$status"
}
trap rollback ERR
install -d -m 755 /etc/nginx/snippets
install -m 644 "$scripts/nginx-api.conf.example" "$snippet"
install -m "$mode" -o "$uid" -g "$gid" "$stage/proposed.conf" "$site_file.qiulegeqiu-new"
mv -f "$site_file.qiulegeqiu-new" "$site_file"
nginx -t
systemctl reload nginx
trap - ERR
printf '仅在ball的HTTPS块加入include，已通过nginx -t并graceful reload。原配置备份：%s\n' "$backup_dir/nginx-$stamp.conf"
