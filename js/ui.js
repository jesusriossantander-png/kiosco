/* Utilidades de interfaz compartidas por el panel y la app de clientes */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const ARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const fmt = n => ARS.format(Math.round((+n || 0) * 100) / 100);
const fmtN = (n, d = 2) => (+n || 0).toLocaleString('es-AR', { maximumFractionDigits: d });
const round2 = n => Math.round((+n || 0) * 100) / 100;
const round3 = n => Math.round((+n || 0) * 1000) / 1000;
const sum = (arr, f = x => x) => round2(arr.reduce((a, x) => a + (+f(x) || 0), 0));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const isTouch = matchMedia('(pointer: coarse)').matches;

/* Convierte "1.234,56", "1234.56" o "$ 1.000" en número */
function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v ?? '').replace(/[$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function isoDate(d = new Date()) { return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
function addDays(n, base = new Date()) { const d = new Date(base); d.setDate(d.getDate() + n); return isoDate(d); }
const fechaHora = ts => new Date(ts).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
const fechaCorta = ts => new Date(ts).toLocaleDateString('es-AR');
const fechaISO = iso => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('es-AR') : '');
const diasHasta = iso => Math.round((new Date(iso + 'T00:00:00') - new Date(isoDate() + 'T00:00:00')) / 864e5);

function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function opts(list, sel, val = x => x, txt = x => x) {
  return list.map(x => `<option value="${esc(val(x))}" ${String(val(x)) === String(sel) ? 'selected' : ''}>${esc(txt(x))}</option>`).join('');
}

const CDN = {
  scanner: 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  qr: 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
};
const _scripts = {};
function loadScript(src) {
  return (_scripts[src] ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => { delete _scripts[src]; s.remove(); rej(new Error('No se pudo cargar un componente (¿sin internet?)')); };
    document.head.append(s);
  }));
}

const UI = {
  toast(msg, type = 'info', ms = 3200) {
    let box = $('#toasts');
    if (!box) { box = h('<div id="toasts" class="toasts" aria-live="polite"></div>'); document.body.append(box); }
    const t = h(`<div class="toast ${type}">${esc(msg)}</div>`);
    box.append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
  },

  /* actions: [{label, class, onClick(close, root)}] — si onClick devuelve false el modal queda abierto */
  modal({ title, body = '', actions = [], size = '', onClose, onOpen } = {}) {
    const root = h(`<div class="modal-back"><div class="modal ${size}" role="dialog" aria-modal="true">
      <header><h2>${esc(title)}</h2><button class="icon-btn" data-x aria-label="Cerrar">✕</button></header>
      <div class="modal-body"></div><footer></footer></div></div>`);
    const bodyEl = $('.modal-body', root);
    if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.append(body);
    const foot = $('footer', root);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      root.remove();
      document.removeEventListener('keydown', onKey, true);
      onClose && onClose();
    };
    const onKey = e => {
      if (e.key === 'Escape' && root === $$('.modal-back').pop()) { e.preventDefault(); e.stopPropagation(); close(); }
    };
    actions.forEach(a => {
      const b = h(`<button class="btn ${a.class || ''}" type="button">${a.label}</button>`);
      if (a.id) b.id = a.id;
      b.onclick = async () => {
        if (a.onClick) {
          b.disabled = true;
          let r;
          try { r = await a.onClick(close, root); } finally { b.disabled = false; }
          if (r === false) return;
        }
        close();
      };
      foot.append(b);
    });
    if (!actions.length) foot.remove();
    $('[data-x]', root).onclick = close;
    document.body.append(root);
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => {
      const f = $('[autofocus]', root) || $('input:not([type=checkbox]):not([type=file]),select,textarea', bodyEl);
      if (f && !isTouch) f.focus();
      onOpen && onOpen(root);
    });
    return { el: root, body: bodyEl, close };
  },

  confirm(msg, { ok = 'Aceptar', danger = false, title = 'Confirmar' } = {}) {
    return new Promise(res => {
      let r = false;
      UI.modal({
        title, body: `<p>${esc(msg)}</p>`,
        actions: [{ label: 'Cancelar' }, { label: ok, class: danger ? 'danger' : 'primary', onClick: () => { r = true; } }],
        onClose: () => res(r),
      });
    });
  },

  prompt(title, { label = '', value = '', type = 'text', inputmode = '', placeholder = '' } = {}) {
    return new Promise(res => {
      let r = null;
      const m = UI.modal({
        title,
        body: `<label class="lbl">${esc(label)}</label><input class="input lg" id="ui-prompt" type="${type}" ${inputmode ? `inputmode="${inputmode}"` : ''} value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" autofocus>`,
        actions: [{ label: 'Cancelar' }, { label: 'Aceptar', class: 'primary', onClick: (c, root) => { r = $('#ui-prompt', root).value; } }],
        onClose: () => res(r),
      });
      const inp = $('#ui-prompt', m.el);
      if (isTouch) inp.focus();
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { r = inp.value; m.close(); } });
    });
  },

  /* Pide PIN de administrador/encargado si el usuario actual no lo es */
  async autorizar(motivo) {
    if (App.esAdmin()) return App.user;
    const pin = await UI.prompt('Autorización requerida', { label: `${motivo} — PIN de administrador o encargado`, type: 'password', inputmode: 'numeric' });
    if (pin == null) return null;
    const u = DB.g.usuarios.find(x => x.activo && x.pin === pin && ['admin', 'encargado'].includes(x.rol));
    if (!u) UI.toast('PIN incorrecto: no autorizado', 'error');
    return u || null;
  },

  beep(ok = true) {
    try {
      const ctx = (UI._ctx ||= new (window.AudioContext || window.webkitAudioContext)());
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = ok ? 1250 : 300;
      o.type = 'square';
      g.gain.value = 0.06;
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + (ok ? 0.08 : 0.25));
    } catch { /* sin audio */ }
  },

  formData(root) {
    const o = {};
    $$('[name]', root).forEach(i => {
      if (i.type === 'checkbox') o[i.name] = i.checked;
      else if (i.type === 'number' || 'num' in i.dataset) o[i.name] = num(i.value);
      else o[i.name] = i.value.trim();
    });
    return o;
  },

  download(name, content, type = 'application/json') {
    const b = content instanceof Blob ? content : new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  },

  bars(data, f = fmt) {
    if (!data.length) return UI.empty('Sin datos en el período');
    const max = Math.max(1, ...data.map(d => d.value));
    return `<div class="bars">${data.map(d => `<div class="bar-row"><span class="bar-l" title="${esc(d.label)}">${esc(d.label)}</span><span class="bar-t"><span style="width:${(Math.max(0, d.value) / max * 100).toFixed(1)}%"></span></span><span class="bar-v">${f(d.value)}</span></div>`).join('')}</div>`;
  },

  vbars(data, f = fmt) {
    const max = Math.max(1, ...data.map(d => d.value));
    return `<div class="vbars">${data.map(d => `<div class="vbar" title="${esc(d.label)}: ${esc(f(d.value))}"><i style="height:${(d.value / max * 100).toFixed(1)}%"></i><small>${esc(d.label)}</small></div>`).join('')}</div>`;
  },

  async qr(el, text, size = 180) {
    try {
      await loadScript(CDN.qr);
      el.innerHTML = '';
      new QRCode(el, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
    } catch { el.textContent = '(El código QR necesita conexión la primera vez)'; }
  },

  /* tabs: [{id,label}] — devuelve el HTML; manejar clicks con data-tab */
  tabs(list, active) {
    return `<div class="tabs" role="tablist">${list.map(t => `<button data-tab="${t.id}" class="${t.id === active ? 'active' : ''}" role="tab">${t.label}</button>`).join('')}</div>`;
  },

  empty(msg) { return `<div class="empty">${msg}</div>`; },
};

/* Lectura/escritura de planillas Excel o CSV */
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = (rows.shift() || []).map(x => x.trim());
  return rows.filter(r => r.some(x => x.trim())).map(r => Object.fromEntries(head.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const Excel = {
  async exportar(nombre, rows, hoja = 'Datos') {
    if (!rows.length) return UI.toast('No hay datos para exportar', 'warn');
    try {
      await loadScript(CDN.xlsx);
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, hoja.slice(0, 31));
      XLSX.writeFile(wb, nombre + '.xlsx');
    } catch {
      const cols = Object.keys(rows[0]);
      const csv = [cols.join(';'), ...rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n');
      UI.download(nombre + '.csv', '﻿' + csv, 'text/csv');
    }
  },
  async leer(file) {
    if (/\.(csv|txt)$/i.test(file.name)) return parseCSV(await file.text());
    await loadScript(CDN.xlsx);
    const wb = XLSX.read(await file.arrayBuffer());
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  },
};

/* Ventanas flotantes en lugar de desplegables: cada <select> y cada campo con lista de sugerencias
   se reemplaza visualmente por un botón que abre una ventana con las opciones. El <select> original
   queda oculto, así el resto del código sigue leyendo .value y escuchando "change". */
const Pick = {
  open({ title = 'Elegí una opción', options, value, onPick }) {
    const body = h(`<div>${options.length > 7 ? '<input class="input lg mb" data-pq placeholder="Buscar…" autocomplete="off">' : ''}<div class="pick-list"></div></div>`);
    let m;
    const draw = (q = '') => {
      const w = norm(q);
      const list = options.filter(o => !w || norm(o.label).includes(w));
      $('.pick-list', body).innerHTML = list.length
        ? list.map(o => `<button type="button" class="pick-opt ${String(o.value) === String(value) ? 'on' : ''}" data-v="${esc(o.value)}" ${o.disabled ? 'disabled' : ''}><span>${esc(o.label)}</span>${String(o.value) === String(value) ? '<b>✓</b>' : ''}</button>`).join('')
        : UI.empty('Sin resultados');
      $$('.pick-opt', body).forEach(b => { b.onclick = () => { m.close(); onPick(b.dataset.v); }; });
    };
    m = UI.modal({ title, body, size: 'pick' });
    const q = $('[data-pq]', body);
    if (q) q.addEventListener('input', () => draw(q.value));
    draw();
    setTimeout(() => { const on = $('.pick-opt.on', body); if (on) on.scrollIntoView({ block: 'center' }); if (!q && !isTouch && on) on.focus(); });
  },

  titulo(el) {
    const lab = el.closest('label');
    const t = (lab && $('span', lab)) || (el.previousElementSibling && el.previousElementSibling.classList.contains('lbl') ? el.previousElementSibling : null);
    return (t && t.textContent.trim()) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || (el.options && el.options[0] && /^(todos|todas)/i.test(el.options[0].text) ? 'Filtrar' : 'Elegí una opción');
  },

  select(sel) {
    if (sel.dataset.pick) return;
    sel.dataset.pick = '1';
    const proto = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pick-btn' + (sel.classList.contains('lg') ? ' lg' : '');
    if (sel.style.width) btn.style.width = sel.style.width;
    if (sel.id) btn.dataset.for = sel.id;
    sel.classList.add('pick-native');
    sel.tabIndex = -1;
    sel.after(btn);
    const label = () => {
      const o = sel.options[sel.selectedIndex];
      btn.innerHTML = `<span>${esc(o ? o.text : '—')}</span><i aria-hidden="true">▾</i>`;
      btn.disabled = sel.disabled;
    };
    Object.defineProperty(sel, 'value', { configurable: true, get() { return proto.get.call(sel); }, set(v) { proto.set.call(sel, v); label(); } });
    sel.addEventListener('change', label);
    btn.onclick = () => Pick.open({
      title: Pick.titulo(sel),
      options: [...sel.options].map(o => ({ value: o.value, label: o.text, disabled: o.disabled })),
      value: sel.value,
      onPick: v => { proto.set.call(sel, v); label(); sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); },
    });
    label();
  },

  /* Campos de texto con sugerencias (datalist): se pueden escribir o elegir de la ventana */
  lista(inp) {
    if (inp.dataset.pick) return;
    inp.dataset.pick = '1';
    const id = inp.getAttribute('list');
    inp.removeAttribute('list');
    const wrap = document.createElement('div');
    wrap.className = 'field-inline';
    inp.replaceWith(wrap);
    wrap.append(inp);
    const btn = h('<button type="button" class="btn" aria-label="Ver opciones">☰</button>');
    wrap.append(btn);
    btn.onclick = () => {
      const dl = document.getElementById(id);
      const options = dl ? [...dl.options].map(o => ({ value: o.value, label: o.value })) : [];
      if (!options.length) return UI.toast('No hay opciones cargadas todavía', 'info');
      Pick.open({ title: Pick.titulo(inp), options, value: inp.value, onPick: v => { inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); } });
    };
  },

  scan(root) {
    if (root.nodeType !== 1) return;
    if (root.matches('select')) Pick.select(root);
    else if (root.matches('input[list]')) Pick.lista(root);
    $$('select', root).forEach(s => Pick.select(s));
    $$('input[list]', root).forEach(i => Pick.lista(i));
  },
};
new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => Pick.scan(n)))).observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', () => Pick.scan(document.body));
