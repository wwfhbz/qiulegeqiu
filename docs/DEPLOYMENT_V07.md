# 腾讯云排行榜部署与回滚（尚未执行）

仅针对ball.gmgnclaw.com与qiulegeqiu-api。当前环境无服务器SSH凭据，未核验远程Node/内存/文件状态；未连接或改变生产环境。既有game.gmgnclaw.com、8080、《统帅三国》文件/服务/Nginx配置禁止触及。

## 准备

1. 在授权终端只读核对Ubuntu版本、Node位置/版本（要求24 LTS）、8091空闲、现有ball域名server块及/var/www/qiulegeqiu真实路径。保留当前HTTPS证书设置。
2. 创建专用系统用户qiulegeqiu、/opt/qiulegeqiu-api/releases、/var/lib/qiulegeqiu（属主qiulegeqiu，700）、/var/backups/qiulegeqiu（700）。数据库固定/var/lib/qiulegeqiu/leaderboard.sqlite，永不放进静态目录。
3. 从server/.env.example生成/etc/qiulegeqiu-api.env，root:qiulegeqiu、640，PUBLIC_ORIGIN=https://ball.gmgnclaw.com、NODE_ENV=production、PORT=8091。第三方审核凭据在服务器安全配置，不能写进源码/前端变量。
4. 安装deploy/qiulegeqiu-api.service为专用systemd单元（需确认/usr/bin/node为24），仅enable qiulegeqiu-api。不停止任何其他服务。

## 构建与发布

本地bash deploy/package.sh执行前后端检查/测试/构建，产物work/qiulegeqiu-release.tar.gz。包内dist仅生产HTML/资源；另有server/build、运行依赖清单/锁、数据、迁移和部署工具；不带数据库、.env、源码、node_modules。

在有授权的Windows PowerShell终端：

```powershell
scp .\qiulegeqiu-release.tar.gz ubuntu@101.32.209.249:~/qiulegeqiu-release.tar.gz
ssh ubuntu@101.32.209.249
```

核实SSH主机指纹，不关闭校验。在服务器用户目录新建暂存目录、检查tar列表，解压后只从该目录发布。首次建立数据库可在release/server工作目录用指定DB_PATH运行node build/manage.js migrate；服务启动也会执行幂等迁移。

```sh
# 对审核后的解压目录操作，脚本仅指定项目路径，需要root权限。
sudo bash /你的暂存目录/deploy/publish.sh --apply /你的暂存目录
```

脚本仅安装独立release/server的生产依赖、切换/opt/qiulegeqiu-api/current、重启qiulegeqiu-api、检查8091/api/health；随后给本游戏静态目录添加哈希资源并原子切换index.html。旧资源和数据库保留，不修改Nginx。服务健康失败不切HTML，执行回滚。

## Nginx与HTTPS

人工审核deploy/nginx-api.conf.example，只将/api/代理location加入现有ball.gmgnclaw.com HTTPS server块。不得替换整个配置、默认证书、game域名配置或8080代理。API只监听127.0.0.1:8091，无需开放公网8091安全组。

可选限流定义只新增命名区域，在http上下文：

```nginx
limit_req_zone $binary_remote_addr zone=qiulegeqiu_api:10m rate=20r/s;
```

再启用location内对应limit_req。后端自身已有持久化频控。已有HTTPS重定向保持不变。配置审核后执行nginx -t，通过才reload（reload不停止Nginx；本次开发未执行）。保持原静态缓存策略，HTML建议no-cache，带hash资源可长期缓存。

## 验收

/api/health为JSON；检查Secure/HttpOnly/SameSite cookie、注册/查重、真实挑战提交、分页、刷新后个人最佳。直接访问dist不应看到数据库、审核词库或密钥；前端构建不导入server。核对game域名与8080原服务保持原状（只读验证，不修改）。API断网/503时游戏仍可运行、暂停、重开和跳过提交。

## 备份、恢复、回滚

- 每日由授权运维调用node deploy/backup.mjs，使用SQLite在线backup API，覆盖WAL一致状态，再做integrity_check。备份写/var/backups/qiulegeqiu，600权限；建议离机加密保存，保留至少7日/4周。备份包含敏感会话哈希与申诉，不能放公开网站或分享。
- sudo bash deploy/restore.sh --apply /var/backups/qiulegeqiu/明确文件.sqlite：先完整性/外键校验和当前在线备份，再仅停止qiulegeqiu-api，归档原db/wal/shm、安装恢复文件，启动同一服务并健康检查。仅在维护窗口执行；未在生产运行。
- sudo bash deploy/rollback.sh --apply：恢复上一API release与旧HTML，保留当前数据库和全部资源。首次上线没有旧API时，仅停止本排行榜API并恢复旧HTML。当前001迁移为新增独立数据库，未来破坏性迁移需先制作向后兼容迁移与备份恢复计划，不自动降级数据库。

开发验证范围：脚本bash -n、包内容检查、内存SQLite与文件SQLite API、实际浏览器联网；systemd/Nginx/生产路径权限与远程备份恢复需在授权服务器验收，不能将本地通过描述为已经上线。

## V0.8兼容补充

V0.8需同步更新前后端，002追加challenge.seed列且仅执行一次，001旧库可平滑升级，原玩家/成绩保留。旧规则挑战不能用新计分器提交，已验证历史最佳不重算。回滚到V0.7仍可读取增加seed列的数据库；不自动降级schema。新版本打包脚本复用本流程，仍未执行线上操作。
