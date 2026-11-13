# 无尽模式 V1.5：平衡升级与永久统一榜

基于main `b6a1f18`检查开发：PR52的V1.4规则、PR53的永久统一无尽榜和PR54的V2.4结算界面均已在源码中。没有读取或假定腾讯云/微信平台实际已部署这些版本。

## 新旧配置

| 参数 | V1.3（冻结） | V1.4（冻结） | V1.5 |
|---|---|---|---|
| 验证规则版本 | endless-1.3.0-3l-sink-v4 | endless-1.4.0-3l-sink-v5 | endless-1.5.0-3l-sink-v6 |
| 初始逻辑砖墙行数 | 18 | 18 | 20 |
| 每行生成填充率 | 88% | 88% | 88% |
| 下沉间隔（tick） | max(300,round(720×0.985^n)) | max(180,round(540×0.98^n)) | max(240,round(600×0.985^n)) |
| 掉落间隔 | min(60,16+floor(D/125)) | min(40,10+floor(D/200)) | min(50,12+floor(D/100)) |
| +3 / 加宽 / ÷2 / 穿透 / 火焰 / 闪电 / 生命权重 | 270/200/130/130/120/147/3 | 300/130/130/130/140/167/3 | 280/150/130/130/140/167/3 |
| 加宽倍率、持续时间 | 1.8倍、5秒 | 2倍、8秒 | 1.8倍、8秒 |
| 火焰范围、持续时间 | 中心+周围8格、6秒 | 中心+固定12格、6秒 | 中心+固定12格、6秒 |
| 闪电数量上限 | 12 | 15 | 12 |

统一固定步长120 tick/秒；所有版本仍3条生命，球上限100，穿透4秒，+3增加3球，÷2向上取整至少1球，生命恢复不超过3，压线1200 tick扣命，下一次发射清底部5行并按原独立种子流抽取+3/穿透/火焰/闪电各25%的补偿。有效道具拾取仍+100分，其余积分、连击、阶段、速度、物理/死亡线/挡板控制/布局不变。闯关12关、5命、道具及排行榜不变。

### 初始行数与确定性

`EndlessSettings`新增初始行数和穿透/火焰时长；旧配置显式冻结18行、4秒/6秒。`EndlessField.start()`按版本设置base世界行编号，不能只把全局18改成20；服务端复用同一类重建旧/新砖墙。V1.5为20个逻辑行（0–19），仍按原圆形掩码裁剪，圆顶不存在能容纳完整方块的位置时该行可以为空；没有改变坐标、网格或裁剪方式。seed=7示例：572块初始存活砖，最低初始行19、危险行40，blocked=false，开局不会触底。

每行的独立seed算法及随机消费顺序不变；V1.5新增两行只增加其自身行流。道具抽取每次仍消费一个原seeded RNG值，补偿流独立不变。掉落后按当时累计D排定下一阈值，例如12、24…96、108、121；并非在第100块时重排已经预定的下一次掉落。每砖只能销毁一次，火焰/闪电造成的命中均走同一回调计数/计分/生成路径，道具未被挡板接到不生效。保留原道具池容量和满池处理，不额外限频或改变原算法。

火焰偏移与V1.4保持相同固定顺序，仅12个额外位置，不是5×5；额外烧毁不递归，边界裁剪、重复命中跳过。闪电仍最低行优先，同一行按首颗有效球的水平距离、索引稳定排序。加宽刷新8秒不叠加；暂停/后台停下沉和技能计时。

## 验证与排名分开

V1.5是新增验证版本，不是新排行榜或赛季。服务器仍使用创建挑战时固定的rules_version，选择对应初始行、下沉、随机权重、技能范围和异常预算。未知版本、错误seed、冒用旧版本、重复砖块、假道具/分数继续拒绝；没有关闭或放宽校验。现有服务端是规则/事件/积分回放，未获取完整挡板输入，不是服务端权威物理回放，不能宣称完全防作弊。

**所有无尽版本永久共用一个排行榜**：按mode=endless取全部有效记录，跨版本每名玩家仅取最高分，排序、TOP100、分页、真实个人排名沿用现有实现。本次没有修改server/src/leaderboard.ts、数据库结构、身份认证、历史记录或好友键。微信固定无尽云键不随本次版本变化，不新建V1.5榜。

没有新增数据库迁移；若生产尚未应用既有005模式字段迁移，仍须按[永久统一榜方案](ENDLESS_V14.md)先在线备份并完成该已审查的增量迁移，禁止清库重建。代码合并不等于已部署。

## 修改位置

- `src/endless/EndlessRules.ts`：V1.5权重/下沉/技能/20行配置及版本注册；旧配置冻结。
- `src/endless/EndlessField.ts`：按版本设置初始世界行base。
- `src/Physics.ts`、`server/src/endlessVerifier.ts`：从对应版本读取穿透/火焰时长（数值旧版不变）。
- `shared/Challenge.ts`、`server/src/app.ts`：保留V1.4标识并支持V1.5验证版本。
- 前后端V1.4测试明确使用冻结版本；新增V1.5测试及修改前V1.4黄金样本。
- 微信构建元数据和部署health测试期望包含新版本；README、CHANGELOG及本文。

## 完整验证命令

使用Node 24.19.0，部署集成测试在Linux执行；不是运行腾讯云部署脚本。

```sh
npm run typecheck
npm test
npm run typecheck --prefix server
npm test --prefix server
npm run build
npm run build --prefix server
npm run test:wechat
npm run test:minigame
npm run test:deploy
node tests/browser-endless-v14.mjs
npm run test:browser:wechat
```

本次实际结果：前端442项、后端109项、部署回归48项、微信及兼容小游戏构建测试各8项通过；前后端类型检查、Web/API/两套小游戏构建通过。Chromium桌面1280×900、手机390×844及微信兼容流程的375×812、320×568、768×1024检查通过。历史命名的browser-endless-v14.mjs是当前版本的浏览器冒烟脚本，实际运行V1.5。新增覆盖9个掉落边界、权重边界/单次RNG消费、20行精确seed重建/不压线、旧V1.4三组200次抽取及10000tick黄金摘要、旧V1.3黄金回归、技能范围/时长、暂停/后台、真实火焰/穿透/闪电接触日志回放、压线扣命/清5行补偿、三个版本真实成绩同榜/历史最高/低分保护/幂等/伪分拒绝及Web/微信共享轨迹。原12关、无尽及永久榜测试继续执行。

浏览器检查使用Chromium/模拟wx接口，不能作为官方微信开发者工具或安卓/iPhone真机验收。统计数据是本地测试结果，不是线上验收。

## Windows PowerShell 本地更新与测试

已有本地修改先自行保存，不执行强制覆盖；已有同名分支时用`git switch feature/endless-v15`。

```powershell
git status --short
git fetch origin
git switch --track origin/feature/endless-v15
git pull --ff-only
node --version # 24.19.0
npm ci
if ($LASTEXITCODE -ne 0) { throw '前端依赖失败' }
npm ci --prefix server
if ($LASTEXITCODE -ne 0) { throw '后端依赖失败' }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw '类型检查失败' }
npm test
if ($LASTEXITCODE -ne 0) { throw '前端测试失败' }
npm run typecheck --prefix server
if ($LASTEXITCODE -ne 0) { throw '后端类型检查失败' }
npm test --prefix server
if ($LASTEXITCODE -ne 0) { throw '后端测试失败' }
npm run build
if ($LASTEXITCODE -ne 0) { throw '网页构建失败' }
npm run build --prefix server
if ($LASTEXITCODE -ne 0) { throw 'API构建失败' }
npm run test:wechat
if ($LASTEXITCODE -ne 0) { throw '小游戏构建或测试失败' }
```

微信开发者工具导入`wechat-game/dist`。客户端版本沿用现有V2.4.0，与无尽规则V1.5是两个概念。真实AppID放现有local.config.json，AppSecret只在服务端。配置真实AppID后用户可手动运行`npm run release:wechat`生成提审产物；本次不上传/发布/撤回任何版本。

真机人工清单：安卓/iPhone检查挡板触屏、安全区和20行开局；5秒首次下沉、240tick下限；加宽1.8倍8秒刷新、穿透/火焰并存、闪电12块；后台停时；正常死亡与10秒压线扣命、清行补偿；真实登记成绩后同账号跨端看到同一个无尽榜和历史最高分；API故障仍可单机。

## 腾讯云安全升级顺序（仅说明，待用户确认）

1. 审核合并后使用现有`deploy/package.sh`生成与提交匹配的发布包，核对SHA、SOURCE_COMMIT和清单。发布前核实实际DB_PATH、API用户/运行时/目录以及已上线版本，不能假设已部署V1.4或005。
2. 先运行现有SQLite在线备份服务并验证日志/完整性。标准DB在`/var/lib/qiulegeqiu/leaderboard.sqlite`，备份在`/var/backups/qiulegeqiu`；只允许本游戏资源，不修改其他站点/服务/8080。禁止直接复制写入中的sqlite主文件。
3. 按既有[生产流程](PRODUCTION_ROLLOUT.md)先API-only发布兼容后端（必须包含V1.3、V1.4、V1.5验证器），保留旧网页。确认health的supportedRulesVersions包含三个版本，且`/leaderboard?board=endless`仍声明`rankingScope=all-endless-versions`。现有发布器自动在线备份、候选依赖/启动验收后才切换；失败回退程序，不覆盖数据库。
4. 上述检查通过才发布同一审核包的网页，最后由用户手动上传微信开发版本；禁止先发布新客户端、后补新验证器。使用真实合法成绩检查新旧挑战提交、跨版本最佳分及跨端一致，不注入虚构生产成绩。
5. 观察API错误率、验证隔离原因、UI/触屏和业务日志；没有确认前不执行任何生产命令。本次未连接腾讯云或操作数据库。

## 风险与回滚

20行按原圆形掩码裁剪，不是20条完整矩形砖墙；不同seed的实际砖数不同。新参数会改变得分效率，按最终产品政策仍以原始有效分数统一排名，不换算或另开赛季。尚需用户在微信开发者工具和安卓/iPhone真机进行长局体验及弱网验收；服务端必须先升级，旧API不能解释新20行日志。

保留升级前包/前端索引及API current指针和本次兼容后端基线。新客户端有问题时可回退前端/微信代码，但API继续保留V1.3–V1.5和永久统一查询；有V1.5客户端或待提交日志时不能退回只识别V1.4的验证器。API自身故障应修复/回退到同样支持三版本与统一查询的版本，必要时先降级单机，不退回版本隔离政策。

无新schema回滚，不删除已产生V1.5成绩，不覆盖数据库。既有005增量schema保留。备份只供经独立确认的灾难恢复，不能作为普通发布回退时覆盖新成绩的手段。任何后端回退必须保留现有数据及统一榜。
