# 球球出击 V1.3.0 · 全球历史排行榜

Vite + TypeScript + HTML5 Canvas 2D 原创弹球游戏，无大型引擎或付费素材。在圆形核心中击碎方块，使用圆外水平挡板接球，用5条生命挑战12关。

## 本地运行

需要Node.js 24 LTS（前后端统一，后端使用内置SQLite）。

```sh
npm install
npm run dev -- --port 5173
npm run typecheck
npm test
npm run build
npm run preview -- --port 4173
```

开发地址 http://localhost:5173/，生产预览 http://127.0.0.1:4173/。构建输出为 dist/，Vite 根路径明确为 `/`。

## 玩法

- 移动鼠标或手指横向拖动控制浅蓝色水平挡板，点击圆形竞技场中央“▶ 开始游戏”。
- 第1关「轻松出击」600块、0.85倍球速、200像素可见出口、1.3倍挡板；第2关「渐入佳境」1200块、0.92倍球速、160像素可见出口、1.15倍挡板。两关无内部机关。
- 原十关完整顺延到第3～12关，每关4103～4203块，避开机关完整运动范围；原球速、道具与窄出口不因编号变化而改变。
- 初始 5 命。多球只丢一颗不扣命，全部球漏掉才扣 1 命。剩余生命大于 0 时等待再次发射，生命耗尽进入游戏结束。
- 每块基础 10 分；1.2 秒连击窗口，5/10/20 连击起为 1.5/2/3 倍。通关加 1000 分并按剩余生命加 500 分/条。
- 扣命保留方块进度和总分；切关保留生命与总分，重置本关方块、球、道具及强化。
- 接住“三倍球”最多获得 100 球；“加宽”持续 5 秒、重复拾取刷新。暂停时物理、连击与道具计时全部停止。
- 前两关完成后自动载入下一关，保留生命/分数，准备1颗球；点击中央按钮发射。第3～11关仍点击“下一关”，第12关最终胜利。重开恢复第1关、5命、0分。
- 网页与微信只显示一个“全球历史排行榜”，按十二关规则下的最高有效成绩排名。旧十关原分保留在个人记录中，更新后重赛上榜，不做分数换算。
- 圆底与挡板顶边保持 160 逻辑像素间距；球到外部挡板仍可反弹入圆，整球越过挡板下方漏球线才回收。
- 静音偏好在重开时保留。默认隐藏百球压力测试；地址加 `?debug=1` 可启用该开发工具。

十二关配置见 [V1.2说明](docs/V1_2_TUTORIAL_SEASONS.md)。计分与状态基础见 [历史街机规则文档](docs/ARCADE_RULES.md)。

## 工程与测试

CentralAction.ts 统一中央动作与标签，Game.ts 协调状态，Physics.ts 管理物理，Renderer.ts 保留原有渲染。新增 ArcadeRules.ts、ScoreSystem.ts、LevelManager.ts、GameState.ts，界面独立在 GameUI.ts；main.ts 仅负责挂载。

方块仍使用 Uint8Array 网格、脏格清除和离屏缓存。固定步长 1/120 秒，每个子步移动不超过 2 逻辑像素。球对象复用，粒子池容量 384。没有为每个方块创建 DOM 或独立刚体。

V1.3验证：前端210项、后端59项、部署36项，新旧小游戏目录各5项产物测试通过，前后端及小游戏类型检查、构建通过。旧十关回归使用冻结配置，新增用例验证真实十二关及跨赛季隔离。

先启动本地API和生产预览（4173/8091），验证当前版本：

```sh
node tests/browser-v12.mjs
npm run test:browser:ui
npm run test:browser:minigame
```

需要 Chromium，默认路径 `/usr/bin/chromium`。V1.2浏览器验收覆盖桌面/手机、真实发射消块、扣命HUD、前两关自动切换、赛季选择和旧后端拒绝混榜。完整清关场景通过真实销毁事件快速构造，未宣称人工玩完全部43656块。小游戏使用浏览器wx兼容层验证，不代替官方开发者工具或真机验收。

历史 V0.4 压力测试按独立场景顺序执行，初始 4203 方块、桌面 1440×1200 无头 Chromium，两阶段各 5 秒：正常百球模式约 60.11 FPS；测试脚本持续补至 100 球约 60.16 FPS，帧间隔 P95 16.8ms，物理更新均值约 0.053ms。仅代表当前环境，不代表手机真机或长时间运行。原始数据见 docs/v04-performance.json；交互数据见 docs/v04-browser-results.json。

## 中央操作与实际截图

- 首次“▶ 开始游戏”，漏球后“▶ 继续挑战”，暂停时“▶ 继续游戏”。
- 通关显示“下一关”，失败或最终胜利显示“重新挑战”；点击一次进入并发射，最终结算仍保留展示。
- 运行时按钮及交互层隐藏；底部仅保留暂停/继续、重新开始。两种暂停恢复入口均调用 Game.start。
- 中央按钮独立于 Canvas 物理，手机触控区域至少 144×48 CSS 像素。实测运行时原中央位置由 Canvas 接收事件，真实触摸可从该位置拖动。
- [桌面首次开始](docs/screenshots/v05-desktop.png) · [手机暂停恢复](docs/screenshots/v05-mobile.png) · [最终通关](docs/screenshots/v05-victory.png)
- [交互规则与测试说明](docs/CENTRAL_START.md) · [浏览器原始报告](docs/v05-browser-results.json)

历史 V0.4 截图、数据和完整街机规则仍保留在 docs/，当前状态交互以 CENTRAL_START.md 为准。

## 分支与部署

V0.5 在 feature/central-start-v05 开发，基于 main 48b0994beea1968d5a08d8d92ce33ddfc8dcad68。经用户确认，保持现有三关，本次只改交互。本次创建 PR 等待审核，不自动合并 main，不修改腾讯云或《统帅三国》。

腾讯云部署步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。旧版本 DEPLOYMENT_CHECK.md 与历史压缩包校验值不适用于本次构建；审核合并后需重新构建、打包并单独发布。本项目无云端存档和排行榜。

## 待审核：底部出口缩小

基于 d8950ea 的中央按钮代码（已进入 main），将出口半宽 106→53、端点弦宽 212→106，使用 ArenaGeometry.ts 统一圆弧、描边和端盖碰撞。按本次要求将圆外挡板间距改为160，Canvas 加高至800×1120；原来的80间距说明属于此前版本。关卡仍保持已确认的三关，其他街机规则不变。

75 项单元测试、类型检查、构建和实际浏览器回归通过。[几何定义、审核关系及前后截图](docs/NARROW_EXIT.md)。运行 `BASE_URL=http://127.0.0.1:4173 npm run test:browser:exit` 复现出口验证。新旧图片按相同视口拍摄；半宽减半的口径为圆弧路径端点的水平弦宽，新圆端盖后的可见净宽约104.6。

## V0.5.1：只能从玩家挡板下方漏球

球在圆内、圆外、外框碰撞或挡板反弹时都存活。左右围挡x=24/776，上方围挡y=112，底部没有实体墙；唯一漏球线位于挡板下边缘48像素下方，即y=1072。只有球的上边缘严格越线才死亡，判定在全部碰撞之后执行，与Canvas边缘无关。

每次发射形成一轮，只有最后一颗死亡才扣1命；回合标记防止重复结算。暂停不执行死亡，通关同帧优先。保留半宽53窄出口、160挡板间距、三命、已有三关配置、计分、道具、音效和中央按钮。

[完整规则与移除入口审计](docs/DEATH_ZONE.md) · [PC截图](docs/screenshots/death-zone-desktop.png) · [手机截图](docs/screenshots/death-zone-mobile.png) · [浏览器证据](docs/death-zone-browser-results.json)

分支feature/death-zone-v051以PR #4的窄出口源码dbbd798为起点（该基线已进入main），只提交独立PR等待确认，不合并main、不部署腾讯云、不修改其他项目。

## V0.6 极简界面

顶部仅保留品牌与48～52像素HUD：实际配置关卡、爱心生命、累计分数、剩余方块。多球徽标不增加行高。中央按钮沿用原状态映射，底部仅暂停/继续和重开，静音位于小型反馈行。

画布按可用视口等比例缩放，保持800×1120逻辑坐标与160挡板间距。结算改为仅在结算时出现的画布内提示，不挤压游戏区域。当前实际配置为三关，HUD从LevelManager读取总数。

[首屏前后截图与验证](docs/MINIMAL_UI.md)。启动生产预览后运行 `node tests/browser-minimal-ui.mjs`。

## V0.6.1 五命续玩与道具平衡

- 唯一生命数据源是Game.lives（只读），初始值统一由ArcadeRules.initialLives=5提供。每次update完成状态转换后同步通知HUD，无需等待下一帧，爱心/数字/无障碍标签同时更新。
- 普通漏完一轮只重置球与临时对象，保留当前关卡、方块及总分；继续挑战不调用全局reset。0命禁止发射，重开和失败重试才回第1关5命0分。
- 第一关每14块掉落一次；第二关及以后每28块，统一倍率1/.5。两种道具交替，持续时间、效果、最多100球和24个掉落槽不变。
- 当前正式配置仍是三关。第5关保留2000个消除格的场景使用测试专用5关配置验证，未新增或虚构正式关卡/障碍。

[修复说明、文件清单及验收结果](docs/LIVES_BALANCE.md)。生产预览启动后运行 `npm run test:browser:lives`；其余浏览器测试默认将新回归产物写入work，保留旧版本历史截图。

## V0.7 全球挑战排行榜

新增奖杯入口和结束挑战登记弹窗，不占据常驻游戏画面。昵称+自选最终一级地区展示，后端唯一约束防同地区重名，安全HttpOnly会话保持身份；可跳过提交直接重试。全球TOP100按个人历史最佳分页显示，我的排名可超过100名。API不可用不阻塞单机玩法。

```sh
npm ci
npm ci --prefix server
# 终端1（生产预览同源Origin；开发5173则相应修改）
PUBLIC_ORIGIN=http://127.0.0.1:4173 npm run api:dev
# 终端2
npm run build
npm run preview -- --port 4173
npm run typecheck
npm test
npm run typecheck --prefix server
npm test --prefix server
npm run build --prefix server
npm run regions:check
npm run test:browser:leaderboard
```

SQLite数据默认在根work，不属于dist。生产独立数据库、systemd、/api代理、打包/发布/备份/恢复/回滚说明见[部署文档](docs/DEPLOYMENT_V07.md)。原DEPLOYMENT.md为历史静态版本说明，不能替代后端部署。

[数据库/API/安全边界](docs/LEADERBOARD_API.md) · [地区来源与更新](docs/REGION_DATA.md) · [浏览器联网结果](docs/leaderboard-browser-results.json) · [桌面截图](docs/screenshots/leaderboard-desktop.png) · [手机截图](docs/screenshots/leaderboard-mobile.png)。当前地区使用2025年末MCA来源社区快照，非2026最新；港澳台仅选数据实际提供层级。昵称词库仅后端，支持私有内容安全网关。

前端117项、后端26项测试，含真实游戏日志重算、40并发唯一注册、身份隔离、幂等、排序/分页、异常隔离和原关续玩。浏览器真实联网两名玩家完成消块、地区选择、登记、提交、查榜及刷新身份；模拟断网仍可跳过并重新开始。verified表示通过事件/规则验证，不代表服务端物理回放已防止所有作弊；完整限制见API文档。未部署线上，未改其他游戏。

## 历史 V0.8 十关与五大道具

十关独立配置，固定/水平移动/旋转胶囊机关具有真实碰撞，预留完整运动空间和通路。第1关×3/加宽50/50，第2～10关÷2/×3/加宽/生命/炸弹为30/30/30/5/5；总体掉落仍仅14→28间隔。生命上限5、最多100球、160挡板间距与唯一死亡线保持。

[完整十关/道具表、物理与测试说明](docs/V08_RULES.md) · [10关截图目录](docs/screenshots/) · [手机截图](docs/screenshots/v08-mobile.png) · [炸弹反馈](docs/screenshots/v08-bomb.png)。新增37项前端和8项后端测试，当前总计154/34通过。浏览器十关/五种实际下落拾取/生命HUD/炸毁状态保留/胜利/触摸/联网回归通过，百球+4机关本机约60 FPS，真机性能尚待验收。

前后端版本均0.8.0，排行榜规则标识和seed追加迁移同步更新。npm run test:browser:v08复现十关浏览器验收；完整清关为事件快速构造，未宣称手工玩完41856块。当前未收到可读取设计图，依据文字表完成并提供实际截图供核对；未合并或部署。

## 排行榜生产上线准备（等待确认）

当前保留main的V0.8游戏，仅补齐上线工具。生产审批的完整步骤、拟执行命令、Nginx差异、systemd、旧数据保护、每日7天备份、回滚与验收见[生产上线审批单](docs/PRODUCTION_ROLLOUT.md)。不在未确认时连接写入生产。

新增只读preflight、独立Node24运行时安装、ball-only Nginx规划/激活、发布前在线备份与失败代码回退、每日备份unit/timer、恢复额外确认及安全日志。运行 `npm run regions`（只校验，不重新下载数据）和 `npm run test:deploy`；前后端原检查命令不变。运行 `bash deploy/package.sh` 前必须提交所有源码，产物包含SOURCE_TREE/规则版本，可审计核对。备份/恢复和Nginx/systemd生产效果仍须服务器授权后验收。

首次一键部署及依赖权限修复说明见[首次生产安装](docs/FIRST_PRODUCTION_INSTALL.md)。依赖安装完成后会以服务用户运行候选API，验收通过才切换版本；旧发布包需重新生成，不能手动补装fastify绕过检查。

系统Node22与生产Node24并存时，部署测试需显式选择运行时；[完整验证命令与夹具说明](docs/DEPLOY_TEST_RUNTIME.md)。`npm run test:deploy`会校验并使用v24.19.0，不能绕过入口直接用系统22运行测试文件。

## 微信小游戏客户端 V1.3

小游戏与网页直接复用同一套十二关、物理、生命、道具和事件规则，不维护两份关卡配置。构建/导入/AppID配置见[minigame说明](minigame/README.md)，认证与追加迁移见[微信接口](docs/WECHAT_API.md)，资质与真机待办见[上线前清单](docs/MINIGAME_RELEASE.md)。未部署生产或声称已通过正式微信审核。

历史V1.1统一名称为《球球出击》，生命结算修复、完整文件清单和回归证据见[V1.1说明](docs/V1_1_RENAME_LIVES.md)。微信后台正式名称还需运营方同步设置；仓库、域名、API、数据库地址不变；V1.2规则版本已分赛季，见上方说明。

## V1.3 全球历史排行榜与BUG修复

取消新界面赛季切换，统一查询与真实个人名次，支持TOP100分页/刷新；旧分完整保留、十二关重赛上榜。修复身份与规则检查耦合、非JSON错误误判、在途身份缓存、重开上传竞态、零球道具事件及部署验收。需同步更新后端，新客户端不能让旧API凭空支持十二关。完整根因、兼容API、全部验证、一键安全发布和回滚限制见[V1.3交付说明](docs/V1_3_GLOBAL_LEADERBOARD.md)。本次未部署、未改生产数据库或其他游戏。

## V1.3可选全新数据库部署

已新增显式确认的新库模式：核实实际DB路径、停服完整归档WAL、清库初始化十二关、失败配套恢复程序和数据库。默认部署继续保留数据。重复成功批次不再次清库，旧会话可重新登记，旧挑战不会循环上传。OrcaTerm一键命令、状态机和验收见[全新数据库部署](docs/FRESH_DATABASE_DEPLOY.md)。本次未连接或部署生产。

## 独立微信小游戏客户端（wechat-game）

正式源码位于wechat-game，复用同一十二关与global排行榜，原网页保留。运行`npm run build:wechat`，微信开发者工具准确导入**wechat-game/dist**。独立命令、AppID、合法域名、真机步骤见[客户端说明](wechat-game/README.md)，架构与验证见[实施报告](docs/WECHAT_GAME_CLIENT.md)。旧minigame路径仍兼容，不维护第二份规则；本次不部署、不改数据库。

成绩提交与道具回放问题的定位、兼容边界、测试及安全发布顺序见 [修复说明](docs/POWER_SUBMISSION_FIX.md)。

球场点击开局、中央淡出提示与跨端验收见 [交互说明](docs/TAP_TO_START.md)。

全球历史排行榜星际荣耀改版、截图与测试说明见 [排行榜UI说明](docs/GALACTIC_LEADERBOARD_UI.md)。

成绩日志协议与个人排名卡布局修复见 [修复说明](docs/SUBMISSION_PROTOCOL_LAYOUT_FIX.md)。

### X3 多球规则

当前有效球数≤20时乘3，超过20时增加3，上限100。详见[规则、兼容性与验证说明](docs/x3-threshold-rule.md)。
