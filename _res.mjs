import {chromium} from 'playwright-core';
const b=await chromium.launch({executablePath:process.env.HOME+'/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',args:['--no-sandbox']});
for(const [w,h] of [[3840,2160],[2560,1080],[1920,1080],[1366,768],[1024,768],[800,600],[1280,900]]){
  const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
  // isolated hotbar with style.css
  await p.setContent(`<!doctype html><link rel=stylesheet href=http://localhost:5199/style.css><body style="margin:0"><div id=hud><div id="quick-slots">${'<div class="quick-slot occupied"><div class="item-icon" data-cat="weapon" style="width:30px;height:30px"></div></div>'.repeat(9)}</div></div></body>`);
  await new Promise(r=>setTimeout(r,300));
  const info=await p.evaluate(()=>{const c=document.getElementById('quick-slots');const r=c.getBoundingClientRect();const first=c.firstElementChild.getBoundingClientRect();return {barW:Math.round(r.width),barH:Math.round(r.height),left:Math.round(r.left),bottom:Math.round(window.innerHeight-r.bottom),slotW:Math.round(first.width),overflow:r.left<0||r.right>window.innerWidth};});
  console.log(`${w}x${h}: bar=${info.barW}x${info.barH} left=${info.left} bottomGap=${info.bottom} slotW=${info.slotW} overflow=${info.overflow}`);
  await p.close();
}
await b.close();
