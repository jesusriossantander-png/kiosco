/* App de clientes: catálogo, carrito, consulta de precios con la cámara y pedido por WhatsApp */
const C = (() => {
  const EMO = Catalogo.EMO;
  const ls = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('cliente:' + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('cliente:' + k, JSON.stringify(v)); } catch { /* sin espacio */ } },
  };
  let cat = { negocio: {}, rubros: [], productos: [] };
  let cart = ls.get('cart', {});
  let tab = 'inicio', rubro = '', q = '';
  let installEvt = null;
  const view = $('#c-view');
  const byCode = c => cat.productos.find(p => p.c === c);

  const cargar = () => Catalogo.cargar();

  function cartCount() { return Object.keys(cart).length; }
  function cartTotal() { return sum(Object.entries(cart), ([c, n]) => (byCode(c)?.p || 0) * n); }
  function setCant(code, n) {
    n = round3(n);
    if (n <= 0) delete cart[code]; else cart[code] = n;
    ls.set('cart', cart);
    chrome();
  }
  const paso = p => (p.k ? 0.25 : 1);

  function chrome() {
    const n = cartCount();
    const bar = $('#c-cartbar');
    bar.classList.toggle('hidden', !n || tab === 'carrito');
    $('#c-cartn').textContent = `Ver carrito (${n})`;
    $('#c-cartt').textContent = fmt(cartTotal());
    const dot = $('#c-dot');
    dot.classList.toggle('hidden', !n);
    dot.textContent = n;
    $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  }

  function control(p) {
    const n = cart[p.c];
    if (!n) return `<button class="btn primary add" data-add="${esc(p.c)}">Agregar</button>`;
    return `<div class="step"><button data-dec="${esc(p.c)}" aria-label="Menos">−</button><b>${fmtN(n, 3)}${p.k ? ' kg' : ''}</b><button data-inc="${esc(p.c)}" aria-label="Más">+</button></div>`;
  }
  function card(p) {
    return `<div class="pcard" data-card="${esc(p.c)}">${p.s ? '' : '<span class="badge warn out">Consultar</span>'}
      <div class="img">${p.i ? `<img src="${esc(p.i)}" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('${p.e}'))">` : p.e}</div>
      <div class="nm">${esc(p.n)}</div>${p.m ? `<div class="br">${esc(p.m)}</div>` : ''}
      <div class="pr">${fmt(p.p)}${p.k ? '<small> /kg</small>' : ''}</div><div data-ctl="${esc(p.c)}">${control(p)}</div></div>`;
  }
  function refreshCtl(code) {
    const p = byCode(code);
    $$(`[data-ctl="${CSS.escape(code)}"]`).forEach(el => { el.innerHTML = control(p); });
    if (tab === 'carrito') render();
  }
  view.addEventListener('click', e => {
    const a = e.target.closest('[data-add],[data-inc],[data-dec]');
    if (!a) return;
    const code = a.dataset.add || a.dataset.inc || a.dataset.dec;
    const p = byCode(code);
    if (!p) return;
    if (a.dataset.add) { setCant(code, paso(p)); if (navigator.vibrate) navigator.vibrate(20); }
    else if (a.dataset.inc) setCant(code, (cart[code] || 0) + paso(p));
    else setCant(code, (cart[code] || 0) - paso(p));
    refreshCtl(code);
  });

  function filtrar() {
    const w = norm(q).split(/\s+/).filter(Boolean);
    return cat.productos.filter(p => (!rubro || p.r === rubro) && w.every(x => norm(`${p.n} ${p.m} ${p.r} ${p.c}`).includes(x)));
  }

  function inicio() {
    const dest = cat.productos.filter(p => p.d);
    view.innerHTML = `<div class="cli-search"><div class="box"><input id="c-q" placeholder="¿Qué estás buscando?" value="${esc(q)}" autocomplete="off" enterkeyhint="search"><button class="btn" id="c-cam" aria-label="Consultar precio con la cámara">📷</button></div></div>
      ${installEvt ? '<div class="installbar">📲 Instalá la app en tu celular <button class="btn sm primary" id="c-inst">Instalar</button></div>' : ''}
      <div class="chips" id="c-chips"><button class="chip ${!rubro ? 'on' : ''}" data-r="">Todo</button>${cat.rubros.map(r => `<button class="chip ${rubro === r ? 'on' : ''}" data-r="${esc(r)}">${EMO[r] || ''} ${esc(r)}</button>`).join('')}</div>
      ${!q && !rubro && dest.length ? `<div class="sec-t"><h2>⭐ Destacados</h2></div><div class="hscroll">${dest.map(card).join('')}</div>` : ''}
      <div class="sec-t"><h2 id="c-ttl"></h2><small class="muted" id="c-cnt"></small></div><div class="pgrid" id="c-grid"></div>
      <p class="muted small center" style="margin:24px 0">${cat.actualizado ? 'Precios actualizados el ' + fechaHora(cat.actualizado) + '. ' : ''}Los precios pueden variar sin aviso.</p>`;
    const grid = () => {
      const list = filtrar();
      $('#c-ttl').textContent = q ? `Resultados para “${q}”` : rubro || 'Todos los productos';
      $('#c-cnt').textContent = `${list.length} productos`;
      $('#c-grid').innerHTML = list.length ? list.slice(0, 200).map(card).join('') : '<div class="hero-empty" style="grid-column:1/-1"><span>🔎</span>No encontramos productos. Probá con otra palabra.</div>';
    };
    const inp = $('#c-q');
    inp.addEventListener('input', () => { q = inp.value; grid(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
    $$('[data-r]').forEach(b => { b.onclick = () => { rubro = b.dataset.r; q = ''; render(); }; });
    $('#c-cam').onclick = consultar;
    const ib = $('#c-inst');
    if (ib) ib.onclick = async () => { installEvt.prompt(); installEvt = null; render(); };
    grid();
  }

  function consultar() {
    Scanner.open({
      title: 'Consultar precio',
      continuous: true,
      hint: '<p class="muted small">Apuntá al código de barras del producto.</p>',
      onScan: code => {
        const p = byCode(code);
        if (!p) return `<div class="bad-line">✖ Producto no disponible en el catálogo (${esc(code)})</div>`;
        return `<div class="ok-line"><div class="row" style="flex-wrap:nowrap"><span style="font-size:34px">${p.e}</span><div class="grow"><b>${esc(p.n)}</b><br><span style="font-size:22px;font-weight:800">${fmt(p.p)}</span>${p.k ? ' /kg' : ''}</div><button class="btn primary" onclick="C.agregar('${esc(p.c)}', this)">Agregar</button></div></div>`;
      },
    });
  }
  function agregar(code, btn) {
    const p = byCode(code);
    if (!p) return;
    setCant(code, (cart[code] || 0) + paso(p));
    refreshCtl(code);
    if (btn) { btn.textContent = '✔ En el carrito'; btn.disabled = true; }
  }

  function carrito() {
    const items = Object.entries(cart).map(([c, n]) => ({ p: byCode(c), n })).filter(x => x.p);
    if (!items.length) {
      view.innerHTML = '<div class="hero-empty"><span>🛒</span><h2>Tu carrito está vacío</h2><p>Agregá productos desde el inicio.</p><button class="btn primary lg" id="c-go">Ver productos</button></div>';
      $('#c-go').onclick = () => go('inicio');
      return;
    }
    const perfil = ls.get('perfil', {});
    const n = cat.negocio;
    const medios = ['Efectivo', 'Transferencia', 'Mercado Pago', 'Débito', 'Crédito', 'Cuenta corriente (fiado)'];
    view.innerHTML = `<div class="card" style="margin-top:-30px;position:relative;z-index:2"><h2>Tu pedido</h2>
      ${items.map(({ p, n: c }) => `<div class="cline"><span class="e">${p.e}</span><div><b>${esc(p.n)}</b><br><small class="muted">${fmt(p.p)}${p.k ? '/kg' : ' c/u'} · ${fmt(p.p * c)}</small></div><div data-ctl="${esc(p.c)}">${control(p)}</div></div>`).join('')}
      <div class="totals"><div class="big"><span>Total estimado</span><span>${fmt(cartTotal())}</span></div></div></div>
      <div class="card form" id="c-form"><h3>¿Cómo lo recibís?</h3>
        <div class="seg mt"><label><input type="radio" name="entrega" value="retiro" ${perfil.entrega !== 'envio' ? 'checked' : ''}>🏪 Retiro en el local</label><label><input type="radio" name="entrega" value="envio" ${perfil.entrega === 'envio' ? 'checked' : ''}>🛵 Envío a domicilio</label></div>
        <label class="mt"><span>Tu nombre *</span><input name="nombre" value="${esc(perfil.nombre || '')}" autocomplete="name"></label>
        <label><span>Teléfono *</span><input name="tel" value="${esc(perfil.tel || '')}" inputmode="tel" autocomplete="tel"></label>
        <label id="c-dir"><span>Dirección de entrega</span><input name="direccion" value="${esc(perfil.direccion || '')}" autocomplete="street-address"></label>
        <label><span>¿Cómo pagás?</span><select name="pago">${opts(medios, perfil.pago || 'Efectivo')}</select></label>
        <label><span>Nota para el kiosco</span><textarea name="nota" rows="2" placeholder="Ej: la gaseosa bien fría, cambio de $10.000…"></textarea></label>
        <button class="btn primary xl block" id="c-send">💬 Enviar pedido por WhatsApp</button>
        <button class="btn ghost block mt" id="c-vaciar">Vaciar carrito</button>
        ${n.alias ? `<p class="muted small center">Alias para transferir: <b>${esc(n.alias)}</b></p>` : ''}</div>`;
    const form = $('#c-form');
    const syncDir = () => { $('#c-dir').classList.toggle('hidden', $('[name=entrega]:checked', form).value !== 'envio'); };
    $$('[name=entrega]', form).forEach(r => { r.onchange = syncDir; });
    syncDir();
    $('#c-vaciar').onclick = async () => { if (await UI.confirm('¿Vaciar el carrito?')) { cart = {}; ls.set('cart', cart); chrome(); render(); } };
    $('#c-send').onclick = () => enviar(form, items);
  }

  function enviar(form, items) {
    const f = UI.formData(form);
    f.entrega = $('[name=entrega]:checked', form).value;
    if (!f.nombre || !f.tel) return UI.toast('Completá tu nombre y teléfono', 'warn');
    if (f.entrega === 'envio' && !f.direccion) return UI.toast('Indicá la dirección de entrega', 'warn');
    ls.set('perfil', { nombre: f.nombre, tel: f.tel, direccion: f.direccion, pago: f.pago, entrega: f.entrega });
    const payload = { v: 1, f: Date.now(), n: f.nombre, t: f.tel, d: f.direccion, e: f.entrega, pg: f.pago, o: f.nota, i: items.map(({ p, n }) => [p.c, n, p.n]) };
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const total = cartTotal();
    const txt = `¡Hola ${cat.negocio.nombre || ''}! Quiero hacer este pedido 🛒\n\n${items.map(({ p, n }) => `• ${fmtN(n, 3)}${p.k ? ' kg' : ''} x ${p.n} (${fmt(p.p * n)})`).join('\n')}\n\nTotal estimado: ${fmt(total)}\n${f.entrega === 'envio' ? `🛵 Envío a: ${f.direccion}` : '🏪 Retiro en el local'}\n💳 Pago: ${f.pago}\n👤 ${f.nombre} · ${f.tel}${f.nota ? `\n📝 ${f.nota}` : ''}\n\n[[PEDIDO:${code}]]`;
    const hist = ls.get('pedidos', []);
    hist.unshift({ fecha: Date.now(), items: items.map(({ p, n }) => ({ c: p.c, n: p.n, cant: n, p: p.p })), total, entrega: f.entrega });
    ls.set('pedidos', hist.slice(0, 30));
    let wa = String(cat.negocio.whatsapp || '').replace(/\D/g, '');
    if (wa && !wa.startsWith('54')) wa = '549' + wa.replace(/^0/, '');
    cart = {};
    ls.set('cart', cart);
    if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(txt)}`, '_blank');
    else {
      navigator.clipboard?.writeText(txt);
      UI.modal({ title: 'Pedido listo', body: `<p>El kiosco todavía no cargó su WhatsApp. Copiamos tu pedido: pegalo en un mensaje al local.</p><textarea class="input" rows="8" readonly>${esc(txt)}</textarea>`, actions: [{ label: 'Listo', class: 'primary' }] });
    }
    go('pedidos');
    UI.toast('¡Pedido generado! Confirmalo enviando el mensaje de WhatsApp.', 'ok', 5000);
  }

  function pedidos() {
    const hist = ls.get('pedidos', []);
    view.innerHTML = `<div style="margin-top:-30px;position:relative;z-index:2">${hist.length ? hist.map((h, i) => `<div class="pedido-card"><div class="row"><b class="grow">${fechaHora(h.fecha)}</b><b>${fmt(h.total)}</b></div>
      <p class="muted small">${h.items.map(x => `${fmtN(x.cant, 3)} x ${esc(x.n)}`).join(' · ')}</p><button class="btn sm" data-rep="${i}">🔁 Repetir pedido</button></div>`).join('')
      : '<div class="card hero-empty"><span>🧾</span>Todavía no hiciste pedidos.</div>'}</div>`;
    $$('[data-rep]').forEach(b => {
      b.onclick = () => {
        const h = hist[+b.dataset.rep];
        let faltan = 0;
        h.items.forEach(x => { if (byCode(x.c)) cart[x.c] = x.cant; else faltan++; });
        ls.set('cart', cart);
        if (faltan) UI.toast(`${faltan} producto(s) ya no están disponibles`, 'warn');
        go('carrito');
      };
    });
  }

  function perfil() {
    const p = ls.get('perfil', {});
    const n = cat.negocio;
    view.innerHTML = `<div class="card form" style="margin-top:-30px;position:relative;z-index:2"><h2>Mis datos</h2><p class="muted small">Se guardan solo en tu celular para completar tus pedidos más rápido.</p>
      <label><span>Nombre</span><input name="nombre" value="${esc(p.nombre || '')}"></label>
      <label><span>Teléfono</span><input name="tel" value="${esc(p.tel || '')}" inputmode="tel"></label>
      <label><span>Dirección</span><input name="direccion" value="${esc(p.direccion || '')}"></label>
      <button class="btn primary" id="c-psave">Guardar</button></div>
      <div class="card"><h3>${esc(n.nombre || 'El kiosco')}</h3><ul class="list-plain mt">
        ${n.direccion ? `<li><span>📍 ${esc(n.direccion)}</span><a class="btn sm" target="_blank" rel="noopener" href="https://maps.google.com/?q=${encodeURIComponent(n.direccion)}">Mapa</a></li>` : ''}
        ${n.horario ? `<li><span>🕒 ${esc(n.horario)}</span></li>` : ''}
        ${n.telefono ? `<li><span>📞 ${esc(n.telefono)}</span><a class="btn sm" href="tel:${esc(n.telefono)}">Llamar</a></li>` : ''}
        ${n.whatsapp ? `<li><span>💬 WhatsApp</span><a class="btn sm primary" target="_blank" rel="noopener" href="https://wa.me/${String(n.whatsapp).replace(/\D/g, '').replace(/^(?!54)/, '549')}">Escribir</a></li>` : ''}
        ${n.alias ? `<li><span>🏦 Alias: <b>${esc(n.alias)}</b></span><button class="btn sm" id="c-alias">Copiar</button></li>` : ''}
      </ul></div>`;
    $('#c-psave').onclick = () => { ls.set('perfil', { ...p, ...UI.formData(view) }); UI.toast('Datos guardados', 'ok'); };
    const al = $('#c-alias');
    if (al) al.onclick = () => { navigator.clipboard?.writeText(n.alias); UI.toast('Alias copiado', 'ok'); };
  }

  function render() {
    ({ inicio, carrito, pedidos, perfil })[tab]();
    chrome();
  }
  function go(t) { tab = t; render(); window.scrollTo(0, 0); }

  async function init() {
    $$('.tabbar button').forEach(b => { b.onclick = () => go(b.dataset.t); });
    $('#c-cartbar').onclick = () => go('carrito');
    $('#c-share').onclick = () => {
      const url = location.href.split('#')[0];
      if (navigator.share) navigator.share({ title: cat.negocio.nombre, text: '¡Pedí en el kiosco desde el celular!', url }).catch(() => {});
      else { navigator.clipboard?.writeText(url); UI.toast('Enlace copiado', 'ok'); }
    };
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (tab === 'inicio') render(); });
    try {
      cat = await cargar();
    } catch {
      view.innerHTML = '<div class="card hero-empty" style="margin-top:-30px"><span>📡</span>No pudimos cargar el catálogo. Revisá tu conexión e intentá de nuevo.</div>';
      $('#c-nombre').textContent = 'Kiosco';
      return;
    }
    const n = cat.negocio || {};
    $('#c-nombre').textContent = n.nombre || 'Kiosco';
    $('#c-info').textContent = [n.horario, n.direccion].filter(Boolean).join(' · ') || 'Pedí desde tu celular y retirá o recibí en tu casa';
    document.title = `${n.nombre || 'Kiosco'} · Pedí online`;
    Object.keys(cart).forEach(c => { if (!byCode(c)) delete cart[c]; });
    render();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  return { init, agregar };
})();
C.init();
