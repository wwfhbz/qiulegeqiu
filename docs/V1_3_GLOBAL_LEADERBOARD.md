# V1.3 全球历史排行榜：修复、兼容与发布

## 排名口径（已获用户确认）

采用“统一重赛上榜”。十二关增加1800砖、两次通关奖励，其关卡编号和有效游戏用时也不同，不能把旧十关原分与新分直接公平比较。本版没有发明换算公式。

玩家界面只有一个**全球历史排行榜**：网页/微信读取同一个十二关规则下的历史最高有效成绩。旧十关成绩完整保留，在自己的记录中显示原分与原关卡，不附加一个冒充全球排名的“1”；旧玩家用同一身份完成一次新版挑战（包括合法Game Over成绩）后参与统一排名，不要求必须打通12关。没有新挑战记录的人显示“未上榜”，并非删除旧成绩。

客户端/服务版本1.3.0；游戏规则仍为`1.2.0-arcade-5l-12lv-v1`，因为这次未改变玩法或计分。旧十关`0.8.0-arcade-5l-10lv-v1`继续验证和保存，不直接参与十二关榜。

## 实际发现与修复

| 问题 | 根因与处理 |
|---|---|
| 截图的“尚未支持此赛季”阻止登记 | 旧assertRulesVersion把缺少元数据与真正不支持混为一谈，且放在获取CSRF身份的me中。旧后端可能忽略新查询参数，返回200却不带版本。现在身份建立不依赖榜单元数据；榜单独立检查global协议，挑战先查询health支持列表，拒绝用错误规则创建挑战。 |
| 接口错误被误解为版本问题 | 网页将200的非JSON响应转成普通message对象，后续触发版本检查。两端统一ApiResponseError，分别报告HTTP状态、无效响应、明确UNSUPPORTED_RULES与协议缺失；502 HTML不再提示赛季错误。 |
| 历史记录/个人名次混淆 | V1.2新旧榜分开，旧用户在新榜无记录或仅一名新玩家自然为第1，并非已有证据证明SQL总返回1。现在个人旧记录明确归档、全球rank只来自同一个统一查询。105名夹具证明榜外第105名仍返回105。 |
| 最佳分缓存可能掩盖真实有效分 | 统一榜直接从scores/challenges中选择每名玩家最高有效记录，不依赖可能过时或缺失的best指针；原指针继续供旧客户端兼容，不重写存量数据。 |
| 满页末尾空翻页 | 原接口以“本页满了”推断存在下一页。现在检查下一条记录，并严格限定TOP100，恰好20条且后面为空时nextOffset为null。 |
| 身份过期后无法重新登记 | applyMe原先只处理已绑定状态，不恢复匿名表单。现会解锁昵称/地区，清除旧身份昵称并提示不能凭名称恢复；同时取消过时的昵称查重回调。 |
| 已保存却误报提交失败 | 提交后的me/榜单刷新失败进入同一catch。现在保留服务器已确认的保存结果，单独提示刷新失败或后端待更新。 |
| 提交后偶尔读到旧最佳 | 强制刷新遇到已有身份请求时复用了提交前的在途响应。现在等在途请求结束后重新读取；新增并发刷新回归。 |
| 旧上传/提交串到重开的挑战 | 原submit在await flush后才读取this.run，可能读到新回合。现在在等待前捕获run与generation，等待后复核，两者变化即拒绝旧提交。 |
| 伪造零球道具事件 | 客户端已禁止全灭后拾取，但服务端只检查running，没有检查球数。现对life/triple等全部power强制balls>0，堵住抵消扣命/零球扩球路径。 |
| 微信个人会话失效隐藏公开榜 | 私人me请求401导致整段公开榜展示失败。现个人记录失败只提示重新登录，公开榜仍可读；绑定按微信身份限流，换会话不能绕过。 |
| 发布重启验收误回退 | 原比较整份me JSON，其他玩家提交导致名次变化也算失败。现只比较玩家ID/CSRF的持久性，并单独验证榜单协议。 |
| 只检查同一规则标识不足以判断后端已升级 | V1.2和V1.3游戏规则相同，但前者没有global接口。候选启动、publish和首次安装现在额外检查global协议、支持列表及分页响应。 |

**生产事实边界**：尝试只读访问`https://ball.gmgnclaw.com/api/health`被本环境网络代理403拒绝，未连到源站。已经通过旧后端夹具复现截图同类错误，但不能据此断言线上实际运行哪一提交，或已在生产成功登记。需要运维在服务器运行下文只读验收。未SSH、未部署、未修改线上数据库或《统帅三国》。

## 查询与兼容API

新网页/小游戏固定使用：

```text
GET /api/leaderboard?board=global&offset=0&limit=20
GET /api/me?board=global
GET /api/me/best?board=global
```

响应包含`board:"global"`、`rankingRulesVersion:"1.2.0-arcade-5l-12lv-v1"`及rulesVersion。me还返回historicalBest（旧记录），best仅为统一榜记录。未上榜best=null，客户端不能填默认rank=1。支持刷新及TOP100分页（最多20条/页），个人名次按全部合资格玩家计算，不限100名。

SQL先按player_id从verified、active玩家、非调试、精确十二关规则成绩中选择最佳，再对玩家排行：分数降序、到达关卡降序、有效用时升序、首次达成时间升序、成绩ID稳定兜底。重复挑战的低分、quarantined、调试和封禁玩家不替代榜单有效最佳。

省略board/rulesVersion的旧请求和显式旧rulesVersion接口仍按旧协议返回历史榜，**仅作缓存旧客户端兼容**；新界面没有相关入口、赛季选择或第二个榜。旧客户端仍能注册、提交旧十关成绩和查询原记录，更新到新客户端后按重赛机制上榜。

挑战创建必须声明规则，后续验证只读取服务端保存的版本。health提供supportedRulesVersions及leaderboard协议。未知规则返回400/UNSUPPORTED_RULES；不把昵称400、网络失败、502或503当作规则错误。新客户端遇到旧后端可以正常单机、跳过登记，并能保留真实身份，不会把旧榜静默冒充新榜。

## 账号与成绩安全排查

- 保留昵称NFKC/大小写空白规范、后端审核及地区+昵称数据库唯一约束；同名不同地区允许，不以昵称认证。
- 保留HttpOnly/Secure/SameSite网页Cookie、微信Bearer会话和CSRF，双方凭据不能交叉当作对方会话使用。
- 绑定须网页登录生成的5分钟随机一次性码+微信登录；过期、重放、并发消费、已登记身份、越权均有回归。新限流按微信identity计数，换token不重置。
- 同一玩家跨端提交更新同一全局记录；独立身份不会按同昵称误合并。幂等键/挑战唯一约束、持久化会话、参数化SQL、IP/会话频控继续有效。
- 继续验证砖块索引/重复计分、关卡/奖励/生命/球数/掉落/时间/摘要；异常隔离，不关闭反作弊。
- **仍无法保证完全防伪造**：当前是客户端物理+服务端事件规则复算，攻击者可构造结构合理的事件。此次修复零球道具漏洞，不把verified宣传为服务端物理回放结果。高价值奖励前仍需服务端输入回放裁决、服务端种子与风控，不用签名或JS混淆冒充彻底防作弊。

## 数据、备份与回滚

V1.3没有新增表、列或数据回填，统一榜通过只读SQL派生。scores、players、原player_bests及season_player_bests均保留；正常新提交仍按原机制插入新score及刷新对应版本指针。本地旧库迁移测试与原样数据比较继续通过。

生产DB仍为`/var/lib/qiulegeqiu/leaderboard.sqlite`，网站之外；已有003/004追加迁移继续幂等，不重建旧库。发布前由既有脚本在线备份并校验，备份目录`/var/backups/qiulegeqiu`。失败回退只恢复本次API指针、HTML和受管配置，绝不删除、覆盖或恢复数据库。

已有十二关成绩后，禁止回退到不认识十二关/赛季的旧API，否则可能混排。安装dry-run/publish新增回退基线检查：旧release的RULES_VERSION必须与新规则一致，缺少标记或仍为十关则停止，**不能猜测或绕过**。需运维先准备经审核的双规则兼容基线；本次没有自动执行这个过渡。V1.2可作兼容代码回退目标，回退客户端会恢复当时分榜UI，但数据和分数仍保留。若没有旧API，首次安装失败会停掉新API并恢复原HTML，保留数据库。

### 一键安全发布命令（审核后由运维执行，本次未执行）

在干净的审核提交构建并检查发布包：

```bash
npm ci
npm ci --prefix server
bash deploy/package.sh
sha256sum work/qiulegeqiu-release.tar.gz
git rev-parse HEAD
```

将**同一审核提交的源码和包**放到`/home/ubuntu/qiulegeqiu`（包为work/qiulegeqiu-release.tar.gz）。不要只上传dist；本次必须同步更新后端。用独立Node24环境完成构建，不替换系统Node22。

```bash
cd /home/ubuntu/qiulegeqiu
read -r -p '已审核完整提交SHA：' REVIEWED_COMMIT
read -r -p '已审核发布包SHA256：' REVIEWED_SHA256
read -r -p '实际ball HTTPS站点文件：' BALL_SITE
DEPLOY_ARGS=(--package /home/ubuntu/qiulegeqiu/work/qiulegeqiu-release.tar.gz \
  --commit "$REVIEWED_COMMIT" --sha256 "$REVIEWED_SHA256" --site-file "$BALL_SITE")
sudo bash deploy/first-production-install.sh --dry-run "${DEPLOY_ARGS[@]}"
# 审核dry-run、备份/兼容基线方案并获得部署确认后，才执行：
sudo bash deploy/first-production-install.sh --apply "${DEPLOY_ARGS[@]}"
```

脚本验证归档、候选运行时/依赖及统一榜协议，备份现有SQLite，只动球球出击资源，先nginx -t再reload。未核实的站点路径、已有冲突配置/不兼容回退基线会停止，不自动覆盖。现有HTTPS、systemd、仅127.0.0.1:8091、独立Node与每日备份策略不变；不改其他站点、8080、Docker、防火墙。

只读生产验收（不注册假玩家/假成绩）：

```bash
curl -fsS https://ball.gmgnclaw.com/api/health
curl -fsS 'https://ball.gmgnclaw.com/api/leaderboard?board=global&offset=0&limit=20'
sudo systemctl status qiulegeqiu-api.service --no-pager
sudo systemctl list-timers qiulegeqiu-backup.timer
```

另用本人真实账号在网页和微信检查个人排名、旧记录、刷新与新挑战提交。服务器如无新协议必须升级后端，改提示文字不能解决此问题。

失败自动回退；经确认的人工回退：

```bash
# 实际记录目录由安装日志给出，执行前核实没有后续配置变更
sudo bash /var/backups/qiulegeqiu-install/实际记录目录/rollback-install.sh --apply
sudo nginx -t
sudo systemctl status qiulegeqiu-api.service --no-pager
```

日常代码回退可用审核后的`sudo bash deploy/rollback.sh --apply`，同样检查规则兼容且不恢复数据库。不要用更早版本脚本绕过门禁。数据库备份恢复是单独的破坏性操作，本任务不执行。

## 测试与截图

前端194项、后端59项、部署26项、小游戏产物3项（见实际运行记录）。前后端/小游戏类型检查与构建、regions校验及Shell语法检查通过。

- 新后端回归：105名、TOP100、榜外名次、并列排序、最高分去重、旧分完整保留、新十二关日志提交、跨端绑定同一玩家、伪造摘要/越权拒绝、零球道具拒绝。
- 原昵称地区/唯一注册/旧提交/账号安全/数据库持久化等51项基线保留，新增8项。
- 浏览器：两名本地玩家真实发射消块、地区选择、登记、提交、刷新身份；断网可跳过；旧后端模拟仍可登记昵称但阻止错误规则挑战；历史记录明确显示、不会冒称全球第1；502 HTML准确提示并可刷新恢复。
- 微信是Chromium中的wx兼容层（3尺寸），不是官方开发者工具/真机或生产微信登录。
- 没有真实线上数据、生产账号操作或线上成绩测试；没有声称彻底防作弊或完成生产发布。

本地预览4173、临时API8091启动后：

```bash
LEADERBOARD_OUT=work/v13 node tests/browser-leaderboard.mjs
node tests/browser-v13-errors.mjs
node tests/browser-v12.mjs
npm run test:browser:ui
npm run test:browser:minigame
```

原始报告和截图见docs/v13-*；完整变更文件见[V1_3_FILES.md](V1_3_FILES.md)及PR。

截图：[桌面](v13-screenshots/leaderboard-desktop.png) · [手机](v13-screenshots/leaderboard-mobile.png) · [旧后端诊断](v13-screenshots/old-backend-mobile.png) · [微信兼容层](v13-screenshots/wechat-compatibility.png)。
