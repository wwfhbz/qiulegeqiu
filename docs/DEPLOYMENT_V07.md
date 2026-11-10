# 腾讯云排行榜部署入口

以[生产上线审批单与执行手册](PRODUCTION_ROLLOUT.md)为准。最新main已包含V0.8；本次仅上线现有排行榜，不回退游戏。

执行环境尚无SSH凭据，两个域名访问受环境代理限制，因此未核验远程Ubuntu/证书/旧数据/服务，未部署。先在已有授权终端运行：

```sh
ssh ubuntu@101.32.209.249 'bash -s' < deploy/preflight.sh
```

不要把SSH私钥、密码、Cookie或访问令牌贴进聊天。获取只读报告、确认实际ball配置文件及旧数据保留后，审阅并确认完整方案，再运行任何生产写命令。

固定隔离路径：静态/var/www/qiulegeqiu，API/opt/qiulegeqiu-api，数据库/var/lib/qiulegeqiu/leaderboard.sqlite，备份/var/backups/qiulegeqiu。独立Node24，不更换系统Node，systemd专用非root用户，仅127.0.0.1:8091。

[API服务](../deploy/qiulegeqiu-api.service) · [每日备份服务](../deploy/qiulegeqiu-backup.service) · [每日定时器](../deploy/qiulegeqiu-backup.timer) · [Nginx snippet](../deploy/nginx-api.conf.example)

部署前自动SQLite在线备份，保留最近7天；发布失败只回退代码/HTML，不自动覆盖数据。数据库恢复另需--confirm-overwrite和单独确认。旧标准库不存在但发现旧数据/旧API时停止，不创建空榜。game域名、8080及统帅三国文件/服务不修改；Nginx只在ball HTTPS块加include，验证后graceful reload。
