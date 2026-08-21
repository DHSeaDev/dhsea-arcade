import {chromium} from 'playwright';
const B='http://localhost:8899/games/planet-express-lounge/';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await b.newContext({viewport:{width:1600,height:1000}});
const p=await ctx.newPage();
const errs=[],reqf=[];
p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))});
p.on('requestfailed',r=>reqf.push(r.url().slice(0,120)+' :: '+(r.failure()?.errorText||'')));
p.on('response',r=>{if(r.status()>=400)reqf.push('HTTP'+r.status()+' '+r.url().slice(0,120))});
await p.goto(B,{waitUntil:'networkidle'}).catch(e=>console.log('nav',e.message));
await p.waitForTimeout(1500);
await p.screenshot({path:'/tmp/shots/1600-first.png',fullPage:false});
// tab order probe
const order=[];
for(let i=0;i<8;i++){await p.keyboard.press('Tab');const d=await p.evaluate(()=>{const a=document.activeElement;return {tag:a.tagName,txt:(a.innerText||a.value||a.getAttribute('aria-label')||'').slice(0,40),cls:a.className?.toString().slice(0,50),role:a.getAttribute('role'),ti:a.getAttribute('tabindex')}});order.push(d)}
console.log('TAB ORDER',JSON.stringify(order,null,1));
// arcade chip opacity
const chip=await p.evaluate(()=>{const c=document.querySelector('.arcade-chip,[href*="/"][class*=arcade],a[class*=chip]');if(!c)return null;const s=getComputedStyle(c);return{txt:c.innerText,op:s.opacity,bg:s.backgroundColor,color:s.color,z:s.zIndex,pos:s.position,rect:c.getBoundingClientRect()}});
console.log('CHIP',JSON.stringify(chip));
// tabs
const tabs=await p.evaluate(()=>[...document.querySelectorAll('[class*=tab],[role=tab]')].map(e=>({tag:e.tagName,t:e.innerText.slice(0,20),role:e.getAttribute('role'),ti:e.getAttribute('tabindex'),cls:e.className.toString().slice(0,40)})).slice(0,25));
console.log('TABS',JSON.stringify(tabs));
// no-accessible-name
const noname=await p.evaluate(()=>[...document.querySelectorAll('button,a,img,input,select')].filter(e=>{const n=(e.innerText||'').trim()||e.getAttribute('aria-label')||e.getAttribute('title')||e.getAttribute('alt')||e.getAttribute('placeholder');return !n}).map(e=>e.tagName+'#'+e.id+'.'+e.className.toString().slice(0,30)));
console.log('NONAME',JSON.stringify(noname));
console.log('ERRS',JSON.stringify(errs));
console.log('REQF',JSON.stringify([...new Set(reqf)]));
await b.close();
