# 球了个球 V0.4 · 经典街机

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

- 移动鼠标或手指横向拖动控制浅蓝色水平挡板，点击底部“开始游戏”。
- 每关 4203 块，三关基础球速依次为 1.0、1.1、1.2 倍，最高不超过 760 逻辑像素/秒。
- 初始 3 命。多球只丢一颗不扣命，全部球漏掉才扣 1 命。剩余生命大于 0 时等待再次发射，生命耗尽进入游戏结束。
- 每块基础 10 分；1.2 秒连击窗口，5/10/20 连击起为 1.5/2/3 倍。通关加 1000 分并按剩余生命加 500 分/条。
- 扣命保留方块进度和总分；切关保留生命与总分，重置本关方块、球、道具及强化。
- 接住“三倍球”最多获得 100 球；“加宽”持续 5 秒、重复拾取刷新。暂停时物理、连击与道具计时全部停止。
- 第 1、2 关通关后点击“下一关”；第 3 关进入最终胜利。重开恢复第 1 关、3 命、0 分。
- 圆底与挡板顶边保持 80 逻辑像素间距；球到外部挡板仍可反弹入圆，完全离开 Canvas 才回收。
- 静音偏好在重开时保留。默认隐藏百球压力测试；地址加 `?debug=1` 可启用该开发工具。

完整规则、计分示例、状态表与模块职责见 [街机规则文档](docs/ARCADE_RULES.md)。

## 工程与测试

Game.ts 协调状态，Physics.ts 管理物理，Renderer.ts 保留原有渲染。新增 ArcadeRules.ts、ScoreSystem.ts、LevelManager.ts、GameState.ts，界面独立在 GameUI.ts；main.ts 仅负责挂载。

方块仍使用 Uint8Array 网格、脏格清除和离屏缓存。固定步长 1/120 秒，每个子步移动不超过 2 逻辑像素。球对象复用，粒子池容量 384。没有为每个方块创建 DOM 或独立刚体。

57 项单元测试通过，包括保留的 35 项原有回归与新增 22 项街机规则测试。类型检查和生产构建通过。

先启动生产预览，再按顺序验证：

```sh
BASE_URL=http://127.0.0.1:4173 node tests/release-smoke.mjs
BASE_URL=http://127.0.0.1:4173 npm run test:browser:layout
BASE_URL=http://127.0.0.1:4173 npm run test:browser
BASE_URL=http://127.0.0.1:4173 npm run test:browser:arcade
```

需要 Chromium，默认路径 `/usr/bin/chromium`，可用 `CHROMIUM_PATH` 指定。浏览器验证确认正常消除计分、扣命、Game Over、下一关、最终胜利、静音、暂停冻结、真实触摸、390/320 宽度布局与 3 倍 DPR，无页面脚本异常。结算测试通过真实销毁事件快速构造三关场景，未手工玩完 12609 块。

压力测试按独立场景顺序执行，初始 4203 方块、桌面 1440×1200 无头 Chromium，两阶段各 5 秒：正常百球模式约 60.11 FPS；测试脚本持续补至 100 球约 60.16 FPS，帧间隔 P95 16.8ms，物理更新均值约 0.053ms。仅代表当前环境，不代表手机真机或长时间运行。原始数据见 docs/v04-performance.json；交互数据见 docs/v04-browser-results.json。

## 实际截图

- [桌面游戏](docs/screenshots/v04-desktop.png)
- [手机游戏](docs/screenshots/v04-mobile.png)
- [游戏结束](docs/screenshots/v04-game-over.png)
- [关卡结算](docs/screenshots/v04-level-complete.png)
- [最终胜利](docs/screenshots/v04-victory.png)

## 分支与部署

V0.4 在 feature/arcade-v04 开发，由 V0.3.1 main 提交 e77dc9406daf288e0f7c4cc3bd84c2cda3443cab 起步。本次创建 PR 等待审核，不自动合并 main，不修改腾讯云或《统帅三国》。

腾讯云部署步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。旧版本 DEPLOYMENT_CHECK.md 与历史压缩包校验值不适用于本次构建；审核合并后需重新构建、打包并单独发布。本项目无云端存档和排行榜。
