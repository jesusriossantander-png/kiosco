/* App de clientes: Inicio, Categorías, Ahorros, Mi cuenta, resultados, producto, carrito y pedido por WhatsApp */
const C = (() => {
  const I = Tienda.icon, M = Tienda.money;
  const ls = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('cliente:' + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('cliente:' + k, JSON.stringify(v)); } catch { /* sin espacio */ } },
  };
  let cat = { negocio: {}, app: {}, rubros: [], productos: [] };
  let cart = ls.get('cart', {});
  let notas = ls.get('notas', {});
  let orden = 'rel';
  let installEvt = null;
  const app = $('#app');
  const byCode = c => cat.productos.find(p => p.c === c);
  const paso = p => (p.k ? 0.25 : 1);
  const perfil = () => ls.get('perfil', {});

  /* ---------- Carrito ---------- */
  const items = () => Object.entries(cart).map(([c, n]) => ({ p: byCode(c), n })).filter(x => x.p);
  const total = () => sum(items(), x => x.p.p * x.n);
  const ahorro = () => sum(items(), x => (x.p.o ? (x.p.o - x.p.p) * x.n : 0));
  const count = () => items().length;
  function setCant(code, n) {
    n = round3(n);
    if (n <= 0) { delete cart[code]; delete notas[code]; } else cart[code] = n;
    ls.set('cart', cart); ls.set('notas', notas);
    $$(`[data-ctl="${CSS.escape(code)}"]`).forEach(el => { el.innerHTML = Tienda.control(byCode(code), cart[code] || 0); });
    $$('[data-cartn]').forEach(el => { el.textContent = count(); el.classList.toggle('hidden', !count()); });
    const fab = $('#fab');
    if (fab) { fab.classList.toggle('hidden', !count()); $('#fab-n').textContent = `Ver mi carro (${count()})`; $('#fab-t').textContent = M(total()); }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-add],[data-inc],[data-dec]');
    if (b) {
      e.stopPropagation();
      const code = b.dataset.add || b.dataset.inc || b.dataset.dec;
      const p = byCode(code);
      if (!p) return;
      if (b.dataset.add) { setCant(code, paso(p)); if (navigator.vibrate) navigator.vibrate(15); UI.toast(`Agregaste ${p.n}`, 'ok', 1600); }
      else if (b.dataset.inc) setCant(code, (cart[code] || 0) + paso(p));
      else setCant(code, (cart[code] || 0) - paso(p));
      if (['carrito', 'p'].includes(ruta().v)) render();
      return;
    }
    const card = e.target.closest('.pc[data-p]');
    if (card && !e.target.closest('[data-stop]')) go('#/p/' + encodeURIComponent(card.dataset.p));
  });

  /* ---------- Rutas (#/inicio, #/lista?r=..., #/p/codigo, #/carrito…) ---------- */
  function ruta() {
    const h = location.hash.replace(/^#\/?/, '') || 'inicio';
    const [path, qs] = h.split('?');
    const [v, ...rest] = path.split('/');
    return { v, id: decodeURIComponent(rest.join('/')), q: new URLSearchParams(qs || '') };
  }
  const go = h => { location.hash = h; };
  const atras = () => (history.length > 1 ? history.back() : go('#/inicio'));
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

  /* ---------- Piezas comunes ---------- */
  function cabecera() {
    const pf = perfil(), n = cat.negocio;
    const envio = pf.entrega === 'envio';
    return `<header class="t-head"><div class="t-head-in">
        <a class="t-logo" href="index.html" aria-label="Página del kiosco"><img src="img/icon.svg" alt=""></a>
        <button class="t-store" id="h-store"><small>${envio ? 'Envío a:' : 'Retirá en:'}</small><b>${esc(envio ? pf.direccion || 'Ingresá tu dirección' : n.nombre || 'Mi Maxikiosco')} ${I('down')}</b></button>
        <a class="t-round" href="#/carrito" aria-label="Mi carro">${I('cart')}<span class="n ${count() ? '' : 'hidden'}" data-cartn>${count()}</span></a>
      </div>
      <form class="t-bar" id="h-search"><label class="t-search">${I('search')}<input name="q" placeholder="¿Qué estás buscando?" autocomplete="off" enterkeyhint="search" value="${esc(ruta().q.get('q') || '')}"><button type="button" id="h-cam" aria-label="Buscar escaneando el código">${I('camera')}</button></label></form></header>`;
  }
  function nav(on) {
    const t = [['inicio', 'home', 'Inicio'], ['categorias', 'grid', 'Categorías'], ['ahorros', 'pct', 'Ahorros'], ['cuenta', 'user', 'Mi Cuenta']];
    return `<nav class="t-nav">${t.map(([v, ic, l]) => `<a href="#/${v}" class="${on === v ? 'on' : ''}">${I(ic)}${l}</a>`).join('')}</nav>
      <button class="t-fab ${count() ? '' : 'hidden'}" id="fab" onclick="location.hash='#/carrito'">${I('cart')}<span id="fab-n">Ver mi carro (${count()})</span><b id="fab-t">${M(total())}</b></button>`;
  }
  const secH = (t, sub, link) => `<div class="t-sec-h"><div><h2>${esc(t)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${link ? `<a class="t-more" href="${link}">Mostrar todo <i>${I('right')}</i></a>` : ''}</div>`;
  const fila = list => `<div class="t-row">${list.map(p => Tienda.card(p, cart[p.c] || 0)).join('')}</div>`;
  const ofertas = () => cat.productos.filter(p => p.o).sort((a, b) => Tienda.pct(b) - Tienda.pct(a));
  const top = (s, ...more) => `<div class="t-top"><button class="t-back" onclick="C.atras()" aria-label="Volver">${I('back')}</button>${s}${more.join('')}</div>`;
  const topSearch = q => top(`<form class="t-search" id="h-search" style="height:48px"><input name="q" placeholder="¿Qué estás buscando?" value="${esc(q || '')}" autocomplete="off" enterkeyhint="search"></form>`, `<a class="t-round" href="#/carrito" aria-label="Mi carro">${I('cart')}<span class="n ${count() ? '' : 'hidden'}" data-cartn>${count()}</span></a>`);

  function bindComunes() {
    const f = $('#h-search');
    if (f) f.onsubmit = e => { e.preventDefault(); const q = f.q.value.trim(); go('#/lista?q=' + encodeURIComponent(q)); };
    const cam = $('#h-cam');
    if (cam) cam.onclick = escanear;
    const st = $('#h-store');
    if (st) st.onclick = elegirEntrega;
    $$('.t-tile[data-rubro]').forEach(b => { b.onclick = () => go('#/lista?f=ofertas&r=' + encodeURIComponent(b.dataset.rubro)); });
    $$('[data-go]').forEach(b => { b.onclick = () => go(b.dataset.go); });
    Tienda.activar(app, link => {
      if (!link || link === 'inicio') return;
      if (link === 'ofertas') go('#/lista?f=ofertas');
      else if (link === 'ahorros') go('#/ahorros');
      else go('#/lista?r=' + encodeURIComponent(link));
    });
  }

  function hoja(titulo, html, pie = '') {
    const back = h(`<div class="t-sheet-back"><div class="t-sheet" role="dialog" aria-modal="true"><div class="grab"></div>
      <div class="hd"><h2>${esc(titulo)}</h2><button class="x" aria-label="Cerrar">${I('x')}</button></div><div class="bd">${html}</div>${pie ? `<div class="ft">${pie}</div>` : ''}</div></div>`);
    const close = () => back.remove();
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('.x')) close(); });
    document.body.append(back);
    return { el: back, close };
  }

  function elegirEntrega() {
    const pf = perfil();
    const s = hoja('¿Cómo querés recibir tu pedido?', `
      <label class="opt"><input type="radio" name="ent" value="retiro" ${pf.entrega !== 'envio' ? 'checked' : ''}> <span><b>Retiro en el local</b><br><small class="muted">${esc(cat.negocio.direccion || 'Te avisamos cuando está listo')}</small></span></label>
      <label class="opt"><input type="radio" name="ent" value="envio" ${pf.entrega === 'envio' ? 'checked' : ''}> <span><b>Envío a domicilio</b><br><small class="muted">Coordinamos el envío por WhatsApp</small></span></label>
      <div class="t-form" id="ent-dir"><label><span>Dirección de entrega</span><input name="dir" value="${esc(pf.direccion || '')}" placeholder="Calle, número, piso"></label></div>`,
    '<button class="t-btn" id="ent-ok">Confirmar</button>');
    const sync = () => { $('#ent-dir', s.el).style.display = $('[name=ent]:checked', s.el).value === 'envio' ? '' : 'none'; };
    $$('[name=ent]', s.el).forEach(r => { r.onchange = sync; });
    sync();
    $('#ent-ok', s.el).onclick = () => { ls.set('perfil', { ...perfil(), entrega: $('[name=ent]:checked', s.el).value, direccion: $('[name=dir]', s.el).value.trim() }); s.close(); render(); };
  }

  function escanear() {
    Scanner.open({
      title: 'Consultá un precio', continuous: true,
      hint: '<p class="muted small">Apuntá al código de barras del producto.</p>',
      onScan: (code, m) => {
        const p = byCode(code);
        if (!p) return `<div class="bad-line">Ese producto no está en el catálogo online (${esc(code)})</div>`;
        m.close(); go('#/p/' + encodeURIComponent(p.c)); return '';
      },
    });
  }

  /* ---------- Pantallas ---------- */
  function inicio() {
    const a = cat.app || {};
    const banners = a.banners && a.banners.length ? a.banners : [];
    const stories = [
      ['Ofertas', '🏷️', '#/lista?f=ofertas'], ['Promos de pago', '💳', '#/ahorros'], ['Bebidas frías', '🧊', '#/lista?r=Bebidas'],
      ['Golosinas', '🍫', '#/lista?r=Golosinas'], ['Para el mate', '🧉', '#/lista?r=Almac%C3%A9n'], ['Más vendidos', '⭐', '#/lista?f=top'], ['Envíos', '🛵', 'envio'],
    ];
    const destac = cat.productos.filter(p => p.d);
    const rubrosTop = cat.rubros.filter(r => cat.productos.filter(p => p.r === r).length >= 3).slice(0, 3);
    app.innerHTML = cabecera() + (a.aviso ? `<div class="t-strip">${esc(a.aviso)}</div>` : '') + `<main class="t-main" style="padding-top:16px">
      ${banners.length ? Tienda.carousel(banners) : ''}
      <div class="t-stories">${stories.map(([l, e, g]) => `<button class="t-story" data-go="${g === 'envio' ? '' : g}" ${g === 'envio' ? 'id="st-envio"' : ''}><div class="ring"><div class="in" style="background:#fff8db"><img src="${Tienda.img3d(e)}" alt=""></div></div><span>${l}</span></button>`).join('')}</div>
      <section class="t-sec">${secH('Explorá nuestras categorías', 'Elegí, comprá y disfrutá', '#/categorias')}
        <div class="t-cats">${cat.rubros.map(r => `<a class="t-cat" href="#/lista?r=${encodeURIComponent(r)}"><div class="sq"><img src="${Tienda.img3d(Catalogo.EMO[r] || '📦')}" alt=""></div><span>${esc(r)}</span></a>`).join('')}</div></section>
      ${ofertas().length ? `<section class="t-sec">${secH('Ofertas de la semana', '¡Llená el carrito!', '#/lista?f=ofertas')}${fila(ofertas().slice(0, 12))}</section>` : ''}
      ${ofertas().length ? `<section class="t-sec"><div class="t-tiles">${Tienda.mosaico(cat.productos)}</div></section>` : ''}
      ${destac.length ? `<section class="t-sec">${secH('Los más pedidos', 'Los favoritos del barrio', '#/lista?f=top')}${fila(destac)}</section>` : ''}
      ${rubrosTop.map(r => `<section class="t-sec">${secH(r, 'Siempre a mano', '#/lista?r=' + encodeURIComponent(r))}${fila(cat.productos.filter(p => p.r === r).slice(0, 12))}</section>`).join('')}
      <p class="t-foot-note">${cat.actualizado ? 'Precios actualizados el ' + fechaHora(cat.actualizado) + '. ' : ''}Precios sujetos a cambio y disponibilidad. Las imágenes son ilustrativas.</p>
    </main>` + nav('inicio');
    bindComunes();
    const se = $('#st-envio');
    if (se) se.onclick = elegirEntrega;
  }

  function categorias() {
    app.innerHTML = `<div class="t-head"><form class="t-bar" id="h-search" style="padding-top:12px"><label class="t-search">${I('search')}<input name="q" placeholder="¿Qué estás buscando?" autocomplete="off" enterkeyhint="search"></label></form></div>
      <div class="t-white" style="padding:16px;border-bottom:1px solid var(--line)">Explorá por categoría</div>
      <main class="t-main" style="padding-top:0"><div class="t-catgrid">
        <a class="t-cat" href="#/lista?f=ofertas"><div class="sq"><img src="${Tienda.img3d('🏷️')}" alt=""></div><span>Ofertas</span></a>
        ${cat.rubros.map(r => `<a class="t-cat" href="#/lista?r=${encodeURIComponent(r)}"><div class="sq"><img src="${Tienda.img3d(Catalogo.EMO[r] || '📦')}" alt=""></div><span>${esc(r)}</span></a>`).join('')}
      </div></main>` + nav('categorias');
    bindComunes();
  }

  function ahorros() {
    const a = cat.app || {}, promos = a.promosPago || [];
    const p0 = promos[0];
    app.innerHTML = cabecera() + `<div class="t-white" style="padding:14px 16px;font-size:19px;border-bottom:1px solid var(--line)">Ahorros</div><main class="t-main">
      ${p0 ? `<div class="t-paybar"><b>${esc((p0.titulo.match(/\d+%/) || [''])[0] || '💳')}</b><span><small>${esc(p0.dia)}</small>${esc(p0.titulo.replace(/\d+%/, '').trim())}<br>${esc(p0.sub)}</span><em>Ver promos</em></div>` : ''}
      ${a.banners && a.banners.length ? `<div style="margin-top:18px">${Tienda.carousel(a.banners)}</div>` : ''}
      ${ofertas().length ? `<section class="t-sec">${secH('Imperdibles de la semana', '¡Aprovechalos!', '#/lista?f=ofertas')}${fila(ofertas().slice(0, 10))}</section>
        <section class="t-sec"><div class="t-tiles">${Tienda.mosaico(cat.productos)}</div></section>` : ''}
      ${promos.length ? `<section class="t-sec">${secH('Promos con medios de pago', 'Válidas en el local y en pedidos online')}<div class="t-pays">${promos.map(x => `<div class="t-pay"><img src="${Tienda.img3d(x.emoji || '💳')}" alt=""><div><small>${esc(x.dia)}</small><b>${esc(x.titulo)}</b><span>${esc(x.sub)}</span></div></div>`).join('')}</div></section>` : ''}
      ${ofertas().length ? `<section class="t-sec">${secH('Todas las ofertas', `${ofertas().length} productos con descuento`)}<div class="t-grid t-white">${ofertas().map(p => Tienda.card(p, cart[p.c] || 0)).join('')}</div></section>` : ''}
    </main>` + nav('ahorros');
    bindComunes();
    const pb = $('.t-paybar');
    if (pb) pb.onclick = () => $('.t-pays') && $('.t-pays').scrollIntoView({ behavior: 'smooth' });
  }

  function lista() {
    const q = ruta().q;
    const texto = q.get('q') || '', rub = q.get('r') || '', f = q.get('f') || '';
    const w = norm(texto).split(/\s+/).filter(Boolean);
    let list = cat.productos.filter(p => (!rub || p.r === rub) && (f !== 'ofertas' || p.o) && (f !== 'top' || p.d) && w.every(x => norm(`${p.n} ${p.m} ${p.r} ${p.c}`).includes(x)));
    if (orden === 'menor') list.sort((a, b) => a.p - b.p);
    else if (orden === 'mayor') list.sort((a, b) => b.p - a.p);
    else if (orden === 'desc') list.sort((a, b) => Tienda.pct(b) - Tienda.pct(a));
    else if (f === 'ofertas') list.sort((a, b) => Tienda.pct(b) - Tienda.pct(a));
    const base = f ? `f=${f}&` : '';
    const chips = [['', 'Todos'], ...cat.rubros.filter(r => !f || cat.productos.some(p => p.r === r && (f !== 'ofertas' || p.o) && (f !== 'top' || p.d))).map(r => [r, f === 'ofertas' ? `Ofertas en ${r}` : r])];
    app.innerHTML = topSearch(texto) + `<div class="t-chips">${chips.map(([r, l]) => `<button class="${r === rub ? 'on' : ''}" data-go="#/lista?${base}${r ? 'r=' + encodeURIComponent(r) : ''}${texto ? '&q=' + encodeURIComponent(texto) : ''}">${esc(l)}</button>`).join('')}</div>
      <div class="t-res"><span>${f === 'ofertas' ? 'Ofertas' : f === 'top' ? 'Más vendidos' : 'Resultados'} (${list.length})</span><button id="ordenar">${I('grid')} Ordenar ${I('down')}</button></div>
      <main class="t-main" style="padding-top:0">${list.length ? `<div class="t-grid t-white">${list.map(p => Tienda.card(p, cart[p.c] || 0)).join('')}</div>`
        : `<div class="t-empty"><img src="${Tienda.img3d('🛒')}" alt=""><h2>No encontramos productos</h2><p>Probá con otra palabra o explorá las categorías.</p></div>`}</main>` + nav(f === 'ofertas' ? 'ahorros' : 'categorias');
    bindComunes();
    const inp = $('#h-search input');
    inp.addEventListener('input', () => { clearTimeout(lista.t); lista.t = setTimeout(() => { history.replaceState(null, '', `#/lista?${base}${rub ? 'r=' + encodeURIComponent(rub) + '&' : ''}q=${encodeURIComponent(inp.value)}`); render(); const i2 = $('#h-search input'); i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); }, 300); });
    $('#ordenar').onclick = () => Pick.open({
      title: 'Ordenar por', value: orden,
      options: [{ value: 'rel', label: 'Relevancia' }, { value: 'menor', label: 'Menor precio' }, { value: 'mayor', label: 'Mayor precio' }, { value: 'desc', label: 'Mayor descuento' }],
      onPick: v => { orden = v; render(); },
    });
  }

  function producto() {
    const p = byCode(ruta().id);
    if (!p) { app.innerHTML = topSearch('') + `<div class="t-empty"><img src="${Tienda.img3d('🔎')}" alt="" onerror="this.remove()"><h2>Producto no disponible</h2></div>`; bindComunes(); return; }
    const q = cart[p.c] || 0;
    const c = Tienda.contenido(p.n);
    const rel = cat.productos.filter(x => x.r === p.r && x.c !== p.c).slice(0, 10);
    app.innerHTML = topSearch('') + `<main style="padding-bottom:190px">
      <div class="pd-img"><img src="${esc(Tienda.foto(p))}" alt="${esc(p.n)}" class="${p.i ? 'real' : ''}"><button class="t-round share" id="pd-share" aria-label="Compartir">${I('share')}</button></div>
      <div class="pd-info">${p.m ? `<small>${esc(p.m)}</small>` : ''}<h1>${esc(p.n)}</h1><p>Código: ${esc(p.c)}${p.o && p.h ? ` · Oferta válida hasta el ${fechaISO(p.h)}` : ''}</p></div>
      <div class="t-acc"><h3>Información del producto</h3>
        <details><summary>Detalles ${I('right')}</summary><div class="body">Categoría: ${esc(p.r)}${p.m ? `<br>Marca: ${esc(p.m)}` : ''}${c ? `<br>Contenido: ${esc(c.txt)}` : ''}${p.k ? '<br>Se vende por peso: elegí la cantidad en kg.' : ''}<br>${p.s ? '✅ Disponible en el local' : '⚠️ Consultá disponibilidad por WhatsApp'}</div></details>
        <details><summary>Cómo comprar ${I('right')}</summary><div class="body">Agregalo al carro, completá tus datos y enviá el pedido por WhatsApp. Te avisamos cuando está listo para retirar o sale para tu casa.</div></details>
        <details><summary>Medios de pago ${I('right')}</summary><div class="body">Efectivo, débito, crédito, QR o transferencia${cat.negocio.alias ? ` (alias <b>${esc(cat.negocio.alias)}</b>)` : ''}.</div></details>
      </div>
      ${rel.length ? `<section class="t-sec">${secH('Recomendados para vos', '', '#/lista?r=' + encodeURIComponent(p.r))}${fila(rel)}</section>` : ''}
    </main>
    <div class="pd-bar"><div class="pr"><b>${M(p.p)}</b>${p.o ? `<span class="pc-pct">${Tienda.pct(p)}%</span>` : ''}${p.k ? '<small>por kg</small>' : ''}</div>
      <div class="pr2">${p.o ? `<s>${M(p.o)}</s>` : ''}<small>${esc(Tienda.unidad(p))}</small></div>
      ${q ? `<div class="t-stepper"><button class="${q <= paso(p) ? 'del' : ''}" data-dec="${esc(p.c)}" aria-label="Quitar">${q <= paso(p) ? I('trash') : I('minus')}</button><b>${fmtN(q, 3)}${p.k ? ' kg' : ''}</b><button data-inc="${esc(p.c)}" aria-label="Agregar">${I('plus')}</button></div>`
        : `<button class="t-btn" data-add="${esc(p.c)}">Agregar al carro</button>`}</div>`;
    bindComunes();
    $('#pd-share').onclick = () => {
      const url = location.href;
      if (navigator.share) navigator.share({ title: p.n, text: `${p.n} a ${M(p.p)} en ${cat.negocio.nombre || 'el kiosco'}`, url }).catch(() => {});
      else { navigator.clipboard?.writeText(url); UI.toast('Enlace copiado', 'ok'); }
    };
  }

  function carrito() {
    const its = items();
    const head = top('<h1>Mi carro</h1>', its.length ? '<button class="link" id="ct-vaciar">Vaciar</button>' : '');
    if (!its.length) {
      app.innerHTML = head + `<div class="t-empty"><img src="${Tienda.img3d('🛒')}" alt=""><h2>Tu carro está vacío</h2><p>Mirá las ofertas de la semana y empezá tu pedido.</p><button class="t-btn" style="max-width:320px;margin:20px auto 0" data-go="#/inicio">Ver productos</button></div>`;
      bindComunes();
      return;
    }
    const reemp = ls.get('reemplazo', 'similar');
    const RE = { similar: 'Reemplazar por uno similar', avisar: 'Avisarme por WhatsApp', no: 'No reemplazar' };
    app.innerHTML = head + `<div class="ct-count">${its.length} producto${its.length > 1 ? 's' : ''}</div>
      ${its.map(({ p, n }) => `<div class="ct-item"><div class="im"><img src="${esc(Tienda.foto(p))}" alt=""></div>
        <div><b>${esc(p.n)}</b><small>${esc(Tienda.contenido(p.n)?.txt || (p.k ? 'por kg' : p.m || ''))}</small>${notas[p.c] ? `<br><small>📝 ${esc(notas[p.c])}</small>` : ''}</div>
        <div class="pr"><b>${M(p.p * n)}</b>${p.o ? `<br><s>${M(p.o * n)}</s>` : ''}</div>
        <div class="ctl"><div class="t-stepper sm"><button class="${n <= paso(p) ? 'del' : ''}" data-dec="${esc(p.c)}" aria-label="Quitar">${n <= paso(p) ? I('trash') : I('minus')}</button><b>${fmtN(n, 3)}${p.k ? ' kg' : ''}</b><button data-inc="${esc(p.c)}" aria-label="Agregar">${I('plus')}</button></div>
          <button class="ct-note" data-nota="${esc(p.c)}" aria-label="Agregar una nota">${I('note')}</button></div></div>`).join('')}
      <button class="ct-opt" id="ct-reemp"><span class="ico">${I('swap')}</span><span style="flex:1"><b>¿Qué hacemos si un producto está agotado?</b><span>${RE[reemp]}</span></span>${I('right')}</button>
      <div style="height:280px"></div>
      <div class="ct-sum">${ahorro() ? `<div class="ct-disc"><span>Descuentos</span><b style="color:var(--off-ink)">-${M(ahorro())}</b></div>` : ''}
        <div class="ct-tot"><span>Total</span><span>${M(total())}</span></div>
        <div class="ct-info"><i>i</i>El costo de envío se coordina por WhatsApp</div>
        <button class="t-btn" data-go="#/checkout">Continuar con el pedido</button></div>`;
    bindComunes();
    $('#ct-vaciar').onclick = async () => { if (await UI.confirm('¿Vaciar el carro?', { ok: 'Vaciar', danger: true })) { cart = {}; notas = {}; ls.set('cart', cart); ls.set('notas', notas); render(); } };
    $$('[data-nota]').forEach(b => {
      b.onclick = async () => {
        const c = b.dataset.nota;
        const t = await UI.prompt('Nota para este producto', { label: 'Ej: bien fría, sabor naranja, sin cortar…', value: notas[c] || '' });
        if (t == null) return;
        if (t.trim()) notas[c] = t.trim(); else delete notas[c];
        ls.set('notas', notas); render();
      };
    });
    $('#ct-reemp').onclick = () => {
      const s = hoja('Si un producto está agotado…', Object.entries(RE).map(([k, l]) => `<label class="opt"><input type="radio" name="re" value="${k}" ${k === reemp ? 'checked' : ''}> ${l}</label>`).join(''), '<button class="t-btn" id="re-ok">Guardar</button>');
      $('#re-ok', s.el).onclick = () => { ls.set('reemplazo', $('[name=re]:checked', s.el).value); s.close(); render(); };
    };
    /* "¿Querés agregar algo más?" una vez por sesión */
    const sug = ofertas().filter(p => !cart[p.c]).slice(0, 10);
    if (sug.length && !sessionStorage.getItem('cliente:upsell')) {
      sessionStorage.setItem('cliente:upsell', '1');
      const s = hoja('¿Querés agregar algo más?', fila(sug), '<button class="t-btn" id="up-ok">Ir a pagar</button>');
      $('#up-ok', s.el).onclick = () => { s.close(); go('#/checkout'); };
      s.el.addEventListener('click', e => { if (e.target.closest('.pc[data-p]') && !e.target.closest('[data-stop],[data-add]')) s.close(); });
    }
  }

  function checkout() {
    const its = items();
    if (!its.length) return go('#/carrito');
    const pf = perfil();
    const medios = ['Efectivo', 'Transferencia', 'QR / billetera virtual', 'Débito', 'Crédito', 'Cuenta corriente (fiado)'];
    app.innerHTML = top('<h1>Finalizar pedido</h1>') + `<main class="t-main" style="padding-top:0"><form class="t-form t-white" id="ck" style="border-bottom:1px solid var(--line)">
        <div><span style="display:block;font-size:14px;font-weight:500;margin-bottom:8px">¿Cómo lo recibís?</span><div class="t-seg">
          <label><input type="radio" name="entrega" value="retiro" ${pf.entrega !== 'envio' ? 'checked' : ''}>🏪 Retiro en el local</label>
          <label><input type="radio" name="entrega" value="envio" ${pf.entrega === 'envio' ? 'checked' : ''}>🛵 Envío a domicilio</label></div></div>
        <label><span>Nombre y apellido *</span><input name="nombre" value="${esc(pf.nombre || '')}" autocomplete="name"></label>
        <label><span>Teléfono *</span><input name="tel" value="${esc(pf.tel || '')}" inputmode="tel" autocomplete="tel"></label>
        <label id="ck-dir"><span>Dirección de entrega *</span><input name="direccion" value="${esc(pf.direccion || '')}" autocomplete="street-address"></label>
        <label><span>¿Cómo pagás?</span><select name="pago">${opts(medios, pf.pago || 'Efectivo')}</select></label>
        <label><span>Nota para el kiosco</span><textarea name="nota" rows="2" placeholder="Ej: cambio de $10.000, timbre B…"></textarea></label>
      </form>
      <div class="t-acc"><h3>Resumen</h3><div class="body" style="padding-top:14px">${its.map(({ p, n }) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0"><span>${fmtN(n, 3)} × ${esc(p.n)}</span><b>${M(p.p * n)}</b></div>`).join('')}
        ${ahorro() ? `<div style="display:flex;justify-content:space-between;padding:8px 0 0;color:var(--off-ink)"><span>Ahorrás</span><b>-${M(ahorro())}</b></div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:10px 0 0;font-size:18px"><b>Total</b><b>${M(total())}</b></div></div></div>
      <div class="t-pad"><button class="t-btn dark" id="ck-send">💬 Enviar pedido por WhatsApp</button>
      ${cat.negocio.alias ? `<p class="t-foot-note">Alias para transferir: <b>${esc(cat.negocio.alias)}</b></p>` : ''}</div></main>`;
    const form = $('#ck');
    const sync = () => { $('#ck-dir').style.display = $('[name=entrega]:checked', form).value === 'envio' ? '' : 'none'; };
    $$('[name=entrega]', form).forEach(r => { r.onchange = sync; });
    sync();
    $('#ck-send').onclick = () => enviar(form, its);
  }

  function enviar(form, its) {
    const f = UI.formData(form);
    f.entrega = $('[name=entrega]:checked', form).value;
    if (!f.nombre || !f.tel) return UI.toast('Completá tu nombre y teléfono', 'warn');
    if (f.entrega === 'envio' && !f.direccion) return UI.toast('Indicá la dirección de entrega', 'warn');
    ls.set('perfil', { ...perfil(), nombre: f.nombre, tel: f.tel, direccion: f.direccion, pago: f.pago, entrega: f.entrega });
    const reemp = { similar: 'reemplazar por uno similar', avisar: 'avisarme antes', no: 'no reemplazar' }[ls.get('reemplazo', 'similar')];
    const nota = [f.nota, `Si falta algo: ${reemp}`].filter(Boolean).join(' · ');
    const payload = { v: 1, f: Date.now(), n: f.nombre, t: f.tel, d: f.direccion, e: f.entrega, pg: f.pago, o: nota, i: its.map(({ p, n }) => [p.c, n, p.n]) };
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const txt = `¡Hola ${cat.negocio.nombre || ''}! Quiero hacer este pedido 🛒\n\n${its.map(({ p, n }) => `• ${fmtN(n, 3)}${p.k ? ' kg' : ''} x ${p.n} (${M(p.p * n)})${notas[p.c] ? ` — ${notas[p.c]}` : ''}`).join('\n')}\n\nTotal estimado: ${M(total())}${ahorro() ? ` (ahorro ${M(ahorro())})` : ''}\n${f.entrega === 'envio' ? `🛵 Envío a: ${f.direccion}` : '🏪 Retiro en el local'}\n💳 Pago: ${f.pago}\n👤 ${f.nombre} · ${f.tel}\n📝 ${nota}\n\n[[PEDIDO:${code}]]`;
    const hist = ls.get('pedidos', []);
    hist.unshift({ fecha: Date.now(), items: its.map(({ p, n }) => ({ c: p.c, n: p.n, cant: n, p: p.p })), total: total(), entrega: f.entrega });
    ls.set('pedidos', hist.slice(0, 30));
    const wa = Catalogo.waNumero(cat.negocio.whatsapp);
    cart = {}; notas = {}; ls.set('cart', cart); ls.set('notas', notas);
    if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(txt)}`, '_blank');
    else {
      navigator.clipboard?.writeText(txt);
      UI.modal({ title: 'Pedido listo', body: `<p>El kiosco todavía no cargó su WhatsApp. Copiamos tu pedido: pegalo en un mensaje al local.</p><textarea class="input" rows="8" readonly>${esc(txt)}</textarea>`, actions: [{ label: 'Listo', class: 'primary' }] });
    }
    go('#/pedidos');
    UI.toast('¡Pedido generado! Confirmalo enviando el mensaje de WhatsApp.', 'ok', 5000);
  }

  function cuenta() {
    const pf = perfil(), n = cat.negocio;
    const wa = Catalogo.waNumero(n.whatsapp);
    app.innerHTML = `<div class="t-white" style="padding:calc(18px + env(safe-area-inset-top)) 20px 18px;font-size:28px;font-weight:500">Mi cuenta</div><main class="t-main" style="padding-top:0">
      <div class="ac-hello"><div class="top"><span class="av">${pf.nombre ? esc(pf.nombre.trim()[0].toUpperCase()) : '👋'}</span><div><b>¡Hola${pf.nombre ? ', ' + esc(pf.nombre.split(' ')[0].toUpperCase()) : ''}!</b><span>Podés gestionar tus datos y pedidos desde acá.</span></div></div>
        <div class="ac-promo"><img src="${Tienda.img3d('🎁')}" alt=""><div><b>Compartí la app<br>con tus vecinos</b><button id="ac-share">COMPARTIR</button></div></div></div>
      <div class="t-acc"><h3>Mi perfil</h3>
        <a class="row" href="#/datos">${I('user')}<span>Datos personales</span>${I('right')}</a>
        <button class="row" id="ac-dir">${I('pin')}<span>Mis direcciones</span>${I('right')}</button>
        <a class="row" href="#/pedidos">${I('bag')}<span>Mis pedidos</span>${I('right')}</a></div>
      <div class="t-acc"><h3>Soporte</h3>
        <a class="row" target="_blank" rel="noopener" href="${n.direccion ? 'https://maps.google.com/?q=' + encodeURIComponent(n.direccion) : 'index.html#contacto'}">${I('store')}<span>Nuestro local</span>${I('share')}</a>
        <a class="row" target="_blank" rel="noopener" href="${wa ? 'https://wa.me/' + wa : 'index.html#contacto'}">${I('chat')}<span>Escribinos por WhatsApp</span>${I('share')}</a></div>
      <div class="t-acc"><h3>Más información</h3>
        <button class="row" id="ac-como">${I('info')}<span>Cómo comprar</span>${I('right')}</button>
        <button class="row" id="ac-tyc">${I('doc')}<span>Términos y condiciones</span>${I('right')}</button>
        ${installEvt ? `<button class="row" id="ac-inst">${I('download')}<span>Instalar la app</span>${I('right')}</button>` : ''}
        <a class="row" href="index.html">${I('home')}<span>Página del kiosco</span>${I('right')}</a></div>
    </main>` + nav('cuenta');
    $('#ac-dir').onclick = elegirEntrega;
    $('#ac-share').onclick = compartir;
    $('#ac-como').onclick = () => hoja('Cómo comprar', '<ol style="margin:0 16px 10px;line-height:1.7"><li>Buscá o escaneá los productos y agregalos al carro.</li><li>Elegí retiro en el local o envío a domicilio.</li><li>Enviá el pedido por WhatsApp: te confirmamos stock y total.</li><li>Pagá como prefieras al retirar o al recibir.</li></ol>');
    $('#ac-tyc').onclick = () => hoja('Términos y condiciones', '<div style="padding:0 16px 10px;color:#4b5563;line-height:1.6">Precios y promociones sujetos a disponibilidad y válidos hasta agotar stock. Los pedidos se confirman por WhatsApp. Las imágenes son ilustrativas. Venta de bebidas alcohólicas solo a mayores de 18 años.</div>');
    const ins = $('#ac-inst');
    if (ins) ins.onclick = () => { installEvt.prompt(); installEvt = null; render(); };
  }

  function datos() {
    const p = perfil();
    app.innerHTML = top('<h1>Datos personales</h1>') + `<main class="t-main" style="padding-top:0"><form class="t-form t-white" id="dt">
      <label><span>Nombre y apellido</span><input name="nombre" value="${esc(p.nombre || '')}" autocomplete="name"></label>
      <label><span>Teléfono</span><input name="tel" value="${esc(p.tel || '')}" inputmode="tel" autocomplete="tel"></label>
      <label><span>Dirección</span><input name="direccion" value="${esc(p.direccion || '')}" autocomplete="street-address"></label>
      <button class="t-btn" type="submit">Guardar</button><p class="muted small" style="margin:0">Se guardan solo en tu celular para completar tus pedidos más rápido.</p></form></main>`;
    $('#dt').onsubmit = e => { e.preventDefault(); ls.set('perfil', { ...perfil(), ...UI.formData(e.target) }); UI.toast('Datos guardados', 'ok'); atras(); };
  }

  function pedidos() {
    const hist = ls.get('pedidos', []);
    app.innerHTML = top('<h1>Mis pedidos</h1>') + `<main class="t-main" style="padding-top:0">${hist.length ? hist.map((x, i) => `<div class="t-acc"><h3 style="display:flex;justify-content:space-between"><span>${fechaHora(x.fecha)}</span><span>${M(x.total)}</span></h3>
      <div class="body" style="padding-top:12px">${x.items.map(it => `${fmtN(it.cant, 3)} × ${esc(it.n)}`).join('<br>')}<br><br><button class="t-btn" style="height:48px" data-rep="${i}">Repetir pedido</button></div></div>`).join('')
      : `<div class="t-empty"><img src="${Tienda.img3d('🧾')}" alt=""><h2>Todavía no hiciste pedidos</h2><p>Cuando hagas uno, lo vas a ver acá.</p></div>`}</main>`;
    $$('[data-rep]').forEach(b => {
      b.onclick = () => {
        let faltan = 0;
        hist[+b.dataset.rep].items.forEach(x => { if (byCode(x.c)) cart[x.c] = x.cant; else faltan++; });
        ls.set('cart', cart);
        if (faltan) UI.toast(`${faltan} producto(s) ya no están disponibles`, 'warn');
        go('#/carrito');
      };
    });
  }

  function compartir() {
    const url = location.href.split('#')[0];
    if (navigator.share) navigator.share({ title: cat.negocio.nombre, text: '¡Mirá las ofertas y pedí desde el celular!', url }).catch(() => {});
    else { navigator.clipboard?.writeText(url); UI.toast('Enlace copiado', 'ok'); }
  }

  const VISTAS = { inicio, categorias, ahorros, cuenta, lista, p: producto, carrito, checkout, pedidos, datos };
  function render() {
    Tienda.detener();
    $$('.t-sheet-back').forEach(x => x.remove());
    (VISTAS[ruta().v] || inicio)();
  }

  async function init() {
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
    app.innerHTML = `<div class="t-empty"><img src="${Tienda.img3d('🛒')}" alt=""><h2>Cargando ofertas…</h2></div>`;
    try { cat = await Catalogo.cargar(); }
    catch { app.innerHTML = `<div class="t-empty"><img src="${Tienda.img3d('📶')}" alt=""><h2>No pudimos cargar el catálogo</h2><p>Revisá tu conexión e intentá de nuevo.</p></div>`; return; }
    document.title = `${cat.negocio.nombre || 'Kiosco'} · Pedí online`;
    Object.keys(cart).forEach(c => { if (!byCode(c)) delete cart[c]; });
    ls.set('cart', cart);
    render();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  return { init, atras };
})();
C.init();
