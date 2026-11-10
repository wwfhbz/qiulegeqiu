import { createBackup } from './backup-lib.mjs';
process.umask(0o077);
try {
 const result=await createBackup({source:'/var/lib/qiulegeqiu/leaderboard.sqlite',directory:'/var/backups/qiulegeqiu',retainDays:7});
 console.log(JSON.stringify({event:'qiulegeqiu_backup_complete',...result}));
} catch(error) {console.error(JSON.stringify({event:'qiulegeqiu_backup_failed',message:String(error)}));process.exitCode=1;}
