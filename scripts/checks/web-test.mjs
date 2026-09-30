import { spawnSync } from 'node:child_process';
const paths=process.argv.slice(2).map(p=>p.replace(/^web\//,''));
const args=['--prefix','web','exec','--','ng','test','--watch=false',...paths.flatMap(p=>['--include',p])];
const result=spawnSync('npm',args,{stdio:'inherit'});
process.exit(result.status??1);
