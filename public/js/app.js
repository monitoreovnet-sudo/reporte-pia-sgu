/* Reporte PIA · SGU vs País — aplicación (Repositorio, Informe, Presentación, Administración) */
(function () {
  'use strict';
  var E = window.PIAEngine, D = window.PIADeck, H = window.SlidesHtml, C = window.Charts;
  var esc = C.esc;
  var $app = document.getElementById('app');

  var S = {
    yo: null, cargas: [], filtros: null, assets: null,
    activa: null,         // { id, meta, glpi, tip }
    R: null,              // resultado del cálculo actual
    tab: 0, slide: 0, fpaneOpen: true, openFilter: null
  };
  var CACHE = {};         // datos descomprimidos por id de carga
  var COLORS = { brand: '#440099', hot: '#CC04FF', violet: '#8A12D6', lilac: '#C77DF0', grey: '#A19F9D', teal: '#118DFF' };

  /* ================= utilidades ================= */
  function pct(x) { return x === null || x === undefined || isNaN(x) ? '-' : Math.round(x * 100) + '%'; }
  function num(n) { return n === null || n === undefined ? '-' : Number(n).toLocaleString('es-VE'); }
  function tk(n) { return !n ? '-' : num(n) + (n === 1 ? ' ticket' : ' tickets'); }
  function fechaHora(iso) { if (!iso) return '-'; var d = new Date(iso); return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }); }
  function corteTxt(serial) {
    var p = E.partsFromSerial(serial), h = p.h % 12 === 0 ? 12 : p.h % 12, pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return h + (p.mi ? ':' + pad(p.mi) : '') + (p.h < 12 ? ' AM ' : ' PM ') + pad(p.d) + '-' + pad(p.mo) + '-' + p.y;
  }
  function toast(t, err) {
    var el = document.getElementById('toast');
    el.textContent = t; el.className = 'toast' + (err ? ' err' : ''); el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { el.hidden = true; }, err ? 6000 : 3200);
  }
  function busy(text) {
    var el = document.querySelector('.busy');
    if (!text) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'busy'; el.innerHTML = '<div></div>'; document.body.appendChild(el); }
    el.firstChild.textContent = text;
  }
  function loadScript(src) {
    return new Promise(function (ok, ko) {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { ko(new Error('No se pudo cargar ' + src.split('/').pop() + '. Revise su conexión.')); };
      document.head.appendChild(s);
    });
  }
  function pdfLibs() {
    return Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
    ]);
  }
  function saveBlob(blob, name) {
    name = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // algunos navegadores descartan nombres con acentos
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
  }
  function api(method, path, body) {
    return fetch('/api/' + path, {
      method: method, credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && path !== 'login') { var had = !!S.yo; S.yo = null; busy(); renderLogin(had ? j.error : null); throw new Error(j.error || 'Sesión expirada'); }
        if (!r.ok) throw new Error(j.error || ('Error ' + r.status));
        return j;
      });
    });
  }
  function u8ToB64(u8) { var s = ''; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function b64ToU8(b64) { var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function gzip(str) { return new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function gunzip(u8) { return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); }
  function fileToB64(url) {
    return fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return u8ToB64(new Uint8Array(b)); });
  }
  var ICONS = {
    up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 11V2M4.5 5.5 8 2l3.5 3.5M2.5 11v2.5h11V11"/></svg>',
    down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2v9M4.5 7.5 8 11l3.5-3.5M2.5 11v2.5h11V11"/></svg>',
    play: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z"/></svg>',
    filter: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 3h12l-4.6 5.4V13L6.6 14V8.4z"/></svg>',
    chev: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" width="16" height="16"><path d="M10 3 5 8l5 5"/></svg>'
  };

  /* ================= configuración de cálculo ================= */
  function defaultsFiltros() {
    return { version: 4, categorias: E.DEFAULTS.categorias.slice(), grupos: E.DEFAULTS.grupos.slice(), reincExcluir: E.DEFAULTS.reincExcluir.slice(),
      sucursal: E.DEFAULTS.sucursal, sguMarker: E.DEFAULTS.sguMarker, piaSolicitante: E.DEFAULTS.piaSolicitante };
  }
  function filtros() { return Object.assign(defaultsFiltros(), S.filtros || {}); }
  function guardarFiltros() { return api('PUT', 'filtros', { filtros: filtros() }).catch(function (e) { toast('No se guardaron los filtros: ' + e.message, true); }); }
  function calcular() {
    if (!S.activa) { S.R = null; return null; }
    var m = S.activa.meta;
    var R = E.compute(S.activa.glpi, S.activa.tip, Object.assign({}, filtros(), { corte: m.corte, nps: m.nps || '', meses: m.meses && m.meses.length ? m.meses : null }));
    R.responsable = m.responsable || '';
    S.R = R;
    return R;
  }

  /* ================= datos de una carga ================= */
  function empaquetar(glpi, tip) {
    return JSON.stringify({
      v: 3, dup: glpi.duplicados || 0,
      g: glpi.map(function (r) { return [r.id, r.titulo, r.estado, r.categoria, r.apertura, r.solucion, r.cierre, r.solicitante, r.grupo, r.descripcion, r.cliente]; }),
      t: tip.map(function (r) { return [r.fecha, r.sucursal, r.categoria, r.subcategoria, r.estatus, r.ticket, r.cuenta, r.motivo, r.cedula, r.id]; })
    });
  }
  function desempaquetar(txt) {
    var o = JSON.parse(txt);
    if (o.v !== 3) { var e = new Error('Esta carga es del formato anterior. Vuelva a subir los archivos en el Repositorio.'); e.v1 = true; throw e; }
    var glpi = o.g.map(function (a) { return { id: a[0], titulo: a[1], estado: a[2], categoria: a[3], apertura: a[4], solucion: a[5], cierre: a[6], solicitante: a[7], grupo: a[8], descripcion: a[9], cliente: a[10] }; });
    glpi.duplicados = o.dup || 0;
    var tip = o.t.map(function (a) { return { fecha: a[0], sucursal: a[1], categoria: a[2], subcategoria: a[3], estatus: a[4], ticket: a[5], cuenta: a[6], motivo: a[7], cedula: a[8], id: a[9] }; });
    return { glpi: glpi, tip: tip };
  }
  function activar(id) {
    var meta = S.cargas.filter(function (c) { return c.id === id; })[0];
    if (!meta) return Promise.reject(new Error('Esa carga ya no existe.'));
    try { localStorage.setItem('pia-activa', id); } catch (e) { /* sin almacenamiento */ }
    S.activaV1 = false;
    if (!(meta.resumen && meta.resumen.v === 3)) { S.activa = null; S.R = null; S.activaV1 = true; return Promise.reject(new Error('Esta carga es del formato anterior. Vuelva a subir los archivos en el Repositorio.')); }
    if (CACHE[id]) { S.activa = { id: id, meta: meta, glpi: CACHE[id].glpi, tip: CACHE[id].tip }; calcular(); return Promise.resolve(); }
    busy('Abriendo la carga…');
    return api('GET', 'cargas/' + id).then(function (j) {
      return gunzip(b64ToU8(j.datos)).then(function (txt) {
        if (meta.resumen) meta.resumen = meta.resumen;
        CACHE[id] = desempaquetar(txt);
        S.activa = { id: id, meta: meta, glpi: CACHE[id].glpi, tip: CACHE[id].tip };
        calcular();
      });
    }).finally(function () { busy(); });
  }
  function cargarLista() {
    return api('GET', 'cargas').then(function (j) {
      S.cargas = j.cargas || [];
      if (S.activa) {
        var m = S.cargas.filter(function (c) { return c.id === S.activa.id; })[0];
        if (m) { S.activa.meta = m; calcular(); } else { S.activa = null; S.R = null; }
      }
    });
  }

  /* ================= lectura de archivos ================= */
  function decodeText(buf) { var u8 = new Uint8Array(buf); try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { return new TextDecoder('windows-1252').decode(u8); } }
  function readTable(file, loader) {
    return file.arrayBuffer().then(function (buf) {
      if (typeof XLSX === 'undefined') throw new Error('No se pudo cargar el lector de Excel. Revise su conexión y recargue la página.');
      var wb;
      if (/\.(csv|txt|tsv)$/i.test(file.name)) {
        var txt = decodeText(buf).replace(/^﻿/, ''), first = txt.split(/\r?\n/, 1)[0] || '';
        var cnt = function (ch) { return first.split(ch).length - 1; };
        var sep = cnt(';') > cnt(',') ? ';' : (cnt('\t') > cnt(',') ? '\t' : ',');
        wb = XLSX.read(txt, { type: 'string', raw: true, FS: sep });
      } else wb = XLSX.read(buf, { type: 'array', cellDates: false });
      var last = null;
      for (var i = 0; i < wb.SheetNames.length; i++) {
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[i]], { header: 1, raw: true, defval: null, blankrows: false });
        try { return loader(rows); } catch (e) { last = e; }
      }
      throw last || new Error('El archivo está vacío.');
    });
  }

  /* ================= estructura ================= */
  var RUTAS = [['repositorio', 'Repositorio'], ['informe', 'Informe'], ['presentacion', 'Presentación'], ['admin', 'Administración']];
  function ruta() { var h = (location.hash || '').replace('#', ''); return RUTAS.some(function (r) { return r[0] === h; }) ? h : 'repositorio'; }
  function shell(active, ctxHtml, body) {
    var nav = RUTAS.filter(function (r) { return r[0] !== 'admin' || S.yo.admin; }).map(function (r) {
      return '<a href="#' + r[0] + '"' + (r[0] === active ? ' aria-current="page"' : '') + '>' + r[1] + '</a>';
    }).join('');
    $app.innerHTML = '<div class="shell"><header class="top"><div class="top-in"><div class="brand"><span class="logo">vn<span>e</span>t</span><small>Reporte PIA · SGU vs País</small></div><nav class="nav">' + nav +
      '</nav><div class="who"><span>' + esc(S.yo.email) + (S.yo.admin ? ' · admin' : '') + '</span><button type="button" id="salir">Cerrar sesión</button></div></div></header>' +
      (ctxHtml ? '<div class="ctx"><div class="ctx-in">' + ctxHtml + '</div></div>' : '') + '<main class="main">' + body + '</main></div>';
    document.getElementById('salir').addEventListener('click', function () { api('POST', 'logout').catch(function () {}).then(function () { S.yo = null; renderLogin(); }); });
  }
  function ctxSelector() {
    if (!S.cargas.length) return '';
    var opts = S.cargas.map(function (c) {
      return '<option value="' + c.id + '"' + (S.activa && S.activa.id === c.id ? ' selected' : '') + '>' + esc((c.periodo || '') + ' · corte ' + corteTxt(c.corte)) + '</option>';
    }).join('');
    var m = S.activa && S.activa.meta;
    return '<label class="lbl" for="ctxSel">Carga</label><select id="ctxSel">' + (S.activa ? '' : '<option value="">Elija una carga</option>') + opts + '</select>' +
      (m ? '<span class="muted">Responsable: <b>' + esc(m.responsable || '-') + '</b> · Subida por ' + esc(m.creado_por) + ' el ' + fechaHora(m.creado) + '</span>' : '');
  }
  function bindCtx() {
    var sel = document.getElementById('ctxSel');
    if (sel) sel.addEventListener('change', function () { if (sel.value) activar(sel.value).then(render, function (e) { toast(e.message, true); }); });
  }
  function render() {
    if (!S.yo) return renderLogin();
    var r = ruta();
    if (r === 'admin' && !S.yo.admin) { location.hash = '#repositorio'; return; }
    window.scrollTo(0, 0);
    if (r === 'repositorio') return renderRepo();
    if (r === 'informe') return renderInforme();
    if (r === 'presentacion') return renderDeck();
    if (r === 'admin') return renderAdmin();
  }
  window.addEventListener('hashchange', render);

  /* ================= login ================= */
  function renderLogin(msg) {
    $app.innerHTML = '<div class="login"><div class="login-art"><div class="cap"><b>Reporte PIA · SGU vs País</b><span>Atención al Cliente · Comité PIA · Piloto San Agustín</span></div></div>' +
      '<div class="login-form"><form id="lf" novalidate><div><div class="eyebrow">Acceso restringido</div><h1>Iniciar sesión</h1></div>' +
      '<div class="field"><label for="lEmail">Correo corporativo</label><input class="input" id="lEmail" type="email" autocomplete="username" placeholder="nombre@vnet.com.ve" required></div>' +
      '<div class="field"><label for="lPw">Contraseña</label><div class="pw"><input class="input" id="lPw" type="password" autocomplete="current-password" required><button type="button" id="lShow">Mostrar</button></div></div>' +
      '<div id="lMsg" class="msg err"' + (msg ? '' : ' hidden') + '>' + esc(msg || '') + '</div>' +
      '<button class="btn primary" type="submit" id="lGo" style="justify-content:center;padding:11px">Entrar</button>' +
      '<p class="hint">Solo pueden entrar los correos autorizados por un administrador.</p></form></div></div>';
    var f = document.getElementById('lf'), pw = document.getElementById('lPw');
    document.getElementById('lShow').addEventListener('click', function (e) { var on = pw.type === 'password'; pw.type = on ? 'text' : 'password'; e.target.textContent = on ? 'Ocultar' : 'Mostrar'; });
    try { var last = localStorage.getItem('pia-email'); if (last) document.getElementById('lEmail').value = last; } catch (e) { /* nada */ }
    document.getElementById(document.getElementById('lEmail').value ? 'lPw' : 'lEmail').focus();
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = document.getElementById('lEmail').value.trim(), m = document.getElementById('lMsg'), b = document.getElementById('lGo');
      if (!email || !pw.value) { m.hidden = false; m.textContent = 'Escriba su correo y la contraseña.'; return; }
      b.disabled = true; b.textContent = 'Entrando…';
      api('POST', 'login', { email: email, clave: pw.value }).then(function (j) {
        try { localStorage.setItem('pia-email', email); } catch (e) { /* nada */ }
        S.yo = j; return arrancar();
      }).catch(function (e) { m.hidden = false; m.textContent = e.message; b.disabled = false; b.textContent = 'Entrar'; });
    });
  }

  /* ================= repositorio ================= */
  function esV2(c) { return c && c.resumen && c.resumen.v === 3; }
  function renderRepo() {
    var filas = S.cargas.map(function (c) {
      var r = c.resumen || {}, act = S.activa && S.activa.id === c.id, v2 = esV2(c);
      return '<tr data-id="' + c.id + '"><td><b>' + esc(c.periodo || '-') + '</b>' + (act ? ' <span class="pill">Abierta</span>' : '') + (v2 ? '' : ' <span class="pill off">Formato anterior</span>') + '<div class="hint">' + esc(c.glpi_nombre || '') + ' · ' + esc(c.tip_nombre || '') + '</div></td>' +
        '<td class="n">' + esc(corteTxt(c.corte)) + '</td>' +
        '<td class="ed" data-f="responsable">' + esc(c.responsable || '-') + '</td><td class="ed" data-f="nps">' + esc(c.nps || '-') + '</td>' +
        '<td class="n">' + (v2 ? num(r.vol.glpi) + ' / ' + num(r.g.sgu.creados) : '-') + '</td><td class="n">' + (v2 ? num(r.prod.casos) : '-') + '</td>' +
        '<td>' + esc(c.creado_por) + '<div class="hint">' + fechaHora(c.creado) + '</div></td>' +
        '<td><div class="row" style="flex-wrap:nowrap">' + (v2 ? '<button class="btn sm primary" data-a="informe">Informe</button><button class="btn sm" data-a="presentacion">Presentación</button>' : '<span class="hint">Vuelva a subir los archivos</span>') + '<button class="btn sm" data-a="editar">Editar</button>' +
        (S.yo.admin ? '<button class="btn sm danger" data-a="borrar">Eliminar</button>' : '') + '</div></td></tr>';
    }).join('');
    var lista = S.cargas.length ? '<div class="tbl"><table class="data list"><thead><tr><th>Período</th><th>Corte</th><th>Responsable</th><th>NPS</th><th>GLPI / SGU</th><th>Tipificados SGU</th><th>Subida por</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>'
      : '<div class="empty"><b>Todavía no hay cargas guardadas.</b><span class="muted">Suba la primera con el formulario de arriba. Quedará disponible para todos los usuarios autorizados.</span></div>';
    var hist = S.cargas.filter(esV2).slice().sort(function (a, b) { return a.corte - b.corte; });
    var histHtml = hist.length ? '<section class="panel"><h2>Histórico de cortes</h2><p class="hint">Valores guardados al subir cada carga, para comparar meses.</p><div class="tbl"><table class="data"><thead><tr><th>Corte</th><th>IR-PIA</th><th>FCR</th><th>Casos PIA</th><th>Prom. PIA</th><th>Prom. SGU</th><th>Prom. país</th><th>Cerrados semana SGU</th><th>Reincidencia SGU</th><th>Upgrades SGU</th></tr></thead><tbody>' +
      hist.map(function (c) {
        var r = c.resumen, g = r.g;
        return '<tr><td>' + esc(r.periodo) + '<div class="hint">' + esc(corteTxt(c.corte)) + '</div></td><td class="n">' + pct(r.ir.pct) + '</td><td class="n">' + pct(r.fcr.pct) + '</td><td class="n">' + num(r.prod.casos) + '</td>' +
          '<td class="n">' + E.fmtD(g.pia.prom) + '</td><td class="n">' + E.fmtD(g.sgu.prom) + '</td><td class="n">' + E.fmtD(g.pais.prom) + '</td><td class="n">' + pct(g.sgu.semana) + '</td><td class="n">' + num(g.sgu.reincAb) + ' ab. / ' + num(g.sgu.reincTk) + ' tk</td><td class="n">' + num(g.sgu.upgrades) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>' : '';
    var now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    shell('repositorio', '', '<div class="page"><div class="page-h"><div><h1>Repositorio</h1><p>Suba la descarga de GLPI y del Tipificador. Los archivos se procesan en su navegador y se guarda una copia comprimida de los datos necesarios para el informe.</p></div></div>' +
      '<form class="panel" id="up" novalidate><h2>Nueva carga</h2><div class="grid-form">' +
      '<div class="field"><label for="fG">Archivo de GLPI</label><div class="drop" id="dG"><input type="file" id="fG" accept=".xlsx,.xls,.xlsm,.csv,.txt,.ods"><strong>Seleccione o arrastre el archivo</strong><small>Excel o CSV exportado de GLPI</small></div></div>' +
      '<div class="field"><label for="fT">Archivo del Tipificador</label><div class="drop" id="dT"><input type="file" id="fT" accept=".xlsx,.xls,.xlsm,.csv,.txt,.ods"><strong>Seleccione o arrastre el archivo</strong><small>Excel o CSV de la lista</small></div></div>' +
      '<div class="field"><label for="fC">Fecha y hora de descarga</label><input class="input" type="datetime-local" id="fC" value="' + now.toISOString().slice(0, 16) + '"><span class="hint">Define el período (del día 1 a esta fecha) y la semana (los 8 días anteriores).</span></div></div>' +
      '<div class="field"><span class="lbl">Meses que se toman en cuenta para el informe</span><div class="row meses" id="fM"></div><span class="hint">GLPI se filtra por fecha de apertura y el Tipificador por fecha, solo en los meses marcados y hasta la fecha de descarga. Por defecto, el mes de la descarga.</span></div>' +
      '<div class="grid-form"><div class="field"><label for="fR">Responsable</label><input class="input" id="fR" value="' + esc(lastResp()) + '"></div>' +
      '<div class="field"><label for="fN">Satisfacción / NPS (opcional)</label><input class="input" id="fN" placeholder="Ej. 72 NPS"></div></div>' +
      '<p class="hint">Si es un solo Excel con varias hojas (GLPI y Tipificador), puede subir el mismo archivo en los dos campos: la app busca cada hoja por sus encabezados.</p>' +
      '<div class="row"><button class="btn primary" type="submit" id="upGo">' + ICONS.up + 'Procesar y guardar</button><span class="hint" id="upSt" role="status"></span></div><div id="upMsg" class="msg err" hidden></div></form>' +
      '<section class="panel"><h2>Cargas guardadas</h2>' + lista + '</section>' + histHtml + '</div>');

    var files = { g: null, t: null };
    function pintarMeses() {
      var m = document.getElementById('fC').value.match(/^(\d{4})-(\d{2})/), cont = document.getElementById('fM');
      if (!m) { cont.innerHTML = ''; return; }
      var prev = Array.prototype.map.call(cont.querySelectorAll('input:checked'), function (i) { return i.value; });
      cont.innerHTML = opcionesMeses(+m[1], +m[2]).map(function (k, i) { var on = prev.length ? prev.indexOf(k) >= 0 : i === 0; return '<label class="chk"><input type="checkbox" value="' + k + '"' + (on ? ' checked' : '') + '> ' + nombreMes(k) + '</label>'; }).join('');
    }
    document.getElementById('fC').addEventListener('change', function () { document.getElementById('fM').innerHTML = ''; pintarMeses(); });
    pintarMeses();
    [['dG', 'fG', 'g'], ['dT', 'fT', 't']].forEach(function (x) {
      var drop = document.getElementById(x[0]), inp = document.getElementById(x[1]);
      function set(f) { files[x[2]] = f || null; drop.classList.toggle('has', !!f); drop.querySelector('strong').textContent = f ? f.name : 'Seleccione o arrastre el archivo'; drop.querySelector('small').textContent = f ? (f.size / 1048576).toFixed(1) + ' MB' : ''; }
      inp.addEventListener('change', function () { set(inp.files[0]); });
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('drag'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('drag'); }); });
      drop.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) set(e.dataTransfer.files[0]); });
    });
    document.getElementById('up').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var msg = document.getElementById('upMsg'), st = document.getElementById('upSt'), b = document.getElementById('upGo');
      var fail = function (t) { msg.hidden = false; msg.textContent = t; st.textContent = ''; b.disabled = false; };
      msg.hidden = true;
      if (!files.g || !files.t) return fail('Falta cargar ' + (!files.g ? 'el archivo de GLPI.' : 'el archivo del Tipificador.'));
      var m = document.getElementById('fC').value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (!m) return fail('Indique la fecha y hora en que se descargó la data.');
      var corte = E.serialFromParts(+m[1], +m[2], +m[3], +m[4], +m[5], 0);
      var resp = document.getElementById('fR').value.trim(), nps = document.getElementById('fN').value.trim();
      var meses = Array.prototype.map.call(document.querySelectorAll('#fM input:checked'), function (i) { return i.value; });
      if (!meses.length) return fail('Marque al menos un mes para el informe.');
      try { localStorage.setItem('pia-resp', resp); } catch (e) { /* nada */ }
      b.disabled = true; st.textContent = 'Leyendo archivos…';
      Promise.all([
        readTable(files.g, E.loadGLPI).catch(function (e) { throw new Error('GLPI: ' + e.message); }),
        readTable(files.t, E.loadTipif).catch(function (e) { throw new Error('Tipificador: ' + e.message); })
      ]).then(function (res) {
        st.textContent = 'Calculando…';
        var R = E.compute(res[0], res[1], Object.assign({}, filtros(), { corte: corte, nps: nps, meses: meses }));
        if (!R.volumen.glpi) throw new Error('GLPI no tiene tickets abiertos en los meses marcados (' + meses.map(nombreMes).join(', ') + ') hasta la fecha de descarga. Revise la fecha y los meses.');
        if (!R.fijos.fcr.den) throw new Error('El Tipificador no tiene casos de "' + filtros().sucursal + '" en los meses marcados.');
        var periodo = R.periodoTxt;
        if (!R.g.sgu.creados) throw new Error('GLPI no tiene tickets con "' + filtros().sguMarker + '" en el título.');
        st.textContent = 'Comprimiendo y guardando…';
        var snap = E.snapshot(R); snap.v = 3; snap.vol = { glpi: R.volumen.glpi };
        return gzip(empaquetar(res[0], res[1])).then(function (gz) {
          return api('POST', 'cargas', { datos: u8ToB64(gz), corte: corte, periodo: periodo, responsable: resp, nps: nps, glpi_nombre: files.g.name, tip_nombre: files.t.name, resumen: snap, meses: meses });
        }).then(function (j) { CACHE[j.id] = { glpi: res[0], tip: res[1] }; return j.id; });
      }).then(function (id) {
        return cargarLista().then(function () { return activar(id); });
      }).then(function () { toast('Carga guardada. Abriendo el informe…'); location.hash = '#informe'; })
        .catch(function (e) { fail(e.message); });
    });

    Array.prototype.forEach.call(document.querySelectorAll('tr[data-id] button'), function (btn) {
      btn.addEventListener('click', function () {
        var tr = btn.closest('tr'), id = tr.getAttribute('data-id'), a = btn.getAttribute('data-a');
        if (a === 'informe' || a === 'presentacion') return activar(id).then(function () { location.hash = '#' + a; }, function (e) { toast(e.message, true); });
        if (a === 'borrar') {
          if (!btn.classList.contains('armed')) { btn.classList.add('armed'); btn.textContent = 'Confirmar'; setTimeout(function () { if (btn.isConnected) { btn.classList.remove('armed'); btn.textContent = 'Eliminar'; } }, 4000); return; }
          return api('DELETE', 'cargas/' + id).then(function () { delete CACHE[id]; if (S.activa && S.activa.id === id) { S.activa = null; S.R = null; } toast('Carga eliminada.'); return cargarLista(); }).then(renderRepo, function (e) { toast(e.message, true); });
        }
        if (a === 'editar') {
          var c = S.cargas.filter(function (x) { return x.id === id; })[0];
          if (btn.dataset.mode === 'save') {
            var body = {};
            tr.querySelectorAll('td.ed input.input').forEach(function (i) { body[i.name] = i.value.trim(); });
            var mesesN = Array.prototype.map.call(tr.querySelectorAll('.meses input:checked'), function (i) { return i.value; });
            if (!mesesN.length) { toast('Marque al menos un mes.', true); return; }
            var antes = (c.meses && c.meses.length ? c.meses : [mesDeCorte(c.corte)]).slice().sort().join(',');
            var cambiaMeses = mesesN.slice().sort().join(',') !== antes;
            if (cambiaMeses) body.meses = mesesN;
            btn.disabled = true;
            return api('PATCH', 'cargas/' + id, body).then(cargarLista).then(function () {
              if (!cambiaMeses || !esV2(c)) return;
              delete CACHE[id];
              return activar(id).then(function () { var snap = E.snapshot(S.R); snap.v = 3; snap.vol = { glpi: S.R.volumen.glpi }; return api('PATCH', 'cargas/' + id, { resumen: snap, periodo: S.R.periodoTxt }); }).then(cargarLista);
            }).then(function () { toast('Cambios guardados.'); renderRepo(); }, function (e) { btn.disabled = false; toast(e.message, true); });
          }
          tr.querySelectorAll('td.ed').forEach(function (td) { var f = td.getAttribute('data-f'); td.innerHTML = '<input class="input" name="' + f + '" value="' + esc(c[f] || '') + '" aria-label="' + f + '">'; });
          var p0 = E.partsFromSerial(c.corte), sel = c.meses && c.meses.length ? c.meses : [mesDeCorte(c.corte)];
          tr.cells[0].insertAdjacentHTML('beforeend', '<div class="row meses" style="margin-top:6px">' + opcionesMeses(p0.y, p0.mo).map(function (k) { return '<label class="chk"><input type="checkbox" value="' + k + '"' + (sel.indexOf(k) >= 0 ? ' checked' : '') + '> ' + nombreMes(k) + '</label>'; }).join('') + '</div>');
          btn.dataset.mode = 'save'; btn.textContent = 'Guardar'; btn.classList.add('primary');
        }
      });
    });
  }
  function opcionesMeses(y, mo) { var out = []; for (var i = 0; i < 6; i++) { var yy = y, mm = mo - i; while (mm < 1) { mm += 12; yy--; } out.push(yy + '-' + (mm < 10 ? '0' : '') + mm); } return out; }
  function mesDeCorte(x) { var p = E.partsFromSerial(x); return p.y + '-' + (p.mo < 10 ? '0' : '') + p.mo; }
  function nombreMes(k) { return E.MESES[+k.slice(5) - 1] + ' ' + k.slice(0, 4); }
  function lastResp() { try { return localStorage.getItem('pia-resp') || 'Gabriela Silva'; } catch (e) { return 'Gabriela Silva'; } }

  /* ================= informe (estilo Power BI) ================= */
  var FILTROS = [
    { id: 'categorias', kind: 'categorias', title: 'Categorías', noun: 'categorías', note: 'Aplica a tiempos por categoría y productividad. Las no seleccionadas se suman en "Otro".' },
    { id: 'grupos', kind: 'grupos', title: 'Grupos técnicos', noun: 'grupos', note: 'Aplica a tiempos por grupo técnico. Los no seleccionados se suman en "Otro". Los grupos se unifican: termina en Cobranzas Masivas → Cobranzas Masivas (+); dice reparación → Reparación (+); activaciones → Activaciones (+); UDN Caracas → UDN Caracas (+); COR → COR (+); Contratista San Agustín → Contratista San Agustín (+). El (+) indica que el grupo reúne varios grupos de GLPI que participaron en la solución.' },
    { id: 'reincExcluir', kind: 'ftth', invert: true, title: 'Problemas de reincidencia', noun: 'categorías FTTH', note: 'Marcadas: cuentan para reincidencia. Desmarcadas: no cuentan (por defecto facturación, reembolso y cambio de plan).' }
  ];
  function keyerDe(d) { return d.kind === 'grupos' ? E.grpKey : E.norm; }
  /** Claves marcadas en el filtro (para el de reincidencia: las categorías que SÍ cuentan). */
  function marcadas(d, R, lista) {
    var k = keyerDe(d);
    if (!d.invert) return lista.map(k).filter(function (x, i, a) { return a.indexOf(x) === i; });
    var fuera = lista.map(k);
    return filterOptions(d, R).map(function (o) { return o.key; }).filter(function (x) { return fuera.indexOf(x) < 0; });
  }
  var PAGINAS = ['Indicadores', 'Tiempos por categoría', 'Grupos técnicos', 'Productividad', 'Reincidencias', 'Semana', 'Mismo día', 'Upgrades y SVA', 'Controles'];
  var CMPS = [['pia', 'otras', 'pia_otras', 'PIA vs. SGU'], ['sgu', 'pais', 'sgu_pais', 'SGU vs. país'], ['pia', 'pais', 'pia_pais', 'PIA vs. país']];
  var GCOL = { pia: '#CC04FF', otras: '#440099', sgu: '#440099', pais: '#241338' };
  var GS = ['pia', 'otras', 'sgu', 'pais'];

  function chipH(g) { return '<span class="gchip" style="background:' + GCOL[g] + '">' + esc(S.R.etiquetas[g]) + '</span>'; }
  function tile(cls, title, sub, body) { return '<div class="viz ' + cls + '"><h3>' + esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</h3>' + body + '</div>'; }
  function xa(x) { return x ? ' data-x="' + esc(JSON.stringify(x)) + '" tabindex="0"' : ''; }
  function kcard(title, tag, v, extra, note, chipG, x) {
    return '<div class="viz card c4' + (x ? ' xable' : '') + '"' + xa(x) + '><div class="t">' + esc(title) + (tag ? '<i>' + esc(tag) + '</i>' : '') + (chipG ? '<span style="float:right">' + chipH(chipG) + '</span>' : '') + '</div><div class="v">' + esc(v) + (extra ? '<small>' + esc(extra) + '</small>' : '') + '</div>' + (note ? '<div class="n">' + esc(note) + '</div>' : '') + '</div>';
  }
  function kpar(title, tag, a, b, f, xk) {
    var half = function (g) { var x = f(g); return '<div class="half' + (xk ? ' xable' : '') + '"' + xa(xk ? { k: xk, g: g } : null) + '>' + chipH(g) + '<div class="v">' + esc(x.v) + (x.u ? '<small>' + esc(x.u) + '</small>' : '') + '</div><div class="n">' + esc(x.n || '') + '</div></div>'; };
    return '<div class="viz card c4"><div class="t">' + esc(title) + (tag ? '<i>' + esc(tag) + '</i>' : '') + '</div><div class="halves">' + half(a) + half(b) + '</div></div>';
  }
  function table(h1, h2, rows) {
    return '<div class="tbl"><table class="data"><thead><tr>' + h1 + '</tr>' + (h2 ? '<tr>' + h2 + '</tr>' : '') + '</thead><tbody>' + rows.map(function (r) {
      return '<tr' + (r.tot ? ' class="tot"' : '') + '>' + r.cells.map(function (c, i) {
        var o = c !== null && typeof c === 'object' ? c : { v: c };
        return '<td class="' + (i ? 'n' : '') + (o.x ? ' xable' : '') + '"' + xa(o.x) + (i === 0 && r.bold ? ' style="font-weight:700"' : '') + '>' + esc(o.v).replace(/\n/g, '<br>') + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
  }
  function h4(label, cols) {
    var L = S.R.etiquetasLargas;
    return { h1: '<th rowspan="2">' + label + '</th>' + GS.map(function (g) { return '<th colspan="' + cols.length + '">' + esc(L[g]) + '</th>'; }).join(''), h2: GS.map(function () { return cols.map(function (c) { return '<th>' + c + '</th>'; }).join(''); }).join('') };
  }
  function tiempoRows(list, t) { return list.map(function (r, ri) { return { tot: r.total, bold: r.negrita, cells: [r.label].concat(GS.reduce(function (a, g) { return a.concat([{ v: E.tickets(r[g].n), x: { k: 'cel', t: t, r: ri, g: g, m: 'n' } }, { v: r[g].texto, x: { k: 'cel', t: t, r: ri, g: g, m: 'texto' } }]); }, [])) }; }); }
  function dias(secs) { return secs >= 86400 ? (Math.round(secs / 8640) / 10).toLocaleString('es-VE') + ' d' : Math.round(secs / 3600) + ' h'; }
  function upTxt(g) { var u = S.R.g[g].upgrades, v = S.R.g[g].sva; return { v: num(u.n) + ' · ' + num(v.n), u: 'upgrades · SVA', n: (!u.n && u.cambiosPlan && u.bajas === u.cambiosPlan) ? u.cambiosPlan + ' cambio(s) de plan, todos a un plan menor' : num(u.cambiosPlan) + ' cambios de plan en GLPI' }; }

  function paginaInforme(i, R, cmpIdx) {
    var G = R.g, F = R.fijos, L = R.etiquetas;
    var head = '<div class="rpage-h"><h2>' + esc(PAGINAS[i]) + (i === 0 ? ' · ' + CMPS[cmpIdx][3] : '') + '</h2><span>' + esc(R.periodoTxt + ' · corte ' + R.corteTxt + ' · ' + (R.responsable || '') + ' · ' + R.fuentesTxt) + '</span></div>';
    var body = '';
    if (i === 0) {
      var a = CMPS[cmpIdx][0], b = CMPS[cmpIdx][1], cmp = R.comparativos[CMPS[cmpIdx][2]];
      body = (S.pdfMode ? '' : '<div class="c12 seg" role="group" aria-label="Comparación">' + CMPS.map(function (c, k) { return '<button type="button" data-cmp="' + k + '" aria-pressed="' + (k === cmpIdx) + '">' + c[3] + '</button>'; }).join('') + '</div>') +
        kcard('Índice de resolución PIA', '', pct(F.ir.pct), num(F.ir.num) + ' casos', num(F.ir.fcr) + ' resueltos en 1er contacto + ' + num(F.ir.escResueltos) + ' escalados con solución en GLPI, de ' + num(F.ir.den) + ' casos del PIA', 'pia', { k: 'ir' }) +
        kcard('Resolución en 1er contacto (FCR)', '', pct(F.fcr.pct), num(F.fcr.n) + ' casos', 'de los ' + num(F.fcr.den) + ' casos únicos tipificados por el PIA', 'pia', { k: 'fcr' }) +
        kcard('Productividad del punto PIA', '', num(F.productividad.casos) + ' casos', num(F.productividad.abonados) + ' abonados', 'casos únicos tipificados por ' + R.cfg.sucursal + (F.productividad.duplicados ? ' (' + num(F.productividad.duplicados) + ' duplicados excluidos)' : '') + '; abonados = cédulas distintas', 'pia', { k: 'prod' }) +
        kpar('Cerrados en la misma semana que se abrieron', '', a, b, function (g) { var x = G[g].semana; return { v: pct(x.pct), n: num(x.cerradosMisma) + ' de ' + num(x.abiertos) + ' abiertos (' + R.ventana.corta + ')' }; }, 'semana') +
        kcard('Satisfacción / NPS', 'Trimestral', F.nps || '—', '', F.nps ? '' : 'sin medición en este corte (se carga en el Repositorio con Editar)', null, { k: 'nps' }) +
        kpar('Reincidencia de fallas FTTH', '', a, b, function (g) { var x = G[g].reinc; return { v: num(x.abonados), u: 'abonados', n: num(x.tickets) + ' tickets · ' + pct(x.pct) + ' de ' + num(x.ftth) + ' FTTH' }; }, 'reinc') +
        '<div class="viz card c4 xable"' + xa({ k: 'cmp', id: CMPS[cmpIdx][2] }) + '><div class="t">Comparativo ' + esc(L[a]) + ' vs. ' + esc(L[b]) + '<i>Mensual</i></div><div class="v">' + esc(cmp.valor) + '</div>' + (cmp.ganador ? '<div class="n" style="color:var(--ink)">a favor de ' + chipH(cmp.ganador) + '</div>' : '') + '<div class="n">' + esc(cmp.detalle) + '</div></div>' +
        kpar('Upgrades y SVA', 'Mensual', a, b, upTxt, 'upgrades') +
        kpar('Tiempo promedio de resolución', '', a, b, function (g) { return { v: E.fmtD(G[g].prom), n: num(G[g].solucionados) + ' tickets resueltos' + (G[g].moda !== null ? ' · moda ' + E.fmtD(G[g].moda) : '') }; }, 'prom') +
        tile('c6', 'Tiempo promedio de resolución', 'por grupo', C.hbars({ title: 'Promedio por grupo', labels: GS.map(function (g) { return L[g]; }), labelW: 160, series: [{ name: 'Promedio', color: COLORS.brand, values: GS.map(function (g) { return G[g].prom || 0; }) }], fmt: function (v) { return E.fmtD(v); } })) +
        tile('c6', 'Creados y solucionados', 'en el período', C.hbars({ title: 'Creados y solucionados', labels: ['PIA', 'SGU otras unidades', 'SGU total'], labelW: 160, series: [{ name: 'Creados', color: COLORS.grey, values: [G.pia.creados, G.otras.creados, G.sgu.creados] }, { name: 'Solucionados', color: COLORS.brand, values: [G.pia.solucionados, G.otras.solucionados, G.sgu.solucionados] }], fmt: num }));
    } else if (i === 1) {
      var cats = R.tiempoCategoria.filter(function (r) { return !r.total; });
      var hh = h4('Categoría', ['Tickets resueltos', 'Moda o promedio']);
      body = tile('c12', 'Tiempo de resolución por categoría', 'M: moda (valor más repetido, redondeado a la hora) · P: promedio · solo tickets resueltos', table(hh.h1, hh.h2, tiempoRows(R.tiempoCategoria, 'tiempoCategoria'))) +
        tile('c12', 'Promedio por categoría', 'SGU total vs. país', C.hbars({ title: 'Promedio por categoría', labels: cats.map(function (r) { return E.catCorta(r.label); }), labelW: 220, series: [{ name: 'SGU total', color: COLORS.hot, values: cats.map(function (r) { return r.sgu.prom || 0; }) }, { name: 'País', color: COLORS.brand, values: cats.map(function (r) { return r.pais.prom || 0; }) }], fmt: dias }));
    } else if (i === 2) {
      var hg = h4('Grupo técnico', ['Tickets resueltos', 'Moda o promedio']);
      body = tile('c12', 'Tiempo de resolución por grupo técnico', 'M: moda · P: promedio · solo tickets resueltos', table(hg.h1, hg.h2, tiempoRows(R.tiempoGrupo, 'tiempoGrupo')));
    } else if (i === 3) {
      var hp = h4('Categoría', ['Creados', 'Solucionados']);
      var c = function (v) { return v === null || v === undefined ? '' : E.tickets(v); };
      var ps = R.productividad.filter(function (r) { return !r.total && !r.estatus; });
      body = tile('c12', 'Productividad por categoría', 'la primera fila son consultas del Tipificador que no generan ticket', table(hp.h1, hp.h2, R.productividad.map(function (r, ri) { return { tot: r.total, cells: [r.label].concat(GS.reduce(function (a, g) { return a.concat([{ v: c(r[g].creados), x: r[g].creados === null ? null : { k: 'prodcel', r: ri, g: g, m: 'creados' } }, { v: c(r[g].solucionados), x: r[g].solucionados === null ? null : { k: 'prodcel', r: ri, g: g, m: 'solucionados' } }]); }, [])) }; }))) +
        tile('c12', 'Tickets creados por categoría', 'PIA y SGU otras unidades', C.hbars({ title: 'Creados por categoría', labels: ps.map(function (r) { return E.catCorta(r.label); }), labelW: 220, series: [{ name: 'PIA', color: COLORS.hot, values: ps.map(function (r) { return r.pia.creados; }) }, { name: 'SGU otras unidades', color: COLORS.brand, values: ps.map(function (r) { return r.otras.creados; }) }], fmt: num }));
    } else if (i === 4) {
      var RI = R.reincidencia, rc = Object.keys(RI.porCategoria).sort(function (x, y) { return RI.porCategoria[y] - RI.porCategoria[x]; });
      body = GS.map(function (g) { var x = G[g].reinc; return '<div class="viz card c3 xable"' + xa({ k: 'reinc', g: g }) + '><div class="t">Reincidencia FTTH ' + chipH(g) + '</div><div class="v">' + num(x.abonados) + '<small>abonados</small></div><div class="n">' + num(x.tickets) + ' tickets · ' + pct(x.pct) + ' de ' + num(x.ftth) + ' FTTH</div></div>'; }).join('') +
        tile('c5', 'Categorías de los tickets reincidentes', 'SGU total', rc.length ? C.hbars({ title: 'Reincidencia por categoría', labels: rc, labelW: 170, series: [{ name: 'Tickets', color: COLORS.brand, values: rc.map(function (k) { return RI.porCategoria[k]; }) }], fmt: num }) : '<p class="hint">Sin reincidencias.</p>') +
        tile('c7', 'Cuentas reincidentes FTTH', 'SGU total · por número de cuenta del título' + (R.reincExcluidas.length ? ' · no cuentan: ' + R.reincExcluidas.map(function (c) { return E.catCorta(c).toLowerCase(); }).join(', ') : ''), table('<th>Cliente</th><th>Cuenta</th><th>Categorías</th><th>Tickets</th>', '', RI.detalle.length ? RI.detalle.map(function (d) { return { cells: [d.nombre, d.cuenta, d.categorias.join('\n'), d.tickets.map(function (t) { return t.id + (t.pia ? ' (PIA)' : ''); }).join('\n')] }; }) : [{ cells: ['Sin reincidencias', '', '', ''] }]));
    } else if (i === 5 || i === 6) {
      var semana = i === 5;
      var cols = semana ? ['Abiertos', 'Pendientes', 'Resueltos', 'Pend. acum.', 'Resuelto acum.', '% jornada'] : ['Abiertos', 'Pendientes', 'Resueltos mismo día', '% jornada'];
      var fila = function (f, g, d) {
        var cs = semana ? [['abiertos', num(f.abiertos)], ['pendientes', num(f.pendientes)], ['resueltos', num(f.resueltos)], ['pendAcc', num(f.pendAcc)], ['resAcc', num(f.resAcc)], ['pct', pct(f.pct)]] : [['abiertos', num(f.abiertos)], ['pendientes', num(f.pendientes)], ['mismoDia', num(f.mismoDia)], ['pct', pct(f.pct)]];
        return cs.map(function (c) { return { v: c[1], x: { k: 'jor', g: g, d: d, c: c[0] } }; });
      };
      var jt = function (a, b) {
        var h1 = '<th rowspan="2">Día</th><th rowspan="2">Fecha</th><th colspan="' + cols.length + '">' + esc(R.etiquetasLargas[a]) + '</th><th colspan="' + cols.length + '">' + esc(R.etiquetasLargas[b]) + '</th>';
        var h2 = cols.concat(cols).map(function (c) { return '<th>' + c + '</th>'; }).join('');
        var rows = G[a].jornada.filas.map(function (f, k) { return { cells: [f.dia, f.fecha.slice(0, 5)].concat(fila(f, a, k), fila(G[b].jornada.filas[k], b, k)) }; });
        rows.push({ tot: true, cells: ['Total semanal', ''].concat(fila(G[a].jornada.total, a, -1), fila(G[b].jornada.total, b, -1)) });
        return table(h1, h2, rows);
      };
      var J = G.sgu.jornada.filas, lab = J.map(function (f) { return f.dia.slice(0, 3) + ' ' + f.fechaCorta; });
      body = tile('c12', (semana ? 'Tickets abiertos y solucionados' : 'Abiertos y solucionados el mismo día') + ' · SGU total vs. país', R.ventana.desde + ' al ' + R.ventana.hasta, jt('sgu', 'pais')) +
        tile('c12', (semana ? 'Tickets abiertos y solucionados' : 'Abiertos y solucionados el mismo día') + ' · PIA vs. SGU otras unidades', R.ventana.desde + ' al ' + R.ventana.hasta, jt('pia', 'otras'));
      if (semana) body += tile('c12', 'Abiertos vs. resueltos por día', 'SGU total', C.columns({ title: 'Abiertos vs resueltos', labels: lab, series: [{ name: 'Abiertos', color: '#B28DE0', values: J.map(function (f) { return f.abiertos; }) }, { name: 'Resueltos', color: COLORS.brand, values: J.map(function (f) { return f.resueltos; }) }] }));
      else body += tile('c12', 'Gestión en la última semana', R.ventana.desde + ' al ' + R.ventana.hasta + ' · cerrados = fecha de cierre dentro de la semana', table('<th>Grupo</th><th>Abiertos</th><th>Resueltos</th><th>Cerrados</th><th>Resueltos el mismo día</th><th>% jornada</th>', '', GS.map(function (g) { var x = G[g].gestion; return { cells: [L[g], { v: num(x.abiertos), x: { k: 'gestion', g: g, c: 'abiertos' } }, { v: num(x.resueltos), x: { k: 'gestion', g: g, c: 'resueltos' } }, { v: num(x.cerrados), x: { k: 'gestion', g: g, c: 'cerrados' } }, { v: num(x.mismoDia), x: { k: 'gestion', g: g, c: 'mismo' } }, { v: pct(x.pct), x: { k: 'gestion', g: g, c: 'pct' } }] }; })));
    } else if (i === 7) {
      body = GS.map(function (g) { var u = G[g].upgrades, v = G[g].sva; return '<div class="viz card c3"><div class="t">' + chipH(g) + '</div><div class="v xable"' + xa({ k: 'upgrades', g: g }) + '>' + num(u.n) + '<small>upgrades</small></div><div class="v xable" style="font-size:22px"' + xa({ k: 'sva', g: g }) + '>' + num(v.n) + '<small>SVA</small></div><div class="n">' + num(u.cambiosPlan) + ' cambios de plan en GLPI · ' + num(u.bajas) + ' a un plan menor o revertidos</div></div>'; }).join('') +
        tile('c12', 'Detalle', 'upgrade = aumento de plan VNET (200, 400, 600, 1 Giga); SVA = activación de Pley o ExitLag', table('<th>Grupo</th><th>Upgrades en GLPI</th><th>Aumentos en Tipificador</th><th>Repetidos (en ambas fuentes)</th><th>SVA en GLPI</th><th>SVA en Tipificador</th>', '',
          GS.map(function (g) { var u = G[g].upgrades, v = G[g].sva; return { cells: [L[g], u.glpi.join(', ') || '-', num(u.tip), num(u.repetidos), v.glpi.join(', ') || '-', num(v.tip)] }; }))) +
        tile('c12', 'Cambios de plan revertidos', 'no cuentan como upgrade', table('<th>Ticket</th><th>Extracto</th>', '', R.controles.reversiones.length ? R.controles.reversiones.map(function (x) { return { cells: [x.id, x.extracto] }; }) : [{ cells: ['-', 'Ninguno'] }]));
    } else if (i === 8) {
      var K = R.controles;
      var ctl = function (n, titulo, cnt, detalle) { return tile('c12', n + '. ' + titulo, cnt, detalle || ''); };
      body = ctl(1, 'Tipificador fuera de período', num(K.tipFuera.n) + ' filas descartadas (' + num(K.tipFuera.sa) + ' de ' + R.cfg.sucursal + ')') +
        ctl('1b', 'Casos duplicados del PIA (Tipificador)', num(K.tipDuplicados.length) + ' filas excluidas: misma categoría, subcategoría, motivo, fecha y cédula', K.tipDuplicados.length ? table('<th>ID</th><th>Duplica a</th><th>Fecha</th><th>Cédula</th><th>Categoría</th><th>Subcategoría</th><th>Motivo</th><th>Estatus</th>', '', K.tipDuplicados.map(function (x) { return { cells: [x.id, x.original, x.fecha, x.cedula, x.categoria, x.subcategoria, x.motivo, x.estatus] }; })) : '') +
        ctl('1c', 'Escalados del PIA sin ticket en GLPI', num(K.escaladosSinCruce.length) + ' casos escalados sin número de ticket o con un número que no está en el archivo de GLPI (no suman al índice de resolución)', K.escaladosSinCruce.length ? table('<th>ID</th><th>Ticket GLPI</th><th>Fecha</th><th>Cédula</th><th>Subcategoría</th>', '', K.escaladosSinCruce.map(function (x) { return { cells: [x.id, x.ticket, x.fecha, x.cedula, x.subcategoria] }; })) : '') +
        ctl(2, 'Categorías homologadas', num(K.homologadas.length) + ' tickets con ">" o "<" al final (la lista completa está en el Excel)', K.homologadas.length ? table('<th>Categoría original</th><th>Homologada</th><th>Tickets</th>', '', (function () { var m = {}; K.homologadas.forEach(function (x) { var k = x.de + '\u0000' + x.a; m[k] = (m[k] || 0) + 1; }); return Object.keys(m).map(function (k) { var p = k.split('\u0000'); return { cells: [p[0], p[1], num(m[k])] }; }); })()) : '') +
        ctl(3, 'Posibles duplicados (SGU)', num(K.posiblesDuplicados.length) + ' pares: misma cuenta y categoría, abiertos a menos de 60 minutos', K.posiblesDuplicados.length ? table('<th>Cuenta</th><th>Categoría</th><th>Tickets</th><th>Minutos</th>', '', K.posiblesDuplicados.map(function (x) { return { cells: [x.cuenta, x.cat, x.ids.join(' y '), x.minutos] }; })) : '') +
        ctl(4, 'Nombres inconsistentes (SGU)', num(K.nombres.length) + ' casos', K.nombres.length ? table('<th>Cuenta</th><th>Ticket</th><th>Tipo</th><th>Nombre en el título</th><th>"Nombre Cliente"</th>', '', K.nombres.map(function (x) { return { cells: [x.cuenta, x.id, x.tipo, x.titulo, x.campo] }; })) : '') +
        ctl(5, 'Tickets SGU sin cuenta en el título', num(K.sinCuenta.length) + ' tickets (no entran en reincidencias)', K.sinCuenta.length ? table('<th>Ticket</th><th>Título</th>', '', K.sinCuenta.map(function (x) { return { cells: [x.id, x.titulo] }; })) : '') +
        ctl(6, 'Tickets del PIA fuera de SGU', num(K.piaFueraSGU.length) + ' tickets: el solicitante es el PIA pero el título no dice "' + R.cfg.sguMarker + '"', K.piaFueraSGU.length ? table('<th>Ticket</th><th>Título</th>', '', K.piaFueraSGU.map(function (x) { return { cells: [x.id, x.titulo] }; })) : '') +
        ctl(7, 'Cambios de plan sin dirección clara', num(K.planIndefinido.length) + ' tickets para revisar a mano (no cuentan como upgrade)', K.planIndefinido.length ? table('<th>Ticket</th><th>Grupo</th><th>Extracto</th>', '', K.planIndefinido.map(function (x) { return { cells: [x.id, x.grupo, x.extracto] }; })) : '') +
        ctl(8, 'Totales entre tablas', K.totales.every(function (x) { return x.ok; }) ? 'Coinciden en los cuatro grupos' : 'Hay diferencias: revisar', table('<th>Grupo</th><th>Creados</th><th>Solucionados</th><th>Suma 5.1</th><th>Suma 5.2</th><th>Creados 5.3</th><th>Solucionados 5.3</th><th>Estado</th>', '', K.totales.map(function (x) { return { cells: [x.grupo, num(x.creados), num(x.solucionados), num(x.t51), num(x.t52), num(x.t53c), num(x.t53s), x.ok ? 'Coincide' : 'Revisar'] }; }))) +
        (K.duplicadosId ? tile('c12', 'IDs repetidos en GLPI', num(K.duplicadosId) + ' filas con el mismo ID se contaron una sola vez', '') : '');
    }
    return '<div class="rpage" data-p="' + i + '">' + head + body + '</div>';
  }

  function sinCarga(where) {
    var v1 = S.activaV1;
    return '<div class="page"><div class="empty"><b>' + (v1 ? 'Esa carga es del formato anterior.' : 'Elija una carga para ver ' + where + '.') + '</b><span class="muted">' + (v1 ? 'El cálculo nuevo necesita columnas que antes no se guardaban (fecha de cierre, descripción, cuenta). Vuelva a subir los archivos en el Repositorio.' : (S.cargas.length ? 'Use el selector de arriba o ábrala desde el Repositorio.' : 'Primero suba los archivos de GLPI y del Tipificador en el Repositorio.')) + '</span><a class="btn primary" href="#repositorio">Ir al Repositorio</a></div></div>';
  }

  function filterPane(R) {
    var f = filtros();
    var cards = FILTROS.map(function (d) {
      var open = S.openFilter && S.openFilter.id === d.id;
      return '<div class="fcard' + (open ? ' open' : '') + '" data-f="' + d.id + '"><button type="button" class="fhead" aria-expanded="' + open + '"><b>' + esc(d.title) + '</b><span>' + marcadas(d, R, f[d.id]).length + ' de ' + filterOptions(d, R).length + ' ' + d.noun + (d.invert ? ' cuentan' : '') + '</span></button>' +
        (open ? filterList(d, R) : '') + '</div>';
    }).join('');
    return '<aside class="fpane' + (S.fpaneOpen ? '' : ' closed') + '" aria-label="Filtros"><div class="fh"><span>' + ICONS.filter.replace('<svg', '<svg width="15" height="15" style="vertical-align:-2px;margin-right:6px"') + 'Filtros</span><button type="button" id="fToggle" aria-label="' + (S.fpaneOpen ? 'Ocultar filtros' : 'Mostrar filtros') + '">' + (S.fpaneOpen ? '»' : '«') + '</button></div>' +
      '<div class="fbody">' + cards + '<p class="hint">Por defecto se usan las 10 categorías y los 10 grupos de la especificación. Lo demás se suma en "Otro". Los filtros se guardan para todos los usuarios y se aplican al informe, la presentación y las descargas.</p></div></aside>';
  }
  function filterOptions(d, R) {
    var k = keyerDe(d), opts = R.opciones[d.kind].slice(), known = {};
    opts.forEach(function (o) { known[o.key] = true; });
    filtros()[d.id].forEach(function (lab) { var kk = k(lab); if (!known[kk]) { opts.push({ label: d.kind === 'grupos' ? E.grpLabel(lab) : lab, key: kk, sgu: 0, total: 0 }); known[kk] = true; } });
    return opts;
  }
  function filterList(d, R) {
    var st = S.openFilter, q = E.norm(st.q || ''), opts = filterOptions(d, R), html = '';
    opts.forEach(function (o, i) {
      var on = st.picked.indexOf(o.key) >= 0;
      if (q && E.norm(o.label).indexOf(q) < 0) return;
      if (st.onlySgu && !o.sgu && !on) return;
      html += '<label class="fopt"><input type="checkbox" data-i="' + i + '"' + (on ? ' checked' : '') + '><span>' + esc(o.label) + '</span><em title="tickets SGU / total">' + o.sgu + ' · ' + num(o.total) + '</em></label>';
    });
    return '<div class="flist"><input class="input" type="search" placeholder="Buscar…" value="' + esc(st.q || '') + '" data-role="q" aria-label="Buscar">' +
      '<div class="tools"><label><input type="checkbox" data-role="sgu"' + (st.onlySgu ? ' checked' : '') + '> Solo con SGU</label><span style="flex:1"></span><button type="button" data-role="all">Todas</button><button type="button" data-role="none">Ninguna</button><button type="button" data-role="orig">Originales</button></div>' +
      '<div class="opts">' + (html || '<p class="hint">Sin resultados.</p>') + '</div><p class="hint">' + st.picked.length + ' seleccionadas · ' + esc(d.note) + '</p>' +
      '<div class="apply"><button type="button" class="btn sm" data-role="cancel">Cancelar</button><button type="button" class="btn sm primary" data-role="apply">Aplicar</button></div></div>';
  }

  function renderInforme() {
    var R = S.R;
    shell('informe', ctxSelector(), R ? '<div class="report"><div class="report-main"><div class="report-bar"><h1>Informe · ' + esc(R.periodoTxt.replace('(', R.anio + ' (')) + '</h1><span class="spacer"></span>' +
      '<button class="btn" id="xPdf">' + ICONS.down + 'Informe PDF</button><button class="btn" id="xXls">' + ICONS.down + 'Informe Excel</button></div>' +
      '<div class="canvas" id="canvas">' + paginaInforme(S.tab, R, S.cmp || 0) + '</div>' +
      '<div class="tabs" role="tablist">' + PAGINAS.map(function (p, i) { return '<button type="button" role="tab" data-t="' + i + '" aria-selected="' + (i === S.tab) + '">' + esc(p) + (i === 8 && controlesAlerta(R) ? ' <span class="dot" title="Hay elementos para revisar"></span>' : '') + '</button>'; }).join('') + '</div></div>' +
      filterPane(R) + '</div>' : sinCarga('el informe'));
    bindCtx();
    if (!R) return;
    Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (b) { b.addEventListener('click', function () { S.tab = +b.getAttribute('data-t'); renderInforme(); }); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-cmp]'), function (b) { b.addEventListener('click', function () { S.cmp = +b.getAttribute('data-cmp'); renderInforme(); }); });
    document.getElementById('xXls').addEventListener('click', exportExcel);
    document.getElementById('xPdf').addEventListener('click', exportInformePdf);
    bindFilterPane(renderInforme);
    var canvas = document.getElementById('canvas');
    canvas.addEventListener('click', function (ev) { var el = ev.target.closest('[data-x]'); if (el && !ev.target.closest('button')) menuLogica(ev, el); });
    canvas.addEventListener('keydown', function (ev) { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[data-x]')) { ev.preventDefault(); var r = ev.target.getBoundingClientRect(); menuLogica({ clientX: r.left + 10, clientY: r.bottom }, ev.target); } });
  }

  /* ================= "Ver lógica del cálculo" ================= */
  function cerrarMenu() { var m = document.querySelector('.xmenu'); if (m) m.remove(); document.removeEventListener('mousedown', fueraMenu, true); }
  function fueraMenu(e) { if (!e.target.closest('.xmenu')) cerrarMenu(); }
  function menuLogica(ev, el) {
    cerrarMenu();
    var x; try { x = JSON.parse(el.getAttribute('data-x')); } catch (e) { return; }
    var m = document.createElement('div');
    m.className = 'xmenu'; m.setAttribute('role', 'menu');
    m.innerHTML = '<button type="button" role="menuitem">' + ICONS.filter.replace(/M2 3h12l-4.6 5.4V13L6.6 14V8.4z/, 'M3 2.5h7l3 3v8H3zM5.5 8h5M5.5 10.5h5') + 'Ver lógica del cálculo</button>';
    document.body.appendChild(m);
    var w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.min(ev.clientX, window.innerWidth - w - 12) + 'px';
    m.style.top = Math.min(ev.clientY + 6, window.innerHeight - h - 12) + 'px';
    var b = m.querySelector('button');
    b.addEventListener('click', function () { cerrarMenu(); abrirLogica(x, el); });
    b.focus();
    m.addEventListener('keydown', function (e) { if (e.key === 'Escape') { cerrarMenu(); el.focus(); } });
    setTimeout(function () { document.addEventListener('mousedown', fueraMenu, true); }, 0);
  }
  function abrirLogica(x, origen) {
    var e;
    try { e = S.R.explicar(x); } catch (err) { toast('No se pudo explicar este valor: ' + err.message, true); return; }
    var R = S.R, ov = document.createElement('div');
    ov.className = 'logic'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    var regs = (e.registros || []).filter(Boolean);
    var tablaReg = function (r, i) {
      var max = 200, filas = r.filas.slice(0, max);
      return '<details' + (i === 0 ? ' open' : '') + '><summary>' + esc(r.titulo) + ' · <b>' + num(r.filas.length) + '</b> registros</summary>' +
        (r.filas.length ? '<div class="tbl"><table class="data list"><thead><tr>' + r.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          filas.map(function (f) { return '<tr>' + f.map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
          (r.filas.length > max ? '<p class="hint">Se muestran ' + max + ' de ' + num(r.filas.length) + '. La descarga trae todos.</p>' : '') : '<p class="hint">No hay registros.</p>') + '</details>';
    };
    ov.innerHTML = '<div class="logic-card"><div class="logic-h"><div><div class="lbl">Lógica del cálculo</div><h2>' + esc(e.titulo) + '</h2><div class="logic-v">' + esc(e.valor) + '</div></div><button type="button" class="btn sm" data-r="close">Cerrar</button></div>' +
      '<div class="logic-b">' +
      (e.definicion ? '<section><h3>Qué mide</h3><p>' + esc(e.definicion) + '</p></section>' : '') +
      (e.filtros.length ? '<section><h3>Datos y filtros que se aplican</h3><ul>' + e.filtros.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></section>' : '') +
      (e.pasos.length ? '<section><h3>Cálculo paso a paso</h3><ol>' + e.pasos.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ol></section>' : '') +
      (regs.length ? '<section><h3>Registros usados</h3><p class="hint">Con esta lista cualquier persona puede repetir el cálculo en los archivos originales.</p>' + regs.map(tablaReg).join('') + '</section>' : '') +
      '<p class="hint">Carga: corte ' + esc(R.corteTxt) + ' · período ' + esc(R.periodoTxt) + ' · ' + esc(R.fuentesTxt) + '.</p></div>' +
      '<div class="logic-f">' + (regs.length ? '<button type="button" class="btn primary" data-r="xls">' + ICONS.down + 'Descargar explicación y registros (Excel)</button>' : '') + '<button type="button" class="btn" data-r="close">Cerrar</button></div></div>';
    document.body.appendChild(ov);
    var cerrar = function () { document.removeEventListener('keydown', tecla); ov.remove(); if (origen && origen.focus) origen.focus(); };
    var tecla = function (k) { if (k.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    ov.addEventListener('click', function (k) { if (k.target === ov) cerrar(); });
    Array.prototype.forEach.call(ov.querySelectorAll('[data-r="close"]'), function (b) { b.addEventListener('click', cerrar); });
    var xb = ov.querySelector('[data-r="xls"]');
    if (xb) xb.addEventListener('click', function () {
      var wb = XLSX.utils.book_new();
      var ex = [['Lógica del cálculo'], ['Indicador', e.titulo], ['Valor', e.valor], ['Carga', 'Corte ' + R.corteTxt + ' · ' + R.periodoTxt], [], ['Qué mide'], [e.definicion], [], ['Datos y filtros']].concat(e.filtros.map(function (f) { return [f]; })).concat([[], ['Cálculo paso a paso']]).concat(e.pasos.map(function (f, i) { return [(i + 1) + '. ' + f]; }));
      var ws = XLSX.utils.aoa_to_sheet(ex); ws['!cols'] = [{ wch: 120 }, { wch: 40 }]; XLSX.utils.book_append_sheet(wb, ws, 'Explicación');
      regs.forEach(function (r, i) { var w = XLSX.utils.aoa_to_sheet([r.cols].concat(r.filas)); XLSX.utils.book_append_sheet(wb, w, (i + 1 + '. ' + r.titulo).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31)); });
      var buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Logica - ' + e.titulo.replace(/[\\\/:*?"<>|]/g, ' ').slice(0, 80) + '.xlsx');
    });
    ov.querySelector('[data-r="close"]').focus();
  }
  function controlesAlerta(R) { var K = R.controles; return K.posiblesDuplicados.length || K.nombres.length || K.piaFueraSGU.length || K.planIndefinido.length || !K.totales.every(function (x) { return x.ok; }); }

  function bindFilterPane(rerender) {
    var R = S.R, tog = document.getElementById('fToggle');
    tog.addEventListener('click', function () { S.fpaneOpen = !S.fpaneOpen; rerender(); });
    Array.prototype.forEach.call(document.querySelectorAll('.fcard'), function (cardEl) {
      var id = cardEl.getAttribute('data-f'), d = FILTROS.filter(function (x) { return x.id === id; })[0];
      var k = keyerDe(d);
      cardEl.querySelector('.fhead').addEventListener('click', function () {
        S.openFilter = S.openFilter && S.openFilter.id === id ? null : { id: id, q: '', onlySgu: !d.invert, picked: marcadas(d, R, filtros()[id]) };
        rerender();
      });
      var list = cardEl.querySelector('.flist');
      if (!list) return;
      var st = S.openFilter, opts = filterOptions(d, R);
      var redraw = function () { var y = list.querySelector('.opts').scrollTop; rerender(); var nl = document.querySelector('.fcard[data-f="' + id + '"] .opts'); if (nl) nl.scrollTop = y; };
      var q = list.querySelector('[data-role="q"]');
      q.addEventListener('input', function () { st.q = q.value; var pos = q.selectionStart; redraw(); var nq = document.querySelector('.fcard[data-f="' + id + '"] [data-role="q"]'); if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); } });
      list.querySelector('[data-role="sgu"]').addEventListener('change', function (e) { st.onlySgu = e.target.checked; redraw(); });
      var visibles = function () { return Array.prototype.map.call(list.querySelectorAll('.opts input[data-i]'), function (c) { return opts[+c.getAttribute('data-i')].key; }); };
      list.querySelector('[data-role="all"]').addEventListener('click', function () { visibles().forEach(function (key) { if (st.picked.indexOf(key) < 0) st.picked.push(key); }); redraw(); });
      list.querySelector('[data-role="none"]').addEventListener('click', function () { var v = visibles(); st.picked = st.picked.filter(function (key) { return v.indexOf(key) < 0; }); redraw(); });
      list.querySelector('[data-role="orig"]').addEventListener('click', function () { st.picked = marcadas(d, R, defaultsFiltros()[id]); redraw(); });
      list.querySelector('.opts').addEventListener('change', function (e) {
        var i = e.target.getAttribute('data-i'); if (i === null) return;
        var key = opts[+i].key, at = st.picked.indexOf(key);
        if (e.target.checked && at < 0) st.picked.push(key); else if (!e.target.checked && at >= 0) st.picked.splice(at, 1);
        var hint = list.querySelector('.flist > .hint'); if (hint) hint.textContent = st.picked.length + ' seleccionadas · ' + d.note;
      });
      list.querySelector('[data-role="cancel"]').addEventListener('click', function () { S.openFilter = null; rerender(); });
      list.querySelector('[data-role="apply"]').addEventListener('click', function () {
        S.filtros = Object.assign(filtros(), {});
        if (d.invert) {
          S.filtros[id] = opts.filter(function (o) { return st.picked.indexOf(o.key) < 0; }).map(function (o) { return o.label; });
        } else {
          var prev = filtros()[id].filter(function (lab) { return st.picked.indexOf(k(lab)) >= 0; }), prevK = prev.map(k);
          var added = opts.filter(function (o) { return st.picked.indexOf(o.key) >= 0 && prevK.indexOf(o.key) < 0; }).map(function (o) { return o.label; });
          S.filtros[id] = prev.concat(added).map(function (lab) { return d.kind === 'grupos' ? E.grpLabel(lab) : lab; }).filter(function (lab, i, a) { return a.map(k).indexOf(k(lab)) === i; });
        }
        S.openFilter = null;
        calcular(); rerender(); guardarFiltros(); toast('Filtro aplicado para todos los usuarios.');
      });
    });
  }

  function baseName() { var R = S.R; return 'Gestion SGU VS PAIS - ' + String(R.periodo).toUpperCase() + ' ' + R.corteFecha.replace(/\//g, '-'); }

  function exportExcel() {
    var R = S.R, G = R.g, F = R.fijos, L = R.etiquetas, LL = R.etiquetasLargas, wb = XLSX.utils.book_new();
    function add(name, aoa, widths) { var ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = (widths || []).map(function (w) { return { wch: w }; }); XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); }
    var segs = GS.map(function (g) { return LL[g]; });
    var ind = [['Reporte PIA · SGU vs País'], ['Responsable', R.responsable || ''], ['Período', R.periodoTxt + ' ' + R.anio], ['Fecha de corte', R.corteTxt], ['Fuentes', R.fuentesTxt], ['Semana', R.ventana.desde + ' al ' + R.ventana.hasta], [],
      ['Indicadores fijos (PIA)', 'Valor', 'Detalle'],
      ['Índice de resolución PIA', F.ir.pct, '(' + F.ir.fcr + ' en 1er contacto + ' + F.ir.escResueltos + ' escalados con solución en GLPI) de ' + F.ir.den + ' casos'],
      ['Resolución en 1er contacto (FCR)', F.fcr.pct, F.fcr.n + ' de ' + F.fcr.den + ' casos tipificados'],
      ['Productividad del punto PIA', F.productividad.casos, F.productividad.abonados + ' abonados (cédulas distintas) · ' + F.productividad.duplicados + ' duplicados excluidos de ' + F.productividad.bruto + ' filas'],
      ['Consultas de estatus', F.estatus, 'Subcategoría "Estatus de un ticket de reporte" sin FCR'],
      ['Satisfacción / NPS', F.nps || '', ''], [],
      ['Indicador'].concat(segs)];
    var fila = function (lab, f) { ind.push([lab].concat(GS.map(f))); };
    fila('Creados', function (g) { return G[g].creados; });
    fila('Solucionados', function (g) { return G[g].solucionados; });
    fila('% solucionado', function (g) { return G[g].pctSol; });
    fila('Tiempo promedio de resolución', function (g) { return E.fmtD(G[g].prom); });
    fila('Moda (redondeada a la hora)', function (g) { return G[g].moda === null ? '-' : E.fmtD(G[g].moda); });
    fila('Abiertos en la semana', function (g) { return G[g].semana.abiertos; });
    fila('Cerrados en la misma semana', function (g) { return G[g].semana.cerradosMisma; });
    fila('% cerrados en la misma semana', function (g) { return G[g].semana.pct; });
    fila('Resueltos el mismo día (semana)', function (g) { return G[g].gestion.mismoDia; });
    fila('% resueltos el mismo día', function (g) { return G[g].gestion.pct; });
    fila('Reincidencia FTTH: abonados', function (g) { return G[g].reinc.abonados; });
    fila('Reincidencia FTTH: tickets', function (g) { return G[g].reinc.tickets; });
    fila('Tickets FTTH', function (g) { return G[g].reinc.ftth; });
    fila('Upgrades', function (g) { return G[g].upgrades.n; });
    fila('SVA', function (g) { return G[g].sva.n; });
    ind.push([], ['Comparativo', 'Diferencia', 'A favor de', 'Detalle']);
    Object.keys(R.comparativos).forEach(function (k) { var c = R.comparativos[k]; ind.push([L[c.a] + ' vs. ' + L[c.b], c.valor, c.ganador ? L[c.ganador] : '', c.detalle]); });
    add('Indicadores', ind, [40, 22, 22, 22, 22]);
    function tiempoSheet(name, first, list) {
      var aoa = [[first].concat(GS.reduce(function (a, g) { return a.concat([LL[g] + ' · resueltos', LL[g] + ' · moda o promedio', LL[g] + ' · promedio', LL[g] + ' · moda']); }, []))];
      list.forEach(function (r) { aoa.push([r.label].concat(GS.reduce(function (a, g) { return a.concat([r[g].n, r[g].texto, r[g].n ? E.fmtD(r[g].prom) : '-', r[g].moda === null || r[g].moda === undefined ? '-' : E.fmtD(r[g].moda)]); }, []))); });
      add(name, aoa, [55]);
    }
    tiempoSheet('5.1 Tiempo por categoría', 'Categoría', R.tiempoCategoria);
    tiempoSheet('5.2 Grupo técnico', 'Grupo técnico', R.tiempoGrupo);
    var pa = [['Categoría'].concat(GS.reduce(function (a, g) { return a.concat([LL[g] + ' · creados', LL[g] + ' · solucionados']); }, []))];
    R.productividad.forEach(function (r) { pa.push([r.label].concat(GS.reduce(function (a, g) { return a.concat([r[g].creados, r[g].solucionados]); }, []))); });
    add('5.3 Productividad', pa, [50]);
    var ja = [['Día', 'Fecha']];
    GS.forEach(function (g) { ja[0].push(LL[g] + ' · abiertos', 'pendientes', 'resueltos', 'pend. acum.', 'resuelto acum.', '% jornada'); });
    for (var i = 0; i < G.sgu.jornada.filas.length; i++) { var r = [G.sgu.jornada.filas[i].dia, G.sgu.jornada.filas[i].fecha]; GS.forEach(function (g) { var f = G[g].jornada.filas[i]; r.push(f.abiertos, f.pendientes, f.resueltos, f.pendAcc, f.resAcc, f.pct); }); ja.push(r); }
    var tr = ['Total semanal', '']; GS.forEach(function (g) { var t = G[g].jornada.total; tr.push(t.abiertos, t.pendientes, t.resueltos, t.pendAcc, t.resAcc, t.pct); }); ja.push(tr);
    add('5.4 Semana', ja, [12, 12]);
    var md = [['Día', 'Fecha']];
    GS.forEach(function (g) { md[0].push(LL[g] + ' · abiertos', 'pendientes', 'resueltos mismo día', '% jornada'); });
    for (var j = 0; j < G.sgu.jornada.filas.length; j++) { var r2 = [G.sgu.jornada.filas[j].dia, G.sgu.jornada.filas[j].fecha]; GS.forEach(function (g) { var f = G[g].jornada.filas[j]; r2.push(f.abiertos, f.pendientes, f.mismoDia, f.pct); }); md.push(r2); }
    var tr2 = ['Total semanal', '']; GS.forEach(function (g) { var t = G[g].jornada.total; tr2.push(t.abiertos, t.pendientes, t.mismoDia, t.pct); }); md.push(tr2);
    add('5.5 Mismo día', md, [12, 12]);
    add('5.6 Gestión semanal', [['Grupo', 'Abiertos', 'Resueltos', 'Cerrados', 'Resueltos mismo día', '% jornada']].concat(GS.map(function (g) { var x = G[g].gestion; return [L[g], x.abiertos, x.resueltos, x.cerrados, x.mismoDia, x.pct]; })), [22, 12, 12, 12, 18, 12]);
    var ra = [['Cliente', 'Cuenta', 'Categorías', 'Ticket', 'Categoría del ticket', 'Estado', 'Creado por el PIA', 'Tickets de la cuenta']];
    R.reincidencia.detalle.forEach(function (d) { d.tickets.forEach(function (t) { ra.push([d.nombre, d.cuenta, d.categorias.join(' · '), t.id, t.cat, t.estado, t.pia ? 'Sí' : 'No', d.tickets.length]); }); });
    add('5.7 Reincidencias', ra, [38, 10, 40, 12, 40, 14, 10, 10]);
    var up = [['Grupo', 'Upgrades', 'Tickets GLPI con aumento', 'Aumentos en Tipificador', 'Repetidos', 'SVA', 'SVA en GLPI', 'SVA en Tipificador', 'Cambios de plan GLPI', 'A plan menor o revertidos']];
    GS.forEach(function (g) { var u = G[g].upgrades, v = G[g].sva; up.push([L[g], u.n, u.glpi.join(', '), u.tip, u.repetidos, v.n, v.glpi.join(', '), v.tip, u.cambiosPlan, u.bajas]); });
    add('Upgrades y SVA', up, [22, 10, 50, 12, 10, 8, 30, 12, 12, 14]);
    var K = R.controles, ca = [['Control', 'Resultado', 'Ticket / cuenta', 'Detalle']];
    ca.push(['1. Tipificador fuera de período', K.tipFuera.n + ' filas descartadas (' + K.tipFuera.sa + ' de ' + R.cfg.sucursal + ')', '', '']);
    ca.push(['2. Categorías homologadas', K.homologadas.length + ' tickets', '', '']); K.homologadas.forEach(function (x) { ca.push(['', '', x.id, x.de + ' → ' + x.a]); });
    ca.push(['3. Posibles duplicados (SGU)', K.posiblesDuplicados.length + ' pares', '', '']); K.posiblesDuplicados.forEach(function (x) { ca.push(['', '', x.ids.join(' y '), 'Cuenta ' + x.cuenta + ' · ' + x.cat + ' · ' + x.minutos + ' min']); });
    ca.push(['4. Nombres inconsistentes (SGU)', K.nombres.length + ' casos', '', '']); K.nombres.forEach(function (x) { ca.push(['', x.tipo, x.id || ('Cuenta ' + x.cuenta), x.titulo + (x.campo ? ' / ' + x.campo : '')]); });
    ca.push(['5. Tickets SGU sin cuenta', K.sinCuenta.length + ' tickets', '', '']); K.sinCuenta.forEach(function (x) { ca.push(['', '', x.id, x.titulo]); });
    ca.push(['6. Tickets del PIA fuera de SGU', K.piaFueraSGU.length + ' tickets', '', '']); K.piaFueraSGU.forEach(function (x) { ca.push(['', '', x.id, x.titulo]); });
    ca.push(['7. Cambios de plan sin dirección clara', K.planIndefinido.length + ' tickets', '', '']); K.planIndefinido.forEach(function (x) { ca.push(['', x.grupo, x.id, x.extracto]); });
    ca.push(['8. Totales entre tablas', K.totales.every(function (x) { return x.ok; }) ? 'Coinciden' : 'Revisar', '', '']); K.totales.forEach(function (x) { ca.push(['', x.ok ? 'Coincide' : 'Revisar', x.grupo, 'Creados ' + x.creados + ' / solucionados ' + x.solucionados + ' · 5.1 ' + x.t51 + ' · 5.2 ' + x.t52 + ' · 5.3 ' + x.t53c + '/' + x.t53s]); });
    if (K.reversiones.length) { ca.push(['Cambios de plan revertidos (no cuentan)', K.reversiones.length + ' tickets', '', '']); K.reversiones.forEach(function (x) { ca.push(['', '', x.id, x.extracto]); }); }
    add('Controles', ca, [38, 30, 18, 90]);
    var buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Informe ' + baseName() + '.xlsx');
  }

  function exportInformePdf() {
    var R = S.R;
    busy('Preparando el PDF del informe…');
    pdfLibs().then(function () {
      var jsPDF = window.jspdf.jsPDF, doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      var PW = 297, PH = 210, M = 10, host = document.createElement('div');
      host.className = 'offscreen'; host.style.width = '1240px'; host.style.background = '#f3f2f1'; host.style.padding = '16px';
      document.body.appendChild(host);
      var trabajos = [];
      CMPS.forEach(function (c, k) { trabajos.push([0, k]); });
      for (var p = 1; p < PAGINAS.length; p++) trabajos.push([p, 0]);
      var first = true, chain = Promise.resolve();
      S.pdfMode = true;
      trabajos.forEach(function (w, i) {
        chain = chain.then(function () {
          busy('Preparando el PDF del informe… página ' + (i + 1) + ' de ' + trabajos.length);
          host.innerHTML = paginaInforme(w[0], R, w[1]);
          return window.html2canvas(host, { scale: 1.6, backgroundColor: '#f3f2f1', logging: false });
        }).then(function (cv) {
          var w = PW - 2 * M, ratio = w / cv.width, pageHpx = (PH - 2 * M) / ratio;
          for (var y = 0; y < cv.height; y += pageHpx) {
            var h = Math.min(pageHpx, cv.height - y), part = document.createElement('canvas');
            part.width = cv.width; part.height = h;
            part.getContext('2d').drawImage(cv, 0, y, cv.width, h, 0, 0, cv.width, h);
            if (!first) doc.addPage(); first = false;
            doc.setFillColor(243, 242, 241); doc.rect(0, 0, PW, PH, 'F');
            doc.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', M, M, w, h * ratio);
          }
        });
      });
      return chain.then(function () { host.remove(); doc.save('Informe ' + baseName() + '.pdf'); });
    }).catch(function (e) { toast('No se pudo crear el PDF: ' + e.message, true); }).finally(function () { S.pdfMode = false; busy(); });
  }

  /* ================= presentación (estilo PowerPoint) ================= */
  var DECKS = [['pia', 'PIA vs. SGU', 'PIA VS SGU'], ['sgu', 'SGU vs. País', 'SGU VS PAIS']];
  function deckTipo() { return S.deck === 'sgu' ? 'sgu' : 'pia'; }
  function deckName() { var R = S.R, d = DECKS.filter(function (x) { return x[0] === deckTipo(); })[0]; return 'Gestion ' + d[2] + ' - ' + String(R.periodo).toUpperCase() + ' ' + R.corteFecha.replace(/\//g, '-'); }
  function buildHtmlDeck() { return D.build(H.HtmlDeck, S.R, S.assets, E, deckTipo()); }
  function fit(stageEl, box) { var sc = box.clientWidth / H.WIDTH; stageEl.style.transform = 'scale(' + sc + ')'; }
  function renderDeck() {
    var R = S.R;
    if (!R) { shell('presentacion', ctxSelector(), sinCarga('la presentación')); bindCtx(); return; }
    var deck = buildHtmlDeck(), n = deck.slides.length;
    if (S.slide >= n) S.slide = n - 1;
    shell('presentacion', ctxSelector(), '<div class="deck"><div class="deck-bar"><div class="seg" role="group" aria-label="Presentación">' + DECKS.map(function (d) { return '<button type="button" data-deck="' + d[0] + '" aria-pressed="' + (deckTipo() === d[0]) + '">' + d[1] + '</button>'; }).join('') + '</div><b>' + esc(R.periodoTxt.replace('(', R.anio + ' (')) + '</b><span class="hint">' + n + ' diapositivas</span><span class="spacer"></span>' +
      '<button class="btn" id="pShow">' + ICONS.play + 'Presentar</button><button class="btn" id="pPptx">' + ICONS.down + 'PowerPoint</button><button class="btn" id="pPdf">' + ICONS.down + 'PDF</button></div>' +
      '<div class="thumbs" id="thumbs"></div><div class="stage-wrap"><div style="width:100%;max-width:1180px"><div class="stage" id="stage"></div><div class="stage-nav"><button class="btn sm" id="pPrev">‹ Anterior</button><span id="pNum"></span><button class="btn sm" id="pNext">Siguiente ›</button></div>' +
      '<p class="hint" style="text-align:center">Use los filtros del Informe para elegir las categorías y grupos que aparecen aquí.</p></div></div></div>');
    bindCtx();
    Array.prototype.forEach.call(document.querySelectorAll('[data-deck]'), function (b) { b.addEventListener('click', function () { if (S.deck !== b.getAttribute('data-deck')) { S.deck = b.getAttribute('data-deck'); S.slide = 0; renderDeck(); } }); });
    var thumbs = document.getElementById('thumbs'), stage = document.getElementById('stage');
    deck.slides.forEach(function (s, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'thumb'; b.setAttribute('aria-label', 'Diapositiva ' + (i + 1));
      b.innerHTML = '<b>' + (i + 1) + '</b><div class="frame"></div>';
      thumbs.appendChild(b);
      var fr = b.querySelector('.frame'), st = H.renderSlide(s, fr);
      requestAnimationFrame(function () { fit(st, fr); });
      b.addEventListener('click', function () { S.slide = i; show(); });
    });
    function show() {
      stage.innerHTML = '';
      var st = H.renderSlide(deck.slides[S.slide], stage); fit(st, stage);
      document.getElementById('pNum').textContent = 'Diapositiva ' + (S.slide + 1) + ' de ' + n;
      Array.prototype.forEach.call(thumbs.children, function (t, i) { t.setAttribute('aria-current', i === S.slide ? 'true' : 'false'); });
      var cur = thumbs.children[S.slide]; if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    show();
    var onResize = function () { var st = stage.querySelector('.slide-stage'); if (st) fit(st, stage); Array.prototype.forEach.call(thumbs.querySelectorAll('.frame'), function (fr) { var s2 = fr.querySelector('.slide-stage'); if (s2) fit(s2, fr); }); };
    window.onresize = onResize;
    document.getElementById('pPrev').addEventListener('click', function () { if (S.slide > 0) { S.slide--; show(); } });
    document.getElementById('pNext').addEventListener('click', function () { if (S.slide < n - 1) { S.slide++; show(); } });
    document.onkeydown = function (e) {
      if (ruta() !== 'presentacion' || document.querySelector('.show') || /input|select|textarea/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { if (S.slide < n - 1) { S.slide++; show(); } }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { if (S.slide > 0) { S.slide--; show(); } }
    };
    document.getElementById('pShow').addEventListener('click', function () { presentar(deck, show); });
    document.getElementById('pPptx').addEventListener('click', exportPptx);
    document.getElementById('pPdf').addEventListener('click', function () { exportDeckPdf(deck); });
  }

  function presentar(deck, after) {
    var n = deck.slides.length, ov = document.createElement('div');
    ov.className = 'show'; ov.tabIndex = -1;
    ov.innerHTML = '<div class="box"></div><div class="hud"><span></span><button type="button" data-x="prev">‹</button><button type="button" data-x="next">›</button><button type="button" data-x="exit">Salir (Esc)</button></div>';
    document.body.appendChild(ov);
    var box = ov.querySelector('.box');
    function draw() {
      var sc = Math.min(window.innerWidth / H.WIDTH, window.innerHeight / H.HEIGHT);
      box.style.width = H.WIDTH * sc + 'px'; box.style.height = H.HEIGHT * sc + 'px';
      box.innerHTML = ''; var st = H.renderSlide(deck.slides[S.slide], box); st.style.transform = 'scale(' + sc + ')';
      ov.querySelector('.hud span').textContent = (S.slide + 1) + ' / ' + n;
    }
    function close() { document.removeEventListener('keydown', key); window.removeEventListener('resize', draw); if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); ov.remove(); after(); }
    function key(e) {
      if (e.key === 'Escape') return close();
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].indexOf(e.key) >= 0) { e.preventDefault(); if (S.slide < n - 1) { S.slide++; draw(); } }
      if (['ArrowLeft', 'PageUp', 'Backspace'].indexOf(e.key) >= 0) { e.preventDefault(); if (S.slide > 0) { S.slide--; draw(); } }
    }
    ov.addEventListener('click', function (e) {
      var x = e.target.getAttribute && e.target.getAttribute('data-x');
      if (x === 'exit') return close();
      if (x === 'prev') { if (S.slide > 0) { S.slide--; draw(); } return; }
      if (S.slide < n - 1) { S.slide++; draw(); }
    });
    document.addEventListener('keydown', key);
    window.addEventListener('resize', draw);
    document.addEventListener('fullscreenchange', function fc() { if (!document.fullscreenElement) { document.removeEventListener('fullscreenchange', fc); } setTimeout(draw, 50); });
    if (ov.requestFullscreen) ov.requestFullscreen().catch(function () {});
    draw(); ov.focus();
  }

  function exportPptx() {
    busy('Generando PowerPoint…');
    try {
      D.build(window.PptxGenJS, S.R, S.assets, E, deckTipo()).writeFile({ fileName: deckName() + '.pptx' })
        .then(function () { busy(); }, function (e) { busy(); toast('No se pudo generar el PowerPoint: ' + e.message, true); });
    } catch (e) { busy(); toast('No se pudo generar el PowerPoint: ' + e.message, true); }
  }
  function exportDeckPdf(deck) {
    busy('Preparando el PDF de la presentación…');
    pdfLibs().then(function () {
      var jsPDF = window.jspdf.jsPDF, doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: [13.333, 7.5] });
      var host = document.createElement('div'); host.className = 'offscreen'; document.body.appendChild(host);
      var chain = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      deck.slides.forEach(function (s, i) {
        chain = chain.then(function () {
          busy('Preparando el PDF… diapositiva ' + (i + 1) + ' de ' + deck.slides.length);
          host.innerHTML = '';
          var st = H.renderSlide(s, host);
          return new Promise(function (ok) { var img = st.querySelector('img'); if (!img || img.complete) ok(); else { img.onload = ok; img.onerror = ok; } })
            .then(function () { return window.html2canvas(st, { scale: 1.5, backgroundColor: '#ffffff', logging: false, width: 1334, height: 750 }); });
        }).then(function (cv) {
          if (i > 0) doc.addPage([13.333, 7.5], 'landscape');
          doc.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 13.333, 7.5);
        });
      });
      return chain.then(function () { host.remove(); doc.save(deckName() + '.pdf'); });
    }).catch(function (e) { toast('No se pudo crear el PDF: ' + e.message, true); }).finally(function () { busy(); });
  }

  /* ================= administración ================= */
  function renderAdmin() {
    shell('admin', '', '<div class="page"><div class="page-h"><div><h1>Administración</h1><p>Contraseña de acceso, correos autorizados y parámetros de cálculo. Solo los administradores ven esta sección.</p></div></div><div id="adm"><p class="hint">Cargando…</p></div></div>');
    api('GET', 'admin').then(function (j) {
      var f = filtros();
      var users = j.usuarios.map(function (u) {
        var yo = u.email === S.yo.email;
        return '<tr data-e="' + esc(u.email) + '"><td><b>' + esc(u.email) + '</b>' + (yo ? ' <span class="pill">Usted</span>' : '') + '</td>' +
          '<td><select class="input" data-a="admin" aria-label="Rol"' + (yo ? ' disabled' : '') + '><option value="0"' + (u.admin ? '' : ' selected') + '>Usuario</option><option value="1"' + (u.admin ? ' selected' : '') + '>Administrador</option></select></td>' +
          '<td><span class="pill ' + (u.activo ? 'on' : 'off') + '">' + (u.activo ? 'Activo' : 'Suspendido') + '</span></td>' +
          '<td class="hint">' + (u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : 'Nunca') + '</td>' +
          '<td><div class="row" style="flex-wrap:nowrap">' + (yo ? '' : '<button class="btn sm" data-a="activo">' + (u.activo ? 'Suspender' : 'Reactivar') + '</button><button class="btn sm danger" data-a="borrar">Quitar acceso</button>') + '</div></td></tr>';
      }).join('');
      document.getElementById('adm').innerHTML =
        '<div class="two"><section class="panel"><h2>Contraseña de acceso</h2><p class="hint">Es la misma para todos los correos autorizados.</p>' +
        '<div class="secret"><code id="pwShown">••••••••••</code><button class="btn sm" id="pwEye">Mostrar</button><button class="btn sm" id="pwCopy">Copiar</button></div>' +
        '<p class="hint">Último cambio: ' + fechaHora(j.clave_actualizada) + ' por ' + esc(j.clave_actualizada_por || '-') + '</p></section>' +
        '<form class="panel" id="pwForm" novalidate><h2>Cambiar contraseña</h2>' +
        '<div class="field"><label for="pw1">Nueva contraseña</label><div class="pw"><input class="input" id="pw1" type="password" autocomplete="new-password" minlength="8"><button type="button" data-eye="pw1">Mostrar</button></div></div>' +
        '<div class="field"><label for="pw2">Repita la nueva contraseña</label><div class="pw"><input class="input" id="pw2" type="password" autocomplete="new-password"><button type="button" data-eye="pw2">Mostrar</button></div></div>' +
        '<p class="hint">Mínimo 8 caracteres. Al cambiarla se cierran las sesiones abiertas de los demás usuarios; deberán entrar con la nueva.</p>' +
        '<div id="pwMsg" class="msg err" hidden></div><div><button class="btn primary" type="submit">Guardar contraseña</button></div></form></div>' +
        '<section class="panel"><h2>Correos con acceso</h2>' +
        '<form class="row" id="addForm" novalidate><input class="input" id="addEmail" type="email" placeholder="nombre@vnet.com.ve" style="max-width:340px" aria-label="Correo nuevo"><label class="row" style="gap:6px;font-size:13px"><input type="checkbox" id="addAdmin"> Administrador</label><button class="btn primary" type="submit">Agregar correo</button><span id="addMsg" class="hint" role="status"></span></form>' +
        '<div class="tbl"><table class="data list"><thead><tr><th>Correo</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th></th></tr></thead><tbody>' + users + '</tbody></table></div></section>' +
        '<form class="panel" id="parForm" novalidate><h2>Parámetros de cálculo</h2><p class="hint">Replican los criterios de su Excel. Cambie solo si cambia la forma de identificar los casos.</p><div class="grid-form">' +
        '<div class="field"><label for="pSuc">Sucursal en el Tipificador</label><input class="input" id="pSuc" value="' + esc(f.sucursal) + '"></div>' +
        '<div class="field"><label for="pMark">Marca SGU en el título de GLPI</label><input class="input" id="pMark" value="' + esc(f.sguMarker) + '"></div>' +
        '<div class="field"><label for="pPia">Solicitante del PIA en GLPI</label><input class="input" id="pPia" value="' + esc(f.piaSolicitante) + '"></div></div>' +
        '<div class="row"><button class="btn primary" type="submit">Guardar parámetros</button><button class="btn" type="button" id="parReset">Restaurar filtros y parámetros originales</button></div></form>';

      var shown = false;
      document.getElementById('pwEye').addEventListener('click', function (e) { shown = !shown; document.getElementById('pwShown').textContent = shown ? j.clave : '••••••••••'; e.target.textContent = shown ? 'Ocultar' : 'Mostrar'; });
      document.getElementById('pwCopy').addEventListener('click', function () {
        var p = navigator.clipboard ? navigator.clipboard.writeText(j.clave) : Promise.reject();
        p.then(function () { toast('Contraseña copiada.'); }, function () { shown = true; document.getElementById('pwShown').textContent = j.clave; var r = document.createRange(); r.selectNodeContents(document.getElementById('pwShown')); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); toast('Seleccionada: copie con Ctrl+C.'); });
      });
      Array.prototype.forEach.call(document.querySelectorAll('[data-eye]'), function (b) { b.addEventListener('click', function () { var i = document.getElementById(b.getAttribute('data-eye')); var on = i.type === 'password'; i.type = on ? 'text' : 'password'; b.textContent = on ? 'Ocultar' : 'Mostrar'; }); });
      document.getElementById('pwForm').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var a = document.getElementById('pw1').value, b = document.getElementById('pw2').value, m = document.getElementById('pwMsg');
        m.hidden = true;
        if (a.length < 8) { m.hidden = false; m.textContent = 'La contraseña debe tener al menos 8 caracteres.'; return; }
        if (a !== b) { m.hidden = false; m.textContent = 'Las dos contraseñas no coinciden.'; return; }
        api('PUT', 'admin/clave', { clave: a }).then(function () { toast('Contraseña cambiada. Los demás usuarios deberán entrar con la nueva.'); renderAdmin(); }, function (e) { m.hidden = false; m.textContent = e.message; });
      });
      document.getElementById('addForm').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var e = document.getElementById('addEmail').value.trim(), msg = document.getElementById('addMsg');
        api('POST', 'admin/usuarios', { email: e, admin: document.getElementById('addAdmin').checked }).then(function () { toast('Correo agregado: ' + e); renderAdmin(); }, function (er) { msg.textContent = er.message; msg.style.color = 'var(--bad)'; });
      });
      Array.prototype.forEach.call(document.querySelectorAll('tr[data-e]'), function (tr) {
        var email = tr.getAttribute('data-e'), path = 'admin/usuarios/' + encodeURIComponent(email);
        var sel = tr.querySelector('select[data-a="admin"]');
        if (sel) sel.addEventListener('change', function () { api('PATCH', path, { admin: sel.value === '1' }).then(function () { toast('Rol actualizado.'); renderAdmin(); }, function (e) { toast(e.message, true); renderAdmin(); }); });
        var act = tr.querySelector('[data-a="activo"]');
        if (act) act.addEventListener('click', function () { var u = j.usuarios.filter(function (x) { return x.email === email; })[0]; api('PATCH', path, { activo: !u.activo }).then(function () { toast(u.activo ? 'Acceso suspendido.' : 'Acceso reactivado.'); renderAdmin(); }, function (e) { toast(e.message, true); }); });
        var del = tr.querySelector('[data-a="borrar"]');
        if (del) del.addEventListener('click', function () {
          if (!del.classList.contains('armed')) { del.classList.add('armed'); del.textContent = 'Confirmar'; setTimeout(function () { if (del.isConnected) { del.classList.remove('armed'); del.textContent = 'Quitar acceso'; } }, 4000); return; }
          api('DELETE', path).then(function () { toast('Acceso quitado a ' + email + '.'); renderAdmin(); }, function (e) { toast(e.message, true); });
        });
      });
      document.getElementById('parForm').addEventListener('submit', function (ev) {
        ev.preventDefault();
        S.filtros = Object.assign(filtros(), { sucursal: document.getElementById('pSuc').value.trim() || E.DEFAULTS.sucursal, sguMarker: document.getElementById('pMark').value.trim() || E.DEFAULTS.sguMarker, piaSolicitante: document.getElementById('pPia').value.trim() || E.DEFAULTS.piaSolicitante });
        calcular(); guardarFiltros().then(function () { toast('Parámetros guardados.'); });
      });
      document.getElementById('parReset').addEventListener('click', function () { S.filtros = defaultsFiltros(); calcular(); guardarFiltros().then(function () { toast('Se restauraron los valores originales.'); renderAdmin(); }); });
    }).catch(function (e) { document.getElementById('adm').innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
  }

  /* ================= arranque ================= */
  function arrancar() {
    busy('Cargando…');
    return Promise.all([
      api('GET', 'filtros').then(function (j) {
        S.filtros = j.filtros;
        // filtros guardados con la versión anterior: los grupos técnicos pasan a la lista unificada
        if (S.filtros && !(S.filtros.version >= 4)) { S.filtros.grupos = E.DEFAULTS.grupos.slice(); if (!(S.filtros.version >= 3)) S.filtros.reincExcluir = E.DEFAULTS.reincExcluir.slice(); S.filtros.version = 4; }
      }),
      cargarLista(),
      S.assets ? null : Promise.all([fileToB64('img/cover.jpg'), fileToB64('img/bg.jpg')]).then(function (a) { S.assets = { cover: 'image/jpeg;base64,' + a[0], bg: 'image/jpeg;base64,' + a[1] }; })
    ]).then(function () {
      var id = null; try { id = localStorage.getItem('pia-activa'); } catch (e) { /* nada */ }
      if (!S.cargas.some(function (c) { return c.id === id; })) id = S.cargas[0] && S.cargas[0].id;
      return id && !S.activa ? activar(id).catch(function () {}) : null;
    }).then(function () { busy(); render(); }, function (e) { busy(); if (S.yo) toast(e.message, true); });
  }
  api('GET', 'yo').then(function (j) { S.yo = j; return arrancar(); }).catch(function () { if (!S.yo) renderLogin(); });
})();
