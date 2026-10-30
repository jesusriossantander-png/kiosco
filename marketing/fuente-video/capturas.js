const { chromium } = require('playwright');
const A = '' + __dirname + '/assets/';
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch();
  // Cliente (sin datos del panel)
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await c.route('**/data/catalogo.json', async r => { const res = await r.fetch(); const j = await res.json(); j.productos = j.productos.filter(p => p.r !== 'Cigarrillos'); j.rubros = j.rubros.filter(x => x !== 'Cigarrillos'); r.fulfill({ response: res, json: j }); });
  const cp = await c.newPage();
  await cp.goto(U + 'index.html'); await cp.waitForTimeout(700);
  await cp.screenshot({ path: A + 'lp-hero.png' });
  await (await cp.$('#ofertas')).screenshot({ path: A + 'lp-ofertas-m.png' });
  await cp.goto(U + 'cliente.html'); await cp.waitForTimeout(600);
  await cp.screenshot({ path: A + 'cli-home.png' });
  const adds = await cp.$$('[data-add]'); await adds[0].click(); await (await cp.$$('[data-add]'))[1].click();
  await cp.click('[data-inc]');
  await cp.waitForTimeout(200);
  await cp.screenshot({ path: A + 'cli-home2.png' });
  await cp.click('#c-cartbar'); await cp.waitForTimeout(200);
  await cp.fill('[name=nombre]', 'Sofía'); await cp.fill('[name=tel]', '11 5555 1234');
  await cp.screenshot({ path: A + 'cli-cart.png' });
  await cp.goto(U + 'cliente.html'); await cp.waitForTimeout(400);
  await cp.click('[data-r="Golosinas"]'); await cp.waitForTimeout(200);
  await cp.screenshot({ path: A + 'cli-rubro.png' });
  // Landing desktop ofertas
  const d = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const lp = await d.newPage();
  await lp.goto(U); await lp.waitForTimeout(600);
  await lp.screenshot({ path: A + 'lp-desk.png' });
  // Panel desktop
  const pg = lp;
  await pg.goto(U + 'panel.html'); await pg.click('[data-u="u-admin"]'); await pg.fill('#login-pin', '1234'); await pg.press('#login-pin', 'Enter');
  await pg.waitForSelector('#nav a');
  await pg.evaluate(() => { DB.d.productos.forEach(p => { if (p.rubro === 'Cigarrillos') { p.activo = false; p.favorito = false; } }); DB.save(); location.hash = 'dashboard'; location.hash = 'pos'; }); await pg.waitForTimeout(200);
  await pg.click('#pos-abrir'); await pg.fill('[name=inicial]', '10000'); await pg.click('.modal footer .primary'); await pg.waitForTimeout(3500);
  for (const q of ['2*7790895000997', '7790387000106', '7790580660008', '2000001012508']) { await pg.fill('#pos-q', q); await pg.press('#pos-q', 'Enter'); }
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: A + 'pos.png' });
  await pg.keyboard.press('F2'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: A + 'cobro.png' });
  await pg.click('.modal footer .primary'); await pg.waitForTimeout(500);
  await (await pg.$('.tk-paper')).screenshot({ path: A + 'ticket.png' });
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(4000);
  // más ventas para el dashboard
  await pg.evaluate(() => {
    const ps = DB.d.productos.filter(p => p.activo !== false);
    for (let d = 6; d >= 0; d--) for (let k = 0; k < 6 + d % 3 * 3; k++) {
      const p = ps[(k * 7 + d) % ps.length]; const cant = 1 + (k % 3);
      DB.d.ventas.push({ id: DB.uid(), nro: DB.next('venta'), fecha: Date.now() - d * 864e5 - k * 1800e3, items: [{ pid: p.id, codigo: p.codigo, nombre: p.nombre, cant, precio: p.precios[0], costo: p.costo, rubro: p.rubro }], subtotal: cant * p.precios[0], descPct: 0, descuento: 0, total: cant * p.precios[0], pagos: [{ medio: ['efectivo', 'qr', 'debito'][k % 3], monto: cant * p.precios[0] }], usuarioId: 'u-caja', usuario: 'Cajero/a', caja: 'Caja 1' });
    }
    DB.save(); location.hash = 'dashboard';
  });
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: A + 'dash.png' });
  await pg.evaluate(() => { location.hash = 'stock/venc'; }); await pg.waitForTimeout(300);
  await pg.screenshot({ path: A + 'stock.png' });
  await pg.evaluate(() => { location.hash = 'clientes'; }); await pg.waitForTimeout(300);
  await pg.click('[data-c]'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: A + 'fiado.png' });
  await pg.keyboard.press('Escape');
  await pg.evaluate(() => { location.hash = 'reportes'; }); await pg.waitForTimeout(200);
  await pg.click('[data-pr="semana"]'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: A + 'reportes.png' });
  // Panel en celular
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await mp.goto(U + 'panel.html'); await mp.click('[data-u="u-admin"]');
  for (const k of '1234') await mp.click(`.pinpad [data-k="${k}"]`);
  await mp.click('.pinpad [data-k="ok"]'); await mp.waitForTimeout(400);
  await mp.screenshot({ path: A + 'm-dash.png' });
  await b.close();
})();
