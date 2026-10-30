/* Lector de códigos de barras con la cámara del celular o la PC */
const Scanner = {
  /* onScan(code, modal) puede devolver HTML (o una promesa de HTML) para mostrar debajo del video */
  open({ title = 'Escanear código', continuous = false, onScan, hint = '' } = {}) {
    let last = '', lastT = 0, cam = null, stopped = false;
    const stop = async () => {
      stopped = true;
      if (cam) { const c = cam; cam = null; try { await c.stop(); c.clear(); } catch { /* ya detenida */ } }
    };
    const m = UI.modal({
      title,
      size: 'scan',
      body: `<div class="scan-wrap"><div id="scan-reader"></div></div>
        <p class="muted small" id="scan-status">Iniciando cámara…</p>${hint}
        <div class="field-inline"><input class="input" id="scan-manual" placeholder="o escribí el código" inputmode="numeric" autocomplete="off"><button class="btn" id="scan-ok">OK</button></div>
        <div id="scan-last" class="scan-last"></div>`,
      actions: [{ label: continuous ? 'Terminar' : 'Cerrar', class: continuous ? 'primary' : '' }],
      onClose: stop,
    });
    const status = t => { const s = $('#scan-status', m.el); if (s) s.textContent = t; };
    const handle = async code => {
      code = String(code).trim();
      if (!code) return;
      const now = Date.now();
      if (code === last && now - lastT < 1800) return;
      last = code; lastT = now;
      if (navigator.vibrate) navigator.vibrate(50);
      const out = await onScan(code, m);
      UI.beep(out !== null && out !== false);
      const box = $('#scan-last', m.el);
      if (box && typeof out === 'string') box.innerHTML = out;
      if (!continuous && out !== null && out !== false) m.close();
    };
    const manual = $('#scan-manual', m.el);
    const sendManual = () => { const v = manual.value; manual.value = ''; last = ''; handle(v); };
    $('#scan-ok', m.el).onclick = sendManual;
    manual.addEventListener('keydown', e => { if (e.key === 'Enter') sendManual(); });

    (async () => {
      try {
        if (!window.isSecureContext) throw new Error('la cámara requiere HTTPS (GitHub Pages ya lo usa)');
        await loadScript(CDN.scanner);
        if (stopped) return;
        const F = Html5QrcodeSupportedFormats;
        cam = new Html5Qrcode('scan-reader', {
          formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.ITF, F.QR_CODE],
          verbose: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        await cam.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: (w, hh) => ({ width: Math.max(120, Math.floor(Math.min(w * 0.85, 360))), height: Math.max(80, Math.floor(Math.min(hh * 0.45, 170))) }) },
          txt => handle(txt),
          () => {},
        );
        if (stopped) { stop(); return; }
        status(continuous ? 'Apuntá a cada código. Se agregan solos.' : 'Apuntá al código de barras');
      } catch (e) {
        status('No se pudo abrir la cámara: ' + (e.message || e) + '. Podés escribir el código o usar un lector USB.');
        if (isTouch) manual.focus();
      }
    })();
    return m;
  },
};
