/* Presentación v2 (17 láminas) — sección 6 y 7 de la especificación.
 * build(PptxGenJS | SlidesHtml.HtmlDeck, R, assets, E) → objeto con .slides (HTML) o presentación PptxGenJS.
 */
(function (root) {
  'use strict';
  var C = {
    purple: '440099', hot: 'CC04FF', ink: '241338', card: 'F7F5FB', cardLine: 'E4DAF2', muted: '7A6E8A', lilac: 'B28DE0',
    total: 'EADCF8', sub: 'F3ECFC', note: 'F1EAFB', alt: 'FBF9FD', border: 'D9CCEC', white: 'FFFFFF', red: 'D7263D'
  };
  var UMBRAL_SEMANAL = 0.75; // % solucionado en la semana por debajo del cual el indicador va en rojo
  var CHIP = { pia: C.hot, otras: C.purple, sgu: C.purple, pais: C.ink };
  var FONT = 'Montserrat';
  var CORTO = { pia: 'PIA', otras: 'Otras', sgu: 'SGU', pais: 'País' };

  function build(PptxGenJS, R, assets, E, tipo) {
    tipo = tipo === 'sgu' ? 'sgu' : 'pia';
    var pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = R.responsable || 'VNET';
    pptx.title = (tipo === 'pia' ? 'Gestión PIA vs SGU - ' : 'Gestión SGU vs País - ') + R.periodo + (R.anio ? ' ' + R.anio : '');
    var L = R.etiquetas, G = R.g, F = R.fijos;
    var miles = E.miles, pct = E.pct, fmtD = E.fmtD;
    var n = 0, slides = [];

    /* ---------- piezas comunes ---------- */
    function base(title) {
      var s = pptx.addSlide();
      s.background = { data: assets.bg };
      slides.push({ s: s });
      n++;
      slides[slides.length - 1].k = n;
      s.addText(title, { x: 0.72, y: 0.7, w: 10.2, h: 0.55, fontFace: FONT, fontSize: 24, bold: true, color: C.ink, margin: 0, fit: 'shrink' });
      return s;
    }
    function txt(s, text, o) { s.addText(text, Object.assign({ fontFace: FONT, margin: 0, color: C.ink, fontSize: 10 }, o)); }
    function chip(s, x, y, g, label) {
      var t = label || L[g], w = Math.max(0.42, 0.08 + t.length * 0.062);
      var inv = g === 'pais'; // País: inverso del chip SGU (borde y letra morados, fondo blanco)
      s.addShape(pptx.ShapeType.roundRect, { x: x, y: y, w: w, h: 0.2, rectRadius: 0.1, fill: { color: inv ? C.white : (CHIP[g] || C.purple) }, line: { color: inv ? C.purple : (CHIP[g] || C.purple), width: inv ? 1 : 0 } });
      txt(s, t, { x: x, y: y, w: w, h: 0.2, fontSize: 7.5, bold: true, color: inv ? C.purple : C.white, align: 'center', valign: 'middle' });
      return w;
    }
    function box(s, x, y, w, h, fill) { s.addShape(pptx.ShapeType.roundRect, { x: x, y: y, w: w, h: h, rectRadius: 0.1, fill: { color: fill || C.card }, line: { color: C.cardLine, width: 1 } }); }
    function card(s, x, y, w, h, o) {
      box(s, x, y, w, h);
      var lw = w - 0.3 - (o.chip ? 0.6 : 0);
      txt(s, o.tag ? [{ text: o.label, options: { bold: true } }, { text: '  ' + o.tag, options: { color: C.muted, fontSize: 8 } }] : o.label, { x: x + 0.16, y: y + 0.12, w: lw, h: 0.26, fontSize: 10, bold: true, valign: 'middle' });
      if (o.chip) chip(s, x + w - 0.16 - Math.max(0.42, 0.08 + (o.chipLabel || L[o.chip] || '').length * 0.062), y + 0.15, o.chip, o.chipLabel);
      var v = [{ text: String(o.value), options: { bold: true, color: C.purple, fontSize: o.size || 24 } }];
      if (o.unit) v.push({ text: '  ' + o.unit, options: { bold: true, color: C.ink, fontSize: 10 } });
      var subH = o.sub && String(o.sub).indexOf('\n') >= 0 ? 0.52 : 0.34;
      txt(s, v, { x: x + 0.16, y: y + 0.42, w: w - 0.3, h: h - 0.42 - (o.sub ? subH + 0.06 : 0.1), valign: 'middle', fit: 'shrink' });
      if (o.sub) txt(s, o.sub, { x: x + 0.16, y: y + h - subH - 0.08, w: w - 0.3, h: subH, fontSize: 8, color: C.muted, valign: 'middle' });
    }
    // Tarjeta comparativa partida en dos mitades (A | B)
    function cardPar(s, x, y, w, h, label, tag, a, b, va, vb, sinChipB) {
      box(s, x, y, w, h);
      txt(s, tag ? [{ text: label, options: { bold: true } }, { text: '  ' + tag, options: { color: C.muted, fontSize: 8 } }] : label, { x: x + 0.16, y: y + 0.1, w: w - 0.3, h: 0.26, fontSize: 10, bold: true, valign: 'middle' });
      var half = (w - 0.32) / 2;
      s.addShape(pptx.ShapeType.line, { x: x + 0.16 + half + 0.0, y: y + 0.46, w: 0, h: h - 0.6, line: { color: C.cardLine, width: 1 } });
      [[a, va], [b, vb]].forEach(function (p, i) {
        var hx = x + 0.16 + i * (half + 0.0) + (i ? 0.14 : 0), hw = half - 0.14;
        chip(s, hx, y + 0.44, p[0]); // el chip País ahora es liviano (borde y letra morados): se muestra siempre
        var v = [{ text: String(p[1].value), options: { bold: true, color: C.purple, fontSize: p[1].size || 18 } }];
        if (p[1].unit) v.push({ text: ' ' + p[1].unit, options: { bold: true, color: C.ink, fontSize: 8.5 } });
        txt(s, v, { x: hx, y: y + 0.68, w: hw, h: h - 0.68 - 0.44, valign: 'middle', fit: 'shrink' });
        txt(s, p[1].sub || '', { x: hx, y: y + h - 0.44, w: hw, h: 0.36, fontSize: 7.5, color: C.muted, valign: 'middle' });
      });
    }
    function cardComparativo(s, x, y, w, h, cmp) {
      box(s, x, y, w, h);
      txt(s, [{ text: 'Comparativo ' + L[cmp.a] + ' vs. ' + L[cmp.b], options: { bold: true } }, { text: '  Mensual', options: { color: C.muted, fontSize: 8 } }], { x: x + 0.16, y: y + 0.1, w: w - 0.3, h: 0.26, fontSize: 10, valign: 'middle', fit: 'shrink' });
      txt(s, cmp.valor, { x: x + 0.16, y: y + 0.42, w: w - 0.3, h: 0.5, fontSize: 22, bold: true, color: C.purple, valign: 'middle', fit: 'shrink' });
      if (cmp.ganador) {
        txt(s, 'a favor de', { x: x + 0.16, y: y + 0.96, w: 0.8, h: 0.2, fontSize: 8.5, color: C.ink, valign: 'middle' });
        chip(s, x + 0.95, y + 0.96, cmp.ganador);
      }
      txt(s, cmp.detalle, { x: x + 0.16, y: y + h - 0.4, w: w - 0.3, h: 0.32, fontSize: 7.5, color: C.muted, valign: 'middle' });
    }
    function note(s, x, y, w, h, text) {
      s.addShape(pptx.ShapeType.roundRect, { x: x, y: y, w: w, h: h, rectRadius: 0.06, fill: { color: C.note }, line: { color: C.note, width: 0 } });
      txt(s, text, { x: x + 0.14, y: y, w: w - 0.28, h: h, fontSize: 9, color: C.ink, valign: 'middle' });
    }
    function foot(s, text, y) { txt(s, text, { x: 0.45, y: y || 6.92, w: 12.4, h: 0.26, fontSize: 7.5, color: C.muted, italic: true, valign: 'middle' }); }

    // Tabla nativa con banda de título y encabezados de dos niveles
    function tabla(s, o) {
      var rows = [];
      var ncol = o.colW.length;
      if (o.title) rows.push([{ text: o.title, options: { colspan: ncol, bold: true, color: C.white, fill: { color: C.purple }, align: 'center', fontSize: 9 } }]);
      if (o.head1) rows.push(o.head1.map(function (c) { return { text: c.text, options: Object.assign({ bold: true, color: C.purple, fill: { color: C.white }, align: 'center' }, c.o || {}) }; }));
      if (o.head2) rows.push(o.head2.map(function (c) { return { text: c.text, options: Object.assign({ bold: true, color: C.purple, fill: { color: C.sub }, align: 'center' }, c.o || {}) }; }));
      o.rows.forEach(function (r, i) {
        var fill = r.total ? C.total : (i % 2 ? C.alt : C.white);
        rows.push(r.cells.map(function (c, j) {
          var ct = o.colsTotal && o.colsTotal.indexOf(j) >= 0;
          var cv = c !== null && typeof c === 'object' ? c : { text: c };
          return { text: String(cv.text), options: { fill: { color: ct ? C.total : fill }, bold: !!(r.total || ct || cv.bold || (j === 0 && r.bold)), align: j === 0 ? 'left' : 'center', color: cv.color || C.ink } };
        }));
      });
      var nHead = rows.length - o.rows.length;
      var rowH = o.rowH || Math.min(o.maxRowH || 0.3, (o.h || 5) / rows.length);
      var fs = o.fontSize || (rowH >= 0.26 ? 8.5 : (rowH >= 0.21 ? 8 : 7));
      s.addTable(rows, { x: o.x, y: o.y, w: o.w, colW: o.colW, rowH: o.rowHs || rowH, fontFace: FONT, fontSize: fs, valign: 'middle', border: { type: 'solid', pt: 0.5, color: C.border }, margin: [1, 4, 1, 4] });
      return o.y + (o.rowHs ? o.rowHs.reduce(function (a, b) { return a + b; }, 0) : rowH * rows.length);
    }
    var segHead = function (a, b, label, cols) {
      return { head1: [{ text: label, o: { rowspan: 2, align: 'left' } }, { text: R.etiquetasLargas[a], o: { colspan: cols.length } }, { text: R.etiquetasLargas[b], o: { colspan: cols.length } }],
        head2: cols.concat(cols).map(function (c) { return { text: c }; }) };
    };
    var mKeys = Array.isArray(R.metricasTiempo) && R.metricasTiempo.length ? R.metricasTiempo : E.DEFAULTS.metricasTiempo;
    var mList = E.METRICAS_TIEMPO.filter(function (m) { return mKeys.indexOf(m.key) >= 0; });
    if (!mList.length) mList = E.METRICAS_TIEMPO.slice(0, 2);
    function colsDe(list) { return ['Tickets resueltos'].concat((list || mList).map(function (m) { return E.metricaLabel(m, R.slaHoras); })); }
    var mCols = colsDe(mList);
    function mVals(mp, list) { return [E.tickets(mp.n)].concat((list || mList).map(function (m) { return mp[m.prop]; })); }
    function mColW(nGrupos, totalW, list) {
      var ml = list || mList;
      var w0 = nGrupos === 2 ? (ml.length <= 2 ? 2.55 : (ml.length <= 4 ? 2.1 : 1.75)) : (ml.length <= 2 ? 4.35 : (ml.length <= 4 ? 3.4 : 2.6));
      var rem = totalW - w0;
      var weights = [0.85].concat(ml.map(function (m) { return m.key === 'buckets' ? 1.55 : (m.key === 'minMax' ? 1.25 : 1.0); }));
      var sumW = weights.reduce(function (a, b) { return a + b; }, 0) * nGrupos;
      var out = [w0];
      for (var g = 0; g < nGrupos; g++) weights.forEach(function (w) { out.push(Math.round((rem * w / sumW) * 1000) / 1000); });
      return out;
    }
    function mFontSize(nGrupos, list) {
      var ml = list || mList, totalCols = 1 + nGrupos * (1 + ml.length);
      if (totalCols <= 7) return null;
      if (totalCols <= 9) return 7;
      if (totalCols <= 13) return 6;
      return 5.5;
    }

    /* ---------- 0. Portada ---------- */
    var s0 = pptx.addSlide();
    s0.background = { data: assets.cover };
    var titulo = R.periodo + (R.anio ? ' ' + R.anio : ''), tam = titulo.length <= 14 ? 44 : (titulo.length <= 22 ? 34 : 28);
    txt(s0, titulo, { x: 1.15, y: 2.6, w: 7.4, h: 0.9, fontSize: tam, bold: true, color: C.white, fit: 'shrink' });
    txt(s0, 'Fecha de corte ' + R.corteFecha, { x: 1.15, y: 3.48, w: 6.3, h: 0.3, fontSize: 12, color: 'D9CCF2' });
    txt(s0, 'Comité PIA · Piloto San Agustín · ' + (tipo === 'pia' ? 'PIA vs. SGU' : 'SGU vs. País'), { x: 1.15, y: 3.9, w: 6.3, h: 0.45, fontSize: 16, color: 'D9CCF2' });
    txt(s0, 'Atención al Cliente · Datos descargados el ' + R.descargaTxt, { x: 1.15, y: 6.45, w: 7, h: 0.35, fontSize: 11, color: 'D9CCF2' });

    /* ---------- 1-3. Indicadores ---------- */
    function upgradesTexto(g) {
      var u = G[g].upgrades, v = G[g].sva;
      var det;
      if (!u.n && u.cambiosPlan && u.bajas === u.cambiosPlan) det = 'Tramitó ' + u.cambiosPlan + (u.cambiosPlan === 1 ? ' cambio de plan, a un plan menor' : ' cambios de plan, ' + (u.cambiosPlan === 2 ? 'los 2' : 'los ' + u.cambiosPlan) + ' a un plan menor');
      else det = miles(u.n) + ' aumento' + (u.n === 1 ? '' : 's') + ' de plan\n' + miles(v.n) + ' activación' + (v.n === 1 ? '' : 'es') + ' Pley/ExitLag';
      return { value: miles(u.n) + (u.n === 1 ? ' upgrade' : ' upgrades') + ' · ' + miles(v.n) + ' SVA', size: 13, sub: det };
    }
    function paginaIndicadores(a, b, cmp, sinChipB) {
      var s = base('ATC · Indicadores: ' + { pia: 'PIA', sgu: 'SGU' }[a] + ' vs. ' + { otras: 'SGU', pais: 'país' }[b]);
      txt(s, [
        { text: 'RESPONSABLE  ', options: { color: C.hot, bold: true, fontSize: 7.5 } }, { text: (R.responsable || '-') + '      ', options: { color: C.muted, fontSize: 9 } },
        { text: 'PERÍODO  ', options: { color: C.hot, bold: true, fontSize: 7.5 } }, { text: R.periodoTxt + '      ', options: { color: C.muted, fontSize: 9 } },
        { text: 'FECHA DE CORTE  ', options: { color: C.hot, bold: true, fontSize: 7.5 } }, { text: R.corteTxt + '      ', options: { color: C.muted, fontSize: 9 } },
        { text: 'FUENTES  ', options: { color: C.hot, bold: true, fontSize: 7.5 } }, { text: R.fuentesTxt, options: { color: C.muted, fontSize: 9 } }
      ], { x: 0.72, y: 1.3, w: 12, h: 0.28, valign: 'middle' });
      var cw = 4.0, ch = 1.66, gx = 0.17, gy = 0.13, x0 = 0.45, y0 = 1.72;
      var X = function (c) { return x0 + c * (cw + gx); }, Y = function (r) { return y0 + r * (ch + gy); };
      card(s, X(0), Y(0), cw, ch, { label: 'Índice de resolución SGU', chip: 'sgu', value: pct(F.irSGU.pct), unit: miles(F.irSGU.num) + ' de ' + miles(F.irSGU.den), sub: miles(F.irSGU.fcr) + ' resueltos en 1er contacto\n' + miles(F.irSGU.resPIA) + ' creados por PIA\n' + miles(F.irSGU.resOtras) + ' creados por otras unidades' });
      card(s, X(1), Y(0), cw, ch, { label: 'Resolución en 1er contacto (FCR)', chip: 'pia', value: pct(F.fcr.pct), unit: miles(F.fcr.n) + ' Casos', sub: 'de los ' + miles(F.fcr.den) + ' casos únicos tipificados por el PIA' });
      card(s, X(2), Y(0), cw, ch, { label: 'Productividad del punto PIA', chip: 'pia', value: miles(F.productividad.casos) + ' Casos', size: 22, sub: 'casos únicos tipificados por ' + R.cfg.sucursal });
      var sem = function (g) { var x = G[g].semana; return { value: pct(x.pct), sub: x.modo === 2 ? miles(x.num) + ' de ' + miles(x.den) + ' · ' + miles(x.solMisma) + ' de la semana + ' + miles(x.extra) + ' de la semana anterior (< 72 h lab.)' : miles(x.num) + ' de ' + miles(x.den) + ' abiertos' }; };
      cardPar(s, X(0), Y(1), cw, ch, 'Tickets solucionados en la semana', R.ventana.corta + (R.semanaModo === 2 ? ' · opción 2' : ''), 'sgu', 'pais', sem('sgu'), sem('pais'), false);
      card(s, X(1), Y(1), cw, ch, { label: 'Satisfacción / NPS', tag: 'Trimestral', value: F.nps || '—', sub: F.nps ? '' : 'sin medición en este corte' });
      var rei = function (g) { var x = G[g].reinc; return { value: miles(x.abonados), unit: 'Abonados', sub: miles(x.tickets) + ' tickets\n' + pct(x.pct) + ' de ' + miles(x.ftth) + ' seleccionados' }; };
      cardPar(s, X(2), Y(1), cw, ch, 'Reincidencia de fallas FTTH', '', a, b, rei(a), rei(b), sinChipB);
      cardComparativo(s, X(0), Y(2), cw, ch, cmp);
      cardPar(s, X(1), Y(2), cw, ch, 'Upgrades y SVA', 'Mensual', a, b, upgradesTexto(a), upgradesTexto(b), sinChipB);
      var tp = function (g) { return { value: fmtD(G[g].prom), sub: miles(G[g].solucionados) + ' tickets resueltos' }; };
      cardPar(s, X(2), Y(2), cw, ch, 'Tiempo promedio de resolución', '', a, b, tp(a), tp(b), sinChipB);
    }

    /* ---------- Lámina: tiempo típico (mediana) y casos borde ---------- */
    function laminaMediana() {
      var s = base('ATC · Tiempo típico y casos borde: SGU vs. país');
      var T = G.sgu.tiempo, TP = G.pais.tiempo, BD = G.sgu.bordes, RS = G.sgu.resolucion, RP = G.pais.resolucion;
      var semS = G.sgu.semana.pct, semP = G.pais.semana.pct;
      var rojo = semS !== null && semS < UMBRAL_SEMANAL;
      var cap = function (t) { return { text: t, options: { bold: true, color: C.muted, fontSize: 8, breakLine: true } }; };
      // mini tarjeta: etiqueta, valor grande y línea de apoyo
      function mini(x, y, w, h, label, value, sub, o) {
        o = o || {};
        box(s, x, y, w, h);
        txt(s, label.toUpperCase(), { x: x + 0.14, y: y + 0.08, w: w - 0.28, h: 0.22, fontSize: 7.5, bold: true, color: C.muted, valign: 'middle', fit: 'shrink' });
        txt(s, String(value), { x: x + 0.14, y: y + 0.3, w: w - 0.28, h: h - 0.62, fontSize: o.size || 22, bold: true, color: o.color || C.purple, valign: 'middle', fit: 'shrink' });
        txt(s, sub || '', { x: x + 0.14, y: y + h - 0.32, w: w - 0.28, h: 0.26, fontSize: 7.5, color: C.muted, valign: 'middle', fit: 'shrink' });
      }
      var lx = 0.45, lw = 5.0, hw = (lw - 0.17) / 2;
      // fila 1: índice de resolución y FCR
      mini(lx, 1.45, hw, 1.0, 'Índice de resolución SGU', pct(F.irSGU.pct), miles(F.irSGU.num) + ' de ' + miles(F.irSGU.den) + ' casos (' + miles(F.irSGU.fcr) + ' FCR + ' + miles(F.irSGU.resPIA + F.irSGU.resOtras) + ' GLPI)');
      mini(lx + hw + 0.17, 1.45, hw, 1.0, '1er contacto · FCR (PIA)', pct(F.fcr.pct), miles(F.fcr.n) + ' de ' + miles(F.fcr.den) + ' casos tipificados');
      // fila 2: mediana SGU/País y cola SGU/País
      var ty = 2.55, th = 1.5, gSub = 0.09, qw = (hw - gSub) / 2;
      var slaSub = function (x) { return '-24h: ' + pct(x && x.n ? (x.buckets.b8 + x.buckets.b24) / x.n : null) + '  +72h: ' + pct(x && x.n ? x.buckets.bMas / x.n : null); };
      [
        ['MEDIANA SGU', T.n ? fmtD(T.mediana) : '-', slaSub(T)],
        ['MEDIANA PAÍS', TP.n ? fmtD(TP.mediana) : '-', slaSub(TP)]
      ].forEach(function (m, i) {
        var mx = lx + i * (qw + gSub);
        box(s, mx, ty, qw, th);
        txt(s, m[0], { x: mx + 0.03, y: ty + 0.16, w: qw - 0.06, h: 0.24, fontSize: 7.5, bold: true, color: C.muted, align: 'center', valign: 'middle', fit: 'shrink' });
        txt(s, m[1], { x: mx + 0.03, y: ty + 0.48, w: qw - 0.06, h: 0.48, fontSize: 16, bold: true, color: C.purple, align: 'center', valign: 'middle', fit: 'shrink' });
        txt(s, m[2], { x: mx + 0.03, y: ty + 1.04, w: qw - 0.06, h: 0.28, fontSize: 6.2, color: C.muted, align: 'center', valign: 'middle', fit: 'shrink' });
      });
      [
        ['COLA SGU', G.sgu.cola],
        ['COLA PAÍS', G.pais.cola]
      ].forEach(function (m, i) {
        var cx = lx + hw + 0.17 + i * (qw + gSub), cl = m[1] || { n: 0, pct: null, mediana: null, buckets: { bMas: 0 } };
        box(s, cx, ty, qw, th);
        txt(s, m[0], { x: cx + 0.03, y: ty + 0.14, w: qw - 0.06, h: 0.22, fontSize: 7.5, bold: true, color: C.muted, align: 'center', valign: 'middle', fit: 'shrink' });
        txt(s, [{ text: pct(cl.pct), options: { bold: true, color: C.purple, fontSize: 15 } }, { text: ' sin res.', options: { color: C.muted, fontSize: 7 } }], { x: cx + 0.03, y: ty + 0.44, w: qw - 0.06, h: 0.34, align: 'center', valign: 'middle', fit: 'shrink' });
        txt(s, [{ text: 'Esp. ', options: { color: C.muted, fontSize: 7.5 } }, { text: cl.n ? fmtD(cl.mediana) : '-', options: { bold: true, color: C.ink, fontSize: 9.5 } }], { x: cx + 0.03, y: ty + 0.82, w: qw - 0.06, h: 0.26, align: 'center', valign: 'middle', fit: 'shrink' });
        txt(s, '+72h: ' + pct(cl.n ? cl.buckets.bMas / cl.n : null), { x: cx + 0.03, y: ty + 1.12, w: qw - 0.06, h: 0.24, fontSize: 7, color: C.muted, align: 'center', valign: 'middle', fit: 'shrink' });
      });
      // fila 3: reincidencia FTTH y productividad del punto
      var u = G.sgu.upgrades, v = G.sgu.sva, up = G.pais.upgrades, vp = G.pais.sva;
      mini(lx, 4.15, hw, 1.0, 'Reincidencia fallas FTTH', pct(G.sgu.reinc.pct), miles(G.sgu.reinc.abonados) + ' abon. (País ' + pct(G.sgu.reinc.pct) + ') · General: ' + pct(R.reincidenciaGeneral.pct));
      mini(lx + hw + 0.17, 4.15, hw, 1.0, 'Productividad del punto PIA', miles(F.productividad.casos) + ' casos', miles(u.n) + (u.n === 1 ? ' upgrade' : ' upgrades') + ' · ' + miles(v.n) + ' SVA (País: ' + miles(up.n) + ' · ' + miles(vp.n) + ')');
      // gráfico combinado semanal
      var dl = function (f) { return f.dia.charAt(0) + f.fecha.slice(0, 2); };
      var labs = RS.filas.map(dl), last = 0;
      var linea = function (RR) { return RR.filas.map(function (f) { last = f.s.pct === null ? last : Math.round(f.s.pct * 100); return last; }); };
      var rx = 5.65, rw = 7.25;
      var barOpts = { chartColors: [C.purple, C.lilac], barGrouping: 'clustered', barGapWidthPct: 50, showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 8, dataLabelColor: C.ink, dataLabelFontFace: FONT };
      var lineOpts = { chartColors: [C.ink, '3D6BFF'], secondaryValAxis: true, secondaryCatAxis: true, lineSize: 2, lineDataSymbol: 'circle', lineDataSymbolSize: 6 };
      last = 0; var lS = linea(RS); last = 0; var lP = linea(RP);
      s.addChart([
        { type: pptx.ChartType.bar, data: [{ name: 'Abiertos SGU', labels: labs, values: RS.filas.map(function (f) { return f.d.ab; }) }, { name: 'Resueltos mismo día', labels: labs, values: RS.filas.map(function (f) { return f.d.res; }) }], options: barOpts },
        { type: pptx.ChartType.line, data: [{ name: '% semanal SGU', labels: labs, values: lS }, { name: '% semanal País', labels: labs, values: lP }], options: lineOpts }
      ], {
        x: rx, y: 1.4, w: rw, h: 3.11, showLegend: true, legendPos: 't', legendFontFace: FONT, legendFontSize: 8, legendColor: C.ink,
        catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9, catAxisLabelColor: C.ink,
        valAxes: [{ valAxisHidden: true, valAxisLineShow: false, valGridLine: { color: 'EEE8F7', size: 0.5 }, valAxisMinVal: 0 },
          { valAxisLabelFontFace: FONT, valAxisLabelFontSize: 8, valAxisLabelColor: C.muted, valAxisMinVal: 0, valAxisMaxVal: 100, valAxisMajorUnit: 25, valAxisLabelFormatCode: '0"%"', valGridLine: { style: 'none' } }],
        catAxes: [{ catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9 }, { catAxisHidden: true }]
      });
      // tabla semanal
      var cero = function (f, txtv) { return f.d.ab && !f.d.res ? { text: txtv, color: C.hot, bold: true } : txtv; };
      var rows = [
        { cells: ['Abiertos (SGU)'].concat(RS.filas.map(function (f) { return String(f.d.ab); }), [{ text: String(RS.total.d.ab), bold: true }]) },
        { cells: ['% mismo día SGU'].concat(RS.filas.map(function (f) { return cero(f, pct(f.d.pct)); }), [{ text: pct(RS.total.d.pct), bold: true, color: RS.total.d.res ? C.purple : C.hot }]) },
        { cells: ['% mismo día País'].concat(RP.filas.map(function (f) { return cero(f, pct(f.d.pct)); }), [{ text: pct(RP.total.d.pct), bold: true }]) },
        { cells: ['% semanal SGU'].concat(RS.filas.map(function (f) { return pct(f.s.pct); }), [{ text: pct(semS), bold: true, color: rojo ? C.red : C.purple }]) },
        { cells: ['% semanal País'].concat(RP.filas.map(function (f) { return pct(f.s.pct); }), [{ text: pct(semP), bold: true }]) }
      ];
      var nd = RS.filas.length, c0 = 1.75, ctot = 0.8, cd = (rw - c0 - ctot) / nd;
      var hd = [{ text: 'Semana ' + R.ventana.corta, o: { align: 'left', fill: { color: C.purple }, color: C.white } }]
        .concat(labs.map(function (l) { return { text: l, o: { fill: { color: C.purple }, color: C.white } }; }), [{ text: 'Total', o: { fill: { color: C.purple }, color: C.white } }]);
      tabla(s, { head1: hd, rows: rows, x: rx, y: 4.59, w: rw, colW: [c0].concat(new Array(nd).fill(cd), [ctot]), rowH: 0.23, fontSize: 8, colsTotal: [nd + 1] });
      // inferior izquierda: resueltos p