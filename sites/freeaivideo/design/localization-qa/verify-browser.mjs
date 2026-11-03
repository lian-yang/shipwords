const fs = await import('node:fs/promises');
const assert = (await import('node:assert/strict')).default;
const root = '/Users/yanglian/Code/shipwords/sites/freeaivideo';
const homeEn = JSON.parse(await fs.readFile(`${root}/messages/home/en.json`, 'utf8'));
const homeZh = JSON.parse(await fs.readFile(`${root}/messages/home/zh.json`, 'utf8'));
const task = await taskSpace(50);
const page = task.page('p1');
const base = 'http://localhost:5051';
const results = [];
await fs.writeFile('/tmp/freeaivideo-invalid-localization.txt', 'Invalid image fixture.');
async function ready() {
  await page.waitForFunction(() => document.documentElement.lang === 'zh');
}
async function chinese() {
  if ((await page.evaluate(() => document.documentElement.lang)) !== 'zh') {
    await page.click('.locale-toggle', { label: '切换中文界面' });
    await ready();
  }
}
async function expectHeading(title) {
  await page.waitForFunction((text) => document.querySelector('h1')?.textContent === text, title);
}
async function noPlaceholder() {
  assert.equal(await page.evaluate(() => document.body.textContent.includes('TODO')), false);
}
for (let run = 1; run <= 3; run++) {
  await page.goto(`${base}/terms`);
  await chinese();
  await noPlaceholder();
  await expectHeading('服务条款');
  await page.click('.legal nav a[href="/privacy"]', { label: '查看中文隐私政策' });
  await page.waitForURL('**/privacy');
  await ready();
  await noPlaceholder();
  await expectHeading('隐私政策');
  await page.reload();
  await ready();
  await noPlaceholder();
  for (const [path, title] of [
    ['/refunds', '退款政策'],
    ['/dmca', '版权投诉、DMCA 与内容下架'],
  ]) {
    await page.click(`.legal nav a[href="${path}"]`, { label: '查看其他中文政策' });
    await page.waitForURL(`**${path}`);
    await ready();
    await expectHeading(title);
    await noPlaceholder();
  }
  await page.click('.brand', { label: '返回中文生成器' });
  await page.waitForSelector('.tool-form[aria-busy="false"]');
  await ready();
  assert.equal(await page.evaluate(() => document.querySelector('h1').textContent), homeZh.home_title);
  const faq = await page.evaluate(() => {
    const visible = [...document.querySelectorAll('.faq-list details')].map((d) => ({
      question: [...d.querySelector('summary').childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join('')
        .trim(),
      answer: d.querySelector('.faq-answer p').textContent,
    }));
    const schema = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => JSON.parse(s.textContent))
      .find((s) => s['@type'] === 'FAQPage');
    return {
      visible,
      schema: schema.mainEntity.map((q) => ({ question: q.name, answer: q.acceptedAnswer.text })),
    };
  });
  assert.deepEqual(faq.visible, faq.schema);
  assert.equal(faq.visible.length, 7);
  await page.click('.prompt-ideas button:first-of-type', { label: '填入创作灵感' });
  const expectedPrompt = await page.evaluate(() => document.querySelector('#prompt').value);
  assert.ok(expectedPrompt.length > 10);
  await page.waitForFunction(
    (value) => JSON.parse(sessionStorage.getItem('tool:state') || '{}').prompt === value,
    expectedPrompt,
  );
  await page.setInputFiles('input[type=file]', ['/tmp/freeaivideo-invalid-localization.txt']);
  await page.waitForSelector('.tool-form [role="alert"]');
  const uploadError = await page.evaluate(
    () => document.querySelector('.tool-form [role="alert"]').textContent,
  );
  assert.ok(/[\u4e00-\u9fff]/.test(uploadError));
  assert.equal(/[A-Za-z]{4}/.test(uploadError.replace(/JPG|PNG/g, '')), false);
  await page.click('.site-header a[href="/#pricing"]', { label: '查看中文积分套餐' });
  await page.waitForSelector('.pricing-dialog[open]');
  await page.waitForFunction(() =>
    document
      .querySelector('.pricing-dialog')
      .getAnimations()
      .every((a) => a.playState === 'finished'),
  );
  const pricing = await page.evaluate(() => document.querySelector('.pricing-dialog').textContent);
  assert.ok(pricing.includes('入门积分包') && pricing.includes('创作积分包') && pricing.includes('购买'));
  assert.equal(/Starter|Creator|Get credits/.test(pricing), false);
  if (run === 1) await page.screenshot({ path: `${root}/design/localization-qa/zh-pricing.png` });
  await page.click('.pricing-dialog .dialog-close', { label: '关闭套餐说明' });
  await page.click('.sign-in-link', { label: '查看中文登录' });
  await page.waitForSelector('.sign-in-dialog[open]');
  await page.waitForFunction(() =>
    document
      .querySelector('.sign-in-dialog')
      .getAnimations()
      .every((a) => a.playState === 'finished'),
  );
  assert.ok(
    (await page.evaluate(() => document.querySelector('.sign-in-dialog').textContent)).includes('发送验证码'),
  );
  if (run === 1) await page.screenshot({ path: `${root}/design/localization-qa/zh-sign-in.png` });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.sign-in-dialog').open);
  await page.click('.locale-toggle', { label: '切换回英文' });
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.waitForSelector('.tool-form[aria-busy="false"]');
  assert.equal(await page.evaluate(() => document.querySelector('h1').textContent), homeEn.home_title);
  assert.equal(await page.evaluate(() => document.querySelector('#prompt').value), expectedPrompt);
  await page.click('.site-footer a[href="/terms"]', { label: '查看英文条款' });
  await page.waitForURL('**/terms');
  await expectHeading('Terms of service');
  await page.click('.locale-toggle', { label: '恢复中文条款' });
  await ready();
  assert.equal(await page.evaluate(() => location.pathname), '/terms');
  results.push({
    run,
    policyNavigation: true,
    localeSurvivesReload: true,
    faqMatchesSchema: 7,
    localizedError: true,
    pricingAndSignIn: true,
    languageSwitchKeepsPrompt: true,
  });
}
await page.cdp('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
for (const path of ['privacy', 'terms', 'refunds', 'dmca']) {
  await page.goto(`${base}/${path}`);
  await ready();
  await page.evaluate(() => scrollTo(0, 0));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: `${root}/design/localization-qa/zh-${path}-desktop.png`, fullPage: true });
}
await page.cdp('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
for (const path of ['privacy', 'terms']) {
  await page.goto(`${base}/${path}`);
  await ready();
  await page.evaluate(() => scrollTo(0, 0));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.ok(
    await page.evaluate(() => {
      const b = document.querySelector('.locale-toggle').getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    }),
  );
  await page.screenshot({ path: `${root}/design/localization-qa/zh-${path}-mobile.png`, fullPage: true });
}
await page.goto(base);
await page.waitForSelector('.tool-form[aria-busy="false"]');
await ready();
await page.evaluate(() => scrollTo(0, 0));
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
await page.screenshot({ path: `${root}/design/localization-qa/zh-home-mobile.png`, fullPage: true });
await page.cdp('Emulation.clearDeviceMetricsOverride');
await page.goto(`${base}/terms`);
await ready();
await page.evaluate(() => scrollTo(0, 0));
await fs.writeFile(
  `${root}/design/localization-qa/browser-results.json`,
  JSON.stringify(
    {
      runs: results,
      mobileLocaleToggleVisible: true,
      mobileAndDesktopNoOverflow: true,
      scope: 'UI only; no generation, payment or authentication submission.',
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    runs: results.length,
    result: 'passed',
    mobileLocaleToggleVisible: true,
    mobileAndDesktopNoOverflow: true,
  }),
);
console.log(await page.snapshot());
