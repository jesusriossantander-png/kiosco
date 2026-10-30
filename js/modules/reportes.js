/* Reportes: ventas, artículos, rubros, rentabilidad, caja por empleado y faltantes */
const Reportes = (() => {
  let rango = { desde: isoDate(), hasta: isoDate(), preset: 'hoy' };
  let tab = 'resumen';

  const enRango = ts => { const d = isoDate(new Date(ts)); return d >= rango.desde && d <= rango.hasta; };
  const ventas = () => DB.d.ventas.filter(v => !v.anulada && enRango(v.fecha));
  const costoVenta = v => sum(v.items, i => i.cant * (i.costo || 0));
  /* Ventas netas de devoluciones por ítem */
  function porArticulo(vs) {
    const m = {};
    vs.forEach(v => {
      const f = v.subtotal ? v.total / v.subtotal : 1;
      v.items.forEach(i => {
        const k = i.pid || 'varios';
        const r = (m[k] ||= { pid: i.pid, nombre: i.nombre, rubro: i.rubro || 'Varios', cant: 0, total: 0, costo: 0 });
        r.cant = round3(r.cant + i.cant);
        r.total = round2(r.total + i.cant * i.precio * f);
        r.costo = round2(r.costo + i.cant * (i.costo || 0));
      });
    });
    DB.d.devoluciones.filter(d => enRango(d.fecha)).forEach(d => d.items.forEach(i => {
      const r = m[i.pid || 'varios'];
      if (r) { r.cant = round3(r.cant - i.cant); r.total = round2(r.total - i.monto); r.costo = round2(r.costo - i.cant * (i.costo || 0)); }
    }));
    return Object.values(m).map(r => ({ ...r, gan: round2(r.total - r.costo), mg: r.costo > 0 ? round2((r.total - r.costo) / r.costo * 100) : null }));
  }

  function verVenta(v) {
    UI.modal({
      title: `Ticket #${v.nro}`, size: 'wide',
      body: `<p>${fechaHora(v.fecha)} · ${esc(v.caja)} · ${esc(v.usuario)}${v.cliente ? ' · Cliente: ' + esc(v.cliente) : ''}${v.anulada ? ' · <span class="badge danger">ANULADA</span>' : ''}</p>
        <div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Subtotal</th></tr></thead><tbody>
        ${v.items.map(i => `<tr><td>${esc(i.nombre)}</td><td class="num">${fmtN(i.cant, 3)}</td><td class="num">${fmt(i.precio)}</td><td class="num">${fmt(i.cant * i.precio)}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="totals">${v.descuento ? `<div><span>Descuento ${v.descPct}%</span><span>-${fmt(v.descuento)}</span></div>` : ''}<div class="big"><span>Total</span><span>${fmt(v.total)}</span></div>
        ${v.pagos.map(p => `<div><span>${esc(medioNombre(p.medio))}</span><span>${fmt(p.monto)}</span></div>`).join('')}${v.vuelto ? `<div><span>Vuelto</span><span>${fmt(v.vuelto)}</span></div>` : ''}</div>
        <p class="muted small">Facturación electrónica ARCA: desactivada · comprobante interno</p>`,
      actions: [
        ...(!v.anulada && App.can('devoluciones') ? [{ label: '↩️ Devolución', onClick: () => { setTimeout(() => Devoluciones.desdeVenta(v)); } }] : []),
        ...(!v.anulada && App.esAdmin() ? [{ label: 'Anular', class: 'danger', onClick: async () => { await anular(v); } }] : []),
        { label: '🖨️ Reimprimir', onClick: () => { Ticket.venta(v); return false; } },
        { label: 'Cerrar', class: 'primary' },
      ],
    });
  }

  async function anular(v) {
    if (DB.d.devoluciones.some(d => d.ventaId === v.id)) { UI.toast('La venta tiene devoluciones: no se puede anular', 'warn'); return false; }
    if (!(await UI.confirm(`¿Anular el ticket #${v.nro}? Se devuelve el stock y se revierte el fiado.`, { danger: true, ok: 'Anular' }))) return false;
    v.anulada = true;
    v.anuladaPor = App.user.nombre;
    v.items.forEach(i => { const p = i.pid && DB.prod(i.pid); if (p) DB.mov(p, i.cant, 'devolucion', `Anulación ticket #${v.nro}`); });
    const fiado = sum(v.pagos.filter(p => p.medio === 'fiado'), p => p.monto);
    const c = v.clienteId && DB.cliente(v.clienteId);
    if (fiado && c) { c.saldo = round2(c.saldo - fiado); c.movs.push({ id: DB.uid(), fecha: Date.now(), tipo: 'pago', monto: fiado, medio: 'anulacion', nota: `Anulación ticket #${v.nro}`, usuario: App.user.nombre }); }
    DB.save();
    UI.toast(`Ticket #${v.nro} anulado`, 'ok');
    App.refresh();
  }

  function tabResumen(v, vs) {
    const total = sum(vs, x => x.total);
    const costo = sum(vs, costoVenta);
    const devs = sum(DB.d.devoluciones.filter(d => enRango(d.fecha)), d => d.total);
    const pm = {};
    vs.forEach(x => x.pagos.forEach(p => { pm[p.medio] = round2((pm[p.medio] || 0) + p.monto); }));
    const dias = {};
    vs.forEach(x => { const d = isoDate(new Date(x.fecha)); dias[d] = round2((dias[d] || 0) + x.total); });
    const horas = Array.from({ length: 24 }, (_, i) => ({ label: String(i), value: 0 }));
    vs.forEach(x => { horas[new Date(x.fecha).getHours()].value += x.total; });
    const recs = DB.d.recargas.filter(r => enRango(r.fecha));
    v.innerHTML = `<div class="kpis">
      <div class="kpi"><small>Ventas</small><b>${fmt(total)}</b><span class="sub">${vs.length} tickets</span></div>
      <div class="kpi"><small>Ticket promedio</small><b>${fmt(vs.length ? total / vs.length : 0)}</b></div>
      <div class="kpi ok"><small>Ganancia bruta</small><b>${fmt(total - costo - devs)}</b><span class="sub">Margen ${costo ? fmtN((total - costo) / costo * 100, 1) : 0}% s/costo</span></div>
      <div class="kpi ${devs ? 'warn' : ''}"><small>Devoluciones</small><b>${fmt(devs)}</b></div>
      <div class="kpi"><small>Recargas</small><b>${fmt(sum(recs, r => r.monto))}</b><span class="sub">Comisión ${fmt(sum(recs, r => r.comision))}</span></div>
    </div>
    <div class="grid">
      <div class="card"><h3>Por medio de pago</h3><div class="mt">${UI.bars(Object.entries(pm).map(([k, val]) => ({ label: medioNombre(k), value: val })).sort((a, b) => b.value - a.value))}</div></div>
      <div class="card"><h3>Ventas por día</h3>${Object.keys(dias).length > 1 ? UI.vbars(Object.entries(dias).sort().slice(-31).map(([d, val]) => ({ label: d.slice(8) + '/' + d.slice(5, 7), value: val }))) : `<div class="mt">${UI.bars(Object.entries(dias).map(([d, val]) => ({ label: fechaISO(d), value: val })))}</div>`}</div>
      <div class="card"><h3>Ventas por hora</h3>${UI.vbars(horas.slice(6).concat(horas.slice(0, 6)).map(x => ({ ...x, value: round2(x.value) })))}</div>
    </div>
    <div class="card"><div class="card-h"><h3>Tickets del período</h3><button class="btn sm" id="rp-exp">📤 Exportar</button></div>
      ${vs.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Fecha</th><th>Caja / empleado</th><th>Cliente</th><th>Pago</th><th class="num">Total</th></tr></thead><tbody>
      ${vs.slice().reverse().slice(0, 300).map(x => `<tr class="click" data-v="${x.id}"><td>${x.nro}</td><td class="nowrap">${fechaHora(x.fecha)}</td><td>${esc(x.caja)} · ${esc(x.usuario)}</td><td>${esc(x.cliente || '—')}</td><td>${x.pagos.map(p => esc(medioNombre(p.medio))).join(' + ')}</td><td class="num">${fmt(x.total)}</td></tr>`).join('')}
      </tbody></table></div>` : UI.empty('Sin ventas en el período')}</div>`;
    $$('[data-v]', v).forEach(r => { r.onclick = () => verVenta(DB.d.ventas.find(x => x.id === r.dataset.v)); });
    $('#rp-exp', v).onclick = () => Excel.exportar(`ventas-${rango.desde}_${rango.hasta}`, vs.map(x => ({ ticket: x.nro, fecha: fechaHora(x.fecha), caja: x.caja, empleado: x.usuario, cliente: x.cliente, medios: x.pagos.map(p => `${medioNombre(p.medio)} ${p.monto}`).join(' + '), descuento: x.descuento, total: x.total, costo: costoVenta(x) })));
  }

  function tabArticulos(v, vs) {
    const arts = porArticulo(vs);
    const top = arts.slice().sort((a, b) => b.cant - a.cant);
    const vendidos = new Set(arts.map(a => a.pid));
    const sinVenta = DB.d.productos.filter(p => p.activo !== false && !vendidos.has(p.id));
    const menos = top.slice().reverse().slice(0, 10);
    v.innerHTML = `<div class="grid">
      <div class="card"><h3>🔥 Más vendidos (unidades)</h3><div class="mt">${UI.bars(top.slice(0, 10).map(a => ({ label: a.nombre, value: a.cant })), x => fmtN(x, 3))}</div></div>
      <div class="card"><h3>🐢 Menos vendidos</h3><div class="mt">${UI.bars(menos.map(a => ({ label: a.nombre, value: a.cant })), x => fmtN(x, 3))}</div>
        ${sinVenta.length ? `<p class="muted small mt">Sin ventas en el período (${sinVenta.length}): ${sinVenta.slice(0, 15).map(p => esc(p.nombre)).join(', ')}${sinVenta.length > 15 ? '…' : ''}</p>` : ''}</div>
    </div>
    <div class="card"><div class="card-h"><h3>Rentabilidad por artículo</h3><button class="btn sm" id="ra-exp">📤 Exportar</button></div>
      ${arts.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Artículo</th><th>Rubro</th><th class="num">Cant.</th><th class="num">Ventas</th><th class="num">Costo</th><th class="num">Ganancia</th><th class="num">Margen</th></tr></thead><tbody>
      ${arts.sort((a, b) => b.gan - a.gan).map(a => `<tr><td>${esc(a.nombre)}</td><td>${esc(a.rubro)}</td><td class="num">${fmtN(a.cant, 3)}</td><td class="num">${fmt(a.total)}</td><td class="num">${fmt(a.costo)}</td><td class="num">${fmt(a.gan)}</td><td class="num">${a.mg == null ? '—' : fmtN(a.mg, 1) + '%'}</td></tr>`).join('')}
      </tbody></table></div>` : UI.empty('Sin ventas en el período')}</div>`;
    $('#ra-exp', v).onclick = () => Excel.exportar('rentabilidad-articulos', arts.map(a => ({ articulo: a.nombre, rubro: a.rubro, cantidad: a.cant, ventas: a.total, costo: a.costo, ganancia: a.gan, margen: a.mg })));
  }

  function tabRubros(v, vs) {
    const m = {};
    porArticulo(vs).forEach(a => { const r = (m[a.rubro] ||= { rubro: a.rubro, cant: 0, total: 0, costo: 0 }); r.cant += a.cant; r.total += a.total; r.costo += a.costo; });
    const list = Object.values(m).map(r => ({ ...r, gan: round2(r.total - r.costo), mg: r.costo ? round2((r.total - r.costo) / r.costo * 100) : null })).sort((a, b) => b.total - a.total);
    v.innerHTML = `<div class="grid"><div class="card"><h3>Ventas por rubro</h3><div class="mt">${UI.bars(list.map(r => ({ label: r.rubro, value: r.total })))}</div></div>
      <div class="card"><h3>Ganancia por rubro</h3><div class="mt">${UI.bars(list.map(r => ({ label: r.rubro, value: r.gan })).sort((a, b) => b.value - a.value))}</div></div></div>
      <div class="card"><div class="card-h"><h3>Detalle</h3><button class="btn sm" id="rr-exp">📤 Exportar</button></div>${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Rubro</th><th class="num">Unidades</th><th class="num">Ventas</th><th class="num">Costo</th><th class="num">Ganancia</th><th class="num">Margen</th></tr></thead><tbody>
      ${list.map(r => `<tr><td>${DB.EMOJI[r.rubro] || '📦'} ${esc(r.rubro)}</td><td class="num">${fmtN(r.cant, 3)}</td><td class="num">${fmt(r.total)}</td><td class="num">${fmt(r.costo)}</td><td class="num">${fmt(r.gan)}</td><td class="num">${r.mg == null ? '—' : fmtN(r.mg, 1) + '%'}</td></tr>`).join('')}</tbody></table></div>` : UI.empty('Sin ventas')}</div>`;
    $('#rr-exp', v).onclick = () => Excel.exportar('rentabilidad-rubros', list.map(r => ({ rubro: r.rubro, unidades: round3(r.cant), ventas: round2(r.total), costo: round2(r.costo), ganancia: r.gan, margen: r.mg })));
  }

  function tabCaja(v) {
    const ts = DB.d.turnos.filter(t => t.cierre && enRango(t.cierre));
    const emp = {};
    ts.forEach(t => { const e = (emp[t.usuario] ||= { usuario: t.usuario, turnos: 0, ventas: 0, dif: 0, faltantes: 0 }); e.turnos++; e.ventas += t.totalVentas; e.dif += t.diferencia; if (t.diferencia < 0) e.faltantes++; });
    v.innerHTML = `<div class="card"><h3>Diferencias de caja por empleado</h3>${Object.keys(emp).length ? `<div class="table-wrap mt"><table class="table"><thead><tr><th>Empleado</th><th class="num">Turnos</th><th class="num">Ventas</th><th class="num">Turnos con faltante</th><th class="num">Diferencia acumulada</th></tr></thead><tbody>
      ${Object.values(emp).map(e => `<tr><td>${esc(e.usuario)}</td><td class="num">${e.turnos}</td><td class="num">${fmt(e.ventas)}</td><td class="num">${e.faltantes}</td><td class="num ${e.dif < 0 ? 'danger-t' : e.dif > 0 ? 'warn-t' : 'ok-t'}">${fmt(e.dif)}</td></tr>`).join('')}</tbody></table></div>` : UI.empty('Sin turnos cerrados en el período')}</div>
      <div class="card"><h3>Turnos</h3>${ts.length ? `<div class="table-wrap mt"><table class="table"><thead><tr><th>Cierre</th><th>Caja</th><th>Empleado</th><th class="num">Ventas</th>${Object.keys(ts[0].declarado).map(m => `<th class="num">Dif. ${esc(medioNombre(m))}</th>`).join('')}<th class="num">Total dif.</th></tr></thead><tbody>
      ${ts.slice().reverse().map(t => `<tr class="click" data-t="${t.id}"><td class="nowrap">${fechaHora(t.cierre)}</td><td>${esc(t.caja)}</td><td>${esc(t.usuario)}</td><td class="num">${fmt(t.totalVentas)}</td>${Object.keys(ts[0].declarado).map(m => `<td class="num">${fmt(t.diferencias[m] || 0)}</td>`).join('')}<td class="num ${t.diferencia < 0 ? 'danger-t' : ''}"><b>${fmt(t.diferencia)}</b></td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
    $$('[data-t]', v).forEach(r => { r.onclick = () => Caja.resultado(DB.d.turnos.find(t => t.id === r.dataset.t)); });
  }

  function tabFaltantes(v) {
    const movs = DB.d.movimientos.filter(m => enRango(m.fecha) && m.cant < 0 && (m.tipo === 'conteo' || (m.tipo === 'salida' && /robo|faltante|merma|rotura|vencid/i.test(m.motivo))));
    const m = {};
    movs.forEach(x => { const r = (m[x.pid] ||= { nombre: x.nombre, rubro: x.rubro || '', cant: 0, valor: 0, motivos: {} }); r.cant = round3(r.cant - x.cant); r.valor = round2(r.valor - x.cant * x.costo); const k = x.tipo === 'conteo' ? 'Faltante en conteo' : x.motivo; r.motivos[k] = round3((r.motivos[k] || 0) - x.cant); });
    const list = Object.values(m).sort((a, b) => b.valor - a.valor);
    const motivos = {};
    movs.forEach(x => { const k = x.tipo === 'conteo' ? 'Faltante en conteo' : x.motivo; motivos[k] = round2((motivos[k] || 0) - x.cant * x.costo); });
    v.innerHTML = `<div class="banner info">Incluye faltantes detectados en conteos cíclicos y salidas por merma, rotura, vencimiento o robo. Valorizado a costo.</div>
      <div class="kpis"><div class="kpi danger"><small>Pérdida valorizada</small><b>${fmt(sum(list, r => r.valor))}</b></div><div class="kpi"><small>Productos afectados</small><b>${list.length}</b></div></div>
      <div class="grid"><div class="card"><h3>Por motivo</h3><div class="mt">${UI.bars(Object.entries(motivos).map(([k, val]) => ({ label: k, value: val })).sort((a, b) => b.value - a.value))}</div></div>
      <div class="card"><h3>Productos con más faltantes</h3><div class="mt">${UI.bars(list.slice(0, 10).map(r => ({ label: r.nombre, value: r.valor })))}</div></div></div>
      <div class="card"><div class="card-h"><h3>Detalle</h3><button class="btn sm" id="rf-exp">📤 Exportar</button></div>${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th>Rubro</th><th>Motivos</th><th class="num">Unidades</th><th class="num">Valor</th></tr></thead><tbody>
      ${list.map(r => `<tr><td>${esc(r.nombre)}</td><td>${esc(r.rubro)}</td><td class="small">${Object.entries(r.motivos).map(([k, c]) => `${esc(k)}: ${fmtN(c, 3)}`).join(' · ')}</td><td class="num">${fmtN(r.cant, 3)}</td><td class="num danger-t">${fmt(r.valor)}</td></tr>`).join('')}</tbody></table></div>` : UI.empty('Sin faltantes registrados en el período 👍')}</div>`;
    $('#rf-exp', v).onclick = () => Excel.exportar('faltantes', list.map(r => ({ producto: r.nombre, rubro: r.rubro, unidades: r.cant, valor: r.valor, motivos: Object.entries(r.motivos).map(([k, c]) => `${k}: ${c}`).join(' | ') })));
  }

  const PRESETS = {
    hoy: () => [isoDate(), isoDate()], ayer: () => [addDays(-1), addDays(-1)], semana: () => [addDays(-6), isoDate()],
    mes: () => { const d = new Date(); return [isoDate(new Date(d.getFullYear(), d.getMonth(), 1)), isoDate()]; },
    mesant: () => { const d = new Date(); return [isoDate(new Date(d.getFullYear(), d.getMonth() - 1, 1)), isoDate(new Date(d.getFullYear(), d.getMonth(), 0))]; },
    anio: () => [`${new Date().getFullYear()}-01-01`, isoDate()],
  };
  const TABS = [{ id: 'resumen', label: '📊 Ventas', f: tabResumen }, { id: 'articulos', label: '🏷️ Por artículo', f: tabArticulos }, { id: 'rubros', label: '🗂️ Por rubro', f: tabRubros }, { id: 'caja', label: '💰 Caja y empleados', f: tabCaja }, { id: 'faltantes', label: '🕵️ Faltantes y merma', f: tabFaltantes }];

  function render(v) {
    v.innerHTML = `<div class="card mb"><div class="row">
      ${[['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', '7 días'], ['mes', 'Este mes'], ['mesant', 'Mes anterior'], ['anio', 'Año']].map(([k, l]) => `<button class="btn sm ${rango.preset === k ? 'primary' : ''}" data-pr="${k}">${l}</button>`).join('')}
      <span class="grow"></span><input type="date" class="input" id="rp-d" value="${rango.desde}" style="width:auto"><span>a</span><input type="date" class="input" id="rp-h" value="${rango.hasta}" style="width:auto"></div></div>
      ${UI.tabs(TABS, tab)}<div id="rp-body"></div>`;
    $$('[data-pr]', v).forEach(b => { b.onclick = () => { const [d, hh] = PRESETS[b.dataset.pr](); rango = { desde: d, hasta: hh, preset: b.dataset.pr }; App.refresh(); }; });
    const custom = () => { rango = { desde: $('#rp-d', v).value || isoDate(), hasta: $('#rp-h', v).value || isoDate(), preset: '' }; App.refresh(); };
    $('#rp-d', v).onchange = custom;
    $('#rp-h', v).onchange = custom;
    $$('[data-tab]', v).forEach(b => { b.onclick = () => { tab = b.dataset.tab; App.refresh(); }; });
    TABS.find(x => x.id === tab).f($('#rp-body', v), ventas());
  }

  return { render, verVenta, porArticulo };
})();

App.register('reportes', { title: 'Reportes', icon: '📊', render: v => Reportes.render(v) });
