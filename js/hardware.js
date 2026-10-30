/* Periféricos: impresora térmica 80 mm (ESC/POS), cajón de dinero y balanza.
   Usa Web Serial (Chrome/Edge en PC). Si no hay conexión, el ticket se imprime con el diálogo del navegador. */
const HW = {
  printer: null, pWriter: null, scale: null, peso: null, pesoTs: 0,
  get serial() { return 'serial' in navigator; },

  async conectarImpresora() {
    if (!this.serial) throw new Error('Este navegador no permite conectar dispositivos por USB/serie. Usá Chrome o Edge en una PC.');
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: +DB.g.config.ticket.baud || 9600 });
    this.printer = port;
    this.pWriter = port.writable.getWriter();
  },

  async enviar(bytes) {
    if (!this.pWriter) return false;
    try { await this.pWriter.write(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)); return true; }
    catch { this.pWriter = null; this.printer = null; UI.toast('Se perdió la conexión con la impresora', 'error'); return false; }
  },

  /* Pulso ESC/POS al cajón conectado a la impresora (RJ11) */
  async abrirCajon() {
    const ok = await this.enviar([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    if (!ok) UI.toast('Cajón: conectá la impresora térmica en Configuración → Ticket e impresora', 'info');
    return ok;
  },

  async conectarBalanza() {
    if (!this.serial) throw new Error('Este navegador no permite conectar la balanza. Usá Chrome o Edge en una PC. En el celular podés ingresar el peso o escanear la etiqueta de la balanza.');
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: +DB.g.config.balanza.baud || 9600 });
    this.scale = port;
    const dec = new TextDecoderStream();
    port.readable.pipeTo(dec.writable).catch(() => {});
    const reader = dec.readable.getReader();
    let buf = '';
    const parse = s => { const m = s.match(/(\d+[.,]\d+)/); if (m) { this.peso = parseFloat(m[1].replace(',', '.')); this.pesoTs = Date.now(); } };
    (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          const lines = buf.split(/[\r\n\x02\x03]+/);
          buf = lines.pop();
          lines.forEach(parse);
          if (buf.length > 6) parse(buf);
          if (buf.length > 200) buf = '';
        }
      } catch { this.scale = null; }
    })();
  },

  async leerPeso() {
    if (!this.scale) return null;
    try {
      const w = this.scale.writable.getWriter();
      await w.write(new TextEncoder().encode(DB.g.config.balanza.comando || 'P'));
      w.releaseLock();
    } catch { /* algunas balanzas transmiten solas */ }
    const t0 = Date.now();
    await new Promise(r => setTimeout(r, 450));
    return this.pesoTs >= t0 - 1500 ? this.peso : this.peso;
  },
};

/* Documento de ticket: filas = 'texto' | ['izq','der'] | {c:'centrado', b:true} | '-' */
const Ticket = {
  cols() { return +DB.g.config.ticket.ancho || 42; },

  texto(rows) {
    const W = this.cols();
    const ascii = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '');
    return rows.map(r => {
      if (r === '-') return '-'.repeat(W);
      if (Array.isArray(r)) {
        const a = ascii(r[0]), b = ascii(r[1]);
        const sp = W - a.length - b.length;
        return sp >= 1 ? a + ' '.repeat(sp) + b : a.slice(0, W) + '\n' + ' '.repeat(Math.max(0, W - b.length)) + b;
      }
      if (typeof r === 'object') {
        const s = ascii(r.c).slice(0, W);
        return ' '.repeat(Math.floor((W - s.length) / 2)) + s;
      }
      return ascii(r);
    }).join('\n');
  },

  html(rows) {
    return rows.map(r => {
      if (r === '-') return '<hr>';
      if (Array.isArray(r)) return `<div class="lr ${r[2] || ''}"><span>${esc(r[0])}</span><span>${esc(r[1])}</span></div>`;
      if (typeof r === 'object') return `<div class="c ${r.b ? 'b' : ''}">${esc(r.c)}</div>`;
      return `<div>${esc(r)}</div>`;
    }).join('');
  },

  /* Demo: muestra el ticket simulado en pantalla tal como saldría en la impresora térmica de 80 mm */
  imprimir(rows, { codigo = '', titulo = 'Ticket' } = {}) {
    const n = Date.now() % 100000000;
    const cod = codigo || String(n).padStart(8, '0');
    const body = h(`<div class="tk-wrap"><div class="tk-paper">${this.html(rows)}
      <div class="tk-bars" aria-hidden="true">${this.barras(cod)}</div><div class="c tk-cod">${esc(cod)}</div></div>
      <p class="muted small center mt">Vista simulada del ticket térmico de 80 mm${HW.pWriter ? ' · impresora conectada' : ''}</p></div>`);
    UI.modal({
      title: `🧾 ${titulo}`, body, size: 'ticket',
      actions: [
        { label: '🖨️ Imprimir', onClick: () => { this.imprimirReal(rows); return false; } },
        { label: 'Listo (Enter)', class: 'primary', id: 'tk-ok' },
      ],
      onOpen: root => { const b = $('#tk-ok', root); if (b) b.focus(); },
      onClose: () => { const q = $('#pos-q'); if (q && !isTouch) setTimeout(() => q.focus()); },
    });
  },

  /* Código de barras decorativo a partir del número del comprobante */
  barras(cod) {
    let out = '';
    let x = 0;
    const digits = ('1' + cod + '9').split('').map(Number);
    digits.forEach((d, i) => {
      const w1 = 1 + (d % 3), w2 = 1 + ((d + i) % 2), w3 = 1 + ((d * 7 + i) % 3);
      out += `<i style="left:${x}px;width:${w1}px"></i>`; x += w1 + w2;
      out += `<i style="left:${x}px;width:${w3}px"></i>`; x += w3 + 1 + (d % 2);
    });
    return `<div style="width:${x}px">${out}</div>`;
  },

  async imprimirReal(rows) {
    if (HW.pWriter) {
      const enc = new TextEncoder();
      const ok = await HW.enviar([0x1b, 0x40, ...enc.encode(this.texto(rows) + '\n\n\n\n'), 0x1d, 0x56, 0x42, 0x00]);
      if (ok) return;
    }
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    document.body.append(f);
    f.contentDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>
      @page { size: 80mm auto; margin: 3mm; }
      body { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; width: 72mm; margin: 0; color: #000; }
      .lr { display: flex; justify-content: space-between; gap: 8px; } .lr span:last-child { white-space: nowrap; }
      .c { text-align: center; } .b { font-weight: 700; font-size: 14px; } hr { border: 0; border-top: 1px dashed #000; }
    </style></head><body>${this.html(rows)}</body></html>`);
    f.contentDocument.close();
    setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 150);
  },

  cabecera(titulo) {
    const n = DB.g.config.negocio;
    const r = [{ c: n.nombre, b: true }];
    if (n.direccion) r.push({ c: n.direccion });
    if (n.telefono) r.push({ c: 'Tel: ' + n.telefono });
    if (n.cuit) r.push({ c: 'CUIT: ' + n.cuit });
    r.push('-', { c: titulo, b: true });
    return r;
  },

  venta(v) {
    const rows = this.cabecera(`TICKET #${v.nro}`);
    rows.push(['Fecha', fechaHora(v.fecha)], ['Caja', `${v.caja} · ${v.usuario}`]);
    if (v.cliente) rows.push(['Cliente', v.cliente]);
    rows.push('-');
    v.items.forEach(i => {
      rows.push(i.nombre);
      rows.push([`  ${fmtN(i.cant, 3)} x ${fmt(i.precio)}`, fmt(i.cant * i.precio)]);
    });
    rows.push('-');
    if (v.descuento) rows.push(['Subtotal', fmt(v.subtotal)], [`Descuento ${v.descPct}%`, '-' + fmt(v.descuento)]);
    rows.push(['TOTAL', fmt(v.total), 'big']);
    v.pagos.forEach(p => rows.push([medioNombre(p.medio), fmt(p.monto)]));
    if (v.vuelto) rows.push(['Su vuelto', fmt(v.vuelto)]);
    rows.push('-', { c: 'Comprobante no válido como factura' }, { c: DB.g.config.negocio.mensajeTicket || '' });
    return this.imprimir(rows, { codigo: String(v.nro).padStart(8, '0'), titulo: `Ticket de venta #${v.nro}` });
  },
};

function medioNombre(id) {
  const m = DB.g.config.medios.find(x => x.id === id);
  return m ? m.nombre : id;
}
