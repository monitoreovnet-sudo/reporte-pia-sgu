# Reporte PIA · SGU vs País

Aplicación web para el Comité PIA (Atención al Cliente, Piloto San Agustín).
Se publica en **Cloudflare Pages** con una base de datos **D1**, igual que la app de Fallas Masivas.

| Página | Qué hace |
|---|---|
| **Repositorio** | Subir GLPI + Tipificador + fecha y hora de descarga. Las cargas quedan guardadas para todos los usuarios. |
| **Informe** | Tablero estilo Power BI con 6 páginas y panel de filtros. Descarga en **PDF** y **Excel**. |
| **Presentación** | Visor estilo PowerPoint con miniaturas y modo Presentar. Descarga en **PowerPoint (.pptx)** y **PDF**. |
| **Administración** | Solo administradores: ver y cambiar la contraseña, agregar o quitar correos, parámetros de cálculo. |

## Acceso

- Entran solo los correos autorizados, con una contraseña común.
- Correos iniciales: `martin.pinango@vnet.com.ve` (admin), `gabriela.silva@vnet.com.ve` (admin), `marina.calderon@vnet.com.ve`.
- Contraseña inicial: la que está en `functions/api/[[path]].js` (`CLAVE_INICIAL`). Solo se usa la primera vez que arranca la base de datos.
- Al cambiar la contraseña en Administración se cierran las sesiones de los demás usuarios.
- Después de 8 intentos fallidos en 15 minutos, ese correo o esa conexión queda bloqueado por 15 minutos.

## Estructura

```
public/              página web (lo que ve el usuario)
  index.html
  css/app.css
  js/engine.js       cálculo de indicadores (réplica del Excel)
  js/deck.js         diapositivas (PowerPoint y pantalla)
  js/slides-html.js  dibuja las diapositivas en pantalla
  js/charts.js       gráficos del informe
  js/app.js          páginas, filtros, descargas
  vendor/            PptxGenJS (genera el .pptx)
  img/               portada y fondo VNET
  _headers           cabeceras de seguridad
functions/api/[[path]].js   API: login, sesiones, cargas, filtros, administración (usa D1)
```

## Publicar en Cloudflare (una sola vez)

1. **GitHub**: cree un repositorio **privado** (por ejemplo `reporte-pia-sgu`) y suba todo el contenido de esta carpeta respetando las carpetas `public` y `functions`.
2. **Base de datos**: en Cloudflare → *Storage & Databases* → *D1 SQL Database* → **Create** → nombre `reporte-pia`. No hace falta crear tablas: la app las crea sola.
3. **Pages**: Cloudflare → *Workers & Pages* → **Create** → pestaña *Pages* → **Connect to Git** → elija el repositorio.
   - Framework preset: **None**
   - Build command: *(vacío)*
   - Build output directory: **`public`**
   - Pulse **Save and Deploy**.
4. **Enlazar la base**: en el proyecto de Pages → *Settings* → *Bindings* → **Add** → *D1 database*
   - Variable name: **`DB`** (exactamente así)
   - D1 database: `reporte-pia`
   - Guarde y vuelva a publicar: *Deployments* → en el último → **Retry deployment**.
5. Abra la dirección `https://<proyecto>.pages.dev`, entre con su correo y la contraseña inicial y **cámbiela** en Administración.

Cada vez que se suba un cambio al repositorio, Cloudflare publica la nueva versión sola.

## Notas

- Los archivos de GLPI y del Tipificador se leen en el navegador. Al servidor solo llega una copia comprimida de las columnas que usa el informe.
- Los filtros (categorías, grupos técnicos, reincidencia, productividad) se guardan para todos los usuarios.
- El lector de Excel, la exportación a PDF y las fuentes se cargan desde cdnjs.cloudflare.com y Google Fonts.
