import test from 'node:test';
import assert from 'node:assert/strict';
import {planNginx} from '../nginx-plan.mjs';
const other=`server { listen 443 ssl; server_name game.gmgnclaw.com; location / { proxy_pass http://127.0.0.1:8080; } }`;
const ball=`server {\n listen 443 ssl;\n server_name ball.gmgnclaw.com;\n root /var/www/qiulegeqiu;\n ssl_certificate /etc/letsencrypt/live/ball/fullchain.pem;\n location / { try_files $uri $uri/ /index.html; }\n}`;
test('只给ball HTTPS块插入include，其他游戏、HTTP重定向及证书指令字节不变',()=>{const redirect='server { listen 80; server_name ball.gmgnclaw.com; return 301 https://$host$request_uri; }';const source=other+'\n'+redirect+'\n'+ball;const result=planNginx(source);assert.equal(result.changed,true);assert(result.config.startsWith(other+'\n'+redirect+'\n'));assert(result.config.includes('ssl_certificate /etc/letsencrypt/live/ball/fullchain.pem;'));assert.equal(result.config.replace('    include /etc/nginx/snippets/qiulegeqiu-api.conf;\n',''),source);});
test('已包含本项目snippet时幂等',()=>{const first=planNginx(ball).config;assert.deepEqual(planNginx(first),{changed:false,config:first});});
test('共享域名server、其他API、重复HTTPS块、找不到站点均拒绝',()=>{assert.throws(()=>planNginx(ball.replace('ball.gmgnclaw.com;','ball.gmgnclaw.com game.gmgnclaw.com;')),/共用/);assert.throws(()=>planNginx(ball.replace('location /','location /api/')),/已有/);assert.throws(()=>planNginx(ball+'\n'+ball),/精确/);assert.throws(()=>planNginx(other),/精确/);});
test('注释中的server/域名和引号中的花括号不会误定位',()=>{const source='# server { listen 443; server_name ball.gmgnclaw.com; }\n'+ball.replace('root /var/www/qiulegeqiu;','root "/var/www/{qiulegeqiu}";');assert(planNginx(source).changed);assert.throws(()=>planNginx('server { listen 443; server_name ball.gmgnclaw.com;'),/未闭合/);});
