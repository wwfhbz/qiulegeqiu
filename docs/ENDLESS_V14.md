# 无尽模式 V1.4：规则、永久统一榜与验收

紧急修正基线为 main `d82594d`（已合并V1.4数值及弹球防卡死修复）。这里只升级无尽规则，不改变微信上传版本号 V2.3、闯关计分版本、12关配置、碰撞/死亡线或现有玩家身份。

## 新旧规则

| 项目 | 冻结无尽 V1.3 | 无尽 V1.4 |
|---|---|---|
| rulesVersion | `endless-1.3.0-3l-sink-v4` | `endless-1.4.0-3l-sink-v5` |
| 掉落间隔 | min(60,16+floor(D/125)) | min(40,10+floor(D/200)) |
| +3 / 加宽 / ÷2 / 穿透 / 火焰 / 闪电 / 生命权重 | 270/200/130/130/120/147/3 | 300/130/130/130/140/167/3 |
| 加宽 | 1.8倍、5秒 | 2倍、8秒 |
| 火焰 | 中心+周围8格 | 中心+固定12格菱形 |
| 闪电 | 最多12块 | 最多15块 |
| 下沉间隔(tick) | max(300,round(720×0.985^n)) | max(180,round(540×0.98^n)) |

不变：3条生命上限、+3最多100球、÷2向上取整至少1球、穿透4秒、火焰6秒、生命权重3/1000、砖墙填充率/网格/危险线、压迫1200tick扣命、清底部5行补偿、补偿种类及独立随机流、每接取道具+100分及其他计分。闯关加宽继续1.8倍5秒。

掉落阈值沿用累计消除数：每实际触发一次，按当时D计算下一位置，例如10、20…200、211；不是每个砖随机判定。保留原道具池容量与满池处理，种子算法和每次抽取消耗一个随机数不变。同一砖仅销毁一次。掉落物须接住才生效。

火焰偏移按需求列出的固定顺序执行，旧版保留原3×3行序；额外烧毁不递归触发烧毁。闪电保持最低行优先，再按首颗有效球的水平距离、网格索引稳定排序。

## 共享实现与验证边界

`EndlessRules.ts`统一注册V1.0–V1.4；旧变体无settings时明确使用冻结配置。`EndlessField`、`Physics`、Web/微信共用同一配置与固定tick。Game报告实际变体对应的版本；未知变体/版本不回退为当前规则。

后端按**创建挑战时数据库中固定的rules_version**分发验证器，不接受提交时重写版本。重建同种子砖墙/掉落流、验证拾取窗口/掉落ID/球数/生命/奖励/分数，火焰和闪电的每tick异常预算按版本选择；未知版本、重复砖块、假拾取及篡改分数仍拒绝，异常事件仍隔离。现有验证器是事件/规则/积分回放，日志没有完整挡板输入，因此不是服务端权威物理回放，也不宣称能彻底防作弊。

## 永久统一无尽榜（最终政策，替代此前的版本隔离方案）

**规则可以升级，排行榜永远统一，历史成绩永远保留。** V1.0、V1.3、V1.4和未来所有无尽版本共同排名；不做分数换算，不因版本升级新建榜单。计分验证仍严格按该局创建时的规则版本执行。

- 所有客户端使用`/leaderboard?board=endless`和`/me/best?board=endless`。排行榜只按挑战`mode='endless'`选择有效记录，不按rulesVersion筛选，也没有无尽版本白名单。
- 兼容旧请求中附带的rulesVersion（仅限服务器已支持的值）；不带参数、带V1.3、带V1.4或旧的单规则无尽查询均读取相同池。响应旧元数据保留用于兼容，**不代表筛选赛季**。
- 新客户端核对稳定能力`rankingScope: all-endless-versions`，防止把旧隔离API误当统一榜。每条成绩仍返回真实`rules_version`作为审计信息。
- 每个玩家从全部有效记录选最高一条，排序继续为分数→阶段→用时→达成时间→成绩ID；TOP100分页、榜外个人真实排名不变，闯关全球榜不变。
- 旧`season_player_bests`及所有历史分数原样保留供兼容/审计；统一榜直接从有效scores计算，错误或较低的旧指针不会掩盖更高历史分。
- 提交成绩的响应也返回跨版本个人最佳。服务器仍严格拒绝未知规则，禁止把新日志作为旧规则解释或关闭反作弊。

### 增量迁移005

只在挑战表追加`mode`字段和索引，将历史`endless-*`挑战标记为无尽；原rules_version、分数、身份、会话、昵称、绑定及最佳指针不变。迁移在单一事务中执行、登记版本号并可重复打开；不清空或重建数据库。兼容触发器自动标记旧API遗漏mode的无尽挑战。未来新增无尽规则由API写入mode，榜单SQL不需要修改。

### 微信好友榜

永久复用已部署V1.3存储键`qqcj_endless_endless-1.3.0-3l-sink-v4`。新客户端同时读取既有分散键，选取同一好友跨键最高分，只显示一条；更低新分不覆盖更高旧分，不删除任何旧键。合并时保留原marker以维持本人识别。固定键中的rulesVersion作为旧客户端兼容封装标记，真实成绩来源写入sourceRulesVersion；挑战提交/服务端验证使用的规则字段完全不变。

新成绩同步仍只读取已认证API返回的跨版本最佳分，不从本局本地分数写云。好友数据留在开放数据域，不上传关系链。旧V1.4客户端的分散键会保留，需更新客户端才能读取合并的好友榜；未来版本继续写固定键，不再轮换。微信云存储仍具有客户端可写的安全边界，不能替代腾讯云正式验证榜。

## 本地完整验证（Node 24.19.0）

```sh
npm ci
npm ci --prefix server
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

实测：前端424项、后端103项、部署48项、微信构建8项、兼容小游戏构建8项通过。桌面1280×900、手机390×844的Chromium交互检查通过，API离线仍可玩、无横向溢出、加宽暂停不减时；截图和报告生成于`work/endless-v14/browser/`。原微信兼容流程在375×812、320×568和768×1024通过（原生触摸/生命周期的**模拟接口**）。这不代表官方开发者工具、安卓或iPhone真机通过。

`tests/fixtures/endless-v13-golden.jsonl`来自修改前main同源代码（物理修复前后无尽规则相同）的3组种子，每组200次抽取和10000tick砖墙黄金摘要。旧版道具序列和砖墙状态字节摘要一致。新增测试另验证权重边界、7个掉落间隔边界、技能范围/时长、跨回合累计掉落、两版日志互冒拒绝、伪分与假拾取、重复提交、旧记录保持、TOP100及个人105名。

## Windows PowerShell 更新与构建

在本项目目录执行。合并前测试开发分支，不把未审核分支推为生产。失败时停止后续命令。

```powershell
git status --short # 有本地改动先妥善处理，禁止覆盖
git fetch origin
git switch --track origin/fix/permanent-endless-leaderboard # 已有该分支则 git switch fix/permanent-endless-leaderboard
git pull --ff-only
node --version # v24.19.0
npm ci
if ($LASTEXITCODE -ne 0) { throw '前端依赖安装失败' }
npm ci --prefix server
if ($LASTEXITCODE -ne 0) { throw '后端依赖安装失败' }
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
if ($LASTEXITCODE -ne 0) { throw '微信构建或测试失败' }
npm run test:minigame
if ($LASTEXITCODE -ne 0) { throw '兼容小游戏构建或测试失败' }
```

开发者工具导入`wechat-game/dist`，不要导入仓库根目录。`wechat-game/local.config.json`只保存已有真实AppID和apiBase，不保存AppSecret。没有AppID仍可运行本地构建/模拟测试，但不能伪称生产微信登录成功。需要正式上传产物时由用户配置真实AppID后手动执行`npm run release:wechat`；**本次没有上传或提交审核**。

## 兼容发布顺序（仅文档，等待批准）

1. 保留当前源提交、前端index与assets、API current指针，核实实际DB_PATH是本项目数据库；有差异停止。按[现有生产流程](PRODUCTION_ROLLOUT.md)审核/校验发布包SHA与SOURCE_COMMIT。
2. 使用项目现有SQLite在线备份服务（`sudo systemctl start qiulegeqiu-backup.service`），查日志确认成功。备份位于`/var/backups/qiulegeqiu`，脚本用SQLite backup接口并执行integrity_check和foreign_key_check；不可裸复制运行中的sqlite主文件。
3. **先API-only发布兼容后端**，旧网页继续运行；先完成在线备份，再由现有发布流程启动API时事务性迁移005。新后端必须在health同时声明支持V1.3、V1.4，且无尽查询声明all-endless-versions。使用已审核解压目录作为下方`RELEASE_DIR`，不是源码目录：

```sh
# 仅审批通过后由用户执行；不可使用任何reset选项。
RELEASE_DIR=/home/ubuntu/qiulegeqiu/work/approved-release
sudo bash "$RELEASE_DIR/deploy/publish.sh" --apply "$RELEASE_DIR" --api-only
curl -fsS https://ball.gmgnclaw.com/api/health |
  /opt/qiulegeqiu-api/node/bin/node --input-type=module -e '
let s="";for await(const c of process.stdin)s+=c;const h=JSON.parse(s);
for(const v of ["endless-1.3.0-3l-sink-v4","endless-1.4.0-3l-sink-v5"])
 if(h.ok!==true||!h.supportedRulesVersions?.includes(v))throw Error("兼容API未就绪，停止发布客户端");
console.log("新旧无尽验证器均已就绪");'
# 再确认服务器实际提供永久统一查询；缺少scope则停止，不发布客户端：
curl -fsS 'https://ball.gmgnclaw.com/api/leaderboard?board=endless&limit=1' |
  /opt/qiulegeqiu-api/node/bin/node --input-type=module -e '
let s="";for await(const c of process.stdin)s+=c;const r=JSON.parse(s);
if(r.board!=="endless"||r.rankingScope!=="all-endless-versions")throw Error("尚非永久统一无尽榜，停止发布");
console.log("永久统一无尽榜已就绪");'
# 上述检查全部成功，再使用同一审核发布包发布网页：
sudo bash "$RELEASE_DIR/deploy/publish.sh" --apply "$RELEASE_DIR"
```

4. 检查统一无尽榜的rankingScope、TOP100/真实个人排名；用真实合法新旧游戏日志登记成绩，不在生产注入测试玩家或伪成绩。
5. 最后才由用户手动上传新版微信开发包，检查登录、成绩提交和好友最高分合并。

本次未连接生产服务器，也未执行这些命令，实际部署状态需发布前核实。尚不支持V1.4的后端会拒绝新规则；即使已经支持V1.4，旧隔离API也必须更新永久统一查询能力，不能只检查版本号。新客户端不把缺少统一scope的响应误作统一榜，单机仍可运行。

## 回滚与数据保护

不得回滚到PR52的版本隔离查询政策。网页需要回退时保持统一查询API在线；API故障应修复/前滚统一查询实现，必要时暂降级单机，不通过恢复旧隔离后端拆榜。

存在增量迁移005，正常程序回滚保留该字段/索引/触发器，不执行破坏性向下迁移。客户端有问题时回退前端/微信代码，**保留同时支持新旧规则的兼容API**；新版客户端仍在线时不能退回只懂V1.3的API。API代码需要回退时，以步骤3成功后的双验证版本为基线，使用既有publish的原子指针/网页回退机制，保留新增assets以兼容已有页面。

正常回滚绝不恢复覆盖数据库：V1.4期间产生的数据仍可由兼容API读取，历史成绩继续在同一榜单中排名。备份仅作为灾难恢复保障，需独立确认停服和恢复窗口；不能把回退程序等同于覆盖旧DB快照。禁止使用数据库重置部署模式。仅操作qiulegeqiu专属服务，不能改动game.gmgnclaw.com、8080、《统帅三国》或其他站点配置。

## 微信开发版本人工验收

- 使用真实AppID导入上述dist；基础库按现有项目要求，不撤回已有审核版本。
- 安卓/iPhone均检查胶囊/安全区、触摸挡板和模式切换；闯关仍5命12关，无尽仍3命。
- 确认初始4.5秒下沉；后台/暂停停止下沉及技能计时。
- 接到加宽时2倍8秒，刷新不叠加；穿透4秒/火焰6秒可并存，火焰菱形13格、闪电15块。
- 最后球漏接或压线10秒的扣命/清5行补偿正确，+3上限100、生命上限3。
- 同账号分别提交旧、新规则有效成绩，全球榜与个人榜不会混排；好友榜旧键保留但新版不复用。
- 离线或旧后端拒绝时单机不崩溃；已建立联网挑战的瞬时失败可按现有机制安全重试，后端能力不匹配须升级后重新挑战。
