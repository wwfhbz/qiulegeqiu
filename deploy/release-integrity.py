#!/usr/bin/env python3
"""Read-only archive validation. Trust anchor: externally approved SHA256 + Git commit."""
import argparse, hashlib, json, pathlib, re, subprocess, tarfile

def digest(data): return hashlib.sha256(data).hexdigest()
def git(repo, *args): return subprocess.check_output(['git','-C',str(repo),*args])
def manifest(root):
    return {str(p.relative_to(root)):digest(p.read_bytes()) for p in sorted(root.rglob('*')) if p.is_file() and p.name != 'RELEASE_MANIFEST.json'}
def verify(archive, sha, commit, repo):
    if archive.stat().st_size>512*1024*1024: raise ValueError('发布包过大')
    if not re.fullmatch('[0-9a-f]{64}', sha) or digest(archive.read_bytes()) != sha: raise ValueError('发布包SHA256与外部审核值不同')
    if not re.fullmatch('[0-9a-f]{40}',commit): raise ValueError('必须提供完整审核提交SHA')
    if git(repo,'rev-parse','HEAD').decode().strip()!=commit or git(repo,'diff','HEAD','--').strip(): raise ValueError('工作目录不是干净的审核提交')
    with tarfile.open(archive,'r:gz') as tar:
        files={}; total=0; names=set()
        for m in tar:
            name=m.name.rstrip('/'); p=pathlib.PurePosixPath(name)
            if not name or name in names or p.is_absolute() or '..' in p.parts or '\\' in name or str(p)!=name: raise ValueError('归档路径不安全或重复')
            names.add(name)
            if p.parts[0] not in {'dist','server','deploy','VERSION','RULES_VERSION','SOURCE_COMMIT','SOURCE_TREE','RELEASE_MANIFEST.json'}: raise ValueError('非白名单归档根目录')
            if any(x in {'node_modules','.git','.env'} or re.search(r'\.(sqlite|db|pem|key|log)([-.]|$)',x,re.I) or (x.startswith('.env.') and x!='.env.example') for x in p.parts): raise ValueError('归档包含敏感文件')
            if p.parts[0]=='server' and len(p.parts)>1 and p.parts[1] not in {'build','data','migrations','package.json','package-lock.json'}: raise ValueError('server归档包含非生产文件')
            if m.isdir(): continue
            if not m.isfile() or m.mode & 0o6000: raise ValueError('归档包含链接、特殊文件或特权权限')
            total+=m.size
            if total>512*1024*1024 or len(names)>30000: raise ValueError('发布包超出安全大小')
            files[name]=tar.extractfile(m).read()
    required={'dist/index.html','server/build/index.js','server/build/manage.js','server/package.json','server/package-lock.json','SOURCE_COMMIT','SOURCE_TREE','VERSION','RULES_VERSION','RELEASE_MANIFEST.json','deploy/first-production-install.sh','deploy/install-production-deps.sh','deploy/verify-runtime.mjs','deploy/first-install-rollback-lib.sh'}
    if not required<=files.keys() or not any(p.startswith('dist/assets/') for p in files): raise ValueError('缺少产物或新安装器；请从审核版本重新打包')
    if files['SOURCE_COMMIT'].decode().strip()!=commit or files['SOURCE_TREE'].decode().strip()!=git(repo,'rev-parse',commit+'^{tree}').decode().strip(): raise ValueError('归档来源提交或源码树不一致')
    actual={p:digest(b) for p,b in files.items() if p!='RELEASE_MANIFEST.json'}
    if json.loads(files['RELEASE_MANIFEST.json'])!=actual: raise ValueError('产物清单不完整或哈希不同')
    for name,data in files.items():
        if name.startswith(('deploy/','server/data/','server/migrations/')) or name in {'server/package.json','server/package-lock.json'}:
            source='server/.env.example' if name=='deploy/qiulegeqiu-api.env.example' else name
            if data!=git(repo,'show',commit+':'+source): raise ValueError('发布包文件与审核源码不同：'+name)
    for path in re.findall(r'(?:src|href)="(/assets/[^"?#]+)',files['dist/index.html'].decode()):
        if 'dist'+path not in files: raise ValueError('网页引用缺失资源')
    for name in ('deploy/first-production-install.sh','deploy/release-integrity.py'):
        if (repo/name).read_bytes()!=files[name]: raise ValueError('执行中的安装器与发布包版本不同')
    return files

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--manifest');p.add_argument('--package');p.add_argument('--sha256');p.add_argument('--commit');p.add_argument('--repo');a=p.parse_args()
    try:
        if a.manifest:
            root=pathlib.Path(a.manifest);(root/'RELEASE_MANIFEST.json').write_text(json.dumps(manifest(root),sort_keys=True,indent=2)+'\n')
        else:
            verify(pathlib.Path(a.package),a.sha256,a.commit,pathlib.Path(a.repo));print('发布包校验通过：SHA256、路径、审核源码和产物清单一致')
    except Exception as e: raise SystemExit(str(e))
