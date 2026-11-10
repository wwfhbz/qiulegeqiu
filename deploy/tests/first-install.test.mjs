import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
test('首次安装默认不执行写操作，缺少审核锚点立即停止',()=>{
 const r=spawnSync('bash',['deploy/first-production-install.sh'],{encoding:'utf8'});
 assert.notEqual(r.status,0);assert.match(r.stdout+r.stderr,/必须提供外部审核/);
 assert.equal(spawnSync('bash',['-n','deploy/first-production-install.sh']).status,0);
});
test('归档验证：真实Git夹具、清单、敏感文件、路径和审核源码',()=>{
 const r=spawnSync('python3',['deploy/tests/release_integrity_test.py'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);
});
test('统一回滚不恢复数据库；上线检查没有提交生产成绩',()=>{
 const s=readFileSync('deploy/first-production-install.sh','utf8');
 assert.match(s,/trap rollback ERR/);assert.match(s,/nginx -t && systemctl reload nginx/);
 assert.doesNotMatch(s,/restore\.sh|DELETE FROM|DROP TABLE|POST|ssh |docker /);
 assert.ok(s.indexOf('python3 "$scripts/release-integrity.py"')<s.indexOf('[[ "$mode" = apply ]]'));
 assert.match(s,/QIULEGEQIU_LOCK_HELD=1/);
});
