# V0.7 API、数据库与安全边界

## 运行

Node.js 24 LTS + TypeScript + Fastify + 内置SQLite，无需Redis或额外数据库服务。开发：根目录npm ci，server目录npm ci；PUBLIC_ORIGIN=http://127.0.0.1:4173 npm run api:dev；根目录npm run build，npm run preview -- --port 4173。API默认127.0.0.1:8091，Vite/preview转发/api。

部署选择基于已有Ubuntu/Nginx静态站结构和低维护成本；本次未取得SSH凭据，未实查远程机器资源或安装软件。SQLite适合单API进程与本阶段规模，WAL/busy_timeout/事务保证并发唯一性；写入量显著增长时应迁移PostgreSQL。没有访问8080或game.gmgnclaw.com。

## 数据模型

迁移server/migrations/001-initial.sql，npm run migrate --prefix server可初始化/幂等重跑。

| 表 | 职责与关键约束 |
|---|---|
| regions | canonical code主键、parent外键、级别、名称、服务端前缀 |
| players | 随机UUID、昵称/规范昵称、地区、状态；UNIQUE(region_code,normalized_nickname) |
| sessions | 随机UUID、可空player_id、仅保存凭据SHA-256、CSRF、创建/过期时间 |
| challenges | 会话绑定、规则版本、开始/结束/过期、事件序号、计数、调试标记 |
| challenge_batches | PRIMARY KEY(challenge_id,sequence)、原始事件与内容哈希，用于幂等和后续物理回放 |
| scores | 随机ID、玩家/挑战、摘要、首次达成/提交时间、校验状态；UNIQUE(challenge_id)、UNIQUE(player_id,idempotency_key) |
| player_bests | 每玩家唯一best引用，只从verified中选择最佳 |
| appeals/admin_audit | 玩家或匿名会话申诉、人工处理结果、OS操作者及审计理由 |
| rate_limits/schema_migrations | 持久化频控窗口、迁移版本 |

外键开启，WAL、5000ms busy_timeout。匿名挑战归属安全会话，首次提交登记昵称后绑定稳定player_id。姓名/地区不是认证凭据；已绑定身份不能通过修改昵称切换账号。cookie丢失后不能凭名字恢复，未来正式账户可在sessions→player关系上增加经过验证的绑定/恢复表。

## 会话与安全

生产cookie：__Secure-qlgq，256bit随机凭据，HttpOnly、Secure、SameSite=Strict、Path=/api、90天。开发HTTP使用qlgq_dev。数据库仅存token哈希，CSRF随机值由/api/me返回；所有POST须同源Origin和X-CSRF-Token。PUBLIC_ORIGIN生产必须HTTPS。无CORS放行，不接受请求体playerId，不记录明文凭据。代理仅信任loopback，Nginx覆盖X-Forwarded-For。API JSON正文256KiB，所有参数验证且数据库参数化；错误不暴露SQLite路径。

每IP每分钟600请求、查名120/分钟、注册10/小时、匿名初始化120/小时；每会话挑战30/小时、提交30/小时、申诉3/天。单挑战6小时、最多50000事件、每批最多256条。窗口持久化数据库，过期频控行自动删除。无多进程共享内存限流依赖。

## 接口

响应均为JSON；错误{message:"简体中文说明"}。401会话失效，403跨源/CSRF/封禁，409冲突，422校验失败，429频控，503服务异常。GET除身份均不创建玩家。

| 方法/路径 | 内容 |
|---|---|
| GET /api/health | 存活与rulesVersion |
| GET /api/me | 建立/读取匿名安全会话；csrfToken、player、best（含rank） |
| GET /api/regions?parent=ISO:CN&q=安徽&offset=0 | 同级搜索、最多50条、nextOffset；无parent为国家/地区，前20为产品常用列表 |
| GET /api/regions/:code | canonical code、prefix、level、hasChildren与上级辅助路径 |
| GET /api/players/availability?nickname=创世玩家&region=CN:341222 | 后端规范/审核后返回baseTaken、available及精确中文提示 |
| POST /api/players | {nickname,regionCode}，唯一事务注册并绑定当前会话；同身份重复请求返回同ID |
| POST /api/challenges | {rulesVersion,unranked:false}，开局创建服务端挑战，不需先注册昵称 |
| POST /api/challenges/:id/events | {sequence:0,events:[...]}，连续序号，重复同内容幂等，内容冲突409 |
| POST /api/challenges/:id/submit | {idempotencyKey:UUID,summary:{score,reachedLevel,bricksDestroyed,durationMs,completedAllLevels}}，必须结束且绑定玩家；服务端重算 |
| GET /api/leaderboard?offset=0&limit=20 | 全球TOP100服务端分页，单页最多20；仅一玩家最佳verified成绩 |
| GET /api/me/best | 当前身份历史最佳及全服排名，可超过100名 |
| POST /api/appeals | {message}，5～500字符，昵称误判未注册者也可用匿名会话申诉 |

排行榜排序：score降序→reached_level降序→duration_ms升序→achieved_at升序→内部score id稳定兜底。同一玩家更低分不覆盖最佳；相同各项后新成绩不会覆盖首次纪录。achieved_at采用服务端首次收到finish事件的时刻，不让客户端伪造更早日期；总时长为有效物理步时间，暂停/等待不计入。

## 挑战事件与验证

每条事件含type、level、tick。tick为整局累计1/120秒物理步，不能随丢命或切关归零。

- launch：准备状态发射。
- hit：附index，必须为本关真实可生成网格且未销毁。
- power：附triple/wide，须有对应掉落且经过最早下落时间，×3最多100。
- ballLost：场上球数减1；lost仅可在0球时扣1命。
- clear：本关4203格均销毁后才奖励；next才开始新关，保留分数和生命。
- finish：仅五命耗尽或末关胜利可提交。

服务端复用计分规则、原始网格和连击窗口重算；验证有效关卡、重复销毁、剩余生命、通关奖励、单步击碎上限、球数、掉落时序和持续时间不超过服务端时钟。摘要不一致/不可能状态拒绝；结构成立但速度异常/时间过短入quarantined，不进入排行榜。调试压力测试成绩拒绝。事件原文保留，未来可增加带服务器随机种子、输入轨迹的确定性物理回放worker。

**当前不是完整防作弊**：物理在客户端，攻击者仍可构造看似合理的事件。没有声称签名、混淆或客户端隐藏密钥能证明真实游玩。正式高价值奖励前需加入服务端物理回放/裁决、设备/IP风控和人工审核；本阶段verified表示通过规则/异常校验，不等同服务器物理验证。

## 昵称与后台

NFKC、Unicode码点2～12、大小写/空白标准化；拒绝控制/隐藏字符，白名单中文/英文字母/数字及空格._-·。规范昵称去空白防同名绕过；审核再去安全分隔符识别拆字规避。server/data/nickname-rules.json按类别维护，未被导入前端。此为可维护初始规则库，不保证穷尽所有有害内容；需运营维护/接入内容安全服务。

可选MODERATION_URL HTTPS网关（请求{text,scene,rulesVersion}、Bearer MODERATION_API_KEY，返回decision=allow/deny/review）；超时/异常关闭注册，不悄悄跳过审核。密钥仅后端环境，不得VITE_。

后台使用有服务器OS权限的CLI，无公网管理员接口：在server工作目录，使用同一DB_PATH运行node build/manage.js。

- ban 玩家ID 理由 / unban 玩家ID 理由
- rename 玩家ID 新昵称 理由（仍执行审核与唯一约束）
- review-list / review 成绩ID approve或reject 理由（更新历史最佳引用）
- appeals / resolve 申诉ID 处理说明

所有变更写admin_audit；封禁从榜单排除，禁止新挑战/提交，保留会话用于申诉。不提供普通玩家编辑他人成绩接口。昵称/申诉输出JSON转义，排行榜用户内容使用textContent而非HTML。
