/**
 * API del Reporte PIA · SGU vs País (Cloudflare Pages Functions + D1).
 *
 * Enlace (binding) requerido en Cloudflare Pages → Settings → Bindings:
 *   D1 database, variable name: DB
 *
 * Las tablas se crean solas en la primera petición. Los usuarios iniciales y la
 * clave inicial están abajo (USUARIOS_INICIALES / CLAVE_INICIAL); solo se usan
 * cuando la base está vacía. Después todo se administra desde la página.
 */

const CLAVE_INICIAL = 'Avila.2026';
const USUARIOS_INICIALES = [
  { email: 'martin.pinango@vnet.com.ve', admin: 1 },
  { email: 'marina.calderon@vnet.com.ve', admin: 0 },
  { email: 'gabriela.silva@vnet.com.ve', admin: 1 }
];

const SESION_HORAS = 12;
const COOKIE = 'pia_sesion';
const MAX_FALLOS = 8;          // intentos fallidos permitidos…
const VENTANA_FALLOS_MIN = 15; // …en esta cantidad de minutos
const CHUNK = 512 * 1024;      // tamaño de cada trozo guardado en D1 (bytes)

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS usuarios (email TEXT PRIMARY KEY, admin INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1, creado TEXT NOT NULL, ultimo_acceso TEXT)`,
  `CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT NOT NULL, actualizado TEXT, actualizado_por TEXT)`,
  `CREATE TABLE IF NOT EXISTS sesiones (token TEXT PRIMARY KEY, email TEXT NOT NULL, creado TEXT NOT NULL, expira INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS intentos (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, ip TEXT, ts INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS cargas (id TEXT PRIMARY KEY, creado TEXT NOT NULL, creado_por TEXT NOT NULL, corte REAL NOT NULL, periodo TEXT, responsable TEXT, nps TEXT, glpi_nombre TEXT, tip_nombre TEXT, resumen TEXT, partes INTEGER NOT NULL, bytes INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS carga_partes (carga_id TEXT NOT NULL, idx INTEGER NOT NULL, datos BLOB NOT NULL, PRIMARY KEY (carga_id, idx))`,
  `CREATE INDEX IF NOT EXISTS intentos_ts ON intentos (ts)`
];

let listo = false;
async function preparar(db) {
  if (listo) return;
  await db.batch(ESQUEMA.map((q) => db.prepare(q)));
  const hay = await db.prepare(`SELECT COUNT(*) AS n FROM usuarios`).first();
  if (!hay || !hay.n) {
    const ahora = new Date().toISOString();
    await db.batch(USUARIOS_INICIALES.map((u) =>
      db.prepare(`INSERT OR IGNORE INTO usuarios (email, admin, activo, creado) VALUES (?, ?, 1, ?)`).bind(u.email, u.admin, ahora)));
  }
  await db.prepare(`INSERT OR IGNORE INTO config (clave, valor, actualizado, actualizado_por) VALUES ('clave_acceso', ?, ?, 'sistema')`)
    .bind(CLAVE_INICIAL, new Date().toISOString()).run();
  listo = true;
}

/* ---------- utilidades ---------- */
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const error = (status, mensaje) => json({ error: mensaje }, status);
const ahoraISO = () => new Date().toISOString();
const normEmail = (e) => String(e || '').trim().toLowerCase();
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function token(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function sha256(txt) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return new Uint8Array(h);
}
async function igualSeguro(a, b) { // comparación de tiempo constante
  const [x, y] = await Promise.all([sha256(String(a)), sha256(String(b))]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
function leerCookie(req, nombre) {
  const c = req.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + nombre + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function cookieSesion(valor, maxAge) {
  return `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
async function cuerpo(req) {
  try { return await req.json(); } catch (e) { return null; }
}
function b64aBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesAb64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function aBytes(v) { // D1 devuelve BLOB como array o ArrayBuffer según el entorno
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (Array.isArray(v)) return Uint8Array.from(v);
  return new Uint8Array(0);
}

async function usuarioActual(db, req) {
  const t = leerCookie(req, COOKIE);
  if (!t) return null;
  const s = await db.prepare(
    `SELECT s.token, s.expira, u.email, u.admin, u.activo FROM sesiones s JOIN usuarios u ON u.email = s.email WHERE s.token = ?`
  ).bind(t).first();
  if (!s || s.expira < Date.now() || !s.activo) {
    if (s) await db.prepare(`DELETE FROM sesiones WHERE token = ?`).bind(t).run();
    return null;
  }
  return { email: s.email, admin: !!s.admin, token: t };
}

/* ---------- rutas ---------- */
async function login(db, req) {
  const b = await cuerpo(req);
  const email = normEmail(b && b.email), clave = b && typeof b.clave === 'string' ? b.clave : '';
  if (!email || !clave) return error(400, 'Escriba su correo y la contraseña.');
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  const desde = Date.now() - VENTANA_FALLOS_MIN * 60000;
  await db.prepare(`DELETE FROM intentos WHERE ts < ?`).bind(desde).run();
  const f = await db.prepare(`SELECT COUNT(*) AS n FROM intentos WHERE ts >= ? AND (email = ? OR ip = ?)`).bind(desde, email, ip).first();
  if (f && f.n >= MAX_FALLOS) return error(429, `Demasiados intentos fallidos. Espere ${VENTANA_FALLOS_MIN} minutos e intente de nuevo.`);

  const u = await db.prepare(`SELECT email, admin, activo FROM usuarios WHERE email = ?`).bind(email).first();
  const conf = await db.prepare(`SELECT valor FROM config WHERE clave = 'clave_acceso'`).first();
  const claveOk = conf ? await igualSeguro(clave, conf.valor) : false;
  if (!u || !u.activo || !claveOk) {
    await db.prepare(`INSERT INTO intentos (email, ip, ts) VALUES (?, ?, ?)`).bind(email, ip, Date.now()).run();
    return error(401, 'Correo o contraseña incorrectos.');
  }
  const t = token();
  await db.batch([
    db.prepare(`DELETE FROM sesiones WHERE expira < ?`).bind(Date.now()),
    db.prepare(`INSERT INTO sesiones (token, email, creado, expira) VALUES (?, ?, ?, ?)`).bind(t, email, ahoraISO(), Date.now() + SESION_HORAS * 3600000),
    db.prepare(`UPDATE usuarios SET ultimo_acceso = ? WHERE email = ?`).bind(ahoraISO(), email),
    db.prepare(`DELETE FROM intentos WHERE email = ?`).bind(email)
  ]);
  return json({ email, admin: !!u.admin }, 200, { 'set-cookie': cookieSesion(t, SESION_HORAS * 3600) });
}

async function logout(db, req) {
  const t = leerCookie(req, COOKIE);
  if (t) await db.prepare(`DELETE FROM sesiones WHERE token = ?`).bind(t).run();
  return json({ ok: true }, 200, { 'set-cookie': cookieSesion('', 0) });
}

async function listarCargas(db) {
  const r = await db.prepare(
    `SELECT id, creado, creado_por, corte, periodo, responsable, nps, glpi_nombre, tip_nombre, resumen, bytes FROM cargas ORDER BY corte DESC, creado DESC`
  ).all();
  return json({ cargas: (r.results || []).map((c) => ({ ...c, resumen: c.resumen ? JSON.parse(c.resumen) : null })) });
}

async function crearCarga(db, req, yo) {
  const b = await cuerpo(req);
  if (!b || typeof b.datos !== 'string' || typeof b.corte !== 'number') return error(400, 'Faltan los datos de la carga.');
  let bytes;
  try { bytes = b64aBytes(b.datos); } catch (e) { return error(400, 'Los datos de la carga no son válidos.'); }
  if (!bytes.length) return error(400, 'La carga está vacía.');
  if (bytes.length > 40 * 1024 * 1024) return error(413, 'La carga es demasiado grande.');
  const id = token(8), partes = Math.ceil(bytes.length / CHUNK);
  const txt = (v, n = 200) => (v == null ? null : String(v).slice(0, n));
  const stmts = [db.prepare(
    `INSERT INTO cargas (id, creado, creado_por, corte, periodo, responsable, nps, glpi_nombre, tip_nombre, resumen, partes, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, ahoraISO(), yo.email, b.corte, txt(b.periodo, 40), txt(b.responsable, 120), txt(b.nps, 60), txt(b.glpi_nombre), txt(b.tip_nombre), b.resumen ? JSON.stringify(b.resumen).slice(0, 20000) : null, partes, bytes.length)];
  for (let i = 0; i < partes; i++) {
    stmts.push(db.prepare(`INSERT INTO carga_partes (carga_id, idx, datos) VALUES (?, ?, ?)`).bind(id, i, bytes.slice(i * CHUNK, (i + 1) * CHUNK)));
  }
  await db.batch(stmts);
  return json({ id }, 201);
}

async function leerCarga(db, id) {
  const c = await db.prepare(`SELECT * FROM cargas WHERE id = ?`).bind(id).first();
  if (!c) return error(404, 'Esa carga ya no existe.');
  const r = await db.prepare(`SELECT idx, datos FROM carga_partes WHERE carga_id = ? ORDER BY idx`).bind(id).all();
  const trozos = (r.results || []).map((p) => aBytes(p.datos));
  const total = trozos.reduce((a, t) => a + t.length, 0);
  const todo = new Uint8Array(total);
  let off = 0;
  trozos.forEach((t) => { todo.set(t, off); off += t.length; });
  return json({ carga: { ...c, resumen: c.resumen ? JSON.parse(c.resumen) : null }, datos: bytesAb64(todo) });
}

async function editarCarga(db, req, id) {
  const b = await cuerpo(req) || {};
  const c = await db.prepare(`SELECT id FROM cargas WHERE id = ?`).bind(id).first();
  if (!c) return error(404, 'Esa carga ya no existe.');
  await db.prepare(`UPDATE cargas SET responsable = COALESCE(?, responsable), nps = COALESCE(?, nps), periodo = COALESCE(?, periodo) WHERE id = ?`)
    .bind(b.responsable != null ? String(b.responsable).slice(0, 120) : null, b.nps != null ? String(b.nps).slice(0, 60) : null, b.periodo != null ? String(b.periodo).slice(0, 40) : null, id).run();
  return json({ ok: true });
}

async function borrarCarga(db, id) {
  await db.batch([db.prepare(`DELETE FROM carga_partes WHERE carga_id = ?`).bind(id), db.prepare(`DELETE FROM cargas WHERE id = ?`).bind(id)]);
  return json({ ok: true });
}

async function leerFiltros(db) {
  const r = await db.prepare(`SELECT valor, actualizado, actualizado_por FROM config WHERE clave = 'filtros'`).first();
  return json({ filtros: r ? JSON.parse(r.valor) : null, actualizado: r && r.actualizado, actualizado_por: r && r.actualizado_por });
}
async function guardarFiltros(db, req, yo) {
  const b = await cuerpo(req);
  if (!b || typeof b.filtros !== 'object') return error(400, 'Filtros no válidos.');
  const limpio = {};
  ['categorias', 'grupos', 'reincExcluir'].forEach((k) => {
    if (Array.isArray(b.filtros[k])) limpio[k] = b.filtros[k].map((x) => String(x).slice(0, 300)).slice(0, 500);
  });
  ['sucursal', 'sguMarker', 'piaSolicitante'].forEach((k) => { if (typeof b.filtros[k] === 'string') limpio[k] = b.filtros[k].slice(0, 200); });
  if (typeof b.filtros.version === 'number') limpio.version = b.filtros.version;
  await db.prepare(`INSERT INTO config (clave, valor, actualizado, actualizado_por) VALUES ('filtros', ?, ?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado = excluded.actualizado, actualizado_por = excluded.actualizado_por`)
    .bind(JSON.stringify(limpio), ahoraISO(), yo.email).run();
  return json({ ok: true });
}

/* ---------- administración ---------- */
async function adminVer(db) {
  const c = await db.prepare(`SELECT valor, actualizado, actualizado_por FROM config WHERE clave = 'clave_acceso'`).first();
  const u = await db.prepare(`SELECT email, admin, activo, creado, ultimo_acceso FROM usuarios ORDER BY admin DESC, email`).all();
  return json({ clave: c ? c.valor : '', clave_actualizada: c && c.actualizado, clave_actualizada_por: c && c.actualizado_por, usuarios: u.results || [] });
}

async function adminClave(db, req, yo) {
  const b = await cuerpo(req);
  const nueva = b && typeof b.clave === 'string' ? b.clave : '';
  if (nueva.length < 8) return error(400, 'La contraseña debe tener al menos 8 caracteres.');
  if (/^\s|\s$/.test(nueva)) return error(400, 'La contraseña no puede empezar ni terminar con espacios.');
  await db.batch([
    db.prepare(`UPDATE config SET valor = ?, actualizado = ?, actualizado_por = ? WHERE clave = 'clave_acceso'`).bind(nueva, ahoraISO(), yo.email),
    db.prepare(`DELETE FROM sesiones WHERE token <> ?`).bind(yo.token) // los demás deben entrar con la clave nueva
  ]);
  return json({ ok: true });
}

async function contarAdmins(db) {
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM usuarios WHERE admin = 1 AND activo = 1`).first();
  return r ? r.n : 0;
}

async function adminCrearUsuario(db, req) {
  const b = await cuerpo(req);
  const email = normEmail(b && b.email);
  if (!emailValido(email)) return error(400, 'Escriba un correo válido.');
  const existe = await db.prepare(`SELECT email FROM usuarios WHERE email = ?`).bind(email).first();
  if (existe) return error(409, 'Ese correo ya tiene acceso.');
  await db.prepare(`INSERT INTO usuarios (email, admin, activo, creado) VALUES (?, ?, 1, ?)`).bind(email, b && b.admin ? 1 : 0, ahoraISO()).run();
  return json({ ok: true }, 201);
}

async function adminEditarUsuario(db, req, yo, email) {
  const b = await cuerpo(req) || {};
  const u = await db.prepare(`SELECT email, admin, activo FROM usuarios WHERE email = ?`).bind(email).first();
  if (!u) return error(404, 'Ese usuario no existe.');
  const admin = typeof b.admin === 'boolean' ? (b.admin ? 1 : 0) : u.admin;
  const activo = typeof b.activo === 'boolean' ? (b.activo ? 1 : 0) : u.activo;
  if (email === yo.email && (!admin || !activo)) return error(400, 'No puede quitarse a sí mismo el acceso de administrador.');
  if (u.admin && u.activo && (!admin || !activo) && (await contarAdmins(db)) <= 1) return error(400, 'Debe quedar al menos un administrador.');
  const stmts = [db.prepare(`UPDATE usuarios SET admin = ?, activo = ? WHERE email = ?`).bind(admin, activo, email)];
  if (!activo) stmts.push(db.prepare(`DELETE FROM sesiones WHERE email = ?`).bind(email));
  await db.batch(stmts);
  return json({ ok: true });
}

async function adminBorrarUsuario(db, yo, email) {
  if (email === yo.email) return error(400, 'No puede eliminar su propio usuario.');
  const u = await db.prepare(`SELECT admin, activo FROM usuarios WHERE email = ?`).bind(email).first();
  if (!u) return error(404, 'Ese usuario no existe.');
  if (u.admin && u.activo && (await contarAdmins(db)) <= 1) return error(400, 'Debe quedar al menos un administrador.');
  await db.batch([db.prepare(`DELETE FROM sesiones WHERE email = ?`).bind(email), db.prepare(`DELETE FROM usuarios WHERE email = ?`).bind(email)]);
  return json({ ok: true });
}

/* ---------- enrutador ---------- */
export async function onRequest(context) {
  const { request: req, env } = context;
  const db = env.DB;
  if (!db) return error(500, 'Falta enlazar la base de datos D1 con el nombre DB en Cloudflare Pages.');
  try {
    await preparar(db);
    const url = new URL(req.url);
    const ruta = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
    const m = req.method;

    if (m !== 'GET' && m !== 'HEAD') { // protección básica contra peticiones de otros sitios
      const origen = req.headers.get('origin');
      if (origen && origen !== url.origin) return error(403, 'Origen no permitido.');
    }

    if (ruta === 'login' && m === 'POST') return login(db, req);
    if (ruta === 'logout' && m === 'POST') return logout(db, req);

    const yo = await usuarioActual(db, req);
    if (!yo) return error(401, 'Su sesión expiró. Inicie sesión de nuevo.');

    if (ruta === 'yo' && m === 'GET') return json({ email: yo.email, admin: yo.admin });
    if (ruta === 'cargas' && m === 'GET') return listarCargas(db);
    if (ruta === 'cargas' && m === 'POST') return crearCarga(db, req, yo);
    let r = ruta.match(/^cargas\/([a-f0-9]{16})$/);
    if (r && m === 'GET') return leerCarga(db, r[1]);
    if (r && m === 'PATCH') return editarCarga(db, req, r[1]);
    if (r && m === 'DELETE') return yo.admin ? borrarCarga(db, r[1]) : error(403, 'Solo un administrador puede eliminar cargas.');
    if (ruta === 'filtros' && m === 'GET') return leerFiltros(db);
    if (ruta === 'filtros' && m === 'PUT') return guardarFiltros(db, req, yo);

    if (ruta.startsWith('admin')) {
      if (!yo.admin) return error(403, 'Esta sección es solo para administradores.');
      if (ruta === 'admin' && m === 'GET') return adminVer(db);
      if (ruta === 'admin/clave' && m === 'PUT') return adminClave(db, req, yo);
      if (ruta === 'admin/usuarios' && m === 'POST') return adminCrearUsuario(db, req);
      r = ruta.match(/^admin\/usuarios\/(.+)$/);
      if (r) {
        const email = normEmail(decodeURIComponent(r[1]));
        if (m === 'PATCH') return adminEditarUsuario(db, req, yo, email);
        if (m === 'DELETE') return adminBorrarUsuario(db, yo, email);
      }
    }
    return error(404, 'Ruta no encontrada.');
  } catch (e) {
    return error(500, 'Error del servidor: ' + (e && e.message ? e.message : String(e)));
  }
}
