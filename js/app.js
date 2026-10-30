/* Núcleo del panel: sesión, permisos, navegación */
const App = {
  modules: {},
  user: null,
  current: null,
  order: ['dashboard', 'pos', 'caja', 'productos', 'stock', 'precios', 'clientes', 'proveedores', 'pedidos', 'recargas', 'devoluciones', 'reportes', 'usuarios', 'config', 'ayuda'],
  roles: {
    admin: { nombre: 'Administrador', mods: '*' },
    encargado: { nombre: 'Encargado/a', mods: ['dashboard', 'pos', 'caja', 'productos', 'stock', 'precios', 'clientes', 'proveedores', 'pedidos', 'recargas', 'devoluciones', 'reportes', 'ayuda'] },
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
    const t = DB.g.config.tema;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = t;
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
    sessionStorage.setItem('kiosco:user', u.id);
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    this.chrome();
    this.route();
  },

  logout() {
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
    $('#nav').innerHTML = this.order.filter(id => this.modules[id] && this.can(id))
      .map(id => `<a href="#${id}" data-id="${id}"><span class="ico">${this.modules[id].icon}</span>${esc(this.modules[id].title)}</a>`).join('');
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
