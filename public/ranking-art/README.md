# 排行榜参考场景

`reference-scene.png` 为按用户提供参考图重制的静态美术：游戏徽标、红金绶带、皇冠球球、金色外框、星空、行星与底部砖块。资源由图像生成工具制作，不引用外部付费素材。

图片内部不含玩家姓名、排行榜条目、名次、分数、列标题或账号资料；全部动态数据由DOM或Canvas实时绘制。资源并非原图逐像素文件，运行时按共享参考坐标布局。

Web由Vite复制到`dist/ranking-art/reference-scene.png`。微信构建脚本复制同一文件到`wechat-game/dist/assets/ranking-scene.png`，运行时使用微信本地Image接口读取，不依赖外部图片域名。缺图时Canvas保留程序绘制的标题和数据，不影响游戏状态。
