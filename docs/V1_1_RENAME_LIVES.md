# 球球出击 V1.1：更名与生命结算

客户端版本1.1.0，规则标识仍为`0.8.0-arcade-5l-10lv-v1`。仓库wwfhbz/qiulegeqiu、域名ball.gmgnclaw.com、API路径、Cookie/微信存储键和数据库路径不变。没有修改后台成绩验证或已有玩家成绩。

## 可复现根因

原Physics在标记最后一个球死亡并回收后，仍调用powers.update处理拾取。生命小于5时，同帧落在挡板上的生命道具会先+1，Game之后才-1，导致4→4，甚至最后一命1→1，表现为生命不减少或不能结束。新增回归用例在修复前真实出现3项失败。

修复只拦截无有效球时的道具拾取，并在Game的道具回调中再次确认当前回合和有效球。没有改固定步时钟、死亡线、碰撞、强化计时或合法存活球拾取生命的规则。有效球存在时仍可恢复1命，上限5。

Game.remainingLives仍是唯一状态源。Web HUD每次读取g.lives，已失生命明确显示为♡；小游戏Canvas同样读取g.lives，没有第二套生命缓存。丢命沿用resetRound，保留当前关卡、方块、分数和已毁机关；只有主动重新开始才回到首关5命。

## 更名范围及平台操作

网页title/首页、排行榜、小游戏标题/结算/榜单/分享卡、工程配置、README及说明文字统一名称。shared/Brand.ts统一两端运行时名称，小游戏构建从同一来源写入工程描述与1.1.0版本；历史文档保留版本号。已更新当前小游戏与本次网页截图，其他历史版本截图是归档对照，不代表当前名称。

**必须由运营方在微信公众平台的小游戏管理后台将正式名称同步设置为《球球出击》，并按实际后台要求完成名称审核。代码或project.config不能代替此操作，本次没有登录管理后台。**

## 验证

- 客户端176项、后端47项、部署22项、小游戏包3项通过，无跳过。
- 网页/小游戏/后端类型检查和构建通过。
- 专项覆盖5→4→3→2→1→0、全灭同帧生命道具、延迟拾取、重发不回满、全灭只扣一次、+1上限、进度及已毁机关保留。
- 网页真实Chromium的1366×768、390×844、320×568即时HUD回归通过；同一次update返回后核对状态、心形、数值及继续挑战，包含待拾取生命的第2关。
- 原首屏5种视口回归通过；小游戏wx兼容宿主3种尺寸验证共享核心、实际碰砖、后台暂停和本地榜单提交，无页面异常。
- 微信开发者工具/真机未运行；没有正式AppID/Secret，不将兼容层测试说成真实微信验收。

截图：[网页桌面](v11-screenshots/web-desktop.png)、[网页手机](v11-screenshots/web-mobile.png)、[小游戏首屏](minigame-screenshots/phone-ready.png)、[小游戏结算](minigame-screenshots/phone-result.png)。小游戏截图来自Chromium wx兼容层。

```bash
npm ci
npm ci --prefix server
npm run typecheck
npm test
npm run build
npm run typecheck --prefix server
npm test --prefix server
npm run build --prefix server
npm run test:deploy
npm run test:minigame
npm run test:browser:minigame
```

没有SSH、生产部署、数据库覆盖、历史成绩重算或其他游戏服务操作。

## 修改文件清单

- `CHANGELOG.md`
- `DEPLOYMENT.md`
- `DEPLOYMENT_CHECK.md`
- `README.md`
- `deploy/activate-nginx.sh`
- `deploy/nginx-plan.mjs`
- `deploy/qiulegeqiu-api.service`
- `deploy/qiulegeqiu-backup.service`
- `deploy/qiulegeqiu-backup.timer`
- `docs/ARCADE_RULES.md`
- `docs/FIRST_PRODUCTION_INSTALL.md`
- `docs/MINIGAME_VALIDATION.md`
- `docs/V1_1_RENAME_LIVES.md`
- `docs/minigame-screenshots/phone-board.png`
- `docs/minigame-screenshots/phone-ready.png`
- `docs/minigame-screenshots/phone-result.png`
- `docs/minigame-screenshots/small-phone-ready.png`
- `docs/minigame-validation.json`
- `docs/v11-screenshots/web-desktop.png`
- `docs/v11-screenshots/web-mobile.png`
- `index.html`
- `minigame/README.md`
- `minigame/project.config.json`
- `minigame/scripts/build.mjs`
- `minigame/scripts/build.test.mjs`
- `minigame/src/App.ts`
- `minigame/src/Policies.ts`
- `package-lock.json`
- `package.json`
- `shared/Brand.ts`
- `src/Game.ts`
- `src/GameUI.ts`
- `src/Physics.ts`
- `src/online/LeaderboardUI.ts`
- `tests/browser-lives-balance.mjs`
- `tests/browser-minigame.mjs`
- `tests/minigame.test.ts`
- `tests/release-smoke.mjs`
- `tests/v11-life.test.ts`
