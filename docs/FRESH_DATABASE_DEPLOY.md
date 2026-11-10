# V1.3：显式全新数据库部署

本模式针对用户已授权放弃球球出击全部历史成绩、玩家、昵称、地区选择、会话与微信绑定的场景。**本PR只开发和本地验证，未登录或部署服务器。** 默认部署仍保留数据，只有完整重置参数才进入此流程。

## 作用范围与硬性门禁

唯一数据库为`/var/lib/qiulegeqiu/leaderboard.sqlite`，只允许同时处理它的`-wal`、`-shm`、`-journal`，不接受自定义数据库路径。配置文件DB_PATH、systemd环境文件/User/WorkingDirectory、覆盖配置和运行进程的实际环境、cwd及SQLite句柄均要核对；路径不同、链接、未知环境覆盖或无法核实时停止。不读取或清理其他网站数据库。

重置前三重确认：

```text
--reset-database
--confirm-reset RESET-QIULEGEQIU-ALL-DATA
--reset-id 一个本次审核确定的唯一批次（建议完整提交SHA）
```

缺少任何一项即停止，即使是dry-run。`--apply`会先完整重复预检查。dry-run不停止服务、不打开SQLite、不备份或更改数据。

现有十关回退门禁仅在**已核验的显式重置事务**中放行：必须已有完整旧库快照、批次与包提交一致、新库epoch匹配，且由持有部署锁的一键安装器调用。普通部署仍要求兼容回退基线，没有增加`--force`或环境变量绕过。

## 执行顺序

1. 校验审核提交、包SHA256/清单/资源、依赖与生产独立Node24.19.0配置；核实唯一数据库路径和实际服务，不修改系统Node。
2. 记录旧程序指针、网页、配置及服务/备份timer状态，生成私有事务目录和可执行的配套回退脚本。
3. 停止`qiulegeqiu-api.service`、本游戏备份timer/service，取得维护锁；助手再次核实它们全部停用，扫描数据库文件句柄。发现读写进程或无法检查即停止。
4. 停服完整归档主库、WAL、SHM、回滚日志到`database-original`，保存每个文件的SHA256/权限/属主，fsync；在**副本**打开SQLite做完整性验证，不在原库上执行恢复或checkpoint。只有全部成功才清理原文件。
5. 原子安装全新空库，写入`deployment_reset_epoch`部署批次元数据，属主为专用用户、权限600。旧用户数据不导入；必要001～004迁移及标准地区目录由新版API初始化。标准行政区划目录不是旧玩家地区选择数据，仍须重新种入。
6. 验证候选生产依赖、SQLite与真实启动；启动新API迁移新库，发布网页，验证global协议、health、分页、身份和重启持久性，再启用本游戏每日备份。
7. 全部通过后将批次标记complete；同一审核提交/同一包/同一批次重跑只执行保留数据部署，不再清空新成绩。

新库只有十二关规则可创建挑战：`1.2.0-arcade-5l-12lv-v1`。旧十关客户端会收到CLIENT_UPDATE_REQUIRED与刷新提示，不能把旧十关新成绩混入新榜；保留数据模式仍兼容原有旧协议。网页与微信共用`/api/leaderboard?board=global`的TOP100与真实个人排名。

## 一键命令（OrcaTerm中审核后执行）

先从本PR审核提交构建新的包，不能混用旧包/新安装器：

```bash
npm ci
npm ci --prefix server
bash deploy/package.sh
sha256sum work/qiulegeqiu-release.tar.gz
git rev-parse HEAD
```

将同一审核提交的干净源码和发布包准备到`/home/ubuntu/qiulegeqiu`，包在`work/qiulegeqiu-release.tar.gz`。实际HTTPS站点文件必须来自已核实的ball站点，不猜测路径。不要给出《统帅三国》的站点文件。

**先复制以下一行，输入真实审核值，执行dry-run：**

```bash
cd /home/ubuntu/qiulegeqiu && read -r -p '审核提交完整SHA：' REVIEWED_COMMIT && read -r -p '审核包SHA256：' REVIEWED_SHA256 && read -r -p 'ball HTTPS站点实际文件：' BALL_SITE && sudo bash deploy/first-production-install.sh --dry-run --reset-database --confirm-reset RESET-QIULEGEQIU-ALL-DATA --reset-id "$REVIEWED_COMMIT" --commit "$REVIEWED_COMMIT" --sha256 "$REVIEWED_SHA256" --site-file "$BALL_SITE"
```

**dry-run核对完成且部署获准后，一键执行：**

```bash
cd /home/ubuntu/qiulegeqiu && read -r -p '审核提交完整SHA：' REVIEWED_COMMIT && read -r -p '审核包SHA256：' REVIEWED_SHA256 && read -r -p 'ball HTTPS站点实际文件：' BALL_SITE && sudo bash deploy/first-production-install.sh --apply --reset-database --confirm-reset RESET-QIULEGEQIU-ALL-DATA --reset-id "$REVIEWED_COMMIT" --commit "$REVIEWED_COMMIT" --sha256 "$REVIEWED_SHA256" --site-file "$BALL_SITE"
```

这是一条可直接输入的交互命令，不包含虚假密钥或猜测的站点文件。脚本不会自动Git拉取/合并；源码HEAD、安装器和包不一致会停止。此次未执行该命令。

## 备份、失败恢复与重复执行

- 事务记录：`/var/backups/qiulegeqiu-install/<时间-PID>/`，root私有700；`database-original/manifest.json`及同目录SQLite/WAL文件为部署前完整镜像。
- 批次账本：`/var/backups/qiulegeqiu-reset/<reset-id>.json`，root私有；无公开HTTP访问，不在dist。
- 重置快照不由每日7天清理任务自动删除，须保留到验收及回滚窗口结束，再另行人工审批清理。
- 每日新库在线备份仍在`/var/backups/qiulegeqiu`，保留7天。
- 自动失败恢复：先停API和备份任务，再恢复旧程序/配置与**配套数据库镜像**，最后才启动原先运行的API。新库已产生的文件会先完整另存`database-failed-new`（即使它已损坏也保存原始字节），方便审计，不混回旧库。
- 快照损坏、句柄占用、systemd状态不明或恢复失败时保持API停止，不能让旧程序接入不匹配的新库。
- 杀进程/断电可能中断自动trap：prepared批次会阻止后续普通部署和再次清库，必须先使用该事务回退并检查状态。文件/清单fsync和数据库副本校验不能替代运维对磁盘故障的处理。
- complete批次必须仍匹配当前数据库epoch才可重复运行；更换包或丢失/替换数据库都会停止，不盲目重建。已回退批次不能再次清库，确认恢复正确后如需重试，使用新的明确批次ID（例如审核SHA加`-try2`）。

配套人工回退（实际目录取自安装日志；**会恢复部署前数据库**，额外确认不可省略）：

```bash
sudo bash /var/backups/qiulegeqiu-install/实际事务目录/rollback-install.sh --apply --confirm-reset-rollback
sudo nginx -t
sudo systemctl status qiulegeqiu-api.service --no-pager
```

必须在本次事务仍是当前发布、没有后续配置变更时使用。成功后产生的新成绩会先归档，再恢复旧镜像；如果已经有后续重置，旧事务不能覆盖新epoch。不要用普通`deploy/rollback.sh`替代本次“程序+DB”配套恢复。默认非重置发布的回滚仍从不回写数据库。

## 旧会话与客户端恢复

旧网页Cookie对应的DB会话已经不存在，GET me自动创建新匿名会话；页面解锁昵称和地区，允许重新登记（包括使用已释放的旧昵称），不会按昵称恢复旧ID。旧微信凭据收到401后，身份GET最多wx.login续登一次；仍失败即明确终止，不循环登录，旧绑定码不可使用，须重新绑定。

每次新挑战创建前更新身份。已经开始的旧挑战因清库失效，401/404/409/410等永久错误停止自动上传；503暂时故障有退避，不因积压128条事件每帧重试。旧事件/成绩写请求不会在新身份下自动重放。用户重新开始新挑战后才能提交新成绩。已经打开的旧版本网页/小游戏需刷新或更新，以取得这些客户端修复。

## 发布后验收（本次尚未执行生产验收）

```bash
curl -fsS https://ball.gmgnclaw.com/api/health
curl -fsS 'https://ball.gmgnclaw.com/api/leaderboard?board=global&limit=20'
sudo systemctl status qiulegeqiu-api.service --no-pager
sudo systemctl list-timers qiulegeqiu-backup.timer
```

确认supportedRulesVersions仅为十二关、board为global；核对事务记录的新库初始化日志和备份完成。正式玩家可能已经加入，不能为了断言榜单为空再清库。

使用本人真实浏览器/微信：旧会话重新登记、正常游玩直到Game Over、提交真实成绩、另一端查询相同榜单、刷新及重启后记录保持。不要伪造生产玩家/正式成绩作验证；真实微信登录需保留有效AppID/AppSecret，未配置时只能单机或网页，不伪造成功。

《统帅三国》仅沿用既有只读HTTPS可用性检查；不改其站点、Docker、8080、数据或服务。Nginx仅修改已核实ball HTTPS站点，仍先nginx -t再reload。

## 开发验证

运行前后端类型检查、测试和构建，小游戏类型检查/产物测试、regions校验及部署测试。新增测试使用临时目录、受控Node24和随机回环端口，不接触真实生产路径或systemd。覆盖首次空库、WAL恢复、损坏镜像、句柄/链接拒绝、程序+DB恢复顺序、同批次重跑、未完成批次阻断、跨批次保护、旧会话、昵称释放、微信绑定失效、跨端真实事件校验及最高分。

完整publish故障注入验证旧十关基线在有配套镜像时放行、缺Fastify仍阻止切换；普通保留模式的备份/兼容性回归保留。CLI预检查、真实systemd/Nginx、生产数据库路径和真人提交仍须审核后在服务器验收。

本次实际通过：前端199项、后端59项、部署36项、小游戏产物3项；网页/后端/小游戏类型检查与构建通过。浏览器主流程两名玩家登记/地区/真实日志提交/刷新及断网重试、微信wx兼容层3尺寸、旧服务/502/身份过期场景回归通过。小游戏兼容层不代替官方工具/真机。

修改文件见[FRESH_DATABASE_FILES.md](FRESH_DATABASE_FILES.md)，验证摘要见[fresh-database-validation.json](fresh-database-validation.json)。
