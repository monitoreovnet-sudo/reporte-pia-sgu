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
    return { categorias: E.DEFAULTS.categorias.slice(), categoriasProd: E.DEFAULTS.categorias.slice(), grupos: E.DEFAULTS.grupos.slice(), fallasCats: E.DEFAULTS.fallasCats.slice(),
      sucursal: E.DEFAULTS.sucursal, sguMarker: E.DEFAULTS.sguMarker, piaSolicitante: E.DEFAULTS.piaSolicitante };
  }
  function filtros() { return Object.assign(defaultsFiltros(), S.filtros || {}); }
  function guardarFiltros() { return api('PUT', 'filtros', { filtros: filtros() }).catch(function (e) { toast('No se guardaron los filtros: ' + e.message, true); }); }
  function calcular() {
    if (!S.activa) { S.R = null; return null; }
    var m = S.activa.meta;
    var R = E.compute(S.activa.glpi, S.activa.tip, Object.assign({}, filtros(), { corte: m.corte, nps: m.nps || '', periodo: m.periodo || null }));
    R.responsable = m.responsable || '';
    S.R = R;
    return R;
  }

  /* ================= datos de una carga ================= */
  function empaquetar(glpi, tip) {
    return JSON.stringify({
      v: 1, dup: glpi.duplicados || 0,
      g: glpi.map(function (r) { return [r.id, r.titulo, r.estado, r.categoria, r.apertura, r.solucion, r.solicitante, r.grupo, r.cliente]; }),
      t: tip.map(function (r) { return [r.sucursal, r.categoria, r.subcategoria, r.estatus]; })
    });
  }
  function desempaquetar(txt) {
    var o = JSON.parse(txt);
    var glpi = o.g.map(function (a) { return { id: a[0], titulo: a[1], estado: a[2], categoria: a[3], apertura: a[4], solucion: a[5], solicitante: a[6], grupo: a[7], cliente: a[8] }; });
    glpi.duplicados = o.dup || 0;
    var tip = o.t.map(function (a) { return { sucursal: a[0], categoria: a[1], subcategoria: a[2], estatus: a[3] }; });
    return { glpi: glpi, tip: tip };
  }
  function activar(id) {
    var meta = S.cargas.filter(function (c) { return c.id === id; })[0];
    if (!meta) return Promise.reject(new Error('Esa carga ya no existe.'));
    try { localStorage.setItem('pia-activa', id); } catch (e) { /* sin almacenamiento */ }
    if (CACHE[id]) { S.activa = { id: id, meta: meta, glpi: CACHE[id].glpi, tip: CACHE[id].tip }; calcular(); return Promise.resolve(); }
    busy('Abriendo la carga…');
    return api('GET', 'cargas/' + id).then(function (j) {
      return gunzip(b64ToU8(j.datos)).then(function (txt) {
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
  function renderRepo() {
    var filas = S.cargas.map(function (c) {
      var r = c.resumen || {}, act = S.activa && S.activa.id === c.id;
      return '<tr data-id="' + c.id + '"><td><b>' + esc(c.periodo || '-') + '</b>' + (act ? ' <span class="pill">Abierta</span>' : '') + '<div class="hint">' + esc(c.glpi_nombre || '') + ' · ' + esc(c.tip_nombre || '') + '</div></td>' +
        '<td class="n">' + esc(corteTxt(c.corte)) + '</td>' +
        '<td class="ed" data-f="responsable">' + esc(c.responsable || '-') + '</td><td class="ed" data-f="nps">' + esc(c.nps || '-') + '</td>' +
        '<td class="n">' + num(r.glpi) + ' / ' + num(r.sgu) + '</td><td class="n">' + num(r.tipSA) + '</td>' +
        '<td>' + esc(c.creado_por) + '<div class="hint">' + fechaHora(c.creado) + '</div></td>' +
        '<td><div class="row" style="flex-wrap:nowrap"><button class="btn sm primary" data-a="informe">Informe</button><button class="btn sm" data-a="presentacion">Presentación</button><button class="btn sm" data-a="editar">Editar</button>' +
        (S.yo.admin ? '<button class="btn sm danger" data-a="borrar">Eliminar</button>' : '') + '</div></td></tr>';
    }).join('');
    var lista = S.cargas.length ? '<div class="tbl"><table class="data list"><thead><tr><th>Período</th><th>Corte</th><th>Responsable</th><th>NPS</th><th>GLPI / SGU</th><th>Tipificados SA</th><th>Subida por</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>'
      : '<div class="empty"><b>Todavía no hay cargas guardadas.</b><span class="muted">Suba la primera con el formulario de arriba. Quedará disponible para todos los usuarios autorizados.</span></div>';
    var now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    shell('repositorio', '', '<div class="page"><div class="page-h"><div><h1>Repositorio</h1><p>Suba la descarga de GLPI y del Tipificador. Los archivos se procesan en su navegador y se guarda una copia comprimida de los datos necesarios para el informe.</p></div></div>' +
      '<form class="panel" id="up" novalidate><h2>Nueva carga</h2><div class="grid-form">' +
      '<div class="field"><label for="fG">Archivo de GLPI</label><div class="drop" id="dG"><input type="file" id="fG" accept=".xlsx,.xls,.xlsm,.csv,.txt,.ods"><strong>Seleccione o arrastre el archivo</strong><small>Excel o CSV exportado de GLPI</small></div></div>' +
      '<div class="field"><label for="fT">Archivo del Tipificador</label><div class="drop" id="dT"><input type="file" id="fT" accept=".xlsx,.xls,.xlsm,.csv,.txt,.ods"><strong>Seleccione o arrastre el archivo</strong><small>Excel o CSV de la lista</small></div></div>' +
      '<div class="field"><label for="fC">Fecha y hora de descarga</label><input class="input" type="datetime-local" id="fC" value="' + now.toISOString().slice(0, 16) + '"><span class="hint">Fecha de corte. La jornada usa los 7 días anteriores.</span></div></div>' +
      '<div class="grid-form"><div class="field"><label for="fR">Responsable</label><input class="input" id="fR" value="' + esc(lastResp()) + '"></div>' +
      '<div class="field"><label for="fP">Período</label><input class="input" id="fP" placeholder="Se toma del mes de la fecha de corte"></div>' +
      '<div class="field"><label for="fN">Satisfacción / NPS (opcional)</label><input class="input" id="fN" placeholder="Ej. 72 NPS"></div></div>' +
      '<div class="row"><button class="btn primary" type="submit" id="upGo">' + ICONS.up + 'Procesar y guardar</button><span class="hint" id="upSt" role="status"></span></div><div id="upMsg" class="msg err" hidden></div></form>' +
      '<section class="panel"><h2>Cargas guardadas</h2>' + lista + '</section></div>');

    var files = { g: null, t: null };
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
      var periodo = document.getElementById('fP').value.trim() || E.MESES[+m[2] - 1];
      try { localStorage.setItem('pia-resp', resp); } catch (e) { /* nada */ }
      b.disabled = true; st.textContent = 'Leyendo archivos…';
      Promise.all([
        readTable(files.g, E.loadGLPI).catch(function (e) { throw new Error('GLPI: ' + e.message); }),
        readTable(files.t, E.loadTipif).catch(function (e) { throw new Error('Tipificador: ' + e.message); })
      ]).then(function (res) {
        st.textContent = 'Calculando…';
        var R = E.compute(res[0], res[1], Object.assign({}, filtros(), { corte: corte }));
        if (!R.kpi.tipSA) throw new Error('El Tipificador no tiene casos de la sucursal "' + filtros().sucursal + '".');
        if (!R.kpi.sguTotal) throw new Error('GLPI no tiene tickets con "' + filtros().sguMarker + '" en el título.');
        st.textContent = 'Comprimiendo y guardando…';
        return gzip(empaquetar(res[0], res[1])).then(function (gz) {
          return api('POST', 'cargas', {
            datos: u8ToB64(gz), corte: corte, periodo: periodo, responsable: resp, nps: nps, glpi_nombre: files.g.name, tip_nombre: files.t.name,
            resumen: { glpi: R.kpi.glpiTotal, sgu: R.kpi.sguTotal, tipSA: R.kpi.tipSA, irPct: R.kpi.irPct, fcrPct: R.kpi.fcrPct }
          });
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
          if (btn.dataset.mode === 'save') {
            var body = {};
            tr.querySelectorAll('td.ed input').forEach(function (i) { body[i.name] = i.value.trim(); });
            return api('PATCH', 'cargas/' + id, body).then(function () { toast('Cambios guardados.'); return cargarLista(); }).then(renderRepo, function (e) { toast(e.message, true); });
          }
          var c = S.cargas.filter(function (x) { return x.id === id; })[0];
          tr.querySelectorAll('td.ed').forEach(function (td) { var f = td.getAttribute('data-f'); td.innerHTML = '<input class="input" name="' + f + '" value="' + esc(c[f] || '') + '" aria-label="' + f + '">'; });
          btn.dataset.mode = 'save'; btn.textContent = 'Guardar'; btn.classList.add('primary');
        }
      });
    });
  }
  function lastResp() { try { return localStorage.getItem('pia-resp') || 'Gabriela Silva'; } catch (e) { return 'Gabriela Silva'; } }

  /* ================= informe (estilo Power BI) ================= */
  var FILTROS = [
    { id: 'categorias', kind: 'categorias', title: 'Categorías · tiempos', noun: 'categorías', note: 'Las no seleccionadas se suman en "Otro".' },
    { id: 'grupos', kind: 'grupos', title: 'Grupos técnicos', noun: 'grupos', note: 'Los no seleccionados se suman en "Otro".' },
    { id: 'fallasCats', kind: 'categorias', title: 'Categorías · reincidencia', noun: 'categorías', note: 'Reincidente: 2 o más tickets SGU en las categorías marcadas.' },
    { id: 'categoriasProd', kind: 'categorias', title: 'Categorías · productividad', noun: 'categorías', note: 'Las no seleccionadas se suman en "Otro".' }
  ];
  var PAGINAS = ['Resumen', 'Tiempos por categoría', 'Canal y reincidencia', 'Grupos técnicos', 'Jornada', 'Productividad'];

  function tile(cls, title, sub, body) { return '<div class="viz ' + cls + '"><h3>' + esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</h3>' + body + '</div>'; }
  function card(title, tag, v, extra, note) {
    return '<div class="viz card c4"><div class="t">' + esc(title) + (tag ? '<i>' + esc(tag) + '</i>' : '') + '</div><div class="v">' + esc(v) + (extra ? '<small>' + esc(extra) + '</small>' : '') + '</div>' + (note ? '<div class="n">' + esc(note) + '</div>' : '') + '</div>';
  }
  function table(h1, h2, rows) {
    return '<div class="tbl"><table class="data"><thead><tr>' + h1 + '</tr>' + (h2 ? '<tr>' + h2 + '</tr>' : '') + '</thead><tbody>' + rows.map(function (r) {
      return '<tr' + (r.tot ? ' class="tot"' : '') + '>' + r.cells.map(function (c, i) { return '<td' + (i ? ' class="n"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
  }
  var SEG_H1 = function (l) { return '<th rowspan="2">' + l + '</th><th colspan="2">Ecosistema PIA</th><th colspan="2">SGU otras unidades</th><th colspan="2">Total San Agustín</th><th colspan="2">Diferente a San Agustín</th>'; };
  var SEG_H2 = '<th>Tickets</th><th>Promedio</th><th>Tickets</th><th>Promedio</th><th>Tickets</th><th>Promedio</th><th>Tickets</th><th>Promedio</th>';
  function segRows(list) { return list.map(function (r) { return { tot: r.total, cells: [r.label, tk(r.pia.n), E.fmtDur(r.pia.avg), tk(r.otras.n), E.fmtDur(r.otras.avg), tk(r.sgu.n), E.fmtDur(r.sgu.avg), tk(r.pais.n), E.fmtDur(r.pais.avg)] }; }); }
  function dias(v) { return v >= 1 ? (Math.round(v * 10) / 10).toLocaleString('es-VE') + ' d' : Math.round(v * 24) + ' h'; }
  function jornadaTable(groups) {
    var h1 = '<th rowspan="2">Día</th><th rowspan="2">Fecha</th>', h2 = '';
    groups.forEach(function (g) { h1 += '<th colspan="6">' + esc(g.label) + '</th>'; h2 += '<th>Abiertos</th><th>Pendientes</th><th>Resueltos</th><th>Acum. pend.</th><th>Acum. res.</th><th>% jornada</th>'; });
    var rows = [];
    for (var i = 0; i < 7; i++) {
      var c = [groups[0].d.filas[i].dia, groups[0].d.filas[i].fecha];
      groups.forEach(function (g) { var f = g.d.filas[i]; c.push(f.abiertos || '-', f.abiertos ? f.pendientes : '-', f.resueltos || '-', f.accPend, f.accRes, pct(f.pct)); });
      rows.push({ cells: c });
    }
    var t = ['Total semanal', ''];
    groups.forEach(function (g) { var x = g.d.total; t.push(x.abiertos, x.pendientes, x.resueltos, x.accPend, x.accRes, pct(x.pct)); });
    rows.push({ tot: true, cells: t });
    return table(h1, h2, rows);
  }

  function paginaInforme(i, R) {
    var K = R.kpi, head = '<div class="rpage-h"><h2>' + esc(PAGINAS[i]) + '</h2><span>' + esc(R.periodo + ' ' + R.anio + ' · corte ' + R.corteTxt + ' · ' + (R.responsable || '')) + '</span></div>';
    var body = '';
    if (i === 0) {
      body = card('Índice de Resolución PIA', '', pct(K.irPct), num(K.irNum) + ' casos', 'de los ' + num(K.irDen) + ' casos (GLPI SGU + tipificados)') +
        card('Resolución en 1er contacto (FCR)', '', pct(K.fcrPct), num(K.fcr) + ' casos', 'de los ' + num(K.tipSA) + ' casos tipificados') +
        card('Productividad del punto PIA', '', num(K.tipSA) + ' casos', '', num(K.escalados) + ' escalados a GLPI') +
        card('Resolución en la jornada', 'Últimos 7 días', pct(K.jornadaPct), num(K.jornadaMismoDia) + ' casos', 'de los ' + num(K.jornadaAbiertos) + ' tickets SGU abiertos (' + R.semana.desde + ' al ' + R.semana.hasta + ')') +
        card('Satisfacción / NPS', 'Trimestral', K.nps || '—', '', K.nps ? '' : 'Se carga en el Repositorio con Editar') +
        card('Reincidencia de fallas', '', num(K.reincAbonados) + ' abonados', num(K.reincTickets) + ' tickets', 'de los ' + num(K.sguTotal) + ' tickets SGU en GLPI') +
        card('Comparativo PIA vs. regular', 'Mensual', K.comparativo.valor, '', K.comparativo.aFavor) +
        card('Upgrades y SVA', 'Mensual', num(K.svaTotal), K.svaTotal === 1 ? 'upgrade' : 'upgrades', K.sva.map(function (s) { return s.label + ': ' + s.n; }).join(' · ')) +
        card('Tiempo promedio de resolución', '', E.fmtDur(K.tiempoSGU.avg), '', 'de los ' + num(K.tiempoSGU.n) + ' tickets SGU resueltos') +
        tile('c7', 'Tiempo promedio de resolución por segmento', 'días', C.hbars({ title: 'Tiempo por segmento', labels: ['Ecosistema PIA', 'SGU otras unidades', 'Total San Agustín', 'Resto del país'], labelW: 170,
          series: [{ name: 'Días', color: COLORS.brand, values: [K.tiempoPIA.avg, K.tiempoOtras.avg, K.tiempoSGU.avg, K.tiempoPais.avg].map(function (v) { return v || 0; }) }], fmt: function (v) { return E.fmtDur(v); } })) +
        tile('c5', 'Tickets en GLPI', 'todo el país', C.donut({ title: 'Tickets en GLPI', center: num(K.glpiTotal), sub: 'tickets', parts: [{ label: 'San Agustín (SGU)', value: K.sguTotal, color: COLORS.hot, text: num(K.sguTotal) }, { label: 'Otras oficinas', value: K.paisTotal, color: COLORS.brand, text: num(K.paisTotal) }] }));
    } else if (i === 1) {
      var cats = R.tiempoCategoria.filter(function (r) { return !r.total; });
      body = tile('c12', 'Tiempo promedio de resolución por categoría', 'días · tickets resueltos o cerrados', C.hbars({ title: 'Tiempo por categoría', labels: cats.map(function (r) { return r.label.replace(/^Cobranzas Masivas > /, ''); }), labelW: 250,
        series: [{ name: 'Total San Agustín', color: COLORS.hot, values: cats.map(function (r) { return r.sgu.avg || 0; }) }, { name: 'Resto del país', color: COLORS.brand, values: cats.map(function (r) { return r.pais.avg || 0; }) }], fmt: dias })) +
        tile('c12', 'Detalle por categoría', 'las no seleccionadas se suman en "Otro"', table(SEG_H1('Categoría'), SEG_H2, segRows(R.tiempoCategoria)));
    } else if (i === 2) {
      var rc = R.reincidencia, rcats = Object.keys(rc.porCategoria);
      var filas = rc.clientes.map(function (c) {
        var cs = []; c.tickets.forEach(function (t) { var k = t.categoria.replace(/^FTTH > /, ''); if (cs.indexOf(k) < 0) cs.push(k); });
        return { cells: [c.nombre, cs.join(' · '), c.tickets.map(function (t) { return t.id; }).join(', '), c.tickets.length] };
      });
      body = tile('c4', 'Canal de creación de casos SGU', '', C.donut({ title: 'Canal de creación', center: num(K.sguTotal), sub: 'tickets SGU', parts: [{ label: 'Creados por el PIA', value: K.piaTotal, color: COLORS.lilac, text: num(K.piaTotal) }, { label: 'Otras unidades', value: K.otrasTotal, color: COLORS.violet, text: num(K.otrasTotal) }] })) +
        tile('c4', 'Resueltos por canal', '', C.hbars({ title: 'Resueltos por canal', labels: ['PIA', 'Otras unidades'], labelW: 120, series: [{ name: 'Creados', color: COLORS.grey, values: [K.piaTotal, K.otrasTotal] }, { name: 'Resueltos', color: COLORS.brand, values: [K.piaRes, K.otrasRes] }], fmt: num })) +
        '<div class="viz card c4"><div class="t">Reincidencia de fallas</div><div class="v">' + num(K.reincAbonados) + '<small>abonados</small></div><div class="v" style="font-size:22px">' + num(K.reincTickets) + '<small>tickets</small></div><div class="n">de los ' + num(K.sguTotal) + ' tickets SGU en GLPI</div></div>' +
        tile('c5', 'Categorías de los tickets reincidentes', '', rcats.length ? C.hbars({ title: 'Reincidencia por categoría', labels: rcats, labelW: 170, series: [{ name: 'Tickets', color: COLORS.violet, values: rcats.map(function (c) { return rc.porCategoria[c]; }) }], fmt: num }) : '<p class="hint">Sin reincidencias con el filtro actual.</p>') +
        tile('c7', 'Clientes reincidentes', '', table('<th>Cliente</th><th>Categorías</th><th>Tickets</th><th>Contactos</th>', '', filas.length ? filas : [{ cells: ['Sin reincidencias', '', '', ''] }]));
    } else if (i === 3) {
      var gs = R.tiempoGrupo.filter(function (r) { return !r.total && r.sgu.n; });
      body = tile('c12', 'Tiempo promedio por grupo técnico', 'días · tickets SGU resueltos', gs.length ? C.hbars({ title: 'Tiempo por grupo', labels: gs.map(function (r) { return r.label; }), labelW: 260,
        series: [{ name: 'Ecosistema PIA', color: COLORS.lilac, values: gs.map(function (r) { return r.pia.avg || 0; }) }, { name: 'Total San Agustín', color: COLORS.brand, values: gs.map(function (r) { return r.sgu.avg || 0; }) }], fmt: dias }) : '<p class="hint">No hay tickets SGU en los grupos seleccionados.</p>') +
        tile('c12', 'Detalle por grupo técnico', 'los no seleccionados se suman en "Otro"', table(SEG_H1('Grupo técnico'), SEG_H2, segRows(R.tiempoGrupo)));
    } else if (i === 4) {
      var j = R.jornada, lab = j.sgu.filas.map(function (f) { return f.dia.slice(0, 3) + ' ' + f.fecha.slice(0, 5); });
      body = tile('c6', 'Tickets SGU por día', R.semana.desde + ' al ' + R.semana.hasta, C.columns({ title: 'Tickets por día', labels: lab, series: [{ name: 'Abiertos', color: COLORS.grey, values: j.sgu.filas.map(function (f) { return f.abiertos; }) }, { name: 'Resueltos', color: COLORS.brand, values: j.sgu.filas.map(function (f) { return f.resueltos; }) }, { name: 'Resueltos el mismo día', color: COLORS.hot, values: j.sgu.filas.map(function (f) { return f.mismoDia; }) }] })) +
        tile('c6', '% resueltos en la jornada', 'semana', C.hbars({ title: '% en jornada', labels: ['Ecosistema PIA', 'SGU otras unidades', 'Total San Agustín', 'Resto del país'], labelW: 160, series: [{ name: '%', color: COLORS.violet, values: [j.pia.total.pct, j.otras.total.pct, j.sgu.total.pct, j.pais.total.pct].map(function (v) { return v || 0; }) }], fmt: pct })) +
        tile('c12', 'Resolución en la jornada · Todo San Agustín', '', jornadaTable([{ label: 'Todo San Agustín', d: j.sgu }])) +
        tile('c12', 'Resolución en la jornada · PIA vs. San Agustín', '', jornadaTable([{ label: 'Ecosistema PIA', d: j.pia }, { label: 'San Agustín (otras unidades)', d: j.otras }]));
    } else if (i === 5) {
      var ps = R.productividad.filter(function (r) { return !r.total && !r.tipificador; });
      body = tile('c12', 'Tickets SGU creados y solucionados por categoría', '', C.hbars({ title: 'Productividad', labels: ps.map(function (r) { return r.label.replace(/^Cobranzas Masivas > /, ''); }), labelW: 250,
        series: [{ name: 'Creados', color: COLORS.grey, values: ps.map(function (r) { return r.sgu.creados || 0; }) }, { name: 'Solucionados', color: COLORS.brand, values: ps.map(function (r) { return r.sgu.resueltos || 0; }) }], fmt: num })) +
        tile('c12', 'Productividad del punto por categoría', 'la primera fila viene del Tipificador', table('<th rowspan="2">Categoría</th><th colspan="2">Ecosistema PIA</th><th colspan="2">SGU otras unidades</th><th colspan="2">Total San Agustín</th><th colspan="2">Diferente a San Agustín</th>',
          '<th>Creados</th><th>Solucionados</th><th>Creados</th><th>Solucionados</th><th>Creados</th><th>Solucionados</th><th>Creados</th><th>Solucionados</th>',
          R.productividad.map(function (r) { return { tot: r.total, cells: [r.label, tk(r.pia.creados), tk(r.pia.resueltos), tk(r.otras.creados), tk(r.otras.resueltos), tk(r.sgu.creados), tk(r.sgu.resueltos), tk(r.pais.creados), tk(r.pais.resueltos)] }; })));
    }
    return '<div class="rpage" data-p="' + i + '">' + head + body + '</div>';
  }

  function sinCarga(where) {
    return '<div class="page"><div class="empty"><b>Elija una carga para ver ' + where + '.</b><span class="muted">' + (S.cargas.length ? 'Use el selector de arriba o ábrala desde el Repositorio.' : 'Primero suba los archivos de GLPI y del Tipificador en el Repositorio.') + '</span><a class="btn primary" href="#repositorio">Ir al Repositorio</a></div></div>';
  }

  function filterPane(R) {
    var f = filtros();
    var cards = FILTROS.map(function (d) {
      var open = S.openFilter && S.openFilter.id === d.id;
      return '<div class="fcard' + (open ? ' open' : '') + '" data-f="' + d.id + '"><button type="button" class="fhead" aria-expanded="' + open + '"><b>' + esc(d.title) + '</b><span>' + f[d.id].length + ' de ' + R.opciones[d.kind].length + ' ' + d.noun + '</span></button>' +
        (open ? filterList(d, R) : '') + '</div>';
    }).join('');
    return '<aside class="fpane' + (S.fpaneOpen ? '' : ' closed') + '" aria-label="Filtros"><div class="fh"><span>' + ICONS.filter.replace('<svg', '<svg width="15" height="15" style="vertical-align:-2px;margin-right:6px"') + 'Filtros</span><button type="button" id="fToggle" aria-label="' + (S.fpaneOpen ? 'Ocultar filtros' : 'Mostrar filtros') + '">' + (S.fpaneOpen ? '»' : '«') + '</button></div>' +
      '<div class="fbody">' + cards + '<p class="hint">Los filtros se guardan para todos los usuarios y se aplican al informe, la presentación y las descargas.</p></div></aside>';
  }
  function filterOptions(d, R) {
    var k = d.kind === 'grupos' ? E.grpKey : E.norm, opts = R.opciones[d.kind].slice(), known = {};
    opts.forEach(function (o) { known[o.key] = true; });
    filtros()[d.id].forEach(function (lab) { var kk = k(lab); if (!known[kk]) { opts.push({ label: lab, key: kk, sgu: 0, total: 0 }); known[kk] = true; } });
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
    shell('informe', ctxSelector(), R ? '<div class="report"><div class="report-main"><div class="report-bar"><h1>Informe · ' + esc(R.periodo + ' ' + R.anio) + '</h1><span class="spacer"></span>' +
      '<button class="btn" id="xPdf">' + ICONS.down + 'Informe PDF</button><button class="btn" id="xXls">' + ICONS.down + 'Informe Excel</button></div>' +
      '<div class="canvas" id="canvas">' + paginaInforme(S.tab, R) + '</div>' +
      '<div class="tabs" role="tablist">' + PAGINAS.map(function (p, i) { return '<button type="button" role="tab" data-t="' + i + '" aria-selected="' + (i === S.tab) + '">' + esc(p) + '</button>'; }).join('') + '</div></div>' +
      filterPane(R) + '</div>' : sinCarga('el informe'));
    bindCtx();
    if (!R) return;
    Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (b) { b.addEventListener('click', function () { S.tab = +b.getAttribute('data-t'); renderInforme(); }); });
    document.getElementById('xXls').addEventListener('click', exportExcel);
    document.getElementById('xPdf').addEventListener('click', exportInformePdf);
    bindFilterPane(renderInforme);
  }

  function bindFilterPane(rerender) {
    var R = S.R, tog = document.getElementById('fToggle');
    tog.addEventListener('click', function () { S.fpaneOpen = !S.fpaneOpen; rerender(); });
    Array.prototype.forEach.call(document.querySelectorAll('.fcard'), function (cardEl) {
      var id = cardEl.getAttribute('data-f'), d = FILTROS.filter(function (x) { return x.id === id; })[0];
      var k = d.kind === 'grupos' ? E.grpKey : E.norm;
      cardEl.querySelector('.fhead').addEventListener('click', function () {
        S.openFilter = S.openFilter && S.openFilter.id === id ? null : { id: id, q: '', onlySgu: true, picked: filtros()[id].map(k) };
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
      list.querySelector('[data-role="orig"]').addEventListener('click', function () { st.picked = defaultsFiltros()[id].map(k); redraw(); });
      list.querySelector('.opts').addEventListener('change', function (e) {
        var i = e.target.getAttribute('data-i'); if (i === null) return;
        var key = opts[+i].key, at = st.picked.indexOf(key);
        if (e.target.checked && at < 0) st.picked.push(key); else if (!e.target.checked && at >= 0) st.picked.splice(at, 1);
        var hint = list.querySelector('.flist > .hint'); if (hint) hint.textContent = st.picked.length + ' seleccionadas · ' + d.note;
      });
      list.querySelector('[data-role="cancel"]').addEventListener('click', function () { S.openFilter = null; rerender(); });
      list.querySelector('[data-role="apply"]').addEventListener('click', function () {
        var prev = filtros()[id].filter(function (lab) { return st.picked.indexOf(k(lab)) >= 0; }), prevK = prev.map(k);
        var added = opts.filter(function (o) { return st.picked.indexOf(o.key) >= 0 && prevK.indexOf(o.key) < 0; }).map(function (o) { return o.label; });
        S.filtros = Object.assign(filtros(), {}); S.filtros[id] = prev.concat(added);
        S.openFilter = null;
        calcular(); rerender(); guardarFiltros(); toast('Filtro aplicado para todos los usuarios.');
      });
    });
  }

  function baseName() { var R = S.R; return 'Gestion SGU VS PAIS - ' + String(R.periodo).toUpperCase() + ' ' + R.corteFecha.replace(/\//g, '-'); }

  function exportExcel() {
    var R = S.R, K = R.kpi, wb = XLSX.utils.book_new();
    function add(name, aoa, widths) { var ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = (widths || []).map(function (w) { return { wch: w }; }); XLSX.utils.book_append_sheet(wb, ws, name); }
    add('Resumen', [
      ['Reporte PIA · SGU vs País'], ['Responsable', R.responsable || ''], ['Período', R.periodo + ' ' + R.anio], ['Fecha de corte', R.corteTxt], [],
      ['Indicador', 'Valor', 'Detalle'],
      ['Índice de Resolución PIA', K.irPct, K.irNum + ' de ' + K.irDen + ' casos'],
      ['Resolución en 1er contacto (FCR)', K.fcrPct, K.fcr + ' de ' + K.tipSA + ' casos tipificados'],
      ['Productividad del punto PIA', K.tipSA, K.escalados + ' escalados a GLPI'],
      ['Resolución en la jornada (7 días)', K.jornadaPct, K.jornadaMismoDia + ' de ' + K.jornadaAbiertos + ' tickets SGU (' + R.semana.desde + ' al ' + R.semana.hasta + ')'],
      ['Satisfacción / NPS', K.nps || '', ''],
      ['Reincidencia de fallas (abonados)', K.reincAbonados, K.reincTickets + ' tickets'],
      ['Comparativo PIA vs. regular', K.comparativo.valor, K.comparativo.aFavor],
      ['Upgrades y SVA', K.svaTotal, K.sva.map(function (s) { return s.label + ': ' + s.n; }).join(' · ')],
      ['Tiempo promedio de resolución SGU', E.fmtDur(K.tiempoSGU.avg), K.tiempoSGU.n + ' tickets resueltos'],
      ['Tickets SGU en GLPI', K.sguTotal, K.sguRes + ' resueltos'],
      ['Creados por el PIA', K.piaTotal, K.piaRes + ' resueltos'],
      ['Creados por otras unidades (SGU)', K.otrasTotal, K.otrasRes + ' resueltos'],
      ['Tickets resto del país', K.paisTotal, K.paisRes + ' resueltos']
    ], [38, 18, 60]);
    function segSheet(name, first, list) {
      var aoa = [[first, 'PIA tickets', 'PIA promedio', 'SGU otras tickets', 'SGU otras promedio', 'Total SA tickets', 'Total SA promedio', 'Diferente SA tickets', 'Diferente SA promedio']];
      list.forEach(function (r) { aoa.push([r.label, r.pia.n, E.fmtDur(r.pia.avg), r.otras.n, E.fmtDur(r.otras.avg), r.sgu.n, E.fmtDur(r.sgu.avg), r.pais.n, E.fmtDur(r.pais.avg)]); });
      add(name, aoa, [55, 10, 20, 10, 20, 10, 20, 12, 20]);
    }
    segSheet('Tiempo por categoría', 'Categoría', R.tiempoCategoria);
    segSheet('Grupo técnico', 'Grupo técnico', R.tiempoGrupo);
    var pa = [['Categoría', 'PIA creados', 'PIA solucionados', 'SGU otras creados', 'SGU otras solucionados', 'Total SA creados', 'Total SA solucionados', 'Diferente SA creados', 'Diferente SA solucionados']];
    R.productividad.forEach(function (r) { pa.push([r.label, r.pia.creados, r.pia.resueltos, r.otras.creados, r.otras.resueltos, r.sgu.creados, r.sgu.resueltos, r.pais.creados, r.pais.resueltos]); });
    add('Productividad', pa, [50, 12, 14, 12, 14, 12, 14, 12, 14]);
    var ja = [['Día', 'Fecha']], segs = [['Todo San Agustín', 'sgu'], ['Ecosistema PIA', 'pia'], ['SGU otras unidades', 'otras'], ['Diferente a San Agustín', 'pais']];
    segs.forEach(function (s) { ja[0].push(s[0] + ' abiertos', 'pendientes', 'resueltos', 'acum. pend.', 'acum. res.', '% en jornada'); });
    for (var i = 0; i < 7; i++) { var r = [R.jornada.sgu.filas[i].dia, R.jornada.sgu.filas[i].fecha]; segs.forEach(function (s) { var f = R.jornada[s[1]].filas[i]; r.push(f.abiertos, f.pendientes, f.resueltos, f.accPend, f.accRes, f.pct); }); ja.push(r); }
    var tr = ['Total semanal', '']; segs.forEach(function (s) { var t = R.jornada[s[1]].total; tr.push(t.abiertos, t.pendientes, t.resueltos, t.accPend, t.accRes, t.pct); }); ja.push(tr);
    add('Jornada', ja, [14, 12]);
    var ra = [['Cliente', 'Cédula', 'Ticket', 'Categoría', 'Estado', 'Contactos del cliente']];
    R.reincidencia.clientes.forEach(function (c) { c.tickets.forEach(function (t) { ra.push([c.nombre, c.cedula || '', t.id, t.categoria, t.estado, c.tickets.length]); }); });
    add('Reincidencias', ra, [40, 12, 12, 40, 14, 12]);
    add('Upgrades SVA', [['Concepto', 'Casos']].concat(K.sva.map(function (s) { return [s.label, s.n]; })).concat([['Total', K.svaTotal]]), [36, 10]);
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
      var first = true, chain = Promise.resolve();
      PAGINAS.forEach(function (p, i) {
        chain = chain.then(function () {
          busy('Preparando el PDF del informe… página ' + (i + 1) + ' de ' + PAGINAS.length);
          host.innerHTML = paginaInforme(i, R);
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
    }).catch(function (e) { toast('No se pudo crear el PDF: ' + e.message, true); }).finally(function () { busy(); });
  }

  /* ================= presentación (estilo PowerPoint) ================= */
  function buildHtmlDeck() { return D.build(H.HtmlDeck, S.R, S.assets, E); }
  function fit(stageEl, box) { var sc = box.clientWidth / H.WIDTH; stageEl.style.transform = 'scale(' + sc + ')'; }
  function renderDeck() {
    var R = S.R;
    if (!R) { shell('presentacion', ctxSelector(), sinCarga('la presentación')); bindCtx(); return; }
    var deck = buildHtmlDeck(), n = deck.slides.length;
    if (S.slide >= n) S.slide = n - 1;
    shell('presentacion', ctxSelector(), '<div class="deck"><div class="deck-bar"><b>Presentación · ' + esc(R.periodo + ' ' + R.anio) + '</b><span class="hint">' + n + ' diapositivas</span><span class="spacer"></span>' +
      '<button class="btn" id="pShow">' + ICONS.play + 'Presentar</button><button class="btn" id="pPptx">' + ICONS.down + 'PowerPoint</button><button class="btn" id="pPdf">' + ICONS.down + 'PDF</button></div>' +
      '<div class="thumbs" id="thumbs"></div><div class="stage-wrap"><div style="width:100%;max-width:1180px"><div class="stage" id="stage"></div><div class="stage-nav"><button class="btn sm" id="pPrev">‹ Anterior</button><span id="pNum"></span><button class="btn sm" id="pNext">Siguiente ›</button></div>' +
      '<p class="hint" style="text-align:center">Use los filtros del Informe para elegir las categorías y grupos que aparecen aquí.</p></div></div></div>');
    bindCtx();
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
      D.build(window.PptxGenJS, S.R, S.assets, E).writeFile({ fileName: baseName() + '.pptx' })
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
      return chain.then(function () { host.remove(); doc.save(baseName() + '.pdf'); });
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
      api('GET', 'filtros').then(function (j) { S.filtros = j.filtros; }),
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
