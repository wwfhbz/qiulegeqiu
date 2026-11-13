# 昵称修改与双模式永久排行榜

基线：main `72c9591`（无尽V1.5已合并）。本次不改玩法、物理、计分、rulesVersion或既有验证器，不连接生产服务器。

## 昵称规则与单一数据源

玩家身份仍由安全Cookie/微信Bearer会话对应的稳定players.id识别，绝不根据昵称登录、找回或切换身份。排行榜和个人历史通过player_id关联players.nickname，改名不复制/改写scores，分数、最佳分、达成时间、规则版本、排名排序依据和账号映射不变。

- 北京时间Asia/Shanghai，每自然周最多成功2次、每自然年最多成功6次，两个条件同时满足。
- 自然周为周一00:00起，下周一00:00止；年度为1月1日00:00起。跨年但仍处同一周时，周额度不会提前重置。
- 首次POST /players注册不记修改次数；沿用既有Unicode NFKC、大小写/空白标准化。同一标准化昵称返回changed=false，保留当前存储昵称，不写修改记录。
- 审核失败、重名冲突、未登录、限流或额度拒绝不记次数。所有Web/微信会话、闯关/无尽共用同一player_id账本。
- 成功提交昵称后立即刷新服务端Me：展示新昵称、周/年剩余额度及受限时的下一次可修改北京时间。名额耗尽不锁成绩提交，不把改名请求嵌入提交成绩流程。

服务端先检查会话/来源/CSRF，按玩家ID限流30次/小时，再执行现有昵称审核（2–12 Unicode字符、安全字符、敏感词及可选私有第三方审核）。事务内重新读取当前玩家、检查同名/额度、UPDATE players并INSERT修改日志。BEGIN IMMEDIATE和唯一约束防止跨进程并发超额/抢名。相同请求成功后重试成为同名无操作，不重复扣次数。

时间来自服务端，不接受客户端时间/模式/玩家ID/额度字段；两项计数通过同一SQLite语句读取一致快照。额度不足返回429、NICKNAME_CHANGE_LIMIT和下次时间。成功后日志保存至数据库，重启和备份均保留；不通过定时清表“重置”额度。

微信本机展示资料及官方好友关系链昵称仍遵循原平台功能；本功能修改的是服务器管理的唯一全球榜昵称，不静默获取微信资料、不新增账号。

## API

| 接口 | 权限与行为 |
|---|---|
| GET /api/me?board=global（或endless） | 原身份响应额外提供nicknameChange；未注册为null |
| GET /api/players/nickname | 登录且已登记账号，返回nickname和nicknameChange |
| POST /api/players/nickname | 原会话+CSRF；唯一请求字段nickname，服务端决定玩家ID |
| POST /api/players | 原注册/绑定流程，不消耗改名额度 |

nicknameChange字段：weeklyRemaining、yearlyRemaining、allowed、nextAllowedAt（允许时null）、weekResetsAt、yearResetsAt（UTC毫秒时间戳），timeZone=Asia/Shanghai。客户端只显示返回值，不自行增减额度。POST成功返回changed、nickname、nicknameChange；非法输入400、未登录401、权限/CSRF403、地区内昵称占用409、额度或频率429、暂时故障503。失败不会修改游戏挑战记录。

## 双模式永久榜

只有闯关global与无尽endless两套逻辑榜池。查询均按challenges.mode和verified/active/unranked状态筛选，每名玩家取跨所有规则的最高有效成绩，继续按总分↓、到达关卡/阶段↓、用时↑、首次达成↑、稳定成绩ID↑排序。

- 闯关榜包括旧十关、全部十二关及未来有效闯关成绩；无尽榜包括全部历史/未来有效无尽成绩。
- 两种模式绝不混排；TOP100、分页、榜外个人真实排名及提交返回best共用同一mode查询。
- 不传board/rulesVersion的旧接口默认闯关；旧rulesVersion查询只是模式兼容别名，不能筛选成绩。安全格式的未来只读查询标签也不分榜；board与别名模式冲突仍拒绝。
- 历史个人记录可按规则展示审计摘要，但不提供独立赛季名次；其中rank是该玩家真实的当前闯关名次。旧历史成绩无需重赛即可参与其模式排名。
- global排名能力标记为rankingScope=all-campaign-versions；endless为all-endless-versions。客户端不再用规则版本号判定榜池。旧rankingRulesVersion兼容字段保留，闯关固定为既有1.8元数据标签，不用于排名或分组。
- 各局创建时的rulesVersion仍固定，创建/上传/提交仍由SUPPORTED_RULES_VERSIONS及原版本验证器严格校验；未知版本不能创建/提交，规则、种子、事件与分数校验没有取消或放宽。

原player_bests/season_player_bests指针保留供兼容/审计，但不决定这两个实时榜池。已验证的未来mode成绩无需修改榜单版本清单即可排名，不需要新表/新榜。未审核、拒绝、压力测试或被封禁玩家记录不进入榜单。

## 增量迁移006

server/migrations/006-nickname-changes.sql仅追加：

- nickname_changes(id INTEGER PRIMARY KEY, player_id REFERENCES players(id), changed_at INTEGER NOT NULL)
- (player_id, changed_at)索引

不回填或猜测历史改名次数：既有普通注册不支持自助改名，旧账号从本功能的成功修改日志开始计数。原账号、昵称、地区、会话、微信绑定、规则字段、成绩和最佳指针保持原样。迁移与schema_migrations登记同一事务执行，重复启动不会重建或清空账本。005已有mode字段继续使用，无需重建历史挑战或scores。

生产备份必须包括整个SQLite数据库，新账本会自动包含在SQLite在线备份中。普通回滚保留006结构和记录，不能DROP账本/恢复旧快照来重置额度。既有管理CLI的审核权限未开放给玩家，也没有通过昵称修改切换账号的入口。

## 验证命令

Node 24.19.0；部署集成检查使用Linux环境。

```sh
npm run typecheck
npm test
npm run typecheck --prefix server
npm test --prefix server
npm run build
npm run build --prefix server
npm run test:wechat
npm run test:minigame
npm run test:deploy
node tests/browser-nickname.mjs
npm run test:browser:wechat
```

测试覆盖周2/年6、免费首次/同名、审核/冲突不扣、北京时间跨周/跨年及跨年周不重置、Web/微信绑定同一ID共享次数、两种榜/历史改名立即生效、额度满后真实挑战提交及幂等、12个并发API请求和4个真实进程争最后1次额度、SQLite备份/重启不丢账本、旧/新/未来有效mode成绩同榜、未知写入版本拒绝、两种模式不混排、UI取消/失败后可提交、旧隔离后端门禁等。

浏览器回归对本地独立内存API进行真实请求，不访问生产：桌面1366×768与手机390×844均完成2次成功修改、第3次拒绝、随后verified成绩提交，截图及report.json生成在work/nickname-browser/。微信320×568与390×844控件/更新/取消/上限/提交有自动化模拟测试；不冒充微信开发者工具或安卓/iPhone真机验收。

实测结果：前端447/447、后端118/118、部署49/49、微信构建测试8/8、兼容小游戏构建测试8/8全部通过；前后端类型检查与生产构建通过。桌面/手机本地真实API改名及成绩提交通过，微信浏览器模拟兼容检查通过。未执行微信真机、生产API或生产数据库验收。

## 生产升级（只说明，等待批准）

1. 审核PR和版本包，保存当前API/前端发布指针，核实实际DB_PATH属于本项目（标准/var/lib/qiulegeqiu/leaderboard.sqlite），不得修改其他服务。
2. 运行现有qiulegeqiu-backup.service执行SQLite在线备份，确认成功日志、integrity_check和备份文件权限；标准目录/var/backups/qiulegeqiu。不裸复制活动主数据库。
3. 使用经审核且与提交匹配的发布包，按[既有生产步骤](PRODUCTION_ROLLOUT.md)先API-only部署。启动时增量执行未完成的005/006；有冲突或失败则停止，不删表猜测修复。
4. 发布器健康检查要求双模式永久范围，不能仅凭相同rulesVersion误判旧后端兼容。检查health.leaderboard.rankingScope、两个公开榜、自己已有账号的Me.nicknameChange及真实个人排名；不创建虚构正式玩家/成绩测试。
5. 成功后才发布网页，再由用户手动构建/上传微信客户端。未升级后端时，新UI会提示无法读取永久榜或昵称额度，但保留单机及成绩提交入口；不要先发客户端再补后端。
6. 用户确认后由真实账号自愿进行一次改名验收，避免消耗别人的名额。检查两个榜、历史、最高分、稳定ID和计数同步；不自动进行生产改名。

无Nginx/防火墙/Node运行时/其他网站修改。未连接腾讯云、未部署、未修改生产数据或上传微信。

## 回滚

前端可以回退，但API应保留永久双模式查询与账本校验版本；禁止回退到版本隔离政策。昵称接口故障可暂不开放自助改名、继续原昵称提交成绩，修复后前滚，不以删除账本或更换玩家ID规避限额。

保留005/006及所有新成功修改/成绩，回滚程序不能覆盖数据库快照。备份仅供独立确认后的灾难恢复；恢复前需核实新增数据、停止本项目写入及恢复范围，不得在本任务中执行。原版本验证器、身份和绑定始终保留。所有操作仅限球球出击，不触碰统帅三国。
