import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
const env=parseEnv(readFileSync('/etc/qiulegeqiu-api.env','utf8'));
if(env.NODE_ENV!=='production'||env.PUBLIC_ORIGIN!=='https://ball.gmgnclaw.com'||env.PORT!=='8091'||env.DB_PATH!=='/var/lib/qiulegeqiu/leaderboard.sqlite')throw Error('既有生产环境与本次方案不同，停止发布；先审核旧API、Cookie及数据库迁移，不覆盖原配置');
if(env.APP_ROOT&&env.APP_ROOT!=='/opt/qiulegeqiu-api/current/server')throw Error('APP_ROOT不是本项目当前release，先审核环境，不执行迁移');
console.log(JSON.stringify({origin:env.PUBLIC_ORIGIN,db:env.DB_PATH,port:env.PORT,nodeEnv:env.NODE_ENV}));
