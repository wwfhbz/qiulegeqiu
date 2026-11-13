# 无尽模式 V1.4：规则、兼容与验收

本次基线为 main `c9cc5b3`（包含弹球水平防卡死修复）。这里只升级无尽规则，不改变微信上传版本号 V2.3、闯关计分版本、12关配置、碰撞/死亡线或现有玩家身份。

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

## 无数据库迁移的榜单隔离

复用既有`challenges.rules_version`和`season_player_bests`；没有新增迁移或改写任何旧记录。

- 旧客户端不传rulesVersion的`/leaderboard?board=endless`仍返回原V1.0–V1.3合并历史榜，元数据为V1.3，语义不变。
- 新客户端显式请求`/leaderboard?board=endless&rulesVersion=endless-1.4.0-3l-sink-v5`，只包含V1.4有效记录。
- `/me/best`和`/me`支持相同参数；TOP100分页不超过20条/页，个人排名不受100名上限限制。
- 旧版精确单规则榜仍可通过`/leaderboard?rulesVersion=endless-1.3.0-3l-sink-v4`查询。
- 两榜各取每名玩家最高有效分；分数→阶段→用时→达成时间→成绩ID排序保持不变，闯关全球榜不变。
- Web、微信全球榜/个人榜均核对响应版本。微信好友云存储键包含新规则版本，不把旧版云成绩挪作新版成绩。
- 身份、昵称、会话及绑定关系不变；同账号可分别保留两版最佳分，低分不覆盖高分，提交仍幂等。

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

实测：前端420项、后端102项、部署48项、微信构建8项、兼容小游戏构建8项通过。桌面1280×900、手机390×844的Chromium交互检查通过，API离线仍可玩、无横向溢出、加宽暂停不减时；截图和报告生成于`work/endless-v14/browser/`。原微信兼容流程在375×812、320×568和768×1024通过（原生触摸/生命周期的**模拟接口**）。这不代表官方开发者工具、安卓或iPhone真机通过。

`tests/fixtures/endless-v13-golden.jsonl`来自修改前main同源代码（物理修复前后无尽规则相同）的3组种子，每组200次抽取和10000tick砖墙黄金摘要。旧版道具序列和砖墙状态字节摘要一致。新增测试另验证权重边界、7个掉落间隔边界、技能范围/时长、跨回合累计掉落、两版日志互冒拒绝、伪分与假拾取、重复提交、旧记录保持、TOP100及个人105名。

## Windows PowerShell 更新与构建

在本项目目录执行。合并前测试开发分支，不把未审核分支推为生产。失败时停止后续命令。

```powershell
git status --short # 有本地改动先妥善处理，禁止覆盖
git fetch origin
git switch --track origin/feature/endless-v14 # 已有该分支则 git switch feature/endless-v14
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
3. **先API-only发布兼容后端**，旧网页继续运行；新后端必须在health同时声明支持V1.3、V1.4。使用已审核解压目录作为下方`RELEASE_DIR`，不是源码目录：

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
# 上一步必须成功，再使用同一审核发布包发布网页：
sudo bash "$RELEASE_DIR/deploy/publish.sh" --apply "$RELEASE_DIR"
```

4. 检查两个榜单的元数据、TOP100/真实个人排名；用真实合法新旧游戏日志登记成绩，不在生产注入测试玩家或伪成绩。
5. 最后才由用户手动上传新版微信开发包，检查登录、成绩提交和云存储版本隔离。

本次未连接生产服务器，也未执行这些命令；生产的旧API在兼容后端发布前会拒绝V1.4，新客户端会明确提示但允许单机游玩。

## 回滚与数据保护

无schema变化，无数据库向下迁移。客户端有问题时回退前端/微信代码，**保留同时支持新旧规则的兼容API**；新版客户端仍在线时不能退回只懂V1.3的API。API代码需要回退时，以步骤3成功后的双验证版本为基线，使用既有publish的原子指针/网页回退机制，保留新增assets以兼容已有页面。

正常回滚绝不恢复覆盖数据库：V1.4期间产生的数据仍可由兼容API读取，旧榜完全不受影响。备份仅作为灾难恢复保障，需独立确认停服和恢复窗口；不能把回退程序等同于覆盖旧DB快照。禁止使用数据库重置部署模式。仅操作qiulegeqiu专属服务，不能改动game.gmgnclaw.com、8080、《统帅三国》或其他站点配置。

## 微信开发版本人工验收

- 使用真实AppID导入上述dist；基础库按现有项目要求，不撤回已有审核版本。
- 安卓/iPhone均检查胶囊/安全区、触摸挡板和模式切换；闯关仍5命12关，无尽仍3命。
- 确认初始4.5秒下沉；后台/暂停停止下沉及技能计时。
- 接到加宽时2倍8秒，刷新不叠加；穿透4秒/火焰6秒可并存，火焰菱形13格、闪电15块。
- 最后球漏接或压线10秒的扣命/清5行补偿正确，+3上限100、生命上限3。
- 同账号分别提交旧、新规则有效成绩，全球榜与个人榜不会混排；好友榜旧键保留但新版不复用。
- 离线或旧后端拒绝时单机不崩溃；已建立联网挑战的瞬时失败可按现有机制安全重试，后端能力不匹配须升级后重新挑战。
