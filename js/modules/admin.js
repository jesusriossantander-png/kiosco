/* Usuarios y permisos, configuración, backup y soporte */

App.register('usuarios', {
  title: 'Usuarios y permisos', icon: '👥',
  render(v) {
    const R = App.roles;
    const desc = {
      admin: 'Acceso total: configuración, usuarios, precios, reportes.',
      encargado: 'Todo menos usuarios y configuración. Autoriza descuentos, retiros y devoluciones.',
      cajero: 'Vender, caja propia (arqueo ciego), clientes, recargas, pedidos y devoluciones con autorización.',
      repositor: 'Productos, stock, vencimientos, conteos y compras. No vende ni ve la caja.',
    };
    v.innerHTML = `<div class="toolbar"><span class="grow muted">Cada persona entra con su PIN. Las ventas, cierres y movimientos quedan registrados con su nombre.</span><button class="btn primary" id="us-new">+ Nuevo usuario</button></div>
      <div class="card" style="padding:0"><div class="table-wrap" style="border:0"><table class="table"><thead><tr><th>Nombre</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>
      ${DB.g.usuarios.map(u => `<tr><td><b>${esc(u.nombre)}</b></td><td>${esc(R[u.rol]?.nombre || u.rol)}</td><td>${u.activo ? '<span class="badge ok">Activo</span>' : '<span class="badge">Inactivo</span>'}</td><td class="right"><button class="btn sm" data-u="${u.id}">Editar</button></td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="card"><h3>Roles</h3><ul class="list-plain mt">${Object.entries(R).map(([k, r]) => `<li><span><b>${esc(r.nombre)}</b><br><small class="muted">${desc[k]}</small></span></li>`).join('')}</ul></div>`;
    const editar = u => {
      const nuevo = !u;
      u = u || { nombre: '', rol: 'cajero', pin: '', activo: true };
      UI.modal({
        title: nuevo ? 'Nuevo usuario' : 'Editar usuario',
        body: `<form class="form"><label><span>Nombre</span><input name="nombre" value="${esc(u.nombre)}" autofocus></label>
          <div class="grid2"><label><span>Rol</span><select name="rol">${opts(Object.entries(R), u.rol, x => x[0], x => x[1].nombre)}</select></label>
          <label><span>PIN (4 a 8 números)</span><input name="pin" value="${esc(u.pin)}" inputmode="numeric" maxlength="8"></label></div>
          <label class="check"><input type="checkbox" name="activo" ${u.activo ? 'checked' : ''}> Activo</label></form>`,
        actions: [{ label: 'Cancelar' }, {
          label: 'Guardar', class: 'primary', onClick: (c, root) => {
            const f = UI.formData(root);
            if (!f.nombre || !/^\d{4,8}$/.test(f.pin)) { UI.toast('Completá el nombre y un PIN de 4 a 8 números', 'warn'); return false; }
            if (DB.g.usuarios.some(x => x !== u && x.pin === f.pin)) { UI.toast('Ese PIN ya lo usa otra persona', 'warn'); return false; }
            const admins = DB.g.usuarios.filter(x => x.rol === 'admin' && x.activo && x !== u).length;
            if (!admins && (f.rol !== 'admin' || !f.activo)) { UI.toast('Debe quedar al menos un administrador activo', 'warn'); return false; }
            Object.assign(u, f);
            if (nuevo) { u.id = DB.uid(); DB.g.usuarios.push(u); }
            DB.save();
            if (u.id === App.user.id) App.user = u;
            App.chrome(); App.refresh();
          },
        }],
      });
    };
    $('#us-new', v).onclick = () => editar(null);
    $$('[data-u]', v).forEach(b => { b.onclick = () => editar(DB.g.usuarios.find(u => u.id === b.dataset.u)); });
  },
});

App.register('config', {
  title: 'Configuración', icon: '⚙️',
  tab: 'negocio',
  render(v) {
    const cfg = DB.g.config;
    const tabs = [
      { id: 'negocio', label: '🏪 Negocio' }, { id: 'sucursal', label: '🏬 Sucursales y cajas' }, { id: 'ticket', label: '🖨️ Ticket, cajón y balanza' },
      { id: 'ventas', label: '🛒 Ventas y stock' }, { id: 'backup', label: '💾 Backup' }, { id: 'arca', label: '🧾 Facturación ARCA' },
    ];
    v.innerHTML = UI.tabs(tabs, this.tab) + '<div id="cf-body"></div>';
    $$('[data-tab]', v).forEach(b => { b.onclick = () => { this.tab = b.dataset.tab; App.refresh(); }; });
    const body = $('#cf-body', v);
    const guardar = (root, fn) => { fn(UI.formData(root)); DB.save(); UI.toast('Configuración guardada', 'ok'); App.chrome(); };
    const n = cfg.negocio;

    if (this.tab === 'negocio') {
      body.innerHTML = `<div class="card form" id="cf-f">
        <div class="grid2"><label><span>Nombre del negocio</span><input name="nombre" value="${esc(n.nombre)}"></label><label><span>CUIT</span><input name="cuit" value="${esc(n.cuit)}"></label></div>
        <div class="grid2"><label><span>Dirección</span><input name="direccion" value="${esc(n.direccion)}"></label><label><span>Teléfono</span><input name="telefono" value="${esc(n.telefono)}"></label></div>
        <div class="grid2"><label><span>WhatsApp para pedidos de clientes (con código de área)</span><input name="whatsapp" value="${esc(n.whatsapp)}" placeholder="11 2345 6789" inputmode="tel"></label><label><span>Horario de atención</span><input name="horario" value="${esc(n.horario)}" placeholder="Lun a Dom 8 a 24 h"></label></div>
        <div class="grid2"><label><span>Alias / CBU para transferencias</span><input name="alias" value="${esc(n.alias)}"></label><label><span>Link de pago Mercado Pago (para el QR de cobro)</span><input name="mpLink" value="${esc(n.mpLink)}" placeholder="https://link.mercadopago.com.ar/…"></label></div>
        <label><span>Mensaje al pie del ticket</span><input name="mensajeTicket" value="${esc(n.mensajeTicket)}"></label>
        <h3 class="mt">Soporte técnico</h3><p class="muted small">Datos de contacto de quien te da soporte (aparecen en Soporte y ayuda).</p>
        <div class="grid3"><label><span>WhatsApp soporte</span><input name="sw" value="${esc(cfg.soporte.whatsapp)}" inputmode="tel"></label><label><span>Teléfono soporte</span><input name="st" value="${esc(cfg.soporte.telefono)}"></label><label><span>Email soporte</span><input name="se" value="${esc(cfg.soporte.email)}"></label></div>
        <label><span>Apariencia</span><select name="tema">${opts([['auto', 'Automática (según el dispositivo)'], ['light', 'Clara'], ['dark', 'Oscura']], cfg.tema, x => x[0], x => x[1])}</select></label>
        <button class="btn primary" id="cf-save">Guardar</button></div>`;
      $('#cf-save', body).onclick = () => guardar(body, f => {
        Object.assign(n, { nombre: f.nombre, cuit: f.cuit, direccion: f.direccion, telefono: f.telefono, whatsapp: f.whatsapp, horario: f.horario, alias: f.alias, mpLink: f.mpLink, mensajeTicket: f.mensajeTicket });
        Object.assign(cfg.soporte, { whatsapp: f.sw, telefono: f.st, email: f.se });
        cfg.tema = f.tema; App.tema();
      });
    }

    if (this.tab === 'sucursal') {
      body.innerHTML = `<div class="grid"><div class="card form"><h3>Este dispositivo</h3><p class="muted small">Cada PC, notebook o celular que vende es un puesto de caja. Poné un nombre distinto en cada uno (Caja 1, Caja 2, Celular dueño…).</p>
          <label><span>Nombre de este puesto de caja</span><input id="cf-caja" value="${esc(DB.device.caja)}"></label>
          <label><span>Sucursal de este dispositivo</span><select id="cf-suc">${opts(DB.g.sucursales, DB.device.sucursal, x => x.id, x => x.nombre)}</select></label>
          <button class="btn primary" id="cf-dev">Guardar</button></div>
        <div class="card"><h3>Sucursales</h3><p class="muted small">Cada sucursal tiene su propio stock, caja, ventas y clientes. Usuarios y configuración son compartidos.</p>
          <ul class="list-plain mt">${DB.g.sucursales.map(s => `<li><span><b>${esc(s.nombre)}</b>${s.id === DB.device.sucursal ? ' <span class="badge ok">este dispositivo</span>' : ''}</span><button class="btn sm" data-ren="${s.id}">Renombrar</button></li>`).join('')}</ul>
          <button class="btn mt" id="cf-newsuc">+ Nueva sucursal</button></div></div>
        <div class="banner info mt">ℹ️ Los datos se guardan en cada dispositivo para funcionar sin internet. Para consolidar cajas o sucursales que están en equipos distintos usá Backup → exportar/importar. La sincronización automática en red requiere un servidor (se puede agregar más adelante).</div>`;
      $('#cf-dev', body).onclick = async () => {
        const caja = $('#cf-caja', body).value.trim() || 'Caja 1';
        if (Caja.actual() && caja !== DB.device.caja) return UI.toast('Cerrá la caja antes de renombrar el puesto', 'warn');
        DB.device.caja = caja;
        const suc = $('#cf-suc', body).value;
        if (suc !== DB.device.sucursal) { await DB.flush(); await DB.useSucursal(suc); }
        await DB.flush();
        UI.toast('Dispositivo actualizado', 'ok');
        App.chrome(); App.refresh();
      };
      $('#cf-newsuc', body).onclick = async () => {
        const nombre = await UI.prompt('Nueva sucursal', { label: 'Nombre' });
        if (!nombre) return;
        const copiar = await UI.confirm('¿Copiar los productos y proveedores de la sucursal actual (con stock en cero)?', { ok: 'Sí, copiar', title: 'Productos' });
        await DB.crearSucursal(nombre.trim(), copiar ? DB.device.sucursal : null);
        UI.toast('Sucursal creada. Elegila en "Sucursal de este dispositivo" para usarla.', 'ok', 5000);
        App.refresh();
      };
      $$('[data-ren]', body).forEach(b => {
        b.onclick = async () => {
          const s = DB.g.sucursales.find(x => x.id === b.dataset.ren);
          const nn = await UI.prompt('Renombrar sucursal', { value: s.nombre });
          if (nn) { s.nombre = nn.trim(); DB.save(); App.chrome(); App.refresh(); }
        };
      });
    }

    if (this.tab === 'ticket') {
      const t = cfg.ticket, b = cfg.balanza;
      body.innerHTML = `<div class="grid"><div class="card form" id="cf-t"><h3>🖨️ Ticket e impresora térmica</h3>
          <label><span>Imprimir ticket al cobrar</span><select name="imprimir">${opts([['preguntar', 'Preguntar (casilla desmarcada)'], ['siempre', 'Siempre (casilla marcada)'], ['nunca', 'Nunca']], t.imprimir, x => x[0], x => x[1])}</select></label>
          <div class="grid2"><label><span>Caracteres por línea (80 mm ≈ 42–48)</span><input name="ancho" data-num value="${t.ancho}"></label><label><span>Velocidad (baudios)</span><input name="baud" data-num value="${t.baud}"></label></div>
          <label class="check"><input type="checkbox" name="cajonAuto" ${t.cajonAuto ? 'checked' : ''}> Abrir el cajón automáticamente al cobrar en efectivo</label>
          <div class="row"><button class="btn primary" id="cf-tsave">Guardar</button><button class="btn" id="cf-pcon">🔌 Conectar impresora USB</button><button class="btn" id="cf-ptest">Probar ticket</button><button class="btn" id="cf-ccaj">Probar cajón</button></div>
          <p class="muted small">Estado: ${HW.pWriter ? '<b class="ok-t">impresora conectada</b>' : 'sin conexión directa — se usa el diálogo de impresión del navegador (elegí tu impresora de 80 mm)'}. La conexión directa (Web Serial) funciona en Chrome/Edge de PC; el cajón se abre por la impresora.</p></div>
        <div class="card form" id="cf-b"><h3>⚖️ Balanza</h3>
          <p class="muted small">Dos formas de vender por peso: <b>1)</b> escanear la etiqueta que imprime la balanza (código que empieza con el prefijo) o <b>2)</b> conectar la balanza a la PC y leer el peso al vender.</p>
          <div class="grid2"><label><span>Prefijo de etiqueta</span><input name="prefijo" value="${esc(b.prefijo)}" inputmode="numeric"></label>
          <label><span>La etiqueta contiene</span><select name="modo">${opts([['peso', 'Peso en gramos'], ['precio', 'Importe en pesos']], b.modo, x => x[0], x => x[1])}</select></label></div>
          <div class="grid2"><label><span>Baudios balanza</span><input name="baud" data-num value="${b.baud}"></label><label><span>Comando para pedir peso</span><input name="comando" value="${esc(b.comando)}"></label></div>
          <div class="row"><button class="btn primary" id="cf-bsave">Guardar</button><button class="btn" id="cf-bcon">🔌 Conectar balanza</button><button class="btn" id="cf-bleer">Leer peso</button></div>
          <p class="muted small">Formato: [prefijo][PLU][5 dígitos de valor][verificador], 13 dígitos. Cargá el PLU en cada producto por peso. Estado: ${HW.scale ? '<b class="ok-t">balanza conectada</b>' : 'no conectada'}</p></div></div>`;
      $('#cf-tsave', body).onclick = () => guardar($('#cf-t', body), f => Object.assign(t, { imprimir: f.imprimir, ancho: f.ancho || 42, baud: f.baud || 9600, cajonAuto: f.cajonAuto }));
      $('#cf-bsave', body).onclick = () => guardar($('#cf-b', body), f => Object.assign(b, { prefijo: f.prefijo, modo: f.modo, baud: f.baud || 9600, comando: f.comando }));
      $('#cf-pcon', body).onclick = async () => { try { await HW.conectarImpresora(); UI.toast('Impresora conectada', 'ok'); App.refresh(); } catch (e) { UI.toast(e.message, 'error', 6000); } };
      $('#cf-ptest', body).onclick = () => Ticket.imprimir([...Ticket.cabecera('TICKET DE PRUEBA'), ['Fecha', fechaHora(Date.now())], ['Producto de prueba', fmt(1234.5)], '-', { c: 'Si ves esto, la impresora funciona' }]);
      $('#cf-ccaj', body).onclick = () => HW.abrirCajon();
      $('#cf-bcon', body).onclick = async () => { try { await HW.conectarBalanza(); UI.toast('Balanza conectada', 'ok'); App.refresh(); } catch (e) { UI.toast(e.message, 'error', 7000); } };
      $('#cf-bleer', body).onclick = async () => { const w = await HW.leerPeso(); UI.toast(w == null ? 'Sin lectura de la balanza' : `Peso: ${fmtN(w, 3)} kg`, w == null ? 'warn' : 'ok'); };
    }

    if (this.tab === 'ventas') {
      body.innerHTML = `<div class="grid"><div class="card form" id="cf-v"><h3>Medios de pago</h3>
          ${cfg.medios.map(m => `<label class="check"><input type="checkbox" data-medio="${m.id}" ${m.activo !== false ? 'checked' : ''}> ${m.icon} ${esc(m.nombre)}</label>`).join('')}
          <h3 class="mt">Stock</h3>
          <label class="check"><input type="checkbox" name="permitirSinStock" ${cfg.stock.permitirSinStock ? 'checked' : ''}> Permitir vender sin stock (solo avisa)</label>
          <label><span>Avisar vencimientos con anticipación (días)</span><input name="diasVencimiento" data-num value="${cfg.stock.diasVencimiento}"></label>
          <h3 class="mt">Recargas</h3>
          <label><span>Comisión de recargas %</span><input name="comision" data-num value="${cfg.recargas.comision}"></label>
          <label><span>Empresas (separadas por coma)</span><textarea name="empresas" rows="2">${esc(cfg.recargas.empresas.join(', '))}</textarea></label>
          <button class="btn primary" id="cf-vsave">Guardar</button></div>
        <div class="card form" id="cf-r"><h3>Rubros</h3><p class="muted small">Uno por línea.</p><textarea name="rubros" rows="14">${esc(cfg.rubros.join('\n'))}</textarea>
          <h3 class="mt">Motivos de salida de mercadería</h3><textarea name="motivos" rows="5">${esc(cfg.motivosSalida.join('\n'))}</textarea>
          <button class="btn primary mt" id="cf-rsave">Guardar</button></div></div>`;
      $('#cf-vsave', body).onclick = () => guardar($('#cf-v', body), f => {
        $$('[data-medio]', body).forEach(i => { cfg.medios.find(m => m.id === i.dataset.medio).activo = i.checked; });
        if (!cfg.medios.some(m => m.activo !== false)) cfg.medios[0].activo = true;
        cfg.stock.permitirSinStock = f.permitirSinStock;
        cfg.stock.diasVencimiento = f.diasVencimiento || 7;
        cfg.recargas.comision = f.comision;
        cfg.recargas.empresas = f.empresas.split(',').map(s => s.trim()).filter(Boolean);
      });
      $('#cf-rsave', body).onclick = () => guardar($('#cf-r', body), f => {
        cfg.rubros = f.rubros.split('\n').map(s => s.trim()).filter(Boolean);
        cfg.motivosSalida = f.motivos.split('\n').map(s => s.trim()).filter(Boolean);
      });
    }

    if (this.tab === 'backup') {
      body.innerHTML = `<div class="grid"><div class="card"><h3>Copia de seguridad</h3>
          <p class="muted small">Todo se guarda en este dispositivo (funciona sin internet). Descargá un backup seguido y guardalo en Google Drive, un pendrive o mandatelo por WhatsApp.</p>
          <label class="check"><input type="checkbox" id="cf-auto" ${cfg.backupAuto ? 'checked' : ''}> Backup automático en el dispositivo (cada 15 min y al cerrar caja)</label>
          <p class="small">Último backup automático: <b>${DB.g.ultimoBackup ? fechaHora(DB.g.ultimoBackup) : 'nunca'}</b></p>
          <div class="row"><button class="btn primary" id="cf-down">⬇️ Descargar backup</button><label class="btn">⬆️ Restaurar desde archivo<input type="file" accept=".json" id="cf-up" hidden></label></div></div>
        <div class="card"><h3>Backups automáticos guardados</h3><div id="cf-list">Cargando…</div></div></div>
        <div class="card"><h3>Zona peligrosa</h3><p class="muted small">Borra todos los datos de este dispositivo y vuelve a los datos de ejemplo.</p><button class="btn danger" id="cf-reset">Borrar todo</button></div>`;
      $('#cf-auto', body).onchange = e => { cfg.backupAuto = e.target.checked; DB.save(); };
      $('#cf-down', body).onclick = async () => { UI.download(`backup-kiosco-${isoDate()}.json`, JSON.stringify(await DB.snapshot())); UI.toast('Backup descargado', 'ok'); };
      $('#cf-up', body).onchange = async e => {
        const f = e.target.files[0];
        if (!f) return;
        if (!(await UI.confirm('Restaurar reemplaza los datos actuales de este dispositivo por los del archivo. ¿Continuar?', { danger: true, ok: 'Restaurar' }))) return;
        try { await DB.restore(JSON.parse(await f.text())); UI.toast('Backup restaurado', 'ok'); App.chrome(); App.refresh(); }
        catch (err) { UI.toast(err.message, 'error', 6000); }
      };
      $('#cf-reset', body).onclick = async () => {
        if (!(await UI.autorizar('Borrar todos los datos'))) return;
        if (!(await UI.confirm('Se borrarán ventas, productos, clientes y configuración de este dispositivo. ¿Seguro?', { danger: true, ok: 'Borrar todo' }))) return;
        await DB.resetTodo();
        App.logout();
      };
      DB.backups().then(list => {
        const box = $('#cf-list', body);
        if (!box) return;
        box.innerHTML = list.length ? `<ul class="list-plain">${list.map((b, i) => `<li><span>${fechaHora(b.fecha)}</span><span><button class="btn sm" data-dl="${i}">Descargar</button> <button class="btn sm" data-rs="${i}">Restaurar</button></span></li>`).join('')}</ul>` : UI.empty('Todavía no hay backups automáticos');
        $$('[data-dl]', box).forEach(b => { b.onclick = () => UI.download(`backup-kiosco-${isoDate(new Date(list[+b.dataset.dl].fecha))}.json`, JSON.stringify(list[+b.dataset.dl])); });
        $$('[data-rs]', box).forEach(b => { b.onclick = async () => { if (await UI.confirm('¿Restaurar este backup? Se reemplazan los datos actuales.', { danger: true, ok: 'Restaurar' })) { await DB.restore(list[+b.dataset.rs]); App.chrome(); App.refresh(); } }; });
      });
    }

    if (this.tab === 'arca') {
      body.innerHTML = `<div class="banner warn">🧾 La facturación electrónica ARCA está <b>desactivada</b>. Las ventas emiten comprobantes internos "no válidos como factura".</div>
        <div class="card disabled-box" aria-disabled="true"><label class="check"><input type="checkbox" disabled> Habilitar facturación electrónica ARCA</label>
        <ul class="muted"><li>Factura A, B y C con CAE automático desde la venta</li><li>Notas de crédito y débito</li><li>Tickets con CAE para monotributistas</li><li>Certificado digital: generación, sincronización y renovación</li><li>Contingencia: guardar ventas si ARCA no responde y facturar cuando vuelve</li><li>Exportación CITI / SIAP</li></ul>
        <p class="small">Para activarlo hace falta un servidor que se comunique con los web services de ARCA usando tu certificado; un sitio estático como GitHub Pages no puede hacerlo de forma segura.</p></div>`;
    }
  },
});

App.register('ayuda', {
  title: 'Soporte y ayuda', icon: '🛟',
  render(v) {
    const s = DB.g.config.soporte;
    v.innerHTML = `<div class="grid">
      <div class="card"><h3>Contacto de soporte</h3>${s.whatsapp || s.telefono || s.email ? `<ul class="list-plain mt">
        ${s.whatsapp ? `<li><span>💬 WhatsApp</span><a class="btn sm primary" target="_blank" rel="noopener" href="${Clientes.waLink(s.whatsapp, 'Hola, necesito ayuda con el sistema del kiosco.')}">${esc(s.whatsapp)}</a></li>` : ''}
        ${s.telefono ? `<li><span>📞 Teléfono</span><a class="btn sm" href="tel:${esc(s.telefono)}">${esc(s.telefono)}</a></li>` : ''}
        ${s.email ? `<li><span>✉️ Email</span><a class="btn sm" href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>` : ''}</ul>` : `<p class="muted">Cargá los datos de soporte en Configuración → Negocio.</p>`}
        <p class="muted small mt">Actualizaciones: la app se actualiza sola al publicar una versión nueva en GitHub Pages, sin costo.</p>
        <button class="btn sm" id="ay-upd">Buscar actualización</button></div>
      <div class="card"><h3>Atajos de teclado (Vender)</h3><ul class="list-plain mt">
        <li><span>Cobrar</span><span class="kbd">F2</span></li><li><span>Ir al buscador</span><span class="kbd">F4</span></li><li><span>Abrir cajón</span><span class="kbd">F8</span></li><li><span>Importe libre</span><span class="kbd">F9</span></li>
        <li><span>Cobrar con buscador vacío</span><span class="kbd">Enter</span></li><li><span>Multiplicar</span><span><span class="kbd">3*</span> + código</span></li><li><span>Cerrar ventana</span><span class="kbd">Esc</span></li></ul></div>
    </div>
    <div class="card"><h3>Capacitación: primeros pasos</h3><ol>
      <li><b>Configuración → Negocio:</b> nombre, WhatsApp para pedidos, alias/link de Mercado Pago.</li>
      <li><b>Usuarios:</b> creá un usuario por empleado y cambiá los PIN de ejemplo.</li>
      <li><b>Productos → Importar Excel:</b> descargá la plantilla, completala y subila. Borrá los productos de ejemplo que no uses.</li>
      <li><b>Caja → Abrir caja</b> al empezar el turno con el efectivo inicial.</li>
      <li><b>Vender:</b> escaneá con el lector USB o tocá 📷 en el celular. Enter o F2 para cobrar, elegí el medio y confirmá (3 toques).</li>
      <li><b>Caja → Cerrar caja:</b> el empleado cuenta el dinero (arqueo ciego) y el sistema muestra la diferencia.</li>
      <li><b>Stock:</b> revisá alertas de mínimo y vencimientos; hacé conteos cíclicos por rubro con la cámara.</li>
      <li><b>Backup:</b> descargá una copia al menos una vez por semana.</li></ol></div>
    <div class="card"><h3>Preguntas frecuentes</h3>
      <p><b>¿Funciona sin internet?</b> Sí. Todo se guarda en el dispositivo. Internet solo hace falta la primera vez para cargar la cámara, Excel y QR.</p>
      <p><b>¿Puedo usarlo en el celular?</b> Sí. Abrilo desde el navegador y elegí "Agregar a pantalla de inicio". Usá 📷 Escanear para cobrar o consultar stock.</p>
      <p><b>¿Cómo ven los precios mis clientes?</b> En Productos → Publicar catálogo se descarga <i>catalogo.json</i>; subilo a la carpeta <i>data</i> del repositorio.</p>
      <p><b>¿Y la factura electrónica?</b> Está desactivada (ver Configuración → Facturación ARCA).</p></div>`;
    $('#ay-upd', v).onclick = async () => {
      const r = await navigator.serviceWorker?.getRegistration();
      if (r) { await r.update(); UI.toast('Listo. Si hay una versión nueva se aplica al recargar.', 'ok'); } else location.reload();
    };
  },
});
