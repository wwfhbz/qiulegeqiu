import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
test('发布、Nginx修改、runtime安装、回滚均要求显式apply，无参数不修改路径',()=>{for(const file of ['publish.sh','activate-nginx.sh','install-runtime.sh','rollback.sh','restore.sh']){const r=spawnSync('bash',['deploy/'+file],{encoding:'utf8'});assert.notEqual(r.status,0,file);assert.match(r.stdout+r.stderr,/用法/,file);}});
test('恢复数据库还要求单独确认覆盖，单有apply不允许',()=>{const r=spawnSync('bash',['deploy/restore.sh','--apply','/var/backups/qiulegeqiu/backup.sqlite'],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stdout,/confirm-overwrite/);});
test('所有部署脚本通过bash语法检查，定时器/权限配置完整',()=>{for(const file of ['package.sh','publish.sh','activate-nginx.sh','preflight.sh','install-runtime.sh','rollback.sh','restore.sh','first-production-install.sh','install-production-deps.sh','first-install-rollback-lib.sh','update.sh'])assert.equal(spawnSync('bash',['-n','deploy/'+file]).status,0,file);const timer=readFileSync('deploy/qiulegeqiu-backup.timer','utf8');assert.match(timer,/03:15:00 Asia\/Shanghai/);assert.match(timer,/Persistent=true/);const service=readFileSync('deploy/qiulegeqiu-api.service','utf8');assert.match(service,/User=qiulegeqiu/);assert.match(service,/ProtectSystem=strict/);assert.match(service,/\/opt\/qiulegeqiu-api\/node\/bin\/node/);});

test('一键更新脚本：规则切换只按发布包登记的REVIEWED_TRANSITIONS走--api-only桥接，整体在main函数内且最后才调用',()=>{
 const script=readFileSync('deploy/update.sh','utf8');
 assert.match(script,/REVIEWED_TRANSITIONS/);assert.match(script,/--api-only/);assert.match(script,/verifyCompatibilityBridgeHealth/);
 assert.doesNotMatch(script,/OLD" = "1\.2\.0/);assert.doesNotMatch(script,/reset-record|reset-database/);
 assert.equal(script.trimEnd().split('\n').at(-1),'main "$@"');assert.match(script,/^main\(\) \{$/m);
});
