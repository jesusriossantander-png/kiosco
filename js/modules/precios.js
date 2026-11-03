/* Precios: actualización masiva por marca, rubro, proveedor o rango de códigos; 5 listas independientes */
App.register('precios', {
  title: 'Precios', icon: '💲',
  render(v) {
    const cfg = DB.g.config;
    const marcas = [...new Set(DB.d.productos.map(p => p.marca).filter(Boolean))].sort();
    v.innerHTML = `<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1.3fr)">
      <div class="card form" id="pc-form">
        <h2>Actualización masiva</h2>
        <p class="muted small">1) Filtrá los productos · 2) Elegí cómo cambiar el precio · 3) Revisá la vista previa y aplicá.</p>
        <div class="grid2">
          <label><span>Rubro</span><select name="rubro"><option value="">Todos</option>${opts(cfg.rubros, '')}</select></label>
          <label><span>Marca</span><select name="marca"><option value="">Todas</option>${opts(marcas, '')}</select></label>
        </div>
        <div class="grid2">
          <label><span>Proveedor</span><select name="prov"><option value="">Todos</option>${opts(DB.d.proveedores, '', x => x.id, x => x.nombre)}</select></label>
          <label><span>Texto en el nombre</span><input name="texto" placeholder="ej: 500 ml"></label>
        </div>
        <div class="grid2">
          <label><span>Código desde</span><input name="desde" inputmode="numeric"></label>
          <label><span>Código hasta</span><input name="hasta" inputmode="numeric"></label>
        </div>
        <hr style="border:0;border-top:1px solid var(--border);margin:6px 0 12px">
        <div class="grid2">
          <label><span>Aplicar sobre</span><select name="destino"><option value="todas">Todas las listas</option>${cfg.listas.map((n, i) => `<option value="${i}">${esc(n)}</option>`).join('')}<option value="costo">Costo</option></select></label>
          <label><span>Tipo de cambio</span><select name="modo"><option value="pct">Porcentaje (%)</option><option value="fijo">Monto fijo ($)</option><option value="margen">Recalcular desde costo con margen %</option><option value="costoAct">Aumentar costo % y mantener margen</option></select></label>
        </div>
        <div class="grid2">
          <label><span id="pc-vlbl">Valor (negativo para bajar)</span><input name="valor" data-num inputmode="decimal" placeholder="ej: 10"></label>
          <label><span>Redondeo</span><select name="redondeo"><option value="0">Sin redondeo</option><option value="1">A $1</option><option value="10" selected>A $10</option><option value="50">A $50</option><option value="100">A $100</option></select></label>
        </div>
        <div class="row"><button class="btn" id="pc-prev" type="button">👁️ Vista previa</button><button class="btn primary" id="pc-apl" type="button">Aplicar cambios</button></div>
      </div>
      <div class="card"><div class="card-h"><h2>Vista previa</h2><span class="muted small" id="pc-cnt"></span></div><div id="pc-res">${UI.empty('Configurá el filtro y tocá Vista previa')}</div></div>
    </div>
    <div class="card form mt" id="of-form">
      <div class="card-h"><h2>🏷️ Ofertas masivas</h2><span class="muted small" id="of-act"></span></div>
      <p class="muted small">Usa los mismos filtros de arriba (rubro, marca, proveedor, texto o códigos). Pone un precio de oferta con el % indicado sobre el precio minorista; se ve tachado en la app y se cobra así en la caja.</p>
      <div class="grid3">
        <label><span>Descuento %</span><input name="ofPct" data-num inputmode="decimal" placeholder="ej: 20"></label>
        <label><span>Válida hasta (opcional)</span><input type="date" name="ofHasta"></label>
        <label><span>Redondeo</span><select name="ofRed"><option value="1">A $1</option><option value="10" selected>A $10</option><option value="50">A $50</option><option value="100">A $100</option></select></label>
      </div>
      <label class="check"><input type="checkbox" name="ofPisar"> Reemplazar también las ofertas que ya tengan esos productos</label>
      <div class="row mt"><button class="btn" id="of-prev" type="button">👁️ Vista previa</button><button class="btn primary" id="of-apl" type="button">Aplicar oferta</button><button class="btn danger" id="of-quitar" type="button">Quitar ofertas a esos productos</button></div>
    </div>
    <div class="grid mt">
      <div class="card form"><div class="card-h"><h3>Listas de precios</h3></div><p class="muted small">Hasta 5 listas independientes. Asigná una lista a cada cliente (por ejemplo, mayoristas).</p>
        ${cfg.listas.map((n, i) => `<label><span>Lista ${i + 1}</span><input data-lista="${i}" value="${esc(n)}"></label>`).join('')}
        <button class="btn" id="pc-listas">Guardar nombres</button></div>
      <div class="card"><h3>Historial de actualizaciones</h3>${DB.d.preciosLog.length ? `<ul class="list-plain mt">${DB.d.preciosLog.slice(-15).reverse().map(l => `<li><span>${fechaHora(l.fecha)} · ${esc(l.desc)}<br><small class="muted">${esc(l.usuario)}</small></span><b>${l.n} prod.</b></li>`).join('')}</ul>` : UI.empty('Sin actualizaciones todavía')}</div>
    </div>`;
    const form = $('#pc-form', v);
    const L = cfg.listas;

    const calcular = () => {
      const f = UI.formData(form);
      const w = norm(f.texto);
      const enRango = c => {
        if (!f.desde && !f.hasta) return true;
        const isNum = /^\d+$/.test(c) && (!f.desde || /^\d+$/.test(f.desde)) && (!f.hasta || /^\d+$/.test(f.hasta));
        if (isNum) { const n = BigInt(c); return (!f.desde || n >= BigInt(f.desde)) && (!f.hasta || n <= BigInt(f.hasta)); }
        return (!f.desde || c >= f.desde) && (!f.hasta || c <= f.hasta);
      };
      const list = DB.d.productos.filter(p => (!f.rubro || p.rubro === f.rubro) && (!f.marca || p.marca === f.marca) && (!f.prov || p.proveedorId === f.prov) && (!w || norm(p.nombre).includes(w)) && enRango(p.codigo));
      const R = +f.redondeo;
      const red = x => (R ? Math.round(x / R) * R : round2(x));
      const idx = f.destino === 'todas' ? L.map((_, i) => i) : f.destino === 'costo' ? [] : [+f.destino];
      const cambios = list.map(p => {
        const nuevo = { costo: p.costo, precios: p.precios.slice() };
        const ap = x => (f.modo === 'fijo' ? x + f.valor : x * (1 + f.valor / 100));
        if (f.modo === 'margen') idx.forEach(i => { if (p.costo > 0) nuevo.precios[i] = red(p.costo * (1 + f.valor / 100)); });
        else if (f.modo === 'costoAct') {
          nuevo.costo = round2(p.costo * (1 + f.valor / 100));
          (idx.length ? idx : [0]).forEach(i => { if (p.precios[i] && p.costo > 0) nuevo.precios[i] = red(nuevo.costo * p.precios[i] / p.costo); });
        } else if (f.destino === 'costo') nuevo.costo = round2(ap(p.costo));
        else idx.forEach(i => { if (p.precios[i]) nuevo.precios[i] = Math.max(0, red(ap(p.precios[i]))); });
        return { p, nuevo };
      });
      return { f, cambios };
    };

    const preview = () => {
      const { cambios } = calcular();
      $('#pc-cnt', v).textContent = `${cambios.length} productos alcanzados`;
      $('#pc-res', v).innerHTML = cambios.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th class="num">Costo</th><th class="num">${esc(L[0])}</th><th class="num">${esc(L[1])}</th><th class="num">Margen nuevo</th></tr></thead><tbody>
        ${cambios.slice(0, 80).map(({ p, nuevo }) => { const mg = nuevo.costo > 0 && nuevo.precios[0] ? (nuevo.precios[0] - nuevo.costo) / nuevo.costo * 100 : null; const cell = (a, b) => (a === b ? fmt(a) : `<s class="muted">${fmt(a)}</s><br><b>${fmt(b)}</b>`); return `<tr><td>${esc(p.nombre)}</td><td class="num">${cell(p.costo, nuevo.costo)}</td><td class="num">${cell(p.precios[0] || 0, nuevo.precios[0] || 0)}</td><td class="num">${cell(p.precios[1] || 0, nuevo.precios[1] || 0)}</td><td class="num">${mg == null ? '—' : fmtN(mg, 1) + '%'}</td></tr>`; }).join('')}
        </tbody></table></div>${cambios.length > 80 ? `<p class="muted small">… y ${cambios.length - 80} más</p>` : ''}` : UI.empty('Ningún producto coincide con el filtro');
    };

    $('[name=modo]', form).onchange = e => { $('#pc-vlbl', v).textContent = { pct: 'Porcentaje (negativo para bajar)', fijo: 'Monto en $ (negativo para bajar)', margen: 'Margen % sobre costo', costoAct: 'Aumento del costo %' }[e.target.value]; };
    $('#pc-prev', v).onclick = preview;

    /* ---------- Ofertas masivas ---------- */
    const ofForm = $('#of-form', v);
    const filtrados = () => {
      const f = UI.formData(form);
      const w = norm(f.texto);
      const enRango = c => {
        if (!f.desde && !f.hasta) return true;
        const isNum = /^\d+$/.test(c) && (!f.desde || /^\d+$/.test(f.desde)) && (!f.hasta || /^\d+$/.test(f.hasta));
        if (isNum) { const n = BigInt(c); return (!f.desde || n >= BigInt(f.desde)) && (!f.hasta || n <= BigInt(f.hasta)); }
        return (!f.desde || c >= f.desde) && (!f.hasta || c <= f.hasta);
      };
      return { f, list: DB.d.productos.filter(p => p.activo !== false && (!f.rubro || p.rubro === f.rubro) && (!f.marca || p.marca === f.marca) && (!f.prov || p.proveedorId === f.prov) && (!w || norm(p.nombre).includes(w)) && enRango(p.codigo)) };
    };
    const filtroTxt = f => [f.rubro, f.marca, DB.proveedor(f.prov)?.nombre, f.texto && `"${f.texto}"`, (f.desde || f.hasta) && `códigos ${f.desde || '…'}–${f.hasta || '…'}`].filter(Boolean).join(' · ') || 'todos los productos';
    const actOf = () => { const n = DB.d.productos.filter(p => DB.ofertaActiva(p)).length; $('#of-act', v).textContent = `${n} producto${n === 1 ? '' : 's'} en oferta ahora`; };
    actOf();
    const calcOferta = () => {
      const { f, list } = filtrados();
      const o = UI.formData(ofForm);
      const R = +o.ofRed || 1;
      const items = list.map(p => {
        const base = DB.precioLista(p);
        const nuevo = base > 0 ? Math.max(1, Math.round(base * (1 - o.ofPct / 100) / R) * R) : 0;
        const salta = !base || nuevo >= base || (DB.ofertaActiva(p) && !o.ofPisar);
        return { p, base, nuevo, salta, motivo: !base ? 'sin precio' : nuevo >= base ? 'descuento muy chico' : 'ya tiene oferta' };
      });
      return { f, o, items, ok: items.filter(x => !x.salta) };
    };
    const verOferta = () => {
      const { o, items, ok } = calcOferta();
      $('#pc-cnt', v).textContent = `${ok.length} productos recibirán la oferta`;
      $('#pc-res', v).innerHTML = !o.ofPct ? UI.empty('Escribí el % de descuento') : items.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th class="num">Precio</th><th class="num">Oferta</th><th class="num">Desc.</th></tr></thead><tbody>
        ${items.slice(0, 80).map(x => `<tr class="${x.salta ? 'muted' : ''}"><td>${esc(x.p.nombre)}${x.salta ? ` <span class="badge">${x.motivo}</span>` : ''}</td><td class="num">${fmt(x.base)}</td><td class="num"><b>${x.salta ? '—' : fmt(x.nuevo)}</b></td><td class="num">${x.salta ? '' : `<span class="badge danger">${Math.round((1 - x.nuevo / x.base) * 100)}%</span>`}</td></tr>`).join('')}
        </tbody></table></div>` : UI.empty('Ningún producto coincide con el filtro');
      $('#pc-res', v).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    $('#of-prev', v).onclick = verOferta;
    $('#of-apl', v).onclick = async () => {
      const { f, o, ok, items } = calcOferta();
      if (!(o.ofPct > 0 && o.ofPct < 100)) return UI.toast('Escribí un descuento entre 1 y 99 %', 'warn');
      if (!ok.length) { verOferta(); return UI.toast(items.length ? 'Ningún producto puede recibir la oferta (mirá la vista previa)' : 'Ningún producto coincide con el filtro', 'warn'); }
      if (!(await UI.confirm(`Poner ${fmtN(o.ofPct, 1)}% de descuento a ${ok.length} productos (${filtroTxt(f)})${o.ofHasta ? ` hasta el ${fechaISO(o.ofHasta)}` : ''}?`, { ok: 'Aplicar oferta' }))) return;
      ok.forEach(x => { x.p.oferta = { precio: x.nuevo, hasta: o.ofHasta || '' }; });
      const desc = `Oferta ${fmtN(o.ofPct, 1)}% · ${filtroTxt(f)}${o.ofHasta ? ' · hasta ' + fechaISO(o.ofHasta) : ''}`;
      DB.d.preciosLog.push({ fecha: Date.now(), n: ok.length, usuario: App.user.nombre, desc });
      DB.log('precios', 'Oferta masiva aplicada', `${ok.length} productos · ${desc}`);
      DB.save();
      UI.toast(`Oferta aplicada a ${ok.length} productos. Publicá el catálogo para que la vean tus clientes.`, 'ok', 5000);
      App.refresh();
    };
    $('#of-quitar', v).onclick = async () => {
      const { f, list } = filtrados();
      const con = list.filter(p => p.oferta);
      if (!con.length) return UI.toast('Esos productos no tienen ofertas', 'info');
      if (!(await UI.confirm(`¿Quitar la oferta a ${con.length} productos (${filtroTxt(f)})? Vuelven a su precio normal.`, { ok: 'Quitar ofertas', danger: true }))) return;
      con.forEach(p => { p.oferta = null; });
      DB.d.preciosLog.push({ fecha: Date.now(), n: con.length, usuario: App.user.nombre, desc: `Ofertas quitadas · ${filtroTxt(f)}` });
      DB.log('precios', 'Ofertas quitadas', `${con.length} productos · ${filtroTxt(f)}`);
      DB.save();
      UI.toast(`Ofertas quitadas a ${con.length} productos`, 'ok');
      App.refresh();
    };
    $('#pc-apl', v).onclick = async () => {
      const { f, cambios } = calcular();
      if (!f.valor) return UI.toast('Ingresá un valor', 'warn');
      if (!cambios.length) return UI.toast('Ningún producto coincide', 'warn');
      if (!(await UI.confirm(`Se actualizarán ${cambios.length} productos. ¿Aplicar?`))) return;
      cambios.forEach(({ p, nuevo }) => { p.costo = nuevo.costo; p.precios = nuevo.precios; });
      const dest = f.destino === 'todas' ? 'todas las listas' : f.destino === 'costo' ? 'costo' : L[+f.destino];
      const modo = { pct: `${f.valor}%`, fijo: `${fmt(f.valor)}`, margen: `margen ${f.valor}%`, costoAct: `costo +${f.valor}% manteniendo margen` }[f.modo];
      DB.log('precios', 'Actualización masiva de precios', `${cambios.length} productos · ${modo} en ${dest}`);
      DB.d.preciosLog.push({ fecha: Date.now(), n: cambios.length, usuario: App.user.nombre, desc: `${modo} en ${dest}${f.rubro ? ' · ' + f.rubro : ''}${f.marca ? ' · ' + f.marca : ''}` });
      DB.save();
      UI.toast(`Precios actualizados en ${cambios.length} productos`, 'ok');
      App.refresh();
    };
    $('#pc-listas', v).onclick = () => {
      $$('[data-lista]', v).forEach(i => { cfg.listas[+i.dataset.lista] = i.value.trim() || `Lista ${+i.dataset.lista + 1}`; });
      DB.save(); UI.toast('Listas guardadas', 'ok'); App.refresh();
    };
  },
});
