/* Catálogo público y componentes visuales compartidos por la landing y la app de clientes */
const Catalogo = (() => {
  const EMO = { Bebidas: '🥤', Cigarrillos: '🚬', Golosinas: '🍫', Galletitas: '🍪', Snacks: '🍟', Almacén: '🧉', Lácteos: '🥛', Fiambres: '🧀', Panadería: '🥖', Helados: '🍦', Limpieza: '🧴', Perfumería: '🧼', Librería: '✏️', Varios: '📦' };

  /* Arma el catálogo público a partir de los datos del panel (misma lógica para el JSON publicado) */
  function construir(g, d) {
    const hoy = isoDate();
    const conOferta = p => p.oferta && +p.oferta.precio > 0 && (!p.oferta.hasta || p.oferta.hasta >= hoy) && +p.oferta.precio < +p.precios[0];
    const n = g.config.negocio;
    const productos = d.productos.filter(p => p.publicar !== false && p.activo !== false && +p.precios[0] > 0).map(p => ({
      c: p.codigo, n: p.nombre, r: p.rubro, m: p.marca, p: conOferta(p) ? +p.oferta.precio : +p.precios[0], o: conOferta(p) ? +p.precios[0] : 0,
      h: conOferta(p) ? p.oferta.hasta || '' : '', e: p.emoji || EMO[p.rubro] || '📦', i: p.imagen || '', k: p.porPeso ? 1 : 0, s: p.stock > 0 ? 1 : 0, d: p.favorito ? 1 : 0,
    }));
    return {
      actualizado: Date.now(),
      negocio: { nombre: n.nombre, whatsapp: n.whatsapp, direccion: n.direccion, telefono: n.telefono, horario: n.horario, alias: n.alias, mpLink: n.mpLink },
      app: g.config.app || {},
      rubros: g.config.rubros.filter(r => productos.some(p => p.r === r)),
      productos,
    };
  }

  /* Si en este dispositivo se usó el panel, se muestran los datos en vivo (útil para la demo) */
  async function desdePanel() {
    try {
      const g = await KV.get('global');
      if (!g) return null;
      const dev = JSON.parse(localStorage.getItem('kiosco:device') || 'null');
      const d = await KV.get('data:' + ((dev && dev.sucursal) || g.sucursales[0].id));
      return d ? { local: true, ...construir(g, d) } : null;
    } catch { return null; }
  }

  async function cargar() {
    const local = await desdePanel();
    if (local) return local;
    const r = await fetch('data/catalogo.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('catálogo no disponible');
    return r.json();
  }

  function waNumero(tel) {
    let n = String(tel || '').replace(/\D/g, '');
    if (n && !n.startsWith('54')) n = '549' + n.replace(/^0/, '');
    return n;
  }

  return { EMO, construir, cargar, waNumero };
})();

const Tienda = (() => {
  const SVG = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    pct: '<path d="M12 2.8l2.1 1.6 2.6-.3 1 2.4 2.4 1-.3 2.6L21.2 12l-1.6 2.1.3 2.6-2.4 1-1 2.4-2.6-.3L12 21.2l-2.1-1.6-2.6.3-1-2.4-2.4-1 .3-2.6L2.8 12l1.6-2.1-.3-2.6 2.4-1 1-2.4 2.6.3z"/><path d="m9 15 6-6"/><circle cx="9.3" cy="9.3" r=".6"/><circle cx="14.7" cy="14.7" r=".6"/>',
    user: '<circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="10" r="3.2"/><path d="M6.2 18.4c1.3-2.2 3.4-3.4 5.8-3.4s4.5 1.2 5.8 3.4"/>',
    cart: '<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
    cartPlus: '<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/><path d="M13 8.5v5M10.5 11h5"/>',
    search: '<circle cx="11" cy="11" r="6.8"/><path d="m20 20-4.2-4.2"/>',
    back: '<path d="M20 12H5M11 5l-7 7 7 7"/>',
    right: '<path d="m9 5 7 7-7 7"/>',
    down: '<path d="m5 9 7 7 7-7"/>',
    share: '<path d="M12 15V3M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5a1 1 0 0 0 1 .9h7a1 1 0 0 0 1-.9l1-12.5M10 11v6M14 11v6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    note: '<rect x="3.5" y="4.5" width="17" height="13" rx="2.5"/><path d="M8 21l3-3.5M8.5 11h.01M12 11h.01M15.5 11h.01"/>',
    swap: '<rect x="4" y="13" width="7" height="7" rx="1.2"/><path d="M14 4h2M18 4h2v2M20 9v2M14 11h.01M4 9V6a2 2 0 0 1 2-2h3"/><path d="m7 7-3 2-1-3"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    store: '<path d="M4 10v10h16V10M3 10l1.5-5h15L21 10z"/><path d="M9 20v-5h6v5"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  };
  const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${SVG[n] || ''}</svg>`;
  const img3d = e => 'img/3d/' + [...String(e || '📦')].map(c => c.codePointAt(0).toString(16)).filter(x => x !== 'fe0f' && x !== '200d').join('-') + '.webp';
  const graf = s => (window.Intl && Intl.Segmenter ? [...new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(s)].map(x => x.segment) : [...s]);
  const money = n => '$' + (+n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const foto = p => p.i || img3d(p.e);
  const COLOR = { Bebidas: '#2563eb', Golosinas: '#db2777', Galletitas: '#b45309', Snacks: '#ea580c', Almacén: '#15803d', Lácteos: '#0284c7', Fiambres: '#ca8a04', Panadería: '#a16207', Helados: '#7c3aed', Limpieza: '#0891b2', Perfumería: '#9333ea', Librería: '#475569', Varios: '#475569' };

  function contenido(nombre) {
    const m = String(nombre).match(/(\d+(?:[.,]\d+)?)\s*(ml|cc|cm3|l|lt|lts|litros?|g|gr|grs|kg)(?![a-z])/i);
    if (!m) return null;
    const v = parseFloat(m[1].replace(',', '.')); const u = m[2].toLowerCase();
    if (['ml', 'cc', 'cm3'].includes(u)) return { v: v / 1000, u: 'L', txt: `${fmtN(v, 0)} ml` };
    if (u.startsWith('l')) return { v, u: 'L', txt: `${fmtN(v, 2)} L` };
    if (u === 'kg') return { v, u: 'kg', txt: `${fmtN(v, 2)} kg` };
    return { v: v / 1000, u: 'kg', txt: `${fmtN(v, 0)} g` };
  }
  function unidad(p) {
    if (p.k) return 'Precio por kg';
    const c = contenido(p.n);
    return c && c.v ? `1 ${c.u} a ${money(Math.round(p.p / c.v * 100) / 100)}` : '';
  }
  const pct = p => (p.o ? Math.round((1 - p.p / p.o) * 100) : 0);

  function control(p, q) {
    if (q) return `<div class="pc-qty" data-stop><button data-dec="${esc(p.c)}" aria-label="Quitar uno">${q <= (p.k ? 0.25 : 1) ? icon('trash') : icon('minus')}</button><b>${fmtN(q, 3)}${p.k ? ' kg' : ''}</b><button data-inc="${esc(p.c)}" aria-label="Agregar uno">${icon('plus')}</button></div>`;
    return `<button class="pc-add" data-add="${esc(p.c)}" aria-label="Agregar ${esc(p.n)} al carro">${icon('cartPlus')}</button>`;
  }

  function card(p, q = 0) {
    const c = contenido(p.n);
    const strip = c ? c.txt : p.k ? 'Por kg' : p.r || '';
    return `<article class="pc" data-p="${esc(p.c)}">
      <div class="pc-img">${p.d && !p.o ? '<span class="pc-tag">Más vendido</span>' : ''}<img src="${esc(foto(p))}" alt="" loading="lazy" class="${p.i ? 'real' : ''}">
        <span class="pc-strip" style="background:${COLOR[p.r] || '#475569'}">${esc(strip)}</span>
        <span data-ctl="${esc(p.c)}">${control(p, q)}</span></div>
      <div class="pc-unit">${esc(unidad(p))}</div>
      <div class="pc-price">${money(p.p)}${p.k ? '<small style="font-size:13px;color:#6b7280"> /kg</small>' : ''}</div>
      <div class="pc-old">${p.o ? `<s>${money(p.o)}</s><span class="pc-pct">${pct(p)}%</span>` : ''}</div>
      ${p.m ? `<div class="pc-brand">${esc(p.m)}</div>` : '<div class="pc-brand">&nbsp;</div>'}
      <div class="pc-name">${esc(p.n)}</div>${p.s ? '' : '<div class="pc-out">Consultar disponibilidad</div>'}
    </article>`;
  }

  function slide(b, i) {
    const arts = graf(b.emoji || '🛍️').slice(0, 3);
    return `<button class="t-slide c-${esc(b.color || 'naranja')}" data-link="${esc(b.link || '')}" data-i="${i}">
      <div class="txt">${b.badge ? `<span class="bd">${esc(b.badge)}</span>` : ''}<h3>${esc(b.titulo)}</h3><p>${esc(b.sub || '')}</p></div>
      <div class="art">${arts.map(e => `<img src="${img3d(e)}" alt="">`).join('')}</div></button>`;
  }
  function carousel(banners) {
    return `<div class="t-carousel" data-carousel><div class="t-track">${banners.map(slide).join('')}</div>
      <div class="t-dots">${banners.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div></div>`;
  }

  /* Carrusel que avanza solo y se puede deslizar con el dedo */
  let timers = [];
  function activar(root, onLink) {
    $$('[data-carousel]', root).forEach(c => {
      const track = $('.t-track', c), dots = $$('.t-dots i', c), n = dots.length;
      if (!n) return;
      let i = 0, pausa = 0;
      const ancho = () => track.firstElementChild.getBoundingClientRect().width + 12;
      const marcar = () => dots.forEach((d, k) => d.classList.toggle('on', k === i));
      track.addEventListener('scroll', () => { const k = Math.round(track.scrollLeft / ancho()); if (k !== i) { i = Math.max(0, Math.min(n - 1, k)); marcar(); } }, { passive: true });
      track.addEventListener('pointerdown', () => { pausa = Date.now() + 7000; });
      track.addEventListener('touchstart', () => { pausa = Date.now() + 7000; }, { passive: true });
      timers.push(setInterval(() => {
        if (Date.now() < pausa || document.hidden || !document.body.contains(track)) return;
        i = (i + 1) % n;
        track.scrollTo({ left: i * ancho(), behavior: i === 0 ? 'auto' : 'smooth' });
        marcar();
      }, 4500));
      $$('.t-slide', c).forEach(s => { s.onclick = () => onLink && onLink(s.dataset.link); });
    });
  }
  function detener() { timers.forEach(clearInterval); timers = []; }

  /* Mosaico de "HASTA X% EN RUBRO" calculado a partir de las ofertas reales */
  function mosaico(productos) {
    const m = {};
    productos.filter(p => p.o).forEach(p => { const r = (m[p.r] ||= { r: p.r, max: 0, es: [] }); r.max = Math.max(r.max, pct(p)); if (r.es.length < 3 && !r.es.includes(p.e)) r.es.push(p.e); });
    const list = Object.values(m).sort((a, b) => b.max - a.max).slice(0, 5);
    const colors = ['linear-gradient(160deg,#f59e0b,#ea580c)', 'linear-gradient(160deg,#fb923c,#f97316)', 'linear-gradient(160deg,#f97316,#c2410c)'];
    return list.map((t, k) => `<button class="t-tile ${k === 0 || k === 3 ? 'wide' : ''}" data-rubro="${esc(t.r)}" style="background:${colors[k % 3]}">
      <small>HASTA</small><b>${t.max}<sup>%</sup></b><em>${esc(t.r)}</em>
      <div class="art">${t.es.map(e => `<img src="${img3d(e)}" alt="">`).join('')}</div></button>`).join('');
  }

  return { icon, img3d, money, foto, card, control, carousel, activar, detener, mosaico, unidad, contenido, pct, COLOR, graf };
})();
