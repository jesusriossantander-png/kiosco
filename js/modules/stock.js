/* Stock e inventario: alertas, vencimientos (FEFO), ajustes/salidas, conteo cíclico, depósito y movimientos */
const Stock = (() => {
  let tab = 'alertas';
  let conteo = null; // { items: {pid: contado}, rubro }

  function buscarProducto(onPick, titulo = 'Elegir producto') {
    const body = h(`<div><div class="field-inline"><input class="input lg" id="bp-q" placeholder="Nombre o código…" autofocus autocomplete="off"><button class="btn lg" id="bp-cam" type="button">📷</button></div><div id="bp-list" class="mt"></div></div>`);
    const md = UI.modal({ title: titulo, body });
    const draw = () => {
      const w = norm($('#bp-q', body).value).split(/\s+/).filter(Boolean);
      const list = w.length ? DB.d.productos.filter(p => w.every(x => norm(p.nombre + ' ' + p.codigo + ' ' + p.marca).includes(x))).slice(0, 30) : [];
      $('#bp-list', body).innerHTML = list.map(p => `<button class="btn block mb" style="justify-content:space-between" data-p="${p.id}"><span>${DB.emoji(p)} ${esc(p.nombre)}</span><small>stock ${fmtN(p.stock, 3)}</small></button>`).join('');
      $$('[data-p]', body).forEach(b => { b.onclick = () => { md.close(); onPick(DB.prod(b.dataset.p)); }; });
    };
    const q = $('#bp-q', body);
    q.addEventListener('input', draw);
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { const p = DB.porCodigo(q.value); if (p) { md.close(); onPick(p); } } });
    $('#bp-cam', body).onclick = () => Scanner.open({
      onScan: (code, m) => { const p = DB.porCodigo(code); if (!p) return `<div class="bad-line">✖ ${esc(code)} no registrado</div>`; m.close(); md.close(); setTimeout(() => onPick(p), 50); return ''; },
    });
  }

  /* Entrada, salida con motivo o ajuste al valor contado */
  function ajuste(p, tipoInicial = 'entrada') {
    if (!p) return buscarProducto(x => ajuste(x, tipoInicial), 'Ajuste de stock');
    const motivos = DB.g.config.motivosSalida;
    const body = h(`<form class="form">
      <div class="prod-card mb"><div class="emo">${DB.emoji(p)}</div><div><b>${esc(p.nombre)}</b><br><small class="muted">${esc(p.codigo)}</small><br>Góndola: <b>${fmtN(p.stock, 3)}</b> · Depósito: <b>${fmtN(p.stockDeposito || 0, 3)}</b></div></div>
      <label><span>Tipo de movimiento</span><select name="tipo">${opts([['entrada', '➕ Entrada de mercadería'], ['salida', '➖ Salida (merma, devolución, uso propio…)'], ['ajuste', '🔢 Ajustar al valor contado'], ['transferir', '🔁 Pasar de depósito a góndola'], ['adeposito', '🔁 Pasar de góndola a depósito']], tipoInicial, x => x[0], x => x[1])}</select></label>
      <div class="grid2"><label><span id="aj-lbl">Cantidad</span><input name="cant" data-num inputmode="decimal" class="input xl" autofocus></label>
      <label data-w="dest"><span>Ubicación</span><select name="ubic"><option value="gondola">Góndola</option><option value="deposito">Depósito</option></select></label></div>
      <label data-w="motivo"><span>Motivo</span><select name="motivo">${opts(motivos, '')}</select></label>
      <label data-w="venc"><span>Vencimiento del lote (opcional)</span><input type="date" name="venc"></label>
      <label><span>Nota</span><input name="nota" placeholder="Opcional"></label></form>`);
    const sync = () => {
      const t = $('[name=tipo]', body).value;
      $('[data-w=motivo]', body).classList.toggle('hidden', t !== 'salida');
      $('[data-w=venc]', body).classList.toggle('hidden', t !== 'entrada');
      $('[data-w=dest]', body).classList.toggle('hidden', !['entrada', 'salida', 'ajuste'].includes(t));
      $('#aj-lbl', body).textContent = t === 'ajuste' ? 'Cantidad contada (real)' : 'Cantidad';
    };
    $('[name=tipo]', body).onchange = sync;
    sync();
    UI.modal({
      title: 'Movimiento de stock', body,
      actions: [{ label: 'Cancelar' }, {
        label: 'Guardar', class: 'primary', onClick: (c, root) => {
          const f = UI.formData(root);
          const dep = f.ubic === 'deposito';
          const actual = dep ? p.stockDeposito || 0 : p.stock;
          const nota = f.nota ? ' · ' + f.nota : '';
          if (f.tipo !== 'ajuste' && f.cant <= 0) { UI.toast('Ingresá una cantidad', 'warn'); return false; }
          if (f.tipo === 'entrada') DB.mov(p, f.cant, 'entrada', 'Entrada manual' + nota, { deposito: dep, venc: dep ? '' : f.venc });
          else if (f.tipo === 'salida') DB.mov(p, -f.cant, 'salida', f.motivo + nota, { deposito: dep });
          else if (f.tipo === 'ajuste') { const d = round3(f.cant - actual); if (d) DB.mov(p, d, 'ajuste', 'Ajuste por conteo' + nota, { deposito: dep }); }
          else if (f.tipo === 'transferir') { DB.mov(p, -f.cant, 'transferencia', 'Depósito → góndola', { deposito: true }); DB.mov(p, f.cant, 'transferencia', 'Depósito → góndola'); }
          else if (f.tipo === 'adeposito') { DB.mov(p, -f.cant, 'transferencia', 'Góndola → depósito'); DB.mov(p, f.cant, 'transferencia', 'Góndola → depósito', { deposito: true }); }
          UI.toast('Stock actualizado', 'ok');
          if (App.current && ['stock', 'productos', 'dashboard'].includes(App.current.id)) App.refresh();
        },
      }],
    });
  }

  function bajos() { return DB.d.productos.filter(p => p.activo !== false && p.stockMin > 0 && p.stock <= p.stockMin); }
  function lotesPorVencer(dias) {
    const out = [];
    DB.d.productos.forEach(p => (p.lotes || []).forEach(l => { const d = diasHasta(l.venc); if (dias == null || d <= dias) out.push({ p, l, d }); }));
    return out.sort((a, b) => a.d - b.d);
  }

  function generarOrdenes(lista) {
    const porProv = {};
    lista.forEach(p => { const k = p.proveedorId || ''; (porProv[k] ||= []).push(p); });
    let n = 0;
    Object.entries(porProv).forEach(([prov, ps]) => {
      DB.d.ordenes.push({
        id: DB.uid(), nro: DB.next('orden'), fecha: Date.now(), proveedorId: prov, estado: 'pendiente', usuario: App.user.nombre,
        items: ps.map(p => ({ pid: p.id, nombre: p.nombre, cant: Math.max(1, Math.ceil(p.stockMin * 2 - p.stock)), costo: p.costo })),
      });
      n++;
    });
    DB.save();
    UI.toast(`${n} orden(es) de pedido creadas en Compras y proveedores`, 'ok');
  }

  function tabAlertas(v) {
    const list = bajos().sort((a, b) => (a.rubro || '').localeCompare(b.rubro || '') || a.stock - b.stock);
    const rubros = [...new Set(list.map(p => p.rubro))];
    v.innerHTML = list.length ? `<div class="toolbar"><span class="grow">${list.length} productos en o debajo del stock mínimo</span>${App.can('proveedores') ? '<button class="btn primary" id="st-ord">🧾 Generar órdenes de pedido</button>' : ''}</div>
      ${rubros.map(r => `<div class="card"><h3>${DB.EMOJI[r] || '📦'} ${esc(r || 'Sin rubro')}</h3><ul class="list-plain mt">${list.filter(p => p.rubro === r).map(p => `<li><span><b>${esc(p.nombre)}</b><br><small class="muted">Mínimo ${fmtN(p.stockMin, 3)} · Depósito ${fmtN(p.stockDeposito || 0, 3)} · ${esc(DB.proveedor(p.proveedorId)?.nombre || 'sin proveedor')}</small></span><span>${Productos.stockBadge(p)} <button class="btn sm" data-aj="${p.id}">Reponer</button></span></li>`).join('')}</ul></div>`).join('')}`
      : `<div class="card">${UI.empty('✅ Todo el stock está por encima del mínimo')}</div>`;
    const o = $('#st-ord', v);
    if (o) o.onclick = () => generarOrdenes(list);
    $$('[data-aj]', v).forEach(b => { b.onclick = () => { const p = DB.prod(b.dataset.aj); ajuste(p, p.stockDeposito > 0 ? 'transferir' : 'entrada'); }; });
  }

  function tabVenc(v) {
    const list = lotesPorVencer(60);
    v.innerHTML = `<div class="banner info">FEFO: al vender se descuenta primero el lote que vence antes. Cargá vencimientos al ingresar mercadería.</div>
      <div class="card" style="padding:0">${list.length ? `<div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Producto</th><th>Vence</th><th class="num">Cantidad</th><th>Estado</th><th></th></tr></thead><tbody>
      ${list.map(({ p, l }) => `<tr><td><b>${esc(p.nombre)}</b><br><small class="muted">${esc(p.codigo)}</small></td><td>${fechaISO(l.venc)}</td><td class="num">${fmtN(l.cant, 3)}</td><td>${Productos.venceBadge(l.venc)}</td><td class="right"><button class="btn sm" data-baja="${p.id}|${l.id}">Dar de baja</button></td></tr>`).join('')}
      </tbody></table></div>` : UI.empty('No hay lotes que venzan en los próximos 60 días')}</div>`;
    $$('[data-baja]', v).forEach(b => {
      b.onclick = async () => {
        const [pid, lid] = b.dataset.baja.split('|');
        const p = DB.prod(pid), l = p.lotes.find(x => x.id === lid);
        if (!l || !(await UI.confirm(`¿Dar de baja ${fmtN(l.cant, 3)} u. de ${p.nombre} (vence ${fechaISO(l.venc)})?`))) return;
        DB.mov(p, -l.cant, 'salida', diasHasta(l.venc) < 0 ? 'Vencido' : 'Retiro por vencimiento', { loteId: l.id });
        App.refresh();
      };
    });
  }

  function tabAjuste(v) {
    const ult = DB.d.movimientos.filter(m => ['entrada', 'salida', 'ajuste', 'transferencia'].includes(m.tipo)).slice(-15).reverse();
    v.innerHTML = `<div class="actions-grid">
        <button class="action" data-t="entrada"><span>➕</span>Entrada de mercadería</button>
        <button class="action" data-t="salida"><span>➖</span>Salida con motivo</button>
        <button class="action" data-t="ajuste"><span>🔢</span>Ajustar al contado</button>
        <button class="action" data-t="transferir"><span>🔁</span>Depósito → góndola</button>
        <button class="action" id="aj-cam"><span>📷</span>Escanear y ajustar</button>
      </div>
      <div class="card mt"><div class="card-h"><h3>Motivos de salida</h3><button class="btn sm" id="aj-mot">Editar motivos</button></div><p class="muted">${DB.g.config.motivosSalida.map(esc).join(' · ')}</p></div>
      <div class="card"><h3>Últimos movimientos manuales</h3>${ult.length ? `<ul class="list-plain mt">${ult.map(m => `<li><span>${esc(m.nombre)}<br><small class="muted">${fechaHora(m.fecha)} · ${esc(m.tipo)} · ${esc(m.motivo)}${m.deposito ? ' · depósito' : ''} · ${esc(m.usuario)}</small></span><b class="${m.cant < 0 ? 'danger-t' : 'ok-t'}">${m.cant > 0 ? '+' : ''}${fmtN(m.cant, 3)}</b></li>`).join('')}</ul>` : UI.empty('Sin movimientos')}</div>`;
    $$('[data-t]', v).forEach(b => { b.onclick = () => ajuste(null, b.dataset.t); });
    $('#aj-cam', v).onclick = () => Scanner.open({ title: 'Escanear producto', onScan: (code, m) => { const p = DB.porCodigo(code); if (!p) return `<div class="bad-line">✖ ${esc(code)} no registrado</div>`; m.close(); setTimeout(() => ajuste(p, 'ajuste'), 50); return ''; } });
    $('#aj-mot', v).onclick = async () => {
      const r = await UI.prompt('Motivos de salida', { label: 'Separados por coma', value: DB.g.config.motivosSalida.join(', ') });
      if (r == null) return;
      DB.g.config.motivosSalida = r.split(',').map(s => s.trim()).filter(Boolean);
      DB.save(); App.refresh();
    };
  }

  function tabConteo(v) {
    if (!conteo) {
      v.innerHTML = `<div class="card"><h3>Conteo cíclico</h3><p class="muted">Contá un sector por vez (por ejemplo, cigarrillos hoy, bebidas mañana). Escaneá cada unidad con la cámara o el lector y el sistema suma solo. Al finalizar se ajustan las diferencias y quedan en el reporte de faltantes.</p>
        <div class="row"><select class="input" id="ct-rubro" style="width:auto"><option value="">Todos los productos</option>${opts(DB.g.config.rubros, '')}</select><button class="btn primary" id="ct-ini">Empezar conteo</button></div></div>
        ${DB.d.conteos.length ? `<div class="card"><h3>Conteos anteriores</h3><ul class="list-plain mt">${DB.d.conteos.slice(-10).reverse().map(c => `<li><span>${fechaHora(c.fecha)} · ${esc(c.rubro || 'Todos')} · ${esc(c.usuario)}</span><span>${c.items} productos · <b class="${c.valor < 0 ? 'danger-t' : ''}">${fmt(c.valor)}</b></span></li>`).join('')}</ul></div>` : ''}`;
      $('#ct-ini', v).onclick = () => { conteo = { rubro: $('#ct-rubro', v).value, items: {}, inicio: Date.now() }; App.refresh(); };
      return;
    }
    const prods = DB.d.productos.filter(p => p.activo !== false && (!conteo.rubro || p.rubro === conteo.rubro)).sort((a, b) => a.nombre.localeCompare(b.nombre));
    v.innerHTML = `<div class="card"><div class="toolbar"><b class="grow">Conteo: ${esc(conteo.rubro || 'Todos')} · ${Object.keys(conteo.items).length}/${prods.length} contados</b>
        <button class="btn primary" id="ct-cam">📷 Escanear</button><button class="btn" id="ct-cancel">Cancelar</button><button class="btn danger" id="ct-fin">Finalizar y ajustar</button></div>
        <input class="input lg" id="ct-q" placeholder="Lector USB: escaneá acá (suma 1)" autocomplete="off"></div>
      <div class="card" style="padding:0"><div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Producto</th><th class="num">Sistema</th><th class="num" style="width:130px">Contado</th><th class="num">Diferencia</th></tr></thead><tbody>
      ${prods.map(p => { const c = conteo.items[p.id]; const d = c == null ? null : round3(c - p.stock); return `<tr><td>${esc(p.nombre)}<br><small class="muted">${esc(p.codigo)}</small></td><td class="num">${fmtN(p.stock, 3)}</td><td class="num"><input class="input" data-c="${p.id}" inputmode="decimal" value="${c == null ? '' : fmtN(c, 3)}"></td><td class="num ${d < 0 ? 'danger-t' : d > 0 ? 'warn-t' : ''}">${d == null ? '—' : (d > 0 ? '+' : '') + fmtN(d, 3)}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
    const sumar = code => {
      const p = DB.porCodigo(code);
      if (!p || (conteo.rubro && p.rubro !== conteo.rubro)) return null;
      conteo.items[p.id] = round3((conteo.items[p.id] || 0) + 1);
      const inp = $(`[data-c="${p.id}"]`, v);
      if (inp) inp.value = fmtN(conteo.items[p.id], 3);
      return `<div class="ok-line">✔ ${esc(p.nombre)}: <b>${fmtN(conteo.items[p.id], 3)}</b> contados</div>`;
    };
    $$('[data-c]', v).forEach(i => i.addEventListener('change', () => { if (i.value.trim() === '') delete conteo.items[i.dataset.c]; else conteo.items[i.dataset.c] = round3(num(i.value)); }));
    const q = $('#ct-q', v);
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { const r = sumar(q.value.trim()); UI.beep(!!r); if (!r) UI.toast('Código no encontrado en este conteo', 'warn'); q.value = ''; } });
    if (!isTouch) q.focus();
    $('#ct-cam', v).onclick = () => Scanner.open({ title: 'Conteo con cámara', continuous: true, hint: '<p class="muted small">Cada lectura suma 1 unidad. Esperá el pitido entre productos iguales.</p>', onScan: code => sumar(code) || `<div class="bad-line">✖ ${esc(code)} no pertenece a este conteo</div>`, });
    $('#ct-cancel', v).onclick = async () => { if (await UI.confirm('¿Descartar el conteo?')) { conteo = null; App.refresh(); } };
    $('#ct-fin', v).onclick = async () => {
      const ids = Object.keys(conteo.items);
      if (!ids.length) return UI.toast('No contaste ningún producto', 'warn');
      if (!(await UI.confirm(`Se ajustarán ${ids.length} productos al valor contado. ¿Continuar?`))) return;
      let valor = 0;
      ids.forEach(id => { const p = DB.prod(id); const d = round3(conteo.items[id] - p.stock); if (d) { DB.mov(p, d, 'conteo', d < 0 ? 'Faltante en conteo' : 'Sobrante en conteo'); valor += d * (p.costo || 0); } });
      DB.log('stock', 'Conteo cíclico aplicado', `${conteo.rubro || 'Todos'} · ${ids.length} productos · diferencia ${fmt(valor)}`);
      DB.d.conteos.push({ id: DB.uid(), fecha: Date.now(), rubro: conteo.rubro, items: ids.length, valor: round2(valor), usuario: App.user.nombre });
      DB.save();
      conteo = null;
      UI.toast(`Conteo aplicado. Diferencia valorizada: ${fmt(valor)}`, valor < 0 ? 'warn' : 'ok', 5000);
      App.refresh();
    };
  }

  function tabDeposito(v) {
    const list = DB.d.productos.filter(p => p.activo !== false && (p.stockDeposito || 0) > 0).sort((a, b) => a.nombre.localeCompare(b.nombre));
    v.innerHTML = `<div class="banner info">Control de depósito: mercadería guardada fuera de la góndola. Las ventas descuentan solo de góndola.</div>
      <div class="card" style="padding:0">${list.length ? `<div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Producto</th><th class="num">Góndola</th><th class="num">Depósito</th><th></th></tr></thead><tbody>
      ${list.map(p => `<tr><td>${esc(p.nombre)}</td><td class="num">${Productos.stockBadge(p)}</td><td class="num">${fmtN(p.stockDeposito, 3)}</td><td class="right"><button class="btn sm" data-tr="${p.id}">Pasar a góndola</button></td></tr>`).join('')}
      </tbody></table></div>` : UI.empty('No hay mercadería en depósito. Cargala desde Entrada → Ubicación: Depósito.')}</div>`;
    $$('[data-tr]', v).forEach(b => { b.onclick = () => ajuste(DB.prod(b.dataset.tr), 'transferir'); });
  }

  function tabMovs(v) {
    let tipo = '';
    v.innerHTML = `<div class="toolbar"><input class="input grow" id="mv-q" placeholder="Filtrar por producto…"><select class="input" id="mv-t" style="width:auto" aria-label="Tipo de movimiento"><option value="">Todos</option>${opts(['venta', 'entrada', 'salida', 'ajuste', 'conteo', 'compra', 'devolucion', 'transferencia', 'importacion', 'alta'], '')}</select><button class="btn" id="mv-exp">📤 Exportar</button></div><div class="card" style="padding:0"><div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Motivo</th><th class="num">Cant.</th><th class="num">Stock</th><th>Usuario</th></tr></thead><tbody id="mv-b"></tbody></table></div></div>`;
    const filtrados = () => { const q = norm($('#mv-q', v).value); return DB.d.movimientos.filter(m => (!tipo || m.tipo === tipo) && (!q || norm(m.nombre + ' ' + m.codigo).includes(q))).slice(-400).reverse(); };
    const draw = () => {
      const list = filtrados();
      $('#mv-b', v).innerHTML = list.length ? list.map(m => `<tr><td class="nowrap">${fechaHora(m.fecha)}</td><td>${esc(m.nombre)}</td><td>${esc(m.tipo)}${m.deposito ? ' (dep.)' : ''}</td><td>${esc(m.motivo)}</td><td class="num ${m.cant < 0 ? 'danger-t' : 'ok-t'}">${m.cant > 0 ? '+' : ''}${fmtN(m.cant, 3)}</td><td class="num">${fmtN(m.stock, 3)}</td><td>${esc(m.usuario)}</td></tr>`).join('') : `<tr><td colspan="7">${UI.empty('Sin movimientos')}</td></tr>`;
    };
    $('#mv-q', v).addEventListener('input', draw);
    $('#mv-t', v).onchange = e => { tipo = e.target.value; draw(); };
    $('#mv-exp', v).onclick = () => Excel.exportar('movimientos-stock', filtrados().map(m => ({ fecha: fechaHora(m.fecha), codigo: m.codigo, producto: m.nombre, tipo: m.tipo, motivo: m.motivo, cantidad: m.cant, stock: m.stock, usuario: m.usuario })));
    draw();
  }

  const TABS = [
    { id: 'alertas', label: '⚠️ Stock mínimo', f: tabAlertas }, { id: 'venc', label: '📅 Vencimientos', f: tabVenc },
    { id: 'ajuste', label: '🔧 Ajustes y salidas', f: tabAjuste }, { id: 'conteo', label: '🔢 Conteo cíclico', f: tabConteo },
    { id: 'deposito', label: '🏬 Depósito', f: tabDeposito }, { id: 'movs', label: '📜 Movimientos', f: tabMovs },
  ];

  function render(v, [t]) {
    if (t && TABS.some(x => x.id === t)) tab = t;
    const nb = bajos().length, nv = lotesPorVencer(DB.g.config.stock.diasVencimiento).length;
    v.innerHTML = `<div class="kpis">
      <div class="kpi ${nb ? 'warn' : 'ok'}"><small>Bajo mínimo</small><b>${nb}</b></div>
      <div class="kpi ${nv ? 'danger' : 'ok'}"><small>Vencidos / por vencer (${DB.g.config.stock.diasVencimiento} d)</small><b>${nv}</b></div>
      <div class="kpi"><small>Productos activos</small><b>${DB.d.productos.filter(p => p.activo !== false).length}</b></div>
      ${App.esAdmin() ? `<div class="kpi"><small>Stock valorizado (costo)</small><b>${fmt(sum(DB.d.productos, p => Math.max(0, p.stock + (p.stockDeposito || 0)) * (p.costo || 0)))}</b></div>` : ''}
    </div>${UI.tabs(TABS, tab)}<div id="st-body"></div>`;
    $$('[data-tab]', v).forEach(b => { b.onclick = () => { tab = b.dataset.tab; App.refresh(); }; });
    TABS.find(x => x.id === tab).f($('#st-body', v));
  }

  return { render, ajuste, bajos, lotesPorVencer, buscarProducto, generarOrdenes };
})();

App.register('stock', { title: 'Stock e inventario', icon: '📦', render: (v, r) => Stock.render(v, r) });
