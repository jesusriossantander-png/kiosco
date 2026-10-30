# Campaña Facebook + Instagram: Mi Maxikiosco

Hay dos videos verticales de 1080×1920, en formato 9:16. Sirven para Reels, Stories y el feed de Facebook e Instagram.

| Video | Para quién | Objetivo | Duración |
|---|---|---|---|
| `promo-clientes.mp4` | Vecinos del barrio | Que entren a la app y pidan por WhatsApp | 25 s |
| `promo-duenos.mp4` | Dueños de kioscos y almacenes | Que prueben la demo del sistema | 32 s |

Las portadas para el feed son `portada-clientes.jpg` y `portada-duenos.jpg`.

Los videos están pensados para verse **sin sonido**: todo el mensaje está en el texto en pantalla. La música incluida es original, sintetizada para el video, y no tiene problemas de derechos. Si querés más alcance en Reels, al subir el video podés reemplazarla por un audio en tendencia de la biblioteca de Instagram.

---

## Antes de publicar (checklist)

- [ ] GitHub Pages activado. Abrí `https://jesusriossantander-png.github.io/kiosco/` y comprobá que carga.
- [ ] En el panel, **Configuración → Negocio**: nombre real, dirección, horario y **WhatsApp**. Sin WhatsApp, los pedidos no llegan.
- [ ] **Productos → Publicar catálogo** y subí `catalogo.json` a la carpeta `data/`, para que los precios sean los reales.
- [ ] Revisá las ofertas en `js/landing.js` (lista `OFERTAS`). Tienen que coincidir con lo que cobrás en el local.
- [ ] Poné el link en la bio de Instagram y en el botón de la página de Facebook.

### Reglas de Meta que hay que respetar

- **Tabaco: prohibido.** No se pueden promocionar cigarrillos ni mostrarlos en anuncios. En Argentina, además, la Ley 26.687 restringe la publicidad de tabaco. Por eso los videos no los muestran, la landing no los incluye en "Lo más pedido" y el catálogo público los oculta. En el panel siguen disponibles para vender en caja. Para volver a mostrarlos en la app: Producto → "Mostrar en app de clientes".
- **Alcohol:** si un anuncio muestra cerveza u otras bebidas alcohólicas, segmentá **18+**. Los videos actuales no muestran alcohol en primer plano.
- **No prometas lo que no está.** "Envío sin cargo desde $15.000" y "10% off en efectivo" son textos de ejemplo de la demo. Cambialos o cumplilos.

---

## Campaña 1: Clientes del barrio (`promo-clientes.mp4`)

**Objetivo en el Administrador de anuncios:** *Interacción → Mensajes a WhatsApp*, o *Tráfico* hacia `cliente.html`.
**Ubicación:** radio de **1,5 a 3 km** alrededor del local (en la sección "Ubicaciones", usá un pin con la dirección).
**Edad:** 18 a 65. **Intereses:** no hace falta. Con un radio chico, una audiencia amplia funciona mejor.
**Presupuesto de prueba:** el mínimo diario que acepte Meta, durante **7 días**. Después duplicá el que mejor resultado tenga.
**Horario:** a la tarde/noche y fines de semana, cuando se pide más.

### Textos del anuncio (probá los 3 en A/B)

**A, antojo**
> ¿Se te antojó algo? 🤤 Bebidas frías, golosinas y almacén a la vuelta de tu casa.
> 📱 Armá tu pedido desde el celular en 3 toques y te lo llevamos 🛵
> 👉 Pedí acá: jesusriossantander-png.github.io/kiosco

- Título: **Tu kiosco, ahora en tu celular**
- Botón: **Enviar mensaje** / **Pedir ahora**

**B, ofertas**
> 🔥 Ofertas de la semana en Mi Maxikiosco
> 🧉 Yerba, 🍫 alfajores, 🥤 gaseosas y 🍟 snacks con descuento.
> Mirá todas las promos y pedí sin moverte del sillón 👇

- Título: **Ofertas que se notan**
- Botón: **Ver más**

**C, comodidad**
> Sin filas, sin vueltas 🙌 Elegí, mandá tu pedido por WhatsApp y retiralo listo o recibilo en tu casa.
> Pagás con QR, débito o efectivo 💳
> Abierto todos los días de 8 a 24 h 🕒

- Título: **Pedí en 3 toques**
- Botón: **Pedir ahora**

---

## Campaña 2: Dueños de kioscos (`promo-duenos.mp4`)

**Objetivo:** *Tráfico* a `panel.html`, o *Clientes potenciales / Mensajes* si querés que te escriban.
**Ubicación:** tu ciudad o provincia, o todo el país si lo vas a ofrecer a distancia.
**Edad:** 25 a 60.
**Intereses:** Comercio minorista, Pequeñas empresas, Emprendimiento, Mercado Pago, Punto de venta, Kiosco. Probá también una audiencia **similar** a tus seguidores.
**Presupuesto de prueba:** el mínimo diario que acepte Meta, durante 7 a 10 días.

### Textos del anuncio

**A, dolor (la libreta)**
> ¿Todavía anotás el fiado en una libreta? 📒
> Con este sistema controlás tu maxikiosco desde la PC o el celular: ventas, caja, stock, vencimientos, fiado y ganancias reales.
> ✅ Sin instalar nada ✅ Funciona sin internet ✅ Lector de códigos o cámara del celular
> 👉 Probá la demo gratis: jesusriossantander-png.github.io/kiosco

- Título: **Tu maxikiosco, bajo control**
- Botón: **Más información**

**B, plata (faltantes)**
> ¿Sabés cuánto ganás de verdad por día? 📊
> Caja con arqueo ciego, diferencias por empleado y reporte de faltantes para detectar merma o robo.
> Probalo gratis hoy 👇

- Título: **Dejá de perder plata sin darte cuenta**
- Botón: **Probar ahora**

**C, velocidad**
> Vendé en 3 toques ⚡ Escaneás, elegís cómo paga y listo. Ticket al instante 🧾
> Y tus clientes te compran por WhatsApp desde su celular 💬
> Demo gratis 👇

- Título: **El sistema para maxikioscos**
- Botón: **Registrarte** / **Más información**

---

## Publicaciones orgánicas (semana 1)

| Día | Formato | Contenido |
|---|---|---|
| Lun | Reel | `promo-clientes.mp4` + texto A |
| Mar | Story | Encuesta "¿Qué oferta querés la semana que viene?" + sticker de link |
| Mié | Carrusel | 4 fotos reales de las ofertas en góndola con precio |
| Jue | Reel | `promo-duenos.mp4` (si ofrecés el sistema) |
| Vie | Story | "Pedí para la previa 🍟🥤" + sticker de link a la app |
| Sáb | Post | Foto del local/equipo: "Abierto hasta las 24 h" |
| Dom | Story | Recordatorio: "Mañana nuevas ofertas" |

**Hashtags (5 a 8, no más):** `#maxikiosco #kiosco #ofertas #delivery #pedidosonline #[tubarrio] #[tuciudad] #comercioslocales`

---

## Qué medir y cuándo ajustar

| Métrica | Bien | Si está mal |
|---|---|---|
| Retención a los 3 s (Hook rate) | > 30 % | Cambiá el primer texto ("¿Se te antojó algo?" → una oferta con precio) |
| CTR (clic en el enlace) | > 1 % | Probá otro texto del anuncio o la otra portada |
| Costo por conversación de WhatsApp | El más bajo entre A, B y C | Apagá los anuncios que cuesten el doble que el mejor |
| Pedidos reales por semana | Que suban | Revisá que el WhatsApp configurado sea el correcto |

**Regla de oro:** no toques un anuncio antes de 3 días o 1.000 impresiones. Después, apagá el peor y pasale su presupuesto al mejor.

---

## Editar o regenerar los videos

El código fuente está en `marketing/fuente-video/`:
- `promo.html`: escenas, textos y animaciones (los guiones están en `VIDEOS`).
- `capturas.js`: saca las capturas de la app (necesita la app sirviéndose en `localhost:8765`).
- `render.js`: renderiza cuadro por cuadro (`node render.js clientes`).
- `musica.py`: genera la música.

Para unir imagen y audio:

```
ffmpeg -framerate 30 -i frames-clientes/%05d.jpg -i musica-clientes.wav -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart promo-clientes.mp4
```
