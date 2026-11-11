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
    semanaModo: 1,
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
    grupos: ['ATC No Presencial', 'Cobranzas Masivas', 'Contratista San Agustín', 'Tesoreria Masivos', 'Coordinación de reparación Técnico FTTX', 'Activaciones', 'UDN-CARACAS', 'COR', '(Sin grupo asignado)'],
    /** Categorías FTTH que NO cuentan para reincidencias (se cambia desde el filtro del Informe). */
    reincExcluir: ['Cobranzas Masivas > FTTH > Ajuste de facturación', 'Cobranzas Masivas > FTTH > Reembolso', 'FTTH > Cambio de plan'],
    gruposNegrita: ['ATC No Presencial', 'Cobranzas Masivas', 'Contratista San Agustín', 'Tesoreria Masivos']
  };

  var GRUPOS = ['pia', 'otras', 'sgu', 'pais'];
  var ETIQUETAS = { pia: 'PIA', otras: 'SGU otras unidades', sgu: 'SGU total', pais: 'País' };
  var ETIQUETAS_LARGAS = { pia: 'Ecosistema PIA', otras: 'SGU otras unidades', sgu: 'Total San Agustín', pais: 'Diferente a San Agustín' };

  /* ---------- texto ---------- */
  function norm(s) { return s === null || s === undefined ? '' : String(s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function stripAccents(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function hkey(s) { return stripAccents(norm(s)).replace(/[^a-z0-9]+/g, ' ').trim(); }
  function eq(a, b) { return norm(a) === norm(b); }
  /* "Nombre Cliente" válido: con letras y sin errores de Excel ("#NAME?") */
  function claveCliente(n) { var s = String(n == null ? '' : n).trim(); if (!s || s.charAt(0) === '#') return ''; var k = hkey(s); return /[a-z].*[a-z]/.test(k) ? k : ''; }
  function fixText(s) {
    s = s == null ? '' : String(s);
    if (/[ÃÂ]/.test(s)) { try { return decodeURIComponent(escape(s)); } catch (e) { return s; } }
    return s;
  }
  function danado(s) { return /[ÃÂ�]/.test(String(s || '')); }
  /** Categoría homologada: quita ">" o "<" sobrantes al final. */
  function homologar(c) { return String(c == null ? '' : c).trim().replace(/\s*[<>]+\s*$/, ''); }
  /** Grupo técnico: líneas del campo "Asignado a - Grupo de técnicos" (igual que la fórmula de auditoría en Excel:
   *  se quitan CHAR(13), CHAR(160) pasa a espacio, se divide por salto de línea y se aplica ESPACIOS a cada línea). */
  function grpLineas(g) { return String(g == null ? '' : g).replace(/\r/g, '').replace(/\u00a0/g, ' ').split(/\n|<br\s*\/?>/i).map(function (x) { return x.replace(/ +/g, ' ').trim(); }).filter(Boolean); }
  /** Comparación de líneas como en Excel ("=" y COINCIDIR): sin distinguir mayúsculas, pero sí acentos y guiones. */
  function grpIgual(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }
  var GRUPOS_PRIORIDAD = ['ATC No Presencial', 'Cobranzas Masivas', 'Contratista San Agustín', 'Tesoreria Masivos', 'Coordinación de reparación Técnico FTTX', 'Activaciones', 'UDN-CARACAS', 'COR'];
  var SIN_GRUPO = '(Sin grupo asignado)';
  function grpAsignar(g) {
    var lin = grpLineas(g);
    if (!lin.length) return { label: SIN_GRUPO, paso: 4, regla: 'Paso 4 · El campo está vacío → ' + SIN_GRUPO };
    var last = lin[lin.length - 1];
    if (grpIgual(last, 'Cobranzas Masivas')) return { label: 'Cobranzas Masivas', paso: 1, regla: 'Paso 1 · La última línea es "Cobranzas Masivas"' };
    for (var i = lin.length - 1; i >= 0; i--) {
      var j = -1; for (var q = 0; q < GRUPOS_PRIORIDAD.length; q++) if (grpIgual(lin[i], GRUPOS_PRIORIDAD[q])) { j = q; break; }
      if (j >= 0) return { label: GRUPOS_PRIORIDAD[j], paso: 2, regla: 'Paso 2 · La última línea que está en la lista es "' + GRUPOS_PRIORIDAD[j] + '"' };
    }
    return { label: last, paso: 3, regla: 'Paso 3 · Ninguna línea está en la lista → la última línea ("' + last + '")' };
  }
  function grpLabel(g) { return grpAsignar(g).label; }
  function grpKey(g) { return norm(grpLabel(g)); }
  function grpRegla(g) { return grpAsignar(g).regla; }
  var REGLAS_GRUPO = [
    'Si la última línea del grupo es "Cobranzas Masivas", el ticket es de Cobranzas Masivas.',
    'Si no, se buscan las líneas que son exactamente uno de estos grupos (sin distinguir mayúsculas): ' + GRUPOS_PRIORIDAD.join(', ') + '. El ticket es de la última que aparece.',
    'Si ninguna línea está en esa lista, el ticket es de la última línea, sea cual sea.',
    'Si el campo está vacío, el ticket queda en "' + SIN_GRUPO + '".'
  ];
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
  /* horas laborales entre dos fechas (serial): lunes a sábado de 8:00 a 20:00, sin feriados */
  var LAB_INI = 8, LAB_FIN = 20, LAB_LIMITE = 72;
  function horasLaborales(a, b) {
    if (a === null || b === null || b <= a) return 0;
    var h = 0;
    for (var d = Math.floor(a + 1e-9); d <= Math.floor(b + 1e-9); d++) {
      if (partsFromSerial(d).wd === 0) continue;
      var i = Math.max(a, d + LAB_INI / 24), f = Math.min(b, d + LAB_FIN / 24);
      if (f > i) h += (f - i) * 24;
    }
    return Math.round(h * 3600) / 3600;
  }

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
    tecnico: ['Asignado a - Técnico', 'Asignado a - Tecnico'],
    descripcion: ['Descripción', 'Descripcion'],
    cliente: ['Complementos - Datos Clientes - Nombre Cliente', 'Nombre Cliente']
  };
  var GLPI_REQ = ['titulo', 'estado', 'categoria', 'apertura', 'solucion', 'solicitante', 'grupo'];
  var TIP_COLS = {
    fecha: ['Fecha'], sucursal: ['Sucursal'], categoria: ['Categoría', 'Categoria'], subcategoria: ['Subcategoría', 'Subcategoria'],
    estatus: ['Estatus'], ticket: ['Ticket GLPI'], cuenta: ['ID de cuenta'], observaciones: ['Observaciones'],
    motivo: ['Motivo'], cedula: ['Cédula de identidad', 'Cedula de identidad', 'Cédula'], id: ['ID']
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
        tecnico: i.tecnico !== undefined ? (row[i.tecnico] == null ? '' : String(row[i.tecnico])) : null,
        descripcion: i.descripcion !== undefined && row[i.descripcion] != null && necesitaDescripcion(cat) ? fixText(row[i.descripcion]) : '',
        cliente: i.cliente !== undefined && row[i.cliente] != null ? fixText(row[i.cliente]).trim() : '',
        cuentaDesc: i.descripcion !== undefined ? cuentaDeDescripcion(row[i.descripcion]) : ''
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
        cuenta: i.cuenta !== undefined ? soloDigitos(row[i.cuenta]) : '',
        motivo: i.motivo !== undefined && row[i.motivo] != null ? String(row[i.motivo]) : '',
        cedula: i.cedula !== undefined ? soloDigitos(row[i.cedula]) : '',
        id: i.id !== undefined && row[i.id] != null ? String(row[i.id]) : ''
      });
    }
    if (!out.length) throw new Error('El archivo del Tipificador no tiene registros.');
    return out;
  }

  /* La descripción que GLPI arma desde el sistema trae "Nombre de la cuenta:61332 - NOMBRE". */
  function cuentaDeDescripcion(d) {
    var m = String(d == null ? '' : d).match(/Nombre de la cuenta:\s*(\d{1,7})\b/i);
    return m ? m[1] : '';
  }

  /* ---------- cuenta del abonado (3.5) ---------- */
  function cuentaDeTitulo(titulo) {
    /* quita al final espacios, puntos y guiones sueltos */
    var t0 = String(titulo || '').replace(/\s+/g, ' ').replace(/[\s.\-–]+$/, ''), t = t0;
    var m = matchCuenta(t);
    if (!m) {
      /* texto añadido después de la cuenta: "- GARANTIA", "(Vnet)" */
      var cola = t.match(/(\s*[-–]\s*[A-Za-zÁÉÍÓÚÑáéíóúñ ]{3,}|\s*\([^)]*\))$/);
      if (cola) { t = t.slice(0, cola.index).replace(/[\s.\-–]+$/, ''); m = matchCuenta(t); }
    }
    var cuenta = null, cedula = null, nombre = '';
    if (m && m[1] !== m[2]) {
      cuenta = m[2]; cedula = m[1];
      nombre = nombreAntes(t.slice(0, m.index));
    } else {
      var b = t0.match(/[-–]\s*(\d{3,6})$/);
      if (b) { cuenta = b[1]; nombre = nombreAntes(t0.slice(0, b.index)); }
    }
    return { cuenta: cuenta, cedula: cedula, nombre: nombre.toUpperCase() };
  }
  /* Al final del título: CÉDULA (con "V", "CI:" o ceros delante y un sufijo "-001" opcionales) y luego la CUENTA.
     La cuenta es siempre el último número: "18524490-001 - 396445" → cuenta 396445, no 001. */
  function matchCuenta(t) {
    return t.match(/(?:^|[\s\-–:(])(?:[Cc]\.?[Ii]\.?:?\s*)?(?:[VvEeJjGg][\s\-]{0,2})?0*(\d{5,9})(?:\s*[-–]\s*\d{1,3})?\s*[-–\s]\s*(\d{1,7})$/);
  }
  function nombreAntes(antes) {
    var partes = String(antes).replace(/[\s\-–:]+$/, '').split(/\s*[-–]\s+|\s+[-–]\s*/);
    var n = partes[partes.length - 1] || '';
    return n.replace(/[\s(]*([Cc]\.?[Ii]\.?:?|[VvEeJjGg])?[\s\-(]*$/, '').replace(/^[-–\s]+|[-–\s:]+$/g, '').trim();
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
  /* Celda de tiempo: la moda (M) o el promedio (P). Nunca se muestra un "0 h": una moda o un promedio de 0 horas se omite. */
  function esCero(x) { return x === null || x === undefined || Math.round(x) < 3600; }
  function celdaTiempo(mp, esTotal) {
    if (!mp || !mp.n) return '-';
    var M = mp.moda === null || mp.moda === 0 ? null : 'M: ' + fmtD(mp.moda);
    var Pr = esCero(mp.prom) && Math.round(mp.prom) < 60 ? null : 'P: ' + fmtD(mp.prom);
    if (esTotal) return [M, Pr].filter(Boolean).join(' / ') || '-';
    return M || Pr || '-';
  }

  /* ================= cálculo principal ================= */
  function compute(glpiAll, tipAll, opts) {
    var cfg = Object.assign({}, DEFAULTS, opts || {});
    if (typeof cfg.corte !== 'number') throw new Error('Falta la fecha y hora de descarga.');
    /* Fechas: descarga = cuándo se bajó la data; inicio y fin = días del informe (completos);
       corte = fin del informe: el día siguiente a "fin" a las 00:00, o la descarga si es antes. */
    var DESC = cfg.corte, dp = partsFromSerial(DESC);
    var ini, fin;
    if (typeof cfg.inicio === 'number' && typeof cfg.fin === 'number') { ini = Math.floor(cfg.inicio + 1e-9); fin = Math.floor(cfg.fin + 1e-9); }
    else { // cargas anteriores: meses marcados (por defecto, el mes de la descarga)
      var mesD = dp.y + '-' + pad(dp.mo);
      var ms = (Array.isArray(cfg.meses) && cfg.meses.length ? cfg.meses : [mesD]).filter(function (m) { return /^\d{4}-\d{2}$/.test(m) && m <= mesD; }).sort();
      if (!ms.length) ms = [mesD];
      var a = ms[0], b = ms[ms.length - 1];
      ini = serialFromParts(+a.slice(0, 4), +a.slice(5), 1);
      fin = serialFromParts(+b.slice(0, 4), +b.slice(5) + 1, 1) - 1;
    }
    if (fin < ini) { var tmp = ini; ini = fin; fin = tmp; }
    var FD = Math.min(fin + 1, DESC), fdDay = Math.floor(FD + 1e-9), fp = partsFromSerial(FD);
    var corteEsFin = FD === fin + 1;
    var ultimoDia = corteEsFin ? fin : (Math.abs(FD - fdDay) < 1e-9 ? fdDay - 1 : fdDay); // último día con datos
    var meses = []; (function () { var p = partsFromSerial(ini), q = partsFromSerial(ultimoDia), y = p.y, m = p.mo; while (y < q.y || (y === q.y && m <= q.mo)) { meses.push(y + '-' + pad(m)); m++; if (m > 12) { m = 1; y++; } } })();
    var enMeses = function (x) { return x !== null && x !== undefined && x >= ini - 1e-9; };
    var wIni = fdDay - 8, wFin = fdDay; // ventana: [FD-8, FD-1] completos
    var marker = norm(cfg.sguMarker);
    var catKeys = cfg.categorias.map(norm);
    var grpKeys = [], gruposU = [];
    cfg.grupos.forEach(function (g) { var k = grpKey(g); if (k && grpKeys.indexOf(k) < 0) { grpKeys.push(k); gruposU.push(grpLabel(g)); } });
    var reincFuera = (cfg.reincExcluir || []).map(function (c) { return norm(homologar(c)); });
    /* Reincidencia: solo categorías FTTH y nunca nada que diga "Cobranzas Masivas" */
    var esReincidible = function (k) { return k.indexOf('ftth') >= 0 && stripAccents(k).indexOf('cobranzas masivas') < 0 && !esAjusteFactura(k); };
    /* El ajuste de facturación nunca cuenta en la reincidencia FTTH (la general lleva todas las categorías) */
    var esAjusteFactura = function (k) { return /ajuste[^>]*factura/.test(stripAccents(k)); };
    var controles = {};

    /* --- GLPI del período --- */
    var homologadas = [], fueraPeriodo = 0;
    var T = [], REV = cfg.revisiones || {}, sinTitulo = [];
    glpiAll.forEach(function (raw, idx) {
      if (raw.apertura === null || !enMeses(raw.apertura) || raw.apertura >= fin + 1 || raw.apertura > DESC) { fueraPeriodo++; return; }
      /* tickets sin título: se valida a mano (se agrega el título o se deja sin título) */
      if (!String(raw.titulo || '').trim()) {
        var dt = REV['t|' + raw.id];
        if (dt) { if (dt.procede && dt.procede[0]) raw = Object.assign({}, raw, { titulo: String(dt.procede[0]) }); sinTitulo.push({ raw: raw, dec: dt }); }
        else sinTitulo.push({ raw: raw, dec: null });
      }
      var cat = homologar(raw.categoria);
      if (cat !== String(raw.categoria).trim()) homologadas.push({ id: raw.id, de: raw.categoria, a: cat });
      var sgu = norm(raw.titulo).indexOf(marker) >= 0;
      var esPia = eq(raw.solicitante, cfg.piaSolicitante);
      var res = /^(resuelto|cerrado)$/.test(norm(raw.estado));
      var dur = res && raw.solucion !== null ? Math.max(0, Math.round((raw.solucion - raw.apertura) * 86400)) : null;
      var acc = cuentaDeTitulo(raw.titulo), cDesc = raw.cuentaDesc || '', origen = 'título';
      if (!acc.cuenta && cDesc) { acc.cuenta = cDesc; origen = 'descripción'; if (!acc.nombre) acc.nombre = String(raw.cliente || '').toUpperCase(); }
      T.push({
        raw: raw, idx: idx, id: raw.id, idNum: soloDigitos(raw.id), sgu: sgu, piaSol: esPia, pia: sgu && esPia, res: res, dur: dur,
        cat: cat, catK: norm(cat), grpL: grpLabel(raw.grupo), grpK: grpKey(raw.grupo),
        dAp: Math.floor(raw.apertura + 1e-9), dSol: res && raw.solucion !== null ? Math.floor(raw.solucion + 1e-9) : null,
        dCie: raw.cierre !== null ? Math.floor(raw.cierre + 1e-9) : null, cierre: raw.cierre,
        cuenta: acc.cuenta, cedula: acc.cedula, nombreTitulo: acc.nombre, cuentaOrigen: origen, cuentaDesc: cDesc
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
      if (r.fecha === null || !enMeses(r.fecha) || r.fecha >= fin + 1 || r.fecha > DESC) { tipFuera++; if (eq(r.sucursal, cfg.sucursal)) tipFueraSA++; return; }
      tipMes.push(r);
    });
    /* duplicados del PIA: misma categoría, subcategoría, motivo, fecha (día), cédula, ID de cuenta y ticket GLPI → se cuenta una sola vez */
    var tipSAbruto = tipMes.filter(function (r) { return eq(r.sucursal, cfg.sucursal); });
    var vistos = {}, tipSA = [], tipDuplicados = [];
    tipSAbruto.forEach(function (r) {
      var k = [norm(r.categoria), norm(r.subcategoria), norm(r.motivo), r.fecha === null ? '' : Math.floor(r.fecha + 1e-9), r.cedula, String(r.cuenta || '').trim(), String(r.ticket || '').trim()].join('|');
      if (vistos[k]) { tipDuplicados.push({ fila: r, original: vistos[k] }); return; }
      vistos[k] = r; tipSA.push(r);
    });
    var tipOtras = tipMes.filter(function (r) { return !eq(r.sucursal, cfg.sucursal); });
    var fcrFilas = tipSA.filter(function (r) { return eq(r.estatus, cfg.fcrStatus); });
    var escFilas = tipSA.filter(function (r) { return !eq(r.estatus, cfg.fcrStatus); });
    var fcr = fcrFilas.length;
    var estatusN = tipSA.filter(function (r) { return eq(r.subcategoria, cfg.estatusSubcat) && !eq(r.estatus, cfg.fcrStatus); }).length;
    var estatusTodas = tipSA.filter(function (r) { return eq(r.subcategoria, cfg.estatusSubcat); }).length;
    var cedulas = {}; tipSA.forEach(function (r) { if (r.cedula) cedulas[r.cedula] = 1; });
    /* escalados del PIA: se buscan en GLPI por "Ticket GLPI" (todo el archivo de GLPI) */
    var glpiPorId = {}; glpiAll.forEach(function (raw) { var k = soloDigitos(raw.id); if (k) glpiPorId[k] = raw; });
    var escCruce = escFilas.map(function (r) { var g = r.ticket ? glpiPorId[r.ticket] : null; return { fila: r, ticket: g, resuelto: !!(g && g.solucion !== null) }; });
    var escResueltos = escCruce.filter(function (x) { return x.resuelto; }).length;

    /* --- volúmenes --- */
    GRUPOS.forEach(function (g) {
      var L = porGrupo[g].lista, P = porGrupo[g];
      P.creados = L.length;
      P.solucionados = L.filter(function (t) { return t.res; }).length;
      P.tiempo = modaPromedio(L.filter(function (t) { return t.res && t.dur !== null; }).map(function (t) { return t.dur; }));
    });

    /* --- 4.1 fijos --- */
    var irNum = fcr + escResueltos, irDen = tipSA.length;
    var fijos = {
      ir: { num: irNum, den: irDen, pct: irDen ? irNum / irDen : null, fcr: fcr, escalados: escFilas.length, escResueltos: escResueltos,
        escSinTicket: escCruce.filter(function (x) { return !x.fila.ticket; }).length, escNoEncontrado: escCruce.filter(function (x) { return x.fila.ticket && !x.ticket; }).length },
      fcr: { n: fcr, den: tipSA.length, pct: tipSA.length ? fcr / tipSA.length : null },
      productividad: { casos: tipSA.length, abonados: Object.keys(cedulas).length, duplicados: tipDuplicados.length, bruto: tipSAbruto.length, escalados: escFilas.length },
      estatus: estatusN, estatusTodas: estatusTodas,
      nps: cfg.nps || ''
    };
    /* Índice de resolución SGU = (tickets SGU resueltos en GLPI + casos resueltos en 1er contacto) ÷ (tickets SGU creados + casos resueltos en 1er contacto)
       resuelto = tiene Fecha de solución (sin importar el estado); desglose del numerador: 1er contacto, creados por el PIA, creados por otras unidades */
    var esPIA = function (t) { return eq(t.raw.solicitante, cfg.piaSolicitante); };
    /* Gestión PIA / otras unidades (lámina de canal de creación):
       escalado por PIA = ticket SGU no creado por el PIA cuyo técnico asignado (alguna línea) es el PIA;
       otras unidades: escalado a Contratista San Agustín o a otra unidad según el grupo técnico asignado (sin grupo no cuenta como escalado) */
    var tecPIA = function (t) { return grpLineas(t.raw.tecnico).some(function (x) { return eq(x, cfg.piaSolicitante); }); };
    var otrL = porGrupo.otras.lista, conTecnico = porGrupo.sgu.lista.every(function (t) { return t.raw.tecnico !== null && t.raw.tecnico !== undefined; });
    var escPIAL = conTecnico ? otrL.filter(tecPIA) : null;
    var escCSA = otrL.filter(function (t) { return t.grpL === 'Contratista San Agustín'; }), escOtrU = otrL.filter(function (t) { return t.grpL !== 'Contratista San Agustín' && t.grpL !== SIN_GRUPO; });
    var sguL = porGrupo.sgu.lista, sguResL = sguL.filter(function (t) { return t.raw.solucion !== null; }), sguSol = sguResL.length, sguCre = porGrupo.sgu.creados;
    var resPIA = sguResL.filter(esPIA).length;
    fijos.irSGU = { num: sguSol + fcr, den: sguCre + fcr, pct: sguCre + fcr ? (sguSol + fcr) / (sguCre + fcr) : null, solucionados: sguSol, creados: sguCre, fcr: fcr,
      resPIA: resPIA, resOtras: sguSol - resPIA,
      gestion: { sgu: porGrupo.sgu.creados, pia: porGrupo.pia.creados, otras: otrL.length, escPIA: escPIAL ? escPIAL.length : null, escCSA: escCSA.length, escOtrasU: escOtrU.length, sinGrupo: otrL.length - escCSA.length - escOtrU.length },
      escaladosPIA: escFilas.length, creadosPIA: porGrupo.pia.creados };

    /* --- ventana semanal --- */
    var modoSemana = +cfg.semanaModo === 2 ? 2 : 1;
    var pIni = wIni - (wFin - wIni); // semana pasada: los 8 días antes de la semana
    /* tickets abiertos la semana pasada (aunque queden antes del inicio del período) y solucionados en la semana */
    var prevSem = [];
    glpiAll.forEach(function (raw) {
      if (raw.apertura === null || raw.apertura < pIni || raw.apertura >= wIni || raw.apertura > DESC) return;
      if (!/^(resuelto|cerrado)$/.test(norm(raw.estado)) || raw.solucion === null || raw.solucion < wIni || raw.solucion >= wFin) return;
      var tit = raw.titulo, dt = REV['t|' + raw.id]; if (!String(tit || '').trim() && dt && dt.procede && dt.procede[0]) tit = String(dt.procede[0]);
      var sgu = norm(tit).indexOf(marker) >= 0, piaS = eq(raw.solicitante, cfg.piaSolicitante);
      prevSem.push({ raw: raw, id: raw.id, sgu: sgu, piaSol: piaS, pia: sgu && piaS, res: true, dAp: Math.floor(raw.apertura + 1e-9), dSol: Math.floor(raw.solucion + 1e-9), cat: homologar(raw.categoria), grpL: grpLabel(raw.grupo), dur: Math.max(0, Math.round((raw.solucion - raw.apertura) * 86400)), horasLab: horasLaborales(raw.apertura, raw.solucion) });
    });
    var dias = []; for (var d = wIni; d < wFin; d++) dias.push(d);
    GRUPOS.forEach(function (g) {
      var L = porGrupo[g].lista, P = porGrupo[g];
      var enV = L.filter(function (t) { return t.dAp >= wIni && t.dAp < wFin; });
      var cerradosMisma = enV.filter(function (t) { return t.dCie !== null && t.dCie >= wIni && t.dCie < wFin; }).length;
      /* % de tickets solucionados en la semana = solucionados en la semana ÷ abiertos en la semana;
         desglose: de la misma semana (abiertos en la semana) y de semanas pasadas (abiertos antes) */
      var solSem = L.filter(function (t) { return t.dSol !== null && t.dSol >= wIni && t.dSol < wFin; });
      var solMisma = solSem.filter(function (t) { return t.dAp >= wIni; }).length;
      /* opción 1: abiertos y solucionados dentro de la semana ÷ abiertos en la semana
         opción 2: lo anterior + abiertos la semana pasada, solucionados esta semana en menos de 72 horas laborales (se suman arriba y abajo) */
      var ext = prevSem.filter(EN[g]).filter(function (t) { return t.horasLab < LAB_LIMITE; });
      var m1 = { num: solMisma, den: enV.length }, m2 = { num: solMisma + ext.length, den: enV.length + ext.length, extra: ext.length };
      m1.pct = m1.den ? m1.num / m1.den : null; m2.pct = m2.den ? m2.num / m2.den : null;
      var mx = modoSemana === 2 ? m2 : m1;
      P.semana = { modo: modoSemana, abiertos: enV.length, cerradosMisma: cerradosMisma, solucionadosTodos: solSem.length, solMisma: solMisma, solPrevias: solSem.length - solMisma,
        extra: ext.length, prevResueltos: prevSem.filter(EN[g]).length, num: mx.num, den: mx.den, pct: mx.pct, m1: m1, m2: m2, solucionados: mx.num };
      /* tablas de la semana: el universo son los tickets abiertos desde el primer día de la semana;
         en la opción 2 se suman los de la semana pasada solucionados en la semana en < 72 h laborales (fila "Semana pasada") */
      var U = enV.concat(modoSemana === 2 ? ext : []);
      var accR = 0, filas = dias.map(function (D) {
        var ab = 0, mismo = 0, resD = 0, pendAcc = 0;
        L.forEach(function (t) { if (t.dAp === D) { ab++; if (t.dSol === D) mismo++; } });
        U.forEach(function (t) {
          if (t.dSol === D) resD++;
          if (t.dAp <= D && !(t.dSol !== null && t.dSol <= D)) pendAcc++;
        });
        accR += resD;
        return { serial: D, dia: dayName(D), fecha: fmtDate(D), fechaCorta: fmtDM(D), abiertos: ab, pendientes: ab - mismo, resueltos: resD, mismoDia: mismo, resSemana: resD, pendAcc: pendAcc, resAcc: accR, pct: ab ? mismo / ab : null };
      });
      var arrastre = modoSemana === 2 ? { arrastre: true, serial: null, dia: 'Semana pasada', fecha: fmtDate(pIni) + ' al ' + fmtDate(wIni - 1), fechaCorta: '< ' + LAB_LIMITE + ' h', abiertos: ext.length, pendientes: ext.length, resueltos: 0, mismoDia: 0, resSemana: 0, pendAcc: ext.length, resAcc: 0, pct: null } : null;
      var tot = filas.reduce(function (a, f) { a.abiertos += f.abiertos; a.pendientes += f.pendientes; a.resueltos += f.resueltos; a.mismoDia += f.mismoDia; a.resSemana += f.resSemana; return a; }, { abiertos: 0, pendientes: 0, resueltos: 0, mismoDia: 0, resSemana: 0 });
      tot.abiertosSemana = tot.abiertos; tot.pct = tot.abiertos ? tot.mismoDia / tot.abiertos : null; // % en jornada: solo tickets abiertos en la semana
      if (arrastre) { tot.abiertos += arrastre.abiertos; tot.pendientes += arrastre.pendientes; }
      tot.pendAcc = filas[filas.length - 1].pendAcc; tot.resAcc = filas[filas.length - 1].resAcc;
      var pico = filas.reduce(function (a, f) { return f.abiertos > (a ? a.abiertos : -1) ? f : a; }, null);
      P.jornada = { filas: filas, total: tot, pico: pico, arrastre: arrastre };
      /* resolución por día con tres alcances (como la hoja "Tablas"):
         día = abiertos ese día y resueltos ese mismo día; semana = abiertos desde el primer día de la semana (00:00) hasta ese día y resueltos hasta ese día
         (opción 2: más los de la semana pasada resueltos en la semana en < 72 h laborales); hasta la fecha = abiertos desde el inicio del período hasta ese día */
      var trio = function (lista, D) { var ab = lista.length, res = lista.filter(function (t) { return t.dSol !== null && t.dSol <= D; }).length; return { ab: ab, res: res, pend: ab - res, pct: ab ? res / ab : null }; };
      var resol = dias.map(function (D) {
        var diaL = L.filter(function (t) { return t.dAp === D; });
        var semL = L.filter(function (t) { return t.dAp >= wIni && t.dAp <= D; }).concat(modoSemana === 2 ? ext : []);
        var acuL = L.filter(function (t) { return t.dAp >= ini && t.dAp <= D; });
        var dd = { ab: diaL.length, res: diaL.filter(function (t) { return t.dSol === D; }).length }; dd.pend = dd.ab - dd.res; dd.pct = dd.ab ? dd.res / dd.ab : null;
        /* flujo del día: abiertos ese día + abiertos antes en la semana que seguían pendientes al empezar el día (opción 2: incluye los de la semana pasada < 72 h) */
        var bl = semL.filter(function (t) { return t.dAp < D && (t.dSol === null || t.dSol >= D); });
        var blRes = bl.filter(function (t) { return t.dSol === D; }).length, sm = trio(semL, D);
        var x = { abDia: dd.ab, abSem: bl.length, resDia: dd.res, resSem: blRes, pendDia: dd.pend, pendSem: bl.length - blRes, pctDia: dd.pct, pctSem: sm.pct };
        x.abTot = x.abDia + x.abSem; x.resTot = x.resDia + x.resSem; x.pendTot = x.pendDia + x.pendSem;
        return { serial: D, dia: dayName(D), fecha: fmtDate(D), fechaCorta: fmtDM(D), d: dd, s: sm, h: trio(acuL, D), x: x };
      });
      var ult = resol[resol.length - 1], sd = resol.reduce(function (a, f) { a.ab += f.d.ab; a.res += f.d.res; return a; }, { ab: 0, res: 0 });
      sd.pend = sd.ab - sd.res; sd.pct = sd.ab ? sd.res / sd.ab : null;
      var xt = resol.reduce(function (a, f) { a.abDia += f.x.abDia; a.resDia += f.x.resDia; a.resSem += f.x.resSem; return a; }, { abDia: 0, resDia: 0, resSem: 0 });
      xt.abSem = modoSemana === 2 ? ext.length : 0; xt.abTot = xt.abDia + xt.abSem; xt.resTot = xt.resDia + xt.resSem; xt.pendDia = null; xt.pendSem = null; xt.pendTot = ult.x.pendTot; xt.pctDia = sd.pct; xt.pctSem = ult.s.pct;
      P.resolucion = { filas: resol, total: { d: sd, s: ult.s, h: ult.h, x: xt }, desde: fmtDate(ini) };
      P.gestion = {
        abiertos: U.length,
        resueltos: mx.num,
        cerrados: L.filter(function (t) { return t.dCie !== null && t.dCie >= wIni && t.dCie < wFin; }).length,
        mismoDia: tot.mismoDia, pct: tot.pct
      };
    });

    /* --- reincidencia FTTH --- */
    /* Revisión humana: un cliente reincidente va a revisión si sus tickets tienen cédulas distintas,
       contratos distintos, o si en algún ticket no se identifica con seguridad la cédula (6 a 8 dígitos)
       o el contrato (1 a 6 dígitos). Mientras no se revise, no cuenta como reincidente.
       Las decisiones se guardan por ámbito: "sgu" (vale para PIA, otras unidades y SGU total) y "pais". */
    var cedOk = function (c) { return /^\d{6,8}$/.test(c || ''); };
    var ctaOk = function (c) { return /^\d{1,6}$/.test(c || ''); };
    /* etiqueta para ordenar la revisión: Contrato diferente, Cédula diferente, Dato no identificado o Varios datos no coinciden */
    function etiquetaDe(m) { return m.length > 1 ? 'Varios datos no coinciden' : ({ 'Cédulas distintas': 'Cédula diferente', 'Contratos distintos': 'Contrato diferente' })[m[0]] || 'Dato no identificado'; }
    function motivosRevision(ts) {
      var ceds = {}, ctas = {}, m = [];
      ts.forEach(function (t) { if (t.cedula) ceds[t.cedula] = 1; if (t.cuenta) ctas[t.cuenta] = 1; });
      if (Object.keys(ceds).length > 1) m.push('Cédulas distintas');
      if (Object.keys(ctas).length > 1) m.push('Contratos distintos');
      if (ts.some(function (t) { return !cedOk(t.cedula) || !ctaOk(t.cuenta); })) m.push('Cédula o contrato no identificado con seguridad');
      return m;
    }
    function tkInfo(t) { return { id: t.id, cat: t.cat, estado: t.raw.estado, pia: t.pia, cuenta: t.cuenta || '', cedula: t.cedula || '', cedulaOk: cedOk(t.cedula), cuentaOk: ctaOk(t.cuenta), titulo: t.raw.titulo, apertura: t.raw.apertura, grupo: t.grpL }; }
    var colaRevision = [];
    /* tipo 'ftth': categorías FTTH (con los filtros); tipo 'general': todos los tickets, sin excepción.
       ambito: 'sgu' o 'pais' (prefijo de la decisión); revisar=false cuenta sin revisión humana (general del país). */
    /* base: resultado de SGU total para PIA y otras unidades; ahí manda la revisión de SGU (pendiente o decisión). */
    function reincidencia(L, ambito, tipo, revisar, base) {
      var general = tipo === 'general';
      var ftth = general ? L.slice() : L.filter(function (t) { return esReincidible(t.catK) && reincFuera.indexOf(t.catK) < 0; });
      /* el cliente se identifica por la columna "Nombre Cliente" (sin acentos, mayúsculas ni signos);
         la cuenta del título solo se muestra en la tabla */
      var porCli = {}, orden = [];
      ftth.forEach(function (t) {
        var k = claveCliente(t.raw.cliente); if (!k) return;
        if (!porCli[k]) { porCli[k] = []; orden.push(k); }
        porCli[k].push(t);
      });
      var reinc = [], pendientes = [], descartados = [], revisados = 0, estado = {};
      orden.forEach(function (k) {
        var ts = porCli[k]; if (ts.length < 2) return;
        if (base) {
          var eb = base.estado[k];
          if (eb && eb.pend) return;
          if (eb && eb.rev) { ts = ts.filter(function (t) { return eb.procede.indexOf(t.id) >= 0; }); if (ts.length < 2) return; }
          var ctas0 = []; ts.forEach(function (t) { if (t.cuenta && ctas0.indexOf(t.cuenta) < 0) ctas0.push(t.cuenta); });
          var cats0 = []; ts.forEach(function (t) { var c = catCorta(t.cat); if (cats0.indexOf(c) < 0) cats0.push(c); });
          reinc.push({ cuenta: ctas0.join(' / '), cuentas: ctas0, nombre: String(ts[0].raw.cliente).trim().toUpperCase(), categorias: cats0, revision: eb && eb.rev ? eb.rev : null, tickets: ts.map(tkInfo) });
          return;
        }
        var motivos = revisar === false ? [] : motivosRevision(ts), rev = null;
        if (motivos.length) {
          var clave = (general ? 'g' : '') + ambito + '|' + k, dec = REV[clave];
          var cubreDe = function (d) { return d && Array.isArray(d.tickets) && ts.every(function (t) { return d.tickets.indexOf(t.id) >= 0; }); };
          var cubre = cubreDe(dec);
          /* la general reutiliza la decisión FTTH si revisó los mismos tickets */
          var decClave = clave, reutilizada = false;
          if (!cubre && general && cubreDe(REV[ambito + '|' + k])) { dec = REV[ambito + '|' + k]; cubre = true; decClave = ambito + '|' + k; reutilizada = true; }
          if (!cubre) {
            var ant = dec && Array.isArray(dec.tickets) ? { tickets: dec.tickets, procede: dec.procede || [], por: dec.por || '', heredada: !!dec.heredada } : null;
            pendientes.push({ clave: clave, etiqueta: etiquetaDe(motivos), tipo: general ? 'general' : 'ftth', nombre: String(ts[0].raw.cliente).trim().toUpperCase(), motivos: motivos, tickets: ts.map(tkInfo), anterior: ant }); estado[k] = { pend: true }; return;
          }
          var todos = ts;
          ts = ts.filter(function (t) { return (dec.procede || []).indexOf(t.id) >= 0; });
          rev = { etiqueta: etiquetaDe(motivos), clave: decClave, reutilizada: reutilizada, tipo: general ? 'general' : 'ftth', heredada: !!dec.heredada, motivos: motivos, por: dec.por || '', fecha: dec.fecha || '', revisados: todos.map(tkInfo), procede: ts.map(function (t) { return t.id; }) };
          revisados++;
          estado[k] = { rev: rev, procede: rev.procede };
          if (ts.length < 2) { descartados.push({ clave: clave, nombre: String(todos[0].raw.cliente).trim().toUpperCase(), revision: rev }); return; }
        }
        var ctas = []; ts.forEach(function (t) { if (t.cuenta && ctas.indexOf(t.cuenta) < 0) ctas.push(t.cuenta); });
        var cats = []; ts.forEach(function (t) { var c = catCorta(t.cat); if (cats.indexOf(c) < 0) cats.push(c); });
        reinc.push({ cuenta: ctas.join(' / '), cuentas: ctas, nombre: String(ts[0].raw.cliente).trim().toUpperCase(), categorias: cats, revision: rev, tickets: ts.map(tkInfo) });
      });
      reinc.sort(function (a, b) { return b.tickets.length - a.tickets.length || a.nombre.localeCompare(b.nombre, 'es'); });
      var nt = reinc.reduce(function (a, r) { return a + r.tickets.length; }, 0);
      var porCat = {};
      reinc.forEach(function (r) { r.tickets.forEach(function (t) { var c = catCorta(t.cat); porCat[c] = (porCat[c] || 0) + 1; }); });
      var sinNombre = ftth.filter(function (t) { return !claveCliente(t.raw.cliente); });
      /* base = tickets seleccionados: los que podrían ser reincidentes (con "Nombre Cliente" identificable) */
      var base = ftth.length - sinNombre.length;
      return { abonados: reinc.length, tickets: nt, ftth: base, seleccionados: base, candidatos: ftth.length, pct: base ? nt / base : null, detalle: reinc, porCategoria: porCat, sinNombre: sinNombre, sinCuenta: sinNombre,
        pendientes: pendientes, descartados: descartados, revisados: revisados, estado: estado };
    }
    ['sgu', 'pais', 'pia', 'otras'].forEach(function (g) {
      var sub = g === 'pia' || g === 'otras';
      porGrupo[g].reinc = reincidencia(porGrupo[g].lista, g === 'pais' ? 'pais' : 'sgu', 'ftth', true, sub ? porGrupo.sgu.reinc : null);
      /* reincidencia general: todas las categorías; en el país no hay revisión humana */
      porGrupo[g].reincGen = reincidencia(porGrupo[g].lista, g === 'pais' ? 'pais' : 'sgu', 'general', g !== 'pais', sub ? porGrupo.sgu.reincGen : null);
    });
    /* cola de revisión: FTTH en SGU total (cubre PIA y otras unidades) y País; general solo en SGU */
    var revisadosLista = [];
    sinTitulo.forEach(function (x) {
      var r0 = x.raw, info = { id: r0.id, cat: homologar(r0.categoria), estado: r0.estado, apertura: r0.apertura, cliente: r0.cliente || '', grupo: grpLabel(r0.grupo), solicitante: r0.solicitante || '' };
      if (!x.dec) colaRevision.push({ clave: 't|' + r0.id, tipo: 'titulo', ambito: 'titulo', etiqueta: 'Sin título', nombre: 'Ticket ' + r0.id + ' sin título', motivos: ['Sin título'], ticket: info, tickets: [] });
      else revisadosLista.push({ ambito: 'titulo', tipo: 'titulo', nombre: 'Ticket ' + r0.id + ' sin título', procede: !!(x.dec.procede && x.dec.procede[0]),
        revision: { clave: 't|' + r0.id, tipo: 'titulo', etiqueta: 'Sin título', titulo: (x.dec.procede && x.dec.procede[0]) || '', heredada: !!x.dec.heredada, motivos: ['Sin título'], por: x.dec.por || '', fecha: x.dec.fecha || '', revisados: [], procede: [], ticket: info } });
    });
    [['sgu', 'reinc'], ['pais', 'reinc'], ['sgu', 'reincGen']].forEach(function (x) {
      var RI = porGrupo[x[0]][x[1]];
      RI.pendientes.forEach(function (p) { p.ambito = x[0]; colaRevision.push(p); });
      RI.detalle.forEach(function (d) { if (d.revision) revisadosLista.push({ ambito: x[0], etiqueta: d.revision.etiqueta, tipo: d.revision.tipo, nombre: d.nombre, procede: true, revision: d.revision }); });
      RI.descartados.forEach(function (d) { revisadosLista.push({ ambito: x[0], etiqueta: d.revision.etiqueta, tipo: d.revision.tipo, nombre: d.nombre, procede: false, revision: d.revision }); });
    });

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
    controles.tipDuplicados = tipDuplicados.map(function (x) { var r = x.fila; return { id: r.id, original: x.original.id, cedula: r.cedula, cuenta: r.cuenta, ticket: r.ticket, fecha: r.fecha === null ? '' : fmtDate(r.fecha), categoria: r.categoria, subcategoria: r.subcategoria, motivo: r.motivo, estatus: r.estatus }; });
    controles.escaladosSinCruce = escCruce.filter(function (x) { return !x.ticket; }).map(function (x) { return { id: x.fila.id, ticket: x.fila.ticket || '(vacío)', cedula: x.fila.cedula, fecha: x.fila.fecha === null ? '' : fmtDate(x.fila.fecha), subcategoria: x.fila.subcategoria }; });
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
    controles.sinCuenta = SGU.filter(function (t) { return esReincidible(t.catK) && reincFuera.indexOf(t.catK) < 0 && !claveCliente(t.raw.cliente); }).map(function (t) { return { id: t.id, titulo: t.raw.titulo, cliente: t.raw.cliente || '' }; });
    /* FTTH del país cuyo número de cuenta en el título no coincide con el de la descripción (posible error de tipeo) */
    controles.cuentaDistinta = T.filter(function (t) { return t.cuentaOrigen === 'título' && t.cuentaDesc && t.cuenta !== t.cuentaDesc && esReincidible(t.catK) && reincFuera.indexOf(t.catK) < 0; })
      .map(function (t) { return { id: t.id, titulo: t.raw.titulo, cuentaTitulo: t.cuenta, cuentaDesc: t.cuentaDesc, grupo: t.pia ? 'PIA' : (t.sgu ? 'SGU otras unidades' : 'País') }; });
    controles.cuentaDeDescripcion = T.filter(function (t) { return t.cuentaOrigen === 'descripción' && esReincidible(t.catK) && reincFuera.indexOf(t.catK) < 0; }).length;
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
      var g = og[t.grpK] || (og[t.grpK] = { label: t.grpL || SIN_GRUPO, key: t.grpK, sgu: 0, total: 0 }); g.total++; if (t.sgu) g.sgu++;
      if (esReincidible(t.catK)) { var f = of[t.catK] || (of[t.catK] = { label: t.cat, key: t.catK, sgu: 0, total: 0 }); f.total++; if (t.sgu) f.sgu++; }
    });
    function lista(o) { return Object.keys(o).map(function (k) { return o[k]; }).filter(function (x) { return x.key; }).sort(function (a, b) { return b.sgu - a.sgu || b.total - a.total || a.label.localeCompare(b.label); }); }

    /* ================= "Ver lógica del cálculo" (auditoría) ================= */
    var DEF_G = {
      pia: 'Título contiene "' + cfg.sguMarker + '" y Solicitante = "' + cfg.piaSolicitante + '"',
      otras: 'Título contiene "' + cfg.sguMarker + '" y Solicitante distinto de "' + cfg.piaSolicitante + '"',
      sgu: 'Título contiene "' + cfg.sguMarker + '"',
      pais: 'Título NO contiene "' + cfg.sguMarker + '"'
    };
    var nomMeses = 'del ' + fmtDate(ini) + ' al ' + fmtDate(ultimoDia);
    function fdt(x) { if (x === null || x === undefined) return ''; var p = partsFromSerial(x); return pad(p.d) + '/' + pad(p.mo) + '/' + p.y + ' ' + pad(p.h) + ':' + pad(p.mi); }
    var filtroPeriodoGLPI = 'GLPI: tickets con "Fecha de apertura" ' + nomMeses + (corteEsFin ? '' : ' (hasta la descarga, ' + fdt(DESC) + ')') + '.';
    var filtroPeriodoTip = 'Tipificador: filas con "Fecha" ' + nomMeses + (corteEsFin ? '' : ' (hasta la descarga)') + '.';
    var filtroSA = 'Tipificador: "Sucursal" = "' + cfg.sucursal + '".';
    var filtroDup = 'Duplicados excluidos: misma Categoría, Subcategoría, Motivo, Fecha (día), Cédula, ID de cuenta y Ticket GLPI de una fila anterior (' + tipDuplicados.length + ' filas).';
    var COLS_T = ['ID', 'Título', 'Estado', 'Categoría (homologada)', 'Grupo técnico (asignado)', 'Solicitante', 'Apertura', 'Solución', 'Cierre', 'Tiempo de resolución'];
    function filaT(t) { return [t.id, t.raw.titulo, t.raw.estado, t.cat, t.grpL, t.raw.solicitante, fdt(t.raw.apertura), fdt(t.raw.solucion), fdt(t.raw.cierre), t.dur === null ? '' : fmtD(t.dur)]; }
    var COLS_P = ['ID', 'Fecha', 'Cédula', 'ID de cuenta', 'Categoría', 'Subcategoría', 'Motivo', 'Estatus', 'Ticket GLPI'];
    function filaP(r) { return [r.id, r.fecha === null ? '' : fmtDate(r.fecha), r.cedula, r.cuenta, r.categoria, r.subcategoria, r.motivo, r.estatus, r.ticket]; }
    function regT(titulo, L) { return { titulo: titulo, cols: COLS_T, filas: L.map(filaT) }; }
    function regP(titulo, L) { return { titulo: titulo, cols: COLS_P, filas: L.map(filaP) }; }
    function filtroCampo(campo, claves, lab) {
      if (lab === 'Otro') return function (t) { return claves.indexOf(t[campo]) < 0; };
      var k = campo === 'grpK' ? grpKey(lab) : norm(lab);
      return function (t) { return t[campo] === k; };
    }
    /* asignación de tickets a los grupos técnicos (tabla 5.2) */
    var _asig = null;
    function asignacionGrupos() {
      if (_asig) return _asig;
      var orden = {}; gruposU.forEach(function (l, i) { orden[grpKey(l)] = i; });
      var M = {}, det = [], sinG = 0, enFilas = 0, resueltos = 0, unif = {};
      T.forEach(function (t) {
        var orig = grpLineas(t.raw.grupo).join(' · '), fila = orden.hasOwnProperty(t.grpK) && t.grpK ? t.grpL : 'Otro';
        var seg = t.pia ? 'pia' : t.sgu ? 'otras' : 'pais', entra = t.res && t.dur !== null;
        if (!orig) sinG++;
        if (fila !== 'Otro') enFilas++;
        if (entra) resueltos++;
        if (t.grpK) unif[t.grpK] = 1;
        var m = M[orig] || (M[orig] = { original: orig || '(sin grupo)', regla: grpRegla(t.raw.grupo), unificado: t.grpL || '(sin grupo)', fila: fila, ord: fila === 'Otro' ? 999 : orden[t.grpK], pia: 0, otras: 0, pais: 0, resueltos: 0, n: 0 });
        m[seg]++; m.n++; if (entra) m.resueltos++;
        det.push([{ pia: 'PIA', otras: 'SGU otras unidades', pais: 'País' }[seg], t.id, t.raw.titulo, orig || '(sin grupo)', m.regla, t.grpL || '(sin grupo)', fila, t.raw.estado, fdt(t.raw.solucion), entra ? 'Sí' : (t.res ? 'No: sin fecha de solución' : 'No: no está resuelto'), t.dur === null ? '' : fmtD(t.dur)]);
      });
      var mapa = Object.keys(M).map(function (k) { return M[k]; }).sort(function (a, b) { return a.ord - b.ord || b.n - a.n || a.original.localeCompare(b.original); });
      _asig = {
        mapa: mapa, sinGrupo: sinG, enFilas: enFilas, resueltos: resueltos, unificados: Object.keys(unif).length,
        colsMapa: ['Grupo en GLPI', 'Paso que aplica', 'Grupo asignado', 'Fila de la tabla', 'Tickets PIA', 'Tickets SGU otras unidades', 'Tickets País', 'Resueltos (entran al tiempo)'],
        detalle: { titulo: 'Asignación ticket por ticket', cols: ['Columna', 'ID', 'Título', 'Grupo en GLPI', 'Paso que aplica', 'Grupo asignado', 'Fila de la tabla', 'Estado', 'Solución', 'Entra al tiempo', 'Tiempo de resolución'], filas: det }
      };
      return _asig;
    }
    function textoMP(mp) {
      if (!mp.n) return ['No hay tickets resueltos: la celda muestra "-".'];
      var out = ['Promedio = suma de los tiempos ÷ ' + mp.n + ' tickets = ' + fmtD(mp.prom) + '.'];
      out.push(mp.moda === null ? 'Moda: ningún valor (redondeado a la hora) se repite 2 o más veces, por eso se muestra el promedio (P).' : 'Moda = tiempo más repetido después de redondear cada ticket a la hora más cercana: ' + fmtD(mp.moda) + '.');
      out.push('Regla de la celda: sin moda → "P: promedio"; moda 0 h → "M: 0 h / P: promedio"; moda mayor a 0 → "M: moda"; fila Total → "M: moda / P: promedio".');
      return out;
    }
    function explicar(x) {
      var e = { titulo: '', valor: '', definicion: '', pasos: [], filtros: [], registros: [] };
      var g = x.g, L = g ? porGrupo[g].lista : null, et = g ? ETIQUETAS[g] : '';
      switch (x.k) {
        case 'prod':
          e.titulo = 'Productividad del punto PIA'; e.valor = miles(tipSA.length) + ' casos · ' + miles(Object.keys(cedulas).length) + ' abonados';
          e.definicion = 'Casos únicos que la sucursal ' + cfg.sucursal + ' registró en el Tipificador en el período. Abonados = cédulas distintas atendidas.';
          e.filtros = [filtroSA, filtroPeriodoTip, filtroDup];
          e.pasos = ['Filas de ' + cfg.sucursal + ' en el período: ' + miles(tipSAbruto.length) + '.', 'Menos duplicados: ' + miles(tipDuplicados.length) + '.', 'Casos únicos (productividad): ' + miles(tipSA.length) + '.', 'Cédulas distintas entre esos casos (abonados): ' + miles(Object.keys(cedulas).length) + '.'];
          e.registros = [regP('Casos contados', tipSA), regP('Duplicados excluidos', tipDuplicados.map(function (d) { return d.fila; })),
            regP('Escalados sin número de ticket GLPI', escCruce.filter(function (c) { return !c.fila.ticket; }).map(function (c) { return c.fila; })),
            regP('Escalados con número que no está en GLPI', escCruce.filter(function (c) { return c.fila.ticket && !c.ticket; }).map(function (c) { return c.fila; }))];
          break;
        case 'irSGU':
          var IS = fijos.irSGU, solL = sguL.filter(function (t) { return t.raw.solucion !== null; });
          var solPIA = solL.filter(function (t) { return eq(t.raw.solicitante, cfg.piaSolicitante); }), solOtr = solL.filter(function (t) { return !eq(t.raw.solicitante, cfg.piaSolicitante); });
          e.titulo = 'Índice de resolución SGU'; e.valor = pct(IS.pct) + ' · ' + miles(IS.num) + ' de ' + miles(IS.den);
          e.definicion = 'Numerador: todos los tickets SGU de GLPI resueltos (con Fecha de solución) más los casos de San Agustín con Estatus "' + cfg.fcrStatus + '". Denominador: todos los tickets SGU de GLPI más esos mismos casos de 1er contacto.';
          e.filtros = [filtroPeriodoGLPI, 'SGU: ' + DEF_G.sgu + '.', 'Resuelto: tiene Fecha de solución (no vacía), sin importar el estado.', 'Creado por PIA: SGU y Solicitante "' + cfg.piaSolicitante + '". Creado por otras unidades: SGU con otro solicitante.', filtroSA, filtroPeriodoTip, filtroDup];
          e.pasos = ['Resueltos en 1er contacto (Tipificador): ' + miles(IS.fcr) + '.', 'Tickets SGU resueltos creados por PIA: ' + miles(IS.resPIA) + '.', 'Tickets SGU resueltos creados por otras unidades: ' + miles(IS.resOtras) + '.',
            'Numerador: ' + miles(IS.fcr) + ' + ' + miles(IS.resPIA) + ' + ' + miles(IS.resOtras) + ' = ' + miles(IS.num) + '.', 'Denominador: ' + miles(IS.creados) + ' tickets SGU + ' + miles(IS.fcr) + ' de 1er contacto = ' + miles(IS.den) + '.', 'Resultado: ' + miles(IS.num) + ' ÷ ' + miles(IS.den) + ' = ' + pct(IS.pct) + '.'];
          e.registros = [regP('Resueltos en 1er contacto', fcrFilas), regT('Tickets SGU resueltos · creados por PIA', solPIA), regT('Tickets SGU resueltos · creados por otras unidades', solOtr), regT('Tickets SGU (denominador)', sguL)];
          break;
        case 'fcr':
          e.titulo = 'Resolución en 1er contacto (FCR)'; e.valor = pct(fijos.fcr.pct) + ' · ' + miles(fcr) + ' casos';
          e.definicion = 'Casos únicos del PIA con Estatus "' + cfg.fcrStatus + '", sobre la productividad del punto.';
          e.filtros = [filtroSA, filtroPeriodoTip, filtroDup];
          e.pasos = ['Casos únicos con Estatus "' + cfg.fcrStatus + '": ' + miles(fcr) + '.', 'Productividad del punto (casos únicos): ' + miles(tipSA.length) + '.', 'FCR = ' + miles(fcr) + ' ÷ ' + miles(tipSA.length) + ' = ' + pct(fijos.fcr.pct) + '.'];
          e.registros = [regP('Resueltos en 1er contacto', fcrFilas)];
          break;
        case 'ir':
          e.titulo = 'Índice de resolución PIA'; e.valor = pct(fijos.ir.pct) + ' · ' + miles(irNum) + ' casos';
          e.definicion = 'Casos que el PIA resolvió: los resueltos en 1er contacto más los tickets escalados por PIA que ya tienen fecha de solución en GLPI, sobre la productividad del punto. Un ticket escalado por PIA es el que San Agustín anotó como escalado en el Tipificador; en GLPI pudo crearlo el PIA u otra persona. Por eso no coincide con los tickets creados por el PIA del canal de creación.';
          e.filtros = [filtroSA, filtroPeriodoTip, filtroDup, 'Escalados: casos con Estatus distinto de "' + cfg.fcrStatus + '". Se buscan en GLPI por la columna "Ticket GLPI" (en todo el archivo de GLPI, sin filtro de fecha).'];
          e.pasos = ['Resueltos en 1er contacto: ' + miles(fcr) + '.', 'Tickets escalados por PIA: ' + miles(escFilas.length) + ' (' + miles(fijos.ir.escSinTicket) + ' sin número de ticket, ' + miles(fijos.ir.escNoEncontrado) + ' con número que no está en GLPI).', 'Tickets escalados por PIA ya solucionados (con "Fecha de solución" en GLPI): ' + miles(escResueltos) + '.', 'Índice = (' + miles(fcr) + ' + ' + miles(escResueltos) + ') ÷ ' + miles(tipSA.length) + ' = ' + pct(fijos.ir.pct) + '.'];
          e.registros = [regP('Resueltos en 1er contacto', fcrFilas), { titulo: 'Escalados y su ticket en GLPI', cols: COLS_P.concat(['Encontrado en GLPI', 'Estado GLPI', 'Fecha de solución', 'Cuenta como resuelto']), filas: escCruce.map(function (c) { return filaP(c.fila).concat([c.ticket ? 'Sí' : 'No', c.ticket ? c.ticket.estado : '', c.ticket ? fdt(c.ticket.solucion) : '', c.resuelto ? 'Sí' : 'No']); }) }];
          break;
        case 'nps':
          e.titulo = 'Satisfacción / NPS'; e.valor = cfg.nps || '—'; e.definicion = 'No tiene fuente automática. Es el valor que se escribe en el Repositorio al subir la carga o con "Editar".'; break;
        case 'creados': case 'solucionados':
          var sol = x.k === 'solucionados', Ls = sol ? L.filter(function (t) { return t.res; }) : L;
          e.titulo = (sol ? 'Tickets solucionados · ' : 'Tickets creados · ') + et; e.valor = miles(Ls.length);
          e.definicion = sol ? 'Tickets del grupo con Estado "Resuelto" o "Cerrado".' : 'Todos los tickets del grupo abiertos en el período.';
          e.filtros = [filtroPeriodoGLPI, et + ': ' + DEF_G[g] + '.'];
          e.pasos = ['Tickets del grupo en el período: ' + miles(L.length) + '.'].concat(sol ? ['Con Estado Resuelto o Cerrado: ' + miles(Ls.length) + '.'] : []);
          e.registros = [regT(e.titulo, Ls)]; break;
        case 'prom':
          var LR = L.filter(function (t) { return t.res && t.dur !== null; }), mp = porGrupo[g].tiempo;
          e.titulo = 'Tiempo promedio de resolución · ' + et; e.valor = fmtD(mp.prom);
          e.definicion = 'Promedio de (Fecha de solución − Fecha de apertura) de los tickets resueltos del grupo, en tiempo corrido (incluye noches y fines de semana).';
          e.filtros = [filtroPeriodoGLPI, et + ': ' + DEF_G[g] + '.', 'Solo tickets con Estado Resuelto o Cerrado.'];
          e.pasos = ['Tickets resueltos: ' + miles(mp.n) + '.'].concat(textoMP(mp).slice(0, 2));
          e.registros = [regT('Tickets resueltos y su tiempo', LR)]; break;
        case 'cmp':
          var c = comparativos[x.id], A = porGrupo[c.a].tiempo, B = porGrupo[c.b].tiempo;
          e.titulo = 'Comparativo ' + ETIQUETAS[c.a] + ' vs. ' + ETIQUETAS[c.b]; e.valor = c.valor + (c.ganador ? ' a favor de ' + ETIQUETAS[c.ganador] : '');
          e.definicion = 'Diferencia absoluta entre los tiempos promedio de resolución de los dos grupos, redondeada a la hora más cercana. "A favor" del grupo con menor promedio.';
          e.filtros = [filtroPeriodoGLPI, ETIQUETAS[c.a] + ': ' + DEF_G[c.a] + '.', ETIQUETAS[c.b] + ': ' + DEF_G[c.b] + '.'];
          e.pasos = ['Promedio ' + ETIQUETAS[c.a] + ': ' + fmtD(A.prom) + ' (' + miles(A.n) + ' tickets).', 'Promedio ' + ETIQUETAS[c.b] + ': ' + fmtD(B.prom) + ' (' + miles(B.n) + ' tickets).', 'Diferencia: ' + c.valor + '.'];
          break;
        case 'semana':
          var enV = L.filter(function (t) { return t.dAp >= wIni && t.dAp < wFin; });
          var sS = L.filter(function (t) { return t.dSol !== null && t.dSol >= wIni && t.dSol < wFin; });
          var sM = sS.filter(function (t) { return t.dAp >= wIni; }), sP = sS.filter(function (t) { return t.dAp < wIni; });
          var SW = porGrupo[g].semana, pv = prevSem.filter(EN[g]);
          var pvSi = pv.filter(function (t) { return t.horasLab < LAB_LIMITE; }), pvNo = pv.filter(function (t) { return t.horasLab >= LAB_LIMITE; });
          var colsH = COLS_T.concat(['Horas laborales hasta la solución']);
          var regH = function (tt, LL) { return { titulo: tt, cols: colsH, filas: LL.map(function (t) { return filaT(t).concat([Math.round(t.horasLab * 100) / 100]); }) }; };
          e.titulo = 'Tickets solucionados en la semana · ' + et; e.valor = pct(SW.pct) + ' · ' + SW.num + ' de ' + SW.den;
          e.definicion = SW.modo === 2
            ? 'Opción 2 (incluye semana pasada): tickets abiertos en la semana y solucionados en la misma semana, más los tickets abiertos la semana pasada que se solucionaron esta semana en menos de ' + LAB_LIMITE + ' horas laborales. Esos tickets de la semana pasada se suman tanto a los solucionados como a la base.'
            : 'Opción 1 (desde el inicio de la semana): tickets abiertos en la semana y solucionados dentro de la misma semana (estado Resuelto o Cerrado, por su "Fecha de solución"), sobre los tickets abiertos en la semana.';
          e.filtros = ['Semana: del ' + fmtDate(wIni) + ' al ' + fmtDate(wFin - 1) + ' (00:00 a 23:59), los 8 días antes del corte.', et + ': ' + DEF_G[g] + '.', filtroPeriodoGLPI];
          if (SW.modo === 2) e.filtros.push('Semana pasada: del ' + fmtDate(pIni) + ' al ' + fmtDate(wIni - 1) + ' (los 8 días anteriores; cuentan aunque queden antes del inicio del período).',
            'Horas laborales: lunes a sábado de ' + LAB_INI + ':00 a ' + LAB_FIN + ':00 (12 horas por día; domingos no cuentan; no se descuentan feriados), desde la apertura hasta la solución. Debe ser menor a ' + LAB_LIMITE + ' horas.');
          e.pasos = ['Abiertos en la semana: ' + enV.length + '.', 'De esos, solucionados en la misma semana: ' + sM.length + '.'];
          if (SW.modo === 2) e.pasos.push('Abiertos la semana pasada y solucionados esta semana: ' + pv.length + '; en menos de ' + LAB_LIMITE + ' horas laborales: ' + pvSi.length + '.',
            'Resultado: (' + sM.length + ' + ' + pvSi.length + ') ÷ (' + enV.length + ' + ' + pvSi.length + ') = ' + pct(SW.pct) + '.');
          else e.pasos.push('Resultado: ' + sM.length + ' ÷ ' + enV.length + ' = ' + pct(SW.pct) + '.');
          e.pasos.push('Como referencia: en la semana se solucionaron ' + sS.length + ' tickets en total (' + sM.length + ' de la misma semana + ' + sP.length + ' de semanas pasadas, dentro del período).');
          e.registros = [regT('Abiertos en la semana', enV), regT('Solucionados en la semana, abiertos esa misma semana', sM)];
          if (SW.modo === 2) e.registros.push(regH('Semana pasada · solucionados esta semana en menos de ' + LAB_LIMITE + ' h laborales (cuentan)', pvSi), regH('Semana pasada · solucionados esta semana con ' + LAB_LIMITE + ' h laborales o más (no cuentan)', pvNo));
          else e.registros.push(regT('Solucionados en la semana, de semanas pasadas (no cuentan en la opción 1)', sP));
          break;
        case 'reinc':
          var RI = porGrupo[g].reinc;
          e.titulo = 'Reincidencia de fallas FTTH · ' + et; e.valor = RI.abonados + ' abonados · ' + RI.tickets + ' tickets';
          e.definicion = 'Clientes (columna "Nombre Cliente" de GLPI) con 2 o más tickets FTTH dentro del mismo grupo en el período. La cuenta que se muestra sale del título.';
          e.filtros = [filtroPeriodoGLPI, et + ': ' + DEF_G[g] + '.', 'Categoría contiene "FTTH" y no dice "Cobranzas Masivas" (esas nunca cuentan).', reincFuera.length ? 'No cuentan: ' + (cfg.reincExcluir || []).join('; ') + '.' : 'Cuentan todas las categorías FTTH.', 'Cliente repetido: mismo "Nombre Cliente" (sin distinguir mayúsculas, acentos ni signos). Tickets con el nombre vacío o con error ("#NAME?") no entran (' + RI.sinNombre.length + ').', 'Cuenta mostrada: el último número del título "... - NOMBRE - CÉDULA - CUENTA" (si la cédula trae sufijo, p. ej. 18524490-001, el sufijo no es la cuenta); si el título no la trae, se toma de la descripción.'];
          e.filtros.push((g === 'pia' || g === 'otras') ? 'Revisión humana: se usa la de SGU total (lo decidido en SGU vale para este grupo; los clientes pendientes en SGU no cuentan).' : 'Revisión humana: si un cliente tiene cédulas distintas, contratos distintos, o la cédula (6 a 8 dígitos) o el contrato (1 a 6 dígitos) no se identifican con seguridad, un operador decide qué tickets proceden. Revisados en este grupo: ' + RI.revisados + ' (' + RI.descartados.length + ' descartados); pendientes: ' + RI.pendientes.length + ' (no cuentan hasta revisarse).');
          e.pasos = ['Tickets seleccionados: ' + RI.candidatos + ' FTTH del grupo, menos ' + RI.sinNombre.length + ' sin "Nombre Cliente" identificable = ' + RI.ftth + '.', 'Clientes con 2 o más tickets (después de la revisión): ' + RI.abonados + ', que suman ' + RI.tickets + ' tickets.', 'Porcentaje: ' + RI.tickets + ' ÷ ' + RI.ftth + ' = ' + pct(RI.pct) + '.'];
          e.registros = [{ titulo: 'Clientes reincidentes', cols: ['Nombre Cliente', 'Cédula (título)', 'Cuenta (título)', 'Ticket', 'Categoría', 'Estado', 'Revisión'], filas: RI.detalle.reduce(function (a, d) { return a.concat(d.tickets.map(function (t) { return [d.nombre, t.cedula, t.cuenta, t.id, t.cat, t.estado, d.revision ? 'Procede (' + d.revision.por + ')' : 'No requirió']; })); }, []) }].concat(RI.descartados.length ? [{ titulo: 'Descartados en la revisión', cols: ['Nombre Cliente', 'Tickets', 'Revisado por'], filas: RI.descartados.map(function (d) { return [d.nombre, d.revision.revisados.map(function (t) { return t.id; }).join(', '), d.revision.por]; }) }] : []).concat(RI.sinNombre.length ? [{ titulo: 'Tickets sin "Nombre Cliente" (no entran)', cols: ['Ticket', 'Título', 'Nombre Cliente'], filas: RI.sinNombre.map(function (t) { return [t.id, t.raw.titulo, t.raw.cliente || '']; }) }] : []); break;
        case 'reincGen':
          var RG = porGrupo[g].reincGen;
          e.titulo = 'Reincidencia general (todas las categorías) · ' + et; e.valor = RG.abonados + ' clientes · ' + RG.tickets + ' tickets';
          e.definicion = 'Clientes (columna "Nombre Cliente" de GLPI) con 2 o más tickets de cualquier categoría, sin excepción, dentro del mismo grupo en el período.';
          e.filtros = [filtroPeriodoGLPI, et + ': ' + DEF_G[g] + '.', 'Todas las categorías, sin excepción (incluye facturación, reembolso, cambio de plan y Cobranzas Masivas).', 'Cliente repetido: mismo "Nombre Cliente" (sin distinguir mayúsculas, acentos ni signos). Tickets con el nombre vacío o con error no entran (' + RG.sinNombre.length + ').',
            g === 'pais' ? 'País: sin revisión humana (todos los clientes repetidos cuentan).' : (g === 'pia' || g === 'otras') ? 'Revisión humana: se usa la de SGU total.' : 'Revisión humana (solo SGU): cédulas distintas, contratos distintos, o cédula/contrato sin identificar con seguridad. Revisados: ' + RG.revisados + ' (' + RG.descartados.length + ' descartados); pendientes: ' + RG.pendientes.length + '. Si la revisión de fallas FTTH ya decidió sobre los mismos tickets, se usa esa decisión.'];
          e.pasos = ['Tickets seleccionados: ' + RG.candidatos + ' tickets del grupo, menos ' + RG.sinNombre.length + ' sin "Nombre Cliente" identificable = ' + RG.ftth + '.', 'Clientes con 2 o más tickets' + (g === 'pais' ? '' : ' (después de la revisión)') + ': ' + RG.abonados + ', que suman ' + RG.tickets + ' tickets.', 'Porcentaje: ' + RG.tickets + ' ÷ ' + RG.ftth + ' = ' + pct(RG.pct) + '.'];
          e.registros = [{ titulo: 'Clientes reincidentes (todas las categorías)', cols: ['Nombre Cliente', 'Cédula (título)', 'Cuenta (título)', 'Ticket', 'Categoría', 'Estado', 'Revisión'], filas: RG.detalle.reduce(function (a, d) { return a.concat(d.tickets.map(function (t) { return [d.nombre, t.cedula, t.cuenta, t.id, t.cat, t.estado, d.revision ? 'Procede (' + d.revision.por + ')' : 'No requirió']; })); }, []) }]; break;
        case 'upgrades': case 'sva':
          var U = porGrupo[g].upgrades, V = porGrupo[g].sva;
          if (x.k === 'upgrades') {
            e.titulo = 'Upgrades · ' + et; e.valor = miles(U.n);
            e.definicion = 'Aumentos de plan VNET (200, 400, 600, 1 Giga). GLPI: tickets "' + cfg.cambioPlanCat + '" cuya descripción indica subir de plan. Tipificador: Subcategoría "' + cfg.aumentoSubcat + '". Si un ticket está en las dos fuentes, cuenta una vez.';
            e.filtros = [filtroPeriodoGLPI, filtroPeriodoTip, et + ': ' + DEF_G[g] + '.', 'No cuentan disminuciones ni cambios revertidos ("por accidente", "equivocado").'];
            e.pasos = ['Cambios de plan del grupo en GLPI: ' + U.cambiosPlan + ' (' + U.bajas + ' a un plan menor o revertidos).', 'Aumentos en GLPI: ' + U.glpi.length + (U.glpi.length ? ' (' + U.glpi.join(', ') + ')' : '') + '.', 'Aumentos en el Tipificador: ' + U.tip + ', repetidos con GLPI: ' + U.repetidos + '.', 'Total: ' + U.n + '.'];
            e.registros = [regT('Cambios de plan del grupo en GLPI', cambios.filter(function (c) { return EN[g](c.t); }).map(function (c) { return c.t; }))];
          } else {
            e.titulo = 'SVA · ' + et; e.valor = miles(V.n);
            e.definicion = 'Activaciones de ExitLag o Pley (Tipificador: Categoría Exitlag o Pley con Subcategoría de activación) y tickets Pley de GLPI con activación o cambio a un plan Pley superior.';
            e.filtros = [filtroPeriodoGLPI, filtroPeriodoTip, et + ': ' + DEF_G[g] + '.', 'No cuentan retiros, bajas, desactivaciones, soporte ni Contigo +.'];
            e.pasos = ['En el Tipificador: ' + V.tip + '.', 'En GLPI: ' + V.glpi.length + (V.glpi.length ? ' (' + V.glpi.join(', ') + ')' : '') + '.', 'Total: ' + V.n + '.'];
          }
          break;
        case 'grupos':
          var GA = asignacionGrupos();
          e.titulo = 'Cómo se asignan los tickets a los grupos técnicos'; e.valor = miles(GA.resueltos) + ' tickets resueltos en la tabla';
          e.definicion = 'La tabla "Tiempo de resolución por grupo técnico" toma cada ticket de GLPI del período, lee las líneas de su columna "Asignado a - Grupo de técnicos", le asigna un solo grupo con los pasos de prioridad y lo pone en la fila de ese grupo. Si el grupo no es una de las filas seleccionadas en el filtro, va a "Otro". El tiempo solo usa tickets resueltos.';
          e.filtros = [filtroPeriodoGLPI, 'Columnas: PIA = ' + DEF_G.pia + '; SGU otras unidades = ' + DEF_G.otras + '; País = ' + DEF_G.pais + '.', 'Grupo técnico: columna "Asignado a - Grupo de técnicos", leída línea por línea (cada línea es un grupo de GLPI).', 'Asignación, en este orden: ' + REGLAS_GRUPO.map(function (r, i) { return (i + 1) + ') ' + r; }).join(' ') + ' Las líneas se comparan completas, sin distinguir mayúsculas (sí acentos y guiones), igual que la fórmula de auditoría en Excel.', 'Filas de la tabla: ' + gruposU.join(', ') + '. Cualquier otro grupo va a "Otro".', 'Entra al cálculo del tiempo: Estado "Resuelto" o "Cerrado" y con "Fecha de solución".'];
          e.pasos = ['Tickets del período: ' + miles(T.length) + '.', 'Con grupo técnico: ' + miles(T.length - GA.sinGrupo) + '; sin grupo: ' + miles(GA.sinGrupo) + ' (quedan en "' + SIN_GRUPO + '").', 'Combinaciones distintas del campo en GLPI: ' + miles(GA.mapa.length) + ', que se asignan a ' + miles(GA.unificados) + ' grupos.', 'Tickets en las filas de la tabla: ' + miles(GA.enFilas) + '; en "Otro": ' + miles(T.length - GA.enFilas) + '.', 'Resueltos que entran al tiempo: ' + miles(GA.resueltos) + ' (los demás no están resueltos o no tienen fecha de solución).'];
          e.registros = [{ titulo: 'Grupos de GLPI y su fila en la tabla', cols: GA.colsMapa, filas: GA.mapa.map(function (m) { return [m.original, m.regla, m.unificado, m.fila, m.pia, m.otras, m.pais, m.resueltos]; }) }, GA.detalle];
          break;
        case 'cel': case 'prodcel':
          var tabla = x.k === 'prodcel' ? 'productividad' : x.t, campo = tabla === 'tiempoGrupo' ? 'grpK' : 'catK';
          var filas = tabla === 'productividad' ? productividad : (tabla === 'tiempoGrupo' ? tiempoGrupo : tiempoCategoria);
          var row = filas[x.r], claves = campo === 'grpK' ? grpKeys : catKeys;
          if (row.estatus) {
            e.titulo = 'Estatus de un ticket de reporte · PIA'; e.valor = miles(estatusN);
            e.definicion = 'Consultas del Tipificador de ' + cfg.sucursal + ' con Subcategoría "' + cfg.estatusSubcat + '" y Estatus distinto de "' + cfg.fcrStatus + '". No generan ticket.';
            e.filtros = [filtroSA, filtroPeriodoTip, filtroDup];
            e.registros = [regP('Consultas de estatus', tipSA.filter(function (r) { return eq(r.subcategoria, cfg.estatusSubcat) && !eq(r.estatus, cfg.fcrStatus); }))];
            break;
          }
          var Lc = row.total ? L : L.filter(filtroCampo(campo, claves, row.label));
          var nombreTabla = tabla === 'productividad' ? 'Productividad por categoría' : (tabla === 'tiempoGrupo' ? 'Tiempo de resolución por grupo técnico' : 'Tiempo de resolución por categoría');
          e.titulo = nombreTabla + ' · ' + row.label + ' · ' + et;
          e.filtros = [filtroPeriodoGLPI, et + ': ' + DEF_G[g] + '.', row.total ? 'Fila Total: todos los tickets del grupo.' : (row.label === 'Otro' ? (campo === 'grpK' ? 'Grupo técnico' : 'Categoría') + ' fuera de la lista de la tabla.' : (campo === 'grpK' ? 'Grupo técnico (asignado)' : 'Categoría (homologada)') + ' = "' + row.label + '".')];
          if (campo === 'grpK') e.filtros.push('Asignación del grupo: ' + REGLAS_GRUPO.map(function (r, n) { return (n + 1) + ') ' + r; }).join(' '));
          else e.filtros.push('Categorías homologadas: se quita ">" o "<" al final.');
          if (tabla === 'productividad') {
            var LsP = Lc.filter(function (t) { return t.res; });
            e.valor = x.m === 'solucionados' ? miles(LsP.length) : miles(Lc.length);
            e.definicion = x.m === 'solucionados' ? 'Tickets de la fila con Estado Resuelto o Cerrado.' : 'Todos los tickets de la fila abiertos en el período.';
            e.pasos = ['Creados: ' + miles(Lc.length) + '.', 'Solucionados: ' + miles(LsP.length) + '.'];
            e.registros = [regT(x.m === 'solucionados' ? 'Tickets solucionados' : 'Tickets creados', x.m === 'solucionados' ? LsP : Lc)];
          } else {
            var LR2 = Lc.filter(function (t) { return t.res && t.dur !== null; }), mp2 = row[g];
            e.valor = x.m === 'n' ? miles(mp2.n) + ' tickets resueltos' : mp2.texto;
            e.definicion = x.m === 'n' ? 'Tickets resueltos (Estado Resuelto o Cerrado) de la fila.' : '"Moda o promedio" del tiempo de resolución (Fecha de solución − Fecha de apertura) de los tickets resueltos de la fila.';
            e.pasos = x.m === 'n' ? ['Tickets de la fila: ' + miles(Lc.length) + '; resueltos: ' + miles(LR2.length) + '.'] : textoMP(mp2);
            e.registros = [regT('Tickets resueltos de la fila', LR2)];
          }
          break;
        case 'jor':
          var J = porGrupo[g].jornada, SWj = porGrupo[g].semana, dia = x.d >= 0 ? J.filas[x.d] : null, D = dia ? dia.serial : null, esArr = x.d === -2;
          var etiq = { abiertos: 'Abiertos', pendientes: 'Pendientes', resueltos: 'Resueltos', mismoDia: 'Resueltos el mismo día', resSemana: 'Resueltos de esa semana', pendAcc: 'Pendiente acumulado', resAcc: 'Resuelto acumulado', pct: '% en jornada' }[x.c];
          var extJ = SWj.modo === 2 ? prevSem.filter(EN[g]).filter(function (t) { return t.horasLab < LAB_LIMITE; }) : [];
          var semJ = L.filter(function (t) { return t.dAp >= wIni && t.dAp < wFin; }), UJ = semJ.concat(extJ);
          var hasta = D === null ? wFin - 1 : D;
          var abiertosD = esArr ? extJ : D === null ? UJ : L.filter(function (t) { return t.dAp === D; });
          var mismo = esArr ? [] : abiertosD.filter(function (t) { return t.dSol === t.dAp; });
          var resD = esArr ? [] : UJ.filter(function (t) { return D === null ? (t.dSol !== null && t.dSol >= wIni && t.dSol < wFin) : t.dSol === D; });
          var pendAcc = esArr ? extJ : UJ.filter(function (t) { return t.dAp <= hasta && !(t.dSol !== null && t.dSol <= hasta); });
          var resAcc = esArr ? [] : UJ.filter(function (t) { return t.dSol !== null && t.dSol >= wIni && t.dSol <= hasta; });
          var univ = 'tickets abiertos desde el primer día de la semana (' + fmtDate(wIni) + ')' + (SWj.modo === 2 ? ' más los abiertos la semana pasada que se solucionaron en la semana en menos de ' + LAB_LIMITE + ' horas laborales' : '');
          e.titulo = etiq + ' · ' + et + ' · ' + (esArr ? 'Semana pasada (< ' + LAB_LIMITE + ' h laborales)' : dia ? dia.dia + ' ' + dia.fecha : 'Total semanal');
          e.filtros = [et + ': ' + DEF_G[g] + '.', 'Semana: del ' + fmtDate(wIni) + ' al ' + fmtDate(wFin - 1) + '.', 'Indicador semanal: opción ' + SWj.modo + (SWj.modo === 2 ? ' (incluye semana pasada, < ' + LAB_LIMITE + ' h laborales de lunes a sábado ' + LAB_INI + ':00–' + LAB_FIN + ':00).' : ' (desde el inicio de la semana).'), 'Resuelto = Estado Resuelto o Cerrado, por su Fecha de solución. Resueltos y acumulados cuentan solo ' + univ + '.'];
          var defs = {
            abiertos: [esArr ? 'Tickets abiertos la semana pasada (' + fmtDate(pIni) + ' al ' + fmtDate(wIni - 1) + ') y solucionados en la semana en menos de ' + LAB_LIMITE + ' horas laborales. Se suman a la base.' : D === null ? 'Base de la semana: ' + univ + '.' : 'Tickets con Fecha de apertura ese día.', abiertosD.length, regT('Abiertos', abiertosD)],
            pendientes: [esArr ? 'Tickets de la semana pasada que entran a la semana sin solución.' : 'Abiertos ' + (dia ? 'ese día' : 'en la semana') + ' que no se resolvieron el mismo día de su apertura.', esArr ? extJ.length : (dia || J.total).pendientes, regT('Pendientes', esArr ? extJ : abiertosD.filter(function (t) { return t.dSol !== t.dAp; }))],
            resueltos: ['Solucionados ' + (dia ? 'ese día' : 'en la semana') + ', de los ' + univ + '.', resD.length, regT('Resueltos', resD)],
            mismoDia: ['Abiertos y resueltos el mismo día.', mismo.length, regT('Resueltos el mismo día', mismo)],
            resSemana: ['Solucionados ' + (dia ? 'ese día' : 'en la semana') + ', de los ' + univ + '.', resD.length, regT('Resueltos de esa semana', resD)],
            pendAcc: [esArr ? 'Tickets de la semana pasada que entran a la semana sin solución.' : 'De los ' + univ + ': abiertos hasta el ' + fmtDate(hasta) + ' que seguían sin solución al cierre de ese día.', pendAcc.length, regT('Pendientes acumulados', pendAcc)],
            resAcc: ['Suma de "Resueltos" desde el primer día de la semana hasta el ' + fmtDate(hasta) + '.', esArr ? 0 : resAcc.length, regT('Resueltos acumulados', resAcc)],
            pct: ['Resueltos el mismo día ÷ abiertos ' + (dia ? 'ese día' : 'en la semana') + ' (no incluye la semana pasada).', pct(esArr ? null : dia ? dia.pct : J.total.pct), regT('Abiertos', D === null ? semJ : abiertosD)]
          }[x.c];
          e.definicion = defs[0]; e.valor = String(typeof defs[1] === 'number' ? miles(defs[1]) : defs[1]);
          e.pasos = x.c === 'pct' && !esArr ? ['Abiertos: ' + (D === null ? semJ.length : abiertosD.length) + '; resueltos el mismo día: ' + mismo.length + '.', 'Resultado: ' + e.valor + '.'] : [e.definicion + ' Resultado: ' + e.valor + '.'];
          e.registros = [defs[2]]; break;
        case 'gestion':
          var SWg = porGrupo[g].semana, extG = SWg.modo === 2 ? prevSem.filter(EN[g]).filter(function (t) { return t.horasLab < LAB_LIMITE; }) : [];
          var enW = L.filter(function (t) { return t.dAp >= wIni && t.dAp < wFin; }), UG = enW.concat(extG);
          var univG = 'tickets abiertos en la semana' + (SWg.modo === 2 ? ' más los de la semana pasada solucionados en la semana en menos de ' + LAB_LIMITE + ' horas laborales' : '');
          var sets = {
            abiertos: ['Base de la semana: ' + univG + '.', UG],
            resueltos: ['Solucionados en la semana (Estado Resuelto o Cerrado) de los ' + univG + '.', UG.filter(function (t) { return t.dSol !== null && t.dSol >= wIni && t.dSol < wFin; })],
            cerrados: ['Tickets con Fecha de cierre en la semana.', L.filter(function (t) { return t.dCie !== null && t.dCie >= wIni && t.dCie < wFin; })]
          }[x.c] || ['Resueltos el mismo día de su apertura ÷ abiertos en la semana.', enW.filter(function (t) { return t.dSol === t.dAp; })];
          e.titulo = 'Gestión en la última semana · ' + et; e.valor = x.c === 'pct' ? pct(porGrupo[g].gestion.pct) : miles(sets[1].length);
          e.definicion = sets[0]; e.filtros = [et + ': ' + DEF_G[g] + '.', 'Semana: del ' + fmtDate(wIni) + ' al ' + fmtDate(wFin - 1) + '.', 'Indicador semanal: opción ' + SWg.modo + '.'];
          e.pasos = [sets[0] + ' Resultado: ' + e.valor + '.'];
          e.registros = [regT(e.titulo, sets[1])]; break;
        default:
          e.titulo = 'Sin explicación disponible';
      }
      return e;
    }

    var resumenGrupos = {};
    GRUPOS.forEach(function (g) {
      var P = porGrupo[g];
      resumenGrupos[g] = {
        creados: P.creados, solucionados: P.solucionados, pctSol: P.creados ? P.solucionados / P.creados : null,
        prom: P.tiempo.prom, moda: P.tiempo.moda, semana: P.semana, gestion: P.gestion, jornada: P.jornada, resolucion: P.resolucion,
        reinc: P.reinc, reincGen: P.reincGen, upgrades: P.upgrades, sva: P.sva
      };
    });

    /* cómo se seleccionan los tickets que se evalúan como reincidentes (se muestra en el Excel) */
    var seleccionTxt = {
      ftth: 'Tickets seleccionados para la reincidencia de fallas FTTH: (1) abiertos ' + nomMeses + ', sin pasar de la descarga; (2) del grupo: SGU = título con "' + cfg.sguMarker + '" (PIA si además el solicitante es ' + cfg.piaSolicitante + '), País = sin esa marca; (3) la categoría dice "FTTH"; (4) no dice "Cobranzas Masivas" ni es un ajuste de facturación; (5) no está en la lista "Problemas de reincidencia" del Informe' + ((cfg.reincExcluir || []).length ? ' (hoy: ' + cfg.reincExcluir.join('; ') + ')' : '') + '; (6) tiene "Nombre Cliente" identificable (no vacío ni "#NAME?"). Entra cualquier estado (abierto o solucionado). Reincidente: el mismo "Nombre Cliente" con 2 o más tickets seleccionados en el grupo. Si sus tickets tienen cédulas o contratos distintos, o no se identifican con seguridad, pasa por revisión humana y no cuenta hasta decidirse. % = tickets reincidentes ÷ tickets seleccionados.',
      general: 'Tickets seleccionados para la reincidencia general: abiertos en el período, del grupo, de cualquier categoría, sin excepción, y con "Nombre Cliente" identificable. Reincidente: el mismo cliente con 2 o más tickets. La revisión humana se hace solo en SGU. % = tickets reincidentes ÷ tickets seleccionados.'
    };
    var per = (function () {
      var p = partsFromSerial(ini), q = partsFromSerial(ultimoDia), varios = p.y !== q.y;
      var nm = meses.map(function (m) { return MESES[+m.slice(5) - 1] + (varios ? ' ' + m.slice(0, 4) : ''); });
      var nombre = nm.length === 1 ? nm[0] : (nm.length === 2 ? nm[0] + ' y ' + nm[1] : nm[0] + ' a ' + nm[nm.length - 1]);
      var finMes = partsFromSerial(ultimoDia + 1).d === 1;
      var sufijo = p.d === 1 && finMes ? '' : (meses.length === 1 ? ' (' + p.d + ' al ' + q.d + ')' : ' (del ' + fmtDM(ini) + ' al ' + fmtDM(ultimoDia) + ')');
      return { nombre: nombre, anio: varios ? '' : q.y, sufijo: sufijo };
    })();
    return {
      cfg: cfg,
      periodo: per.nombre, anio: per.anio,
      meses: meses, inicio: ini, fin: fin, ultimoDia: ultimoDia, corteEsFin: corteEsFin,
      periodoTxt: per.nombre + per.sufijo,
      periodoLargo: per.nombre + (per.anio ? ' ' + per.anio : '') + per.sufijo,
      corteTxt: fmtDate(ultimoDia),
      corteFecha: fmtDate(ultimoDia),
      descargaTxt: fdt(DESC),
      descargaArchivo: pad(dp.d) + '-' + pad(dp.mo) + '-' + dp.y + ' ' + pad(dp.h) + 'h' + pad(dp.mi),
      fuentesTxt: 'GLPI y Tipificador · descarga ' + fdt(DESC),
      rangoTxt: nomMeses,
      /* tickets del período sin grupo técnico asignado (descarga desde la página Grupos técnicos) */
      asignacionGrupos: asignacionGrupos, reglasGrupo: REGLAS_GRUPO,
      sinGrupo: (function () { var L0 = T.filter(function (t) { return !grpLineas(t.raw.grupo).length; }); return { titulo: 'Tickets sin grupo técnico asignado', cols: ['Grupo'].concat(COLS_T), filas: L0.map(function (t) { return [t.pia ? 'PIA' : t.sgu ? 'SGU otras unidades' : 'País'].concat(filaT(t)); }) }; })(),
      seleccionTxt: seleccionTxt,
      semanaModo: modoSemana, semanaPasada: { desde: fmtDate(pIni), hasta: fmtDate(wIni - 1) },
      ventana: { desde: fmtDate(wIni), hasta: fmtDate(wFin - 1), corta: partsFromSerial(wIni).d + '–' + fmtDM(wFin - 1) },
      etiquetas: ETIQUETAS, etiquetasLargas: ETIQUETAS_LARGAS,
      fijos: fijos, g: resumenGrupos, comparativos: comparativos,
      tiempoCategoria: tiempoCategoria, tiempoGrupo: tiempoGrupo, productividad: productividad, otros: otros,
      reincidencia: porGrupo.sgu.reinc,
      reincidenciaGeneral: porGrupo.sgu.reincGen,
      revision: { pendientes: colaRevision, revisados: revisadosLista, total: colaRevision.length + revisadosLista.length },
      brechas: brechas,
      controles: controles,
      volumen: { glpi: T.length, tipSA: tipSA.length, tipMes: tipMes.length },
      opciones: { categorias: lista(oc), grupos: lista(og), ftth: lista(of) },
      explicar: explicar,
      reincExcluidas: (cfg.reincExcluir || []).map(homologar)
    };
  }

  /** Valores compactos de un corte, para guardar en D1 y comparar meses. */
  function snapshot(R) {
    var o = { corte: R.corteFecha, periodo: R.periodoTxt, ir: R.fijos.ir, irs: R.fijos.irSGU, fcr: R.fijos.fcr, prod: R.fijos.productividad, estatus: R.fijos.estatus, g: {}, revPend: R.revision ? R.revision.pendientes.length : 0 };
    GRUPOS.forEach(function (k) {
      var x = R.g[k];
      o.g[k] = { creados: x.creados, solucionados: x.solucionados, prom: x.prom, moda: x.moda, semana: x.semana.pct, mismoDia: x.gestion.pct, reincAb: x.reinc.abonados, reincTk: x.reinc.tickets, reincGenAb: x.reincGen.abonados, reincGenTk: x.reincGen.tickets, upgrades: x.upgrades.n, sva: x.sva.n };
    });
    o.comparativos = {}; Object.keys(R.comparativos).forEach(function (k) { o.comparativos[k] = { dif: R.comparativos[k].dif, ganador: R.comparativos[k].ganador }; });
    return o;
  }

  var api = {
    VERSION: 2, DEFAULTS: DEFAULTS, GRUPOS: GRUPOS, ETIQUETAS: ETIQUETAS, ETIQUETAS_LARGAS: ETIQUETAS_LARGAS,
    compute: compute, snapshot: snapshot, loadGLPI: loadGLPI, loadTipif: loadTipif,
    parseDate: parseDate, serialFromParts: serialFromParts, partsFromSerial: partsFromSerial, dayName: dayName,
    fmtD: fmtD, fmtPalabras: fmtPalabras, fmtDate: fmtDate, miles: miles, pct: pct, tickets: tickets, catCorta: catCorta,
    cuentaDeTitulo: cuentaDeTitulo, direccionPlan: direccionPlan, modaPromedio: modaPromedio, celdaTiempo: celdaTiempo, homologar: homologar,
    norm: norm, grpKey: grpKey, grpLabel: grpLabel, grpRegla: grpRegla, horasLaborales: horasLaborales, GRUPOS_PRIORIDAD: GRUPOS_PRIORIDAD, SIN_GRUPO: SIN_GRUPO, MESES: MESES, esPleyArriba: esPleyArriba, claveCliente: claveCliente
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PIAEngine = api;
})(typeof window !== 'undefined' ? window : this);
