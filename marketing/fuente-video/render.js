const { chromium } = require('playwright');
const fs = require('fs');
const P = '' + __dirname + '/';
const v = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await pg.goto(`file://${P}promo.html?v=${v}`); await pg.waitForTimeout(800);
  const dur = await pg.evaluate(() => window.VIDEO_DUR);
  const dir = `${P}frames-${v}/`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const N = Math.round(dur * 30);
  for (let f = 0; f < N; f++) {
    await pg.evaluate(t => render(t), f / 30);
    await pg.screenshot({ path: `${dir}${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 });
  }
  console.log(v, N, 'frames');
  await b.close();
})();
