#!/usr/bin/env bash
# Source-only transaction rollback. Paths are supplied by the approved installer; tests use temp dirs.
# Never receives a database path and never performs database restore or removal.
rollback_install_resources(){
 local record=$1 base=$2 webroot=$3 previous=$4
 local pointer='' api_changed=0 units_changed=0 failed=0 p unit old_enabled
 [[ ! -L "$base/current" ]] || pointer=$(readlink -f "$base/current")
 [[ "$pointer" = "$previous" ]] || api_changed=1
 if [[ "$api_changed" = 1 ]];then
  if systemctl is-active --quiet qiulegeqiu-api.service;then systemctl stop qiulegeqiu-api.service || failed=1;fi
 fi
 if [[ -f "$record/timer-enable-attempted" ]] && systemctl is-active --quiet qiulegeqiu-backup.timer;then
  systemctl stop qiulegeqiu-backup.timer || failed=1
 fi
 # Disable a newly enabled unit while it still exists. Never disable a missing original service.
 for unit in qiulegeqiu-api.service qiulegeqiu-backup.timer;do
  if [[ -f "$record/$unit.enable-attempted" ]];then
   old_enabled=$(cat "$record/$unit.enabled")
   if [[ "$old_enabled" != enabled ]] && systemctl is-enabled --quiet "$unit";then systemctl disable "$unit" || failed=1;fi
  fi
 done
 if [[ "$api_changed" = 1 ]];then
  if [[ -n "$previous" ]];then
   ln -s "$previous" "$base/current.rollback-$$" && mv -Tf "$base/current.rollback-$$" "$base/current" || failed=1
  elif [[ -L "$base/current" ]];then unlink "$base/current" || failed=1;fi
 fi
 if [[ -f "$record/changed-files" ]];then
  while IFS= read -r p;do
   case "$p" in */qiulegeqiu-api.service|*/qiulegeqiu-backup.service|*/qiulegeqiu-backup.timer) units_changed=1;;esac
   if [[ -f "$record/files$p" ]];then cp -p "$record/files$p" "$p" || failed=1
   elif [[ -f "$p" ]];then rm -f -- "$p" || failed=1;fi
  done < "$record/changed-files"
 fi
 if [[ -f "$record/publish-attempted" ]];then
  install -m 644 "$record/index.html" "$webroot/.index.html.rollback-$$" && mv -f "$webroot/.index.html.rollback-$$" "$webroot/index.html" || failed=1
 fi
 if [[ "$units_changed" = 1 ]];then systemctl daemon-reload || failed=1;fi
 for unit in qiulegeqiu-api.service qiulegeqiu-backup.timer;do
  if [[ -f "$record/$unit.enable-attempted" ]];then
   old_enabled=$(cat "$record/$unit.enabled")
   if [[ "$old_enabled" = enabled ]];then systemctl enable "$unit" || failed=1;fi
  fi
 done
 if [[ "$api_changed" = 1 && $(cat "$record/qiulegeqiu-api.service.active") = active ]];then systemctl start qiulegeqiu-api.service || failed=1;fi
 if [[ -f "$record/timer-enable-attempted" && $(cat "$record/qiulegeqiu-backup.timer.active") = active ]];then systemctl start qiulegeqiu-backup.timer || failed=1;fi
 if [[ -f "$record/nginx-attempted" ]];then nginx -t && systemctl reload nginx || failed=1;fi
 return "$failed"
}
