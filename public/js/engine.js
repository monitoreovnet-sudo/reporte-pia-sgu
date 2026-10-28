/* Motor de cálculo v2 — Reporte PIA · SGU vs País
 * Implementa la especificación "prompt_reporte_pia_sgu.md" (octubre 2026).
 * Funciones puras: no tocan la pantalla. Fechas como número de serie de Excel (días desde 1899-12-30).
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    sucursal: 'San Agustín',
    sguMarker: '- SGU -',
    piaSolicitante: 'Figueroa Atencio Gabriel Alberto',
    fcrStatus: 'Resuelto en 1er. contacto',
    estatusSubcat: 'Estatus de un ticket de reporte',
    aumentoSubcat: 'Cambio de plan - Aumento',
    disminucionSubcat: 'Cambio de plan - Disminución',
    cambioPlanCat: 'FTTH > Cambio de plan',
    categorias: [
      'Cobranzas Masivas > FTTH > Ajuste de facturación',
      'Cobranzas Masivas > FTTH > Reembolso',
      'FTTH > Cambio de clave WiFi',
      'FTTH > Cambio de plan',
      'FTTH > Configuración de canales',
      'FTTH > Configuración de equipo',
      'FTTH > Intermitencias',
      'FTTH > Retiro de servicio',
      'FTTH > Sin conexión',
      'FTTH > Visita técnica'
    ],
    grupos: ['ATC No Presencial', 'Cobranzas Masivas (+)', 'Contratista San Agustín (+)', 'Tesoreria Masivos', 'Reparación (+)', 'Activaciones (+)', 'UDN Caracas (+)', 'COR (+)'],
    /** Categorías FTTH que NO cuentan para reincidencias (se cambia desde el filtro del Informe). */
    reincExcluir: ['Cobranzas Masivas > FTTH > Ajuste de facturación', 'Cobranzas Masivas > FTTH > Reembolso', 'FTTH > Cambio de plan'],
    gruposNegrita: ['ATC No Presencial', 'Cobranzas Masivas (+)', 'Contratista San Agustín (+)', 'Tesoreria Masivos']
  };

  var GRUPOS = ['pia', 'otras', 'sgu', 'pais'];
  var ETIQUETAS = { pia: 'PIA', otras: 'SGU otras unidades', sgu: 'SGU total', pais: 'País' };
  var ETIQUETAS_LARGAS = { pia: 'Ecosistema PIA', otras: 'SGU otras unidades', sgu: 'Total San Agustín', pais: 'Diferente a San Agustín' };

  /* ---------- texto ---------- */
  function norm(s) { return s === null || s === undefined ? '' : String(s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function stripAccents(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function hkey(s) { return stripAccents(norm(s)).replace(/[^a-z0-9]+/g, ' ').trim(); }
  function eq(a, b) { return norm(a) === norm(b); }
  function fixText(s) {
    s = s == null ? '' : String(s);
    if (/[ÃÂ]/.test(s)) { try { return decodeURIComponent(escape(s)); } catch (e) { return s; } }
    return s;
  }
  function danado(s) { return /[ÃÂ�]/.test(String(s || '')); }
  /** Categoría homologada: quita ">" o "<" sobrantes al final. */
  function homologar(c) { return String(c == null ? '' : c).trim().replace(/\s*[<>]+\s*$/, ''); }
  /** Grupo técnico: líneas unidas con " · " (valor exacto del campo). */
  function grpLineas(g) { return String(g == null ? '' : g).split(/\r?\n|<br\s*\/?>|\s+[·+]\s+/i).map(function (x) { return x.trim(); }).filter(Boolean); }
  /** Unificación de grupos técnicos, en este orden (gana la primera regla que aplica):
   *  1) termina en "Cobranzas Masivas" → "Cobranzas Masivas (+)"   2) dice "reparación" → "Reparación (+)"
   *  3) dice "activaciones" → "Activaciones (+)"   4) dice "UDN Caracas" → "UDN Caracas (+)"   5) dice "COR" → "COR (+)"
   *  6) dice "Contratista San Agustín" → "Contratista San Agustín (+)"
   *  El "(+)" indica que el grupo reúne varios grupos de GLPI: participó en la solución, no necesariamente solo.
   *  Lo demás queda con su nombre (varias líneas unidas con " · "). */
  function grpLabel(g) {
    var lin = grpLineas(g);
    if (!lin.length) return '';
    var k = hkey(lin.join(' ')), last = hkey(lin[lin.length - 1]);
    if (/(^| )cobranzas masivas$/.test(last)) return 'Cobranzas Masivas (+)';
    if (/(^| )reparacion( |$)/.test(k)) return 'Reparación (+)';
    if (/(^| )activaciones( |$)/.test(k)) return 'Activaciones (+)';
    if (/(^| )udn caracas( |$)/.test(k)) return 'UDN Caracas (+)';
    if (/(^| )cor( |$)/.test(k)) return 'COR (+)';
    if (/(^| )contratista san agustin( |$)/.test(k)) return 'Contratista San Agustín (+)';
    return lin.join(' · ');
  }
  function grpKey(g) { return norm(grpLabel(g)); }
  function catCorta(c) { return String(c).replace(/^Cobranzas Masivas > FTTH > /i, '').replace(/^FTTH > /i, ''); }
  function soloDigitos(v) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number') return isFinite(v) ? String(Math.trunc(v)) : '';
    var s = String(v).trim();
    if (/^\d+\.\d+$/.test(s)) s = String(Math.trunc(parseFloat(s)));
    return s.replace(/\D/g, '');
  }

  /* ---------- fechas ---------- */
  var MS_DAY = 86400000, EPOCH = Date.UTC(1899, 11, 30);
  function serialFromParts(y, mo, d, h, mi, s) { return (Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0) - EPOCH) / MS_DAY; }
  function partsFromSerial(x) {
    var dt = new Date(EPOCH + Math.round(x * 86400) * 1000);
    return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate(), h: dt.getUTCHours(), mi: dt.getUTCMinutes(), s: dt.getUTCSeconds(), wd: dt.getUTCDay() };
  }
  function parseDate(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) && v > 0 && v < 2958466 ? v : null;
    if (v instanceof Date) { if (isNaN(v)) return null; return serialFromParts(v.getFullYear(), v.getMonth() + 1, v.getDate(), v.getHours(), v.getMinutes(), v.getSeconds()); }
    var s = String(v).trim(); if (!s) return null;
    var m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return serialFromParts(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([aApP]\.?\s*[mM]\.?)?)?/);
    if (m) {
      var y = +m[3]; if (y < 100) y += 2000;
      var h = +(m[4] || 0);
      if (m[7]) { var pm = /p/i.test(m[7]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
      return serialFromParts(y, +m[2], +m[1], h, +(m[5] || 0), +(m[6] || 0));
    }
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    return null;
  }
  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(x) { var p = partsFromSerial(x); return pad(p.d) + '/' + pad(p.mo) + '/' + p.y; }
  function fmtDM(x) { var p = partsFromSerial(x); return pad(p.d) + '/' + pad(p.mo); }
  function dayName(x) { return DIAS[partsFromSerial(x).wd]; }

  /* ---------- números y duraciones ---------- */
  function miles(n) { return n === null || n === undefined || isNaN(n) ? '-' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function pct(x) { return x === null || x === undefined || isNaN(x) ? '-' : Math.round(x * 100) + '%'; }
  function tickets(n) { return !n ? '-' : miles(n) + (n === 1 ? ' Ticket' : ' Tickets'); }
  /** Duración corta: "4 días 11 h", "21 h 33 min", "1 min", "0 h". Entrada en segundos. Trunca. */
  function fmtD(secs) {
    if (secs === null || secs === undefined || isNaN(secs)) return '-';
    secs = Math.max(0, Math.round(secs));
    if (secs === 0) return '0 h';
    var d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60);
    if (d >= 1) return d + (d === 1 ? ' día ' : ' días ') + h + ' h';
    if (h >= 1) return h + ' h' + (m ? ' ' + m + ' min' : '');
    return m + ' min';
  }
  /** Duración en palabras para comparativos: "13 horas", "1 día 13 horas". */
  function fmtPalabras(secs) { // redondea a la hora más cercana (a minutos si es menos de una hora)
    if (secs === null || secs === undefined || isNaN(secs)) return '-';
    secs = Math.max(0, Math.round(secs));
    if (secs >= 3600) secs = Math.round(secs / 3600) * 3600;
    var d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60);
    if (d >= 1) return d + (d === 1 ? ' día ' : ' días ') + h + (h === 1 ? ' hora' : ' horas');
    if (h >= 1) return h + (h === 1 ? ' hora' : ' horas');
    return m + (m === 1 ? ' minuto' : ' minutos');
  }

  /* ---------- lectura de archivos ---------- */
  var GLPI_COLS = {
    id: ['ID'], titulo: ['Título', 'Titulo'], estado: ['Estado'], categoria: ['Categoría', 'Categoria'],
    apertura: ['Fecha de apertura'], solucion: ['Fecha de solución', 'Fecha de solucion'], cierre: ['Fecha de cierre'],
    solicitante: ['Solicitante - Solicitante', 'Solicitante'],
    grupo: ['Asignado a - Grupo de técnicos', 'Asignado a - Grupo de tecnicos', 'Grupo de técnicos'],
    descripcion: ['Descripción', 'Descripcion'],
    cliente: ['Complementos - Datos Clientes - Nombre Cliente', 'Nombre Cliente']
  };
  var GLPI_REQ = ['titulo', 'estado', 'categoria', 'apertura', 'solucion', 'solicitante', 'grupo'];
  var TIP_COLS = {
    fecha: ['Fecha'], sucursal: ['Sucursal'], categoria: ['Categoría', 'Categoria'], subcategoria: ['Subcategoría', 'Subcategoria'],
    estatus: ['Estatus'], ticket: ['Ticket GLPI'], cuenta: ['ID de cuenta'], observaciones: ['Observaciones']
  };
  var TIP_REQ = ['fecha', 'sucursal', 'categoria', 'subcategoria', 'estatus'];

  function mapHeader(rows, spec, req) {
    var best = null;
    for (var r = 0; r < Math.min(rows.length, 25); r++) {
      var row = rows[r] || [], idx = {}, hits = 0, keys = row.map(hkey);
      Object.keys(spec).forEach(function (k) {
        for (var a = 0; a < spec[k].length; a++) { var c = keys.indexOf(hkey(spec[k][a])); if (c >= 0) { idx[k] = c; hits++; return; } }
      });
      if (req.every(function (k) { return idx[k] !== undefined; }) && (!best || hits > best.hits)) best = { row: r, idx: idx, hits: hits };
    }
    if (!best) throw new Error('No se encontraron las columnas requeridas: ' + req.map(function (k) { return '"' + spec[k][0] + '"'; }).join(', '));
    return best;
  }
  /** Solo se guarda la descripción donde se usa (cambios de plan y Pley), para que la carga pese poco. */
  function necesitaDescripcion(cat) { var c = norm(cat); return c.indexOf('cambio de plan') >= 0 || c.indexOf('pley') >= 0; }

  function loadGLPI(rows) {
    var h = mapHeader(rows, GLPI_COLS, GLPI_REQ), i = h.idx, out = [], seen = {}, dup = 0;
    for (var r = h.row + 1; r < rows.length; r++) {
      var row = rows[r]; if (!row) continue;
      var titulo = row[i.titulo];
      if ((titulo == null || titulo === '') && (row[i.estado] == null || row[i.estado] === '')) continue;
      var id = i.id !== undefined && row[i.id] != null ? String(row[i.id]).trim() : '';
      var key = soloDigitos(id);
      if (key && seen[key]) { dup++; continue; }
      if (key) seen[key] = true;
      var cat = row[i.categoria] == null ? '' : String(row[i.categoria]);
      out.push({
        id: id, titulo: fixText(titulo), estado: row[i.estado] == null ? '' : String(row[i.estado]), categoria: cat,
        apertura: parseDate(row[i.apertura]), solucion: parseDate(row[i.solucion]),
        cierre: i.cierre !== undefined ? parseDate(row[i.cierre]) : null,
        solicitante: row[i.solicitante] == null ? '' : String(row[i.solicitante]),
        grupo: row[i.grupo] == null ? '' : String(row[i.grupo]),
        descripcion: i.descripcion !== undefined && row[i.descripcion] != null && necesitaDescripcion(cat) ? fixText(row[i.descripcion]) : '',
        cliente: i.cliente !== undefined && row[i.cliente] != null ? fixText(row[i.cliente]).trim() : ''
      });
    }
    if (!out.length) throw new Error('El archivo de GLPI no tiene tickets.');
    out.duplicados = dup;
    return out;
  }

  function loadTipif(rows) {
    var h = mapHeader(rows, TIP_COLS, TIP_REQ), i = h.idx, out = [];
    for (var r = h.row + 1; r < rows.length; r++) {
      var row = rows[r]; if (!row) continue;
      if (row[i.sucursal] == null || row[i.sucursal] === '') continue;
      out.push({
        fecha: parseDate(row[i.fecha]), sucursal: String(row[i.sucursal]), categoria: row[i.categoria] == null ? '' : String(row[i.categoria]),
        subcategoria: row[i.subcategoria] == null ? '' : String(row[i.subcategoria]), estatus: row[i.estatus] == null ? '' : String(row[i.estatus]),
        ticket: i.ticket !== undefined ? soloDigitos(row[i.ticket]) : '',
        cuenta: i.cuenta !== undefined ? soloDigitos(row[i.cuenta]) : ''
      });
    }
    if (!out.length) throw new Error('El archivo del Tipificador no tiene registros.');
    return out;
  }

  /* ---------- cuenta del abonado (3.5) ---------- */
  function cuentaDeTitulo(titulo) {
    var t = String(titulo || '');
    var m = t.match(/-\s*(\d{5,9})\s*[-–]\s*(\d{1,7})\b/);
    var cuenta = null, cedula = null, nombre = '';
    if (m) {
      cuenta = m[2]; cedula = m[1];
      var antes = t.slice(0, m.index).replace(/\s+$/, '');
      var k = antes.lastIndexOf(' - ');
      nombre = (k >= 0 ? antes.slice(k + 3) : antes).trim();
    } else {
      var b = t.match(/[-–]\s*(\d{3,7})\s*$/);
      if (b) {
        cuenta = b[1];
        var partes = t.slice(0, b.index).split(/\s+[-–]\s+/);
        nombre = (partes[partes.length - 1] || '').replace(/^[-–\s]+|[-–\s]+$/g, '').trim();
      }
    }
    return { cuenta: cuenta, cedula: cedula, nombre: nombre.toUpperCase() };
  }

  /* ---------- dirección del cambio de plan (4.3) ---------- */
  var RE_PLAN = /(^|[^0-9])(200|300|400|600|800|1000)(?![0-9])/g;
  function direccionPlan(titulo, descripcion) {
    var t = (String(titulo || '') + ' ' + String(descripcion || '')).toLowerCase();
    t = t.replace(/\./g, '').replace(/1\s*(giga|gb|g)\b/g, '1000').replace(/vnet\s*i?giga/g, '1000').replace(/1000\s*mb/g, '1000');
    var nums = [], m;
    RE_PLAN.lastIndex = 0;
    while ((m = RE_PLAN.exec(t))) { nums.push(+m[2]); RE_PLAN.lastIndex = m.index + m[0].length; }
    var dir;
    if (nums.length >= 2 && nums[0] !== nums[1]) dir = nums[1] > nums[0] ? 'sube' : 'baja';
    else {
      var up = /aument|subir|increment|mejorar|upgrade|mayor capacidad/.test(t), down = /disminu|bajar|reduc|downgrade|consumo|exonerado|econ/.test(t);
      dir = up && !down ? 'sube' : (down && !up ? 'baja' : 'indefinido');
    }
    var reversion = /accident|equivocad|por error|erroneamente|erróneamente/.test(t);
    return { dir: dir, reversion: reversion, nums: nums };
  }
  /** Pley hacia arriba en GLPI (SVA).
   *  - Tickets de activación de cuenta o cambio de plan Pley cuya descripción nombra un plan Pley (Pro, Base…).
   *  - En otras categorías Pley (p. ej. problemas de reproducción) solo cuenta si en el mismo ticket se gestiona
   *    la activación ("decide activar el plan Pley Base", "se procede a activar…"); los reportes de falla después
   *    de una activación anterior no cuentan, porque esa venta ya se registró en su momento. */
  var RE_PLAN_PLEY = /(pley|play)\s*(pro|base|plus|premium|full|est[aá]ndar)/;
  function esPleyArriba(tk) {
    var t = tk.raw || tk, c = norm(t.categoria);
    if (c.indexOf('pley') < 0) return false;
    if (/baja|desactivaci|retiro/.test(c)) return false;
    var d = norm(t.descripcion);
    if (!RE_PLAN_PLEY.test(d)) return false;
    if (/activaci[oó]n de cuenta|cambio de plan/.test(c)) return true;
    return /(decide|decidi[oó]|procede a|se procede|solicita|desea)\s+(a\s+)?(activar|afiliar|contratar)[^.\n]{0,60}(pley|play)|se (activ[oó]|afili[oó]) el plan (pley|play)/.test(d);
  }

  /* ---------- moda o promedio (3.4) ---------- */
  function modaPromedio(lista) { // lista de segundos, en orden del archivo
    if (!lista.length) return { n: 0, prom: null, moda: null };
    var sum = 0, cnt = {}, first = {};
    lista.forEach(function (s, i) {
      sum += s;
      var r = Math.round(s / 3600) * 3600;
      cnt[r] = (cnt[r] || 0) + 1;
      if (first[r] === undefined) first[r] = i;
    });
    var moda = null, best = 1;
    Object.keys(cnt).forEach(function (k) {
      var c = cnt[k];
      if (c > best || (c === best && c >= 2 && moda !== null && first[k] < first[moda])) { best = c; moda = +k; }
    });
    if (best < 2) moda = null;
    return { n: lista.length, prom: sum / lista.length, moda: moda };
  }
  function celdaTiempo(mp, esTotal) {
    if (!mp || !mp.n) return '-';
    if (esTotal) return mp.moda === null ? 'P: ' + fmtD(mp.prom) : 'M: ' + fmtD(mp.moda) + ' / P: ' + fmtD(mp.prom);
    if (mp.moda === null) return 'P: ' + fmtD(mp.prom);
    if (mp.moda === 0) return 'M: 0 h / P: ' + fmtD(mp.prom);
    return 'M: ' + fmtD(mp.moda);
  }

  /* ================= cálculo principal ================= */
  function compute(glpiAll, tipAll, opts) {
    var cfg = Object.assign({}, DEFAULTS, opts || {});
    if (typeof cfg.corte !== 'number') throw new Error('Falta la fecha y hora de descarga.');
    var FD = cfg.corte, fdDay = Math.floor(FD + 1e-9), fp = partsFromSerial(FD);
    var mesIni = serialFromParts(fp.y, fp.mo, 1), mesFin = fp.mo === 12 ? serialFromParts(fp.y + 1, 1, 1) : serialFromParts(fp.y, fp.mo + 1, 1);
    var wIni = fdDay - 8, wFin = fdDay; // ventana: [FD-8, FD-1] completos
    var marker = norm(cfg.sguMarker);
    var catKeys = cfg.categorias.map(norm);
    var grpKeys = [], gruposU = [];
    cfg.grupos.forEach(function (g) { var k = grpKey(g); if (k && grpKeys.indexOf(k) < 0) { grpKeys.push(k); gruposU.push(grpLabel(g)); } });
    var reincFuera = (cfg.reincExcluir || []).map(function (c) { return norm(homologar(c)); });
    var controles = {};

    /* --- GLPI del período --- */
    var homologadas = [], fueraPeriodo = 0;
    var T = [];
    glpiAll.forEach(function (raw, idx) {
      if (raw.apertura === null || raw.apertura < mesIni || raw.apertura > FD) { fueraPeriodo++; return; }
      var cat = homologar(raw.categoria);
      if (cat !== String(raw.categoria).trim()) homologadas.push({ id: raw.id, de: raw.categoria, a: cat });
      var sgu = norm(raw.titulo).indexOf(marker) >= 0;
      var esPia = eq(raw.solicitante, cfg.piaSolicitante);
      var res = /^(resuelto|cerrado)$/.test(norm(raw.estado));
      var dur = res && raw.solucion !== null ? Math.max(0, Math.round((raw.solucion - raw.apertura) * 86400)) : null;
      var acc = cuentaDeTitulo(raw.titulo);
      T.push({
        raw: raw, idx: idx, id: raw.id, idNum: soloDigitos(raw.id), sgu: sgu, piaSol: esPia, pia: sgu && esPia, res: res, dur: dur,
        cat: cat, catK: norm(cat), grpL: grpLabel(raw.grupo), grpK: grpKey(raw.grupo),
        dAp: Math.floor(raw.apertura + 1e-9), dSol: res && raw.solucion !== null ? Math.floor(raw.solucion + 1e-9) : null,
        dCie: raw.cierre !== null ? Math.floor(raw.cierre + 1e-9) : null, cierre: raw.cierre,
        cuenta: acc.cuenta, nombreTitulo: acc.nombre
      });
    });
    var EN = {
      pia: function (t) { return t.pia; }, otras: function (t) { return t.sgu && !t.pia; },
      sgu: function (t) { return t.sgu; }, pais: function (t) { return !t.sgu; }
    };
    function de(g) { return T.filter(EN[g]); }
    var porGrupo = {};
    GRUPOS.forEach(function (g) { porGrupo[g] = { lista: de(g) }; });

    /* --- Tipificador del mes --- */
    var tipMes = [], tipFuera = 0, tipFueraSA = 0;
    tipAll.forEach(function (r) {
      if (r.fecha === null || r.fecha < mesIni || r.fecha >= mesFin) { tipFuera++; if (eq(r.sucursal, cfg.sucursal)) tipFueraSA++; return; }
      tipMes.push(r);
    });
    var tipSA = tipMes.filter(function (r) { return eq(r.sucursal, cfg.sucursal); });
    var tipOtras = tipMes.filter(function (r) { return !eq(r.sucursal, cfg.sucursal); });
    var fcr = tipSA.filter(function (r) { return eq(r.estatus, cfg.fcrStatus); }).length;
    var estatusN = tipSA.filter(function (r) { return eq(r.subcategoria, cfg.estatusSubcat) && !eq(r.estatus, cfg.fcrStatus); }).length;
    var estatusTodas = tipSA.filter(function (r) { return eq(r.subcategoria, cfg.estatusSubcat); }).length;
    var abonados = {}; tipSA.forEach(function (r) { if (r.cuenta) abonados[r.cuenta] = 1; });

    /* --- volúmenes --- */
    GRUPOS.forEach(function (g) {
      var L = porGrupo[g].lista, P = porGrupo[g];
      P.creados = L.length;
      P.solucionados = L.filter(function (t) { return t.res; }).length;
      P.tiempo = modaPromedio(L.filter(function (t) { return t.res && t.dur !== null; }).map(function (t) { return t.dur; }));
    });

    /* --- 4.1 fijos --- */
    var irNum = porGrupo.sgu.solucionados + fcr + estatusN, irDen = porGrupo.sgu.creados + fcr + estatusN;
    var fijos = {
      ir: { num: irNum, den: irDen, pct: irDen ? irNum / irDen : null },
      fcr: { n: fcr, den: tipSA.length, pct: tipSA.length ? fcr / tipSA.length : null },
      productividad: { casos: tipSA.length, abonados: Object.keys(abonados).length, escalados: porGrupo.pia.creados },
      estatus: estatusN, estatusTodas: estatusTodas,
      nps: cfg.nps || ''
    };

    /* --- ventana semanal --- */
    var dias = []; for (var d = wIni; d < wFin; d++) dias.push(d);
    GRUPOS.forEach(function (g) {
      var L = porGrupo[g].lista, P = porGrupo[g];
      var enV = L.filter(function (t) { return t.dAp >= wIni && t.dAp < wFin; });
      var cerradosMisma = enV.filter(function (t) { return t.dCie !== null && t.dCie >= wIni && t.dCie < wFin; }).length;
      P.semana = { abiertos: enV.length, cerradosMisma: cerradosMisma, pct: enV.length ? cerradosMisma / enV.length : null };
      var accR = 0, filas = dias.map(function (D) {
        var ab = 0, mismo = 0, resD = 0, pendAcc = 0;
        L.forEach(function (t) {
          if (t.dAp === D) { ab++; if (t.dSol === D) mismo++; }
          if (t.dSol === D) resD++;
          if (t.dAp >= wIni && t.dAp <= D && !(t.dSol !== null && t.dSol <= D)) pendAcc++;
        });
        accR += resD;
        return { serial: D, dia: dayName(D), fecha: fmtDate(D), fechaCorta: fmtDM(D), abiertos: ab, pendientes: ab - mismo, resueltos: resD, mismoDia: mismo, pendAcc: pendAcc, resAcc: accR, pct: ab ? mismo / ab : null };
      });
      var tot = filas.reduce(function (a, f) { a.abiertos += f.abiertos; a.pendientes += f.pendientes; a.resueltos += f.resueltos; a.mismoDia += f.mismoDia; return a; }, { abiertos: 0, pendientes: 0, resueltos: 0, mismoDia: 0 });
      tot.pendAcc = filas[filas.length - 1].pendAcc; tot.resAcc = filas[filas.length - 1].resAcc; tot.pct = tot.abiertos ? tot.mismoDia / tot.abiertos : null;
      var pico = filas.reduce(function (a, f) { return f.abiertos > (a ? a.abiertos : -1) ? f : a; }, null);
      P.jornada = { filas: filas, total: tot, pico: pico };
      P.gestion = {
        abiertos: enV.length,
        resueltos: L.filter(function (t) { return t.dSol !== null && t.dSol >= wIni && t.dSol < wFin; }).length,
        cerrados: L.filter(function (t) { return t.dCie !== null && t.dCie >= wIni && t.dCie < wFin; }).length,
        mismoDia: tot.mismoDia, pct: tot.pct
      };
    });

    /* --- reincidencia FTTH --- */
    function reincidencia(L) {
      var ftth = L.filter(function (t) { return t.catK.indexOf('ftth') >= 0 && reincFuera.indexOf(t.catK) < 0; });
      var porCuenta = {}, orden = [];
      ftth.forEach(function (t) {
        if (!t.cuenta) return;
        if (!porCuenta[t.cuenta]) { porCuenta[t.cuenta] = []; orden.push(t.cuenta); }
        porCuenta[t.cuenta].push(t);
      });
      var reinc = orden.filter(function (c) { return porCuenta[c].length >= 2; }).map(function (c) {
        var ts = porCuenta[c];
        var nombres = ts.map(function (t) { return t.nombreTitulo; }).filter(Boolean);
        var limpio = nombres.filter(function (n) { return !danado(n); })[0] || nombres[0] || '';
        var cats = []; ts.forEach(function (t) { var k = catCorta(t.cat); if (cats.indexOf(k) < 0) cats.push(k); });
        return { cuenta: c, nombre: limpio, categorias: cats, tickets: ts.map(function (t) { return { id: t.id, cat: t.cat, estado: t.raw.estado, pia: t.pia }; }) };
      });
      reinc.sort(function (a, b) { return b.tickets.length - a.tickets.length || a.nombre.localeCompare(b.nombre, 'es'); });
      var nt = reinc.reduce(function (a, r) { return a + r.tickets.length; }, 0);
      var porCat = {};
      reinc.forEach(function (r) { r.tickets.forEach(function (t) { var k = catCorta(t.cat); porCat[k] = (porCat[k] || 0) + 1; }); });
      return { abonados: reinc.length, tickets: nt, ftth: ftth.length, pct: ftth.length ? nt / ftth.length : null, detalle: reinc, porCategoria: porCat, sinCuenta: ftth.filter(function (t) { return !t.cuenta; }) };
    }
    GRUPOS.forEach(function (g) { porGrupo[g].reinc = reincidencia(porGrupo[g].lista); });

    /* --- upgrades y SVA --- */
    var cambios = T.filter(function (t) { return t.catK === norm(cfg.cambioPlanCat); }).map(function (t) {
      var d = direccionPlan(t.raw.titulo, t.raw.descripcion);
      return { t: t, dir: d.dir, reversion: d.reversion };
    });
    var pleyGlpi = T.filter(esPleyArriba);
    function tipDe(g) { return g === 'pais' ? tipOtras : (g === 'otras' ? [] : tipSA); }
    GRUPOS.forEach(function (g) {
      var P = porGrupo[g];
      var cg = cambios.filter(function (c) { return EN[g](c.t); });
      var upsG = cg.filter(function (c) { return c.dir === 'sube' && !c.reversion; });
      var ids = {}; upsG.forEach(function (c) { if (c.t.idNum) ids[c.t.idNum] = 1; });
      var tipUps = tipDe(g).filter(function (r) { return eq(r.subcategoria, cfg.aumentoSubcat); });
      var tipUpsNuevos = tipUps.filter(function (r) { return !(r.ticket && ids[r.ticket]); });
      var svaTip = tipDe(g).filter(function (r) { return (eq(r.categoria, 'Exitlag') || eq(r.categoria, 'Pley')) && /(^|[^a-z])activación/.test(norm(r.subcategoria)); });
      var svaG = pleyGlpi.filter(EN[g]);
      var svaIds = {}; svaG.forEach(function (t) { if (t.idNum) svaIds[t.idNum] = 1; });
      var svaTipNuevos = svaTip.filter(function (r) { return !(r.ticket && svaIds[r.ticket]); });
      P.upgrades = {
        n: upsG.length + tipUpsNuevos.length, glpi: upsG.map(function (c) { return c.t.id; }), tip: tipUps.length, repetidos: tipUps.length - tipUpsNuevos.length,
        cambiosPlan: cg.length, bajas: cg.filter(function (c) { return c.dir === 'baja' || (c.dir === 'sube' && c.reversion); }).length,
        reversiones: cg.filter(function (c) { return c.reversion; }).map(function (c) { return c.t.id; })
      };
      P.sva = { n: svaG.length + svaTipNuevos.length, glpi: svaG.map(function (t) { return t.id; }), tip: svaTip.length };
    });

    /* --- tablas 5.1 y 5.2 --- */
    function tablaTiempo(campo, etiquetas, claves) {
      var filas = etiquetas.map(function (lab, i) {
        var f = function (t) { return t[campo] === claves[i]; };
        var row = { label: lab, negrita: cfg.gruposNegrita.indexOf(lab) >= 0 && campo === 'grpK' };
        GRUPOS.forEach(function (g) { row[g] = modaPromedio(porGrupo[g].lista.filter(function (t) { return f(t) && t.res && t.dur !== null; }).map(function (t) { return t.dur; })); row[g].texto = celdaTiempo(row[g]); });
        return row;
      });
      var otro = { label: 'Otro', otro: true };
      GRUPOS.forEach(function (g) { otro[g] = modaPromedio(porGrupo[g].lista.filter(function (t) { return claves.indexOf(t[campo]) < 0 && t.res && t.dur !== null; }).map(function (t) { return t.dur; })); otro[g].texto = celdaTiempo(otro[g]); });
      filas.push(otro);
      var tot = { label: 'Total', total: true };
      GRUPOS.forEach(function (g) { tot[g] = Object.assign({}, porGrupo[g].tiempo); tot[g].texto = celdaTiempo(tot[g], true); });
      filas.push(tot);
      return filas;
    }
    var tiempoCategoria = tablaTiempo('catK', cfg.categorias, catKeys);
    var tiempoGrupo = tablaTiempo('grpK', gruposU, grpKeys);

    /* --- tabla 5.3 --- */
    function cr(L) { return { creados: L.length, solucionados: L.filter(function (t) { return t.res; }).length }; }
    var productividad = [{ label: cfg.estatusSubcat, estatus: true, pia: { creados: estatusN, solucionados: null }, otras: { creados: null, solucionados: null }, sgu: { creados: null, solucionados: null }, pais: { creados: null, solucionados: null } }];
    cfg.categorias.concat(['Otro']).forEach(function (lab, i) {
      var row = { label: lab, otro: lab === 'Otro' && i === cfg.categorias.length };
      GRUPOS.forEach(function (g) { row[g] = cr(porGrupo[g].lista.filter(function (t) { return row.otro ? catKeys.indexOf(t.catK) < 0 : t.catK === catKeys[i]; })); });
      productividad.push(row);
    });
    var totP = { label: 'Total', total: true };
    GRUPOS.forEach(function (g) { totP[g] = cr(porGrupo[g].lista); });
    productividad.push(totP);

    /* --- desglose de "Otro" (solo grupos SGU: PIA, otras unidades, SGU total) --- */
    function desglose(campo, claves, labelDe, tipo) {
      var out = {};
      ['pia', 'otras', 'sgu'].forEach(function (g) {
        var L = porGrupo[g].lista.filter(function (t) { return claves.indexOf(t[campo]) < 0; });
        var orden = [], por = {};
        L.forEach(function (t) { var k = t[campo]; if (!por[k]) { por[k] = { label: labelDe(t) || (campo === 'grpK' ? 'Sin grupo asignado' : 'Sin categoría'), lista: [] }; orden.push(k); } por[k].lista.push(t); });
        var filas = orden.map(function (k) {
          var x = por[k], row = { label: x.label };
          if (tipo === 'tiempo') { row.v = modaPromedio(x.lista.filter(function (t) { return t.res && t.dur !== null; }).map(function (t) { return t.dur; })); row.v.texto = celdaTiempo(row.v); row.orden = row.v.n; }
          else { row.v = cr(x.lista); row.orden = row.v.creados; }
          return row;
        }).filter(function (r) { return tipo === 'tiempo' ? r.v.n > 0 : r.v.creados > 0; });
        filas.sort(function (a, b) { return b.orden - a.orden || a.label.localeCompare(b.label, 'es'); });
        var tot = { label: 'Total "Otro"', total: true };
        if (tipo === 'tiempo') { tot.v = modaPromedio(L.filter(function (t) { return t.res && t.dur !== null; }).map(function (t) { return t.dur; })); tot.v.texto = celdaTiempo(tot.v, true); }
        else tot.v = cr(L);
        out[g] = { filas: filas, total: tot };
      });
      return out;
    }
    var otros = {
      tiempoCategoria: desglose('catK', catKeys, function (t) { return t.cat; }, 'tiempo'),
      productividad: desglose('catK', catKeys, function (t) { return t.cat; }, 'prod'),
      tiempoGrupo: desglose('grpK', grpKeys, function (t) { return t.grpL; }, 'tiempo')
    };

    /* --- comparativos --- */
    function comparar(a, b) {
      var A = porGrupo[a].tiempo, B = porGrupo[b].tiempo;
      if (!A.n || !B.n) return { a: a, b: b, valor: '-', ganador: null, detalle: '' };
      var dif = Math.abs(A.prom - B.prom), gan = A.prom < B.prom ? a : (B.prom < A.prom ? b : null);
      return { a: a, b: b, dif: dif, valor: fmtPalabras(dif), ganador: gan, detalle: ETIQUETAS[a] + ' ' + fmtD(A.prom) + ' vs. ' + ETIQUETAS[b] + ' ' + fmtD(B.prom) };
    }
    var comparativos = { pia_otras: comparar('pia', 'otras'), sgu_pais: comparar('sgu', 'pais'), pia_pais: comparar('pia', 'pais') };

    /* --- controles de calidad (sección 8) --- */
    var SGU = porGrupo.sgu.lista;
    controles.tipFuera = { n: tipFuera, sa: tipFueraSA };
    controles.glpiFuera = { n: fueraPeriodo };
    controles.homologadas = homologadas;
    controles.duplicadosId = glpiAll.duplicados || 0;
    var posibles = [];
    var porCC = {};
    SGU.forEach(function (t) { if (!t.cuenta) return; var k = t.cuenta + '|' + t.catK; (porCC[k] = porCC[k] || []).push(t); });
    Object.keys(porCC).forEach(function (k) {
      var L = porCC[k].slice().sort(function (x, y) { return x.raw.apertura - y.raw.apertura; });
      for (var i = 1; i < L.length; i++) if ((L[i].raw.apertura - L[i - 1].raw.apertura) * 1440 < 60) posibles.push({ cuenta: L[i].cuenta, cat: L[i].cat, ids: [L[i - 1].id, L[i].id], minutos: Math.round((L[i].raw.apertura - L[i - 1].raw.apertura) * 1440) });
    });
    controles.posiblesDuplicados = posibles;
    var inconsistentes = [], nombresPorCuenta = {};
    SGU.forEach(function (t) {
      if (!t.cuenta) return;
      if (t.raw.cliente && t.nombreTitulo && hkey(t.raw.cliente) !== hkey(t.nombreTitulo)) inconsistentes.push({ cuenta: t.cuenta, id: t.id, titulo: t.nombreTitulo, campo: t.raw.cliente, tipo: 'Título distinto de "Nombre Cliente"' });
      (nombresPorCuenta[t.cuenta] = nombresPorCuenta[t.cuenta] || {})[hkey(t.nombreTitulo)] = t.nombreTitulo;
    });
    Object.keys(nombresPorCuenta).forEach(function (c) { var ns = Object.keys(nombresPorCuenta[c]).filter(Boolean); if (ns.length > 1) inconsistentes.push({ cuenta: c, id: '', titulo: ns.map(function (k) { return nombresPorCuenta[c][k]; }).join(' / '), campo: '', tipo: 'Cuenta con nombres distintos' }); });
    controles.nombres = inconsistentes;
    controles.sinCuenta = SGU.filter(function (t) { return !t.cuenta; }).map(function (t) { return { id: t.id, titulo: t.raw.titulo }; });
    controles.piaFueraSGU = T.filter(function (t) { return t.piaSol && !t.sgu; }).map(function (t) { return { id: t.id, titulo: t.raw.titulo }; });
    controles.planIndefinido = cambios.filter(function (c) { return c.dir === 'indefinido'; }).map(function (c) { return { id: c.t.id, grupo: c.t.pia ? 'PIA' : (c.t.sgu ? 'SGU otras unidades' : 'País'), extracto: String(c.t.raw.descripcion || c.t.raw.titulo).replace(/\s+/g, ' ').slice(0, 180) }; });
    controles.reversiones = cambios.filter(function (c) { return c.reversion; }).map(function (c) { return { id: c.t.id, extracto: String(c.t.raw.descripcion).replace(/\s+/g, ' ').slice(0, 180) }; });
    var tot51 = tiempoCategoria[tiempoCategoria.length - 1], tot52 = tiempoGrupo[tiempoGrupo.length - 1];
    var sum51 = {}, sum52 = {}, sum53 = {};
    GRUPOS.forEach(function (g) {
      sum51[g] = tiempoCategoria.slice(0, -1).reduce(function (a, r) { return a + r[g].n; }, 0);
      sum52[g] = tiempoGrupo.slice(0, -1).reduce(function (a, r) { return a + r[g].n; }, 0);
      sum53[g] = productividad.slice(1, -1).reduce(function (a, r) { return { c: a.c + r[g].creados, s: a.s + r[g].solucionados }; }, { c: 0, s: 0 });
    });
    controles.totales = GRUPOS.map(function (g) {
      var ok = sum51[g] === tot51[g].n && sum52[g] === tot52[g].n && tot51[g].n === porGrupo[g].solucionados && sum53[g].c === porGrupo[g].creados && sum53[g].s === porGrupo[g].solucionados;
      return { grupo: ETIQUETAS[g], creados: porGrupo[g].creados, solucionados: porGrupo[g].solucionados, t51: sum51[g], t52: sum52[g], t53c: sum53[g].c, t53s: sum53[g].s, ok: ok };
    });

    /* --- brechas por categoría (para notas) --- */
    function brechas(a, b) {
      return tiempoCategoria.filter(function (r) { return !r.total && !r.otro && r[a].n && r[b].n; })
        .map(function (r) { return { label: r.label, dif: r[a].prom - r[b].prom }; })
        .sort(function (x, y) { return Math.abs(y.dif) - Math.abs(x.dif); });
    }

    /* --- opciones de filtros --- */
    var oc = {}, og = {}, of = {};
    T.forEach(function (t) {
      var c = oc[t.catK] || (oc[t.catK] = { label: t.cat || '(Sin categoría)', key: t.catK, sgu: 0, total: 0 }); c.total++; if (t.sgu) c.sgu++;
      var g = og[t.grpK] || (og[t.grpK] = { label: t.grpL || '(Sin grupo)', key: t.grpK, sgu: 0, total: 0 }); g.total++; if (t.sgu) g.sgu++;
      if (t.catK.indexOf('ftth') >= 0) { var f = of[t.catK] || (of[t.catK] = { label: t.cat, key: t.catK, sgu: 0, total: 0 }); f.total++; if (t.sgu) f.sgu++; }
    });
    function lista(o) { return Object.keys(o).map(function (k) { return o[k]; }).filter(function (x) { return x.key; }).sort(function (a, b) { return b.sgu - a.sgu || b.total - a.total || a.label.localeCompare(b.label); }); }

    var resumenGrupos = {};
    GRUPOS.forEach(function (g) {
      var P = porGrupo[g];
      resumenGrupos[g] = {
        creados: P.creados, solucionados: P.solucionados, pctSol: P.creados ? P.solucionados / P.creados : null,
        prom: P.tiempo.prom, moda: P.tiempo.moda, semana: P.semana, gestion: P.gestion, jornada: P.jornada,
        reinc: P.reinc, upgrades: P.upgrades, sva: P.sva
      };
    });

    return {
      cfg: cfg,
      periodo: MESES[fp.mo - 1], anio: fp.y,
      periodoTxt: MESES[fp.mo - 1] + ' (1 al ' + fp.d + ')',
      corteTxt: (function () { var h = fp.h % 12 === 0 ? 12 : fp.h % 12; return h + (fp.mi ? ':' + pad(fp.mi) : '') + (fp.h < 12 ? ' AM ' : ' PM ') + pad(fp.d) + '-' + pad(fp.mo) + '-' + fp.y; })(),
      corteFecha: fmtDate(FD),
      fuentesTxt: 'GLPI y Tipificador (solo ' + MESES[fp.mo - 1].toLowerCase() + ')',
      ventana: { desde: fmtDate(wIni), hasta: fmtDate(wFin - 1), corta: partsFromSerial(wIni).d + '–' + fmtDM(wFin - 1) },
      etiquetas: ETIQUETAS, etiquetasLargas: ETIQUETAS_LARGAS,
      fijos: fijos, g: resumenGrupos, comparativos: comparativos,
      tiempoCategoria: tiempoCategoria, tiempoGrupo: tiempoGrupo, productividad: productividad, otros: otros,
      reincidencia: porGrupo.sgu.reinc,
      brechas: brechas,
      controles: controles,
      volumen: { glpi: T.length, tipSA: tipSA.length, tipMes: tipMes.length },
      opciones: { categorias: lista(oc), grupos: lista(og), ftth: lista(of) },
      reincExcluidas: (cfg.reincExcluir || []).map(homologar)
    };
  }

  /** Valores compactos de un corte, para guardar en D1 y comparar meses. */
  function snapshot(R) {
    var o = { corte: R.corteFecha, periodo: R.periodoTxt, ir: R.fijos.ir, fcr: R.fijos.fcr, prod: R.fijos.productividad, estatus: R.fijos.estatus, g: {} };
    GRUPOS.forEach(function (k) {
      var x = R.g[k];
      o.g[k] = { creados: x.creados, solucionados: x.solucionados, prom: x.prom, moda: x.moda, semana: x.semana.pct, mismoDia: x.gestion.pct, reincAb: x.reinc.abonados, reincTk: x.reinc.tickets, upgrades: x.upgrades.n, sva: x.sva.n };
    });
    o.comparativos = {}; Object.keys(R.comparativos).forEach(function (k) { o.comparativos[k] = { dif: R.comparativos[k].dif, ganador: R.comparativos[k].ganador }; });
    return o;
  }

  var api = {
    VERSION: 2, DEFAULTS: DEFAULTS, GRUPOS: GRUPOS, ETIQUETAS: ETIQUETAS, ETIQUETAS_LARGAS: ETIQUETAS_LARGAS,
    compute: compute, snapshot: snapshot, loadGLPI: loadGLPI, loadTipif: loadTipif,
    parseDate: parseDate, serialFromParts: serialFromParts, partsFromSerial: partsFromSerial,
    fmtD: fmtD, fmtPalabras: fmtPalabras, fmtDate: fmtDate, miles: miles, pct: pct, tickets: tickets, catCorta: catCorta,
    cuentaDeTitulo: cuentaDeTitulo, direccionPlan: direccionPlan, modaPromedio: modaPromedio, celdaTiempo: celdaTiempo, homologar: homologar,
    norm: norm, grpKey: grpKey, grpLabel: grpLabel, MESES: MESES
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PIAEngine = api;
})(typeof window !== 'undefined' ? window : this);
