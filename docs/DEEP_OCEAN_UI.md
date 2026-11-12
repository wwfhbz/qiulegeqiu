# V1.4 深海蓝·现代街机

本次是纯视觉版本。客户端显示版本1.4.0，规则仍为 `1.3.0-arcade-5l-12lv-drops-v2`。无需更新排行榜后端或迁移数据库；没有部署或合并操作。

## 审计与实际修改范围

[完整修改文件清单](v14-files.txt)，包含测试与截图文件。

基线为main的 `5ec1854`（已合入新手关配额及重赛上榜策略）。改动前已核对第一关600砖/480个X3，第二关1200砖/360个X3/240个加宽，因此未在UI任务中补做玩法。

| 原有入口/组件 | 本次职责 |
|---|---|
| src/Renderer.ts | 共享Canvas场景、六色砖块缓存、球体、挡板、道具、短粒子与提示 |
| src/GameUI.ts、src/style.css | 网页HUD、进度展示、暂停/结算和响应式布局 |
| src/platform/WebPlatform.ts、Contracts.ts | 只增加纹理缓存工厂和低性能提示，输入映射不变 |
| src/online/LeaderboardUI.ts、ranking/* | 只改排行榜和成绩表单的呈现；保留原数据、排序、身份、提交和校验 |
| wechat-game/src/App.ts、Panel.ts、RankingCanvas.ts、Layout.ts | 微信Canvas同主题HUD、面板、榜单；布局变动仍通过同一view计算触摸映射 |
| wechat-game/src/WechatPlatform.ts、scripts/build* | Canvas纹理工厂，移除不再使用的排行榜大插画打包 |
| shared/VisualTheme.ts、CanvasUI.ts | 两端共用主题、字体、排名色、视觉预算和Canvas基础组件 |
| shared/Brand.ts、根package与锁文件、index.html | 客户端版本1.4.0及浏览器主题色，不改变规则版本 |

审计时识别的主要风险为：HUD挤占画布、榜单内容滚动覆盖个人栏、文字过长、多球拖尾开销、微信安全区及布局与输入坐标漂移。对应测试覆盖如下。

## 视觉变化

- 深海蓝纵向轻渐变，安静背景；不再加载旧星际插画。
- 六色砖块按视觉分组着色，轻圆角/顶边高光/底部暗边；不编码砖块类型、血量或掉落，不改变碰撞尺寸。静态砖块缓存只在生成或销毁时更新。
- 珍珠白球体、短浅蓝拖尾；金属挡板只按真实宽度画出，不改变运动与加宽规则。
- 五种道具统一徽章；图集只绘制一次，每帧复用，480个掉落物也不重复排版480次文字。不丢弃真实掉落。
- 网页64px双行HUD；微信56px双行HUD，进度条和数字全部从现有状态读取。保留5条生命、球数、关卡、积分及剩余砖块。
- 结算总分突出、关卡/砖块/时间分列；暂停遮罩柔和，不改变暂停逻辑。微信长错误改用完整原生文字对话框，错误后仍恢复忙碌状态、保留日志。
- 排行榜桌面六列、手机双行卡片。第一名低饱和金、第二银蓝、第三暖铜、第四/第五蓝色，后续普通深蓝卡；所有头像均为同一原创默认球球。
- “我的排名”仍属于面板底部，列表独立滚动；加载/空榜/错误/长昵称/并列分/未上榜/超过TOP100的个人排名均保留实际语义。

## 统一配色

| 用途 | 色值 |
|---|---|
| 主背景 / 竞技场 / 渐变结束 | #101D2D / #192B40 / #243B55 |
| 面板 / 边框 / 分割线 | #23384F / #49617A / #3A5068 |
| 主文字 / 次级 / 弱化 | #F4F7FB / #B8C8D8 / #8499AF |
| 强调 / 正向 / 警告 | #56C4DC / #76D6B0 / #F0B86A |
| 海蓝 / 湖青 | #4399D2 / #53B8BC |
| 琥珀 / 珊瑚 | #E9B75C / #E98275 |
| 蓝紫 / 薄荷绿 | #888CCF / #75BE9D |
| 球体 / 边缘 / 高光 | #F7FAFF / #C7D8EA / #FFFFFF |
| 挡板主体 / 侧边 / 装饰 | #DCE7F3 / #4B789D / #56C4DC |
| 排名金 / 银 / 铜 | #C6AB74 / #A6BECE / #C49C84 |

系统中文无衬线字体，无付费字体、资源或新UI框架。主题色、透明色、字体及视觉预算集中在VisualTheme；旧浏览器不支持color-mix时有普通色/透明色回退。

## 实际截图

全部为本地浏览器或微信宿主模拟器截图。**排行榜里的玩家/成绩是明确标注的本地测试夹具，不是正式全球榜数据。** 正式客户端仍读取原服务端接口，不生成假玩家或假排名。

| 页面 | 改造前 | 改造后 |
|---|---|---|
| PC游戏 | [原界面](v14-screenshots/before-desktop.png) | [深海蓝](v14-screenshots/desktop.png) |
| 手机游戏 | [原界面](v14-screenshots/before-mobile.png) | [深海蓝](v14-screenshots/mobile.png) |
| 全球榜 | — | [PC](v14-screenshots/leaderboard-desktop.png) / [手机](v14-screenshots/leaderboard-mobile.png) |
| 结算与暂停 | — | [手机结算](v14-screenshots/result-mobile.png) / [暂停](v14-screenshots/paused-mobile.png) |
| 微信Canvas | — | [游戏](v14-screenshots/wechat-ready.png) / [结算](v14-screenshots/wechat-result.png) / [排行榜](v14-screenshots/wechat-ranking.png) |

## 性能与行为验证

53个核心/后端文件与main逐字一致，包含完整server目录、Physics、Game、GameConfig、Effects、Blocks、关卡、道具、计分、ChallengeJournal和共享协议。源码SHA256对照、原始浏览器数据见 [v14-validation.json](v14-validation.json)。

新增13项单元用例覆盖主题、20/21/50/51/100球预算、六色缓存及单格清除、图集复用、长错误、双端600/480及1200/360/240配额，并验证连续绘制60帧后整个游戏状态（含Effects、球、砖、积分、生命和日志）不变。

视觉预算为≤20球12像素拖尾/最多64碎片，21～50球7像素轻拖尾/32碎片，>50球去掉拖尾和非必要高光/16碎片，低端设备最多12碎片。只显示约160ms碎片，原Effects更新和真实事件完整保留。不降低固定时间步长。

以下为独立运行的Linux headless Chromium结果：桌面1440×1000、手机尺寸390×844（DPR3），每个球数测试4203砖和480个真实预分配掉落两种夹具。使用真实Physics.advance和Renderer.draw，在物理回收后由测试夹具补球保持目标数量，热身后采样89帧。不向生产API提交成绩，不代表自然游玩或真机性能。表中耗时为同球数组合的最大P95。

| 球数 | 平均FPS范围 | 更新+绘制P95 | 帧间隔P95 |
|---:|---:|---:|---:|
|20|60.0～60.0|0.90 ms|16.80 ms|
|50|60.0～60.0|1.00 ms|16.80 ms|
|100|60.0～60.0|1.00 ms|16.80 ms|

网页六个视口320×568至1920×1080验证：无横向溢出、按钮/挡板完整、Canvas比例800:1120、HUD不遮挡、暂停不推进物理、重开恢复原状态、触摸水平移动正确。排行榜同时测试真实个人排名130、空榜、加载失败、长Unicode昵称、并列分、大分数、少量结果不留大空白、滚动与暂停/后台冻结。400/422提交故障注入验证按钮恢复、保留日志、同幂等键重试。

## 自动化结果与复现

- 前端：291/291；后端：75/75；部署：42/42。
- 微信小游戏构建用例5/5，兼容入口5/5；Web/API/微信及兼容入口类型检查和构建均通过。
- 页面视觉回归、微信无DOM VM/Chromium Canvas宿主、提交失败重试回归通过。
- 早期回归中旧HUD脚本仍点击已隐藏的开始按钮，已改为实际点击画布开局；新增mock上下文的spy也已修正。没有跳过失败用例。

```bash
npm run typecheck
npm test
npm run build
npm run typecheck --prefix server
npm test --prefix server
npm run build --prefix server
npm run test:deploy
npm run test:wechat
npm run test:minigame
# 另一个终端先启动本地Vite，再运行浏览器回归：
npm run dev -- --port 4173
npm run test:browser:ocean
npm run test:browser:galactic
npm run test:browser:wechat
npm run test:browser:ui
node tests/browser-power-submission.mjs
EVENT_SCHEMA_FAIL=1 node tests/browser-power-submission.mjs
```

## 尚未解决 / 上线前待办

1. **没有真实iPhone、Android或微信开发者工具的验收结果。** 已覆盖Chromium手机触屏、安全区/DPR和微信Canvas宿主模拟，但不可等同真机。
2. 尝试安装Playwright WebKit用于Safari引擎检查时，官方镜像下载被当前环境网络策略以HTTP403拒绝，故不能声称Safari测试通过。需在可下载环境运行WebKit，并在真实iPhone验证原生dialog、触屏及安全区域。
3. 微信原生错误对话框皮肤由系统控制，文字完整展示但不能强制与自绘面板完全同色。
4. 本环境约60FPS不是对低端手机的保证；真机若有压力应继续降低纯视觉预算，不能改物理精度或真实掉落。

微信导入目录仍为 `wechat-game/dist`。本次只更新客户端，不改服务器、数据库、接口、排行榜规则或规则版本；等待审核后再决定发布，未自动部署，也未操作《统帅三国》。
