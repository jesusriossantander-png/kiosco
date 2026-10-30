# Música de fondo sintetizada (libre de derechos): pop alegre 112 BPM, Do-Sol-Lam-Fa, con transiciones sincronizadas
import numpy as np, wave, sys
SR = 44100
def gen(dur, cortes, out):
    n = int(SR * (dur + 0.5)); t = np.arange(n) / SR
    mix = np.zeros(n)
    bpm = 112; beat = 60 / bpm; bar = beat * 4
    rng = np.random.default_rng(7)
    def env(length, a=0.005, r=0.2):
        L = int(length * SR); e = np.ones(L)
        A = max(1, int(a * SR)); e[:A] = np.linspace(0, 1, A)
        e *= np.exp(-np.arange(L) / (r * SR)); return e
    def add(sig, start):
        i = int(start * SR)
        if i >= n: return
        j = min(n, i + len(sig)); mix[i:j] += sig[: j - i]
    def lp(x, a):  # filtro pasa bajos de 1 polo
        y = np.zeros_like(x); acc = 0.0
        for k in range(len(x)): acc += a * (x[k] - acc); y[k] = acc
        return y
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    prog = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]  # C G Am F
    roots = [36, 43, 45, 41]
    # kick
    L = 0.35; tt = np.arange(int(L * SR)) / SR
    kick = np.sin(2 * np.pi * (45 * tt + 90 * (1 - np.exp(-tt * 30)) / 30)) * np.exp(-tt * 9) * 0.9
    # hat
    hat = lp(rng.standard_normal(int(0.05 * SR)), 0.9) - lp(rng.standard_normal(int(0.05 * SR)), 0.1)
    hat *= env(0.05, 0.001, 0.015) * 0.12
    clap = lp(rng.standard_normal(int(0.2 * SR)), 0.5) * env(0.2, 0.002, 0.06) * 0.25
    b = 0; tpos = 0.0
    while tpos < dur:
        ch = prog[b % 4]; rt = roots[b % 4]
        for q in range(4):
            bt = tpos + q * beat
            if b > 0 or q >= 2: add(kick, bt)
            if q in (1, 3) and b >= 1: add(clap, bt)
            add(hat, bt + beat / 2)
            if b >= 1: add(hat * 0.6, bt + beat * 0.75)
        # bajo en corcheas
        for e8 in range(8):
            f = hz(rt + (12 if e8 % 4 == 3 else 0)); L8 = beat / 2
            tt = np.arange(int(L8 * SR)) / SR
            s = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * env(L8, 0.004, 0.12) * 0.28
            add(s, tpos + e8 * L8)
        # arpegio pluck en semicorcheas
        notes = ch + [ch[0] + 12, ch[1] + 12, ch[2], ch[1], ch[0] + 12]
        for s16 in range(16):
            m = notes[(s16 * 3) % len(notes)] + 12; f = hz(m); L16 = 0.32
            tt = np.arange(int(L16 * SR)) / SR
            tri = 2 * np.abs(2 * ((f * tt) % 1) - 1) - 1
            add(tri * env(L16, 0.003, 0.09) * 0.085, tpos + s16 * beat / 4)
        # pad suave
        tt = np.arange(int(bar * SR)) / SR
        pad = sum(np.sin(2 * np.pi * hz(m) * tt + np.sin(2 * np.pi * 5 * tt) * 0.2) for m in ch)
        pe = np.minimum(1, tt / 0.3) * np.minimum(1, (bar - tt) / 0.3)
        add(pad * pe * 0.045, tpos)
        tpos += bar; b += 1
    # whoosh en cada cambio de escena
    for c in cortes:
        L = 0.45; k = int(L * SR)
        nz = lp(rng.standard_normal(k), 0.25)
        sh = np.sin(np.linspace(0, np.pi, k)) ** 2
        add(nz * sh * 0.22, max(0, c - 0.3))
    # fade in/out y normalización
    mix[: int(0.15 * SR)] *= np.linspace(0, 1, int(0.15 * SR))
    fo = int(1.2 * SR); end = int(dur * SR)
    mix[end - fo:end] *= np.linspace(1, 0, fo); mix[end:] = 0
    mix = np.tanh(mix * 1.2); mix = mix / np.max(np.abs(mix)) * 0.89
    st = np.stack([mix, mix], 1)
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())
gen(25.2, [3.2, 7.6, 12.2, 17.0, 21.0], 'musica-clientes.wav')
gen(32.0, [3.8, 8.0, 12.6, 16.2, 23.4, 27.4], 'musica-duenos.wav')
print('ok')
