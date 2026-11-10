import hashlib,importlib.util,io,json,pathlib,subprocess,tarfile,tempfile,unittest
spec=importlib.util.spec_from_file_location('integrity','deploy/release-integrity.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Integrity(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.tmp.name);self.repo=self.root/'repo';self.repo.mkdir()
  def git(*a):return subprocess.check_output(['git','-C',str(self.repo),*a],stderr=subprocess.DEVNULL).decode().strip()
  self.git=git;git('init');git('config','user.name','Deployment test');git('config','user.email','test@example.invalid')
  self.files={'dist/index.html':b'<script src="/assets/app.js"></script>','dist/assets/app.js':b'game()', 'server/build/index.js':b'api()', 'server/build/manage.js':b'migrate()', 'server/package.json':b'{}','server/package-lock.json':b'{}','VERSION':b'0.8.0','RULES_VERSION':b'rules','deploy/first-production-install.sh':b'#!/bin/bash\n','deploy/release-integrity.py':b'# reviewed\n'}
  for n,b in self.files.items():
   p=self.repo/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
  git('add','.');git('commit','-m','fixture');self.commit=git('rev-parse','HEAD');self.files['SOURCE_COMMIT']=self.commit.encode();self.files['SOURCE_TREE']=git('rev-parse','HEAD^{tree}').encode()
 def tearDown(self):self.tmp.cleanup()
 def check(self,change=None):
  files=self.files.copy()
  if change:change(files)
  files['RELEASE_MANIFEST.json']=json.dumps({n:m.digest(b) for n,b in files.items()}).encode()
  archive=self.root/'release.tar.gz'
  with tarfile.open(archive,'w:gz') as t:
   for n,b in files.items():
    info=tarfile.TarInfo(n);info.size=len(b);t.addfile(info,io.BytesIO(b))
  return m.verify(archive,m.digest(archive.read_bytes()),self.commit,self.repo)
 def test_valid(self):self.assertIn('dist/index.html',self.check())
 def test_traversal(self):
  with self.assertRaisesRegex(ValueError,'路径'):self.check(lambda f:f.update({'dist/../escape':b'x'}))
 def test_secret(self):
  with self.assertRaisesRegex(ValueError,'敏感'):self.check(lambda f:f.update({'server/.env':b'SECRET'}))
 def test_source_mismatch(self):
  with self.assertRaisesRegex(ValueError,'审核源码'):self.check(lambda f:f.update({'deploy/first-production-install.sh':b'changed'}))
 def test_commit_mismatch(self):
  with self.assertRaisesRegex(ValueError,'来源提交'):self.check(lambda f:f.update({'SOURCE_COMMIT':b'0'*40}))
 def test_missing_new_installer(self):
  with self.assertRaisesRegex(ValueError,'缺少产物'):self.check(lambda f:f.pop('deploy/first-production-install.sh'))
 def test_missing_asset(self):
  with self.assertRaisesRegex(ValueError,'缺失资源'):self.check(lambda f:f.update({'dist/index.html':b'<script src="/assets/missing.js"></script>'}))
 def test_wrong_sha(self):
  self.check()
  with self.assertRaisesRegex(ValueError,'SHA256'):m.verify(self.root/'release.tar.gz','0'*64,self.commit,self.repo)
unittest.main()
