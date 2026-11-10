# 首次生产安装

本流程只操作球球大突破的专用资源，不登录服务器，不推送 Git，不操作 Docker、8080、防火墙、其他游戏站点。生产执行仍需负责人确认。默认 dry-run；`--apply` 会先重复全部预检查。

## 审核及打包

先审核并提交本分支，包括安装器、所有部署辅助工具及游戏源码。合并或选定版本必须由负责人决定。在**干净的选定提交**执行：

```bash
npm ci
npm ci --prefix server
bash deploy/package.sh
sha256sum work/qiulegeqiu-release.tar.gz
git rev-parse HEAD
```

保留经独立渠道审核的 SHA256 和完整提交 SHA。压缩包包含 `SOURCE_COMMIT`、`SOURCE_TREE`、逐文件 `RELEASE_MANIFEST.json`。安装器将逐字比对包内部署工具、地区数据、迁移及后端依赖清单与 Git 提交，检查前端资源引用，并拒绝链接、重复路径、路径穿越、敏感文件和缺失产物。外部审核的包哈希才是信任锚点；自报清单不能证明任意构建产物源自源码，也不等同于签名构建证明。

**旧发布包缺少这些文件时必须重新构建打包，不能把新安装器与旧发布包拼接。** 包与安装器来自同一 Git 提交，源码目录有已跟踪修改时拒绝运行。

## 服务器预备与完整命令

服务器需有 python3、git、curl、tar、xz、flock、ss、Nginx、systemd、runuser 和已有系统 Node22。Python 仅使用标准库。预先安装依赖不属于本脚本；缺少工具时停止。

专用用户 `qiulegeqiu` 已存在，数据库目录 `/var/lib/qiulegeqiu` 和备份目录 `/var/backups/qiulegeqiu` 均由其所有、权限700。网站目录不能含符号链接。将审核后的完整源码和发布包放入指定路径。先通过 `sudo nginx -T` 人工定位 **ball.gmgnclaw.com 的 HTTPS 站点文件**，不要猜测文件名。

```bash
cd /home/ubuntu/qiulegeqiu
# 以下变量必须替换成实际审核值及真实站点文件；不提供虚构值。
read -r -p '审核提交SHA：' REVIEWED_COMMIT
read -r -p '发布包SHA256：' REVIEWED_SHA256
read -r -p 'ball HTTPS站点文件：' BALL_SITE
sudo bash deploy/first-production-install.sh --dry-run \
  --commit "$REVIEWED_COMMIT" --sha256 "$REVIEWED_SHA256" --site-file "$BALL_SITE"
# 审核dry-run结果并获得生产部署确认后，才执行下一条：
sudo bash deploy/first-production-install.sh --apply \
  --commit "$REVIEWED_COMMIT" --sha256 "$REVIEWED_SHA256" --site-file "$BALL_SITE"
```

默认包路径 `/home/ubuntu/qiulegeqiu/work/qiulegeqiu-release.tar.gz`，可用 `--package` 指定。dry-run只读取生产状态，临时解析文件退出时清理；不安装、重启、修改配置或打开数据库。官方运行时下载、依赖下载、SQLite在线备份及完整上线验证仅在apply执行。

遇到已有其他 `/api` 规则、混用域名的HTTPS块、未知服务定义、systemd drop-in、配置冲突、旧数据库位于其他路径等情况会停止。已有正确的本项目 include 和片段允许重复执行。已有直接写入的 `/api` location 即使看似相同，也先停止人工审核，不重复添加。

## 资源与配置

- 独立运行时：`/opt/qiulegeqiu-api/node`，Node v24.19.0，下载官方归档和 SHASUMS256.txt，同时匹配代码内固定SHA。重复运行也校验整个官方运行时目录；不修改系统Node。
- API版本：`/opt/qiulegeqiu-api/releases/`，current原子切换。
- 环境：`/etc/qiulegeqiu-api.env`，root:qiulegeqiu、640。已有文件保持原文；缺少必填字段或值冲突停止，人工补齐后重跑。不存在时写入 NODE_ENV=production、PORT=8091、PUBLIC_ORIGIN=https://ball.gmgnclaw.com、DB_PATH=/var/lib/qiulegeqiu/leaderboard.sqlite。会话随机凭据由后端生成，不使用虚假密钥；第三方审核如启用必须自行配置真实地址与凭据，禁止把凭据放进命令行或Git。
- API服务模板：`deploy/qiulegeqiu-api.service`；专用用户、只允许写数据库目录，ExecStart使用独立Node，监听127.0.0.1:8091。
- 数据库：`/var/lib/qiulegeqiu/leaderboard.sqlite`，WAL、busy_timeout，启动执行幂等迁移。发现旧库必须先在线备份成功，才能启动新版本；不删除、不覆盖数据库。
- Nginx：只在已核实的ball HTTPS块中插入本项目include，内容见 `deploy/nginx-api.conf.example`，代理至127.0.0.1:8091。修改前备份，`nginx -t`成功才reload；不覆盖nginx.conf或其他站点。
- 定时器：每日北京时间03:15附加随机延迟，Persistent=true，保留最近7天自有在线备份；立即运行一次并检查服务Result。备份内置完整性、外键检查，失败不清理旧备份。

## 失败回退和人工回退

记录目录：`/var/backups/qiulegeqiu-install/<时间>-<PID>/`，权限700，含原配置、HTML、旧API指针及原服务启用状态。失败自动尝试恢复这些资源并恢复原Nginx配置及reload。必须查看错误日志确认回退各命令成功；机器断电或kill -9不能依赖shell trap。

需要人工回退且确认记录属于本次发布时：

```bash
sudo bash /var/backups/qiulegeqiu-install/实际记录目录/rollback-install.sh --apply
sudo nginx -t
sudo systemctl status qiulegeqiu-api.service --no-pager
```

回退脚本故意返回非零，表示本次安装已撤回。**回退不恢复、不覆盖、不删除数据库**，也不撤销已执行迁移；迁移必须向后兼容旧API，否则先人工审核，不执行部署。首次安装无旧API时停止新API并撤销current指针。新增独立运行时、release及只增不删的assets保留，不碰其他网站。执行人工回退前应确认此后没有其他配置变更，避免恢复旧配置覆盖后续工作。

在线备份在 `/var/backups/qiulegeqiu`，查看 `journalctl -u qiulegeqiu-backup.service`。数据库恢复属于独立破坏性操作，本安装器绝不调用；若确需恢复，先人工审核既有 `deploy/restore.sh` 和部署文档并另行确认。

## 验收清单及边界

脚本检查网页及API返回成功、health数据库ready、排行榜分页结构、匿名会话与best查询、重启后同一DB文件及会话保留、服务开机启用、备份timer启用、立即备份成功、另一个游戏HTTPS正常。TOP100分五页各20条查询并检查响应结构；真实玩家的个人排名需人工验收。

- 使用已有真实玩家身份检查个人排名和历史最高分。
- 两台设备查看同一真实榜单；真实挑战更高分更新、低分不覆盖。
- 浏览器刷新后身份保留，API故障时单机游戏正常。
- `sudo journalctl -u qiulegeqiu-api.service -n 50 --no-pager`
- `sudo systemctl list-timers qiulegeqiu-backup.timer`
- 确认 `game.gmgnclaw.com` 继续正常。

本开发环境仅执行归档/Git夹具测试、备份测试、Nginx规划测试和静态保护检查；没有连接腾讯云，也没有验证真实systemd/Nginx安装或完整生产失败注入。因此不能把开发测试通过当作已经上线。首次生产dry-run输出仍须审核。
