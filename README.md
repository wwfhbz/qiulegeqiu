# 球了个球 V0.5 · 中央开始交互

Vite + TypeScript + HTML5 Canvas 2D 原创弹球游戏，无大型引擎或付费素材。在圆形核心中击碎方块，使用圆外水平挡板接球，用 3 条生命挑战 3 关。

## 本地运行

需要 Node.js 20.19+ 或 22.12+。

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
- 每关 4203 块，三关基础球速依次为 1.0、1.1、1.2 倍，最高不超过 760 逻辑像素/秒。
- 初始 3 命。多球只丢一颗不扣命，全部球漏掉才扣 1 命。剩余生命大于 0 时等待再次发射，生命耗尽进入游戏结束。
- 每块基础 10 分；1.2 秒连击窗口，5/10/20 连击起为 1.5/2/3 倍。通关加 1000 分并按剩余生命加 500 分/条。
- 扣命保留方块进度和总分；切关保留生命与总分，重置本关方块、球、道具及强化。
- 接住“三倍球”最多获得 100 球；“加宽”持续 5 秒、重复拾取刷新。暂停时物理、连击与道具计时全部停止。
- 第 1、2 关通关后点击中央“下一关”进入并发射；第 3 关进入最终胜利。重开恢复第 1 关、3 命、0 分。
- 圆底与挡板顶边保持 80 逻辑像素间距；球到外部挡板仍可反弹入圆，完全离开 Canvas 才回收。
- 静音偏好在重开时保留。默认隐藏百球压力测试；地址加 `?debug=1` 可启用该开发工具。

完整规则、计分示例、状态表与模块职责见 [街机规则文档](docs/ARCADE_RULES.md)。

## 工程与测试

CentralAction.ts 统一中央动作与标签，Game.ts 协调状态，Physics.ts 管理物理，Renderer.ts 保留原有渲染。新增 ArcadeRules.ts、ScoreSystem.ts、LevelManager.ts、GameState.ts，界面独立在 GameUI.ts；main.ts 仅负责挂载。

方块仍使用 Uint8Array 网格、脏格清除和离屏缓存。固定步长 1/120 秒，每个子步移动不超过 2 逻辑像素。球对象复用，粒子池容量 384。没有为每个方块创建 DOM 或独立刚体。

65 项单元测试通过，保留原有 57 项物理与街机回归，新增 8 项中央状态动作测试。类型检查和生产构建通过。

先启动生产预览，再按顺序验证：

```sh
BASE_URL=http://127.0.0.1:4173 node tests/release-smoke.mjs
BASE_URL=http://127.0.0.1:4173 npm run test:browser:layout
BASE_URL=http://127.0.0.1:4173 npm run test:browser
BASE_URL=http://127.0.0.1:4173 npm run test:browser:arcade
BASE_URL=http://127.0.0.1:4173 npm run test:browser:central
```

需要 Chromium，默认路径 `/usr/bin/chromium`，可用 `CHROMIUM_PATH` 指定。浏览器验证确认正常消除计分、扣命、Game Over、下一关、最终胜利、静音、暂停冻结、真实触摸、390/320 宽度布局与 3 倍 DPR，无页面脚本异常。结算测试通过真实销毁事件快速构造三关场景，未手工玩完 12609 块。

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
