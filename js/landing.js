/* Landing: ofertas y destacados desde el catálogo, datos del negocio y acceso a la app.
   Las ofertas se editan en la lista OFERTAS: código del producto, cantidad, % de descuento y etiqueta. */
const OFERTAS = [
  { c: '7790895001000', cant: 2, pct: 15, tag: 'Llevando 2' },
  { c: '7790580660008', cant: 3, pct: 20, tag: 'Pack x3' },
  { c: '7791813420026', cant: 6, pct: 18, tag: 'Six pack' },
  { c: '7790310001237', cant: 1, pct: 12, tag: 'Para el finde' },
  { c: '7790387000106', cant: 1, pct: 10, tag: 'Mateada' },
  { c: '2000001', cant: 0.5, pct: 10, tag: '½ kg' },
];
const PROMOS_TICKER = ['🔥 Ofertas nuevas todas las semanas', '🍫 Martes 3x2 en alfajores', '💵 10% off en efectivo desde $20.000', '🛵 Envío sin cargo desde $15.000', '📶 Recargas y pago de servicios', '📱 Pagá con QR'];

(async () => {
  $('#lp-year').textContent = new Date().getFullYear();
  const track = $('#lp-track');
  const items = PROMOS_TICKER.map(t => `<span>${esc(t)}</span>`).join('');
  track.innerHTML = items + items;

  $$('[data-entrar]').forEach(b => {
    b.onclick = () => UI.modal({
      title: 'Entrar a la aplicación',
      body: `<div class="pick-list">
        <a class="pick-opt" href="cliente.html"><span>🛍️ <b>Soy cliente</b><br><small class="muted">Ver precios y hacer pedidos</small></span><b>→</b></a>
        <a class="pick-opt" href="panel.html"><span>🧾 <b>Panel del negocio</b><br><small class="muted">Demo: Administrador PIN 1234 · Cajero/a PIN 0000</small></span><b>→</b></a></div>`,
      size: 'pick',
    });
  });

  let cat;
  try { cat = await Catalogo.cargar(); } catch { cat = { negocio: {}, productos: [] }; }
  const n = cat.negocio || {};
  $$('[data-n]').forEach(el => { const v = n[el.dataset.n]; if (v) el.textContent = v; });
  if (n.nombre) document.title = `${n.nombre} · Ofertas y pedidos online`;
  if (n.horario) $('#lp-abierto').textContent = '🟢 ' + n.horario;
  const dir = n.direccion || '';
  $('#lp-map').href = dir ? `https://maps.google.com/?q=${encodeURIComponent(dir)}` : 'https://maps.google.com';
  const wa = Catalogo.waNumero(n.whatsapp);
  if (wa) $('#lp-wa').href = `https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${n.nombre || ''}! Quería hacer una consulta.`)}`;

  const byCode = c => cat.productos.find(p => p.c === c);
  const r10 = x => Math.round(x / 10) * 10;
  const ofertas = OFERTAS.map(o => ({ ...o, p: byCode(o.c) })).filter(o => o.p);
  $('#lp-ofertas').innerHTML = ofertas.length ? ofertas.map(({ p, cant, pct, tag }) => {
    const antes = p.p * cant;
    const ahora = r10(antes * (1 - pct / 100));
    return `<article class="of">
      <span class="of-pct">-${pct}%</span>
      <div class="of-img">${p.i ? `<img src="${esc(p.i)}" alt="" loading="lazy">` : p.e}</div>
      <span class="of-tag">${esc(tag)}</span>
      <h3>${esc(p.n)}</h3>
      <div class="of-pr"><s>${fmt(antes)}</s><b>${fmt(ahora)}</b></div>
      <a class="btn primary block" href="cliente.html">Pedir ahora</a>
    </article>`;
  }).join('') : UI.empty('Pronto nuevas ofertas');

  const pub = cat.productos.filter(p => p.r !== 'Cigarrillos');
  const top = pub.filter(p => p.d).concat(pub.filter(p => !p.d)).slice(0, 10);
  $('#lp-top').innerHTML = top.map(p => `<a class="mini" href="cliente.html"><span>${p.e}</span><b>${esc(p.n)}</b><small>${fmt(p.p)}${p.k ? ' /kg' : ''}</small></a>`).join('');
})();
