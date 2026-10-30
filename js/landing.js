/* Landing: banners, ofertas, categorías y promos tomadas del catálogo (se editan desde el panel) */
(async () => {
  $('#lp-year').textContent = new Date().getFullYear();
  let cat;
  try { cat = await Catalogo.cargar(); } catch { cat = { negocio: {}, app: {}, rubros: [], productos: [] }; }
  const n = cat.negocio || {}, a = cat.app || {};
  const cart = (() => { try { return JSON.parse(localStorage.getItem('cliente:cart')) || {}; } catch { return {}; } })();

  $$('[data-n]').forEach(el => { if (n[el.dataset.n]) el.textContent = n[el.dataset.n]; });
  if (n.nombre) { $('#lp-nombre').textContent = n.nombre; document.title = `${n.nombre} · Ofertas y pedidos online`; }
  if (n.horario) $('#lp-horario').textContent = `${n.horario} · Retirá en el local o recibilo en tu casa`;
  if (a.aviso) { const s = $('#lp-aviso'); s.textContent = a.aviso; s.hidden = false; }
  $('#lp-map').href = n.direccion ? `https://maps.google.com/?q=${encodeURIComponent(n.direccion)}` : 'https://maps.google.com';
  const wa = Catalogo.waNumero(n.whatsapp);
  if (wa) { const u = `https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${n.nombre || ''}! Quería hacer una consulta.`)}`; $('#lp-wa').href = u; $('#lp-wa-row').href = u; }
  if (matchMedia('(min-width: 900px)').matches) {
    const f = $('#lp-search'); f.style.display = 'flex';
    f.onsubmit = e => { e.preventDefault(); location.href = 'cliente.html#/lista?q=' + encodeURIComponent(f.q.value); };
  }

  if (a.banners && a.banners.length) $('#lp-carousel').innerHTML = Tienda.carousel(a.banners);
  Tienda.activar(document, link => {
    location.href = !link || link === 'inicio' ? 'cliente.html' : link === 'ofertas' ? 'cliente.html#/lista?f=ofertas' : link === 'ahorros' ? 'cliente.html#/ahorros' : 'cliente.html#/lista?r=' + encodeURIComponent(link);
  });
  const stories = [['Ofertas', '🏷️', 'cliente.html#/lista?f=ofertas'], ['Promos de pago', '💳', '#promos'], ['Bebidas frías', '🧊', 'cliente.html#/lista?r=Bebidas'], ['Golosinas', '🍫', 'cliente.html#/lista?r=Golosinas'], ['Para el mate', '🧉', 'cliente.html#/lista?r=Almac%C3%A9n'], ['Recargas', '📶', '#servicios'], ['Pedí online', '🛵', 'cliente.html']];
  $('#lp-stories').innerHTML = stories.map(([l, e, g]) => `<a class="t-story" href="${g}"><div class="ring"><div class="in" style="background:#fff8db"><img src="${Tienda.img3d(e)}" alt=""></div></div><span>${l}</span></a>`).join('');

  const ofertas = cat.productos.filter(p => p.o).sort((x, y) => Tienda.pct(y) - Tienda.pct(x));
  const fila = list => list.map(p => Tienda.card(p, cart[p.c] || 0)).join('');
  $('#lp-ofertas').innerHTML = ofertas.length ? fila(ofertas.slice(0, 12)) : UI.empty('Pronto nuevas ofertas');
  $('#lp-tiles').innerHTML = Tienda.mosaico(cat.productos);
  $('#lp-cats').innerHTML = cat.rubros.map(r => `<a class="t-cat" href="cliente.html#/lista?r=${encodeURIComponent(r)}"><div class="sq"><img src="${Tienda.img3d(Catalogo.EMO[r] || '📦')}" alt=""></div><span>${esc(r)}</span></a>`).join('');
  $('#lp-pays').innerHTML = (a.promosPago || []).map(x => `<div class="t-pay"><img src="${Tienda.img3d(x.emoji || '💳')}" alt=""><div><small>${esc(x.dia)}</small><b>${esc(x.titulo)}</b><span>${esc(x.sub)}</span></div></div>`).join('');
  const top = cat.productos.filter(p => p.d).concat(cat.productos.filter(p => !p.d && !p.o)).slice(0, 12);
  $('#lp-top').innerHTML = fila(top);

  /* Agregar desde la landing usa el mismo carrito que la app */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-add],[data-inc],[data-dec]');
    if (b) {
      const code = b.dataset.add || b.dataset.inc || b.dataset.dec;
      const p = cat.productos.find(x => x.c === code);
      const step = p.k ? 0.25 : 1;
      cart[code] = round3((cart[code] || 0) + (b.dataset.dec ? -step : step));
      if (cart[code] <= 0) delete cart[code];
      localStorage.setItem('cliente:cart', JSON.stringify(cart));
      $$(`[data-ctl="${CSS.escape(code)}"]`).forEach(el => { el.innerHTML = Tienda.control(p, cart[code] || 0); });
      if (b.dataset.add) UI.toast(`Agregaste ${p.n} · abrí "Hacer pedido" para finalizar`, 'ok', 2500);
      return;
    }
    const t = e.target.closest('.t-tile[data-rubro]');
    if (t) { location.href = 'cliente.html#/lista?f=ofertas&r=' + encodeURIComponent(t.dataset.rubro); return; }
    const c = e.target.closest('.pc[data-p]');
    if (c && !e.target.closest('[data-stop]')) location.href = 'cliente.html#/p/' + encodeURIComponent(c.dataset.p);
  });
})();
