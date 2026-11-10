# 球球出击 · 微信小游戏 V1.1

这是微信**小游戏**工程，不是web-view或普通小程序页面。网页客户端保留。使用同一个Game、Physics、Blocks、Levels、PowerRules、ScoreSystem及ChallengeJournal，规则版本仍为`0.8.0-arcade-5l-10lv-v1`，不另写游戏规则。

## 开发与构建

使用Node v24.19.0，与现有后端保持一致：

```bash
npm ci
npm ci --prefix server
npm run typecheck
npm run typecheck:minigame
npm test
npm run typecheck --prefix server
npm test --prefix server
npm run build
npm run build --prefix server
npm run build:minigame
npm run test:minigame
```

产物为`minigame/dist/game.js`、`game.json`、`project.config.json`。默认API为`https://ball.gmgnclaw.com/api`；本PR没有部署后端，线上尚未保证有新增微信接口。没有登录配置时，客户端可选择单机，不能伪造生产登录。

## 微信开发者工具导入

1. 安装官方微信开发者工具，创建/选择**小游戏**AppID；不要选普通小程序或H5。
2. 将`minigame/local.config.example.json`复制为`minigame/local.config.json`，填写你自己的公开AppID；AppSecret绝不放在这里。
3. `npm run dev:minigame`生成调试包，或`npm run build:minigame`生成正式候选包。
4. 导入`minigame/dist`目录，使用其中生成的project.config.json，编译类型为game、入口为game.js，竖屏。
5. source工程和默认生成包使用touristappid仅作占位，不代表真实AppID、有效登录或审核资格。若当前工具不允许小游戏游客导入，必须配置真实AppID；不能编造一个AppID绕过。
6. 选择支持getWindowInfo、Canvas2D、触屏、生命周期等接口的稳定基础库，在工具和iOS/Android真机逐项验证；createWebAudioContext不可用时静音降级。

项目没有向代码包加入服务器、数据库、密钥或node_modules。生成目录和local配置已被Git忽略。包使用原创Canvas图形与程序化音效，无广告、支付或好友关系读取。

## 本地后端

```bash
# 终端1：只启动本地服务，默认缺微信配置时登录返回503
npm run api:dev
# 终端2：构建小游戏调试包
npm run dev:minigame
# 网页仍可正常开发
npm run dev
```

dev构建默认连接本地API，正式候选包默认连接现有HTTPS域名。开发者工具连接本地API时，也可把local.config中的apiBase显式设为`http://127.0.0.1:8091/api`，必须使用dev构建，并仅在工具内手动关闭本次本地域名校验。正式构建拒绝HTTP。真机的127.0.0.1指手机自身，应使用另行授权的HTTPS测试域名，不修改现有生产Nginx。

## 正式微信登录所需后端变量

只在服务器安全环境文件配置：

- `WECHAT_APP_ID`：与小游戏对应的AppID。
- `WECHAT_APP_SECRET`：仅服务器可读的真实AppSecret，不放VITE变量或小游戏配置。
- 原有`PUBLIC_ORIGIN`、`DB_PATH`、`PORT`继续保持，生产API仍只监听127.0.0.1:8091。

必须同时配置两项微信变量；未配返回503，错误配置不伪造成功。微信官方换码会消耗wx.login的临时代码，失败后重新获取。登录返回本应用随机Bearer/CSRF，小游戏在平台私有本地存储保存，后端仅存令牌哈希；网页登录继续用HttpOnly Cookie。详见[微信接口与迁移](../docs/WECHAT_API.md)。

## 玩法与UI

五命、十关、100球上限、五种道具、固定/移动/旋转机关和所有物理数值保持。中央开始/继续/下一关按钮、底部暂停和重开；触屏只水平移动挡板。刘海/胶囊安全区域和DPR上限2独立缩放，不改变800×1120逻辑坐标。

首次开始可选联网或单机；只有联网开始的挑战能登记成绩。结束后输入昵称、选择国家/省/市/县（任意一级停留）、服务端查重与审核，再提交原格式事件记录和摘要。可随时跳过提交。菜单含隐私协议、申诉、静音、分享、单机/联网重新挑战、网页账号绑定。

微信和网页共用同一TOP100与个人最高分。绑定必须在自己已登录的网页排行榜生成五分钟一次性码，再在尚未登记玩家的微信身份中输入。不会通过昵称/openid/客户端playerId冒领历史，也不会自动合并两个已有玩家。

## 自动验收与验证边界

```bash
npm run test:browser:minigame
```

此命令使用Chromium和**测试专用wx兼容层**，临时后端使用内存SQLite、注入测试换码器、随机回环端口；不会访问真实生产玩家或写入线上成绩。截图/报告在`work/minigame`。百球帧率测量仅代表开发环境的Chromium，不代表低端安卓或微信真机。

当前环境没有微信开发者工具、正式AppID/Secret，不能声称已通过实际工具启动、真机登录、好友分享或平台审核。这些项目必须在正式提交前补测，见[上线前清单](../docs/MINIGAME_RELEASE.md)。

[兼容层截图与测试记录](../docs/MINIGAME_VALIDATION.md)。浏览器自动化默认使用`/usr/bin/chromium`，其他位置可设置`CHROMIUM_PATH`。不具备该浏览器不影响开发者工具导入工程；不要把兼容层通过当作真机审核完成。
