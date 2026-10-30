/* Base de datos local del kiosco: todo se guarda en el dispositivo y funciona sin internet */
const DB = (() => {
  const DKEY = 'kiosco:device';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const RUBROS = ['Bebidas', 'Cigarrillos', 'Golosinas', 'Galletitas', 'Snacks', 'Almacén', 'Lácteos', 'Fiambres', 'Panadería', 'Helados', 'Limpieza', 'Perfumería', 'Librería', 'Varios'];
  const EMOJI = {
    Bebidas: '🥤', Cigarrillos: '🚬', Golosinas: '🍫', Galletitas: '🍪', Snacks: '🍟', Almacén: '🧉', Lácteos: '🥛',
    Fiambres: '🧀', Panadería: '🥖', Helados: '🍦', Limpieza: '🧴', Perfumería: '🧼', Librería: '✏️', Varios: '📦',
  };
  let G, D, device, timer;

  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function merge(base, extra) {
    if (!isObj(extra)) return base;
    for (const k in extra) base[k] = isObj(base[k]) && isObj(extra[k]) ? merge(base[k], extra[k]) : extra[k];
    return base;
  }
  function readLS(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }

  function defaultGlobal() {
    return {
      version: 2,
      seeded: false,
      sucursales: [{ id: 'central', nombre: 'Casa central', direccion: '' }],
      usuarios: [
        { id: 'u-admin', nombre: 'Administrador', rol: 'admin', pin: '1234', activo: true },
        { id: 'u-caja', nombre: 'Cajero/a', rol: 'cajero', pin: '0000', activo: true },
      ],
      config: {
        negocio: { nombre: 'Mi Maxikiosco', direccion: '', telefono: '', whatsapp: '', cuit: '', alias: '', mpLink: '', horario: '', mensajeTicket: '¡Gracias por tu compra!' },
        soporte: { whatsapp: '', telefono: '', email: '' },
        listas: ['Minorista', 'Mayorista', 'Lista 3', 'Lista 4', 'Lista 5'],
        rubros: RUBROS.slice(),
        motivosSalida: ['Merma', 'Vencido', 'Rotura', 'Devolución a proveedor', 'Uso propio', 'Robo / faltante', 'Degustación'],
        medios: [
          { id: 'efectivo', nombre: 'Efectivo', icon: '💵', activo: true },
          { id: 'debito', nombre: 'Débito', icon: '💳', activo: true },
          { id: 'credito', nombre: 'Crédito', icon: '💳', activo: true },
          { id: 'qr', nombre: 'QR / Mercado Pago', icon: '📱', activo: true },
          { id: 'transferencia', nombre: 'Transferencia', icon: '🏦', activo: true },
          { id: 'fiado', nombre: 'Fiado (cta. cte.)', icon: '📒', activo: true },
        ],
        recargas: { empresas: ['Claro', 'Personal', 'Movistar', 'Tuenti', 'DirecTV', 'Flow', 'Edenor', 'Edesur', 'Metrogas', 'AySA', 'SUBE'], comision: 4 },
        ticket: { imprimir: 'siempre', cajonAuto: true, ancho: 42, baud: 9600 },
        balanza: { prefijo: '20', modo: 'peso', baud: 9600, comando: 'P' },
        stock: { permitirSinStock: true, diasVencimiento: 7 },
        arca: { habilitado: false },
        app: {
          aviso: '🛵 Envío sin cargo desde $15.000 · Pedí hasta las 23:30',
          banners: [
            { titulo: 'Fin de semana de ofertas', sub: 'Hasta 25% OFF en bebidas, golosinas y snacks', badge: 'HASTA 25%', color: 'naranja', emoji: '🥤🍫🍟', link: 'ofertas' },
            { titulo: 'Pagá con QR y ahorrá', sub: '10% de reintegro con billeteras virtuales · tope $2.000', badge: 'PROMO PAGOS', color: 'verde', emoji: '📱💳', link: 'ahorros' },
            { titulo: 'Envío sin cargo', sub: 'En pedidos desde $15.000 dentro del barrio', badge: 'DELIVERY', color: 'violeta', emoji: '🛵', link: 'inicio' },
            { titulo: 'Martes de alfajores', sub: 'Llevá 3 y pagá 2 en alfajores seleccionados', badge: '3x2', color: 'rojo', emoji: '🍫🍪', link: 'Golosinas' },
          ],
          promosPago: [
            { dia: 'Todos los días', titulo: '10% de reintegro', sub: 'Pagando con QR · billeteras virtuales', emoji: '📱' },
            { dia: 'Viernes', titulo: '3 cuotas sin interés', sub: 'Con tarjetas de crédito · compras desde $30.000', emoji: '💳' },
            { dia: 'Lunes a jueves', titulo: '5% OFF en efectivo', sub: 'En compras desde $20.000', emoji: '💵' },
          ],
        },
        backupAuto: true,
        tema: 'auto',
      },
    };
  }

  function defaultData() {
    return {
      productos: [], ventas: [], clientes: [], proveedores: [], compras: [], ordenes: [], movimientos: [],
      turnos: [], recargas: [], devoluciones: [], pedidos: [], preciosLog: [], conteos: [],
      seq: { venta: 1, orden: 1, compra: 1, devolucion: 1, pedido: 1, interno: 1 },
    };
  }

  /* Imagen 3D y ofertas de los productos de ejemplo */
  const SEED_EMOJI = {
    '7790895000997': '🥤', '7790895001000': '🥤', '7790895066403': '🧃', '7798062541233': '💧', '7791813420026': '🍺', '7790040113303': '⚡',
    '7792799000011': '🍊', '7790580660008': '🍫', '7790040729504': '🍪', '7790580120002': '🍬', '7790380023507': '🍫', '7790310981171': '🍭',
    '7790040990001': '🍪', '7790040380009': '🍘', '7790310001237': '🍟', '7790310002227': '🥨', '7790387000106': '🧉', '7790070411704': '🧂',
    '7790580430019': '🍝', '7790742356004': '🥛', '7790742367109': '🍓', '7790990586091': '🧴', '7791290009321': '🧼', '7790250000009': '🔋',
    '7790000000105': '🔥', '2000001': '🧀', '2000002': '🍖', '2000003': '🥖',
  };
  const SEED_OFERTA = {
    '7790895001000': 1990, '7790580660008': 640, '7790387000106': 2340, '7790310001237': 1490, '7798062541233': 600,
    '7790040990001': 1090, '7790742356004': 1290, '2000002': 11900, '7790380023507': 1350, '7790990586091': 990,
  };

  function seed(d) {
    const r10 = n => Math.round(n / 10) * 10;
    const prov = [
      ['Distribuidora Bebidas Sur', 'Bebidas'], ['Tabacalera Norte', 'Cigarrillos'], ['Golosinas Mayorista SRL', 'Golosinas'],
      ['Lácteos del Oeste', 'Lácteos'], ['Almacén Mayorista Central', 'Almacén'],
    ].map(([nombre, rubro], i) => ({ id: uid(), nombre, rubro, cuit: `30-7${1000000 + i * 1371}-${i}`, tel: '', email: '', direccion: '', notas: '' }));
    const provDe = rubro => (prov.find(p => p.rubro === rubro) || prov[4]).id;
    // codigo, nombre, rubro, marca, costo, precio, stock, minimo, extras
    const P = [
      ['7790895000997', 'Coca-Cola 500 ml', 'Bebidas', 'Coca-Cola', 650, 1100, 48, 12, { favorito: true }],
      ['7790895001000', 'Coca-Cola 1,5 L', 'Bebidas', 'Coca-Cola', 1350, 2300, 24, 6],
      ['7790895066403', 'Sprite 500 ml', 'Bebidas', 'Coca-Cola', 600, 1000, 20, 8],
      ['7798062541233', 'Agua mineral 500 ml', 'Bebidas', 'Villavicencio', 380, 750, 40, 12, { favorito: true }],
      ['7791813420026', 'Cerveza lata 473 ml', 'Bebidas', 'Quilmes', 950, 1700, 36, 12, { favorito: true }],
      ['7790040113303', 'Energizante 250 ml', 'Bebidas', 'Speed', 850, 1500, 4, 6],
      ['7792799000011', 'Jugo en polvo naranja', 'Bebidas', 'Tang', 180, 350, 50, 10],
      ['77913631', 'Marlboro Box 20', 'Cigarrillos', 'Marlboro', 2800, 3400, 60, 20, { favorito: true }],
      ['77913648', 'Philip Morris Box 20', 'Cigarrillos', 'Philip Morris', 2500, 3000, 15, 20],
      ['77950017', 'Chesterfield Box 20', 'Cigarrillos', 'Chesterfield', 2100, 2600, 40, 20, { favorito: true }],
      ['7790580660008', 'Alfajor triple chocolate', 'Golosinas', 'Jorgito', 420, 800, 60, 24, { favorito: true }],
      ['7790040729504', 'Alfajor simple', 'Golosinas', 'Guaymallén', 180, 400, 80, 24],
      ['7790580120002', 'Chicles menta x10', 'Golosinas', 'Beldent', 350, 700, 30, 10],
      ['7790380023507', 'Chocolate con leche 55 g', 'Golosinas', 'Milka', 900, 1600, 18, 6],
      ['7790310981171', 'Caramelos masticables', 'Golosinas', 'Sugus', 300, 600, 25, 10],
      ['7790040990001', 'Galletitas de chocolate 118 g', 'Galletitas', 'Oreo', 700, 1300, 22, 8],
      ['7790040380009', 'Galletitas de agua', 'Galletitas', 'Criollitas', 550, 1000, 3, 6],
      ['7790310001237', 'Papas fritas clásicas 85 g', 'Snacks', 'Lays', 900, 1700, 20, 8],
      ['7790310002227', 'Palitos salados 100 g', 'Snacks', 'Pehuamar', 600, 1100, 15, 6],
      ['7790387000106', 'Yerba mate 500 g', 'Almacén', 'Playadito', 1600, 2600, 12, 4],
      ['7790070411704', 'Azúcar 1 kg', 'Almacén', 'Ledesma', 900, 1500, 10, 4],
      ['7790580430019', 'Fideos spaghetti 500 g', 'Almacén', 'Matarazzo', 800, 1400, 14, 4],
      ['7790742356004', 'Leche entera 1 L', 'Lácteos', 'La Serenísima', 900, 1500, 16, 6, { lotes: [{ venc: addDays(3), cant: 6 }, { venc: addDays(12), cant: 10 }] }],
      ['7790742367109', 'Yogur bebible frutilla 1 L', 'Lácteos', 'La Serenísima', 1300, 2200, 12, 4, { lotes: [{ venc: addDays(-1), cant: 2 }, { venc: addDays(20), cant: 10 }] }],
      ['7790990586091', 'Lavandina 1 L', 'Limpieza', 'Ayudín', 700, 1200, 10, 3],
      ['7791290009321', 'Desodorante aerosol', 'Perfumería', 'Rexona', 1800, 3000, 8, 3],
      ['7790250000009', 'Pilas AA x2', 'Varios', 'Duracell', 1900, 3200, 10, 4],
      ['7790000000105', 'Encendedor', 'Varios', 'Bic', 600, 1100, 30, 10, { favorito: true }],
      ['2000001', 'Queso cremoso (kg)', 'Fiambres', 'Granja', 6500, 10500, 4.5, 1, { porPeso: true, plu: '00001', lotes: [{ venc: addDays(15), cant: 4.5 }] }],
      ['2000002', 'Jamón cocido (kg)', 'Fiambres', 'Paladini', 8000, 13500, 3, 1, { porPeso: true, plu: '00002' }],
      ['2000003', 'Pan francés (kg)', 'Panadería', '', 1200, 2400, 10, 2, { porPeso: true, plu: '00003' }],
    ];
    d.proveedores = prov;
    P.forEach(r => { const ex = r[8] || (r[8] = {}); if (SEED_EMOJI[r[0]]) ex.emoji = SEED_EMOJI[r[0]]; if (SEED_OFERTA[r[0]]) ex.oferta = { precio: SEED_OFERTA[r[0]], hasta: '' }; });
    d.productos = P.map(([codigo, nombre, rubro, marca, costo, precio, stock, stockMin, ex = {}]) => ({
      id: uid(), codigo, codigosAlt: [], nombre, rubro, marca, costo, precios: [precio, r10(precio * 0.9), 0, 0, 0],
      stock, stockDeposito: 0, stockMin, porPeso: false, plu: '', emoji: '', imagen: '', lotes: [],
      publicar: rubro !== 'Cigarrillos', favorito: false, activo: true, proveedorId: provDe(rubro), ...ex,
      ...(ex.lotes ? { lotes: ex.lotes.map(l => ({ id: uid(), ...l })) } : {}),
    }));
    d.clientes = [
      { id: uid(), nombre: 'Juan Pérez', dni: '30111222', tel: '', direccion: 'Calle 1 123', limite: 20000, saldo: 4500, lista: 0, notas: '', movs: [{ id: uid(), fecha: Date.now() - 864e5 * 3, tipo: 'cargo', monto: 4500, nota: 'Saldo inicial' }] },
      { id: uid(), nombre: 'María Gómez', dni: '28999888', tel: '', direccion: '', limite: 15000, saldo: 0, lista: 0, notas: '', movs: [] },
      { id: uid(), nombre: 'Almacén Don Pepe (mayorista)', dni: '', tel: '', direccion: '', limite: 0, saldo: 0, lista: 1, notas: 'Compra por mayor', movs: [] },
    ];
  }

  async function init() {
    G = merge(defaultGlobal(), await KV.get('global'));
    device = merge({ caja: 'Caja 1', sucursal: G.sucursales[0].id }, readLS(DKEY));
    await useSucursal(device.sucursal);
    if ((G.version || 1) < 2) {
      D.productos.forEach(p => {
        if (!p.emoji && SEED_EMOJI[p.codigo]) p.emoji = SEED_EMOJI[p.codigo];
        if (!p.oferta && SEED_OFERTA[p.codigo]) p.oferta = { precio: SEED_OFERTA[p.codigo], hasta: '' };
        if (p.rubro === 'Cigarrillos') p.publicar = false;
      });
      G.version = 2;
      await flush();
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  async function useSucursal(id) {
    if (!G.sucursales.some(s => s.id === id)) id = G.sucursales[0].id;
    device.sucursal = id;
    localStorage.setItem(DKEY, JSON.stringify(device));
    const raw = await KV.get('data:' + id);
    D = merge(defaultData(), raw);
    if (!raw) {
      if (!G.seeded) { seed(D); G.seeded = true; }
      await flush();
    }
  }

  async function flush() {
    clearTimeout(timer);
    try {
      localStorage.setItem(DKEY, JSON.stringify(device));
      await KV.set('global', G);
      await KV.set('data:' + device.sucursal, D);
    } catch (e) {
      UI.toast('No se pudo guardar: ' + e.message, 'error', 6000);
    }
  }
  function save() { clearTimeout(timer); timer = setTimeout(flush, 250); }
  document.addEventListener('visibilitychange', () => { if (document.hidden && G) flush(); });
  window.addEventListener('pagehide', () => { if (G) flush(); });

  function next(k) { const n = D.seq[k] || 1; D.seq[k] = n + 1; return n; }
  const prod = id => D.productos.find(p => p.id === id);
  const cliente = id => D.clientes.find(c => c.id === id);
  const proveedor = id => D.proveedores.find(p => p.id === id);
  function porCodigo(code) {
    code = String(code || '').trim();
    if (!code) return null;
    return D.productos.find(p => p.activo !== false && (p.codigo === code || (p.codigosAlt || []).includes(code))) || null;
  }
  const ofertaActiva = p => !!(p.oferta && +p.oferta.precio > 0 && (!p.oferta.hasta || p.oferta.hasta >= isoDate()));
  const precioLista = (p, lista = 0) => +(p.precios?.[lista]) || +(p.precios?.[0]) || 0;
  /* La oferta se aplica sobre la lista minorista (y sobre cualquier lista si resulta más barata) */
  const precio = (p, lista = 0) => {
    const base = precioLista(p, lista);
    return ofertaActiva(p) && (lista === 0 || +p.oferta.precio < base) ? +p.oferta.precio : base;
  };
  const emoji = p => p.emoji || EMOJI[p.rubro] || '📦';
  /* Imagen del producto: foto real si existe, si no ilustración 3D */
  const img3d = e => 'img/3d/' + [...String(e || '📦')].map(c => c.codePointAt(0).toString(16)).filter(x => x !== 'fe0f' && x !== '200d').join('-') + '.webp';
  const foto = p => p.imagen || img3d(emoji(p));

  /* Movimiento de stock: positivo entra, negativo sale. Consume lotes por FEFO (primero vence, primero sale) */
  function mov(p, cant, tipo, motivo = '', extra = {}) {
    cant = round3(cant);
    if (!cant) return;
    if (!p.lotes) p.lotes = [];
    if (extra.deposito) p.stockDeposito = round3((p.stockDeposito || 0) + cant);
    else p.stock = round3((p.stock || 0) + cant);
    if (!extra.deposito) {
      if (cant > 0 && extra.venc) {
        const l = p.lotes.find(x => x.venc === extra.venc);
        if (l) l.cant = round3(l.cant + cant); else p.lotes.push({ id: uid(), venc: extra.venc, cant });
      } else if (cant < 0 && p.lotes.length) {
        let q = -cant;
        const lotes = extra.loteId ? p.lotes.filter(l => l.id === extra.loteId) : p.lotes.slice().sort((a, b) => a.venc.localeCompare(b.venc));
        for (const l of lotes) { if (q <= 0) break; const t = Math.min(l.cant, q); l.cant = round3(l.cant - t); q = round3(q - t); }
        p.lotes = p.lotes.filter(l => l.cant > 0);
      }
      p.lotes.sort((a, b) => a.venc.localeCompare(b.venc));
    }
    D.movimientos.push({
      id: uid(), fecha: Date.now(), pid: p.id, codigo: p.codigo, nombre: p.nombre, rubro: p.rubro, tipo, cant, motivo,
      costo: p.costo || 0, usuario: (window.App && App.user && App.user.nombre) || '', deposito: !!extra.deposito,
      stock: extra.deposito ? p.stockDeposito : p.stock, ref: extra.ref || '',
    });
    save();
  }

  async function snapshot() {
    await flush();
    const datos = {};
    for (const s of G.sucursales) datos[s.id] = s.id === device.sucursal ? D : await KV.get('data:' + s.id);
    return { tipo: 'kiosco-backup', version: 1, fecha: Date.now(), global: G, datos };
  }
  async function restore(b) {
    if (!b || b.tipo !== 'kiosco-backup') throw new Error('El archivo no es un backup válido del kiosco');
    await KV.set('global', b.global);
    for (const [id, d] of Object.entries(b.datos || {})) if (d) await KV.set('data:' + id, d);
    G = null;
    await init();
  }
  async function autoBackup(force = false) {
    if (!G || (!G.config.backupAuto && !force)) return;
    try {
      const list = (await KV.get('backups')) || [];
      list.unshift(await snapshot());
      await KV.set('backups', list.slice(0, 5));
      G.ultimoBackup = Date.now();
      save();
    } catch { /* sin espacio para el respaldo */ }
  }
  async function backups() { return (await KV.get('backups')) || []; }
  async function resetTodo() {
    for (const s of G.sucursales) await KV.del('data:' + s.id);
    await KV.del('global');
    await KV.del('backups');
    localStorage.removeItem(DKEY);
    G = null;
    await init();
  }
  async function crearSucursal(nombre, copiarDe) {
    const s = { id: uid(), nombre, direccion: '' };
    G.sucursales.push(s);
    const d = defaultData();
    if (copiarDe) {
      const src = copiarDe === device.sucursal ? D : await KV.get('data:' + copiarDe);
      d.productos = (src?.productos || []).map(p => ({ ...p, id: uid(), stock: 0, stockDeposito: 0, lotes: [] }));
      d.proveedores = (src?.proveedores || []).map(p => ({ ...p }));
    }
    await KV.set('data:' + s.id, d);
    await flush();
    return s;
  }

  return {
    uid, RUBROS, EMOJI, init, useSucursal, save, flush, next, prod, cliente, proveedor, porCodigo, precio, precioLista, ofertaActiva, emoji, img3d, foto, mov,
    snapshot, restore, autoBackup, backups, resetTodo, crearSucursal,
    get g() { return G; }, get d() { return D; }, get device() { return device; },
    get sucursal() { return G.sucursales.find(s => s.id === device.sucursal) || G.sucursales[0]; },
  };
})();
