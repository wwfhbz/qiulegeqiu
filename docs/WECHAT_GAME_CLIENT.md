# 独立wechat-game客户端：架构检查与实施报告

## 开发前检查与计划

基于main的28b9b92（PR19已合并）。已有Vite/TypeScript/Canvas网页，核心在src；已有minigame客户端、WebAudio/Canvas宿主接口和后端官方微信登录。规则1.2.0-arcade-5l-12lv-v1已有12关，global榜已实现；没有必要重复后端、规则或迁移数据库。

发现Game内部直接持有document/指针/浏览器RAF，Renderer默认访问document/window/ResizeObserver；微信虽通过参数避开，但bundle仍混入浏览器实现。旧小游戏帧循环还会在后台持续调度。故先计划，再分阶段完成：

1. 将微信实现集中到wechat-game，旧minigame路径保留兼容重导出。
2. 分离Web/WeChat宿主，Game规则与Renderer无浏览器全局依赖；逻辑坐标、关卡及物理不动。
3. 提供独立package/锁文件、源game.js、game.json、project.config与构建脚本，输出可导入dist。
4. 验证两端规则、平台生命周期、无DOM启动、浏览器和后端兼容，再创建独立PR。

## 最终结构与职责

| 路径 | 职责 |
|---|---|
| src/Game.ts | 共享生命、状态、关卡与得分协调；可注入GameHost或确定性手动驱动 |
| src/Physics.ts、Levels.ts、ScoreSystem.ts等 | 原十二关规则/碰撞/计分，不复制或改数值 |
| src/Renderer.ts | 显式CanvasSurface/RendererHost，不创建DOM或访问window |
| src/platform/Contracts.ts | 两端共享结构化Canvas、帧循环、GameHost类型 |
| src/platform/WebPlatform.ts | Web指针/可见性/ResizeObserver/RAF/音频与清理 |
| wechat-game/src/WechatPlatform.ts | wx Canvas/音频/私有存储、代次保护的可暂停帧循环 |
| wechat-game/src/App.ts | 原中文Canvas界面、原生触摸、生命周期、分享、榜单 |
| wechat-game/src/Api.ts | wx.login/request/私有会话存储；沿用已有Bearer/CSRF协议 |
| wechat-game/game.js | 构建入口；dist/game.js才是微信运行入口 |
| wechat-game/scripts、package*.json | 独立构建/测试，真实AppID提审门禁、依赖图/无DOM检查 |
| minigame/src、scripts | 原路径兼容重导出和构建转发，不维护第二份客户端 |

Game原先的canvas参数由GameHost替代，网页唯一挂载点GameUI已适配；mountGame返回同一个Game供现有界面/调试使用。释放宿主会取消帧与监听器，即使在帧回调中dispose也不再调度。

声音继续使用原有原创正弦音效，Web注入浏览器AudioContext，微信注入wx.createWebAudioContext；在原生触摸开始即解锁，避免等待异步登录后iPhone仍静音。不可用时静音降级。

新增后台取消RAF及代次保护，没有cancelAnimationFrame的兼容宿主中旧回调也不产生双循环。前台恢复调度但不自动恢复挑战。微信UI仅调整顶部工具与HUD垂直间隔，避免44像素按钮覆盖信息，并缩放长数字文本；不改任何逻辑几何。

## 会话与生产安全检查

原后端已区分网页HttpOnly Cookie与微信Bearer，不能混用；微信登录只发送临时代码，服务器持有AppSecret并调用官方code2Session。请求鉴权、CSRF、账号绑定和服务端成绩重算不变。

新客户端使用https://ball.gmgnclaw.com/api，全球榜固定board=global。未登录可只读榜单，提交需要真实会话、昵称/地区及服务端校验，API异常可单机。没有构造假榜或硬编码名次。

**本PR不修改server、deploy、迁移或Nginx，不执行任何数据库重置，不连接服务器。** 测试中的临时库/受控provider不是正式登录或生产成绩。正式合法域名、后端WECHAT_APP_ID/WECHAT_APP_SECRET及平台资格须运营确认，不能把客户端包当作已部署服务。

## 构建和导入

根目录`npm run build:wechat`；或`cd wechat-game && npm ci && npm run build`。生成目录精确为**wechat-game/dist**，微信开发者工具导入这个目录，compileType=game。真实AppID填在wechat-game/local.config.json，AppSecret严禁进入客户端；`npm run release:wechat`会拒绝游客ID及HTTP。

不修改原网页Vite构建，`npm run build`仍生成根dist，不覆盖微信dist；微信构建也不写根dist。旧build:minigame生成旧路径dist，复用新源码并保留旧本地配置兼容。

## 验证

新增Web与WeChat两套实际宿主的十二关驱动测试，用相同时间步/鼠标与触摸轨迹比较砖格、球位置、生命、道具、积分及完整事件日志；不只比较配置常量。测试中直接注入道具和清关事件是加速夹具，不作为合法联网成绩上传。

无DOM VM阻止window/document/localStorage/sessionStorage/ResizeObserver/浏览器AudioContext/fetch访问，执行真实编译game.js并检验12关600砖首关、后台停止/前台不自动恢复、资源释放。构建依赖图阻止Web平台、网页API或后端模块混入。

另保留原单元、后端安全和旧路径回归。官方开发者工具/微信真实登录、安卓/iPhone真机仍待实际AppID与设备验收；Chromium wx兼容层只证明当前宿主契约和Canvas交互，不代表审核或真机FPS。

最终测试数、截图和原始结果见本目录wechat-client-*；真机操作步骤见[客户端README](../wechat-game/README.md)。

实测结果：前端210项、后端59项、部署36项，正式目录与旧兼容目录各5项产物测试通过；独立npm ci/build/test成功，Web/WeChat/后端类型检查与构建通过，regions校验通过。Web五尺寸布局、三尺寸新手关及完整错误回归、两名本地真实API玩家提交和wx兼容层三尺寸回归均无脚本异常。

[验证摘要](wechat-client-validation.json) · [微信兼容层原始报告](wechat-client-browser-results.json) · [Web联网回归](wechat-client-web-results.json)。

截图均为本地Chromium，而非官方工具或真机：[微信首屏](wechat-client-screenshots/phone-ready.png) · [320窄屏](wechat-client-screenshots/small-phone-ready.png) · [全球榜](wechat-client-screenshots/global-board.png) · [保留的网页首屏](wechat-client-screenshots/web-mobile.png)。

完整修改路径见[WECHAT_GAME_FILES.md](WECHAT_GAME_FILES.md)。未修改server或deploy源码。
