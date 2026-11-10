# 腾讯云排行榜上线审批单与执行手册

状态：**本地准备完成，未获得生产部署确认，未连接或修改服务器。**

基线是已包含排行榜和十关的main `5a4185c36928e43d50dcdde2718e5e1541ca0f59`，版本0.8.0。本任务标题中的V0.7指排行榜上线范围，不回退已合入的V0.8游戏。改动仅部署、备份、诊断日志和健康检查，不重写游戏/排名功能。

## 1. 已检查与尚未核验

- 已阅读README、package.json、server、API/数据库/地区文档、现有发布与回滚工具。浏览器生产请求使用相对`/api/`；后端仅监听127.0.0.1，禁止使用8080。
- 当前执行环境无SSH密钥、认证代理、服务器凭据；访问两个域名及API被执行环境代理以CONNECT 403拒绝，**不是已证实网站返回403**。
- 远程Ubuntu/Node/npm版本、Nginx实际文件路径、证书、旧Git状态、磁盘/内存、8091占用、旧数据/服务仍未核验。不能称已上线或已完成公网验收。
- 使用独立Node v24.19.0（官方发布文件及SHA已核实），安装到`/opt/qiulegeqiu-api/node`；不升级`/usr/bin/node`或系统npm，避免影响其他游戏。

## 2. 首先只读检查，不产生玩家或写入数据库

在已有SSH权限的终端运行：

```sh
# 脚本只读取信息；无git pull、迁移、安装、备份、重载或服务变更。
ssh ubuntu@101.32.209.249 'bash -s' < deploy/preflight.sh
```

Windows PowerShell可用：

```powershell
Get-Content -Raw .\deploy\preflight.sh | ssh ubuntu@101.32.209.249 "tr -d '\r' | bash -s"
```

保留SSH主机指纹校验，首次指纹须从腾讯云控制台确认。脚本不输出.env密钥、Cookie、私钥或完整Nginx配置；输出四个非秘密环境字段和脱敏Git地址。不能在聊天提供密码、令牌或私钥；若由本执行环境操作，应通过安全连接配置提供SSH访问。

**检查后才可确认最终生产变更**：实际ball站点文件路径、旧DB路径/属主、旧API运行用户、8091占用、原Cookie生产模式、Node架构与磁盘余量。若存在旧库但不在标准路径，停止常规发布，先另行审核在线备份/停本API后迁移数据的方案；不在未知路径下启动空数据库。已运行的旧API若不是独立qiulegeqiu服务，不擅自停止。

## 3. 将修改的资源与隔离边界

| 资源 | 目标 |
|---|---|
| 静态前端 | `/var/www/qiulegeqiu/index.html`及追加的assets，保留旧hash资源 |
| 只读源仓库 | `/home/ubuntu/qiulegeqiu`；不git pull、不覆盖有改动的源文件 |
| 独立运行时/版本 | `/opt/qiulegeqiu-api/node`、`releases/<版本>`、`current` |
| SQLite | `/var/lib/qiulegeqiu/leaderboard.sqlite`，WAL、busy_timeout=5000 |
| 数据库备份 | `/var/backups/qiulegeqiu`，专用用户700目录、600文件 |
| 配置备份 | `/var/backups/qiulegeqiu-config`，root专用700目录 |
| 环境 | `/etc/qiulegeqiu-api.env`，root:qiulegeqiu 640；既有文件不覆盖 |
| 独立服务 | qiulegeqiu-api.service、qiulegeqiu-backup.service/.timer |
| Nginx | 新建snippet，仅在**实际确认的ball HTTPS块**加入一行include |

不修改game.gmgnclaw.com的server内容、不触碰8080、不重启/停止其他游戏；不更改防火墙/安全组。Nginx只做`nginx -t`成功后的graceful reload，不restart。Nginx规划器保证目标块之外字节不变；共享域名块、已有其他/api或不能唯一定位时拒绝修改。

## 4. 完整拟执行步骤与命令（全部生产写操作等待确认）

### 本地构建、测试、打包

在审核通过的干净提交上执行（不要从未提交目录打包）：

```sh
npm ci
npm ci --prefix server
npm run typecheck
npm test
npm run build
npm run typecheck --prefix server
npm test --prefix server
npm run build --prefix server
npm run regions
npm run test:deploy
bash deploy/package.sh
sha256sum work/qiulegeqiu-release.tar.gz
```

包内仅dist、server生产build/数据/迁移/依赖锁、部署工具和版本/规则/Git来源标记；不带真实.env、SQLite、源码、node_modules。SOURCE_TREE可与审核提交树核对。下载/上传后必须核对SHA256及tar目录，不能盲信文件名。

```sh
# 以下在你确认生产方案之后才执行；SCP仅上传本项目产物。
scp work/qiulegeqiu-release.tar.gz ubuntu@101.32.209.249:~/qiulegeqiu-release-reviewed.tar.gz
ssh ubuntu@101.32.209.249
```

### 服务器暂存与专用用户（确认后）

```sh
set -eu
stage=$(mktemp -d /home/ubuntu/qiulegeqiu-stage.XXXXXX)
# 先以已确认SHA核对归档，然后检查tar -tzf只包含预期路径，拒绝..、绝对路径或链接。
tar -tzf /home/ubuntu/qiulegeqiu-release-reviewed.tar.gz
# 确认列表后才解压已核验的本项目归档。
tar -xzf /home/ubuntu/qiulegeqiu-release-reviewed.tar.gz -C "$stage"
test -z "$(find "$stage" -type l -print -quit)"
getent passwd qiulegeqiu || sudo useradd --system --user-group --home-dir /var/lib/qiulegeqiu --no-create-home --shell /usr/sbin/nologin qiulegeqiu
# 已存在目录/属主/符号链接须按只读报告核对，不对旧库先行chown/chmod。
for path in /var/lib/qiulegeqiu /var/backups/qiulegeqiu; do
  if ! sudo test -e "$path"; then sudo install -d -o qiulegeqiu -g qiulegeqiu -m 700 "$path"; fi
done
sudo bash "$stage/deploy/install-runtime.sh" --apply
```

安装脚本固定v24.19.0，校验官方SHA以及已核实的x64/arm64固定摘要；不替换已有不同运行时，不改变系统Node。其他架构或glibc低于2.28会停止；不擅自升级共享服务器操作系统。

### 环境与systemd（确认后）

```sh
# 若已有env，保留；其DB_PATH或生产Cookie模式不同必须先审核迁移。
if ! sudo test -e /etc/qiulegeqiu-api.env; then
  sudo install -o root -g qiulegeqiu -m 640 "$stage/deploy/qiulegeqiu-api.env.example" /etc/qiulegeqiu-api.env
fi
sudo /opt/qiulegeqiu-api/node/bin/node "$stage/deploy/check-production-env.mjs"
# 如三个同名unit已有内容/别名，先审核并备份，不盲目覆盖。批准后的备份安装：
sudo install -d -m 700 /var/backups/qiulegeqiu-config
stamp=$(date -u +%Y%m%dT%H%M%SZ)
for name in qiulegeqiu-api.service qiulegeqiu-backup.service qiulegeqiu-backup.timer; do
  target="/etc/systemd/system/$name"
  if sudo test -L "$target"; then echo '既有unit为链接，停止核对'; exit 1; fi
  if sudo test -f "$target"; then sudo cp -p "$target" "/var/backups/qiulegeqiu-config/$name.$stamp";sudo chmod 600 "/var/backups/qiulegeqiu-config/$name.$stamp";fi
  sudo install -m 644 "$stage/deploy/$name" "$target"
done
sudo systemctl daemon-reload
sudo systemctl enable qiulegeqiu-api.service
```

环境的非秘密部分为：

```ini
NODE_ENV=production
PORT=8091
PUBLIC_ORIGIN=https://ball.gmgnclaw.com
DB_PATH=/var/lib/qiulegeqiu/leaderboard.sqlite
```

[完整API服务](../deploy/qiulegeqiu-api.service)：专用非root用户、独立Node、Restart=on-failure、UMask0077、ProtectSystem=strict、仅/var/lib/qiulegeqiu可写、256M限制、stdout/stderr进journal。生产请求日志只记录方法/无查询参数的路径，移除Cookie/认证/CSRF，不打印会话凭据。

### 发布API与前端（确认后）

```sh
sudo bash "$stage/deploy/publish.sh" --apply "$stage"
```

脚本验证路径/属主/旧库/环境/锁；先把未激活的新release准备好，**若已有标准DB，必须在线备份成功**才装依赖、切换/迁移/重启。不存在标准DB但发现旧库或旧API时停止，不新建空榜。第一部署无旧DB会记录明确事件。

只在本项目release用独立npm及独立cache，生产安装ignore-scripts，不修改其他项目依赖。只restart qiulegeqiu-api；校验健康、规则版本、真实systemd PID与127.0.0.1:8091监听，成功才原子切HTML。失败自动回旧API指针/HTML（首次只停止新API），**不恢复覆盖数据库**，保留数据和诊断。

### Nginx（确认实际站点路径并审阅差异后）

新增[完整snippet](../deploy/nginx-api.conf.example)。关键配置：

```nginx
location ^~ /api/ {
    proxy_pass http://127.0.0.1:8091;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Cookie $http_cookie;
    proxy_pass_header Set-Cookie;
    proxy_connect_timeout 3s;
    proxy_send_timeout 15s;
    proxy_read_timeout 15s;
    client_max_body_size 256k;
    proxy_cache off;
    proxy_no_cache 1;
    proxy_cache_bypass 1;
}
location ~* \.(?:sqlite(?:-(?:wal|shm))?|db|env)$ { return 404; }
```

不缓存提交和榜单，跨设备立即读同一SQLite。后端统一no-store，生产无宽松CORS。未在location加覆盖继承的add_header，保留原站HSTS等设置。若使用CDN，先核对现有可信real_ip配置，不直接信任客户端伪造XFF，不修改其他站点的全局真实IP策略。

```sh
# site_file须替换为只读检查确认的真实ball站点文件，不能猜测。
site_file=/etc/nginx/sites-available/只读检查确认的ball文件
# 先生成proposal用于人工diff审阅；不会重写实际配置。
sudo /opt/qiulegeqiu-api/node/bin/node "$stage/deploy/nginx-plan.mjs" "$site_file" "$stage/ball-proposed.conf"
sudo diff -u "$site_file" "$stage/ball-proposed.conf" || true
# 批准的差异应仅有ball HTTPS块内一行：
# include /etc/nginx/snippets/qiulegeqiu-api.conf;
sudo bash "$stage/deploy/activate-nginx.sh" --apply "$site_file"
```

激活脚本先验证原nginx -t、备份站点及旧snippet，再安装只属于ball的include；新nginx -t通过才reload。失败恢复原配置，不触碰game域名或后端。若站点已有/api，先检查是否已正确代理，正确则跳过配置变更，不能强行覆盖。

## 5. 每日备份

```sh
# current部署成功后才启用，Persistent会补上错过的计划。
sudo systemctl enable --now qiulegeqiu-backup.timer
sudo systemctl start qiulegeqiu-backup.service
sudo systemctl status qiulegeqiu-backup.service --no-pager
sudo systemctl list-timers qiulegeqiu-backup.timer --all
sudo journalctl -u qiulegeqiu-backup.service -n 30 --no-pager
```

[服务](../deploy/qiulegeqiu-backup.service)/[定时器](../deploy/qiulegeqiu-backup.timer)：北京时间每日03:15起，随机延迟≤5分钟，掉线重启后补执行；与数据库恢复共享维护锁，调用SQLite在线backup API，完整性/外键/统计验证后原子命名。保留滚动7天，只清理脚本自己的过期文件，未知文件/符号链接不删。失败输出明确JSON并非零退出，journal和unit结果可查询。备份含会话哈希与申诉，不放静态目录；离机方案预留用运营公钥加密后复制到另行授权的独立存储，不自动上传或索取密钥。

## 6. 回滚与恢复

代码/HTML回退，不修改数据库：

```sh
sudo bash /opt/qiulegeqiu-api/current/deploy/rollback.sh --apply
```

Nginx回退：保留激活脚本输出的明确备份供比对，优先只移除本次在ball HTTPS块增加的include，避免用整份旧文件覆盖后来其他站点的合法变更。若此前已有本项目snippet，按明确备份恢复；没有则可保留未被引用的snippet，不影响其他站点。

```sh
# site_file沿用只读检查和审批时的准确路径。
sudoedit "$site_file"
# 仅撤销ball HTTPS块内的include /etc/nginx/snippets/qiulegeqiu-api.conf;
sudo nginx -t
sudo systemctl reload nginx
```

保留原TLS、其他文件和game块原字节，不做全目录覆盖。重新关闭API时旧游戏仍可单机运行。

数据库恢复是另一项有数据覆盖影响的操作，本轮部署确认**不授权自动恢复**。先指定备份校验、当前在线快照，单独确认后才运行：

```sh
sudo bash /opt/qiulegeqiu-api/current/deploy/restore.sh --apply /var/backups/qiulegeqiu/已确认的备份.sqlite --confirm-overwrite
```

恢复同时锁定本项目发布锁和数据库维护锁（与每日备份/发布前快照互斥），验证本项目schema/完整性，预备恢复文件以防被保留策略清理；仅停止本API，归档原DB/WAL/SHM并恢复，启动检查。保留旧数据归档，禁止自动删除或以空库替代。

## 7. 上线验收表（公网均待生产确认与连接后执行）

| 项目 | 验证方式 |
|---|---|
| 首页200/静态资源/TLS | curl HEAD与真实浏览器网络面板；证书信任与有效期 |
| API健康/仅loopback | curl https://ball.gmgnclaw.com/api/health；systemctl status；ss对照PID |
| 昵称审核/地区/组合唯一 | 两个独立浏览器同基础名、不同国家；第三次同组合409；安全昵称违规400 |
| A提交、B同一榜单 | 使用“验收”标识真实游玩与登记；B读取同一TOP100分页；低分若未入TOP100须记录真实排名，不能清旧数据制造通过 |
| 最高分更新、低分不覆盖 | A真实再次游玩，高于旧记录后更新；再提交较低分仍保留高分 |
| 刷新与身份 | A刷新后/api/me返回相同player ID/最高分，检查Secure/HttpOnly/SameSite |
| 重启与reload持久性 | 重启**仅qiulegeqiu-api**后A/B复查；nginx -t后reload再复查 |
| 备份/恢复 | 手动触发backup unit，核对600文件和完整性；恢复仅在隔离目录演练，不覆盖生产 |
| API故障不崩溃 | 浏览器拦截/api而非停止其他服务，验证开始/暂停/重开/跳过提交 |
| 统帅三国隔离 | game域名与8080只读前后对照；game配置字节不变，不发任何停止/重启命令 |

现有自动化联网脚本会注入测试状态，只用于隔离数据库预发布验收，不直接对公网正式榜运行。正式验收真实游玩；如需封禁验收账号以免占榜，另记录玩家ID并通过本项目管理CLI带理由处理，不删除其他玩家。

## 8. 审批边界

等待确认的是：以上目标版本、独立路径/Node/服务、ball-only Nginx include、数据库保留与每日7天备份、具体服务器命令。生产访问凭据/实际只读报告未提供前，不能核实最后的站点文件和旧数据迁移细节；不能声称公网15项已通过。本次只提交独立PR，不自动合并。
