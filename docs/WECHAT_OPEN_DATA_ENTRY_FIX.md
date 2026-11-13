# 微信开放数据域入口修复

基线：main `de60232`。只修构建、入口源码名称、测试和对应文档；不改任何Runtime、UI、玩法或服务器代码。

## 根因

`game.json` 的 `openDataContext` 是目录，不是脚本文件：配置为 `open-data` 时，微信工具加载 `open-data/index.js`。此前构建误生成了 `open-data/game.js`，测试和浏览器模拟也手动读取这个错误文件名，因此测试能通过而开发者工具报缺少index.js。

保留 `"openDataContext": "open-data"`，改为：

```text
wechat-game/open-data/index.ts  →  wechat-game/dist/open-data/index.js
主域仍是                       →  wechat-game/dist/game.js
```

构建新增 `getOpenDataEntry()`，从实际game.json推导“目录/index.js”；配置和输出使用同一份快照，禁止把文件名误填为目录。入口非空存在检查在替换旧dist之前执行，仍保留原有依赖/敏感代码检查与暂存目录构建机制。`build-info.json` 增加 `openDataEntry` 便于检查。

微信官方说明入口：[开放数据域基础](https://developers.weixin.qq.com/minigame/dev/guide/open-ability/opendata/basic.html)。本环境无法打开官网页面，不能声称完成当前开发者工具真机编译；此修复依据目录/index.js入口约定及本次开发者工具明确报错落实。

## 自动化验证

- 类型检查通过；完整381项单元测试通过；网页构建通过。
- 微信与兼容小游戏构建测试各8项通过。
- 按产物game.json推导入口路径，在无DOM VM中加载真实bundle，注册onMessage、执行show/绘制空榜和后台停止绘制。
- 正式CLI `--release` → 开发构建 → 正式CLI `--release` 连续3次；中间故意删除index.js并放入旧game.js，每次重建均生成正确index.js且移除旧文件。夹具只用临时目录及显式合成的公开格式AppID，不代表真实微信账号或上传成功，没有修改真实local.config。
- 社交浏览器模拟测试通过，并按game.json读取index.js，不再手动加载旧文件名。
- 与基线工作树对比：旧 `open-data/game.js` 和新 `open-data/index.js` 的SHA256相同，均为 `8772c3204a07d0c7fc94fa55c169cb107c9482c7b6adab7bbf3180e07ac92ed4`。只改了入口名字，运行逻辑字节不变。

## 构建与导入

配置已有真实AppID后，在仓库根目录：

```bash
npm ci
npm run release:wechat
```

开发者工具导入 **`wechat-game/dist`**。检查 `dist/game.json` 声明目录 `open-data`，且 `dist/open-data/index.js` 存在。缺少真实AppID时发布构建仍会按原安全要求拒绝；本次未放宽此检查。不要再手动复制旧game.js，也不要只导入open-data子目录。

本环境未安装微信开发者工具，无法代替本机原生编译验收；没有上传、发布微信或操作腾讯云。

## 修改文件

- `wechat-game/open-data/game.ts` 更名为 `index.ts`，内容不变。
- `wechat-game/scripts/build.mjs`：统一配置推导和输出、构建前发布检查。
- `wechat-game/scripts/build-test-suite.mjs`：配置路径、加载及重复正式构建回归。
- `tests/browser-wechat-social.mjs`：按game.json加载入口。
- `wechat-game/README.md`、`docs/WECHAT_SOCIAL_V21.md`：修正文档路径。
- 本说明。
