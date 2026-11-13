# 球球出击：独立微信小游戏客户端

这是微信**小游戏**（Canvas 2D），不是普通小程序页面或web-view。源码位于wechat-game，复用仓库src中的Game、Physics、Levels、Blocks、ScoreSystem、PowerRules与ChallengeJournal，不复制玩法。网页继续由原Vite工程运行。

当前规则为`1.3.0-arcade-5l-12lv-drops-v2`：十二关、初始/上限5命、100球、五种道具、固定/移动/旋转机关、600/1200砖新手关、圆外水平挡板及160逻辑像素间距保持不变；前两关道具使用固定预分配配额。统一全球榜使用`/leaderboard?board=global`，排名只显示服务端结果。

## 构建与准确导入目录

需要完整仓库（核心源码在父目录），Node24，推荐v24.19.0。

仓库根目录：

```bash
npm ci
npm run build:wechat
npm run test:wechat
# 开发包（默认只连接本机API）
npm run dev:wechat
```

或使用独立客户端命令，不依赖Vite构建：

```bash
cd wechat-game
npm ci
npm run typecheck
npm run build
npm test
```

**微信开发者工具应导入：`<仓库根目录>/wechat-game/dist/`。**

本开发环境准确路径为`/workspace/ball-core/wechat-game/dist`。Windows例如`D:\项目\qiulegeqiu\wechat-game\dist`。不要导入仓库根目录、src或源文件game.js；源码game.js是esbuild入口，运行的是dist/game.js。

构建输出game.js、game.json、project.config.json及build-info.json，compileType为game，竖屏。生成的项目根为`./`，没有对目录外文件的运行时引用，不会把server、数据库或node_modules打进去。

## AppID与环境

复制local.config.example.json为local.config.json（已被Git忽略）：

```json
{
  "appid": "填写真实小游戏AppID",
  "apiBase": "https://ball.gmgnclaw.com/api"
}
```

此JSON的AppID文字需替换成你实际的公开小游戏AppID，不能直接使用。默认touristappid只供可允许游客的开发环境单机检查，不是生产登录身份；若当前工具不接受小游戏游客模式，必须填写真实AppID。**不能填写AppSecret**，构建器发现额外字段会失败。project.private.config.json与本地配置不提交。

正式候选包：

```bash
# 仓库根目录
npm run release:wechat
# 或wechat-game内
npm run release
```

release要求真实格式的AppID，禁止开发模式与HTTP。它只生成候选包，不签名、不上传、不表示已通过官方审核。默认build使用HTTPS，也可供离线验证；真实登录仍需要后台配置。

## 微信开发者工具操作

1. 使用官方微信开发者工具，选择**小游戏**项目与真实小游戏AppID，不选普通小程序。
2. 先构建，再导入**wechat-game/dist**，核对project.config.json内AppID与公众平台一致、入口game.js、竖屏game.json。
3. 选择支持getWindowInfo、Canvas 2D、触摸/生命周期、requestAnimationFrame的稳定基础库。WebAudio不可用时静音降级，不阻断游戏。
4. 公众平台配置request合法域名`https://ball.gmgnclaw.com`，只填域名不带/api路径；确认有效HTTPS证书。
5. 本机API调试可用npm run dev:wechat，默认http://127.0.0.1:8091/api，只适用于开发工具本机。真机的127.0.0.1指手机本身，不能访问电脑API；真机必须使用可达HTTPS测试域名或获准使用正式域名。
6. 本PR不修改线上API、Nginx、SQLite或部署设置，也不自动上传微信平台。

## 身份和统一排行榜

客户端用wx.login临时代码换取后端Bearer会话，wx.request发送Authorization和X-CSRF-Token；凭据仅放微信私有存储，**不使用浏览器Cookie、localStorage或网页身份猜测**。

服务器代码已存在官方code2Session、昵称/地区、成绩日志校验、global TOP100、我的排名和一次性网页绑定码。AppSecret及WECHAT_APP_ID/WECHAT_APP_SECRET只在后端环境，前端不能保存或直接调用换码接口。微信原生请求不依赖浏览器CORS放行，现有网页HttpOnly Cookie/CSRF和Origin规则不变。

同一AppID的旧客户端凭据存储键保持，目录迁移不主动注销或重建玩家。网页账号只有通过已登录网页生成的五分钟一次性码与微信凭据才能绑定，不按昵称冒领，已登记的两份身份不能自动合并。

生产后端是否已配置真实AppID/AppSecret、global协议及合法域名**尚未现场确认**。接口未配置返回真实错误并可单机游玩，不伪造登录、排名或成绩。成绩继续走原服务端校验/异常隔离；当前仍不是完整权威物理回放，不宣称完全防作弊。

## 平台实现

- `src/platform/WebPlatform.ts`：浏览器Canvas、ResizeObserver、指针、可见性、RAF及浏览器音频。
- `wechat-game/src/WechatPlatform.ts`：微信Canvas、音频、私有存储和可停止/恢复的原生帧循环；不安装DOM模拟层。
- `wechat-game/src/App.ts`：Canvas中文HUD/菜单、触摸、隐私授权、后台暂停、分享及榜单面板。
- Game只协调共享规则；Renderer通过CanvasSurface/RendererHost渲染，二者无浏览器全局访问。TypeScript的DOM lib仅用于擦除后的Canvas/音频类型，不是运行时依赖。
- 后台暂停物理/道具计时、停止帧循环和音频；前台保持暂停，点击继续，避免后台耗命。DPR上限2降低手机离屏缓存压力，逻辑比例800×1120保持，不改变碰撞。
- 顶部按钮有44像素触控区，HUD避开胶囊与刘海；鼠标/触摸都只水平移动挡板，内部坐标与网页相同。

## 真机验收清单

本地自动化通过不能替代以下实际验收：

- 安卓与iPhone各一台：首屏完整、刘海/胶囊/底部安全区、320/390/430宽及高DPI，无拉伸或挡板裁剪。
- 拖动挡板、中央开始、暂停/继续、重开；后台停留再回前台不自动发球、生命与强化计时不变。
- 首次触摸音频解锁、静音/恢复、静音偏好、长时间多球及低端安卓温度/帧率；不能用桌面兼容层FPS宣称真机稳定60。
- 十二关与五道具：生命上限、多球上限、炸毁机关/当前关续玩、最终胜利。
- 在批准的测试后端真实微信登录、昵称/地区登记、同一global榜与最高分、刷新/重进身份、微信/网页受控绑定。不要向生产插入假玩家或伪造成绩。
- API断网或503仍能单机及跳过提交；过期凭据不会无限登录，旧事件不在新身份重放。
- 运营方同步平台游戏名称、隐私指引/协议、域名与必要运营资质；见[原上线清单](../docs/MINIGAME_RELEASE.md)。未接广告、支付或好友关系接口。

## 自动化与边界

```bash
# 仓库根目录
npm run typecheck
npm test
npm run test:wechat
npm run test:minigame
npm run typecheck --prefix server
npm test --prefix server
npm run build
npm run build --prefix server
npm run test:browser:wechat
```

浏览器兼容测试需要Chromium，默认/usr/bin/chromium，可设置CHROMIUM_PATH。该脚本把wx接口连接到本地随机回环端口和临时SQLite，**不是访问生产API**。无DOM VM测试会对window/document/localStorage/Cookie相关访问直接报错；构建检查还拒绝引入Web适配器或服务端代码。

正式微信开发者工具、微信官方登录及iOS/Android真机没有在当前Linux环境完成验收；不会把兼容层截图说成真机。

旧minigame/仅保留重导出与构建兼容入口，没有第二份规则。新增工程与验证详情见[实现报告](../docs/WECHAT_GAME_CLIENT.md)。

## V1.4视觉更新

使用shared/VisualTheme及同一Renderer的深海蓝六色风格，移除旧排行榜插画加载和打包。游戏、道具、身份、API和规则版本均不变。独立构建和导入目录保持原方式。[截图与真机待办](../docs/DEEP_OCEAN_UI.md)。

## V2.1 社交功能（基于当前2.3.0主线）

好友榜独立运行于`open-data/`，构建输出`dist/open-data/game.js`；结算可分享成绩，全球榜提供可拒绝的本机资料设置。正式成绩仍以服务器全球榜为准，客户端云存储不能完全防作弊；本机昵称不会改全球榜身份。

[完整架构、官方来源、权限限制、构建/上传命令与安卓/iPhone真机清单](../docs/WECHAT_SOCIAL_V21.md)。没有自动上传或修改现有审核版本。
