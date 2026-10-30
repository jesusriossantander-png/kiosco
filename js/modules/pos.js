/* Punto de venta: escaneo, búsqueda, cobro con múltiples medios, ticket y cajón */
const POS = (() => {
  const nuevo = () => ({ items: [], clienteId: null, lista: 0, descPct: 0 });
  let cart = (() => { try { return JSON.parse(sessionStorage.getItem('kiosco:cart')) || nuevo(); } catch { return nuevo(); } })();
  let el = null, sugg = [], sel = 0, lastSale = null, flashIdx = -1;
  const persist = () => sessionStorage.setItem('kiosco:cart', JSON.stringify(cart));

  function totales() {
    const subtotal = round2(cart.items.reduce((a, i) => a + round2(i.cant * i.precio), 0));
    const descuento = round2(subtotal * (cart.descPct || 0) / 100);
    return { subtotal, descuento, total: round2(subtotal - descuento), unidades: cart.items.reduce((a, i) => a + (i.porPeso ? 1 : i.cant), 0) };
  }

  /* Etiquetas de balanza EAN-13: [prefijo][PLU][valor 5 dígitos][verificador] */
  function parseBalanza(code) {
    const b = DB.g.config.balanza;
    if (!b.prefijo || !/^\d{13}$/.test(code) || !code.startsWith(b.prefijo)) return null;
    const plu = parseInt(code.slice(b.prefijo.length, 7), 10);
    const val = parseInt(code.slice(7, 12), 10);
    const p = DB.d.productos.find(x => x.porPeso && x.plu && parseInt(x.plu, 10) === plu);
    if (!p) return null;
    const cant = b.modo === 'precio' ? round3(val / (DB.precio(p, cart.lista) || 1)) : round3(val / 1000);
    return { p, cant };
  }

  function buscar(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return DB.d.productos.filter(p => p.activo !== false && words.every(w => norm(`${p.nombre} ${p.codigo} ${p.rubro} ${p.marca} ${(p.codigosAlt || []).join(' ')}`).includes(w))).slice(0, 25);
  }

  /* Procesa texto del lector o buscador. Soporta "3*codigo" para multiplicar */
  async function procesar(raw) {
    let txt = String(raw).trim();
    if (!txt) return null;
    let mult = 1;
    const m = txt.match(/^(\d+(?:[.,]\d+)?)\s*[*xX]\s*(.+)$/);
    if (m) { mult = num(m[1]); txt = m[2].trim(); }
    const bal = parseBalanza(txt);
    if (bal) return agregar(bal.p, bal.cant);
    const p = DB.porCodigo(txt);
    if (p) return agregar(p, p.porPeso && !m ? null : mult);
    return null;
  }

  function pedirPeso(p) {
    return new Promise(res => {
      let r = null;
      const precio = DB.precio(p, cart.lista);
      const md = UI.modal({
        title: `Peso · ${p.nombre}`,
        body: `<p class="muted">${fmt(precio)} por kg</p>
          <label class="lbl">Peso en kg (ej: 0,250)</label>
          <div class="field-inline"><input id="peso-kg" class="input xl" inputmode="decimal" autofocus><button class="btn lg" id="peso-bal" ${HW.scale ? '' : 'disabled'} title="${HW.scale ? '' : 'Conectá la balanza en Configuración'}">⚖️ Leer</button></div>
          <div class="bills">${[0.1, 0.25, 0.5, 1].map(k => `<button class="btn sm" data-k="${k}">${fmtN(k, 3)} kg</button>`).join('')}</div>
          <p>Importe: <b id="peso-imp">${fmt(0)}</b></p>`,
        actions: [{ label: 'Cancelar' }, { label: 'Agregar', class: 'primary', onClick: (c, root) => { const v = num($('#peso-kg', root).value); if (v <= 0) return false; r = round3(v); } }],
        onClose: () => res(r),
      });
      const inp = $('#peso-kg', md.el);
      const upd = () => { $('#peso-imp', md.el).textContent = fmt(num(inp.value) * precio); };
      inp.addEventListener('input', upd);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && num(inp.value) > 0) { r = round3(num(inp.value)); md.close(); } });
      $$('[data-k]', md.el).forEach(b => { b.onclick = () => { inp.value = String(b.dataset.k).replace('.', ','); upd(); }; });
      const leer = async () => { const w = await HW.leerPeso(); if (w) { inp.value = String(w).replace('.', ','); upd(); } };
      $('#peso-bal', md.el).onclick = leer;
      if (HW.scale) leer();
    });
  }

  async function agregar(p, cant = 1) {
    if (p.porPeso && cant == null) { cant = await pedirPeso(p); if (!cant) return null; }
    const precio = DB.precio(p, cart.lista);
    let idx = p.porPeso ? -1 : cart.items.findIndex(i => i.pid === p.id && !i.manual);
    if (idx >= 0) cart.items[idx].cant = round3(cart.items[idx].cant + cant);
    else {
      cart.items.push({ pid: p.id, codigo: p.codigo, nombre: p.nombre, cant, precio, costo: p.costo || 0, rubro: p.rubro, porPeso: !!p.porPeso });
      idx = cart.items.length - 1;
    }
    const enCarrito = cart.items.filter(i => i.pid === p.id).reduce((a, i) => a + i.cant, 0);
    if (p.stock - enCarrito < 0) {
      if (!DB.g.config.stock.permitirSinStock) {
        cart.items[idx].cant = round3(cart.items[idx].cant - cant);
        if (cart.items[idx].cant <= 0) cart.items.splice(idx, 1);
        UI.toast(`Sin stock de ${p.nombre}`, 'error');
        renderCart();
        return null;
      }
      UI.toast(`Atención: stock insuficiente de ${p.nombre} (quedan ${fmtN(p.stock, 3)})`, 'warn');
    }
    flashIdx = idx;
    persist();
    renderCart();
    return `<div class="ok-line">✔ ${esc(p.nombre)} × ${fmtN(cant, 3)} — ${fmt(precio * cant)}<br><small>Total venta: <b>${fmt(totales().total)}</b> · ${cart.items.length} artículos</small></div>`;
  }

  function renderCart() {
    if (!el) return;
    const box = $('#pos-cart', el);
    const t = totales();
    if (!cart.items.length) box.innerHTML = '<div class="cart-empty"><span>🛒</span>Escaneá o buscá un producto para empezar la venta</div>';
    else {
      box.innerHTML = cart.items.map((i, n) => `<div class="cart-row ${n === flashIdx ? 'flash' : ''}" data-i="${n}">
        <div class="cr-name"><b>${esc(i.nombre)}</b><small>${esc(i.codigo || '')} · <a href="#" data-precio>${fmt(i.precio)}</a>${i.porPeso ? ' /kg' : ' c/u'}</small></div>
        <div class="qty"><button data-dec aria-label="Menos">−</button><input data-q value="${fmtN(i.cant, 3)}" inputmode="decimal" aria-label="Cantidad"><button data-inc aria-label="Más">+</button></div>
        <div class="cr-sub">${fmt(i.cant * i.precio)}</div>
        <button class="icon-btn" data-del aria-label="Quitar">✕</button></div>`).join('');
      flashIdx = -1;
    }
    const cli = cart.clienteId && DB.cliente(cart.clienteId);
    $('#pos-cli', el).innerHTML = cli ? `👤 ${esc(cli.nombre)} <small class="muted">(debe ${fmt(cli.saldo)})</small>` : '👤 Consumidor final';
    $('#pos-tot', el).innerHTML = `<div><span>Artículos</span><span>${fmtN(t.unidades, 3)}</span></div>
      ${t.descuento ? `<div><span>Subtotal</span><span>${fmt(t.subtotal)}</span></div><div><span>Descuento ${cart.descPct}%</span><span>-${fmt(t.descuento)}</span></div>` : ''}
      <div class="big"><span>Total</span><span>${fmt(t.total)}</span></div>`;
    $('#pos-mtot', el).textContent = fmt(t.total);
    $('#pos-last', el).innerHTML = lastSale ? `Última venta #${lastSale.nro}: ${fmt(lastSale.total)}${lastSale.vuelto ? ` · <b>Vuelto ${fmt(lastSale.vuelto)}</b>` : ''}` : '';
  }

  function renderSugg() {
    const box = $('#pos-sugg', el);
    if (!sugg.length) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    box.innerHTML = sugg.map((p, n) => `<button data-n="${n}" class="${n === sel ? 'sel' : ''}"><span>${DB.emoji(p)} ${esc(p.nombre)}</span><b>${fmt(DB.precio(p, cart.lista))}</b><small>${esc(p.codigo)} · ${esc(p.rubro || '')} · stock ${fmtN(p.stock, 3)}</small></button>`).join('');
  }

  function focusQ() { if (el && !isTouch && !$('.modal-back')) $('#pos-q', el).focus(); }

  function renderQuick() {
    const fav = DB.d.productos.filter(p => p.favorito && p.activo !== false);
    let list = fav;
    if (list.length < 8) {
      const cnt = {};
      DB.d.ventas.slice(-300).forEach(v => v.items.forEach(i => { cnt[i.pid] = (cnt[i.pid] || 0) + 1; }));
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([id]) => DB.prod(id)).filter(p => p && !fav.includes(p));
      list = fav.concat(top).slice(0, 12);
    }
    $('#pos-quick', el).innerHTML = list.length ? list.map(p => `<button data-p="${p.id}"><span>${DB.emoji(p)}</span><b>${esc(p.nombre)}</b><small>${fmt(DB.precio(p, cart.lista))}</small></button>`).join('') : '<p class="muted small">Marcá productos como "favoritos" para verlos acá.</p>';
  }

  function elegirCliente() {
    const body = h(`<div><input class="input lg" id="cl-q" placeholder="Buscar cliente…" autofocus><div id="cl-list" class="mt"></div></div>`);
    const md = UI.modal({
      title: 'Cliente de la venta', body,
      actions: [{ label: 'Consumidor final', onClick: () => { cart.clienteId = null; cart.lista = 0; aplicarLista(); } }, { label: '+ Nuevo cliente', onClick: () => { Clientes.editar(null, c => { cart.clienteId = c.id; aplicarLista(c.lista || 0); }); } }],
    });
    const draw = () => {
      const q = norm($('#cl-q', body).value);
      const list = DB.d.clientes.filter(c => !q || norm(c.nombre + ' ' + c.dni + ' ' + c.tel).includes(q)).slice(0, 30);
      $('#cl-list', body).innerHTML = list.length ? `<ul class="list-plain">${list.map(c => `<li class="click" style="cursor:pointer" data-c="${c.id}"><span><b>${esc(c.nombre)}</b><br><small class="muted">${esc(DB.g.config.listas[c.lista || 0])}</small></span><span class="${c.saldo > 0 ? 'danger-t' : ''}">${fmt(c.saldo)}</span></li>`).join('')}</ul>` : UI.empty('Sin resultados');
      $$('[data-c]', body).forEach(li => { li.onclick = () => { const c = DB.cliente(li.dataset.c); cart.clienteId = c.id; aplicarLista(c.lista || 0); md.close(); }; });
    };
    $('#cl-q', body).addEventListener('input', draw);
    draw();
  }

  function aplicarLista(n) {
    if (n != null) cart.lista = +n;
    cart.items.forEach(i => { const p = DB.prod(i.pid); if (p && !i.manual) i.precio = DB.precio(p, cart.lista); });
    persist();
    if (el) { $('#pos-lista', el).value = cart.lista; renderCart(); renderQuick(); }
  }

  async function importeLibre() {
    const v = await UI.prompt('Importe libre', { label: 'Monto del artículo "Varios"', inputmode: 'decimal' });
    if (v == null || num(v) <= 0) return;
    cart.items.push({ pid: null, codigo: '', nombre: 'Varios', cant: 1, precio: round2(num(v)), costo: 0, rubro: 'Varios', manual: true });
    persist(); renderCart(); focusQ();
  }

  function cobrar() {
    if (!cart.items.length) { UI.toast('No hay productos en la venta', 'warn'); return; }
    if (!Caja.actual()) { Caja.abrirModal(() => { App.refresh(); setTimeout(cobrar, 50); }); return; }
    const { total } = totales();
    const cfg = DB.g.config;
    const medios = cfg.medios.filter(m => m.activo !== false);
    const pagos = [];
    let medio = 'efectivo';
    const body = h(`<div class="checkout">
      <div class="co-total"><small>Total a cobrar</small><div id="co-tot"></div></div>
      <div class="medios">${medios.map(m => `<button class="medio" data-m="${m.id}" type="button"><span>${m.icon}</span>${esc(m.nombre)}</button>`).join('')}</div>
      <div id="co-pagos" class="pagos-list"></div>
      <div id="co-det"></div>
      <label class="check"><input type="checkbox" id="co-print" ${cfg.ticket.imprimir === 'siempre' ? 'checked' : ''} ${cfg.ticket.imprimir === 'nunca' ? 'disabled' : ''}> Mostrar / imprimir ticket</label>
    </div>`);
    const resto = () => round2(total - sum(pagos, p => p.monto));
    const draw = () => {
      const r = resto();
      $('#co-tot', body).innerHTML = fmt(total) + (pagos.length ? `<small>Resta ${fmt(r)}</small>` : '');
      $$('.medio', body).forEach(b => b.classList.toggle('sel', b.dataset.m === medio));
      $('#co-pagos', body).innerHTML = pagos.map((p, n) => `<div><span>${esc(medioNombre(p.medio))}</span><span>${fmt(p.monto)} <button class="icon-btn" data-rp="${n}" aria-label="Quitar">✕</button></span></div>`).join('');
      $$('[data-rp]', body).forEach(b => { b.onclick = () => { pagos.splice(+b.dataset.rp, 1); draw(); }; });
      const det = $('#co-det', body);
      if (medio === 'efectivo') {
        const bills = [...new Set([1000, 2000, 5000, 10000, 20000].map(d => Math.ceil(r / d) * d).filter(x => x > r))].slice(0, 4);
        det.innerHTML = `<label class="lbl">Recibido en efectivo</label><input id="co-rec" class="input xl" inputmode="decimal" value="${String(r).replace('.', ',')}">
          <div class="bills"><button class="btn sm" data-b="${r}">Justo</button>${bills.map(b => `<button class="btn sm" data-b="${b}">${fmt(b)}</button>`).join('')}</div>
          <div class="vuelto" id="co-vuelto"></div>`;
        const rec = $('#co-rec', det);
        const upd = () => {
          const d = round2(num(rec.value) - r);
          const vb = $('#co-vuelto', det);
          vb.className = 'vuelto' + (d < 0 ? ' neg' : '');
          vb.innerHTML = d >= 0 ? `Vuelto: <b>${fmt(d)}</b>` : `Pago parcial — faltan ${fmt(-d)} con otro medio`;
        };
        rec.addEventListener('input', upd);
        $$('[data-b]', det).forEach(b => { b.onclick = () => { rec.value = String(b.dataset.b).replace('.', ','); upd(); }; });
        upd();
        setTimeout(() => { if (!isTouch) { rec.focus(); rec.select(); } });
      } else {
        let extra = '';
        if (medio === 'fiado') {
          const c = cart.clienteId && DB.cliente(cart.clienteId);
          extra = c ? `<div class="banner ${c.limite && c.saldo + r > c.limite ? 'danger' : 'info'}">📒 ${esc(c.nombre)} · Debe ${fmt(c.saldo)} · Límite ${c.limite ? fmt(c.limite) : 'sin límite'}${c.limite ? ` · Disponible ${fmt(Math.max(0, c.limite - c.saldo))}` : ''}</div>`
            : '<div class="banner warn">Para fiar elegí un cliente <button class="btn sm" id="co-cli" type="button">Elegir cliente</button></div>';
        }
        if (medio === 'qr') extra = `<div class="center"><div class="qr-box" id="co-qr"></div><p class="muted small">${cfg.negocio.mpLink ? 'Escaneá con Mercado Pago u otra billetera' : 'Configurá tu link de pago o alias en Configuración → Negocio'}${cfg.negocio.alias ? ` · Alias: <b>${esc(cfg.negocio.alias)}</b>` : ''}</p></div>`;
        if (medio === 'transferencia' && cfg.negocio.alias) extra = `<div class="banner info">Alias / CBU: <b>${esc(cfg.negocio.alias)}</b></div>`;
        det.innerHTML = `${extra}<label class="lbl">Monto con ${esc(medioNombre(medio))}</label><input id="co-monto" class="input xl" inputmode="decimal" value="${String(r).replace('.', ',')}">`;
        if (medio === 'qr' && (cfg.negocio.mpLink || cfg.negocio.alias)) UI.qr($('#co-qr', det), cfg.negocio.mpLink || cfg.negocio.alias, 170);
        const cb = $('#co-cli', det);
        if (cb) cb.onclick = () => { md.close(); elegirCliente(); };
        setTimeout(() => { const i = $('#co-monto', det); if (i && !isTouch) { i.focus(); i.select(); } });
      }
    };
    $$('.medio', body).forEach(b => { b.onclick = () => { medio = b.dataset.m; draw(); }; });

    const confirmar = async () => {
      const r = resto();
      let recibido = 0, vuelto = 0;
      if (r > 0) {
        if (medio === 'efectivo') {
          recibido = num($('#co-rec', body).value);
          if (recibido <= 0) return false;
          const aplica = Math.min(recibido, r);
          vuelto = round2(recibido - aplica);
          pagos.push({ medio, monto: round2(aplica) });
        } else {
          const monto = Math.min(num($('#co-monto', body).value), r);
          if (monto <= 0) return false;
          if (medio === 'fiado') {
            const c = cart.clienteId && DB.cliente(cart.clienteId);
            if (!c) { UI.toast('Elegí un cliente para fiar', 'warn'); return false; }
            if (c.limite && c.saldo + monto > c.limite && !(await UI.autorizar(`${c.nombre} supera su límite de crédito`))) return false;
          }
          pagos.push({ medio, monto: round2(monto) });
        }
      }
      if (resto() > 0.009) { medio = medio === 'efectivo' ? 'debito' : 'efectivo'; draw(); return false; }
      const agrupados = [];
      pagos.forEach(p => { const a = agrupados.find(x => x.medio === p.medio); if (a) a.monto = round2(a.monto + p.monto); else agrupados.push({ ...p }); });
      finalizar(agrupados, recibido, vuelto, $('#co-print', body).checked);
    };
    const md = UI.modal({
      title: 'Cobrar', body,
      actions: [{ label: 'Cancelar' }, { label: 'Confirmar (Enter)', class: 'primary lg', onClick: confirmar }],
    });
    body.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.target.closest('button')) { e.preventDefault(); $('footer .primary', md.el).click(); }
    });
    draw();
  }

  function finalizar(pagos, recibido, vuelto, imprimir) {
    const t = totales();
    const turno = Caja.actual();
    const cli = cart.clienteId ? DB.cliente(cart.clienteId) : null;
    const v = {
      id: DB.uid(), nro: DB.next('venta'), fecha: Date.now(), items: cart.items.map(i => ({ ...i })),
      subtotal: t.subtotal, descPct: cart.descPct || 0, descuento: t.descuento, total: t.total, pagos, recibido, vuelto,
      clienteId: cli ? cli.id : null, cliente: cli ? cli.nombre : '', usuarioId: App.user.id, usuario: App.user.nombre,
      turnoId: turno ? turno.id : null, caja: DB.device.caja, lista: cart.lista, fiscal: 'no-facturada', pedidoId: cart.pedidoId || null,
    };
    const bajos = [];
    v.items.forEach(i => {
      const p = i.pid && DB.prod(i.pid);
      if (!p) return;
      const antes = p.stock;
      DB.mov(p, -i.cant, 'venta', `Ticket #${v.nro}`, { ref: v.id });
      if (p.stockMin && antes > p.stockMin && p.stock <= p.stockMin) bajos.push(p.nombre);
    });
    const fiado = sum(pagos.filter(p => p.medio === 'fiado'), p => p.monto);
    if (fiado && cli) {
      cli.saldo = round2((cli.saldo || 0) + fiado);
      cli.movs.push({ id: DB.uid(), fecha: Date.now(), tipo: 'cargo', monto: fiado, ventaId: v.id, nota: `Ticket #${v.nro}`, usuario: App.user.nombre });
    }
    if (cart.pedidoId) { const pd = DB.d.pedidos.find(x => x.id === cart.pedidoId); if (pd) { pd.estado = 'entregado'; pd.ventaId = v.id; } }
    DB.d.ventas.push(v);
    DB.save();
    if (pagos.some(p => p.medio === 'efectivo') && DB.g.config.ticket.cajonAuto && HW.pWriter) HW.abrirCajon();
    if (imprimir) Ticket.venta(v);
    lastSale = v;
    cart = nuevo();
    persist();
    if (el) { $('#pos-desc', el).value = ''; $('#pos-lista', el).value = 0; renderCart(); renderQuick(); }
    UI.toast(`Venta #${v.nro} registrada${vuelto ? ` · Vuelto ${fmt(vuelto)}` : ''}`, 'ok', 4500);
    if (bajos.length) UI.toast('Stock mínimo alcanzado: ' + bajos.join(', '), 'warn', 6000);
    focusQ();
  }

  function camara() {
    Scanner.open({
      title: 'Vender con la cámara', continuous: true,
      hint: '<p class="muted small">Cada código leído se agrega a la venta. Tocá "Terminar" para cobrar.</p>',
      onScan: async code => (await procesar(code)) || `<div class="bad-line">✖ Código ${esc(code)} no encontrado</div>`,
    });
  }

  function onKey(e) {
    if ($('.modal-back')) return;
    if (e.key === 'F2') { e.preventDefault(); cobrar(); }
    else if (e.key === 'F4') { e.preventDefault(); $('#pos-q', el).focus(); }
    else if (e.key === 'F8') { e.preventDefault(); HW.abrirCajon(); }
    else if (e.key === 'F9') { e.preventDefault(); importeLibre(); }
  }

  function render(v) {
    el = v;
    const turno = Caja.actual();
    v.innerHTML = `${turno ? '' : '<div class="banner warn">🔒 La caja está cerrada. <button class="btn sm primary" id="pos-abrir">Abrir caja</button></div>'}
    <div class="pos">
      <section>
        <div class="card pos-search">
          <div class="search-row">
            <input id="pos-q" class="input lg" placeholder="Escaneá o buscá por nombre, código o rubro (F4)" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="enter">
            <button class="btn lg" id="pos-cam" title="Escanear con la cámara">📷</button>
          </div>
          <div id="pos-sugg" class="sugg hidden"></div>
        </div>
        <div class="card pos-cart-card"><div id="pos-cart"></div></div>
        <div class="card"><div class="card-h"><h3>Accesos rápidos</h3><button class="btn sm" id="pos-libre">+ Importe libre (F9)</button></div><div id="pos-quick" class="quick"></div></div>
      </section>
      <aside class="pos-side card">
        <label class="lbl">Cliente</label>
        <button class="btn block" id="pos-cli"></button>
        <div class="grid2 mt">
          <div><label class="lbl">Lista de precios</label><select id="pos-lista" class="input">${opts(DB.g.config.listas.map((n, i) => ({ n, i })), cart.lista, x => x.i, x => x.n)}</select></div>
          <div><label class="lbl">Descuento %</label><input id="pos-desc" class="input" inputmode="decimal" value="${cart.descPct || ''}" placeholder="0"></div>
        </div>
        <div id="pos-tot" class="totals"></div>
        <button class="btn primary xl block" id="pos-cobrar">Cobrar (F2)</button>
        <div class="row mt"><button class="btn sm" id="pos-cancel">🗑️ Cancelar</button><button class="btn sm" id="pos-cajon">🗄️ Cajón (F8)</button><button class="btn sm" id="pos-reimp">🖨️ Reimprimir</button></div>
        <div id="pos-last" class="last-sale"></div>
        <p class="muted small mt">Tip: escribí <span class="kbd">3*</span> antes del código para sumar 3 unidades.</p>
      </aside>
    </div>
    <div class="pos-mobilebar"><div><small>Total</small><b id="pos-mtot"></b></div><button class="btn primary lg" id="pos-mcobrar">Cobrar</button></div>`;

    const q = $('#pos-q', v);
    q.addEventListener('input', () => { sugg = q.value.trim().length >= 2 ? buscar(q.value) : []; sel = 0; renderSugg(); });
    q.addEventListener('keydown', async e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, sugg.length - 1); renderSugg(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); renderSugg(); }
      else if (e.key === 'Escape') { q.value = ''; sugg = []; renderSugg(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const val = q.value;
        if (!val.trim()) { if (cart.items.length) cobrar(); return; }
        q.value = ''; const s = sugg; const si = sel; sugg = []; renderSugg();
        const ok = await procesar(val);
        if (ok) return;
        if (s.length && s[si]) await agregar(s[si], s[si].porPeso ? null : 1);
        else { UI.beep(false); UI.toast(`No se encontró "${val}"`, 'error'); if (App.can('productos')) Productos.desconocido(val.trim()); }
      }
    });
    $('#pos-sugg', v).addEventListener('click', async e => {
      const b = e.target.closest('[data-n]');
      if (!b) return;
      const p = sugg[+b.dataset.n];
      q.value = ''; sugg = []; renderSugg();
      await agregar(p, p.porPeso ? null : 1);
      focusQ();
    });
    $('#pos-cart', v).addEventListener('click', async e => {
      const row = e.target.closest('[data-i]');
      if (!row) return;
      const i = +row.dataset.i, it = cart.items[i];
      const paso = it.porPeso ? 0.1 : 1;
      if (e.target.closest('[data-inc]')) it.cant = round3(it.cant + paso);
      else if (e.target.closest('[data-dec]')) { it.cant = round3(it.cant - paso); if (it.cant <= 0) cart.items.splice(i, 1); }
      else if (e.target.closest('[data-del]')) cart.items.splice(i, 1);
      else if (e.target.closest('[data-precio]')) {
        e.preventDefault();
        if (!(await UI.autorizar('Cambiar precio en la venta'))) return;
        const nv = await UI.prompt('Precio unitario', { label: it.nombre, value: String(it.precio).replace('.', ','), inputmode: 'decimal' });
        if (nv == null || num(nv) < 0) return;
        it.precio = round2(num(nv)); it.manual = true;
      } else return;
      persist(); renderCart();
    });
    $('#pos-cart', v).addEventListener('change', e => {
      const inp = e.target.closest('[data-q]');
      if (!inp) return;
      const i = +inp.closest('[data-i]').dataset.i;
      const c = round3(num(inp.value));
      if (c > 0) cart.items[i].cant = c; else cart.items.splice(i, 1);
      persist(); renderCart();
    });
    $('#pos-quick', v).addEventListener('click', async e => {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      const p = DB.prod(b.dataset.p);
      await agregar(p, p.porPeso ? null : 1);
      focusQ();
    });
    $('#pos-cam', v).onclick = camara;
    $('#pos-libre', v).onclick = importeLibre;
    $('#pos-cli', v).onclick = elegirCliente;
    $('#pos-lista', v).onchange = e => aplicarLista(+e.target.value);
    $('#pos-desc', v).onchange = async e => {
      const d = Math.min(100, Math.max(0, num(e.target.value)));
      if (d > 10 && !(await UI.autorizar(`Descuento de ${d}%`))) { e.target.value = cart.descPct || ''; return; }
      cart.descPct = d; persist(); renderCart();
    };
    $('#pos-cobrar', v).onclick = cobrar;
    $('#pos-mcobrar', v).onclick = cobrar;
    $('#pos-cancel', v).onclick = async () => {
      if (!cart.items.length) return;
      if (await UI.confirm('¿Cancelar la venta en curso?', { ok: 'Cancelar venta', danger: true })) { cart = nuevo(); persist(); aplicarLista(0); $('#pos-desc', v).value = ''; }
    };
    $('#pos-cajon', v).onclick = () => HW.abrirCajon();
    $('#pos-reimp', v).onclick = () => {
      const u = lastSale || DB.d.ventas[DB.d.ventas.length - 1];
      if (u) Ticket.venta(u); else UI.toast('No hay ventas para reimprimir', 'warn');
    };
    const ab = $('#pos-abrir', v);
    if (ab) ab.onclick = () => Caja.abrirModal();
    document.addEventListener('keydown', onKey);
    renderCart();
    renderQuick();
    focusQ();
  }

  function destroy() { document.removeEventListener('keydown', onKey); el = null; }

  /* Cargar ítems desde un pedido online u otra pantalla */
  function cargar(items, { clienteId = null, pedidoId = null } = {}) {
    cart = nuevo();
    cart.clienteId = clienteId;
    cart.pedidoId = pedidoId;
    if (clienteId) { const c = DB.cliente(clienteId); if (c) cart.lista = c.lista || 0; }
    const faltan = [];
    items.forEach(({ pid, cant }) => {
      const p = DB.prod(pid);
      if (!p) { faltan.push(pid); return; }
      cart.items.push({ pid: p.id, codigo: p.codigo, nombre: p.nombre, cant, precio: DB.precio(p, cart.lista), costo: p.costo || 0, rubro: p.rubro, porPeso: !!p.porPeso });
    });
    persist();
    App.go('pos');
    return faltan;
  }

  return { render, destroy, cobrar, camara, cargar, agregar, totales, procesar };
})();

App.register('pos', { title: 'Vender', icon: '🛒', render: v => POS.render(v), destroy: () => POS.destroy() });
