# X3 多球阈值规则

后续第一、二关固定配额版本已采用独立规则 `1.3.0-arcade-5l-12lv-drops-v2` 与统一重赛策略；下文1.2版本兼容描述保留为该次X3改动的历史说明，当前发布以[新手关规则](tutorial-power-allocation.md)为准。

共享实现：`src/PowerRules.ts` 的 `tripleTarget`。Web 和微信客户端均通过同一 `Game → Physics.collect → triple` 调用，服务端回放使用同一数量函数。

拾取前先回收死亡球，按实际存活数量 N 计算：N≤20 时 min(N×3,100)，N>20 时 min(N+3,100)。每次拾取重新计算；空场不会凭空产生球。父球、±0.19弧度派生角、避障和出界修正沿用原实现。

| 拾取前 | 拾取后 |
|---:|---:|
|1|3|
|10|30|
|19|57|
|20|60|
|21|24|
|22|25|
|30|33|
|50|53|
|90|93|
|99|100|
|100|100|

连续示例：20→60→63；21→24→27→30。

## 提交协议与历史兼容

不修改 `1.2.0-arcade-5l-12lv-v1`、日志协议2、数据库结构、历史成绩或榜单排序。X3不改变分数计算口径。每局首次 launch 添加 `tripleRuleVersion:2`，该标记跟随现有日志存储供审计；后续发射不得再次声明。旧日志没有标记时，服务端继续按原乘3规则回放。旧十关日志仍使用旧算法。

服务端 health 和创建挑战响应额外声明 `challengeFeatures:["triple-threshold20-v1"]`。旧客户端忽略新增字段，继续正常提交。新客户端检查两个响应：能力不足时保留单机玩法，明确提示更新后端，不上传不兼容日志、不删除规则标记。

必须先发布后端，再发布网页及微信客户端。部署候选健康检查也验证上述能力；无需迁移或重置数据库。不执行生产部署。旧日志和新版日志使用各自的球数校验，伪造分数、额外死亡、非法拾取、途中更换规则仍会被拒绝。

## 验证

- `npm run typecheck`、`npm run typecheck --prefix server`
- `npm test`、`npm test --prefix server`
- `npm run test:deploy`
- `npm run build`、`npm run build --prefix server`
- `npm run test:wechat`、`npm run test:minigame`
- `npm run test:browser:wechat`

新增测试覆盖全部表格边界、连续拾取、排除死亡球、两客户端共享行为、新旧日志严格回放、实际API提交与幂等重试。浏览器测试使用本地隔离API；不向正式排行榜写入测试成绩。微信开发者工具和真机不在该自动化测试范围内。
