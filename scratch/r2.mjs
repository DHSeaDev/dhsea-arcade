import {chromium} from 'playwright';
const B='http://localhost:8899/games/planet-express-lounge/';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await b.newContext({viewport:{width:1600,height:1000}});
const p=await ctx.newPage();
await p.goto(B,{waitUntil:'domcontentloaded'});await p.waitForTimeout(1200);
// chip
console.log('CHIP',JSON.stringify(await p.evaluate(()=>{const c=[...document.querySelectorAll('a')].find(a=>a.innerText.includes('Arcade'));const s=getComputedStyle(c);return{op:s.opacity,bg:s.backgroundColor,color:s.color,pos:s.position,z:s.zIndex,fs:s.fontSize,r:c.getBoundingClientRect().toJSON()}})));
// demo clickthrough
for(let i=0;i<5;i++){
  const btn=await p.$('.demo-next-btn');
  const cnt=await p.$eval('.demo-counter, .demo-next-btn ~ *',e=>e.innerText).catch(()=>'?');
  console.log('step',i,'counter',cnt,'btnText',btn?await btn.innerText():'GONE');
  if(!btn) break;
  await btn.click(); await p.waitForTimeout(900);
}
await p.screenshot({path:'/tmp/shots/1600-demo-end.png'});
console.log('composer?',await p.evaluate(()=>{const t=document.querySelector('textarea,input[type=text][id*=input],#userInput');return t?{tag:t.tagName,id:t.id,vis:!!t.offsetParent,ph:t.placeholder}:null}));
await b.close();
