/* Historial: registro de todo lo que se hace en el panel (quién, cuándo, qué y por cuánto) */
const Historial = (() => {
  const MOD = {
    ventas: ['Ventas', '#e0f2fe', '#0369a1'], caja: ['Caja', '#fef3c7', '#92400e'], stock: ['Stock', '#ede9fe', '#5b21b6'],
    productos: ['Productos', '#fce7f3', '#9d174d'], precios: ['Precios', '#dcfce7', '#166534'], clientes: ['Clientes', '#ffedd5', '#9a3412'],
    compras: ['Compras', '#e0e7ff', '#3730a3'], pedidos: ['Pedidos', '#cffafe', '#155e75'], recargas: ['Recargas', '#f3e8ff', '#6b21a8'],
    devoluciones: ['Devoluciones', '#fee2e2', '#991b1b'], usuarios: ['Usuarios', '#f1f5f9', '#334155'], config: ['Configuración', '#f1f5f9', '#334155'],
    sesion: ['Sesiones', '#f4f4f5', '#3f3f46'],
  };
  const SENSIBLE = /retiro|anulada|devolución|eliminado|cargo manual|ajuste|salida|restaurado/i;
  let f = { preset: 'hoy', desde: isoDate(), hasta: isoDate(), mod: '', usuario: '', q: '', limite: 300 };

  const PRESETS = { hoy: () => [isoDate(), isoDate()], ayer: () => [addDays(-1), addDays(-1)], semana: () => [addDays(-6), isoDate()], mes: () => [addDays(-29), isoDate()], todo: () => ['2000-01-01', '2999-12-31'] };

  function filtrar() {
    const w = norm(f.q).split(/\s+/).filter(Boolean);
    return (DB.d.historial || []).filter(h => {
      const d = isoDate(new Date(h.fecha));
      return d >= f.desde && d <= f.hasta && (!f.mod || h.modulo === f.mod) && (!f.usuario || h.usuario === f.usuario) && w.every(x => norm(`${h.accion} ${h.detalle} ${h.usuario} ${h.caja}`).includes(x));
    }).reverse();
  }

  function render(v) {
    const todo = DB.d.historial || [];
    const hoy = todo.filter(h => isoDate(new Date(h.fecha)) === isoDate());
    const usuarios = [...new Set(todo.map(h => h.usuario))].sort();
    const list = filtrar();
    const vis = list.slice(0, f.limite);
    const sens = hoy.filter(h => SENSIBLE.test(h.accion)).length;
    v.innerHTML = `<div class="kpis">
        <div class="kpi"><small>Acciones de hoy</small><b>${hoy.length}</b><span class="sub">${new Set(hoy.map(h => h.usuario)).size} personas</span></div>
        <div class="kpi"><small>Ventas registradas hoy</small><b>${hoy.filter(h => h.accion === 'Venta').length}</b><span class="sub">${fmt(sum(hoy.filter(h => h.accion === 'Venta'), h => h.monto))}</span></div>
        <div class="kpi ${sens ? 'warn' : 'ok'}"><small>Movimientos sensibles hoy</small><b>${sens}</b><span class="sub">Retiros, anulaciones, ajustes, devoluciones</span></div>
        <div class="kpi"><small>Registros guardados</small><b>${todo.length}</b><span class="sub">Últimos 8.000 movimientos</span></div>
      </div>
      <div class="card mb"><div class="row">
        ${Object.keys(PRESETS).map(k => `<button class="btn sm ${f.preset === k ? 'primary' : ''}" data-pr="${k}">${{ hoy: 'Hoy', ayer: 'Ayer', semana: '7 días', mes: '30 días', todo: 'Todo' }[k]}</button>`).join('')}
        <span class="grow"></span><input type="date" class="input" id="hs-d" value="${f.preset === 'todo' ? '' : f.desde}" style="width:auto" aria-label="Desde"><span>a</span><input type="date" class="input" id="hs-h" value="${f.preset === 'todo' ? '' : f.hasta}" style="width:auto" aria-label="Hasta"></div>
        <div class="toolbar mt" style="margin-bottom:0"><input class="input grow" id="hs-q" placeholder="Buscar: ticket, producto, cliente, motivo…" value="${esc(f.q)}">
          <select class="input" id="hs-mod" style="width:auto" aria-label="Sección"><option value="">Todas las secciones</option>${opts(Object.keys(MOD), f.mod, x => x, x => MOD[x][0])}</select>
          <select class="input" id="hs-u" style="width:auto" aria-label="Persona"><option value="">Todas las personas</option>${opts(usuarios, f.usuario)}</select>
          <button class="btn" id="hs-exp">📤 Exportar</button></div></div>
      <p class="muted small">${list.length} movimientos${list.length > vis.length ? ` · mostrando los ${vis.length} más recientes` : ''}</p>
      <div id="hs-list"></div>
      ${list.length > vis.length ? '<div class="center mt"><button class="btn" id="hs-more">Ver más</button></div>' : ''}`;
    let dia = '', html = '';
    vis.forEach(h => {
      const d = isoDate(new Date(h.fecha));
      if (d !== dia) {
        if (dia) html += '</div>';
        dia = d;
        const t = new Date(h.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
        html += `<div class="hist-day">${d === isoDate() ? 'Hoy · ' : ''}${t.charAt(0).toUpperCase() + t.slice(1)}</div><div class="hist-list">`;
      }
      const m = MOD[h.modulo] || [h.modulo, '#f1f5f9', '#334155'];
      html += `<div class="hist-row"><time>${new Date(h.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}</time>
        <span class="hist-mod" style="background:${m[1]};color:${m[2]}">${esc(m[0])}</span>
        <div><b>${SENSIBLE.test(h.accion) ? '⚠️ ' : ''}${esc(h.accion)}</b><div class="det">${esc(h.detalle)}</div><div class="who">${esc(h.usuario)} · ${esc(h.caja || '')}</div></div>
        <span class="amt">${h.monto != null ? fmt(h.monto) : ''}</span></div>`;
    });
    if (dia) html += '</div>';
    $('#hs-list', v).innerHTML = html || `<div class="card">${UI.empty('No hay movimientos con estos filtros. Todo lo que se haga en el panel queda registrado acá.')}</div>`;

    $$('[data-pr]', v).forEach(b => { b.onclick = () => { const [d, hh] = PRESETS[b.dataset.pr](); Object.assign(f, { preset: b.dataset.pr, desde: d, hasta: hh, limite: 300 }); App.refresh(); }; });
    const fechas = () => { Object.assign(f, { preset: '', desde: $('#hs-d', v).value || '2000-01-01', hasta: $('#hs-h', v).value || '2999-12-31' }); App.refresh(); };
    $('#hs-d', v).onchange = fechas;
    $('#hs-h', v).onchange = fechas;
    $('#hs-mod', v).onchange = e => { f.mod = e.target.value; App.refresh(); };
    $('#hs-u', v).onchange = e => { f.usuario = e.target.value; App.refresh(); };
    const q = $('#hs-q', v);
    q.addEventListener('input', () => { clearTimeout(render.t); render.t = setTimeout(() => { f.q = q.value; App.refresh(); const n = $('#hs-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 350); });
    $('#hs-exp', v).onclick = () => Excel.exportar(`historial-${f.desde}_${f.hasta}`.replace(/2000-01-01_2999-12-31/, 'completo'), list.map(h => ({
      fecha: fechaHora(h.fecha), persona: h.usuario, caja: h.caja, seccion: (MOD[h.modulo] || [h.modulo])[0], accion: h.accion, detalle: h.detalle, monto: h.monto ?? '',
    })), 'Historial');
    const more = $('#hs-more', v);
    if (more) more.onclick = () => { f.limite += 300; App.refresh(); };
  }
  return { render };
})();

App.register('historial', { title: 'Historial', icon: '🕘', render: v => Historial.render(v) });
