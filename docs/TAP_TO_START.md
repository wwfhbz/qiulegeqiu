# 点击球场开局

待发射（首次、丢命继续、关卡开始）显示「点击任意位置开始游戏」。鼠标主键或第一根手指按下 Canvas 的非控件区域即可开局；同一次手势继续拖动仍控制挡板。只监听 pointerdown / 微信 onTouchStart，不再另外监听 click 触发球场开局，避免兼容鼠标事件重复发射。

`src/PlayfieldStart.ts` 定义两端公用的 ready 状态入口和视觉提示时间曲线。两端最终仍调用原 Game.start，12关配置、生命、物理、得分、ChallengeJournal 和规则版本不变。

共享 Renderer 在圆心绘制约70%透明度的浅色中文提示和轻微暗底，按屏幕宽度调整字号，用宿主显示帧时间在250毫秒内淡出，不改变物理计时。提示没有 DOM 命中层或微信交互矩形。Web 保留仅键盘聚焦时可见的无障碍启动按钮。

功能按钮不绑定球场开局；暂停必须明确点击继续，结算必须明确下一关/重新挑战。Web 弹窗、后台、正在提交的状态禁止球场开局，即使提交弹窗已关闭且游戏被重置也不会误触发。微信面板、排行榜加载、授权或提交忙碌时同样拦截；仍保留现有联网/单机、隐私说明、微信登录流程。授权中重置游戏会使旧异步回调失效，不启动新一轮。

## 验证

```bash
npm run typecheck
npm test
npm run build
npm run test:wechat
npm run test:minigame
npm run typecheck --prefix server
npm test --prefix server
npm run build --prefix server
# 先启动本地生产预览，另一终端运行下面的浏览器回归
npm run preview -- --port 4173
npm run test:browser:tap-start
```

结果：前端224项、后端63项、微信工程5项、兼容小游戏工程5项通过。前后端类型检查、Web和小游戏构建通过。

Chromium 实测1366×768鼠标、390×844及320×568触屏：中央/左右开局、重复触摸仅一次launch、提示居中淡出、重置恢复、排行/静音/暂停拦截、键盘启动、关闭提交弹窗后忙碌拦截均通过，无pageerror或横向溢出。浏览器脚本全部使用本地API夹具，没有向正式排行榜写成绩。截图及JSON位于忽略提交的 `work/tap-start/`。

`npm run test:browser:wechat` 的真实打包客户端也在本地浏览器模拟微信宿主中通过交互及100球测试，无脚本错误。

微信在无DOM运行时夹具与Canvas 2D宿主中验证触摸、生命周期、联网选择、面板与授权保护；尚未在微信开发者工具或安卓/iPhone真机验收。按 `wechat-game/README.md` 导入现有微信工程后，请用真机补验系统授权弹窗、安全区、拖动与低端设备表现。

不需要数据库迁移、规则升级或后端变更；本次未部署、未修改生产配置或数据库。
