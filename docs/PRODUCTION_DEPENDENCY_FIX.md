# 首次生产依赖解析失败修复

## 根因与证据

后端package.json和锁文件均正确声明fastify、@fastify/cookie、zod，bundle将这些依赖保留为外部包。当前SQLite实现是Node内置node:sqlite，没有better-sqlite3，不应人为添加该包或全局补装fastify。

旧publish.sh最初把源码/产物权限规范到755/644，随后在外层umask 077、root身份下执行npm ci。**新生成的node_modules并未再次规范权限**，所以npm成功与systemd服务用户能读取并不等价。本地真实npm ci复现：added 51 packages、node_modules与fastify目录700、fastify.js为600；取消目录遍历权限后加载fastify失败。这是代码中可复现的根因；没有通过SSH读取生产服务器权限，不声称完成现场取证。

## 修复

- 安装helper显式固定release/server前缀，使用同一独立Node调用npm-cli.js和锁文件，npm ci --omit=dev，禁止global/workspaces和祖先配置重定向。忽略用户/全局npm配置，保留必要的代理及CA设置，不输出凭据。
- 仅安装子进程umask改为022，再将本新版本依赖目录设755、文件可读，其他用户不可写；外层环境、数据库、备份权限仍077/700/600，不改既有release。
- publish切换前runuser到qiulegeqiu，从真实server工作目录验证依赖解析必须属于本版本、版本与锁一致、原生SQLite查询可执行。未来若显式声明better-sqlite3，也会加载原生绑定并执行查询，ABI错误立即阻断。
- 同一UID、独立Node与目录启动真实build/index.js，用内存SQLite和临时loopback端口检查health并正常退出，不接触生产库、正式8091或其他游戏8080。
- 首次安装以事务清单记录变更，仅恢复本次尝试写入的配置和启用状态。原本不存在且未创建的服务不stop/disable。数据库永不删除、覆盖、恢复。
- package与校验器强制携带新的安装/验收/回退helper，旧包不能混用新脚本。

## 开发验证

- 前端：类型检查、154项测试、生产构建通过。
- 后端：类型检查、35项测试、生产构建通过。
- 部署：21项测试通过，含真实npm安装及API启动、缺包/祖先fallback/ABI错误阻断、首次服务未创建和已创建时的回退、逐项配置回退、完整publish缺包失败注入、旧数据库字节和inode不变及在线备份。
- 地区数据完整性检查通过；发布包校验在提交后执行。

开发环境以非root账号做API集成测试；生产入口另由runuser保证qiulegeqiu身份。systemctl/Nginx生命周期使用临时目录及模拟命令测试，未操作真实生产或其他游戏；模拟ABI错误不等于构建或验证真实better-sqlite3（当前未使用）。

## 首次安装命令

完整安全前提及回滚见[FIRST_PRODUCTION_INSTALL.md](FIRST_PRODUCTION_INSTALL.md)。从审核过的修复提交重新打包后，把同一提交源码和包上传指定目录。以下命令供用户在服务器审核后执行，本次开发不执行：

```bash
cd /home/ubuntu/qiulegeqiu
# 确保checkout为已经审核的修复提交；不在此自动切换/覆盖服务器现有工作。
read -r -p '审核的完整修复提交SHA：' REVIEWED_COMMIT
read -r -p '独立核实的发布包SHA256：' REVIEWED_SHA256
read -r -p 'ball的HTTPS站点真实文件路径：' BALL_SITE
sudo bash deploy/first-production-install.sh --dry-run \
  --package /home/ubuntu/qiulegeqiu/work/qiulegeqiu-release.tar.gz \
  --commit "$REVIEWED_COMMIT" --sha256 "$REVIEWED_SHA256" --site-file "$BALL_SITE"
# dry-run通过并确认允许部署后执行：
sudo bash deploy/first-production-install.sh --apply \
  --package /home/ubuntu/qiulegeqiu/work/qiulegeqiu-release.tar.gz \
  --commit "$REVIEWED_COMMIT" --sha256 "$REVIEWED_SHA256" --site-file "$BALL_SITE"
```

若旧失败安装遗留未知unit、不同/api配置或不明数据库路径，dry-run会停止，必须人工核对，不绕过检查或删除数据库。
