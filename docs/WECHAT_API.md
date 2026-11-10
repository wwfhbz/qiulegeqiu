# 微信身份与跨端排行榜

## 兼容方式

小游戏与网页复用原有`/api/players`、地区、挑战批次、成绩提交、TOP100、me/best和申诉接口。计分和事件验证版本、关卡和掉落配置没有更改。网页仍使用原Cookie名、Secure/HttpOnly/SameSite及Origin/CSRF约束，不启用宽松CORS。

小游戏登录后的请求使用`Authorization: Bearer <token>`，POST同时传`x-csrf-token`。Bearer必须属于wechat_sessions对应的会话，网页Cookie不能直接当微信凭据，微信令牌也不会作为网页Cookie识别。原生请求可无Origin；有Origin则必须与PUBLIC_ORIGIN一致。登录入口只接收临时代码，不能传openid、playerId或客户端声称的排名。

## 新接口

### POST /api/wechat/login

请求`{"code":"wx.login返回的临时code"}`。服务器使用配置中的AppID/Secret向官方`https://api.weixin.qq.com/sns/jscode2session`换码，5秒超时、禁止重定向，不返回session_key/openid，不记录请求凭据。未配置微信身份返回503。code摘要在数据库唯一保存10分钟阻止并发/重复使用；失败应重新wx.login。

成功返回`{token,csrfToken,expiresAt}`；随机32字节token仅服务器存SHA256摘要，有效30天。登录先按AppID隔离的openid摘要定位稳定内部身份，再签发新会话。已有身份绑定的玩家、最高成绩保持；新身份可在挑战结束时通过原注册流程建立玩家。生产限流及昵称审核仍执行。

### POST /api/account/link-ticket

必须持有已登记网页玩家的Cookie及CSRF/Origin，Bearer不能调用。生成随机32字节一次性绑定凭据，五分钟有效，返回`{ticket,expiresAt}`；数据库只存摘要。网页排行榜新增“生成微信账号绑定码”。仅在自己账号使用，不能公开分享。

### POST /api/wechat/bind

必须持有微信Bearer及CSRF，Body为`{ticket}`。只允许尚未登记玩家的微信身份绑定有效网页凭据对应的原玩家。原网页会话必须仍有效，账号必须active；同一AppID的玩家只能绑定一个微信身份。绑定与消费凭据在同一事务中完成，重复、过期、冒名和自动合并已有账号均拒绝。原玩家ID、历史成绩和所有已有会话不被删除或覆盖。

### 原成绩流程

`/challenges`创建服务端挑战 → 原日志批次顺序/幂等上传 → 结束登记昵称与地区 → `/submit`按原verifyTrace重算、异常隔离和个人最高分更新。微信不绕过原校验；服务端物理回放仍未实现，客户端日志校验不能彻底防作弊。分享文案只展示查询到的已验证个人最佳，不以分享参数认证玩家或成绩。

## 追加迁移003

| 表 | 用途与约束 |
| --- | --- |
| wechat_identities | 内部身份UUID、AppID、openid摘要、可空player_id；唯一(AppID,openid摘要)，唯一(AppID,player_id) |
| wechat_sessions | 原sessions ID到微信身份映射；原sessions结构不变，仍只存会话令牌摘要 |
| wechat_login_codes | 临时代码摘要与过期时间，唯一约束防重放 |
| account_link_tickets | 网页玩家/会话、凭据摘要、过期与消费时间；不按昵称匹配身份 |

现有players/scores/player_bests/challenges及所有历史数据不重建。启动按schema_migrations幂等追加，原SQLite WAL/busy_timeout和在线备份机制不变。

### 回滚

优先只回退API代码并保留追加表；旧API可继续读网页历史，不恢复覆盖数据库。任何生产变更需单独确认和在线备份，本PR未执行。

提供`003-wechat.down.sql`仅供**全部微信扩展表为空**时回退结构，不删除玩家/成绩/会话。必须由管理命令执行，不能直接`sqlite3 .read`（其错误继续策略可能与Node不同）：

```bash
# 仅人工审核和确认后，在独立测试库验证；不要对生产擅自执行。
# 从server运行，DB_PATH应显式指向已备份并核实的目标库。
node build/manage.js rollback-wechat-empty --confirm-empty
```

管理命令遇到非空表会停止并回滚事务。存在微信身份或凭据时禁止结构回退，应保留数据仅回退应用版本；重新运行新API会再次执行缺失的003迁移。

## 配置、安全与隐私

AppID公开，AppSecret只在服务端。前端构建local.config仅接受appid/apiBase，发现额外字段停止。微信凭据保存在平台私有存储，不可能拥有浏览器HttpOnly属性；设备数据丢失后，真实wx.login可通过同一微信身份恢复原玩家，不能仅凭昵称恢复。未绑定微信的旧匿名网页身份仍依赖原浏览器会话。

当前没有OAuth统一账号、跨AppID UnionID合并、自动账号删除或双账号成绩合并。用户可通过现有申诉提交更正、注销/删除请求，正式运营前需落实处理流程和联系方式。令牌/绑定码属于敏感凭据，不能截图公开或放进分享链接。
