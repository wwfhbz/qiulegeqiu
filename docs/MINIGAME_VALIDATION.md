# 小游戏 V1.0 验证记录

2026-11-10，开发环境Node v24.19.0。没有访问或写入生产排行榜，没有使用正式微信AppID/Secret。

| 检查 | 实际结果 |
| --- | --- |
| 原网页版与新增平台测试 | 168项通过，原154项保留 |
| 后端测试 | 47项通过，原35项保留，新增微信认证、绑定、真实SQLite重开、并发和迁移回退 |
| 部署回归 | 22项通过，无跳过 |
| 小游戏包检查 | 3项通过，禁止Secret进入配置、正式HTTP、确认入口与配置且无后端代码 |
| 类型检查/构建 | 网页、小游戏、后端均通过 |
| 地区数据完整性 | 通过，沿用现有版本和来源 |
| 原网页浏览器回归 | 桌面/手机2个玩家真实本地API登记、跨端榜单、刷新身份与断网跳过通过；5个视口首屏布局通过 |
| wx兼容宿主 | 375×812、320×568、768×1024，中央开始/触屏移动/后台暂停/多球/结束日志/同一后端成绩与榜单通过，无页面异常 |
| 官方微信工具/真机 | 未运行；缺少工具、真实AppID/Secret及设备，不宣称已通过 |

百球压力测试为每个视口90个RAF采样，开发环境Chromium约60帧/秒，完整原始数值见[minigame-validation.json](minigame-validation.json)。它不是低端安卓、微信开发者工具或真实设备的FPS保证。

自动化登录换码由**测试专用**provider注入，数据库为本地隔离库；只用于测试，不打入生产API入口或小游戏包。真实登录路径没有开发伪造成功开关，缺少后端微信配置返回503。

## 截图（Chromium wx API兼容层，非官方开发者工具）

- [375×812 首屏](minigame-screenshots/phone-ready.png)
- [375×812 结束后榜单](minigame-screenshots/phone-board.png)
- [375×812 结算](minigame-screenshots/phone-result.png)
- [320×568 首屏](minigame-screenshots/small-phone-ready.png)

## 可复现命令

```bash
npm ci
npm ci --prefix server
npm run typecheck
npm run typecheck:minigame
npm test
npm run build
npm run typecheck --prefix server
npm test --prefix server
npm run build --prefix server
npm run regions
npm run test:deploy
npm run test:minigame
npm run test:browser:minigame
```

原网页版浏览器回归使用本地生产预览和本地SQLite API，设置PUBLIC_ORIGIN对应预览Origin；没有把浏览器自动化指向ball.gmgnclaw.com生产站点。
