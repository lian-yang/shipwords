const assert = (await import('node:assert/strict')).default;
const fs = await import('node:fs/promises');
const task = await taskSpace(48);
const page = task.page('p1');
const checks = [];
const configSource = await fs.readFile('/Users/yanglian/Code/shipwords/sites/freeaivideo/site.config.ts', 'utf8');
const expectedCanonical = new URL('/', configSource.match(/url: '([^']+)'/)[1]).href;
await fs.writeFile('/tmp/freeaivideo-invalid-photo.txt', 'Not an image. Local upload validation fixture.');
for (let run = 1; run <= 3; run++) {
  await page.goto('http://localhost:5051');
  await page.waitForSelector('.tool-form[aria-busy="false"]');
  console.log('run', run, 'form restored');
  await page.fill('#prompt', `A cinematic river scene, verification pass ${run}`);
  await page.waitForFunction((run) => JSON.parse(sessionStorage.getItem('tool:state') || '{}').prompt === `A cinematic river scene, verification pass ${run}`, run);
  for (const ratio of ['1:1', '16:9', '9:16', '4:3', '3:4']) {
    await page.selectOption('.tool-controls label:nth-child(2) select', ratio);
    await page.waitForFunction((ratio) => document.querySelector('.tool-controls label:nth-child(2) select').value === ratio, ratio);
    assert.equal(await page.evaluate(() => document.querySelector('.tool-controls label:nth-child(2) select').value), ratio);
  }
  await page.click('.prompt-ideas button:first-of-type', {label:'insert a scene idea'});
  const inserted = await page.evaluate(() => document.querySelector('#prompt').value);
  assert.ok(inserted.includes('astronaut'));
  await page.waitForFunction(() => JSON.parse(sessionStorage.getItem('tool:state') || '{}').prompt?.includes('astronaut'));
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#prompt')?.value.includes('astronaut'));
  const saved = await page.evaluate(() => ({prompt: document.querySelector('#prompt').value, ratio:document.querySelector('.tool-controls label:nth-child(2) select').value}));
  assert.equal(saved.prompt, inserted);
  assert.equal(saved.ratio, '3:4');
  console.log('run', run, 'upload');
  await page.setInputFiles('input[type=file]', ['/tmp/freeaivideo-invalid-photo.txt']);
  await page.waitForSelector('.tool-form [role=alert]');
  assert.ok((await page.evaluate(() => document.querySelector('.tool-form [role=alert]').textContent)).includes("can't read"));
  assert.equal(await page.evaluate(() => document.querySelector('#prompt').value), inserted);
  console.log('run', run, 'pricing');
  await page.click('.site-header a[href="/#pricing"]', {label:'open credit pack prices'});
  await page.waitForSelector('.pricing-dialog[open]');
  await page.waitForFunction(() => document.querySelector('.pricing-dialog').getAnimations().every(a=>a.playState === 'finished'));
  if (run === 1) await page.screenshot({path:'/Users/yanglian/Code/shipwords/sites/freeaivideo/design/ui-redesign/pricing-dialog.png'});
  console.log('run', run, 'close pricing');
  await page.click('.pricing-dialog .dialog-close', {label:'close credit pack prices'});
  console.log('run', run, 'sign in');
  await page.click('.sign-in-link', {label:'open sign in'});
  await page.waitForSelector('.sign-in-dialog[open]');
  await page.waitForFunction(() => document.querySelector('.sign-in-dialog').getAnimations().every(a=>a.playState === 'finished'));
  if (run === 1) await page.screenshot({path:'/Users/yanglian/Code/shipwords/sites/freeaivideo/design/ui-redesign/sign-in-dialog.png'});
  console.log('run', run, 'escape');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.sign-in-dialog').open);
  assert.equal(await page.evaluate(() => document.querySelector('#prompt').value), inserted);
  console.log('run', run, 'faq');
  await page.click('.faq-list details:nth-child(2) summary', {label:'read watermark answer'});
  assert.equal(await page.evaluate(() => document.querySelector('.faq-list details:nth-child(2)').open), true);
  await page.click('.faq-list details:nth-child(2) summary', {label:'collapse watermark answer'});
  assert.equal(await page.evaluate(() => document.querySelector('.faq-list details:nth-child(2)').open), false);
  console.log('run', run, 'inspiration');
  await page.click('.inspiration-bottom button', {label:'use the inspiration prompt'});
  assert.equal(await page.evaluate(() => document.activeElement.id), 'prompt');
  assert.equal(await page.evaluate(() => document.querySelector('#prompt').value), inserted);
  const state = await page.evaluate(() => ({
    h1: [...document.querySelectorAll('h1')].map(n=>n.textContent),
    canonical:document.querySelector('link[rel=canonical]')?.href,
    headings:[...document.querySelectorAll('main h2')].map(n=>n.textContent),
    faqCount:document.querySelectorAll('.faq-list details').length,
    overflow:document.documentElement.scrollWidth>window.innerWidth,
    schema:[...document.querySelectorAll('script[type="application/ld+json"]')].map(n=>JSON.parse(n.textContent)),
  }));
  assert.equal(state.h1.length, 1);
  assert.equal(state.h1[0], 'Free AI Video Generator (No Sign-Up)');
  assert.equal(state.canonical, expectedCanonical);
  assert.equal(state.faqCount,7);
  assert.equal(state.overflow,false);
  assert.ok(JSON.stringify(state.schema).includes('FAQPage'));
  checks.push({run, passed:['prompt idea','all 5 aspect ratios','reload persistence','invalid image feedback preserves input','pricing dialog','sign-in dialog','FAQ toggle','inspiration focus','H1 and canonical','FAQ schema','desktop overflow']});
}
await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await page.goto('http://localhost:5051');
await page.waitForSelector('.tool-form[aria-busy="false"]');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.screenshot({path:'/Users/yanglian/Code/shipwords/sites/freeaivideo/design/ui-redesign/mobile-filled.png'});
await page.click('.site-header a[href="/#pricing"]',{label:'check mobile pricing dialog'});
await page.waitForSelector('.pricing-dialog[open]');
await page.screenshot({path:'/Users/yanglian/Code/shipwords/sites/freeaivideo/design/ui-redesign/mobile-pricing.png'});
await page.keyboard.press('Escape');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:720,height:450,deviceScaleFactor:2,mobile:false});
await page.goto('http://localhost:5051');
await page.waitForSelector('.tool-form[aria-busy="false"]');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.screenshot({path:'/Users/yanglian/Code/shipwords/sites/freeaivideo/design/ui-redesign/desktop-200-percent.png'});
await page.cdp('Emulation.clearDeviceMetricsOverride');
await page.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await page.goto('http://localhost:5051');
await page.waitForSelector('.workspace');
const reduced=await page.evaluate(()=>({animation:getComputedStyle(document.querySelector('.workspace')).animationName,autoplay:[...document.querySelectorAll('video')].some(v=>v.autoplay)}));
assert.equal(reduced.animation,'none');
assert.equal(reduced.autoplay,false);
await page.cdp('Emulation.setEmulatedMedia',{features:[]});
await fs.writeFile('/Users/yanglian/Code/shipwords/sites/freeaivideo/design/ui-redesign/interaction-results.json',JSON.stringify({checks,mobileNoOverflow:true,desktop200PercentNoOverflow:true,reducedMotion:reduced,scope:'Local UI only. No generation, email, checkout, payment or production writes.'},null,2));
console.log(JSON.stringify({runs:checks.length,result:'passed',checksPerRun:checks[0].passed.length,mobileNoOverflow:true,desktop200PercentNoOverflow:true,reducedMotion:reduced}));
console.log(await page.snapshot());
