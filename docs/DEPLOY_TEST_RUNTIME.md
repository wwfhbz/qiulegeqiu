# PR #13 部署测试运行时隔离修复

## 两项失败的真正原因

1. `verify()`直接使用测试进程的`process.execPath`。服务器通过系统Node v22.23.4运行测试时，子进程同样是22，生产门禁在加载fastify之前正确拒绝，因而得不到预期缺包错误。属于测试运行时选择错误，不能删除生产v24.19.0检查。
2. 完整publish夹具把同一个`process.execPath`软链接到临时`node/bin/node`，将系统22伪装成独立运行时。publish早期版本条件失败并静默退出，根本未执行模拟安装与Fastify验收，因此stderr为空。属于夹具错误，加上生产脚本原版本条件缺少错误说明；不能把stderr断言删掉。

PR #13已合并，本次从最新main创建独立修复PR。没有登录服务器或部署，也没有重新改动物理、计分、数据库迁移及死亡规则。

## 修复与安全约束

- `npm run test:deploy`先运行兼容Node22的`deploy/run-tests.mjs`。显式读取`QIULEGEQIU_TEST_NODE`，校验真实版本必须精确v24.19.0；未配置时只允许当前进程恰好为该版本。不搜索或默认使用任何服务器生产路径，不下载、不安装运行时。
- 配套npm通过`QIULEGEQIU_TEST_NPM_CLI`指定；官方tar布局可推导，不同发行版布局显式提供。错误版本、缺少npm立即报配置错误，不执行测试、不跳过断言。
- 在所选24下重新构建server/build，再由绝对路径启动全部部署测试。
- 夹具把真实Node二进制和完整npm复制到临时目录，不将系统22软链接成生产Node；所有安装、运行时验证、真实API启动均使用这份已校验的临时24。npm配置和HOME隔离，避免宿主的全局/prefix设置干扰。
- 缺fastify时仍必须看到fastify错误；完整publish还必须证明到达模拟安装阶段、退出码为1、无超时/信号、stderr含候选验收失败。PATH中放置会退出97的“系统Node22”陷阱，意外调用会导致测试失败。
- root测试时仅在权限拒绝用例的子进程中通过setpriv移除DAC绕过能力，保留真实EACCES检测，不跳过权限断言；普通用户无需此分支。Ubuntu的setpriv来自util-linux。
- publish错误Node版本现在输出明确诊断再退出，仍不允许绕过精确版本门禁。
- 现有首次安装回退规则保持，测试检查原API指针、原HTML、其他游戏配置、数据库字节和inode不变；在线备份保留，未运行任何数据库恢复或删除。

## 服务器完整验证命令

使用ubuntu普通用户，在已经获取并审核本修复源码的工作目录执行。只做安装开发依赖、构建及临时目录测试，不运行生产installer、不调用真实systemctl、不改网站或数据库。已配置的独立运行时仅作为只读测试来源；路径不同可以改下面两个变量，测试本身不要求这些固定路径。

```bash
cd /home/ubuntu/qiulegeqiu
set -Eeuo pipefail
SYSTEM_NODE=$(command -v node)
"$SYSTEM_NODE" --version

export QIULEGEQIU_TEST_NODE=/opt/qiulegeqiu-api/node/bin/node
export QIULEGEQIU_TEST_NPM_CLI=/opt/qiulegeqiu-api/node/lib/node_modules/npm/bin/npm-cli.js
unset NODE_OPTIONS NODE_PATH
test -x "$QIULEGEQIU_TEST_NODE"
test -f "$QIULEGEQIU_TEST_NPM_CLI"
test "$("$QIULEGEQIU_TEST_NODE" --version)" = v24.19.0

# 即便此处SYSTEM_NODE为22，入口也必须输出实际选择的24.19.0。
"$SYSTEM_NODE" deploy/run-tests.mjs --check

# 只调整当前shell的PATH，不替换/usr/bin/node、不改变系统默认Node。
export PATH="$(dirname "$QIULEGEQIU_TEST_NODE"):$PATH"
"$QIULEGEQIU_TEST_NODE" "$QIULEGEQIU_TEST_NPM_CLI" ci
"$QIULEGEQIU_TEST_NODE" "$QIULEGEQIU_TEST_NPM_CLI" ci --prefix server
"$QIULEGEQIU_TEST_NODE" "$QIULEGEQIU_TEST_NPM_CLI" run typecheck
"$QIULEGEQIU_TEST_NODE" "$QIULEGEQIU_TEST_NPM_CLI" test
"$QIULEGEQIU_TEST_NODE" "$QIULEGEQIU_TEST_NPM_CLI" run build
"$QIULEGEQIU_TEST_NODE" "$QIULEGEQIU_TEST_NPM_CLI" run typecheck --prefix server
"$QIULEGEQIU_TEST_NODE" "$QIULEGEQIU_TEST_NPM_CLI" test --prefix server
"$QIULEGEQIU_TEST_NODE" "$QIULEGEQIU_TEST_NPM_CLI" run build --prefix server
"$QIULEGEQIU_TEST_NODE" "$QIULEGEQIU_TEST_NPM_CLI" run regions
"$QIULEGEQIU_TEST_NODE" "$QIULEGEQIU_TEST_NPM_CLI" run test:deploy
```

若想专门验证系统22启动部署测试入口，可在设置上述两个环境变量之后、调整PATH之前执行：

```bash
"$SYSTEM_NODE" deploy/run-tests.mjs
```

不要直接用系统22执行`node --test deploy/tests/*.test.mjs`绕过入口。机器未准备Node24或完整npm时，应先在独立位置准备经官方SHA校验的运行时，再填写变量；不能依赖测试静默放宽生产版本要求。

## 开发验证记录

- 前端154项、后端35项、部署22项测试通过；类型检查、前后端构建、地区完整性检查通过。
- 隔离复制main旧版测试和脚本后，用真实Node v22.23.4复现原文件7项中恰好2项失败，错误分别为版本门禁及空stderr。
- 从官方SHA256校验的真实Node v22.23.4启动npm/test入口，显式选择24，部署22项全部通过；未指定24时明确退出1，无跳过。
- 在Linux用户命名空间中的root身份再次运行部署22项，权限拒绝检测仍通过。该测试只在隔离命名空间和临时目录运行，不获得生产服务器权限。
- 完整systemd/Nginx生命周期仍为模拟命令与夹具测试，不宣称真实生产安装成功。
