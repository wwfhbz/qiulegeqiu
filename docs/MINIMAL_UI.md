# V0.6 极简街机界面

本次仅改UI，基于V0.5.1死亡机制分支；后者待PR #5审核，不自动合并。

## 首屏

| 项目 | V0.5.1 | V0.6 |
|---|---|---|
| 桌面1366×768 | Canvas顶部307，底部1200.19；操作区底1327.19，需滚动 | HUD52px，画布与按钮全部位于首屏 |
| 手机390×844 | Canvas顶部249.5；按钮底868.5，部分超出首屏 | HUD48px，完整画布、挡板、按钮均可见 |
| 常驻信息 | 大标题、关卡名、球速、统计卡、状态、说明 | 关卡、爱心、分数、剩余方块 |

- [桌面改造前](screenshots/ui-before-desktop.png) / [桌面改造后](screenshots/ui-after-desktop.png)
- [手机改造前](screenshots/ui-before-mobile.png) / [手机改造后](screenshots/ui-after-mobile.png)

截图均为首屏非整页截图，同一视口对比。手机截图使用3倍DPR，CSS视口仍为390×844。

## 实现与边界

GameUI仅呈现真实Game状态。关卡总数读取LevelManager.count，当前源码仍为三关，不虚构十关或障碍。爱心根据initialLives生成，失去生命后变暗。多球徽标仅在多于1球时显示，不增加HUD高度。数值使用真实remaining与score.total。

ViewportLayout按可用高度扣除HUD、反馈和按钮的实际占位，等比例缩放800×1120画布；ResizeObserver和窗口变化重新测量。结算为非交互覆盖提示，按钮仍独立交互层；运行时中央层display:none。底部保留两个44px高按钮。静音位于28px反馈行，强化和连击只在发生时提示。压力测试仍仅?debug=1可见。

Renderer仅删除出口/漏球文字、等待发射文字与准备瞄准装饰；圆弧、外框、挡板和所有物理几何不变。Game、Physics、GameConfig、WorldGeometry、ArenaGeometry、ArcadeRules、ScoreSystem、Blocks、PowerUps、LevelManager、Effects、CentralAction、GameState、Audio共14个模块与V0.5.1文件哈希一致。

## 验证

- 类型检查、100项单元测试、生产构建通过。
- 新增浏览器验收五种视口：1366×768、1920×1080、1024×600、390×844、320×568，均无横纵页面溢出，HUD48～52px、画布等比例、底部控件完整。
- 真实发射消块后验证分数/剩余方块/爱心同步、中央隐藏、暂停恢复、重开、多球徽标不撑高HUD，手机CDP触摸可控制挡板。
- 完整数据见[minimal-ui-browser-results.json](minimal-ui-browser-results.json)。使用本机Chromium自动化，未宣称真实手机硬件性能。

复现：npm run build，启动npm run preview -- --port 4173，执行node tests/browser-minimal-ui.mjs。旧浏览器测试使用work目录保存回归产物，避免覆盖历史截图。
