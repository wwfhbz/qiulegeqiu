# 球了个球：腾讯云静态部署

目标：https://ball.gmgnclaw.com/；SSH：ubuntu@101.32.209.249；唯一允许发布的目录：/var/www/qiulegeqiu。

本项目目前为 V0.2，涵盖所有 V0.1 上线要求。Vite 的 base 明确设为 `/`。生产仅需要 dist/index.html 和 dist/assets/ 中的 JS、CSS，不需要 Node.js 进程或开发服务器。

## 当前状态

本环境未配置服务器 SSH 密钥/认证代理，尚未执行服务器上传或远程命令。HTTPS 探测被本环境代理拒绝（CONNECT 403），并非已确认生产 Nginx 返回 403。服务器线上目录及域名实际运行情况尚未核验。

下列命令应在有服务器 SSH 权限的终端执行；如使用私钥，按实际路径给 scp/ssh 增加 `-i /你的私钥路径`。首次连接需通过腾讯云控制台核实服务器主机指纹，保持 SSH 主机密钥校验开启。

## 本地：构建、打包、上传

在本项目根目录执行。仅打包 index.html 和 assets，不包含源码、依赖、测试或开发服务器。

```bash
set -e
npm install
npm run typecheck
npm test
npm run build
mkdir -p work
tar -C dist --mode='u=rwX,go=rX' -czf work/qiulegeqiu-dist.tar.gz index.html assets
tar -tzf work/qiulegeqiu-dist.tar.gz
scp work/qiulegeqiu-dist.tar.gz ubuntu@101.32.209.249:~/qiulegeqiu-dist.tar.gz
ssh -t ubuntu@101.32.209.249
```

## 服务器：备份并发布

登录后将下方命令作为一个子 shell 执行，任一步失败就停止。目录必须已由 Nginx 配置为该域名的站点根目录；本流程不修改 Nginx 配置。若目录不存在、真实路径不符或包含符号链接，停止并人工核对。

```bash
(
set -eu
site=/var/www/qiulegeqiu
test -d "$site"
test "$(readlink -f "$site")" = "$site"
test ! -L "$site/assets"
test ! -L "$site/index.html"
# 拒绝站点内符号链接，防止写入其他站点。
test -z "$(sudo find "$site" -type l -print -quit)"

stage=$(mktemp -d "$HOME/qiulegeqiu-stage.XXXXXX")
tar -xzf "$HOME/qiulegeqiu-dist.tar.gz" -C "$stage"
test -s "$stage/index.html"
test -d "$stage/assets"
test -z "$(find "$stage" -type l -print -quit)"

backup="$HOME/qiulegeqiu-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
sudo tar -czf "$backup" -C /var/www qiulegeqiu
printf '旧站点备份：%s\n' "$backup"

# 先添加带哈希的资源；保留旧资源供旧页面继续访问。
sudo install -d -m 755 "$site/assets"
find "$stage/assets" -type d -exec chmod 755 {} +
find "$stage/assets" -type f -exec chmod 644 {} +
sudo cp -r --preserve=mode "$stage/assets/." "$site/assets/"
sudo chmod 755 "$site" "$site/assets"
# 页面最后通过同目录 rename 切换，避免上传一半的 HTML 被访问。
sudo install -m 644 "$stage/index.html" "$site/.index.html.new"
sudo mv -f "$site/.index.html.new" "$site/index.html"
printf '静态文件发布完成。暂存目录：%s\n' "$stage"
)
```

整个流程不删除任何旧资源或其他网站文件，不修改 Nginx、HTTPS、系统服务、8080 端口或《统帅三国》。静态文件更新无需重启或重载 Nginx。如执行过程中出现权限或路径错误，先停止，不要扩大目录权限或更换目标目录。

## 发布后验证

```bash
curl --fail --head https://ball.gmgnclaw.com/
```

浏览器强制刷新 https://ball.gmgnclaw.com/，在网络面板确认 HTML、JS、CSS 均为 200 且无控制台错误，再验收：

1. 标题为“球了个球”，初始方块 4203、弹球 1。
2. 点击开始后白球持续运动，撞击方块后计数增加。
3. 鼠标/触摸可平滑移动挡板。
4. 暂停后球和道具冻结，继续后恢复。
5. 重开恢复 4203 方块、零消除和一个球。
6. 手机竖屏无横向溢出；其他网站保持原状。

如果页面仍为旧版本，检查浏览器/CDN 缓存及该域名现有 Nginx root 指向。本说明不自动调整服务器配置。

## 回退

备份包含整个 qiulegeqiu 目录。若需要回退，先解压上述明确的备份到新的 `$HOME` 暂存目录，核验只包含 qiulegeqiu/index.html 和对应 assets；将旧 assets 复制回 `/var/www/qiulegeqiu/assets/`，最后用同目录临时文件加 mv 恢复旧 index.html。不对 /var/www 执行整体覆盖或清理，不修改其他站点。
