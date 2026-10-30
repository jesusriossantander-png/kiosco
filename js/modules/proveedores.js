/* Compras y proveedores: proveedores, órdenes de pedido, remitos/compras y márgenes por artículo */
const Proveedores = (() => {
  let tab = 'prov';

  function editar(p) {
    const nuevo = !p;
    p = p || { nombre: '', cuit: '', tel: '', email: '', direccion: '', rubro: '', notas: '' };
    UI.modal({
      title: nuevo ? 'Nuevo proveedor' : 'Editar proveedor',
      body: `<form class="form"><label><span>Razón social / nombre *</span><input name="nombre" value="${esc(p.nombre)}" autofocus></label>
        <div class="grid2"><label><span>CUIT</span><input name="cuit" value="${esc(p.cuit)}"></label><label><span>Rubro</span><input name="rubro" list="dl-rub" value="${esc(p.rubro)}"></label></div>
        <datalist id="dl-rub">${DB.g.config.rubros.map(r => `<option>${esc(r)}</option>`).join('')}</datalist>
        <div class="grid2"><label><span>Teléfono / WhatsApp</span><input name="tel" value="${esc(p.tel)}" inputmode="tel"></label><label><span>Email</span><input name="email" value="${esc(p.email)}" type="email"></label></div>
        <label><span>Dirección</span><input name="direccion" value="${esc(p.direccion)}"></label>
        <label><span>Notas (días de visita, condiciones…)</span><textarea name="notas" rows="2">${esc(p.notas)}</textarea></label></form>`,
      actions: [{ label: 'Cancelar' }, {
        label: 'Guardar', class: 'primary', onClick: (c, root) => {
          const f = UI.formData(root);
          if (!f.nombre) { UI.toast('Falta el nombre', 'warn'); return false; }
          Object.assign(p, f);
          if (nuevo) { p.id = DB.uid(); DB.d.proveedores.push(p); }
          DB.save(); App.refresh();
        },
      }],
    });
  }

  function historial(p) {
    const compras = DB.d.compras.filter(c => c.proveedorId === p.id).reverse();
    const prods = DB.d.productos.filter(x => x.proveedorId === p.id);
    UI.modal({
      title: p.nombre, size: 'wide',
      body: `<p class="muted">${esc([p.cuit, p.tel, p.email, p.direccion].filter(Boolean).join(' · '))}</p>${p.notas ? `<p>${esc(p.notas)}</p>` : ''}
        <div class="kpis"><div class="kpi"><small>Compras registradas</small><b>${compras.length}</b></div><div class="kpi"><small>Total comprado</small><b>${fmt(sum(compras, c => c.total))}</b></div><div class="kpi"><small>Productos asociados</small><b>${prods.length}</b></div></div>
        <h3>Historial de compras</h3>${compras.length ? `<div class="table-wrap mt"><table class="table"><thead><tr><th>Fecha</th><th>Comprobante</th><th class="num">Ítems</th><th class="num">Total</th></tr></thead><tbody>${compras.map(c => `<tr><td>${fechaHora(c.fecha)}</td><td>${esc(c.comprobante || '—')}</td><td class="num">${c.items.length}</td><td class="num">${fmt(c.total)}</td></tr>`).join('')}</tbody></table></div>` : UI.empty('Sin compras')}`,
      actions: [{ label: '✏️ Editar', onClick: () => { setTimeout(() => editar(p)); } }, ...(p.tel ? [{ label: '💬 WhatsApp', onClick: () => { window.open(Clientes.waLink(p.tel, `Hola, te escribo de ${DB.g.config.negocio.nombre}.`), '_blank'); return false; } }] : []), { label: 'Cerrar', class: 'primary' }],
    });
  }

  /* Editor de ítems compartido entre orden de pedido y compra */
  function editorItems(items, conCosto, conVenc) {
    const box = h('<div></div>');
    const draw = () => {
      box.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th class="num" style="width:100px">Cant.</th>${conCosto ? '<th class="num" style="width:120px">Costo u.</th>' : ''}${conVenc ? '<th style="width:150px">Vence</th>' : ''}<th></th></tr></thead><tbody>
        ${items.length ? items.map((i, n) => `<tr><td>${esc(i.nombre)}</td><td><input class="input" data-f="cant" data-n="${n}" value="${fmtN(i.cant, 3)}" inputmode="decimal"></td>${conCosto ? `<td><input class="input" data-f="costo" data-n="${n}" value="${i.costo || ''}" inputmode="decimal"></td>` : ''}${conVenc ? `<td><input class="input" type="date" data-f="venc" data-n="${n}" value="${i.venc || ''}"></td>` : ''}<td><button class="icon-btn" data-del="${n}" type="button">✕</button></td></tr>`).join('') : `<tr><td colspan="5">${UI.empty('Agregá productos')}</td></tr>`}
        </tbody></table></div>
        <div class="row mt"><button class="btn" type="button" data-add>+ Agregar producto</button><button class="btn" type="button" data-cam>📷 Escanear</button>${conCosto ? `<span class="grow"></span><b>Total: ${fmt(sum(items, i => i.cant * (i.costo || 0)))}</b>` : ''}</div>`;
      $$('[data-f]', box).forEach(inp => inp.addEventListener('change', () => { const it = items[+inp.dataset.n]; it[inp.dataset.f] = inp.dataset.f === 'venc' ? inp.value : num(inp.value); draw(); }));
      $$('[data-del]', box).forEach(b => { b.onclick = () => { items.splice(+b.dataset.del, 1); draw(); }; });
      const add = p => { const ex = items.find(i => i.pid === p.id); if (ex) ex.cant = round3(ex.cant + 1); else items.push({ pid: p.id, nombre: p.nombre, cant: 1, costo: p.costo || 0, venc: '' }); draw(); };
      $('[data-add]', box).onclick = () => Stock.buscarProducto(add);
      $('[data-cam]', box).onclick = () => Scanner.open({ continuous: true, title: 'Escanear productos', onScan: code => { const p = DB.porCodigo(code); if (!p) return `<div class="bad-line">✖ ${esc(code)} no registrado</div>`; add(p); return `<div class="ok-line">✔ ${esc(p.nombre)}</div>`; } });
    };
    draw();
    return box;
  }

  function orden(o) {
    const nueva = !o;
    o = o || { proveedorId: '', items: [], estado: 'pendiente', notas: '' };
    const items = o.items.map(i => ({ ...i }));
    const body = h(`<div class="form"><div class="grid2"><label><span>Proveedor</span><select name="prov"><option value="">—</option>${opts(DB.d.proveedores, o.proveedorId, x => x.id, x => x.nombre)}</select></label>
      <label><span>Notas</span><input name="notas" value="${esc(o.notas || '')}"></label></div>
      <button class="btn sm mb" type="button" id="or-sug">💡 Sugerir productos bajo mínimo de este proveedor</button></div>`);
    body.append(editorItems(items, true, false));
    $('#or-sug', body).onclick = () => {
      const pv = $('[name=prov]', body).value;
      Stock.bajos().filter(p => !pv || p.proveedorId === pv).forEach(p => { if (!items.some(i => i.pid === p.id)) items.push({ pid: p.id, nombre: p.nombre, cant: Math.max(1, Math.ceil(p.stockMin * 2 - p.stock)), costo: p.costo }); });
      const ed = body.lastElementChild; ed.replaceWith(editorItems(items, true, false));
    };
    const guardar = root => {
      const f = UI.formData(root);
      Object.assign(o, { proveedorId: f.prov, notas: f.notas, items });
      if (nueva) { o.id = DB.uid(); o.nro = DB.next('orden'); o.fecha = Date.now(); o.usuario = App.user.nombre; DB.d.ordenes.push(o); }
      DB.save();
    };
    UI.modal({
      title: nueva ? 'Nueva orden de pedido' : `Orden de pedido #${o.nro}`, size: 'wide', body,
      actions: [
        { label: 'Cancelar' },
        ...(!nueva ? [{ label: '💬 Enviar', onClick: (c, root) => { guardar(root); enviarOrden(o); return false; } }, { label: '📥 Recibir mercadería', onClick: (c, root) => { guardar(root); setTimeout(() => compra(null, o)); } }] : []),
        { label: 'Guardar', class: 'primary', onClick: (c, root) => { guardar(root); App.refresh(); } },
      ],
    });
  }

  function enviarOrden(o) {
    const p = DB.proveedor(o.proveedorId);
    const txt = `Pedido de ${DB.g.config.negocio.nombre} (#${o.nro}):\n` + o.items.map(i => `• ${fmtN(i.cant, 3)} x ${i.nombre}`).join('\n') + (o.notas ? `\nNota: ${o.notas}` : '') + '\n¡Gracias!';
    if (p && p.tel) window.open(Clientes.waLink(p.tel, txt), '_blank');
    else if (navigator.share) navigator.share({ text: txt }).catch(() => {});
    else { navigator.clipboard?.writeText(txt); UI.toast('Pedido copiado al portapapeles', 'ok'); }
    if (o.estado === 'pendiente') { o.estado = 'enviada'; DB.save(); }
  }

  /* Registrar compra / remito: suma stock, actualiza costos y opcionalmente precios */
  function compra(c, desdeOrden) {
    const items = desdeOrden ? desdeOrden.items.map(i => ({ ...i, venc: '' })) : [];
    const body = h(`<div class="form"><div class="grid3"><label><span>Proveedor</span><select name="prov"><option value="">—</option>${opts(DB.d.proveedores, desdeOrden?.proveedorId || '', x => x.id, x => x.nombre)}</select></label>
      <label><span>Remito / factura N°</span><input name="comprobante"></label>
      <label><span>Ingresar a</span><select name="ubic"><option value="gondola">Góndola</option><option value="deposito">Depósito</option></select></label></div>
      <div class="row"><label class="check"><input type="checkbox" name="actCosto" checked> Actualizar costo</label><label class="check"><input type="checkbox" name="mantener" checked> Mantener margen (ajusta precios si cambia el costo)</label></div></div>`);
    body.append(editorItems(items, true, true));
    UI.modal({
      title: desdeOrden ? `Recepción de orden #${desdeOrden.nro}` : 'Registrar compra / remito', size: 'xwide', body,
      actions: [{ label: 'Cancelar' }, {
        label: 'Registrar compra', class: 'primary', onClick: (cl, root) => {
          const f = UI.formData(root);
          if (!items.length) { UI.toast('Agregá productos', 'warn'); return false; }
          const dep = f.ubic === 'deposito';
          const comp = { id: DB.uid(), nro: DB.next('compra'), fecha: Date.now(), proveedorId: f.prov, comprobante: f.comprobante, items: items.map(i => ({ ...i })), total: sum(items, i => i.cant * (i.costo || 0)), ordenId: desdeOrden?.id || null, usuario: App.user.nombre };
          items.forEach(i => {
            const p = DB.prod(i.pid);
            if (!p) return;
            if (f.actCosto && i.costo && i.costo !== p.costo) {
              if (f.mantener && p.costo > 0) p.precios = p.precios.map(x => (x ? Math.round(x * i.costo / p.costo / 10) * 10 : x));
              p.costo = round2(i.costo);
            }
            if (f.prov && !p.proveedorId) p.proveedorId = f.prov;
            DB.mov(p, i.cant, 'compra', `Compra #${comp.nro}${f.comprobante ? ' · ' + f.comprobante : ''}`, { deposito: dep, venc: dep ? '' : i.venc });
          });
          DB.d.compras.push(comp);
          if (desdeOrden) desdeOrden.estado = 'recibida';
          DB.save();
          UI.toast(`Compra registrada: ${fmt(comp.total)}`, 'ok');
          App.refresh();
        },
      }],
    });
  }

  function tabProv(v) {
    v.innerHTML = `<div class="toolbar"><input class="input grow" id="pv-q" placeholder="Buscar proveedor…"><button class="btn primary" id="pv-new">+ Nuevo proveedor</button></div>
      <div class="card" style="padding:0"><div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Proveedor</th><th>Rubro</th><th>Contacto</th><th class="num">Compras</th><th class="num">Última</th></tr></thead><tbody id="pv-b"></tbody></table></div></div>`;
    const draw = () => {
      const q = norm($('#pv-q', v).value);
      const list = DB.d.proveedores.filter(p => !q || norm(p.nombre + ' ' + p.rubro).includes(q));
      $('#pv-b', v).innerHTML = list.length ? list.map(p => { const cs = DB.d.compras.filter(c => c.proveedorId === p.id); const u = cs[cs.length - 1]; return `<tr class="click" data-p="${p.id}"><td><b>${esc(p.nombre)}</b><br><small class="muted">${esc(p.cuit || '')}</small></td><td>${esc(p.rubro || '')}</td><td>${esc(p.tel || p.email || '')}</td><td class="num">${fmt(sum(cs, c => c.total))}</td><td class="num">${u ? fechaCorta(u.fecha) : '—'}</td></tr>`; }).join('') : `<tr><td colspan="5">${UI.empty('Sin proveedores')}</td></tr>`;
    };
    $('#pv-q', v).addEventListener('input', draw);
    $('#pv-new', v).onclick = () => editar(null);
    $('#pv-b', v).onclick = e => { const r = e.target.closest('[data-p]'); if (r) historial(DB.proveedor(r.dataset.p)); };
    draw();
  }

  function tabOrdenes(v) {
    const list = DB.d.ordenes.slice().reverse();
    const est = { pendiente: 'warn', enviada: 'info', recibida: 'ok', anulada: 'danger' };
    v.innerHTML = `<div class="toolbar"><span class="grow muted">Armá pedidos para tus proveedores y enviálos por WhatsApp. Al llegar la mercadería, registrá la recepción.</span><button class="btn" id="or-auto">💡 Desde stock bajo</button><button class="btn primary" id="or-new">+ Nueva orden</button></div>
      <div class="card" style="padding:0">${list.length ? `<div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>#</th><th>Fecha</th><th>Proveedor</th><th class="num">Ítems</th><th class="num">Estimado</th><th>Estado</th></tr></thead><tbody>
      ${list.map(o => `<tr class="click" data-o="${o.id}"><td>${o.nro}</td><td>${fechaCorta(o.fecha)}</td><td>${esc(DB.proveedor(o.proveedorId)?.nombre || 'Sin proveedor')}</td><td class="num">${o.items.length}</td><td class="num">${fmt(sum(o.items, i => i.cant * (i.costo || 0)))}</td><td><span class="badge ${est[o.estado]}">${esc(o.estado)}</span></td></tr>`).join('')}
      </tbody></table></div>` : UI.empty('No hay órdenes de pedido')}</div>`;
    $('#or-new', v).onclick = () => orden(null);
    $('#or-auto', v).onclick = () => { const b = Stock.bajos(); if (!b.length) return UI.toast('No hay productos bajo mínimo', 'info'); Stock.generarOrdenes(b); App.refresh(); };
    $$('[data-o]', v).forEach(r => { r.onclick = () => orden(DB.d.ordenes.find(o => o.id === r.dataset.o)); });
  }

  function tabCompras(v) {
    const list = DB.d.compras.slice().reverse().slice(0, 200);
    v.innerHTML = `<div class="toolbar"><span class="grow muted">Cada compra suma stock, actualiza costos y guarda el vencimiento de cada lote.</span><button class="btn primary" id="cp-new">+ Registrar compra / remito</button></div>
      <div class="card" style="padding:0">${list.length ? `<div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>#</th><th>Fecha</th><th>Proveedor</th><th>Comprobante</th><th class="num">Ítems</th><th class="num">Total</th></tr></thead><tbody>
      ${list.map(c => `<tr><td>${c.nro}</td><td>${fechaHora(c.fecha)}</td><td>${esc(DB.proveedor(c.proveedorId)?.nombre || '—')}</td><td>${esc(c.comprobante || '—')}</td><td class="num">${c.items.length}</td><td class="num">${fmt(c.total)}</td></tr>`).join('')}
      </tbody></table></div>` : UI.empty('Sin compras registradas')}</div>`;
    $('#cp-new', v).onclick = () => compra(null);
  }

  function tabMargen(v) {
    const list = DB.d.productos.filter(p => p.activo !== false).map(p => ({ p, mg: Productos.margen(p), gan: DB.precio(p) - (p.costo || 0) })).sort((a, b) => (a.mg ?? 999) - (b.mg ?? 999));
    v.innerHTML = `<div class="toolbar"><span class="grow muted">Margen = ganancia sobre el costo. Ordenado de menor a mayor para detectar productos que dejan poco.</span><button class="btn" id="mg-exp">📤 Exportar</button></div>
      <div class="card" style="padding:0"><div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Producto</th><th>Rubro</th><th class="num">Costo</th><th class="num">Precio</th><th class="num">Ganancia u.</th><th class="num">Margen</th></tr></thead><tbody>
      ${list.map(({ p, mg, gan }) => `<tr><td>${esc(p.nombre)}</td><td>${esc(p.rubro || '')}</td><td class="num">${fmt(p.costo)}</td><td class="num">${fmt(DB.precio(p))}</td><td class="num">${fmt(gan)}</td><td class="num"><span class="badge ${mg == null ? '' : mg < 15 ? 'danger' : mg < 30 ? 'warn' : 'ok'}">${mg == null ? 'sin costo' : fmtN(mg, 1) + '%'}</span></td></tr>`).join('')}
      </tbody></table></div></div>`;
    $('#mg-exp', v).onclick = () => Excel.exportar('margenes', list.map(({ p, mg, gan }) => ({ codigo: p.codigo, producto: p.nombre, rubro: p.rubro, costo: p.costo, precio: DB.precio(p), ganancia: round2(gan), margen: mg })));
  }

  const TABS = [{ id: 'prov', label: '🚚 Proveedores', f: tabProv }, { id: 'ordenes', label: '🧾 Órdenes de pedido', f: tabOrdenes }, { id: 'compras', label: '📥 Compras y remitos', f: tabCompras }, { id: 'margen', label: '📈 Margen por artículo', f: tabMargen }];
  function render(v, [t]) {
    if (t && TABS.some(x => x.id === t)) tab = t;
    if (tab === 'margen' && !App.esAdmin()) tab = 'prov';
    const tabs = TABS.filter(x => x.id !== 'margen' || App.esAdmin());
    v.innerHTML = `${UI.tabs(tabs, tab)}<div id="pv-body"></div>`;
    $$('[data-tab]', v).forEach(b => { b.onclick = () => { tab = b.dataset.tab; App.refresh(); }; });
    TABS.find(x => x.id === tab).f($('#pv-body', v));
  }
  return { render, compra, orden };
})();

App.register('proveedores', { title: 'Compras y proveedores', icon: '🚚', render: (v, r) => Proveedores.render(v, r) });
