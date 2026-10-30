/* Productos: alta/edición, importación masiva desde Excel, exportación y catálogo para clientes */
const Productos = (() => {
  const margen = p => (p.costo > 0 ? round2((DB.precio(p) - p.costo) / p.costo * 100) : null);

  function stockBadge(p) {
    if (p.stock <= 0) return `<span class="badge danger">${fmtN(p.stock, 3)}</span>`;
    if (p.stockMin && p.stock <= p.stockMin) return `<span class="badge warn">${fmtN(p.stock, 3)}</span>`;
    return `<span class="badge ok">${fmtN(p.stock, 3)}</span>`;
  }

  function editar(p, codigoInicial = '', after) {
    const nuevo = !p;
    const cfg = DB.g.config;
    p = p || { codigo: codigoInicial, codigosAlt: [], nombre: '', rubro: '', marca: '', costo: 0, precios: [0, 0, 0, 0, 0], stock: 0, stockDeposito: 0, stockMin: 0, porPeso: false, plu: '', emoji: '', imagen: '', lotes: [], publicar: true, favorito: false, activo: true, proveedorId: '' };
    const body = h(`<form class="form">
      <div class="grid2">
        <label><span>Código de barras</span><div class="field-inline"><input name="codigo" value="${esc(p.codigo)}" inputmode="numeric" autocomplete="off"><button type="button" class="btn" data-scan="codigo">📷</button></div></label>
        <label><span>Códigos alternativos (separados por coma)</span><input name="codigosAlt" value="${esc((p.codigosAlt || []).join(', '))}"></label>
      </div>
      <label><span>Nombre / descripción *</span><input name="nombre" value="${esc(p.nombre)}" required></label>
      <div class="grid3">
        <label><span>Rubro</span><input name="rubro" list="dl-rubros" value="${esc(p.rubro)}"></label>
        <label><span>Marca</span><input name="marca" list="dl-marcas" value="${esc(p.marca)}"></label>
        <label><span>Proveedor</span><select name="proveedorId"><option value="">—</option>${opts(DB.d.proveedores, p.proveedorId, x => x.id, x => x.nombre)}</select></label>
      </div>
      <datalist id="dl-rubros">${cfg.rubros.map(r => `<option>${esc(r)}</option>`).join('')}</datalist>
      <datalist id="dl-marcas">${[...new Set(DB.d.productos.map(x => x.marca).filter(Boolean))].map(m => `<option>${esc(m)}</option>`).join('')}</datalist>
      <div class="grid3">
        <label><span>Costo</span><input name="costo" data-num inputmode="decimal" value="${p.costo || ''}"></label>
        <label><span>Remarcar % sobre costo</span><div class="field-inline"><input id="pf-mk" inputmode="decimal" placeholder="ej: 60"><button type="button" class="btn" id="pf-calc">Calcular</button></div></label>
        <label><span>Margen actual</span><input id="pf-margen" disabled></label>
      </div>
      <div class="grid5">${cfg.listas.map((n, i) => `<label><span>${esc(n)}</span><input name="p${i}" data-num inputmode="decimal" value="${p.precios[i] || ''}"></label>`).join('')}</div>
      <div class="grid3">
        <label><span>Precio de oferta (opcional)</span><input name="ofPrecio" data-num inputmode="decimal" value="${p.oferta && p.oferta.precio || ''}" placeholder="Se muestra tachado el precio normal"></label>
        <label><span>Oferta válida hasta</span><input type="date" name="ofHasta" value="${esc(p.oferta && p.oferta.hasta || '')}"></label>
        <label><span>Descuento</span><input id="pf-desc" disabled></label>
      </div>
      <div class="grid3">
        <label><span>Stock góndola</span><input name="stock" data-num inputmode="decimal" value="${p.stock || 0}" ${nuevo ? '' : 'disabled title="Usá Stock → Ajuste para modificarlo"'}></label>
        <label><span>Stock depósito</span><input name="stockDeposito" data-num inputmode="decimal" value="${p.stockDeposito || 0}" ${nuevo ? '' : 'disabled'}></label>
        <label><span>Stock mínimo (alerta)</span><input name="stockMin" data-num inputmode="decimal" value="${p.stockMin || 0}"></label>
      </div>
      ${nuevo ? '<label><span>Vencimiento del stock inicial (opcional)</span><input type="date" name="venc"></label>' : ''}
      <div class="grid3">
        <label class="check"><input type="checkbox" name="porPeso" ${p.porPeso ? 'checked' : ''}> Se vende por peso (kg)</label>
        <label><span>PLU balanza</span><input name="plu" value="${esc(p.plu || '')}" inputmode="numeric" placeholder="00001"></label>
        <label><span>Emoji o ícono</span><input name="emoji" value="${esc(p.emoji || '')}" placeholder="${DB.emoji(p)}" maxlength="4"></label>
      </div>
      <div class="foto-box"><img id="pf-img" src="${esc(DB.foto(p))}" alt="">
        <div class="grow"><b>Foto del producto</b><p class="muted small">Se ve en la app de clientes y en la landing. Sin foto se usa una ilustración 3D según el ícono.</p>
          <div class="row"><label class="btn sm">📷 Sacar o subir foto<input type="file" accept="image/*" capture="environment" id="pf-file" hidden></label>
          <button type="button" class="btn sm" id="pf-off">🔎 Buscar foto por código</button><button type="button" class="btn sm" id="pf-noimg">Quitar foto</button></div>
          <input name="imagen" value="${esc(p.imagen || '')}" placeholder="o pegá el enlace de una imagen (https://…)" class="mt"></div></div>
      <div class="row">
        <label class="check"><input type="checkbox" name="favorito" ${p.favorito ? 'checked' : ''}> Acceso rápido en Vender</label>
        <label class="check"><input type="checkbox" name="publicar" ${p.publicar !== false ? 'checked' : ''}> Mostrar en app de clientes</label>
        <label class="check"><input type="checkbox" name="activo" ${p.activo !== false ? 'checked' : ''}> Activo</label>
      </div>
    </form>`);
    const updM = () => {
      const c = num($('[name=costo]', body).value), pr = num($('[name=p0]', body).value);
      $('#pf-margen', body).value = c > 0 && pr > 0 ? `${fmtN((pr - c) / c * 100, 1)}% s/costo · ganancia ${fmt(pr - c)}` : '—';
    };
    const updD = () => { const of = num($('[name=ofPrecio]', body).value), pr = num($('[name=p0]', body).value); $('#pf-desc', body).value = of > 0 && pr > of ? `${Math.round((1 - of / pr) * 100)}% OFF` : '—'; };
    $('[name=ofPrecio]', body).addEventListener('input', updD);
    $('[name=p0]', body).addEventListener('input', updD);
    updD();
    const imgEl = $('#pf-img', body), imgIn = $('[name=imagen]', body);
    const verImg = () => { imgEl.src = imgIn.value || DB.img3d($('[name=emoji]', body).value || DB.emoji(p)); };
    imgIn.addEventListener('change', verImg);
    $('[name=emoji]', body).addEventListener('input', verImg);
    $('#pf-noimg', body).onclick = () => { imgIn.value = ''; verImg(); };
    $('#pf-file', body).onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      try { imgIn.value = await achicarFoto(f); verImg(); UI.toast('Foto lista. Guardá el producto para conservarla.', 'ok'); }
      catch { UI.toast('No se pudo leer la imagen', 'error'); }
    };
    $('#pf-off', body).onclick = async () => {
      const code = $('[name=codigo]', body).value.trim();
      if (!/^\d{8,14}$/.test(code)) return UI.toast('Cargá primero un código de barras válido', 'warn');
      UI.toast('Buscando en Open Food Facts…', 'info', 1500);
      const r = await buscarOFF(code);
      if (!r) return UI.toast('No se encontró ese código en la base pública. Podés sacarle una foto.', 'warn', 5000);
      if (r.imagen) { imgIn.value = r.imagen; verImg(); }
      if (r.nombre && !$('[name=nombre]', body).value) $('[name=nombre]', body).value = r.nombre;
      if (r.marca && !$('[name=marca]', body).value) $('[name=marca]', body).value = r.marca;
      UI.toast(r.imagen ? 'Foto encontrada ✔' : 'Se encontraron datos pero sin foto', r.imagen ? 'ok' : 'warn');
    };
    $('[name=costo]', body).addEventListener('input', updM);
    $('[name=p0]', body).addEventListener('input', updM);
    $('#pf-calc', body).onclick = () => {
      const c = num($('[name=costo]', body).value), mk = num($('#pf-mk', body).value);
      if (c > 0) { $('[name=p0]', body).value = Math.round(c * (1 + mk / 100) / 10) * 10; updM(); }
    };
    $('[data-scan]', body).onclick = () => Scanner.open({ title: 'Leer código del producto', onScan: code => { $('[name=codigo]', body).value = code; return ''; } });
    updM();
    const actions = [{ label: 'Cancelar' }];
    if (!nuevo && App.esAdmin()) actions.unshift({
      label: 'Eliminar', class: 'danger', onClick: async () => {
        if (!(await UI.confirm(`¿Eliminar "${p.nombre}"? Si tiene ventas, se recomienda desactivarlo.`, { danger: true, ok: 'Eliminar' }))) return false;
        DB.d.productos = DB.d.productos.filter(x => x.id !== p.id);
        DB.log('productos', 'Producto eliminado', `${p.nombre} (${p.codigo})`);
        DB.save(); App.refresh();
      },
    });
    actions.push({
      label: 'Guardar', class: 'primary', onClick: (c, root) => {
        const f = UI.formData(root);
        if (!f.nombre) { UI.toast('Falta el nombre', 'warn'); return false; }
        if (f.codigo) {
          const dup = DB.d.productos.find(x => x.id !== p.id && (x.codigo === f.codigo || (x.codigosAlt || []).includes(f.codigo)));
          if (dup) { UI.toast(`El código ya pertenece a "${dup.nombre}"`, 'error'); return false; }
        } else f.codigo = 'INT' + String(DB.next('interno')).padStart(5, '0');
        Object.assign(p, {
          codigo: f.codigo, codigosAlt: f.codigosAlt.split(',').map(s => s.trim()).filter(Boolean), nombre: f.nombre, rubro: f.rubro, marca: f.marca,
          proveedorId: f.proveedorId, costo: round2(f.costo), precios: cfg.listas.map((_, i) => round2(f['p' + i])), stockMin: f.stockMin,
          porPeso: f.porPeso, plu: f.plu, emoji: f.emoji, imagen: f.imagen, favorito: f.favorito, publicar: f.publicar, activo: f.activo,
          oferta: f.ofPrecio > 0 ? { precio: round2(f.ofPrecio), hasta: f.ofHasta } : null,
        });
        if (p.oferta && p.oferta.precio >= p.precios[0]) { UI.toast('El precio de oferta debe ser menor al precio normal', 'warn'); p.oferta = null; }
        if (f.rubro && !cfg.rubros.includes(f.rubro)) cfg.rubros.push(f.rubro);
        if (nuevo) {
          p.id = DB.uid(); p.stock = 0; p.stockDeposito = 0;
          DB.d.productos.push(p);
          if (f.stock) DB.mov(p, f.stock, 'alta', 'Stock inicial', { venc: f.venc || '' });
          if (f.stockDeposito) DB.mov(p, f.stockDeposito, 'alta', 'Stock inicial depósito', { deposito: true });
        }
        DB.log('productos', nuevo ? 'Producto creado' : 'Producto modificado', `${p.nombre} · ${fmt(DB.precioLista(p))}${p.oferta ? ' · oferta ' + fmt(p.oferta.precio) : ''}`);
        DB.save();
        UI.toast('Producto guardado', 'ok');
        if (after) after(p); else if (App.current && App.current.id === 'productos') App.refresh();
      },
    });
    UI.modal({ title: nuevo ? 'Nuevo producto' : 'Editar producto', size: 'wide', body, actions });
  }

  /* Reduce la foto a 480 px para que no ocupe espacio */
  function achicarFoto(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 480 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }

  /* Base pública y gratuita de productos (fotos reales por código de barras) */
  async function buscarOFF(code) {
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,image_front_url,image_url`);
      const j = await r.json();
      if (j.status !== 1 || !j.product) return null;
      return { nombre: j.product.product_name || '', marca: (j.product.brands || '').split(',')[0].trim(), imagen: j.product.image_front_url || j.product.image_url || '' };
    } catch { return null; }
  }

  function ficha(p) {
    const mg = margen(p);
    UI.modal({
      title: 'Producto',
      body: `<div class="prod-card"><div class="emo"><img src="${esc(DB.foto(p))}" alt="" style="width:80%;height:80%;object-fit:contain"></div><div><b style="font-size:17px">${esc(p.nombre)}</b><br><small class="muted">${esc(p.codigo)} · ${esc(p.rubro || '')} ${esc(p.marca || '')}</small><div class="price">${fmt(DB.precio(p))}${p.porPeso ? '<small>/kg</small>' : ''}</div></div></div>
        <div class="kpis mt"><div class="kpi"><small>Góndola</small><b>${fmtN(p.stock, 3)}</b></div><div class="kpi"><small>Depósito</small><b>${fmtN(p.stockDeposito || 0, 3)}</b></div><div class="kpi"><small>Mínimo</small><b>${fmtN(p.stockMin || 0, 3)}</b></div>
        ${App.esAdmin() ? `<div class="kpi"><small>Costo · margen</small><b>${fmt(p.costo)}</b><span class="sub">${mg == null ? '' : mg + '% s/costo'}</span></div>` : ''}</div>
        ${(p.lotes || []).length ? `<h3>Vencimientos</h3><ul class="list-plain">${p.lotes.map(l => `<li><span>${fechaISO(l.venc)}</span><span>${fmtN(l.cant, 3)} u. · ${venceBadge(l.venc)}</span></li>`).join('')}</ul>` : ''}
        ${DB.g.config.listas.map((n, i) => (p.precios[i] ? `<span class="badge info">${esc(n)}: ${fmt(p.precios[i])}</span> ` : '')).join('')}`,
      actions: [
        ...(App.can('pos') ? [{ label: '🛒 Vender', onClick: () => { POS.agregar(p, p.porPeso ? null : 1); App.go('pos'); } }] : []),
        ...(App.can('stock') ? [{ label: '📦 Ajustar stock', onClick: () => { setTimeout(() => Stock.ajuste(p)); } }] : []),
        ...(App.can('productos') ? [{ label: '✏️ Editar', class: 'primary', onClick: () => { setTimeout(() => editar(p)); } }] : []),
      ],
    });
  }

  function desconocido(code) {
    if (!App.can('productos')) { UI.toast(`Código ${code} no registrado`, 'warn'); return; }
    UI.modal({
      title: 'Código no registrado',
      body: `<p>El código <b>${esc(code)}</b> no está cargado. ¿Querés darlo de alta?</p>`,
      actions: [{ label: 'Cancelar' }, { label: 'Crear producto', class: 'primary', onClick: () => { setTimeout(() => editar(null, /^\d+$/.test(code) ? code : '')); } }],
    });
  }

  function venceBadge(iso) {
    const d = diasHasta(iso);
    if (d < 0) return `<span class="badge danger">Vencido hace ${-d} d</span>`;
    if (d <= DB.g.config.stock.diasVencimiento) return `<span class="badge warn">Vence en ${d} d</span>`;
    if (d <= 30) return `<span class="badge info">${d} días</span>`;
    return `<span class="badge ok">${d} días</span>`;
  }

  /* -------- Importación masiva -------- */
  const MAP = {
    codigo: ['codigo', 'cod', 'ean', 'barras', 'codigodebarras', 'codbarras', 'sku', 'code'],
    nombre: ['nombre', 'descripcion', 'producto', 'articulo', 'detalle', 'name'],
    rubro: ['rubro', 'categoria', 'familia', 'seccion'],
    marca: ['marca'],
    costo: ['costo', 'preciocosto', 'preciodecosto', 'compra', 'preciocompra'],
    p0: ['precio', 'precio1', 'venta', 'precioventa', 'preciodeventa', 'pvp', 'minorista', 'lista1'],
    p1: ['precio2', 'mayorista', 'lista2'],
    p2: ['precio3', 'lista3'],
    p3: ['precio4', 'lista4'],
    p4: ['precio5', 'lista5'],
    stock: ['stock', 'cantidad', 'existencia', 'stockgondola'],
    stockMin: ['minimo', 'stockminimo', 'stockmin', 'min'],
    stockDeposito: ['deposito', 'stockdeposito'],
    porPeso: ['porpeso', 'pesable', 'granel'],
    plu: ['plu'],
    proveedor: ['proveedor'],
    venc: ['vencimiento', 'venc', 'vto', 'fechavencimiento'],
  };
  const clave = s => norm(s).replace(/[^a-z0-9]/g, '');
  function mapear(row) {
    const o = {};
    for (const [k, v] of Object.entries(row)) {
      const c = clave(k);
      const campo = Object.keys(MAP).find(f => MAP[f].includes(c));
      if (campo && o[campo] === undefined) o[campo] = typeof v === 'string' ? v.trim() : v;
    }
    return o;
  }
  function fechaExcel(v) {
    if (!v) return '';
    if (typeof v === 'number') return isoDate(new Date(Math.round((v - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4));
    const m = String(v).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return /^\d{4}-\d{2}-\d{2}/.test(v) ? String(v).slice(0, 10) : '';
  }

  function importar() {
    const body = h(`<div>
      <p>Subí una planilla <b>Excel (.xlsx/.xls)</b> o <b>CSV</b> con una fila por producto. Columnas reconocidas: <span class="muted small">código, nombre, rubro, marca, costo, precio (o precio1…precio5), stock, mínimo, depósito, por peso, plu, proveedor, vencimiento</span>.</p>
      <p>Si el código ya existe, se actualizan sus datos; si no, se crea el producto.</p>
      <div class="row"><input type="file" id="imp-file" accept=".xlsx,.xls,.csv,.txt"><button class="btn sm" id="imp-tpl" type="button">⬇️ Descargar plantilla</button></div>
      <label class="check"><input type="checkbox" id="imp-stock"> Sumar el stock de la planilla al actual (si no, lo reemplaza)</label>
      <div id="imp-prev" class="mt"></div></div>`);
    let filas = [];
    $('#imp-tpl', body).onclick = () => Excel.exportar('plantilla-productos', [
      { codigo: '7790895000997', nombre: 'Coca-Cola 500 ml', rubro: 'Bebidas', marca: 'Coca-Cola', costo: 650, precio1: 1100, precio2: 990, stock: 24, minimo: 6, deposito: 0, vencimiento: '' },
      { codigo: '2000001', nombre: 'Queso cremoso (kg)', rubro: 'Fiambres', marca: '', costo: 6500, precio1: 10500, precio2: '', stock: 3.5, minimo: 1, deposito: 0, 'por peso': 'si', plu: '00001', vencimiento: addDays(20) },
    ], 'Productos');
    $('#imp-file', body).onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        filas = (await Excel.leer(file)).map(mapear).filter(r => r.nombre || r.codigo);
        const nuevos = filas.filter(r => !r.codigo || !DB.porCodigo(String(r.codigo))).length;
        $('#imp-prev', body).innerHTML = `<div class="banner info">${filas.length} filas leídas · ${nuevos} nuevos · ${filas.length - nuevos} a actualizar</div>
          <div class="table-wrap"><table class="table"><thead><tr><th>Código</th><th>Nombre</th><th>Rubro</th><th class="num">Costo</th><th class="num">Precio</th><th class="num">Stock</th></tr></thead><tbody>
          ${filas.slice(0, 15).map(r => `<tr><td>${esc(r.codigo)}</td><td>${esc(r.nombre)}</td><td>${esc(r.rubro)}</td><td class="num">${esc(r.costo)}</td><td class="num">${esc(r.p0)}</td><td class="num">${esc(r.stock)}</td></tr>`).join('')}
          </tbody></table></div>${filas.length > 15 ? `<p class="muted small">… y ${filas.length - 15} más</p>` : ''}`;
      } catch (err) { UI.toast('No se pudo leer el archivo: ' + err.message, 'error', 6000); }
    };
    UI.modal({
      title: 'Carga masiva de productos', size: 'wide', body,
      actions: [{ label: 'Cancelar' }, {
        label: 'Importar', class: 'primary', onClick: () => {
          if (!filas.length) { UI.toast('Elegí un archivo primero', 'warn'); return false; }
          const sumar = $('#imp-stock', body).checked;
          let n = 0, u = 0;
          const cfg = DB.g.config;
          filas.forEach(r => {
            const codigo = String(r.codigo ?? '').trim();
            let p = codigo ? DB.porCodigo(codigo) : null;
            const esNuevo = !p;
            if (!p) {
              if (!r.nombre) return;
              p = { id: DB.uid(), codigo: codigo || 'INT' + String(DB.next('interno')).padStart(5, '0'), codigosAlt: [], nombre: '', rubro: '', marca: '', costo: 0, precios: [0, 0, 0, 0, 0], stock: 0, stockDeposito: 0, stockMin: 0, porPeso: false, plu: '', emoji: '', imagen: '', lotes: [], publicar: true, favorito: false, activo: true, proveedorId: '' };
              DB.d.productos.push(p);
            }
            if (r.nombre) p.nombre = String(r.nombre);
            if (r.rubro) { p.rubro = String(r.rubro); if (!cfg.rubros.includes(p.rubro)) cfg.rubros.push(p.rubro); }
            if (r.marca) p.marca = String(r.marca);
            if (r.costo !== undefined && r.costo !== '') p.costo = round2(num(r.costo));
            for (let i = 0; i < 5; i++) if (r['p' + i] !== undefined && r['p' + i] !== '') p.precios[i] = round2(num(r['p' + i]));
            if (r.stockMin !== undefined && r.stockMin !== '') p.stockMin = num(r.stockMin);
            if (r.porPeso !== undefined && r.porPeso !== '') p.porPeso = /^(s|si|sí|1|x|true|y)/i.test(String(r.porPeso));
            if (r.plu) p.plu = String(r.plu);
            if (r.proveedor) { const pv = DB.d.proveedores.find(x => norm(x.nombre) === norm(r.proveedor)); if (pv) p.proveedorId = pv.id; }
            if (r.stock !== undefined && r.stock !== '') {
              const objetivo = sumar ? num(r.stock) : num(r.stock) - p.stock;
              if (objetivo) DB.mov(p, objetivo, 'importacion', 'Carga masiva', { venc: fechaExcel(r.venc) });
            }
            if (r.stockDeposito !== undefined && r.stockDeposito !== '') {
              const d = sumar ? num(r.stockDeposito) : num(r.stockDeposito) - (p.stockDeposito || 0);
              if (d) DB.mov(p, d, 'importacion', 'Carga masiva depósito', { deposito: true });
            }
            esNuevo ? n++ : u++;
          });
          DB.save();
          DB.log('productos', 'Importación desde Excel', `${n} nuevos · ${u} actualizados`);
          UI.toast(`Importación lista: ${n} nuevos, ${u} actualizados`, 'ok', 5000);
          App.refresh();
        },
      }],
    });
  }

  function exportar() {
    const L = DB.g.config.listas;
    Excel.exportar('productos-' + isoDate(), DB.d.productos.map(p => ({
      codigo: p.codigo, nombre: p.nombre, rubro: p.rubro, marca: p.marca, proveedor: DB.proveedor(p.proveedorId)?.nombre || '', costo: p.costo,
      ...Object.fromEntries(L.map((n, i) => ['precio' + (i + 1), p.precios[i] || ''])),
      stock: p.stock, minimo: p.stockMin, deposito: p.stockDeposito || 0, 'por peso': p.porPeso ? 'si' : '', plu: p.plu || '',
      vencimiento: (p.lotes || [])[0]?.venc || '', activo: p.activo !== false ? 'si' : 'no',
    })), 'Productos');
  }

  /* Genera data/catalogo.json para la app de clientes (subirlo al repositorio para publicarlo) */
  function catalogoJSON() { return Catalogo.construir(DB.g, DB.d); }
  function publicarCatalogo() {
    UI.download('catalogo.json', JSON.stringify(catalogoJSON()));
    UI.modal({
      title: 'Catálogo para clientes',
      body: `<p>Se descargó <b>catalogo.json</b> con ${catalogoJSON().productos.length} productos y precios actuales.</p>
        <ol><li>Entrá a tu repositorio en GitHub → carpeta <b>data</b>.</li><li>Tocá <b>Add file → Upload files</b> y subí <b>catalogo.json</b> (reemplaza el anterior).</li><li>En 1–2 minutos la app de clientes muestra los precios nuevos.</li></ol>
        <p class="muted small">En este mismo dispositivo la app de clientes ya usa los datos actuales automáticamente.</p>`,
      actions: [{ label: 'Entendido', class: 'primary' }],
    });
  }

  let filtro = { q: '', rubro: '', estado: '' };
  function render(v) {
    const cfg = DB.g.config;
    v.innerHTML = `<div class="toolbar">
        <input class="input grow" id="pr-q" placeholder="Buscar por nombre, código, marca…" value="${esc(filtro.q)}">
        <button class="btn" id="pr-cam" title="Buscar escaneando">📷</button>
        <select class="input" id="pr-rubro" style="width:auto" aria-label="Filtrar por rubro"><option value="">Todos los rubros</option>${opts(cfg.rubros, filtro.rubro)}</select>
        <select class="input" id="pr-estado" style="width:auto" aria-label="Filtrar por estado del stock">${opts([['', 'Todos'], ['bajo', 'Stock bajo'], ['sin', 'Sin stock'], ['inactivo', 'Inactivos'], ['peso', 'Por peso']], filtro.estado, x => x[0], x => x[1])}</select>
      </div>
      <div class="toolbar">
        <button class="btn primary" id="pr-new">+ Nuevo producto</button>
        <button class="btn" id="pr-imp">📥 Importar Excel</button>
        <button class="btn" id="pr-exp">📤 Exportar Excel</button>
        <button class="btn" id="pr-cat">📱 Publicar catálogo clientes</button>
      </div>
      <div class="card" style="padding:0"><div class="table-wrap" style="border:0"><table class="table"><thead><tr>
        <th>Producto</th><th>Rubro</th><th class="num">Costo</th><th class="num">${esc(cfg.listas[0])}</th><th class="num">Margen</th><th class="num">Góndola</th><th class="num">Depósito</th></tr></thead><tbody id="pr-body"></tbody></table></div></div>
      <p class="muted small mt" id="pr-count"></p>`;
    const draw = () => {
      const words = norm(filtro.q).split(/\s+/).filter(Boolean);
      const list = DB.d.productos.filter(p => {
        if (filtro.rubro && p.rubro !== filtro.rubro) return false;
        if (filtro.estado === 'bajo' && !(p.stockMin && p.stock <= p.stockMin)) return false;
        if (filtro.estado === 'sin' && p.stock > 0) return false;
        if (filtro.estado === 'inactivo' && p.activo !== false) return false;
        if (filtro.estado === 'peso' && !p.porPeso) return false;
        if (filtro.estado !== 'inactivo' && p.activo === false) return false;
        return words.every(w => norm(`${p.nombre} ${p.codigo} ${p.marca} ${(p.codigosAlt || []).join(' ')}`).includes(w));
      }).sort((a, b) => a.nombre.localeCompare(b.nombre));
      const vis = list.slice(0, 300);
      $('#pr-body', v).innerHTML = vis.length ? vis.map(p => { const mg = margen(p); return `<tr class="click" data-id="${p.id}">
        <td><div class="row" style="flex-wrap:nowrap"><img src="${esc(DB.foto(p))}" alt="" class="thumb" loading="lazy"><div><b>${esc(p.nombre)}</b>${p.favorito ? ' ⭐' : ''}${DB.ofertaActiva(p) ? ' <span class="badge danger">OFERTA</span>' : ''}<br><small class="muted">${esc(p.codigo)} ${p.marca ? '· ' + esc(p.marca) : ''}${p.porPeso ? ' · por kg' : ''}</small></div></div></td>
        <td>${esc(p.rubro || '')}</td><td class="num">${fmt(p.costo)}</td><td class="num">${DB.ofertaActiva(p) ? `<s class="muted small">${fmt(DB.precioLista(p))}</s><br>` : ''}${fmt(DB.precio(p))}</td>
        <td class="num ${mg != null && mg < 15 ? 'danger-t' : ''}">${mg == null ? '—' : fmtN(mg, 1) + '%'}</td><td class="num">${stockBadge(p)}</td><td class="num">${fmtN(p.stockDeposito || 0, 3)}</td></tr>`; }).join('')
        : `<tr><td colspan="7">${UI.empty('No hay productos con ese filtro')}</td></tr>`;
      $('#pr-count', v).textContent = `${list.length} productos${list.length > vis.length ? ' (mostrando 300, refiná la búsqueda)' : ''}`;
    };
    $('#pr-q', v).addEventListener('input', e => { filtro.q = e.target.value; draw(); });
    $('#pr-rubro', v).onchange = e => { filtro.rubro = e.target.value; draw(); };
    $('#pr-estado', v).onchange = e => { filtro.estado = e.target.value; draw(); };
    $('#pr-body', v).onclick = e => { const r = e.target.closest('[data-id]'); if (r) editar(DB.prod(r.dataset.id)); };
    $('#pr-new', v).onclick = () => editar(null);
    $('#pr-imp', v).onclick = importar;
    $('#pr-exp', v).onclick = exportar;
    $('#pr-cat', v).onclick = publicarCatalogo;
    $('#pr-cam', v).onclick = () => Scanner.open({
      title: 'Buscar producto', onScan: (code, m) => {
        const p = DB.porCodigo(code);
        m.close();
        setTimeout(() => (p ? editar(p) : desconocido(code)), 50);
        return '';
      },
    });
    draw();
  }

  return { render, editar, ficha, desconocido, venceBadge, margen, catalogoJSON, publicarCatalogo, stockBadge };
})();

App.register('productos', { title: 'Productos', icon: '🏷️', render: v => Productos.render(v) });
