# V0.5 中央操作交互

基于 main 48b0994（V0.4.0）。经用户确认，本次保持现有三关，不扩展十关；三命、积分、倍率、道具、多球、球速与圆外挡板物理均不变。

## 状态与点击

| 现有引擎状态 | 中央按钮 | 点击结果 |
| --- | --- | --- |
| ready，首次或底部重开后 | ▶ 开始游戏 | 调用 Game.start，发射已有的一颗准备球 |
| ready，全部漏球后还有生命 | ▶ 继续挑战 | 调用 Game.start，保留生命、分数和方块进度 |
| running | 整个交互层隐藏 | Canvas 直接接收鼠标/触摸，不接受额外发射 |
| paused | ▶ 继续游戏 | 调用同一 Game.start 恢复，不重新瞄准或生成球 |
| levelComplete | 下一关 | 调用既有 nextLevel 保留生命与累计分数，再用 Game.start 发射新关准备球 |
| gameOver | 重新挑战 | 调用 reset 创建三命零分的新局，再用 Game.start 发射一颗球 |
| victory | 重新挑战，保留最终结算显示 | 同上，开始新局 |

需求中的 levelCleared 对应现有 levelComplete，finalWon 对应 victory。此次未重命名引擎状态，以保持既有街机规则和测试兼容。

readyReason 区分 initial、lifeLost 和 levelStart，不用生命数推测按钮文字，避免下一关仍剩两命时错误显示“继续挑战”。

下一关和重新挑战的中央动作只需点击一次即可发射。底部“重新开始”仍返回初始等待状态，由玩家点击中央开始。恢复动作统一调用 Game.start，既有状态守卫拒绝运行中的重复调用；隐藏按钮同时禁用，连续点击不生成额外球、不重复扣命或跳关。

## 位置与输入

- 开始按钮已从底部移除。底部只有“暂停/继续”和“重新开始”，等宽水平排列。
- 中央按钮是 Canvas 的兄弟 DOM 元素，属于独立绝对定位交互层。位置按 GameConfig 的圆心/画布尺寸换算为百分比，不写入物理或渲染对象。
- 浅蓝色按钮、深蓝色文字、细边框与轻微蓝色光晕；无覆盖全场的遮罩。
- 交互层 pointer-events:none，仅按钮 pointer-events:auto。运行时按钮和整层同步 hidden，CSS 强制 display:none，没有遗留透明热区。
- 手机按钮最小 144×48 CSS 像素，大于 44×44 要求；Canvas 原有触摸拖动与 pointer capture 保持不变。
- 挡板中心 y=938、圆底到上边缘间距 80、水平移动方式均未改变。

## 模块

CentralAction.ts 统一生成标签与执行主动作。Game.ts 只新增 readyReason 的状态标记。GameUI.ts 负责同步显示与事件绑定。Physics.ts、GameConfig.ts、ArcadeRules.ts 和 ScoreSystem.ts 没有修改。Renderer.ts 仅补充零尺寸布局保护，避免切换窄屏时离屏缓存被置为零导致绘制异常。

## 验证

- 类型检查、65 项单元测试、生产构建通过；保留原有 57 项并新增 8 项中央状态动作测试。
- 生产包浏览器验证：首次开始、漏球继续、暂停两种恢复入口、下一关、Game Over 重试、最终胜利与重试、重复点击、底部双按钮、居中位置。
- 使用 elementFromPoint 验证运行时原按钮位置的真实目标是 Canvas；使用真实触摸事件从该位置开始拖动，确认挡板接收控制。
- 桌面、390/320 像素手机布局和 3 倍 DPR 检查，无页面脚本异常。测试记录 docs/v05-browser-results.json。
- 三关结算仍通过真实方块销毁事件快速构造，未手工打完全部方块。单元与旧浏览器回归继续覆盖积分、三命、道具、多球及物理。

```sh
npm run typecheck
npm test
npm run build
npm run preview -- --port 4173
BASE_URL=http://127.0.0.1:4173 npm run test:browser:central
```

截图：[桌面首次开始](screenshots/v05-desktop.png)、[手机暂停恢复](screenshots/v05-mobile.png)、[最终通关与重新挑战](screenshots/v05-victory.png)。

仅提交 feature/central-start-v05 并创建 PR，不自动合并 main 或部署腾讯云。
