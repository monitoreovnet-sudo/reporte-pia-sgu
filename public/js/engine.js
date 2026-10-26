/* Motor de cálculo — Indicadores SGU (San Agustín) vs País
 * Replica las fórmulas del libro "Indicadores SGU vs Pais.xlsx" (hoja CUENTAS MENSUAL).
 * Todas las fechas se manejan como número de serie de Excel (días desde 1899-12-30), en hora local.
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    sucursal: 'San Agustín',
    sguMarker: '- SGU -',
    piaSolicitante: 'Figueroa Atencio Gabriel Alberto',
    fcrStatus: 'Resuelto en 1er. Contacto',
    escaladoStatus: 'Escalado',
    estatusSubcat: 'Estatus de un ticket de reporte',
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
    grupos: [
      'ATC No Presencial',
      'Cobranzas Masivas',
      'Contratista San Agustín',
      'Tesoreria Masivos',
      'COR + Coordinación de reparación Técnico FTTX + ATC Presencial',
      'COR + UDN-CARACAS + Activaciones',
      'COR + UDN-CARACAS + Cobranzas Masivas',
      'COR + UDN-CARACAS + Cobranzas Masivas + Activaciones',
      'COR + UDN-CARACAS + Coordinación de reparación Técnico FTTX',
      'Soporte Aplicaciones + Cobranzas Masivas'
    ],
    fallasCats: [
      'FTTH > Sin conexión',
      'FTTH > Intermitencias',
      'FTTH > Configuración de equipo',
      'FTTH > Configuración de canales',
      'FTTH > Cambio de clave WiFi',
      'FTTH > Visita técnica'
    ],
    sva: [
      { label: 'Pley', categoria: 'Pley', subcategoria: '*Activación*' },
      { label: 'Contigo +', categoria: 'Contigo +', subcategoria: '*Activación*' },
      { label: 'Exitlag', categoria: 'Exitlag', subcategoria: '*Activación*' },
      { label: 'Cambio de plan - Disminución', categoria: '', subcategoria: 'Cambio de plan - Disminución' }
    ]
  };

  /* ---------- utilidades de texto ---------- */
  function norm(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function grpKey(g) { // varios grupos en una celda (saltos de línea) -> "A + B"
    return norm(String(g == null ? '' : g).split(/\r?\n|<br\s*\/?>|\s\+\s/i).map(function (x) { return x.trim(); }).filter(Boolean).join(' + '));
  }
  function stripAccents(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function hkey(s) { return stripAccents(norm(s)).replace(/[^a-z0-9]+/g, ' ').trim(); }
  function eq(a, b) { return norm(a) === norm(b); }
  function fixText(s) { // corrige textos con codificación dañada (ej. "RODRÃ­GUEZ")
    s = s == null ? '' : String(s);
    if (/[ÃÂ]/.test(s)) { try { return decodeURIComponent(escape(s)); } catch (e) { return s; } }
    return s;
  }
  function likeMatch(value, pattern) { // comodines * y ? como en COUNTIFS
    if (!pattern) return true;
    var re = '^' + norm(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
    return new RegExp(re).test(norm(value));
  }

  /* ---------- fechas ---------- */
  var MS_DAY = 86400000, EPOCH = Date.UTC(1899, 11, 30);
  function serialFromParts(y, mo, d, h, mi, s) {
    return (Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0) - EPOCH) / MS_DAY;
  }
  function partsFromSerial(x) {
    var dt = new Date(EPOCH + Math.round(x * 86400) * 1000);
    return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate(), h: dt.getUTCHours(), mi: dt.getUTCMinutes(), s: dt.getUTCSeconds(), wd: dt.getUTCDay() };
  }
  function parseDate(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null;
    if (v instanceof Date) {
      if (isNaN(v)) return null;
      return serialFromParts(v.getFullYear(), v.getMonth() + 1, v.getDate(), v.getHours(), v.getMinutes(), v.getSeconds());
    }
    var s = String(v).trim();
    if (!s) return null;
    var m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return serialFromParts(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([aApP]\.?\s*[mM]\.?)?)?/);
    if (m) {
      var y = +m[3]; if (y < 100) y += 2000;
      var h = +(m[4] || 0);
      if (m[7]) { var pm = /p/i.test(m[7]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
      return serialFromParts(y, +m[2], +m[1], h, +(m[5] || 0), +(m[6] || 0)); // dd/mm/aaaa (formato Venezuela)
    }
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    return null;
  }
  var DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(x) { var p = partsFromSerial(x); return pad(p.d) + '/' + pad(p.mo) + '/' + p.y; }
  function dayName(x) { return DIAS[partsFromSerial(x).wd]; }

  /* ---------- duración (equivalente a los TEXT() del Excel) ---------- */
  function durParts(days) {
    var secs = Math.round(days * 86400);
    return { totalH: Math.floor(secs / 3600), d: Math.floor(secs / 86400), h: Math.floor((secs % 86400) / 3600), m: Math.floor((secs % 3600) / 60), s: secs % 60, secs: secs };
  }
  // Formato de las tablas por categoría / grupo
  function fmtDur(days) {
    if (days === null || days === undefined || isNaN(days)) return '-';
    var p = durParts(days);
    if (days < 1 / 1440) return p.secs + ' segundos';
    if (days < 1 / 24) return Math.floor(p.secs / 60) + ' minutos';
    if (days < 1) return p.totalH + ' horas ' + p.m + ' minutos';
    if (days < 2) return '1 día ' + p.h + ' horas';
    return p.d + ' días ' + p.h + ' horas';
  }
  // Formato corto para tarjetas (sin días = horas y minutos)
  function fmtDurCard(days) {
    if (days === null || days === undefined || isNaN(days)) return '-';
    var p = durParts(days);
    if (days < 1 / 24) return Math.floor(p.secs / 60) + ' minutos';
    if (days < 1) return p.totalH + (p.totalH === 1 ? ' hora ' : ' horas ') + p.m + ' min';
    return (p.d === 1 ? '1 día' : p.d + ' días') + ' y ' + p.h + (p.h === 1 ? ' hora' : ' horas');
  }

  /* ---------- lectura de tablas ---------- */
  var GLPI_COLS = {
    id: ['ID'],
    titulo: ['Título', 'Titulo'],
    estado: ['Estado'],
    categoria: ['Categoría', 'Categoria'],
    apertura: ['Fecha de apertura'],
    solucion: ['Fecha de solución', 'Fecha de solucion'],
    solicitante: ['Solicitante - Solicitante', 'Solicitante'],
    grupo: ['Asignado a - Grupo de técnicos', 'Asignado a - Grupo de tecnicos', 'Grupo de técnicos'],
    cliente: ['Complementos - Datos Clientes - Nombre Cliente', 'Nombre Cliente'],
    lugar: ['Lugar']
  };
  var GLPI_REQ = ['titulo', 'estado', 'categoria', 'apertura', 'solucion', 'solicitante', 'grupo'];
  var TIP_COLS = {
    fecha: ['Fecha'],
    sucursal: ['Sucursal'],
    categoria: ['Categoría', 'Categoria'],
    subcategoria: ['Subcategoría', 'Subcategoria'],
    motivo: ['Motivo'],
    estatus: ['Estatus'],
    ticket: ['Ticket GLPI'],
    nombre: ['Nombre y Apellido'],
    cedula: ['Cédula de identidad', 'Cedula de identidad']
  };
  var TIP_REQ = ['sucursal', 'categoria', 'subcategoria', 'estatus'];

  function mapHeader(rows, spec, req) {
    var best = null;
    for (var r = 0; r < Math.min(rows.length, 25); r++) {
      var row = rows[r] || [], idx = {}, hits = 0;
      var keys = row.map(hkey);
      Object.keys(spec).forEach(function (k) {
        for (var a = 0; a < spec[k].length; a++) {
          var want = hkey(spec[k][a]);
          var c = keys.indexOf(want);
          if (c >= 0) { idx[k] = c; hits++; return; }
        }
      });
      var ok = req.every(function (k) { return idx[k] !== undefined; });
      if (ok && (!best || hits > best.hits)) best = { row: r, idx: idx, hits: hits };
    }
    if (!best) {
      var names = req.map(function (k) { return '"' + spec[k][0] + '"'; }).join(', ');
      throw new Error('No se encontraron las columnas requeridas: ' + names);
    }
    return best;
  }

  function loadGLPI(rows) {
    var h = mapHeader(rows, GLPI_COLS, GLPI_REQ), out = [], i = h.idx;
    for (var r = h.row + 1; r < rows.length; r++) {
      var row = rows[r]; if (!row) continue;
      var titulo = row[i.titulo];
      if ((titulo === null || titulo === undefined || titulo === '') && (row[i.estado] === null || row[i.estado] === undefined || row[i.estado] === '')) continue;
      out.push({
        id: i.id !== undefined ? String(row[i.id] == null ? '' : row[i.id]).trim() : '',
        titulo: titulo == null ? '' : fixText(titulo),
        estado: row[i.estado],
        categoria: row[i.categoria] == null ? '' : String(row[i.categoria]),
        apertura: parseDate(row[i.apertura]),
        solucion: parseDate(row[i.solucion]),
        solicitante: row[i.solicitante],
        grupo: row[i.grupo] == null ? '' : String(row[i.grupo]),
        cliente: i.cliente !== undefined && row[i.cliente] != null ? fixText(row[i.cliente]).trim() : '',
        lugar: i.lugar !== undefined && row[i.lugar] != null ? String(row[i.lugar]) : ''
      });
    }
    if (!out.length) throw new Error('El archivo de GLPI no tiene tickets.');
    var seen = {}, dedup = [];
    out.forEach(function (t) {
      var k = t.id.replace(/\s/g, '');
      if (k && seen[k]) return;
      if (k) seen[k] = true;
      dedup.push(t);
    });
    dedup.duplicados = out.length - dedup.length;
    return dedup;
  }

  function loadTipif(rows) {
    var h = mapHeader(rows, TIP_COLS, TIP_REQ), out = [], i = h.idx;
    for (var r = h.row + 1; r < rows.length; r++) {
      var row = rows[r]; if (!row) continue;
      if (row[i.sucursal] == null || row[i.sucursal] === '') continue;
      var o = {};
      Object.keys(i).forEach(function (k) { o[k] = row[i[k]]; });
      if (o.fecha !== undefined) o.fecha = parseDate(o.fecha);
      out.push(o);
    }
    if (!out.length) throw new Error('El archivo del TIPIFICADOR no tiene registros.');
    return out;
  }

  /* ---------- cálculo ---------- */
  function compute(glpiRows, tipRows, opts) {
    var cfg = Object.assign({}, DEFAULTS, opts || {});
    var corte = cfg.corte; // número de serie con la fecha y hora de descarga
    if (typeof corte !== 'number') throw new Error('Falta la fecha y hora de descarga.');
    var corteDay = Math.floor(corte + 1e-9);

    var marker = norm(cfg.sguMarker);
    var catSet = cfg.categorias.map(norm), grpSet = cfg.grupos.map(grpKey), fallaSet = cfg.fallasCats.map(norm);

    var T = glpiRows.map(function (t) {
      var sgu = norm(t.titulo).indexOf(marker) >= 0;
      var est = norm(t.estado);
      var res = est === 'resuelto' || est === 'cerrado';
      var dur = (t.solucion != null && t.apertura != null) ? t.solucion - t.apertura : 0;
      return {
        raw: t, sgu: sgu, pia: eq(t.solicitante, cfg.piaSolicitante), res: res, dur: dur,
        cat: norm(t.categoria), grp: grpKey(t.grupo),
        dAp: t.apertura != null ? Math.floor(t.apertura + 1e-9) : null,
        dSol: t.solucion != null ? Math.floor(t.solucion + 1e-9) : null
      };
    });

    // Segmentos usados en las tablas
    var SEG = {
      pia: function (t) { return t.sgu && t.pia; },
      otras: function (t) { return t.sgu && !t.pia; },
      sgu: function (t) { return t.sgu; },
      pais: function (t) { return !t.sgu; }
    };
    function stats(filter) {
      var n = 0, sum = 0;
      for (var k = 0; k < T.length; k++) { var t = T[k]; if (t.res && filter(t)) { n++; sum += t.dur; } }
      return { n: n, avg: n ? sum / n : null };
    }
    function count(filter) { var n = 0; for (var k = 0; k < T.length; k++) if (filter(T[k])) n++; return n; }

    /* --- Tipificador --- */
    var tipSA = tipRows.filter(function (r) { return eq(r.sucursal, cfg.sucursal); });
    var fcr = tipSA.filter(function (r) { return eq(r.estatus, cfg.fcrStatus); }).length;
    var tipEstatus = tipSA.filter(function (r) { return !eq(r.estatus, cfg.fcrStatus) && eq(r.subcategoria, cfg.estatusSubcat); }).length;
    var escalados = tipSA.filter(function (r) { return eq(r.estatus, cfg.escaladoStatus); }).length;
    var sva = cfg.sva.map(function (s) {
      var n = tipSA.filter(function (r) {
        return (!s.categoria || likeMatch(r.categoria, s.categoria)) && likeMatch(r.subcategoria, s.subcategoria);
      }).length;
      return { label: s.label, n: n };
    });
    var svaTotal = sva.reduce(function (a, b) { return a + b.n; }, 0);

    /* --- GLPI: totales --- */
    var sguTotal = count(SEG.sgu), sguRes = count(function (t) { return t.sgu && t.res; });
    var paisTotal = count(SEG.pais), paisRes = count(function (t) { return !t.sgu && t.res; });
    var piaTotal = count(SEG.pia), piaRes = count(function (t) { return t.sgu && t.pia && t.res; });
    var otrasTotal = count(SEG.otras), otrasRes = count(function (t) { return t.sgu && !t.pia && t.res; });

    /* --- Índice de resolución PIA --- */
    var irNum = sguRes + fcr + tipEstatus, irDen = sguTotal + fcr + tipEstatus;

    /* --- Comparativo PIA vs regular --- */
    var sPIA = stats(SEG.pia), sOtras = stats(SEG.otras), sSGU = stats(SEG.sgu), sPais = stats(SEG.pais);
    var comparativo = { valor: '-', aFavor: '' , dif: null};
    if (sPIA.n && sOtras.n) {
      var dif = Math.abs(sOtras.avg - sPIA.avg);
      comparativo.dif = dif;
      comparativo.valor = fmtDurCard(dif);
      comparativo.aFavor = sOtras.avg > sPIA.avg ? 'a favor de PIA' : (sPIA.avg > sOtras.avg ? 'a favor de Otras Unidades' : 'Sin diferencia');
    }

    /* --- Tabla por categoría (tiempo de resolución) --- */
    function inList(field, list) { return function (t) { return list.indexOf(t[field]) >= 0; }; }
    function notIn(field, list) { return function (t) { return list.indexOf(t[field]) < 0; }; }
    function both(a, b) { return function (t) { return a(t) && b(t); }; }
    function tablaTiempo(field, labels, set) {
      var keyer = field === 'grp' ? grpKey : norm;
      var rows = labels.map(function (lab) {
        var f = function (t) { return t[field] === keyer(lab); };
        return { label: lab, pia: stats(both(SEG.pia, f)), otras: stats(both(SEG.otras, f)), sgu: stats(both(SEG.sgu, f)), pais: stats(both(SEG.pais, f)) };
      });
      var o = notIn(field, set);
      rows.push({ label: 'Otro', otro: true, pia: stats(both(SEG.pia, o)), otras: stats(both(SEG.otras, o)), sgu: stats(both(SEG.sgu, o)), pais: stats(both(SEG.pais, o)) });
      rows.push({ label: 'Total / Promedio', total: true, pia: sPIA, otras: sOtras, sgu: sSGU, pais: sPais });
      return rows;
    }
    var tiempoCategoria = tablaTiempo('cat', cfg.categorias, catSet);
    var tiempoGrupo = tablaTiempo('grp', cfg.grupos, grpSet);

    /* --- Productividad por categoría (creados vs solucionados) --- */
    function cr(filter) { return { creados: count(filter), resueltos: count(function (t) { return t.res && filter(t); }) }; }
    var prodCats = Array.isArray(cfg.categoriasProd) ? cfg.categoriasProd : cfg.categorias;
    var prodSet = prodCats.map(norm);
    var productividad = [{
      label: cfg.estatusSubcat, tipificador: true,
      pia: { creados: tipSA.filter(function (r) { return eq(r.subcategoria, cfg.estatusSubcat); }).length, resueltos: null },
      otras: { creados: null, resueltos: null }, sgu: { creados: null, resueltos: null }, pais: { creados: null, resueltos: null }
    }];
    prodCats.concat(['Otro']).forEach(function (lab, ix) {
      var f = ix < prodCats.length ? function (t) { return t.cat === norm(lab); } : notIn('cat', prodSet);
      productividad.push({ label: lab, pia: cr(both(SEG.pia, f)), otras: cr(both(SEG.otras, f)), sgu: cr(both(SEG.sgu, f)), pais: cr(both(SEG.pais, f)) });
    });
    productividad.push({ label: 'Total', total: true, pia: cr(SEG.pia), otras: cr(SEG.otras), sgu: cr(SEG.sgu), pais: cr(SEG.pais) });

    /* --- Resolución en la jornada (7 días previos a la descarga) --- */
    var dias = [];
    for (var k = 7; k >= 1; k--) dias.push(corteDay - k);
    function jornada(filter) {
      var accP = 0, accR = 0, filas = dias.map(function (d) {
        var ab = 0, mismoDia = 0, resDia = 0;
        for (var j = 0; j < T.length; j++) {
          var t = T[j]; if (!filter(t)) continue;
          if (t.dAp === d) { ab++; if (t.res && t.dSol === d) mismoDia++; }
          if (t.res && t.dSol === d) resDia++;
        }
        var pend = ab - mismoDia;
        accP += pend; accR += resDia;
        return { dia: dayName(d), fecha: fmtDate(d), serial: d, abiertos: ab, pendientes: pend, resueltos: resDia, mismoDia: mismoDia, accPend: accP, accRes: accR, pct: ab ? mismoDia / ab : null };
      });
      var tot = filas.reduce(function (a, f) { a.abiertos += f.abiertos; a.pendientes += f.pendientes; a.resueltos += f.resueltos; a.mismoDia += f.mismoDia; return a; }, { abiertos: 0, pendientes: 0, resueltos: 0, mismoDia: 0 });
      tot.accPend = accP; tot.accRes = accR; tot.pct = tot.abiertos ? tot.mismoDia / tot.abiertos : null;
      return { filas: filas, total: tot };
    }
    var jorn = { pia: jornada(SEG.pia), otras: jornada(SEG.otras), sgu: jornada(SEG.sgu), pais: jornada(SEG.pais) };

    /* --- Reincidencia de clientes (fallas relacionadas) --- */
    function clienteKey(t) {
      var parts = t.raw.titulo.split(' - ').map(function (s) { return s.trim(); });
      var ced = null, nombre = t.raw.cliente;
      for (var p = parts.length - 1; p >= 0; p--) {
        if (/^[VEJvej]?-?\d{6,9}$/.test(parts[p].replace(/[.\s]/g, ''))) { ced = parts[p].replace(/[^\d]/g, ''); if (!nombre && p > 0) nombre = parts[p - 1]; break; }
      }
      if (!nombre) nombre = parts.length > 3 ? parts[3] : t.raw.titulo;
      var key = t.raw.cliente ? 'N' + hkey(t.raw.cliente) : (ced ? 'C' + ced : 'N' + hkey(nombre));
      return { key: key, nombre: nombre, cedula: ced };
    }
    var grupos = {};
    T.forEach(function (t) {
      if (!t.sgu || fallaSet.indexOf(t.cat) < 0) return;
      var c = clienteKey(t);
      var g = grupos[c.key] || (grupos[c.key] = { nombre: c.nombre, cedula: c.cedula, tickets: [] });
      if (!g.nombre && c.nombre) g.nombre = c.nombre;
      g.tickets.push({ id: t.raw.id, categoria: t.raw.categoria, estado: t.raw.estado, apertura: t.raw.apertura });
    });
    var reinc = Object.keys(grupos).map(function (k) { return grupos[k]; })
      .filter(function (g) { return g.tickets.length >= 2; })
      .sort(function (a, b) { return b.tickets.length - a.tickets.length || String(a.nombre).localeCompare(String(b.nombre)); });
    var reincTickets = reinc.reduce(function (a, g) { return a + g.tickets.length; }, 0);
    var reincCat = {};
    reinc.forEach(function (g) { g.tickets.forEach(function (t) { var c = t.categoria.replace(/^FTTH > /, ''); reincCat[c] = (reincCat[c] || 0) + 1; }); });

    /* --- Valores disponibles para los filtros --- */
    function opciones() {
      var cats = {}, grps = {};
      T.forEach(function (t) {
        var c = cats[t.cat] || (cats[t.cat] = { label: String(t.raw.categoria).trim() || '(Sin categoría)', key: t.cat, sgu: 0, total: 0 });
        c.total++; if (t.sgu) c.sgu++;
        var gl = String(t.raw.grupo || '').split(/\r?\n|<br\s*\/?>|\s\+\s/i).map(function (x) { return x.trim(); }).filter(Boolean).join(' + ');
        var g = grps[t.grp] || (grps[t.grp] = { label: gl || '(Sin grupo)', key: t.grp, sgu: 0, total: 0 });
        g.total++; if (t.sgu) g.sgu++;
      });
      function list(o) { return Object.keys(o).map(function (k) { return o[k]; }).filter(function (x) { return x.key; }).sort(function (a, b) { return b.sgu - a.sgu || b.total - a.total || a.label.localeCompare(b.label); }); }
      return { categorias: list(cats), grupos: list(grps) };
    }

    /* --- Período --- */
    var cp = partsFromSerial(corte);
    var h12 = cp.h % 12 === 0 ? 12 : cp.h % 12;
    var corteTxt = h12 + (cp.mi ? ':' + pad(cp.mi) : '') + (cp.h < 12 ? ' AM ' : ' PM ') + pad(cp.d) + '-' + pad(cp.mo) + '-' + cp.y;

    return {
      cfg: cfg,
      periodo: cfg.periodo || MESES[cp.mo - 1],
      anio: cp.y,
      corteTxt: corteTxt,
      corteFecha: fmtDate(corte),
      semana: { desde: fmtDate(dias[0]), hasta: fmtDate(dias[6]) },
      kpi: {
        tipSA: tipSA.length, fcr: fcr, fcrPct: tipSA.length ? fcr / tipSA.length : null,
        tipEstatus: tipEstatus, escalados: escalados,
        irNum: irNum, irDen: irDen, irPct: irDen ? irNum / irDen : null,
        svaTotal: svaTotal, sva: sva,
        sguTotal: sguTotal, sguRes: sguRes, paisTotal: paisTotal, paisRes: paisRes, glpiTotal: T.length,
        piaTotal: piaTotal, piaRes: piaRes, otrasTotal: otrasTotal, otrasRes: otrasRes,
        tiempoSGU: sSGU, tiempoPIA: sPIA, tiempoOtras: sOtras, tiempoPais: sPais,
        comparativo: comparativo,
        jornadaPct: jorn.sgu.total.pct, jornadaMismoDia: jorn.sgu.total.mismoDia, jornadaAbiertos: jorn.sgu.total.abiertos,
        duplicados: glpiRows.duplicados || 0,
        reincAbonados: reinc.length, reincTickets: reincTickets,
        nps: cfg.nps || ''
      },
      tiempoCategoria: tiempoCategoria,
      tiempoGrupo: tiempoGrupo,
      opciones: opciones(),
      productividad: productividad,
      jornada: jorn,
      reincidencia: { clientes: reinc, porCategoria: reincCat }
    };
  }

  var api = {
    DEFAULTS: DEFAULTS, compute: compute, loadGLPI: loadGLPI, loadTipif: loadTipif,
    parseDate: parseDate, serialFromParts: serialFromParts, partsFromSerial: partsFromSerial,
    fmtDur: fmtDur, grpKey: grpKey, fmtDurCard: fmtDurCard, fmtDate: fmtDate, MESES: MESES, norm: norm
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PIAEngine = api;
})(typeof window !== 'undefined' ? window : this);
