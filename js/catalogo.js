/* Catálogo público: lo usan la landing y la app de clientes */
const Catalogo = (() => {
  const EMO = { Bebidas: '🥤', Cigarrillos: '🚬', Golosinas: '🍬', Galletitas: '🍪', Snacks: '🍟', Almacén: '🛒', Lácteos: '🥛', Fiambres: '🧀', Panadería: '🥖', Helados: '🍦', Limpieza: '🧴', Perfumería: '🧼', Librería: '✏️', Varios: '📦' };

  /* Si en este mismo dispositivo se usó el panel, se muestran los datos en vivo (útil para la demo) */
  async function desdePanel() {
    try {
      const g = await KV.get('global');
      if (!g) return null;
      const dev = JSON.parse(localStorage.getItem('kiosco:device') || 'null');
      const d = await KV.get('data:' + ((dev && dev.sucursal) || g.sucursales[0].id));
      if (!d) return null;
      const prods = d.productos.filter(p => p.publicar !== false && p.activo !== false && +p.precios[0] > 0).map(p => ({
        c: p.codigo, n: p.nombre, r: p.rubro, m: p.marca, p: +p.precios[0], e: p.emoji || EMO[p.rubro] || '📦', i: p.imagen || '', k: p.porPeso ? 1 : 0, s: p.stock > 0 ? 1 : 0, d: p.favorito ? 1 : 0,
      }));
      return { local: true, negocio: g.config.negocio, rubros: g.config.rubros.filter(r => prods.some(p => p.r === r)), productos: prods };
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

  return { EMO, cargar, waNumero };
})();
