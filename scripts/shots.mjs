import { chromium } from 'playwright';
import http from 'node:http'; import { readFile, stat, mkdir } from 'node:fs/promises'; import path from 'node:path';
const OUT = path.resolve(import.meta.dirname,'..','dist'); const SHOTS = path.resolve(import.meta.dirname,'..','shots');
await mkdir(SHOTS,{recursive:true});
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.mp3':'audio/mpeg','.ogg':'audio/ogg','.webp':'image/webp','.jpg':'image/jpeg'};
const s=http.createServer(async(q,r)=>{try{let f=path.join(OUT,decodeURIComponent(q.url.split('?')[0]));if((await stat(f).catch(()=>null))?.isDirectory())f=path.join(f,'index.html');const b=await readFile(f);r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});r.end(b);}catch{r.writeHead(404);r.end('')}});
await new Promise(r=>s.listen(8097,r));
const P=[['index',''],['prism-cascade','games/prism-cascade/'],['lumenreel','games/lumenreel/ui/'],['underglory','games/underglory/'],['veilfall','games/veilfall/'],['emberkeep','games/emberkeep/'],['emberkeep-mountain','games/emberkeep-mountain/'],['bloom-rush','games/bloom-rush/']];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--disable-dev-shm-usage','--font-render-hinting=none']});
for(const [n,u] of P){const c=await b.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});const p=await c.newPage();
await p.goto('http://localhost:8097/'+u,{waitUntil:'load'}); await p.waitForTimeout(3000);
await p.screenshot({path:path.join(SHOTS,n+'.png')}); await c.close(); console.log('shot',n);}
await b.close(); s.close();
