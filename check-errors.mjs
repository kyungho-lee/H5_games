// check-errors.mjs — boot error diagnostic (detailed 404 tracking)
import puppeteer from 'puppeteer';

const PAGES = [
  { name: 'index.html (Daily)',   url: 'http://localhost:8765/index.html'   },
  { name: 'endless.html (Endless)', url: 'http://localhost:8765/endless.html' },
];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  for (const { name, url } of PAGES) {
    console.log(`\n══ ${name} ══`);
    const page = await browser.newPage();

    page.on('console', msg => {
      const t = msg.type();
      const text = msg.text();
      if (t === 'error')   console.log(`  🔴 [error]   ${text}`);
      else if (t === 'warning') console.log(`  ⚠️  [warn]    ${text}`);
      else console.log(`  📋 [${t.padEnd(5)}] ${text}`);
    });

    page.on('pageerror', err => {
      console.log(`  💥 [pageerr] ${err.message}`);
    });

    // Log ALL failed requests with full URL
    page.on('requestfailed', req => {
      console.log(`  ❌ [failed]  ${req.url()} → ${req.failure()?.errorText}`);
    });

    // Log all responses — flag non-200
    page.on('response', res => {
      const status = res.status();
      if (status >= 400) {
        console.log(`  🔴 [${status}]     ${res.url()}`);
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 }).catch(e => {
      console.log(`  💥 [nav]     ${e.message}`);
    });
    await new Promise(r => setTimeout(r, 3000));
    await page.close();
  }

  await browser.close();
})();
