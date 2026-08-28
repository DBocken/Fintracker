import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  proxy: { server: process.env.HTTPS_PROXY ?? '', bypass: 'localhost,127.0.0.1' },
});
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();
for (const url of ['https://example.com/', 'https://huggingface.co/api/models/Xenova/multilingual-e5-small']) {
  const r = await page.goto(url).then(x => 'OK ' + x.status()).catch(e => 'FEHLER ' + String(e).slice(0,120));
  console.log(url, '->', r);
}
await browser.close();
