const fs=require('fs'),path=require('path'),readline=require('readline');
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const ask=q=>new Promise(r=>rl.question(q,a=>r(a.trim())));
(async()=>{console.log('\nНастройка на Digital Eight Scraper\n');const dashboardUrl=await ask('Dashboard URL [https://finance.management.digitaleight.bg]: ')||'https://finance.management.digitaleight.bg';const username=await ask('Потребител (Admin/Partner): ');const password=await ask('Парола: ');fs.writeFileSync(path.join(__dirname,'config.local.json'),JSON.stringify({dashboardUrl,username,password},null,2));rl.close();console.log('\nНастройките са запазени само на този компютър.\n')})().catch(e=>{console.error(e);process.exit(1)});
