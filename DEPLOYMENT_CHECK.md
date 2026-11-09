# 上线检查记录

检查日期：2026-11-10（北京时间）。项目：/workspace/ball-core；现有版本：0.2.0，完整保留 V0.1 要求，无重复创建项目。

## 功能与工程

- package.json 存在；Vite 7.3.8 + TypeScript + Canvas 2D；src/main.ts 存在并使用模块化逻辑。
- 圆形竞技场、4203 个网格方块、Uint8Array 存活标记、真实碰撞与计数；1/120 秒固定步长和子步进。
- 白球、挡板、圆墙、底部逃逸及再次发射；鼠标与触摸控制。
- 简体中文“球了个球”、深色科技风、实时消除数、开始、暂停、继续、重开。
- 未发现 V0.1 核心功能缺失，保留 V0.2 多球/道具/音效。

## 本次补充

- vite.config.ts：明确 base `/`、dist 输出、关闭生产源码映射。
- package.json：补充 npm run preview。
- tests/release-smoke.mjs：针对生产产物的入口、资源、基础交互验收。
- DEPLOYMENT.md：SSH 上传、站点备份、资源优先/入口最后发布及回退说明。
- README.md：补充上线与生产验收入口。

## 实际执行

- npm install：成功，无需新增依赖。
- npm run typecheck：成功。
- npm test：2 个测试文件、24 项测试全部通过。
- npm run build：成功。dist/index.html 420 B；JS 18045 B；CSS 4041 B。
- npm run preview -- --port 4173 --strictPort：成功。
- BASE_URL=http://127.0.0.1:4173 node tests/release-smoke.mjs：通过。JS/CSS HTTP 200、MIME 正确；正常消除、鼠标移动、暂停/继续、出口逃逸/再次发射、重开通过；页面脚本异常 0。
- BASE_URL=http://127.0.0.1:4173 npm run test:browser：通过。生产包掉落拾取、强化暂停冻结、静音、触摸拖动、手机视口无横向溢出通过；页面脚本异常 0。
- 两阶段各 5 秒压力测量：初始百球（存活 95～100）60.10 FPS；测试内补球、持续 100 球 60.11 FPS。帧间隔 P95 均 16.8ms；持续百球物理更新均值约 0.061ms。仅代表本环境 Chromium，不代表手机真机或长时间运行。

## 发布产物

- 目录：/workspace/ball-core/dist
- 压缩包：/workspace/ball-core/work/qiulegeqiu-dist.tar.gz
- 压缩包仅含 index.html、assets/ 和对应 JS/CSS，未包含源码、node_modules、测试或开发服务器。
- 压缩包文件权限 644、目录权限 755，便于 Nginx 读取。
- SHA256：cf67eac6b158c55fb2471163c5d4a0074452e817bb48c439d90fd94c8252691e
- 本地预览：http://127.0.0.1:4173/

## 上线结论与边界

本地生产产物达到 V0.1 可玩性标准，可以交付部署。尚未上传到服务器，不宣称正式域名已更新。

当前环境没有 SSH 密钥目录或可用认证代理，云环境亦未配置服务器凭据。对 https://ball.gmgnclaw.com 的 HTTPS 探测被本环境代理以 CONNECT 403 拒绝；此响应不能视为源站状态。未尝试绕过网络策略。当前服务器文件、Nginx root 和线上内容尚未核验。

没有执行任何服务器命令，没有修改 /var/www/qiulegeqiu 或其他站点，没有修改 Nginx/HTTPS/8080，也未修改或停止《统帅三国》。按照本次任务的无权限分支，停在构建完成阶段。下一步由具备 SSH 权限的终端按照 DEPLOYMENT.md 发布，再进行正式域名验收。
