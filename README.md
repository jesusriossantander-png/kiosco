# Maxikiosco: landing + panel de gestión + app para clientes (demo)

Demo hecha en HTML, CSS y JavaScript puro, **sin backend**: todo corre en el navegador para poder usarla y mostrarla. Funciona en PC y en el celular, se puede instalar como app y sigue funcionando sin internet.

- **`index.html`**: landing page del kiosco, con ofertas, servicios, contacto y acceso a la app.
- **`panel.html`**: panel del negocio (dueño, encargados, cajeros, repositores).
- **`cliente.html`**: app para los clientes: catálogo, carrito, consulta de precios con la cámara y pedido por WhatsApp.

Las ofertas de la landing se editan en la lista `OFERTAS` de `js/landing.js`.
El ticket de venta se muestra **simulado en pantalla**, tal como saldría en la impresora térmica de 80 mm. Desde ahí se puede imprimir de verdad.
Las listas de opciones se abren en **ventanas flotantes**, en lugar de desplegables.

## Publicar en GitHub Pages

1. En GitHub abrí el repositorio → **Settings** → **Pages**.
2. En **Build and deployment → Source** elegí **Deploy from a branch**.
3. Elegí la rama donde está la app y la carpeta **/ (root)** → **Save**.
4. En 1 o 2 minutos queda en línea:
   - Landing: `https://jesusriossantander-png.github.io/kiosco/`
   - Panel: `https://jesusriossantander-png.github.io/kiosco/panel.html`
   - Clientes: `https://jesusriossantander-png.github.io/kiosco/cliente.html`

GitHub Pages usa HTTPS, que es lo que necesita la cámara del celular para escanear.

## Primer ingreso

| Usuario | PIN |
|---|---|
| Administrador | `1234` |
| Cajero/a | `0000` |

Cambialos en **Usuarios y permisos**. Los productos, clientes y proveedores que vienen cargados son de ejemplo.

## Qué incluye

**Punto de venta**
- Lector USB (escribe el código y Enter) o la cámara del celular en modo continuo.
- Búsqueda por nombre, código, marca o rubro. `3*código` suma 3 unidades.
- Cobro en 2 o 3 toques: F2 → medio de pago → Enter. Calcula el vuelto con botones de billetes.
- Medios de pago: efectivo, débito, crédito, QR/Mercado Pago (muestra tu QR o link), transferencia y fiado. También se puede dividir el pago entre varios medios.
- Ticket térmico de 80 mm (o "no imprimir"), cajón automático, balanza (conectada a la PC o con etiqueta EAN-13).
- Listas de precios, descuento con autorización, importe libre y accesos rápidos.

**Stock**
- Se descuenta en el momento de la venta.
- Alertas de stock mínimo con generación de órdenes de pedido.
- Vencimientos por lote con FEFO (primero vence, primero sale).
- Ajustes, salidas con motivos editables, conteo cíclico con cámara, depósito separado de la góndola, historial de movimientos.
- Carga masiva desde Excel o CSV, con plantilla para descargar.

**Precios**
- Actualización masiva por rubro, marca, proveedor, texto o rango de códigos.
- Por porcentaje, monto fijo, margen sobre el costo o "aumentó el costo, mantener margen".
- 5 listas independientes, vista previa e historial de cambios.

**Caja y turnos**
- Apertura y cierre por empleado y por puesto.
- Arqueo ciego con conteo por billete.
- Totales por medio de pago, ingresos y retiros (con autorización) e historial de diferencias.

**Clientes y fiado**
- Cuenta corriente con límite de crédito (pasarlo requiere autorización).
- Registro de pagos con recibo y envío del saldo por WhatsApp.

**Compras y proveedores**
- Órdenes de pedido que se envían por WhatsApp.
- Recepción de remitos con vencimientos.
- Actualización de costos y margen por artículo.

**Reportes**
- Ventas por día, hora y medio de pago.
- Productos más y menos vendidos.
- Rentabilidad por artículo y por rubro.
- Diferencias de caja por empleado.
- Faltantes y merma (para detectar pérdidas o robo).
- Todo exportable a Excel.

**Otros**
- Recargas y pago de servicios.
- Devoluciones con ticket original y aprobación por PIN.
- Pedidos de la app de clientes.
- Usuarios con roles (administrador, encargado, cajero, repositor).
- Varias sucursales.
- Backup automático y en archivo.
- Sección de soporte y capacitación.

**Facturación ARCA**: desactivada, como pediste. Para usarla hace falta un servidor que hable con los web services de ARCA.

## App de clientes y catálogo

Los clientes ven los productos de `data/catalogo.json`. Para actualizar precios y productos:

1. Panel → **Productos** → **Publicar catálogo clientes**. Se descarga `catalogo.json`.
2. En GitHub subilo a la carpeta `data/` y reemplazá el anterior.

El pedido llega a tu WhatsApp (configuralo en **Configuración → Negocio**). Copiá el mensaje y pegalo en **Pedidos de clientes** para cobrarlo en la caja.

## Datos y limitaciones

- Todo se guarda en el navegador de cada dispositivo (IndexedDB). Por eso funciona sin internet.
- Varias cajas o equipos **no se sincronizan solos**: cada dispositivo tiene sus datos. Para consolidar usá **Configuración → Backup** (exportar/importar). La sincronización automática en red requiere agregar un servidor o una base en la nube.
- Si borrás los datos del navegador, se pierden: descargá un backup seguido.
- La conexión directa a impresora térmica, cajón y balanza usa Web Serial (Chrome o Edge en PC). Si no hay conexión, el ticket se imprime con el diálogo de impresión del navegador.

## Estructura

```
index.html                    landing page
panel.html, cliente.html      panel y app de clientes
css/app.css, css/cliente.css  estilos (modo claro y oscuro)
js/kv.js, db.js               almacenamiento local
js/ui.js                      utilidades de interfaz, Excel
js/scanner.js                 lector con cámara
js/hardware.js                impresora, cajón, balanza, tickets
js/app.js                     sesión, permisos y navegación
js/modules/*.js               cada sección del panel
js/catalogo.js                catálogo compartido (landing y clientes)
js/cliente.js                 app de clientes
js/landing.js, css/landing.css landing page
sw.js, manifest*.json         modo offline e instalación
data/catalogo.json            catálogo publicado para clientes
```

Al publicar cambios, subí el número de `VERSION` en `sw.js` para que los dispositivos tomen la versión nueva.

## Marketing

En `marketing/` están los videos para Facebook/Instagram (`promo-clientes.mp4`, `promo-duenos.mp4`), las portadas y el plan de campaña con textos listos (`marketing/CAMPANA.md`).

## Tienda online (estilo supermercado)

La landing y la app de clientes tienen un diseño de tienda: banners que pasan solos, círculos de promociones, categorías con imagen, tarjetas de producto con descuento y precio por litro/kilo, ficha de producto, carro con sugerencias ("¿Querés agregar algo más?") y la sección **Ahorros** con promos de medios de pago.

- **Ofertas reales**: en el panel, Productos → editar → *Precio de oferta* (y fecha opcional). Se aplica también al cobrar en caja.
- **Banners, aviso y promos de pago**: Configuración → *App y banners*.
- **Fotos de productos**: Productos → editar → *Sacar o subir foto* (cámara del celular), *Buscar foto por código* (base pública Open Food Facts) o pegar un enlace. Sin foto se usa una ilustración 3D.

Ilustraciones 3D: [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (licencia MIT), en `img/3d/`.
