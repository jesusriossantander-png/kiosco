/* Inicio, pedidos de la app de clientes, recargas y devoluciones */

App.register('dashboard', {
  title: 'Inicio', icon: '🏠',
  render(v) {
    const admin = App.esAdmin();
    const hoy = isoDate();
    const vh = DB.d.ventas.filter(x => !x.anulada && isoDate(new Date(x.fecha)) === hoy);
    const total = sum(vh, x => x.total);
    const costo = sum(vh, x => sum(x.items, i => i.cant * (i.costo || 0)));
    const bajos = Stock.bajos();
    const venc = Stock.lotesPorVencer(DB.g.config.stock.diasVencimiento);
    const deuda = sum(DB.d.clientes, c => Math.max(0, c.saldo));
    const pend = DB.d.pedidos.filter(p => ['pendiente', 'preparado'].includes(p.estado)).length;
    const turno = Caja.actual();
    const dias = Array.from({ length: 7 }, (_, i) => { const d = addDays(i - 6); return { label: new Date(d + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short' }), value: sum(DB.d.ventas.filter(x => !x.anulada && isoDate(new Date(x.fecha)) === d), x => x.total) }; });
    const top = Reportes.porArticulo(vh).sort((a, b) => b.cant - a.cant).slice(0, 6);
    const acc = [
      ['pos', '🛒', 'Vender'], ['caja', turno ? '💰' : '🔓', turno ? 'Caja' : 'Abrir caja'], ['#scan', '📷', 'Escanear producto'], ['stock/ajuste', '📦', 'Ajustar stock'],
      ['productos', '🏷️', 'Productos'], ['clientes', '📒', 'Fiado'], ['pedidos', '📲', 'Pedidos'], ['reportes', '📊', 'Reportes'],
    ].filter(([id]) => id === '#scan' || App.can(id.split('/')[0]));
    v.innerHTML = `
      ${!turno && App.can('caja') ? '<div class="banner warn">🔒 La caja está cerrada. <a class="btn sm primary" href="#caja">Abrir caja</a></div>' : ''}
      ${DB.g.usuarios.some(u => u.id === 'u-admin' && u.pin === '1234') && admin ? '<div class="banner info">👋 Bienvenido. Cargá los datos de tu negocio en <a href="#config">Configuración</a> y cambiá los PIN en <a href="#usuarios">Usuarios</a>. Los productos de ejemplo se pueden borrar o reemplazar importando tu Excel.</div>' : ''}
      <div class="kpis">
        <div class="kpi"><small>Ventas de hoy</small><b>${admin ? fmt(total) : vh.length + ' tickets'}</b><span class="sub">${vh.length} tickets${admin && vh.length ? ' · promedio ' + fmt(total / vh.length) : ''}</span></div>
        ${admin ? `<div class="kpi ok"><small>Ganancia bruta hoy</small><b>${fmt(total - costo)}</b></div>` : ''}
        <a class="kpi ${bajos.length ? 'warn' : 'ok'}" href="#stock/alertas" style="text-decoration:none;color:inherit"><small>Stock bajo mínimo</small><b>${bajos.length}</b><span class="sub">Reponer</span></a>
        <a class="kpi ${venc.length ? 'danger' : 'ok'}" href="#stock/venc" style="text-decoration:none;color:inherit"><small>Vencidos / por vencer</small><b>${venc.length}</b><span class="sub">Próximos ${DB.g.config.stock.diasVencimiento} días</span></a>
        ${App.can('clientes') ? `<a class="kpi" href="#clientes" style="text-decoration:none;color:inherit"><small>Fiado a cobrar</small><b>${fmt(deuda)}</b></a>` : ''}
        ${App.can('pedidos') ? `<a class="kpi ${pend ? 'warn' : ''}" href="#pedidos" style="text-decoration:none;color:inherit"><small>Pedidos de clientes</small><b>${pend}</b><span class="sub">pendientes</span></a>` : ''}
      </div>
      <div class="card"><div class="actions-grid">${acc.map(([id, i, l]) => `<a class="action" ${id === '#scan' ? 'href="#" data-scan' : `href="#${id}"`}><span>${i}</span>${l}</a>`).join('')}</div></div>
      <div class="grid mt">
        ${admin ? `<div class="card"><h3>Últimos 7 días</h3>${UI.vbars(dias)}</div>` : ''}
        <div class="card"><h3>Más vendidos hoy</h3><div class="mt">${UI.bars(top.map(a => ({ label: a.nombre, value: a.cant })), x => fmtN(x, 3) + ' u.')}</div></div>
        <div class="card"><h3>Para reponer</h3>${bajos.length ? `<ul class="list-plain mt">${bajos.slice(0, 8).map(p => `<li><span>${DB.emoji(p)} ${esc(p.nombre)}</span>${Productos.stockBadge(p)}</li>`).join('')}</ul>` : UI.empty('Todo en orden ✅')}</div>
      </div>`;
    const s = $('[data-scan]', v);
    if (s) s.onclick = e => { e.preventDefault(); App.escanearGlobal(); };
  },
});

/* ---------------- Pedidos online (app de clientes) ---------------- */
const Pedidos = (() => {
  function decodificar(texto) {
    const m = String(texto).match(/\[\[PEDIDO:([A-Za-z0-9+/=_-]+)\]\]/);
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch { return null; }
  }

  function preparar(data) {
    const items = (data.i || []).map(([codigo, cant, nombre]) => { const p = DB.porCodigo(codigo); return { pid: p?.id || null, codigo, nombre: p?.nombre || nombre || codigo, cant: +cant || 1, precio: p ? DB.precio(p) : 0, falta: !p }; });
    const tel = String(data.t || '').replace(/\D/g, '').slice(-8);
    const cli = tel ? DB.d.clientes.find(c => String(c.tel || '').replace(/\D/g, '').endsWith(tel)) : null;
    return {
      id: DB.uid(), nro: DB.next('pedido'), fecha: Date.now(), creado: data.f || Date.now(), nombre: data.n || '', tel: data.t || '', direccion: data.d || '',
      entrega: data.e || 'retiro', pago: data.pg || '', nota: data.o || '', items, total: sum(items, i => i.cant * i.precio), clienteId: cli?.id || null, estado: 'pendiente',
    };
  }

  function ver(p) {
    UI.modal({
      title: `Pedido #${p.nro} · ${p.nombre || 'Cliente'}`, size: 'wide',
      body: `<p>${esc(p.tel)} · ${p.entrega === 'envio' ? '🛵 Envío a ' + esc(p.direccion) : '🏪 Retira en el local'}${p.pago ? ' · Paga con ' + esc(p.pago) : ''}</p>${p.nota ? `<div class="banner info">📝 ${esc(p.nota)}</div>` : ''}
        ${p.clienteId ? `<p class="small">Cliente registrado: <b>${esc(DB.cliente(p.clienteId)?.nombre || '')}</b></p>` : ''}
        <div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Subtotal</th></tr></thead><tbody>
        ${p.items.map(i => `<tr><td>${esc(i.nombre)}${i.falta ? ' <span class="badge danger">no encontrado</span>' : ''}</td><td class="num">${fmtN(i.cant, 3)}</td><td class="num">${fmt(i.precio)}</td><td class="num">${fmt(i.cant * i.precio)}</td></tr>`).join('')}
        </tbody></table></div><div class="totals"><div class="big"><span>Total estimado</span><span>${fmt(p.total)}</span></div></div>`,
      actions: [
        { label: 'Cancelar pedido', class: 'danger', onClick: () => { p.estado = 'cancelado'; DB.save(); App.refresh(); } },
        ...(p.tel ? [{ label: '💬 Avisar: está listo', onClick: () => { p.estado = 'preparado'; DB.save(); window.open(Clientes.waLink(p.tel, `Hola ${p.nombre}! Tu pedido #${p.nro} de ${DB.g.config.negocio.nombre} está listo${p.entrega === 'envio' ? ' y sale para tu domicilio' : ' para retirar'}. Total: ${fmt(p.total)}`), '_blank'); App.refresh(); } }] : []),
        { label: '🛒 Cobrar en caja', class: 'primary', onClick: () => { const f = POS.cargar(p.items.filter(i => i.pid), { clienteId: p.clienteId, pedidoId: p.id }); if (f.length) UI.toast('Algunos productos no existen y no se cargaron', 'warn'); } },
      ],
    });
  }

  function render(v) {
    const url = new URL('cliente.html', location.href).href;
    const list = DB.d.pedidos.slice().reverse().slice(0, 100);
    const est = { pendiente: 'warn', preparado: 'info', entregado: 'ok', cancelado: 'danger' };
    v.innerHTML = `<div class="grid">
      <div class="card"><h3>Cargar pedido recibido por WhatsApp</h3><p class="muted small">Los clientes arman el pedido en la app y te lo mandan por WhatsApp. Copiá el mensaje completo y pegalo acá.</p>
        <textarea class="input" id="pd-txt" rows="4" placeholder="Pegá el mensaje del cliente…"></textarea>
        <div class="row mt"><button class="btn" id="pd-paste">📋 Pegar</button><button class="btn primary" id="pd-load">Cargar pedido</button></div></div>
      <div class="card"><h3>App para tus clientes</h3><p class="muted small">Compartí este enlace o el QR (imprimilo y pegalo en el mostrador). Funciona en cualquier celular y se puede instalar como app.</p>
        <div class="row"><div class="qr-box" id="pd-qr"></div><div class="grow"><input class="input" readonly value="${esc(url)}" id="pd-url"><div class="row mt"><button class="btn sm" id="pd-copy">Copiar enlace</button><a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">Abrir</a><button class="btn sm" id="pd-share">Compartir</button>${App.can('productos') ? '<button class="btn sm" id="pd-cat">📤 Publicar catálogo</button>' : ''}</div></div></div></div>
    </div>
    <div class="card"><h3>Pedidos</h3>${list.length ? `<div class="table-wrap mt"><table class="table"><thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Entrega</th><th class="num">Total</th><th>Estado</th></tr></thead><tbody>
      ${list.map(p => `<tr class="click" data-p="${p.id}"><td>${p.nro}</td><td>${fechaHora(p.fecha)}</td><td>${esc(p.nombre)}<br><small class="muted">${esc(p.tel)}</small></td><td>${p.entrega === 'envio' ? '🛵 Envío' : '🏪 Retira'}</td><td class="num">${fmt(p.total)}</td><td><span class="badge ${est[p.estado]}">${esc(p.estado)}</span></td></tr>`).join('')}
      </tbody></table></div>` : UI.empty('Todavía no cargaste pedidos')}</div>
    <div class="card"><h3>Integraciones opcionales</h3><div class="grid mt">
      <div class="disabled-box"><b>🛍️ Mercado Libre / tienda online</b><p class="muted small">Requiere un servidor con credenciales de la API de Mercado Libre. Desactivado.</p></div>
      <div><b>📱 Catálogo web propio</b><p class="muted small">Activo: la app de clientes es tu tienda online, con pedidos por WhatsApp.</p></div></div></div>`;
    UI.qr($('#pd-qr', v), url, 130);
    $('#pd-copy', v).onclick = () => { navigator.clipboard?.writeText(url); UI.toast('Enlace copiado', 'ok'); };
    $('#pd-share', v).onclick = () => { if (navigator.share) navigator.share({ title: DB.g.config.negocio.nombre, text: '¡Hacé tu pedido desde el celular!', url }).catch(() => {}); else { navigator.clipboard?.writeText(url); UI.toast('Enlace copiado', 'ok'); } };
    const cat = $('#pd-cat', v);
    if (cat) cat.onclick = () => Productos.publicarCatalogo();
    $('#pd-paste', v).onclick = async () => { try { $('#pd-txt', v).value = await navigator.clipboard.readText(); } catch { UI.toast('Pegalo manualmente (mantené apretado → Pegar)', 'info'); } };
    $('#pd-load', v).onclick = () => {
      const d = decodificar($('#pd-txt', v).value);
      if (!d) return UI.toast('No se encontró un código de pedido en el texto', 'error');
      const p = preparar(d);
      DB.d.pedidos.push(p);
      DB.save();
      App.refresh();
      setTimeout(() => ver(p));
    };
    $$('[data-p]', v).forEach(r => { r.onclick = () => ver(DB.d.pedidos.find(p => p.id === r.dataset.p)); });
  }
  return { render, decodificar };
})();
App.register('pedidos', { title: 'Pedidos de clientes', icon: '📲', render: v => Pedidos.render(v) });

/* ---------------- Recargas y pago de servicios ---------------- */
App.register('recargas', {
  title: 'Recargas y servicios', icon: '📶',
  render(v) {
    const cfg = DB.g.config.recargas;
    const medios = DB.g.config.medios.filter(m => m.id !== 'fiado' && m.activo !== false);
    const hoy = DB.d.recargas.filter(r => isoDate(new Date(r.fecha)) === isoDate()).reverse();
    v.innerHTML = `<div class="grid">
      <div class="card form" id="rc-form"><h2>Nueva recarga / pago</h2>
        <p class="muted small">Hacé la carga en el portal de tu proveedor de recargas y registrala acá para que entre en la caja y en los reportes.</p>
        <label><span>Tipo</span><select name="tipo"><option>Recarga celular</option><option>TV / internet</option><option>Luz / gas / agua</option><option>SUBE / transporte</option><option>Otro servicio</option></select></label>
        <div class="grid2"><label><span>Empresa</span><input name="empresa" list="dl-emp"></label><label><span>N° de línea / cliente</span><input name="numero" inputmode="numeric"></label></div>
        <datalist id="dl-emp">${cfg.empresas.map(e => `<option>${esc(e)}</option>`).join('')}</datalist>
        <div class="grid2"><label><span>Monto</span><input name="monto" data-num inputmode="decimal" class="input xl"></label><label><span>Cobra con</span><select name="medio">${opts(medios, 'efectivo', x => x.id, x => x.nombre)}</select></label></div>
        <div class="bills">${[1000, 2000, 3000, 5000, 10000].map(m => `<button class="btn sm" type="button" data-m="${m}">${fmt(m)}</button>`).join('')}</div>
        <p class="muted small">Comisión estimada: ${cfg.comision}% · <a href="#config">cambiar</a></p>
        <button class="btn primary lg block" id="rc-ok">Registrar</button></div>
      <div class="card"><h3>Hoy</h3><div class="kpis mt"><div class="kpi"><small>Total cobrado</small><b>${fmt(sum(hoy, r => r.monto))}</b></div><div class="kpi ok"><small>Comisión</small><b>${fmt(sum(hoy, r => r.comision))}</b></div></div>
        ${hoy.length ? `<ul class="list-plain">${hoy.map(r => `<li><span><b>${esc(r.empresa)}</b> ${esc(r.numero)}<br><small class="muted">${fechaHora(r.fecha)} · ${esc(r.tipo)} · ${esc(medioNombre(r.medio))}</small></span><b>${fmt(r.monto)}</b></li>`).join('')}</ul>` : UI.empty('Sin recargas hoy')}</div></div>`;
    const f = $('#rc-form', v);
    $$('[data-m]', f).forEach(b => { b.onclick = () => { $('[name=monto]', f).value = b.dataset.m; }; });
    $('#rc-ok', v).onclick = () => {
      const d = UI.formData(f);
      if (!d.empresa || d.monto <= 0) return UI.toast('Completá empresa y monto', 'warn');
      if (!Caja.actual()) return Caja.abrirModal(() => App.refresh());
      const r = { id: DB.uid(), fecha: Date.now(), ...d, comision: round2(d.monto * cfg.comision / 100), usuario: App.user.nombre, turnoId: Caja.actual().id };
      DB.d.recargas.push(r);
      Caja.registrar('recarga', d.medio, d.monto, `${d.tipo} ${d.empresa} ${d.numero}`);
      if (!cfg.empresas.includes(d.empresa)) cfg.empresas.push(d.empresa);
      DB.save();
      UI.toast('Recarga registrada', 'ok');
      App.refresh();
    };
  },
});

/* ---------------- Devoluciones con comprobante original ---------------- */
const Devoluciones = (() => {
  function devuelto(v) {
    const m = {};
    DB.d.devoluciones.filter(d => d.ventaId === v.id).forEach(d => d.items.forEach(i => { m[i.idx] = round3((m[i.idx] || 0) + i.cant); }));
    return m;
  }

  function desdeVenta(v) {
    if (v.anulada) return UI.toast('Ese ticket está anulado', 'warn');
    const ya = devuelto(v);
    const f = v.subtotal ? v.total / v.subtotal : 1;
    const cli = v.clienteId && DB.cliente(v.clienteId);
    const body = h(`<div class="form">
      <p>Ticket <b>#${v.nro}</b> · ${fechaHora(v.fecha)} · ${esc(v.usuario)} · Pagado con ${v.pagos.map(p => esc(medioNombre(p.medio))).join(' + ')}</p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th class="num">Vendido</th><th class="num">Ya devuelto</th><th class="num" style="width:110px">Devolver</th></tr></thead><tbody>
      ${v.items.map((i, n) => `<tr><td>${esc(i.nombre)}<br><small class="muted">${fmt(i.precio * f)} c/u</small></td><td class="num">${fmtN(i.cant, 3)}</td><td class="num">${fmtN(ya[n] || 0, 3)}</td><td><input class="input" data-dv="${n}" inputmode="decimal" placeholder="0" ${(ya[n] || 0) >= i.cant ? 'disabled' : ''}></td></tr>`).join('')}
      </tbody></table></div>
      <div class="grid2 mt"><label><span>Estado de la mercadería</span><select name="condicion"><option value="stock">Vuelve a la venta (stock)</option><option value="merma">Dañada / vencida (merma)</option></select></label>
      <label><span>Reintegro</span><select name="reintegro"><option value="efectivo">Efectivo</option><option value="original">Mismo medio de pago</option>${cli ? `<option value="ctacte">Descontar de la cuenta de ${esc(cli.nombre)}</option>` : ''}<option value="cambio">Cambio por otro producto (sin reintegro)</option></select></label></div>
      <label><span>Motivo</span><input name="motivo" placeholder="Producto fallado, se equivocó de sabor…"></label>
      <p>Total a devolver: <b id="dv-tot">${fmt(0)}</b></p></div>`);
    const calc = () => v.items.map((i, n) => ({ i, n, c: Math.min(num($(`[data-dv="${n}"]`, body).value), round3(i.cant - (ya[n] || 0))) })).filter(x => x.c > 0);
    $$('[data-dv]', body).forEach(inp => inp.addEventListener('input', () => { $('#dv-tot', body).textContent = fmt(sum(calc(), x => x.c * x.i.precio * f)); }));
    UI.modal({
      title: 'Devolución', size: 'wide', body,
      actions: [{ label: 'Cancelar' }, {
        label: 'Aprobar devolución', class: 'primary', onClick: async (c, root) => {
          const sel = calc();
          if (!sel.length) { UI.toast('Indicá qué productos se devuelven', 'warn'); return false; }
          const fd = UI.formData(root);
          const aprob = await UI.autorizar('Aprobar devolución');
          if (!aprob) return false;
          const items = sel.map(({ i, n, c: cant }) => ({ idx: n, pid: i.pid, nombre: i.nombre, cant, precio: i.precio, costo: i.costo, monto: round2(cant * i.precio * f) }));
          const total = sum(items, i => i.monto);
          const d = { id: DB.uid(), nro: DB.next('devolucion'), fecha: Date.now(), ventaId: v.id, ventaNro: v.nro, items, total, reintegro: fd.reintegro, condicion: fd.condicion, motivo: fd.motivo, aprobadoPor: aprob.nombre, usuario: App.user.nombre };
          items.forEach(i => {
            const p = i.pid && DB.prod(i.pid);
            if (!p) return;
            DB.mov(p, i.cant, 'devolucion', `Devolución #${d.nro} (ticket #${v.nro})`);
            if (fd.condicion === 'merma') DB.mov(p, -i.cant, 'salida', 'Merma por devolución');
          });
          if (fd.reintegro === 'efectivo') Caja.registrar('egreso', 'efectivo', total, `Devolución #${d.nro}`);
          else if (fd.reintegro === 'original') {
            let resto = total;
            v.pagos.forEach(p => {
              const m = Math.min(resto, p.monto);
              if (m <= 0) return;
              resto = round2(resto - m);
              if (p.medio === 'fiado' && cli) { cli.saldo = round2(cli.saldo - m); cli.movs.push({ id: DB.uid(), fecha: Date.now(), tipo: 'pago', monto: m, medio: 'devolucion', nota: `Devolución #${d.nro}`, usuario: App.user.nombre }); }
              else Caja.registrar('egreso', p.medio, m, `Devolución #${d.nro}`);
            });
          } else if (fd.reintegro === 'ctacte' && cli) {
            cli.saldo = round2(cli.saldo - total);
            cli.movs.push({ id: DB.uid(), fecha: Date.now(), tipo: 'pago', monto: total, medio: 'devolucion', nota: `Devolución #${d.nro}`, usuario: App.user.nombre });
          }
          DB.d.devoluciones.push(d);
          DB.save();
          const r = Ticket.cabecera(`DEVOLUCION #${d.nro}`);
          r.push(['Ticket original', '#' + v.nro], ['Fecha', fechaHora(d.fecha)], ['Aprobó', d.aprobadoPor], '-');
          items.forEach(i => r.push(i.nombre, [`  ${fmtN(i.cant, 3)} u.`, fmt(i.monto)]));
          r.push('-', ['TOTAL DEVUELTO', fmt(total)], ['Reintegro', { efectivo: 'Efectivo', original: 'Medio original', ctacte: 'Cuenta corriente', cambio: 'Cambio de producto' }[fd.reintegro]]);
          UI.toast('Devolución registrada', 'ok');
          Ticket.imprimir(r, { codigo: 'D' + String(d.nro).padStart(7, '0'), titulo: `Comprobante de devolución #${d.nro}` });
          if (fd.reintegro === 'cambio' && App.can('pos')) UI.toast('Registrá el producto de cambio en Vender', 'info', 5000);
          App.refresh();
        },
      }],
    });
  }

  function render(v) {
    const list = DB.d.devoluciones.slice().reverse().slice(0, 100);
    v.innerHTML = `<div class="card"><h3>Nueva devolución</h3><p class="muted small">Se requiere el ticket original. Ingresá el número que figura en el comprobante.</p>
      <div class="row"><input class="input lg grow" id="dv-nro" placeholder="N° de ticket" inputmode="numeric"><button class="btn primary lg" id="dv-buscar">Buscar ticket</button></div></div>
      <div class="card"><h3>Últimas ventas</h3><ul class="list-plain mt">${DB.d.ventas.filter(x => !x.anulada).slice(-8).reverse().map(x => `<li class="click" style="cursor:pointer" data-v="${x.id}"><span>#${x.nro} · ${fechaHora(x.fecha)} · ${x.items.length} art.</span><b>${fmt(x.total)}</b></li>`).join('') || '<li>Sin ventas</li>'}</ul></div>
      <div class="card"><h3>Historial de devoluciones</h3>${list.length ? `<div class="table-wrap mt"><table class="table"><thead><tr><th>#</th><th>Fecha</th><th>Ticket</th><th>Motivo</th><th>Reintegro</th><th>Aprobó</th><th class="num">Total</th></tr></thead><tbody>
      ${list.map(d => `<tr><td>${d.nro}</td><td>${fechaHora(d.fecha)}</td><td>#${d.ventaNro}</td><td>${esc(d.motivo || '')}${d.condicion === 'merma' ? ' <span class="badge warn">merma</span>' : ''}</td><td>${esc(d.reintegro)}</td><td>${esc(d.aprobadoPor)}</td><td class="num">${fmt(d.total)}</td></tr>`).join('')}</tbody></table></div>` : UI.empty('Sin devoluciones')}</div>`;
    const buscar = () => {
      const n = parseInt($('#dv-nro', v).value, 10);
      const vt = DB.d.ventas.find(x => x.nro === n);
      if (!vt) return UI.toast('No existe ese ticket en esta sucursal', 'error');
      desdeVenta(vt);
    };
    $('#dv-buscar', v).onclick = buscar;
    $('#dv-nro', v).addEventListener('keydown', e => { if (e.key === 'Enter') buscar(); });
    $$('[data-v]', v).forEach(li => { li.onclick = () => desdeVenta(DB.d.ventas.find(x => x.id === li.dataset.v)); });
  }
  return { render, desdeVenta };
})();
App.register('devoluciones', { title: 'Devoluciones', icon: '↩️', render: v => Devoluciones.render(v) });
