# 地区数据与更新

版本：MCA-derived-2025-12-31+ISO3166-1-7.14.0。

中国数据：[yescallop/areacodes固定提交](https://github.com/yescallop/areacodes/tree/e2c2b2e1fb4ce1fb76e879aa0b80e229adaf950c)，data/2025.txt，CC0-1.0。该数据集说明来源为[国家地名信息库](https://dmfw.mca.gov.cn/XzqhVersionPublish.html)、民政部县级以上代码、变更公告及国务院公报，并包含维护者勘误。直接官方旧页面本环境无法读取，故使用可核验、固定版本的社区转录快照，不能声称已逐条直连官方验证或2026最新。

国家和地区：i18n-iso-countries@7.14.0，ISO 3166-1 alpha-2 249项，中文标签使用该库zh数据（MIT）。标准查询：[ISO OBP](https://www.iso.org/obp/ui/#search/code/)。20个常用项是产品预设，非官方排名。

生成数据3459条：246个独立ISO根节点，加中国省级34、地级333、县级2845；ISO中TW/HK/MO三项映射到CN:710000/810000/820000的同一canonical身份，避免同一地区因两套码重复抢注。

- 保留六位完整行政码，用CN:前缀与ISO区分；同名县区不会覆盖。
- 直辖市、海南/河南/新疆等直属县级单位在数据没有地级父节点时直接挂省级；选择器跳过虚构的“市辖区/省直辖县级行政单位”中间节点。
- 台湾、香港、澳门在本来源口径只有省级，显示“仅提供省级”而不虚构其他口径的县/区。
- 排行榜仅使用服务器生成的最终一级prefix；选择器可显示上级辅助路径。选择地区不代表核验真实所在地。

更新：根目录npm ci后运行npm run regions:update（本地固定快照重建），或node scripts/update-regions.mjs --download重新下载同一固定提交。更新到新年份必须维护版本、上游提交、校验基线和变更说明，审核后再执行。npm run regions:check校验唯一性及父节点缺失；重建脚本还检查总数/省级数，不允许静默缺省。脚本不会手写县市列表或自动把未知新码强塞到错误上级。

server/data/regions-manifest.json包含来源、SHA-256、版本、数量与限制；cn-2025.txt原始快照和两项许可证随仓库保存。npm run migrate --prefix server幂等upsert地区，已被身份引用的旧码不会自动删除。后续撤县/并区须另外定义身份保留/迁移策略并备份，禁止盲目重写既有身份码。
