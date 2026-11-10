#!/usr/bin/env bash
# READ ONLY. No apt, git pull, install, mkdir, migration, backup, reload or service changes.
set -u
printf '\n[系统]\n'
cat /etc/os-release
uname -m
node --version 2>/dev/null || true
npm --version 2>/dev/null || true
command -v node npm nginx || true
df -h / /var /home
printf '\n[项目Git，仅状态与提交，不输出远程凭据]\n'
if [[ -d /home/ubuntu/qiulegeqiu/.git ]]; then
 git -C /home/ubuntu/qiulegeqiu status --short
 git -C /home/ubuntu/qiulegeqiu branch --show-current
 git -C /home/ubuntu/qiulegeqiu rev-parse HEAD
 git -C /home/ubuntu/qiulegeqiu remote get-url origin | python3 -c 'import sys,re; u=sys.stdin.read().strip(); u=re.sub(r"(https?://)[^/@]+@",r"\1[REDACTED]@",u); print(u.split("?")[0].split("#")[0])'
fi
printf '\n[本项目目录与旧数据库，仅路径/权限/大小]\n'
for path in /home/ubuntu/qiulegeqiu /var/www/qiulegeqiu /var/lib/qiulegeqiu /var/lib/qiulegeqiu/leaderboard.sqlite /var/backups/qiulegeqiu /opt/qiulegeqiu-api/current /opt/qiulegeqiu-api/node; do
 stat -c '%A %U:%G %s %n' "$path" 2>/dev/null || true
 readlink -f "$path" 2>/dev/null || true
done
if [[ -d /home/ubuntu/qiulegeqiu ]]; then
 find /home/ubuntu/qiulegeqiu -maxdepth 4 -type f \( -name '*.sqlite' -o -name '*.sqlite-wal' -o -name '*.db' \) -not -path '*/node_modules/*' -printf '%M %u:%g %s %p\n' 2>/dev/null
fi
printf '\n[既有API配置，仅非密钥字段]\n'
if sudo -n test -f /etc/qiulegeqiu-api.env 2>/dev/null; then sudo -n awk '/^(DB_PATH|PUBLIC_ORIGIN|NODE_ENV|PORT)=/{print}' /etc/qiulegeqiu-api.env; fi
printf '\n[服务名与监听，不读取Environment/私钥]\n'
systemctl list-units --type=service --all --no-pager 2>/dev/null || true
systemctl show qiulegeqiu-api.service -p ActiveState -p SubState -p User -p WorkingDirectory -p FragmentPath -p MainPID 2>/dev/null || true
systemctl list-timers qiulegeqiu-backup.timer --all --no-pager 2>/dev/null || true
ss -lnt 2>/dev/null || true
sudo -n ss -H -lntp '( sport = :8091 or sport = :8080 )' 2>/dev/null || true
printf '\n[Nginx摘要；不输出私钥/认证头/完整配置]\n'
if ! sudo -n nginx -t >/dev/null 2>&1; then echo 'Nginx检查不可用或现有配置有错，不能据此推断没有站点'; fi
sudo -n nginx -T 2>/dev/null | python3 -c '
import sys,re,urllib.parse
for line in sys.stdin:
 if line.startswith("# configuration file "): print(line.strip())
 elif re.match(r"\s*(server_name|listen|root|ssl_certificate|proxy_pass)\s",line):
  line=re.sub(r"(https?://)[^\s/@]+@",r"\1[REDACTED]@",line)
  print(line.strip())
' || true
printf '\n[只读公网探测；不注册玩家、不提交成绩]\n'
for url in https://ball.gmgnclaw.com/ https://ball.gmgnclaw.com/api/health https://game.gmgnclaw.com/; do
 curl -sS --max-time 15 -o /dev/null -w '%{url_effective} HTTP=%{http_code} TLS验证=%{ssl_verify_result}\n' "$url" || true
done
printf '\n[TLS公开证书有效期；无需读取服务器私钥]\n'
printf '' | timeout 10 openssl s_client -connect ball.gmgnclaw.com:443 -servername ball.gmgnclaw.com 2>/dev/null | openssl x509 -noout -dates -subject -issuer 2>/dev/null || true
