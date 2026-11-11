# 合法道具拾取与成绩提交修复

## 定位与复现

- `server/src/verifier.ts` 的 power 分支抛出 `无对应可拾取道具`（HTTP 422）。
- `src/online/LeaderboardUI.ts` 提交入口显示 `正在校验挑战记录…`，等待身份刷新、分批上传、服务端验证及榜单刷新。原有 finally 会恢复按钮，并非发现了必然漏写 finally 的问题；长局大量批次没有进度、缺乏整个上传阶段的时限，传输层不返回时也缺少跨平台兜底。
- 客户端道具来自固定槽位对象池。旧日志只写类型和 tick，服务端按创建顺序取第一个同类型候选；但道具从不同高度掉落，创建顺序不等于抵达挡板的顺序。还把已过挡板、直到画布底部的道具当作可拾取候选，可能先消费错误记录，令后续真实拾取失去对应记录；对象池满时会进一步影响后续掉落数量。
- `server/tests/power-replay.test.ts` 使用真实 Blocks/Physics.collect/PowerUps/ChallengeJournal 回调构造受控碰撞日志。原实现固定种子 4 稳定抛出该错误；修复后 100 种种子回放通过。该测试不是物理权威回放或性能基准；异常消除速度仍会隔离，不会绕过反作弊。
- 没有取得用户那局 314115 分的原始事件日志，不能声称已逐事件验证该局。未连接生产服务器；线上实际部署版本尚未核实。仓库双方规则均为 `1.2.0-arcade-5l-12lv-v1`。

## 最小修改

1. 每个掉落触发分配回合内递增 dropId，包括池满未生成的触发；只有真实生成的 ID 能被回放匹配。拾取后只消费一次。丢命/切关清空道具时同时重置序号。
2. Web 与微信继续使用同一个 PowerUps、Game 和 ChallengeSync，真实拾取携带 dropId；服务端从击砖事件和种子独立推导 ID、类型、池容量及时间，不信任客户端自报生成事件。
3. 后端保留不带 ID 的旧事件结构，按更严格的挡板拾取时间窗口及最早截止时间匹配。旧无标识日志本身可能无法唯一重建池占用，不能保证恢复所有历史失败挑战；无法安全确定的记录继续拒绝，不能凭总分补登。
4. 炸弹目标事件仍必须紧随拾取事件，目标必须符合确定性最近机关选择；球数量、生命、得分、关卡、时间、重复事件校验保持。
5. ChallengeSync 对每个网络等待增加 10 秒兜底；每次上传阶段在批次边界检查 20 秒预算，显示上传进度。超时保留未确认批次和序号，重试复用同一挑战和幂等键。API 自身的浏览器 6 秒超时仍保留。
6. 失败后按钮恢复并显示准确原因、可重试或跳过；记录保留在当前页面内存。关闭页面、清除浏览器或重新挑战后不承诺恢复。会话失效、挑战超期等不可恢复错误仍明确要求重开。

## 验证命令

```bash
npm ci
npm ci --prefix server
npm run typecheck
npm test
npm run build
npm run typecheck --prefix server
npm test --prefix server
npm run build --prefix server
npm run test:wechat
npm run test:minigame
npm run test:deploy
# 本地构建产物；此浏览器脚本所有 API 均为本地故障注入，不创建正式成绩
npm run preview -- --port 4173
# 另一终端
node tests/browser-power-submission.mjs
```

浏览器证据在 `work/power-submission/`，包含 PC / 手机失败恢复与成功重试截图、JSON 结果；work 不提交 Git。新增长局覆盖第五关、632.7 秒以上、五种道具、炸弹与机关事件，精确比较客户端和回放汇总。新增传输超时、422、丢失上传响应的幂等重试测试。

## 发布与回滚（仅说明，尚未执行）

需要同时更新后端和两个客户端。**先更新服务端，再发布新客户端**，因为旧 API 的 strict schema 不认识 dropId；不能只上传新版前端。没有数据库结构变更，不需要清库、转换历史分数或修改玩家身份，规则数值和规则版本不变。

按 `docs/PRODUCTION_ROLLOUT.md` 从审核通过的同一提交生成并核验发布包。使用正常保留数据库的发布流程，部署前在线备份；禁止使用 reset / fresh-database 模式。本修复不更改部署脚本或任何生产配置。

已有独立运行时和服务的服务器，审核确认后可按文档执行：

```bash
# stage 必须为已核验 SHA256、同一审核提交的安全解包目录
sudo bash "$stage/deploy/publish.sh" --apply "$stage"
curl --fail --silent --show-error https://ball.gmgnclaw.com/api/health
curl --fail --silent --show-error 'https://ball.gmgnclaw.com/api/leaderboard?board=global&offset=0&limit=20'
```

不要在生产用伪造成绩验收；真实挑战需验证提交、个人排名、失败重试、Web/微信共榜。现存失败挑战若原页面日志仍在、会话未过期，可尝试重试；不能保证缺失标识的旧挑战都能被恢复。

程序回滚遵循现有文档：`sudo bash /opt/qiulegeqiu-api/current/deploy/rollback.sh --apply`，恢复匹配的一套前后端；数据库不删除、不覆盖、不回滚。本任务未操作 SQLite、Nginx、systemd、生产主机或《统帅三国》。

## 本次实际结果

- 修复前：新回归用例 seed=4 稳定失败，错误为 `无对应可拾取道具`。
- 修复后：前端 213 项、后端 63 项、微信工程 5 项、兼容小游戏工程 5 项、部署回归 36 项通过；前后端类型检查与构建通过。
- Chromium 1366×768 和 390×844：422 原因显示、按钮恢复、日志保留、相同幂等键重试成功，无 pageerror。API 为本地故障注入，不代表生产验收。
