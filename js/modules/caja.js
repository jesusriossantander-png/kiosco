/* Caja y turnos: apertura, ingresos/retiros, cierre con arqueo ciego */
const Caja = {
  actual() { return DB.d.turnos.find(t => !t.cierre && t.caja === DB.device.caja) || null; },

  /* tipo: ingreso | retiro | cobro (fiado) | recarga | egreso (devolución) */
  registrar(tipo, medio, monto, motivo) {
    const t = this.actual();
    if (!t) return false;
    t.movs.push({ id: DB.uid(), fecha: Date.now(), tipo, medio, monto: round2(monto), motivo, usuario: App.user.nombre });
    DB.save();
    return true;
  },

  totales(t) {
    const pm = {};
    let nVentas = 0, totalVentas = 0;
    DB.d.ventas.filter(v => v.turnoId === t.id && !v.anulada).forEach(v => {
      nVentas++;
      totalVentas += v.total;
      v.pagos.forEach(p => { pm[p.medio] = round2((pm[p.medio] || 0) + p.monto); });
    });
    const signo = { ingreso: 1, cobro: 1, recarga: 1, retiro: -1, egreso: -1 };
    t.movs.forEach(m => { pm[m.medio] = round2((pm[m.medio] || 0) + (signo[m.tipo] || 0) * m.monto); });
    const esperado = {};
    DB.g.config.medios.filter(m => m.id !== 'fiado').forEach(m => { esperado[m.id] = round2(pm[m.id] || 0); });
    esperado.efectivo = round2((t.inicial || 0) + (pm.efectivo || 0));
    return { pm, nVentas, totalVentas: round2(totalVentas), esperado };
  },

  abrirModal(after) {
    const ult = DB.d.turnos.filter(t => t.cierre && t.caja === DB.device.caja).pop();
    const sugerido = ult ? round2((ult.declarado?.efectivo || 0) - (ult.retiroCierre || 0)) : 0;
    UI.modal({
      title: 'Abrir caja',
      body: `<div class="form">
        <label><span>Puesto de venta</span><input name="caja" value="${esc(DB.device.caja)}"></label>
        <label><span>Efectivo inicial en el cajón</span><input name="inicial" data-num inputmode="decimal" class="input xl" value="${sugerido || ''}" placeholder="0" autofocus></label>
        <p class="muted small">Responsable: <b>${esc(App.user.nombre)}</b> · ${fechaHora(Date.now())}</p></div>`,
      actions: [{ label: 'Cancelar' }, {
        label: 'Abrir caja', class: 'primary', onClick: (c, root) => {
          const f = UI.formData(root);
          if (f.caja && f.caja !== DB.device.caja) { DB.device.caja = f.caja; }
          if (this.actual()) { UI.toast('Esta caja ya está abierta', 'warn'); return; }
          DB.d.turnos.push({ id: DB.uid(), caja: DB.device.caja, usuarioId: App.user.id, usuario: App.user.nombre, apertura: Date.now(), inicial: round2(f.inicial), movs: [] });
          DB.save();
          UI.toast('Caja abierta', 'ok');
          App.chrome();
          setTimeout(() => (after ? after() : App.refresh()));
        },
      }],
    });
  },

  movimiento(tipo) {
    UI.modal({
      title: tipo === 'ingreso' ? 'Ingreso de dinero' : 'Retiro de dinero',
      body: `<div class="form"><label><span>Monto en efectivo</span><input name="monto" data-num inputmode="decimal" class="input xl" autofocus></label>
        <label><span>Motivo</span><input name="motivo" list="mot-caja" placeholder="${tipo === 'ingreso' ? 'Cambio, aporte…' : 'Pago a proveedor, retiro del dueño…'}"></label>
        <datalist id="mot-caja"><option>Cambio</option><option>Pago a proveedor</option><option>Retiro del dueño</option><option>Gastos varios</option><option>Depósito bancario</option></datalist></div>`,
      actions: [{ label: 'Cancelar' }, {
        label: 'Registrar', class: 'primary', onClick: async (c, root) => {
          const f = UI.formData(root);
          if (f.monto <= 0) { UI.toast('Ingresá un monto', 'warn'); return false; }
          if (tipo === 'retiro' && !(await UI.autorizar('Retiro de caja'))) return false;
          this.registrar(tipo, 'efectivo', f.monto, f.motivo || (tipo === 'ingreso' ? 'Ingreso' : 'Retiro'));
          HW.abrirCajon();
          UI.toast('Movimiento registrado', 'ok');
          App.refresh();
        },
      }],
    });
  },

  cerrar() {
    const t = this.actual();
    if (!t) return;
    const medios = DB.g.config.medios.filter(m => m.id !== 'fiado' && m.activo !== false);
    const denoms = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
    const body = h(`<div class="form">
      <div class="banner info">Arqueo ciego: contá lo que hay en la caja y cargalo. El sistema compara al confirmar.</div>
      <h3>Efectivo</h3>
      <p class="muted small">Contá por billete (opcional) o escribí el total.</p>
      <div class="denoms">${denoms.map(d => `<label><span>$ ${fmtN(d, 0)} ×</span><input type="number" min="0" data-d="${d}" class="input" inputmode="numeric"></label>`).join('')}</div>
      <label class="mt"><span>Total efectivo contado</span><input name="efectivo" data-num inputmode="decimal" class="input xl"></label>
      <h3 class="mt">Otros medios (sumá los comprobantes/cupones)</h3>
      <div class="grid2">${medios.filter(m => m.id !== 'efectivo').map(m => `<label><span>${esc(m.nombre)}</span><input name="${m.id}" data-num inputmode="decimal"></label>`).join('')}</div>
      <label><span>Efectivo que se retira al cerrar (queda el resto como cambio)</span><input name="retiroCierre" data-num inputmode="decimal"></label>
      <label><span>Observaciones</span><textarea name="obs" rows="2"></textarea></label></div>`);
    $$('[data-d]', body).forEach(i => i.addEventListener('input', () => {
      $('[name=efectivo]', body).value = round2($$('[data-d]', body).reduce((a, x) => a + (+x.value || 0) * +x.dataset.d, 0)) || '';
    }));
    UI.modal({
      title: `Cerrar caja · ${t.caja}`, size: 'wide', body,
      actions: [{ label: 'Cancelar' }, {
        label: 'Cerrar caja', class: 'danger', onClick: async (c, root) => {
          const f = UI.formData(root);
          if (!(await UI.confirm('¿Confirmás el cierre con los montos ingresados?', { ok: 'Cerrar caja', danger: true }))) return false;
          const tot = this.totales(t);
          const declarado = {}, dif = {};
          medios.forEach(m => { declarado[m.id] = round2(f[m.id] || 0); dif[m.id] = round2(declarado[m.id] - (tot.esperado[m.id] || 0)); });
          Object.assign(t, {
            cierre: Date.now(), cerradoPor: App.user.nombre, declarado, esperado: tot.esperado, diferencias: dif,
            diferencia: round2(Object.values(dif).reduce((a, b) => a + b, 0)), totalVentas: tot.totalVentas, nVentas: tot.nVentas,
            pm: tot.pm, retiroCierre: round2(f.retiroCierre), obs: f.obs,
          });
          DB.save();
          DB.autoBackup(true);
          App.chrome();
          App.refresh();
          setTimeout(() => this.resultado(t));
        },
      }],
    });
  },

  resultado(t) {
    const medios = Object.keys(t.declarado || {});
    const ver = App.esAdmin() || App.user.id === t.usuarioId;
    UI.modal({
      title: `Cierre de caja · ${t.caja}`, size: 'wide',
      body: `<p>${esc(t.usuario)} · ${fechaHora(t.apertura)} → ${fechaHora(t.cierre)} · ${t.nVentas} ventas · ${fmt(t.totalVentas)}</p>
      ${ver ? `<div class="table-wrap"><table class="table"><thead><tr><th>Medio</th><th class="num">Sistema</th><th class="num">Declarado</th><th class="num">Diferencia</th></tr></thead><tbody>
      ${medios.map(m => `<tr><td>${esc(medioNombre(m))}</td><td class="num">${fmt(t.esperado[m])}</td><td class="num">${fmt(t.declarado[m])}</td><td class="num ${t.diferencias[m] < 0 ? 'danger-t' : t.diferencias[m] > 0 ? 'warn-t' : 'ok-t'}">${fmt(t.diferencias[m])}</td></tr>`).join('')}
      </tbody><tfoot><tr><th>Total</th><th></th><th></th><th class="num">${fmt(t.diferencia)}</th></tr></tfoot></table></div>
      ${t.pm.fiado ? `<p class="muted small">Ventas fiadas en el turno: ${fmt(t.pm.fiado)}</p>` : ''}` : '<p>Caja cerrada correctamente.</p>'}
      ${t.obs ? `<p class="muted">Obs.: ${esc(t.obs)}</p>` : ''}`,
      actions: [{ label: '🖨️ Imprimir', onClick: () => { this.imprimir(t); return false; } }, { label: 'Listo', class: 'primary' }],
    });
  },

  imprimir(t) {
    const rows = Ticket.cabecera('CIERRE DE CAJA');
    rows.push(['Caja', t.caja], ['Responsable', t.usuario], ['Apertura', fechaHora(t.apertura)], ['Cierre', fechaHora(t.cierre)], ['Ventas', `${t.nVentas} · ${fmt(t.totalVentas)}`], ['Efectivo inicial', fmt(t.inicial)], '-');
    Object.keys(t.declarado).forEach(m => { rows.push(medioNombre(m), ['  Sistema / Declarado', `${fmt(t.esperado[m])} / ${fmt(t.declarado[m])}`], ['  Diferencia', fmt(t.diferencias[m])]); });
    rows.push('-', ['DIFERENCIA TOTAL', fmt(t.diferencia)]);
    if (t.retiroCierre) rows.push(['Retirado al cierre', fmt(t.retiroCierre)]);
    Ticket.imprimir(rows, { titulo: `Cierre de caja · ${t.caja}` });
  },
};

App.register('caja', {
  title: 'Caja y turnos', icon: '💰',
  render(v) {
    const t = Caja.actual();
    const admin = App.esAdmin();
    const abiertas = DB.d.turnos.filter(x => !x.cierre && x.caja !== DB.device.caja);
    let html = '';
    if (!t) {
      html += `<div class="card center"><p style="font-size:40px;margin:6px">🔒</p><h2>${esc(DB.device.caja)} está cerrada</h2>
        <p class="muted">Abrí la caja para empezar a vender. Cada empleado abre y cierra su turno.</p>
        <button class="btn primary lg" id="cj-abrir">Abrir caja</button></div>`;
    } else {
      const tot = Caja.totales(t);
      const medios = DB.g.config.medios;
      html += `<div class="kpis">
        <div class="kpi ok"><small>Caja</small><b>${esc(t.caja)}</b><span class="sub">Abierta por ${esc(t.usuario)} · ${fechaHora(t.apertura)}</span></div>
        <div class="kpi"><small>Ventas del turno</small><b>${tot.nVentas}</b><span class="sub">${admin ? fmt(tot.totalVentas) : ''}</span></div>
        <div class="kpi"><small>Efectivo inicial</small><b>${fmt(t.inicial)}</b></div>
        ${admin ? `<div class="kpi"><small>Efectivo esperado</small><b>${fmt(tot.esperado.efectivo)}</b><span class="sub">No visible para cajeros (arqueo ciego)</span></div>` : ''}
      </div>
      <div class="card"><div class="row">
        <button class="btn" id="cj-ing">➕ Ingreso</button><button class="btn" id="cj-ret">➖ Retiro</button>
        <button class="btn" id="cj-cajon">🗄️ Abrir cajón</button><span class="grow"></span>
        <button class="btn danger lg" id="cj-cerrar">Cerrar caja (arqueo)</button></div></div>
      ${admin ? `<div class="card"><h3>Totales por medio de pago</h3><div class="table-wrap mt"><table class="table"><tbody>
        ${medios.map(m => `<tr><td>${m.icon} ${esc(m.nombre)}</td><td class="num">${fmt(tot.pm[m.id] || 0)}</td></tr>`).join('')}
      </tbody></table></div></div>` : ''}
      <div class="card"><h3>Movimientos de caja</h3>${t.movs.length ? `<ul class="list-plain mt">${t.movs.slice().reverse().map(m => `<li><span>${fechaHora(m.fecha)} · <b>${esc(m.tipo)}</b> · ${esc(m.motivo || '')} <small class="muted">(${esc(medioNombre(m.medio))}, ${esc(m.usuario)})</small></span><b class="${['retiro', 'egreso'].includes(m.tipo) ? 'danger-t' : 'ok-t'}">${['retiro', 'egreso'].includes(m.tipo) ? '-' : '+'}${fmt(m.monto)}</b></li>`).join('')}</ul>` : UI.empty('Sin movimientos manuales')}</div>`;
    }
    if (abiertas.length) html += `<div class="card"><h3>Otras cajas abiertas en esta sucursal</h3><ul class="list-plain mt">${abiertas.map(x => `<li><span>${esc(x.caja)} · ${esc(x.usuario)}</span><small>${fechaHora(x.apertura)}</small></li>`).join('')}</ul></div>`;
    const hist = DB.d.turnos.filter(x => x.cierre && (admin || x.usuarioId === App.user.id)).slice(-60).reverse();
    html += `<div class="card"><div class="card-h"><h3>Historial de turnos</h3></div>${hist.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Cierre</th><th>Caja</th><th>Empleado</th><th class="num">Ventas</th>${admin ? '<th class="num">Diferencia</th>' : ''}</tr></thead><tbody>
      ${hist.map(x => `<tr class="click" data-t="${x.id}"><td>${fechaHora(x.cierre)}</td><td>${esc(x.caja)}</td><td>${esc(x.usuario)}</td><td class="num">${x.nVentas} · ${fmt(x.totalVentas)}</td>${admin ? `<td class="num ${x.diferencia < 0 ? 'danger-t' : x.diferencia > 0 ? 'warn-t' : 'ok-t'}">${fmt(x.diferencia)}</td>` : ''}</tr>`).join('')}
      </tbody></table></div>` : UI.empty('Todavía no hay turnos cerrados')}</div>`;
    v.innerHTML = html;
    const on = (id, f) => { const b = $(id, v); if (b) b.onclick = f; };
    on('#cj-abrir', () => Caja.abrirModal());
    on('#cj-ing', () => Caja.movimiento('ingreso'));
    on('#cj-ret', () => Caja.movimiento('retiro'));
    on('#cj-cajon', () => HW.abrirCajon());
    on('#cj-cerrar', () => Caja.cerrar());
    $$('[data-t]', v).forEach(r => { r.onclick = () => Caja.resultado(DB.d.turnos.find(x => x.id === r.dataset.t)); });
  },
});
