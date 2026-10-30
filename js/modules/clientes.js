/* Clientes y cuentas corrientes (el "fiado" digital) */
const Clientes = (() => {
  function editar(c, after) {
    const nuevo = !c;
    c = c || { nombre: '', dni: '', tel: '', direccion: '', email: '', limite: 20000, saldo: 0, lista: 0, notas: '', movs: [] };
    UI.modal({
      title: nuevo ? 'Nuevo cliente' : 'Editar cliente',
      body: `<form class="form">
        <label><span>Nombre y apellido *</span><input name="nombre" value="${esc(c.nombre)}" autofocus></label>
        <div class="grid2"><label><span>DNI / CUIT</span><input name="dni" value="${esc(c.dni)}" inputmode="numeric"></label><label><span>Teléfono / WhatsApp</span><input name="tel" value="${esc(c.tel)}" inputmode="tel" placeholder="11 2345 6789"></label></div>
        <label><span>Dirección</span><input name="direccion" value="${esc(c.direccion)}"></label>
        <div class="grid2"><label><span>Límite de crédito (0 = sin límite)</span><input name="limite" data-num inputmode="decimal" value="${c.limite || 0}"></label>
        <label><span>Lista de precios</span><select name="lista">${opts(DB.g.config.listas.map((n, i) => ({ n, i })), c.lista || 0, x => x.i, x => x.n)}</select></label></div>
        <label><span>Notas</span><textarea name="notas" rows="2">${esc(c.notas)}</textarea></label></form>`,
      actions: [{ label: 'Cancelar' }, {
        label: 'Guardar', class: 'primary', onClick: async (cl, root) => {
          const f = UI.formData(root);
          if (!f.nombre) { UI.toast('Falta el nombre', 'warn'); return false; }
          if (!nuevo && f.limite !== c.limite && !(await UI.autorizar('Cambiar límite de crédito'))) return false;
          Object.assign(c, { nombre: f.nombre, dni: f.dni, tel: f.tel, direccion: f.direccion, limite: f.limite, lista: +f.lista, notas: f.notas });
          if (nuevo) { c.id = DB.uid(); DB.d.clientes.push(c); }
          DB.log('clientes', nuevo ? 'Cliente creado' : 'Cliente modificado', `${c.nombre}${c.limite ? ' · límite ' + fmt(c.limite) : ''}`);
          DB.save();
          UI.toast('Cliente guardado', 'ok');
          if (after) after(c); else if (App.current?.id === 'clientes') App.refresh();
        },
      }],
    });
  }

  function waLink(tel, texto) {
    let n = String(tel || '').replace(/\D/g, '');
    if (n && !n.startsWith('54')) n = '549' + n.replace(/^0/, '').replace(/^(\d{2,4})15/, '$1');
    return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
  }

  function pago(c, after) {
    const medios = DB.g.config.medios.filter(m => m.id !== 'fiado' && m.activo !== false);
    UI.modal({
      title: `Registrar pago · ${c.nombre}`,
      body: `<div class="form"><p>Deuda actual: <b class="danger-t">${fmt(c.saldo)}</b></p>
        <label><span>Monto que paga</span><input name="monto" data-num inputmode="decimal" class="input xl" value="${c.saldo > 0 ? String(c.saldo).replace('.', ',') : ''}" autofocus></label>
        <label><span>Medio de pago</span><select name="medio">${opts(medios, 'efectivo', x => x.id, x => x.nombre)}</select></label>
        <label><span>Nota</span><input name="nota" placeholder="Opcional"></label>
        <label class="check"><input type="checkbox" name="imprimir"> Imprimir comprobante</label></div>`,
      actions: [{ label: 'Cancelar' }, {
        label: 'Registrar pago', class: 'primary', onClick: (cl, root) => {
          const f = UI.formData(root);
          if (f.monto <= 0) { UI.toast('Ingresá un monto', 'warn'); return false; }
          c.saldo = round2(c.saldo - f.monto);
          c.movs.push({ id: DB.uid(), fecha: Date.now(), tipo: 'pago', monto: f.monto, medio: f.medio, nota: f.nota, usuario: App.user.nombre });
          const enCaja = Caja.registrar('cobro', f.medio, f.monto, `Cobro cta. cte. ${c.nombre}`);
          DB.log('clientes', 'Pago de fiado', `${c.nombre} · ${medioNombre(f.medio)} · saldo ${fmt(c.saldo)}`, f.monto);
          DB.save();
          UI.toast(`Pago registrado. Saldo: ${fmt(c.saldo)}${enCaja ? '' : ' (caja cerrada: no se sumó al turno)'}`, enCaja ? 'ok' : 'warn', 5000);
          if (f.imprimir) {
            const r = Ticket.cabecera('RECIBO DE PAGO');
            r.push(['Fecha', fechaHora(Date.now())], ['Cliente', c.nombre], ['Medio', medioNombre(f.medio)], '-', ['PAGO', fmt(f.monto)], ['Saldo pendiente', fmt(c.saldo)]);
            Ticket.imprimir(r, { titulo: 'Recibo de pago' });
          }
          if (f.medio === 'efectivo' && enCaja && HW.pWriter) HW.abrirCajon();
          after ? after() : App.refresh();
        },
      }],
    });
  }

  function detalle(c) {
    const body = h('<div></div>');
    const draw = () => {
      const movs = c.movs.slice().reverse();
      let saldo = c.saldo;
      const filas = movs.map(m => { const s = saldo; saldo = round2(saldo - (m.tipo === 'cargo' ? m.monto : -m.monto)); return { m, s }; });
      body.innerHTML = `<div class="kpis"><div class="kpi ${c.saldo > 0 ? 'danger' : 'ok'}"><small>Saldo deudor</small><b>${fmt(c.saldo)}</b></div>
        <div class="kpi"><small>Límite</small><b>${c.limite ? fmt(c.limite) : 'Sin límite'}</b>${c.limite ? `<span class="sub">Disponible ${fmt(Math.max(0, c.limite - c.saldo))}</span>` : ''}</div>
        <div class="kpi"><small>Lista</small><b style="font-size:16px">${esc(DB.g.config.listas[c.lista || 0])}</b></div></div>
        <p class="muted small">${esc([c.dni, c.tel, c.direccion].filter(Boolean).join(' · '))}</p>
        <div class="row mb"><button class="btn primary" data-a="pago">💵 Registrar pago</button><button class="btn" data-a="cargo">➕ Cargo manual</button><button class="btn" data-a="edit">✏️ Editar</button>${c.tel ? `<a class="btn" target="_blank" rel="noopener" href="${waLink(c.tel, `Hola ${c.nombre}, te escribimos de ${DB.g.config.negocio.nombre}. Tu saldo en cuenta corriente es de ${fmt(c.saldo)}. ¡Gracias!`)}">💬 Enviar saldo por WhatsApp</a>` : ''}</div>
        ${filas.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Detalle</th><th class="num">Cargo</th><th class="num">Pago</th><th class="num">Saldo</th></tr></thead><tbody>
        ${filas.map(({ m, s }) => `<tr><td class="nowrap">${fechaHora(m.fecha)}</td><td>${esc(m.nota || (m.tipo === 'pago' ? 'Pago ' + medioNombre(m.medio || '') : 'Compra'))}${m.ventaId ? ` <a href="#" data-v="${m.ventaId}">ver</a>` : ''}<br><small class="muted">${esc(m.usuario || '')}</small></td><td class="num">${m.tipo === 'cargo' ? fmt(m.monto) : ''}</td><td class="num ok-t">${m.tipo === 'pago' ? fmt(m.monto) : ''}</td><td class="num">${fmt(s)}</td></tr>`).join('')}
        </tbody></table></div>` : UI.empty('Sin movimientos en la cuenta')}`;
      $$('[data-a]', body).forEach(b => {
        b.onclick = async () => {
          const a = b.dataset.a;
          if (a === 'pago') pago(c, draw);
          if (a === 'edit') editar(c, () => { md.close(); detalle(c); });
          if (a === 'cargo') {
            if (!(await UI.autorizar('Cargo manual en cuenta corriente'))) return;
            const m = await UI.prompt('Cargo manual', { label: 'Monto a cargar en la cuenta (ej. saldo de la libreta)', inputmode: 'decimal' });
            if (m == null || num(m) <= 0) return;
            const nota = (await UI.prompt('Detalle', { label: 'Concepto', value: 'Saldo libreta' })) || 'Cargo manual';
            c.saldo = round2(c.saldo + num(m));
            c.movs.push({ id: DB.uid(), fecha: Date.now(), tipo: 'cargo', monto: round2(num(m)), nota, usuario: App.user.nombre });
            DB.log('clientes', 'Cargo manual en cuenta', `${c.nombre} · ${nota}`, round2(num(m)));
            DB.save(); draw();
          }
        };
      });
      $$('[data-v]', body).forEach(a => { a.onclick = e => { e.preventDefault(); const v = DB.d.ventas.find(x => x.id === a.dataset.v); if (v) Reportes.verVenta(v); }; });
    };
    const md = UI.modal({ title: c.nombre, size: 'wide', body, onClose: () => { if (App.current?.id === 'clientes') App.refresh(); } });
    draw();
  }

  let filtro = { q: '', deuda: false };
  function render(v) {
    const deuda = sum(DB.d.clientes, c => Math.max(0, c.saldo));
    const conDeuda = DB.d.clientes.filter(c => c.saldo > 0).length;
    const excedidos = DB.d.clientes.filter(c => c.limite && c.saldo > c.limite).length;
    v.innerHTML = `<div class="kpis"><div class="kpi danger"><small>Total fiado a cobrar</small><b>${fmt(deuda)}</b></div><div class="kpi"><small>Clientes con deuda</small><b>${conDeuda}</b></div><div class="kpi ${excedidos ? 'warn' : ''}"><small>Excedidos del límite</small><b>${excedidos}</b></div><div class="kpi"><small>Clientes</small><b>${DB.d.clientes.length}</b></div></div>
      <div class="toolbar"><input class="input grow" id="cl-q" placeholder="Buscar cliente…" value="${esc(filtro.q)}"><label class="check"><input type="checkbox" id="cl-d" ${filtro.deuda ? 'checked' : ''}> Solo con deuda</label><button class="btn primary" id="cl-new">+ Nuevo cliente</button><button class="btn" id="cl-exp">📤 Exportar</button></div>
      <div class="card" style="padding:0"><div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Cliente</th><th>Contacto</th><th>Lista</th><th class="num">Límite</th><th class="num">Saldo</th><th></th></tr></thead><tbody id="cl-b"></tbody></table></div></div>`;
    const draw = () => {
      const q = norm(filtro.q);
      const list = DB.d.clientes.filter(c => (!filtro.deuda || c.saldo > 0) && (!q || norm(`${c.nombre} ${c.dni} ${c.tel}`).includes(q))).sort((a, b) => b.saldo - a.saldo || a.nombre.localeCompare(b.nombre));
      $('#cl-b', v).innerHTML = list.length ? list.map(c => `<tr class="click" data-c="${c.id}"><td><b>${esc(c.nombre)}</b>${c.dni ? `<br><small class="muted">${esc(c.dni)}</small>` : ''}</td><td>${esc(c.tel || '')}</td><td>${esc(DB.g.config.listas[c.lista || 0])}</td><td class="num">${c.limite ? fmt(c.limite) : '—'}</td><td class="num"><span class="badge ${c.saldo <= 0 ? 'ok' : c.limite && c.saldo > c.limite ? 'danger' : 'warn'}">${fmt(c.saldo)}</span></td><td class="right">${c.saldo > 0 ? `<button class="btn sm" data-pago="${c.id}">Cobrar</button>` : ''}</td></tr>`).join('') : `<tr><td colspan="6">${UI.empty('No hay clientes')}</td></tr>`;
    };
    $('#cl-q', v).addEventListener('input', e => { filtro.q = e.target.value; draw(); });
    $('#cl-d', v).onchange = e => { filtro.deuda = e.target.checked; draw(); };
    $('#cl-new', v).onclick = () => editar(null);
    $('#cl-exp', v).onclick = () => Excel.exportar('clientes', DB.d.clientes.map(c => ({ nombre: c.nombre, dni: c.dni, telefono: c.tel, direccion: c.direccion, lista: DB.g.config.listas[c.lista || 0], limite: c.limite, saldo: c.saldo })));
    $('#cl-b', v).onclick = e => {
      const pb = e.target.closest('[data-pago]');
      if (pb) { e.stopPropagation(); pago(DB.cliente(pb.dataset.pago)); return; }
      const r = e.target.closest('[data-c]');
      if (r) detalle(DB.cliente(r.dataset.c));
    };
    draw();
  }

  return { render, editar, pago, detalle, waLink };
})();

App.register('clientes', { title: 'Clientes y fiado', icon: '📒', render: v => Clientes.render(v) });
