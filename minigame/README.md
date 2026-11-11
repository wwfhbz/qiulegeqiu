# 旧微信客户端路径兼容入口

正式客户端源码和文档已统一到[`wechat-game/`](../wechat-game/README.md)，不再维护第二份玩法或客户端实现。

原`npm run build:minigame`、`npm run dev:minigame`、`npm run test:minigame`仍可使用：源码来自wechat-game，读取本目录的local.config.json，生成minigame/dist，保留原有集成兼容性。src/*.ts仅重导出正式客户端。

新项目推荐：`npm run build:wechat`，微信开发者工具导入**wechat-game/dist**。旧工程仍可导入本目录生成的dist，但不要同时修改两处配置；新配置使用wechat-game/local.config.json。AppSecret只在服务端。
