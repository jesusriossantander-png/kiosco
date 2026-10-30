/* Núcleo del panel: sesión, permisos, navegación */
/* Íconos de línea del menú */
const NAV_ICON = {
  dashboard: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  pos: '<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  caja: '<rect x="3" y="10" width="18" height="10" rx="2"/><path d="M7 10V5h10v5M7 14h2M11 14h2M15 14h2M7 17h10"/>',
  productos: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  stock: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  precios: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.4-1.2-1.6-2-3-2-1.7 0-3 1-3 2.3 0 3.2 6 1.6 6 4.6 0 1.3-1.3 2.3-3 2.3-1.4 0-2.6-.8-3-2M12 6v1.5M12 16.5V18"/>',
  clientes: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4M3 7h2M3 12h2M3 17h2"/>',
  proveedores: '<path d="M2 6h11v10H2zM13 9h4l3 3.5V16h-7"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  pedidos: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3M9.5 8l2 2 3.5-3.5"/>',
  recargas: '<path d="M5 20v-4M10 20v-8M15 20v-12M20 20V4"/>',
  devoluciones: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  reportes: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  historial: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><path d="M3.5 3.5v5h5M12 7.5V12l3 2"/>',
  usuarios: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c.8-3 3.2-4.8 6-4.8s5.2 1.8 6 4.8"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.3.2 4 1.7 4.5 4.4"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  ayuda: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 8v8M10 8v8M13 8v8M16.5 8v8"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
const navIcon = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${NAV_ICON[id] || ''}</svg>`;

const App = {
  modules: {},
  user: null,
  current: null,
  order: ['dashboard', 'pos', 'caja', 'productos', 'stock', 'precios', 'clientes', 'proveedores', 'pedidos', 'recargas', 'devoluciones', 'reportes', 'historial', 'usuarios', 'config', 'ayuda'],
  grupos: { dashboard: 'Operación', productos: 'Mercadería', clientes: 'Clientes y ventas', reportes: 'Control', usuarios: 'Administración' },
  roles: {
    admin: { nombre: 'Administrador', mods: '*' },
    encargado: { nombre: 'Encargado/a', mods: ['dashboard', 'pos', 'caja', 'productos', 'stock', 'precios', 'clientes', 'proveedores', 'pedidos', 'recargas', 'devoluciones', 'reportes', 'historial', 'ayuda'] },
    cajero: { nombre: 'Cajero/a', mods: ['dashboard', 'pos', 'caja', 'clientes', 'pedidos', 'recargas', 'devoluciones', 'ayuda'] },
    repositor: { nombre: 'Repositor/a', mods: ['dashboard', 'productos', 'stock', 'proveedores', 'ayuda'] },
  },

  register(id, def) { this.modules[id] = { id, ...def }; },
  can(id) {
    const r = this.roles[this.user && this.user.rol];
    return !!r && (r.mods === '*' || r.mods.includes(id));
  },
  esAdmin() { return !!this.user && ['admin', 'encargado'].includes(this.user.rol); },

  async init() {
    try { await DB.init(); }
    catch (e) { document.body.innerHTML = `<p style="padding:20px">No se pudo abrir la base de datos local: ${esc(e.message)}</p>`; return; }
    this.tema();
    const u = DB.g.usuarios.find(x => x.id === sessionStorage.getItem('kiosco:user') && x.activo);
    u ? this.start(u) : this.login();
    window.addEventListener('hashchange', () => this.route());
    window.addEventListener('online', () => this.netState());
    window.addEventListener('offline', () => this.netState());
    setInterval(() => DB.autoBackup(), 15 * 60 * 1000);
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  },

  tema() {
    document.documentElement.dataset.theme = 'light';
    if (!this.reloj) {
      const tick = () => {
        const d = new Date(), h = $('#clk-h'), f = $('#clk-d');
        if (!h) return;
        h.textContent = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        const t = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        f.textContent = t.charAt(0).toUpperCase() + t.slice(1);
        h.closest('.clock').title = f.textContent;
      };
      tick();
      this.reloj = setInterval(tick, 1000);
    }
  },

  login() {
    $('#app').classList.add('hidden');
    const L = $('#login');
    L.classList.remove('hidden');
    $('#login-negocio').textContent = DB.g.config.negocio.nombre;
    const users = DB.g.usuarios.filter(u => u.activo);
    const ini = n => n.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
    $('#login-users').innerHTML = users.map(u => `<button data-u="${u.id}"><span class="avatar">${esc(ini(u.nombre))}</span><span><b>${esc(u.nombre)}</b><br><small class="muted">${esc(this.roles[u.rol]?.nombre || u.rol)}</small></span></button>`).join('');
    const def = DB.g.usuarios.some(u => u.id === 'u-admin' && u.pin === '1234');
    $('#login-hint').textContent = def ? 'Primera vez: Administrador PIN 1234 · Cajero/a PIN 0000. Cambialos en Usuarios.' : '';
    const form = $('#login-form'), pin = $('#login-pin');
    let sel = null;
    const elegir = u => {
      sel = u;
      $('#login-users').classList.add('hidden');
      form.classList.remove('hidden');
      $('#login-sel').innerHTML = `<span class="avatar">${esc(ini(u.nombre))}</span>${esc(u.nombre)}`;
      pin.value = '';
      if (!isTouch) pin.focus();
    };
    const probar = () => {
      if (sel && pin.value === sel.pin) { L.classList.add('hidden'); this.start(sel); }
      else { UI.beep(false); UI.toast('PIN incorrecto', 'error'); pin.value = ''; }
    };
    $$('#login-users button').forEach(b => { b.onclick = () => elegir(users.find(u => u.id === b.dataset.u)); });
    $('#login-back').onclick = () => { form.classList.add('hidden'); $('#login-users').classList.remove('hidden'); };
    form.onsubmit = e => { e.preventDefault(); probar(); };
    $$('.pinpad button', form).forEach(b => {
      b.onclick = () => {
        const k = b.dataset.k;
        if (k === 'ok') probar();
        else if (k === 'del') pin.value = pin.value.slice(0, -1);
        else pin.value += k;
      };
    });
    if (users.length === 1) elegir(users[0]);
  },

  start(u) {
    this.user = u;
    if (sessionStorage.getItem('kiosco:user') !== u.id) DB.log('sesion', 'Inicio de sesión', `${this.roles[u.rol]?.nombre || u.rol} · ${DB.device.caja}`);
    sessionStorage.setItem('kiosco:user', u.id);
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    this.chrome();
    this.route();
  },

  logout() {
    if (this.user) DB.log('sesion', 'Cierre de sesión', this.user.nombre);
    this.current && this.current.destroy && this.current.destroy();
    this.current = null;
    sessionStorage.removeItem('kiosco:user');
    this.user = null;
    location.hash = '';
    this.login();
  },

  chrome() {
    $('#brand-name').textContent = DB.g.config.negocio.nombre;
    $('#brand-suc').textContent = `${DB.sucursal.nombre} · ${DB.device.caja}`;
    $('#side-user').innerHTML = `<b>${esc(this.user.nombre)}</b><br><span class="muted">${esc(this.roles[this.user.rol]?.nombre || '')}</span>`;
    let grupo = '';
    $('#nav').innerHTML = this.order.filter(id => this.modules[id] && this.can(id)).map(id => {
      const sep = this.grupos[id] && this.grupos[id] !== grupo ? `<div class="nav-sep">${esc((grupo = this.grupos[id]))}</div>` : '';
      return `${sep}<a href="#${id}" data-id="${id}"><span class="ico">${navIcon(id)}</span>${esc(this.modules[id].title)}</a>`;
    }).join('');
    $('#bottombar').innerHTML = [['#dashboard', 'dashboard', 'Inicio'], ['#pos', 'pos', 'Vender'], ['#', 'scan', 'Escanear', 'bb-scan'], ['#stock', 'stock', 'Stock'], ['#', 'menu', 'Menú', 'bb-menu']]
      .map(([href, ic, l, id]) => `<a href="${href}" ${id ? `id="${id}"` : ''}>${navIcon(ic)}<span>${l}</span></a>`).join('');
    $('#btn-logout').onclick = () => this.logout();
    const sb = $('#sidebar'), bd = $('#backdrop');
    const toggle = open => { sb.classList.toggle('open', open); bd.classList.toggle('show', open); };
    $('#menu-btn').onclick = () => toggle(true);
    $('#bb-menu').onclick = e => { e.preventDefault(); toggle(true); };
    bd.onclick = () => toggle(false);
    $('#nav').onclick = () => toggle(false);
    $('#bb-scan').onclick = e => { e.preventDefault(); this.escanearGlobal(); };
    $$('#bottombar a[href^="#"]').forEach(a => { const id = a.getAttribute('href').slice(1); if (id && !this.can(id)) a.classList.add('hidden'); });
    this.netState();
    this.cajaPill();
  },

  netState() {
    const n = $('#net');
    if (!n) return;
    n.className = 'pill ' + (navigator.onLine ? 'ok' : 'warn');
    n.textContent = navigator.onLine ? '● En línea' : '● Sin conexión (sigue funcionando)';
  },

  cajaPill() {
    const p = $('#caja-pill');
    if (!p || typeof Caja === 'undefined') return;
    const t = Caja.actual();
    p.className = 'pill ' + (t ? 'ok' : 'danger');
    p.textContent = t ? `Caja abierta · ${t.usuario}` : 'Caja cerrada';
    p.onclick = () => this.go('caja');
    p.style.cursor = 'pointer';
  },

  route() {
    if (!this.user) return;
    let [mod, ...rest] = (location.hash.slice(1) || 'dashboard').split('/');
    if (!this.modules[mod] || !this.can(mod)) mod = this.order.find(id => this.modules[id] && this.can(id));
    if (this.current && this.current.destroy) this.current.destroy();
    const m = this.modules[mod];
    $('#title').textContent = m.title;
    document.title = `${m.title} · ${DB.g.config.negocio.nombre}`;
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.id === mod));
    $$('#bottombar a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + mod));
    const view = $('#view');
    view.className = 'view view-' + mod;
    view.innerHTML = '';
    this.current = m;
    m.render(view, rest);
    this.cajaPill();
    window.scrollTo(0, 0);
  },

  go(id) { if (location.hash === '#' + id) this.route(); else location.hash = id; },
  refresh() { this.route(); },

  /* Botón "Escanear" del celular: en Vender agrega al carrito; en otras pantallas consulta precio y stock */
  escanearGlobal() {
    if (this.current && this.current.id === 'pos' && this.can('pos')) return POS.camara();
    Scanner.open({
      title: 'Consultar producto',
      onScan: (code, m) => {
        const p = DB.porCodigo(code);
        m.close();
        setTimeout(() => (p ? Productos.ficha(p) : Productos.desconocido(code)), 50);
        return p ? '' : null;
      },
    });
  },
};
