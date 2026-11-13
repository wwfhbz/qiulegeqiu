# V1.5 霓虹深海 · 短关卡新赛季

## 规则变化（`1.5.0-arcade-5l-12lv-short-v3`）

| 项目 | V1.3（冻结） | V1.5（当前） |
|---|---|---|
| 第1关 | 600砖，480个X3（80%） | 600砖，210个X3（35%） |
| 第2关 | 1200砖，360个X3+240个加宽 | 不变 |
| 第3～12关 | 整格约4103～4203砖 | 1500/1600/1700/1800/1900/2000/2150/2300/2400/2500 |
| 机关、球速、出口、挡板、计分、生命、随机掉落 | — | 不变 |

第3～12关仍使用原网格步长和机关保留区，按与第1、2关相同的“离砖区中心最近”规则截取砖块，所以场地中间是一块完整的圆形砖阵。

配置位置：`src/Levels.ts`（`V13_LEVELS` 冻结旧配置，`LEVELS`/`LATER_BRICK_COUNTS` 为新配置），`src/BrickPowerRules.ts`（`TUTORIAL_POWERS.first` 与冻结的 `firstV13`）。

## 排行榜与兼容

- `shared/Challenge.ts`：`RULES_VERSION` 升为 1.5.0，原 1.3.0 改名为 `V13_RULES_VERSION`，仍在 `SUPPORTED_RULES_VERSIONS` 中。
- 服务端校验器按挑战创建时声明的规则选择关卡表；1.3.0 的进行中挑战照常验证、照常进入个人历史。
- 全球榜只统计 1.5.0 的有效成绩（与 V1.3 上线时相同的“重赛上榜、不换算”策略）。旧成绩在“账号与历史记录”中显示为“V1.3赛季记录”。
- 数据库无需迁移：赛季最高分指针本就按 `rules_version` 分开保存。

## 发布顺序

推荐在服务器上以 ubuntu 用户直接运行一键更新脚本，它会自动完成下面三步：

```bash
cd /home/ubuntu/qiulegeqiu && git pull --ff-only && bash deploy/update.sh
```

脚本第7步读取发布包内 `deploy/leaderboard-contract.mjs` 的 `REVIEWED_TRANSITIONS`：规则相同直接发布；登记过的切换先 `--api-only` 安装兼容后端并校验同时支持新旧规则，再正式发布；其他变化一律停止。从不重置数据库。

手动步骤：

1. 先用 `--api-only` 发布后端（双验证桥接：同时接受 1.3.0 与 1.5.0），`deploy/leaderboard-contract.mjs` 中已登记 1.3.0→1.5.0 为经审核的过渡。
2. 确认 `/api/health` 的 `supportedRulesVersions` 含 1.3.0 与 1.5.0。
3. 再发布网页与微信小游戏 1.5.0 客户端。旧客户端在更新前仍能提交 1.3.0 成绩（进入历史记录，不进当前全球榜）。

## 验证

- 前端单元测试 307 项、后端 77 项（新增 `server/tests/season-v15.test.ts`：两种赛季的日志不能互相冒充）。
- 部署契约测试新增 1.3.0→1.5.0 桥接用例。`deployment-bootstrap`、`runtime-dependencies` 两个部署测试要求 Node v24.19.0，本次环境为 Node 22，未运行（改动前同样失败）。
- 微信小游戏产物测试 5 项通过；浏览器 wx 兼容层流程测试通过。不代替微信开发者工具和真机验收。
