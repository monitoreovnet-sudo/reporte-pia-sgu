/* Presentación v2 (17 láminas) — sección 6 y 7 de la especificación.
 * build(PptxGenJS | SlidesHtml.HtmlDeck, R, assets, E) → objeto con .slides (HTML) o presentación PptxGenJS.
 */
(function (root) {
  'use strict';
  var C = {
    purple: '440099', hot: 'CC04FF', ink: '241338', card: 'F7F5FB', cardLine: 'E4DAF2', muted: '7A6E8A', lilac: 'B28DE0',
    total: 'EADCF8', sub: 'F3ECFC', note: 'F1EAFB', alt: 'FBF9FD', border: 'D9CCEC', white: 'FFFFFF'
  };
  var CHIP = { pia: C.hot, otras: C.purple, sgu: C.purple, pais: C.ink };
  var FONT = 'Montserrat';
  var CORTO = { pia: 'PIA', otras: 'Otras', sgu: 'SGU', pais: 'País' };

  function build(PptxGenJS, R, assets, E, tipo) {
    tipo = tipo === 'sgu' ? 'sgu' : 'pia';
    var pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = R.responsable || 'VNET';
    pptx.title = (tipo === 'pia' ? 'Gestión PIA vs SGU - ' : 'Gestión SGU vs País - ') + R.periodo + ' ' + R.anio;
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
      s.addShape(pptx.ShapeType.roundRect, { x: x, y: y, w: w, h: 0.2, rectRadius: 0.1, fill: { color: CHIP[g] || C.purple }, line: { color: CHIP[g] || C.purple, width: 0 } });
      txt(s, t, { x: x, y: y, w: w, h: 0.2, fontSize: 7.5, bold: true, color: C.white, align: 'center', valign: 'middle' });
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
      txt(s, v, { x: x + 0.16, y: y + 0.42, w: w - 0.3, h: h - 0.42 - (o.sub ? 0.4 : 0.1), valign: 'middle', fit: 'shrink' });
      if (o.sub) txt(s, o.sub, { x: x + 0.16, y: y + h - 0.42, w: w - 0.3, h: 0.34, fontSize: 8, color: C.muted, valign: 'middle' });
    }
    // Tarjeta comparativa partida en dos mitades (A | B)
    function cardPar(s, x, y, w, h, label, tag, a, b, va, vb, sinChipB) {
      box(s, x, y, w, h);
      txt(s, tag ? [{ text: label, options: { bold: true } }, { text: '  ' + tag, options: { color: C.muted, fontSize: 8 } }] : label, { x: x + 0.16, y: y + 0.1, w: w - 0.3, h: 0.26, fontSize: 10, bold: true, valign: 'middle' });
      var half = (w - 0.32) / 2;
      s.addShape(pptx.ShapeType.line, { x: x + 0.16 + half + 0.0, y: y + 0.46, w: 0, h: h - 0.6, line: { color: C.cardLine, width: 1 } });
      [[a, va], [b, vb]].forEach(function (p, i) {
        var hx = x + 0.16 + i * (half + 0.0) + (i ? 0.14 : 0), hw = half - 0.14;
        if (!(i === 1 && sinChipB)) chip(s, hx, y + 0.44, p[0]);
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
          return { text: String(c), options: { fill: { color: fill }, bold: !!(r.total || (j === 0 && r.bold)), align: j === 0 ? 'left' : 'center', color: C.ink } };
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

    /* ---------- 0. Portada ---------- */
    var s0 = pptx.addSlide();
    s0.background = { data: assets.cover };
    txt(s0, R.periodo, { x: 1.15, y: 2.85, w: 6.3, h: 0.9, fontSize: 44, bold: true, color: C.white });
    txt(s0, 'Comité PIA · Piloto San Agustín · ' + (tipo === 'pia' ? 'PIA vs. SGU' : 'SGU vs. País'), { x: 1.15, y: 3.75, w: 6.3, h: 0.45, fontSize: 16, color: 'D9CCF2' });
    txt(s0, 'Atención al Cliente · Fecha de corte ' + R.corteTxt, { x: 1.15, y: 6.45, w: 7, h: 0.35, fontSize: 11, color: 'D9CCF2' });

    /* ---------- 1-3. Indicadores ---------- */
    function upgradesTexto(g) {
      var u = G[g].upgrades, v = G[g].sva;
      var det;
      if (!u.n && u.cambiosPlan && u.bajas === u.cambiosPlan) det = 'Tramitó ' + u.cambiosPlan + (u.cambiosPlan === 1 ? ' cambio de plan, a un plan menor' : ' cambios de plan, ' + (u.cambiosPlan === 2 ? 'los 2' : 'los ' + u.cambiosPlan) + ' a un plan menor');
      else det = miles(u.n) + ' aumento' + (u.n === 1 ? '' : 's') + ' de plan · ' + miles(v.n) + ' activación' + (v.n === 1 ? '' : 'es') + ' Pley/ExitLag';
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
      card(s, X(0), Y(0), cw, ch, { label: 'Índice de resolución PIA', chip: 'pia', value: pct(F.ir.pct), unit: miles(F.ir.num) + ' Casos', sub: miles(F.ir.fcr) + ' resueltos en 1er contacto + ' + miles(F.ir.escResueltos) + ' escalados con solución en GLPI, de ' + miles(F.ir.den) + ' casos del PIA' });
      card(s, X(1), Y(0), cw, ch, { label: 'Resolución en 1er contacto (FCR)', chip: 'pia', value: pct(F.fcr.pct), unit: miles(F.fcr.n) + ' Casos', sub: 'de los ' + miles(F.fcr.den) + ' casos únicos tipificados por el PIA' });
      card(s, X(2), Y(0), cw, ch, { label: 'Productividad del punto PIA', chip: 'pia', value: miles(F.productividad.casos) + ' Casos', size: 22, unit: miles(F.productividad.abonados) + ' abonados', sub: 'casos únicos tipificados por ' + R.cfg.sucursal + '; abonados = cédulas distintas' });
      var sem = function (g) { var x = G[g].semana; return { value: pct(x.pct), sub: miles(x.cerradosMisma) + ' de ' + miles(x.abiertos) + ' abiertos (' + R.ventana.corta + ')' }; };
      cardPar(s, X(0), Y(1), cw, ch, 'Cerrados en la misma semana que se abrieron', '', a, b, sem(a), sem(b), sinChipB);
      card(s, X(1), Y(1), cw, ch, { label: 'Satisfacción / NPS', tag: 'Trimestral', value: F.nps || '—', sub: F.nps ? '' : 'sin medición en este corte' });
      var rei = function (g) { var x = G[g].reinc; return { value: miles(x.abonados), unit: 'Abonados', sub: miles(x.tickets) + ' tickets · ' + pct(x.pct) + ' de ' + miles(x.ftth) + ' FTTH' }; };
      cardPar(s, X(2), Y(1), cw, ch, 'Reincidencia de fallas FTTH', '', a, b, rei(a), rei(b), sinChipB);
      cardComparativo(s, X(0), Y(2), cw, ch, cmp);
      cardPar(s, X(1), Y(2), cw, ch, 'Upgrades y SVA', 'Mensual', a, b, upgradesTexto(a), upgradesTexto(b), sinChipB);
      var tp = function (g) { return { value: fmtD(G[g].prom), sub: miles(G[g].solucionados) + ' tickets resueltos' }; };
      cardPar(s, X(2), Y(2), cw, ch, 'Tiempo promedio de resolución', '', a, b, tp(a), tp(b), sinChipB);
    }

    /* ---------- notas automáticas ---------- */
    function notaResolucion(a, b) {
      var A = G[a], B = G[b], pa = A.pctSol, pb = B.pctSol, dif = Math.abs(A.prom - B.prom);
      if (A.prom === null || B.prom === null) return '';
      var mejorProp = pa >= pb, masRapido = A.prom <= B.prom;
      var p1 = L[a] + ' resuelve una ' + (mejorProp ? 'mayor' : 'menor') + ' proporción de lo que crea (' + pct(pa) + ' vs. ' + pct(pb) + ')';
      var p2 = 'tarda ' + E.fmtPalabras(dif) + (masRapido ? ' menos' : ' más') + ' en promedio';
      return p1 + (mejorProp === masRapido ? ' y ' : ', pero ') + p2 + '.';
    }
    function notaBrecha(a, b) {
      var br = R.brechas(a, b).filter(function (x) { return x.dif > 0; }).slice(0, 2);
      if (!br.length) return notaResolucion(a, b);
      return 'La brecha con ' + (b === 'pais' ? 'el país' : L[b]) + ' se concentra en ' + br.map(function (x) { return E.catCorta(x.label) + ' (+' + E.fmtPalabras(x.dif) + ')'; }).join(' y ') + '.';
    }

    /* ---------- 4-5. Tiempo de resolución por categoría ---------- */
    function laminaTiempo(a, b, titulo, pie, nota) {
      var s = base(titulo);
      var h = segHead(a, b, 'Categoría', ['Tickets resueltos', 'Moda o promedio']);
      var rows = R.tiempoCategoria.map(function (r) { return { total: r.total, cells: [r.label, E.tickets(r[a].n), r[a].texto, E.tickets(r[b].n), r[b].texto] }; });
      var yEnd = tabla(s, { title: 'Tiempo de resolución por categoría', head1: h.head1, head2: h.head2, rows: rows, x: 0.4, y: 1.45, w: 8.75, colW: [3.15, 1.0, 1.8, 1.0, 1.8], h: 4.65, maxRowH: 0.31 });
      note(s, 0.4, yEnd + 0.12, 8.75, 0.5, nota);
      foot(s, pie);
      var cx = 9.4, cw = 3.5, ch = 1.18, gy = 0.13, y = 1.45;
      var res = function (g) { return { value: pct(G[g].pctSol), unit: miles(G[g].solucionados) + ' de ' + miles(G[g].creados), sub: 'tickets creados que ya están resueltos' }; };
      var ra = res(a), rb = res(b);
      card(s, cx, y, cw, ch, { label: 'Resueltos', chip: a, value: ra.value, unit: ra.unit, sub: ra.sub, size: 20 });
      card(s, cx, y + (ch + gy), cw, ch, { label: 'Resueltos', chip: b, value: rb.value, unit: rb.unit, sub: rb.sub, size: 20 });
      card(s, cx, y + 2 * (ch + gy), cw, ch, { label: 'Promedio', chip: a, value: fmtD(G[a].prom), size: 18, sub: G[a].moda === null ? 'sin moda' : 'Moda: ' + fmtD(G[a].moda) });
      var cmp = R.comparativos[a + '_' + b];
      card(s, cx, y + 3 * (ch + gy), cw, ch, { label: 'Promedio', chip: b, value: fmtD(G[b].prom), size: 18, sub: cmp && cmp.ganador ? 'Diferencia: ' + cmp.valor + ' a favor de ' + L[cmp.ganador] : '' });
    }
    var leyenda = 'M: moda (tiempo más repetido, redondeado a la hora) · P: promedio · Solo tickets resueltos o cerrados.';
    var leyendaGrupo = leyenda + ' (+): reúne varios grupos de GLPI; el grupo participó en la solución, no necesariamente solo.';

    /* ---------- Canal de creación (barras 100 % apiladas con porcentajes) ---------- */
    function barra100(s, x, y, w, h, titulo, partes, decimales) {
      var tot = partes.reduce(function (a, p) { return a + p.n; }, 0) || 1;
      var fmt = function (v) { return (Math.round(v * Math.pow(10, decimales)) / Math.pow(10, decimales)).toLocaleString('es-VE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }) + '%'; };
      txt(s, titulo, { x: x + 0.05, y: y, w: w, h: 0.28, fontSize: 10, bold: true });
      if (partes.some(function (p) { return p.n / tot < 0.06; })) { // segmentos muy delgados: porcentajes visibles sobre la barra
        txt(s, [{ text: fmt(100 * partes[0].n / tot), options: { bold: true, color: partes[0].color, fontSize: 14 } }, { text: '  ' + partes[0].label, options: { color: C.ink, fontSize: 9 } }], { x: x + 0.1, y: y + 0.3, w: w / 2, h: 0.3, valign: 'middle' });
        txt(s, [{ text: partes[1].label + '  ', options: { color: C.ink, fontSize: 9 } }, { text: fmt(100 * partes[1].n / tot), options: { bold: true, color: partes[1].color, fontSize: 14 } }], { x: x + w / 2, y: y + 0.3, w: w / 2 - 0.1, h: 0.3, align: 'right', valign: 'middle' });
        y += 0.3; h -= 0.3;
      }
      s.addChart(pptx.ChartType.bar, partes.map(function (p) { var v = 100 * p.n / tot; return { name: p.label + ' · ' + fmt(v) + ' (' + miles(p.n) + ')', labels: [titulo], values: [Math.round(v * Math.pow(10, decimales)) / Math.pow(10, decimales)] }; }), {
        x: x, y: y + 0.3, w: w, h: h - 0.3, barDir: 'bar', barGrouping: 'percentStacked', chartColors: partes.map(function (p) { return p.color; }), showValue: partes.every(function (p) { return p.n / tot >= 0.06; }),
        dataLabelFormatCode: decimales ? '0.0"%"' : '0"%"', dataLabelColor: C.white, dataLabelFontSize: 11, dataLabelFontBold: true, dataLabelFontFace: FONT,
        showLegend: true, legendPos: 'b', legendFontFace: FONT, legendFontSize: 9, catAxisHidden: true, valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, barGapWidthPct: 30
      });
    }
    function laminaCanal() {
      var s = base('ATC · Canal de creación de casos SGU');
      var cw = 4.0, x0 = 0.45, gx = 0.17;
      card(s, x0, 1.45, cw, 1.4, { label: 'Creados por el PIA', chip: 'pia', value: pct(G.sgu.creados ? G.pia.creados / G.sgu.creados : null), unit: E.tickets(G.pia.creados), sub: 'de los ' + miles(G.sgu.creados) + ' tickets SGU en GLPI' });
      card(s, x0 + cw + gx, 1.45, cw, 1.4, { label: 'Creados en otros canales', chip: 'otras', value: pct(G.sgu.creados ? G.otras.creados / G.sgu.creados : null), unit: E.tickets(G.otras.creados), sub: 'de los ' + miles(G.sgu.creados) + ' tickets SGU en GLPI' });
      card(s, x0 + 2 * (cw + gx), 1.45, cw, 1.4, { label: 'Reincidencia de clientes FTTH', chip: 'sgu', value: miles(G.sgu.reinc.abonados), unit: 'Abonados · ' + miles(G.sgu.reinc.tickets) + ' tickets', sub: 'clientes con 2 o más tickets FTTH en SGU' });
      barra100(s, 0.4, 3.05, 8.6, 1.75, 'Tickets SGU por canal de creación', [{ label: L.pia, n: G.pia.creados, color: C.hot }, { label: L.otras, n: G.otras.creados, color: C.purple }], 0);
      barra100(s, 0.4, 4.95, 8.6, 1.75, 'Peso de San Agustín en el total país', [{ label: L.sgu, n: G.sgu.creados, color: C.hot }, { label: 'Resto del país', n: G.pais.creados, color: C.purple }], 1);
      var pesoSGU = G.sgu.creados / (G.sgu.creados + G.pais.creados);
      note(s, 9.3, 3.35, 3.6, 3.35, 'El PIA creó el ' + pct(G.sgu.creados ? G.pia.creados / G.sgu.creados : null) + ' de los tickets SGU (' + miles(G.pia.creados) + ' de ' + miles(G.sgu.creados) + ').\n\nSan Agustín generó el ' + (Math.round(pesoSGU * 1000) / 10).toLocaleString('es-VE') + '% de los tickets del país en el período (' + miles(G.sgu.creados) + ' de ' + miles(G.sgu.creados + G.pais.creados) + ').\n\nAdemás, el PIA atendió ' + miles(F.estatus) + ' consultas de estatus que no generan ticket.');
    }

    /* ---------- 7-8. Productividad ---------- */
    function filasProd(a, b, conEstatus) {
      return R.productividad.filter(function (r) { return conEstatus || !r.estatus; }).map(function (r) {
        var c = function (v) { return v === null || v === undefined ? '' : E.tickets(v); };
        return { total: r.total, cells: [r.label, c(r[a].creados), c(r[a].solucionados), c(r[b].creados), c(r[b].solucionados)] };
      });
    }
    function laminaProdPIA() {
      var s = base('ATC · Productividad del punto: PIA vs. otras unidades');
      var h = segHead('pia', 'otras', 'Categoría', ['Creados', 'Solucionados']);
      tabla(s, { title: 'Productividad por categoría', head1: h.head1, head2: h.head2, rows: filasProd('pia', 'otras', true), x: 0.4, y: 1.45, w: 7.3, colW: [2.9, 1.1, 1.1, 1.1, 1.1], h: 5.3, maxRowH: 0.3 });
      var cats = R.productividad.filter(function (r) { return !r.estatus && !r.total; });
      txt(s, 'Tickets creados por categoría', { x: 7.95, y: 1.45, w: 5, h: 0.28, fontSize: 10, bold: true });
      s.addChart(pptx.ChartType.bar, [
        { name: L.pia, labels: cats.map(function (r) { return E.catCorta(r.label); }), values: cats.map(function (r) { return r.pia.creados; }) },
        { name: L.otras, labels: cats.map(function (r) { return E.catCorta(r.label); }), values: cats.map(function (r) { return r.otras.creados; }) }
      ], {
        x: 7.85, y: 1.75, w: 5.1, h: 5.0, barDir: 'bar', barGrouping: 'stacked', chartColors: [C.hot, C.purple], showValue: true, dataLabelColor: C.white, dataLabelFontSize: 7, dataLabelFontFace: FONT,
        catAxisLabelFontSize: 8, catAxisLabelFontFace: FONT, catAxisLabelColor: C.ink, catAxisOrientation: 'maxMin', valAxisHidden: true, valGridLine: { style: 'none' },
        showLegend: true, legendPos: 'b', legendFontFace: FONT, legendFontSize: 8, barGapWidthPct: 45
      });
    }
    function laminaProdSGU() {
      var s = base('ATC · Productividad: SGU vs. resto del país');
      var h = segHead('sgu', 'pais', 'Categoría', ['Creados', 'Solucionados']);
      tabla(s, { title: 'Productividad por categoría', head1: h.head1, head2: h.head2, rows: filasProd('sgu', 'pais', false), x: 0.4, y: 1.45, w: 8.75, colW: [3.35, 1.35, 1.35, 1.35, 1.35], h: 5.3, maxRowH: 0.32 });
      var cx = 9.4, cw = 3.5, ch = 1.18, gy = 0.13, y = 1.45;
      var fila = function (lab) { return R.productividad.filter(function (r) { return r.label === lab; })[0]; };
      card(s, cx, y, cw, ch, { label: '% solucionado', chip: 'sgu', value: pct(G.sgu.pctSol), unit: miles(G.sgu.solucionados) + ' de ' + miles(G.sgu.creados), size: 20 });
      card(s, cx, y + (ch + gy), cw, ch, { label: '% solucionado', chip: 'pais', value: pct(G.pais.pctSol), unit: miles(G.pais.solucionados) + ' de ' + miles(G.pais.creados), size: 20 });
      [['FTTH > Sin conexión', 'Sin conexión'], ['FTTH > Intermitencias', 'Intermitencias']].forEach(function (p, i) {
        var r = fila(p[0]); if (!r) return;
        card(s, cx, y + (2 + i) * (ch + gy), cw, ch, { label: p[1], chip: 'sgu', value: miles(r.sgu.creados), unit: 'creados · ' + pct(r.sgu.creados ? r.sgu.solucionados / r.sgu.creados : null) + ' solucionado', size: 20, sub: 'País: ' + miles(r.pais.creados) + ' creados · ' + pct(r.pais.creados ? r.pais.solucionados / r.pais.creados : null) + ' solucionado' });
      });
    }

    /* ---------- 9. Reincidencias ---------- */
    var RI = R.reincidencia;
    function laminaReinc(gen) {
      var RI = gen ? R.reincidenciaGeneral : R.reincidencia;
      var s = base(gen ? 'ATC · Reincidencias de clientes · todas las categorías' : 'ATC · Reincidencias de clientes FTTH');
      card(s, 0.45, 1.45, 2.4, 1.15, { label: 'Abonados', chip: 'sgu', value: miles(RI.abonados), size: 24 });
      card(s, 3.0, 1.45, 2.4, 1.15, { label: 'Tickets', chip: 'sgu', value: miles(RI.tickets), size: 24, sub: pct(RI.pct) + ' de ' + miles(RI.ftth) + (gen ? ' tickets' : ' FTTH') });
      txt(s, gen ? 'Reincidente: mismo cliente ("Nombre Cliente" de GLPI) con 2 o más tickets de cualquier categoría en SGU durante el período, sin excepción.' : 'Reincidente: mismo cliente ("Nombre Cliente" de GLPI) con 2 o más tickets FTTH en SGU durante el período. No cuenta nada de Cobranzas Masivas' + (R.reincExcluidas.filter(function (c) { return !/cobranzas masivas/i.test(c); }).length ? ' ni ' + R.reincExcluidas.filter(function (c) { return !/cobranzas masivas/i.test(c); }).map(function (c) { return E.catCorta(c).toLowerCase(); }).join(', ') : '') + '.', { x: 0.45, y: 2.68, w: 4.95, h: 0.56, fontSize: 8.5, color: C.muted });
      var cats = Object.keys(RI.porCategoria).sort(function (x, y) { return RI.porCategoria[y] - RI.porCategoria[x]; }).slice(0, 10);
      txt(s, 'Categorías de los tickets reincidentes', { x: 0.45, y: 3.3, w: 5, h: 0.28, fontSize: 10, bold: true });
      if (cats.length) s.addChart(pptx.ChartType.bar, [{ name: 'Tickets', labels: cats, values: cats.map(function (c) { return RI.porCategoria[c]; }) }], {
        x: 0.35, y: 3.6, w: 5.1, h: 3.2, barDir: 'bar', chartColors: [C.purple], showValue: true, dataLabelColor: C.ink, dataLabelFontSize: 8, dataLabelFontFace: FONT, dataLabelPosition: 'outEnd',
        catAxisLabelFontSize: 8, catAxisLabelFontFace: FONT, catAxisLabelColor: C.ink, catAxisOrientation: 'maxMin', valAxisHidden: true, valGridLine: { style: 'none' }, barGapWidthPct: 45
      });
      var top = RI.detalle[0], dePIA = 0;
      RI.detalle.forEach(function (d) { d.tickets.forEach(function (t) { if (t.pia) dePIA++; }); });
      var principal = cats[0];
      var hall = [
        principal ? principal + ' concentra ' + miles(RI.porCategoria[principal]) + ' de los ' + miles(RI.tickets) + ' tickets reincidentes (' + pct(RI.porCategoria[principal] / RI.tickets) + ').' : 'Sin reincidencias en el período.',
        top ? top.nombre + ' (cuenta ' + top.cuenta + ') es el abonado con más tickets: ' + top.tickets.length + ' (' + top.categorias.join(', ') + ').' : '',
        miles(dePIA) + ' de los ' + miles(RI.tickets) + ' tickets reincidentes los creó el PIA (' + pct(RI.tickets ? dePIA / RI.tickets : null) + '); el resto, otras unidades.'
      ];
      txt(s, 'Hallazgos', { x: 5.9, y: 1.45, w: 6, h: 0.3, fontSize: 11, bold: true });
      hall = hall.filter(Boolean);
      hall.forEach(function (hx, i) {
        var y = 1.85 + i * 1.45;
        s.addShape(pptx.ShapeType.roundRect, { x: 5.9, y: y, w: 0.42, h: 0.42, rectRadius: 0.21, fill: { color: C.purple }, line: { color: C.white, width: 0 } });
        txt(s, String(i + 1), { x: 5.9, y: y, w: 0.42, h: 0.42, fontSize: 12, bold: true, color: C.white, align: 'center', valign: 'middle' });
        box(s, 6.45, y - 0.08, 6.45, 1.0);
        txt(s, hx, { x: 6.62, y: y - 0.08, w: 6.15, h: 1.0, fontSize: 10, valign: 'middle' });
      });
    }

    /* ---------- 10. Detalle de reincidencias (2 columnas, se reparte en más láminas si hace falta) ---------- */
    function laminaDetalleReinc(gen) {
      var RI = gen ? R.reincidenciaGeneral : R.reincidencia;
      var LINE = 0.155, CAP = 5.0; // alto disponible por columna (pulgadas)
      function alto(d) { return Math.max(d.tickets.length, d.categorias.length) * LINE + 0.08; }
      var cols = [], cur = [], h = 0;
      RI.detalle.forEach(function (d) { var a = alto(d); if (h + a > CAP && cur.length) { cols.push(cur); cur = []; h = 0; } cur.push(d); h += a; });
      if (cur.length) cols.push(cur);
      if (!cols.length) cols.push([]);
      // equilibrar dos columnas cuando caben en una lámina
      if (cols.length === 2 || cols.length === 1) {
        var all = RI.detalle, total = all.reduce(function (a, d) { return a + alto(d); }, 0), acc = 0, k = 0;
        while (k < all.length && acc + alto(all[k]) <= total / 2 + 0.01) { acc += alto(all[k]); k++; }
        if (total <= 2 * CAP) cols = [all.slice(0, k), all.slice(k)];
      }
      var paginas = Math.max(1, Math.ceil(cols.length / 2));
      for (var p = 0; p < paginas; p++) {
        var s = base((gen ? 'ATC · Detalle de reincidencias · todas las categorías' : 'ATC · Detalle de reincidencias FTTH') + (paginas > 1 ? '  (' + (p + 1) + '/' + paginas + ')' : ''));
        [cols[p * 2], cols[p * 2 + 1]].forEach(function (lista, ci) {
          if (!lista) return;
          var rows = lista.map(function (d) { return { bold: true, cells: [d.nombre, d.cuenta, d.categorias.join('\n'), d.tickets.map(function (t) { return t.id; }).join('\n')] }; });
          if (!rows.length) rows = [{ cells: ['Sin reincidencias en el período', '', '', ''] }];
          var hs = [0.26, 0.26].concat(lista.map(alto));
          if (!lista.length) hs.push(0.3);
          tabla(s, { title: gen ? 'Clientes reincidentes · todas las categorías · SGU total' : 'Clientes reincidentes FTTH · SGU total', head1: [{ text: 'Cliente', o: { align: 'left' } }, { text: 'Cuenta' }, { text: 'Categorías', o: { align: 'left' } }, { text: 'Tickets' }], rows: rows,
            x: 0.4 + ci * 6.33, y: 1.45, w: 6.13, colW: [2.35, 0.75, 2.13, 0.9], rowHs: hs, fontSize: 7.5 });
        });
      }
    }

    /* ---------- 11-12. Grupo técnico ---------- */
    function laminaGrupo(a, b, titulo) {
      var s = base(titulo);
      var h = segHead(a, b, 'Grupo técnico', ['Tickets resueltos', 'Moda o promedio']);
      var rows = R.tiempoGrupo.map(function (r) { return { total: r.total, bold: r.negrita, cells: [r.label, E.tickets(r[a].n), r[a].texto, E.tickets(r[b].n), r[b].texto] }; });
      tabla(s, { title: 'Tiempo de resolución por grupo técnico', head1: h.head1, head2: h.head2, rows: rows, x: 0.4, y: 1.45, w: 8.75, colW: [3.15, 1.05, 1.75, 1.05, 1.75], h: 5.3, maxRowH: 0.33 });
      foot(s, leyendaGrupo);
      var cx = 9.4, cw = 3.5, ch = 1.18, gy = 0.13, y = 1.45;
      R.tiempoGrupo.filter(function (r) { return r.negrita; }).slice(0, 4).forEach(function (r, i) {
        card(s, cx, y + i * (ch + gy), cw, ch, { label: r.label, chip: a, value: r[a].n ? fmtD(r[a].prom) : '-', size: 18, sub: L[b] + ': ' + (r[b].n ? fmtD(r[b].prom) : '-') + ' · ' + miles(r[a].n) + ' vs. ' + miles(r[b].n) + ' tickets' });
      });
    }

    /* ---------- 13-14. Resolución en la jornada ---------- */
    function laminaJornada(a, b, titulo) {
      var s = base(titulo);
      var cols = ['Abiertos', 'Pendientes', 'Resueltos', 'Pend. acum.', 'Resuelto acum.', '% en jornada'];
      var head1 = [{ text: 'Día', o: { rowspan: 2 } }, { text: 'Fecha', o: { rowspan: 2 } }, { text: R.etiquetasLargas[a], o: { colspan: 6 } }, { text: R.etiquetasLargas[b], o: { colspan: 6 } }];
      var head2 = cols.concat(cols).map(function (c) { return { text: c }; });
      var JA = G[a].jornada, JB = G[b].jornada;
      var fila = function (f) { return [miles(f.abiertos), miles(f.pendientes), miles(f.resueltos), miles(f.pendAcc), miles(f.resAcc), pct(f.pct)]; };
      var rows = JA.filas.map(function (f, i) { return { cells: [f.dia, f.fecha.slice(0, 5)].concat(fila(f), fila(JB.filas[i])) }; });
      rows.push({ total: true, cells: ['Total semanal', ''].concat(fila(JA.total), fila(JB.total)) });
      var yEnd = tabla(s, { title: 'Tickets abiertos y solucionados · ' + R.ventana.desde.slice(0, 5) + ' al ' + R.ventana.hasta.slice(0, 5), head1: head1, head2: head2, rows: rows, x: 0.4, y: 1.4, w: 12.5, colW: [1.0, 0.7].concat(new Array(12).fill(10.8 / 12)), rowH: 0.255, fontSize: 8 });
      var ch0 = yEnd + 0.12;
      txt(s, 'Abiertos vs. resueltos por día · ' + L[a], { x: 0.45, y: ch0, w: 7, h: 0.26, fontSize: 9.5, bold: true });
      s.addChart(pptx.ChartType.bar, [
        { name: 'Abiertos', labels: JA.filas.map(function (f) { return f.dia.slice(0, 3) + ' ' + f.fechaCorta; }), values: JA.filas.map(function (f) { return f.abiertos; }) },
        { name: 'Resueltos', labels: JA.filas.map(function (f) { return f.dia.slice(0, 3) + ' ' + f.fechaCorta; }), values: JA.filas.map(function (f) { return f.resueltos; }) }
      ], {
        x: 0.35, y: ch0 + 0.24, w: 7.9, h: 6.85 - ch0 - 0.24, barDir: 'col', barGrouping: 'clustered', chartColors: [C.lilac, C.purple], showValue: true, dataLabelFontSize: 7, dataLabelColor: C.ink, dataLabelFontFace: FONT, dataLabelPosition: 'outEnd',
        catAxisLabelFontSize: 7, catAxisLabelFontFace: FONT, catAxisLabelColor: C.ink, valAxisHidden: true, valGridLine: { style: 'none' }, showLegend: true, legendPos: 'r', legendFontFace: FONT, legendFontSize: 8, barGapWidthPct: 60
      });
      var mw = 2.2, mh = (6.85 - ch0 - 0.1) / 2 - 0.06;
      [[a, 'Backlog', JA.total.pendAcc, 'abiertos en la semana aún sin solución'], [a, 'Resueltos', JA.total.resAcc, 'solucionados en la semana'], [b, 'Backlog', JB.total.pendAcc, 'abiertos en la semana aún sin solución'], [b, 'Resueltos', JB.total.resAcc, 'solucionados en la semana']].forEach(function (m, i) {
        card(s, 8.45 + (i % 2) * (mw + 0.12), ch0 + Math.floor(i / 2) * (mh + 0.12), mw, mh, { label: m[1], chip: m[0], chipLabel: CORTO[m[0]], value: miles(m[2]), size: 16, sub: m[3] });
      });
      foot(s, 'Abiertos: creados el día · Pendientes: creados el día y no resueltos ese día · Resueltos: solucionados el día · Pend. acum.: abiertos desde el inicio de la semana sin solución al cierre del día · % en jornada: creados y resueltos el mismo día ÷ creados.');
    }

    /* ---------- 15-16. Resueltos el mismo día ---------- */
    function laminaMismoDia(a, b, titulo) {
      var s = base(titulo);
      var cols = ['Abiertos', 'Pendientes', 'Resueltos mismo día', '% en jornada'];
      var head1 = [{ text: 'Día', o: { rowspan: 2 } }, { text: 'Fecha', o: { rowspan: 2 } }, { text: R.etiquetasLargas[a], o: { colspan: 4 } }, { text: R.etiquetasLargas[b], o: { colspan: 4 } }];
      var head2 = cols.concat(cols).map(function (c) { return { text: c }; });
      var JA = G[a].jornada, JB = G[b].jornada;
      var fila = function (f) { return [miles(f.abiertos), miles(f.pendientes), miles(f.mismoDia), pct(f.pct)]; };
      var rows = JA.filas.map(function (f, i) { return { cells: [f.dia, f.fecha.slice(0, 5)].concat(fila(f), fila(JB.filas[i])) }; });
      rows.push({ total: true, cells: ['Total semanal', ''].concat(fila(JA.total), fila(JB.total)) });
      var yEnd = tabla(s, { title: 'Tickets abiertos y solucionados el mismo día', head1: head1, head2: head2, rows: rows, x: 0.4, y: 1.4, w: 8.75, colW: [0.95, 0.7].concat(new Array(8).fill(7.1 / 8)), rowH: 0.255, fontSize: 8 });
      var gr = function (g) { var x = G[g].gestion; return { cells: [L[g], miles(x.abiertos), miles(x.resueltos), miles(x.cerrados), pct(x.pct)] }; };
      var y2 = tabla(s, { title: 'Gestión en la última semana · ' + R.ventana.desde.slice(0, 5) + ' al ' + R.ventana.hasta.slice(0, 5), head1: [{ text: 'Grupo', o: { align: 'left' } }, { text: 'Abiertos' }, { text: 'Resueltos' }, { text: 'Cerrados' }, { text: '% en jornada' }], rows: [gr(a), gr(b)], x: 0.4, y: yEnd + 0.18, w: 8.75, colW: [2.75, 1.5, 1.5, 1.5, 1.5], rowH: 0.27, fontSize: 8.5 });
      var cx = 9.4, cw = 3.5, ch = 1.22, gy = 0.13, y = 1.4;
      card(s, cx, y, cw, ch, { label: 'Resueltos el mismo día', chip: a, value: pct(JA.total.pct), unit: miles(JA.total.mismoDia) + ' de ' + miles(JA.total.abiertos), size: 20 });
      card(s, cx, y + ch + gy, cw, ch, { label: 'Resueltos el mismo día', chip: b, value: pct(JB.total.pct), unit: miles(JB.total.mismoDia) + ' de ' + miles(JB.total.abiertos), size: 20 });
      var pico = JA.pico;
      card(s, cx, y + 2 * (ch + gy), cw, ch, { label: 'Día pico', chip: a, value: pico ? pico.dia + ' ' + pico.fechaCorta : '-', size: 16, sub: pico ? miles(pico.abiertos) + ' tickets abiertos · ' + pct(pico.pct) + ' resueltos ese día' : '' });
      var ma = JA.total.pct, mb = JB.total.pct;
      note(s, cx, y + 3 * (ch + gy), cw, Math.max(0.9, y2 - (y + 3 * (ch + gy))), L[a] + ' resolvió el mismo día el ' + pct(ma) + ' de lo que abrió en la semana; ' + L[b] + ', el ' + pct(mb) + '.');
      foot(s, '% en jornada: tickets creados y resueltos el mismo día ÷ tickets creados ese día. Cerrados: con fecha de cierre dentro de la semana.');
    }

    /* ---------- desglose de "Otro" (solo el grupo SGU de la presentación) ---------- */
    var OTRO = {
      tiempoCategoria: { titulo: 'Tiempo de resolución por categoría', col: 'Categoría', cols: ['Tickets resueltos', 'Moda o promedio'], que: 'categorías' },
      productividad: { titulo: 'Productividad por categoría', col: 'Categoría', cols: ['Creados', 'Solucionados'], que: 'categorías' },
      tiempoGrupo: { titulo: 'Tiempo de resolución por grupo técnico', col: 'Grupo técnico', cols: ['Tickets resueltos', 'Moda o promedio'], que: 'grupos técnicos' }
    };
    function laminaOtro(kind, g) {
      var def = OTRO[kind], d = R.otros[kind][g], tiempo = kind !== 'productividad';
      var celdas = function (v) { return tiempo ? [E.tickets(v.n), v.texto] : [E.tickets(v.creados), E.tickets(v.solucionados)]; };
      var filas = d.filas.map(function (r) { return { cells: [r.label].concat(celdas(r.v)) }; });
      var POR = 17, paginas = Math.max(1, Math.ceil(filas.length / POR));
      var totalTk = tiempo ? d.total.v.n : d.total.v.creados;
      var base0 = tiempo ? G[g].solucionados : G[g].creados;
      for (var p = 0; p < paginas; p++) {
        var s = base('ATC · Desglose de "Otro": ' + def.titulo.charAt(0).toLowerCase() + def.titulo.slice(1) + (paginas > 1 ? '  (' + (p + 1) + '/' + paginas + ')' : ''));
        var rows = filas.slice(p * POR, (p + 1) * POR);
        if (!filas.length) rows = [{ cells: ['Sin tickets en "Otro"', '', ''] }];
        if (p === paginas - 1) rows.push({ total: true, cells: [d.total.label].concat(celdas(d.total.v)) });
        tabla(s, { title: '"Otro" de ' + R.etiquetasLargas[g] + ' · ' + def.titulo.toLowerCase(), head1: [{ text: def.col, o: { rowspan: 2, align: 'left' } }, { text: R.etiquetasLargas[g], o: { colspan: 2 } }], head2: def.cols.map(function (c) { return { text: c }; }),
          rows: rows, x: 0.4, y: 1.45, w: 8.75, colW: [5.15, 1.6, 2.0], h: 5.3, maxRowH: 0.3 });
        if (p > 0) continue;
        var cx = 9.4, cw = 3.5;
        card(s, cx, 1.45, cw, 1.3, { label: '"Otro"', chip: g, value: miles(totalTk), unit: tiempo ? 'tickets resueltos' : 'tickets creados', size: 22, sub: pct(base0 ? totalTk / base0 : null) + ' del total de ' + L[g] });
        card(s, cx, 2.88, cw, 1.3, { label: 'Agrupa', chip: g, value: miles(d.filas.length), unit: d.filas.length === 1 ? def.que.replace(/s$/, '').replace('grupos técnicos', 'grupo técnico') : def.que, size: 22, sub: 'fuera de las ' + (kind === 'tiempoGrupo' ? R.cfg.grupos.length + ' de la tabla' : R.cfg.categorias.length + ' del reporte') });
        if (d.filas[0]) card(s, cx, 4.31, cw, 1.3, { label: 'La más frecuente', chip: g, value: miles(tiempo ? d.filas[0].v.n : d.filas[0].v.creados), unit: (tiempo ? d.filas[0].v.n : d.filas[0].v.creados) === 1 ? 'ticket' : 'tickets', size: 22, sub: d.filas[0].label });
        foot(s, tiempo ? (kind === 'tiempoGrupo' ? leyendaGrupo : leyenda) : 'Creados: todos los tickets del período · Solucionados: en estado Resuelto o Cerrado.');
      }
    }

    /* ---------- orden de cada presentación ---------- */
    var leyendaPais = leyenda + ' Se homologaron ' + miles(R.controles.homologadas.length) + ' tickets con ">" sobrante en la categoría (p. ej. "FTTH > Cambio de clave WiFi >").';
    if (tipo === 'pia') {
      paginaIndicadores('pia', 'otras', R.comparativos.pia_otras);
      paginaIndicadores('pia', 'pais', R.comparativos.pia_pais);
      laminaTiempo('pia', 'otras', 'ATC · Tiempo de resolución: PIA vs. otras unidades', leyenda, notaResolucion('pia', 'otras'));
      laminaOtro('tiempoCategoria', 'pia');
      laminaCanal();
      laminaProdPIA();
      laminaOtro('productividad', 'pia');
      laminaReinc();
      laminaDetalleReinc();
      laminaReinc(true);
      laminaDetalleReinc(true);
      laminaGrupo('pia', 'otras', 'ATC · Grupo técnico: PIA vs. otras unidades');
      laminaOtro('tiempoGrupo', 'pia');
      laminaJornada('pia', 'otras', 'ATC · Resolución en la jornada: PIA vs. otras');
      laminaMismoDia('pia', 'otras', 'ATC · Resueltos el mismo día: PIA vs. otras');
    } else {
      paginaIndicadores('sgu', 'pais', R.comparativos.sgu_pais, true);
      laminaTiempo('sgu', 'pais', 'ATC · Tiempo de resolución: SGU vs. resto del país', leyendaPais, notaBrecha('sgu', 'pais'));
      laminaOtro('tiempoCategoria', 'sgu');
      laminaCanal();
      laminaProdSGU();
      laminaOtro('productividad', 'sgu');
      laminaReinc();
      laminaDetalleReinc();
      laminaReinc(true);
      laminaDetalleReinc(true);
      laminaGrupo('sgu', 'pais', 'ATC · Grupo técnico: SGU vs. resto del país');
      laminaOtro('tiempoGrupo', 'sgu');
      laminaJornada('sgu', 'pais', 'ATC · Resolución en la jornada: SGU vs. país');
      laminaMismoDia('sgu', 'pais', 'ATC · Resueltos el mismo día: SGU vs. país');
    }

    /* numeración automática: n/total (se agrega al final, cuando ya se sabe cuántas láminas hay) */
    slides.forEach(function (o) { o.s.addText('ATENCIÓN AL CLIENTE · ' + o.k + '/' + n, { x: 0.72, y: 0.4, w: 8, h: 0.28, fontFace: FONT, fontSize: 10, bold: true, color: C.hot, charSpacing: 1.5, margin: 0 }); });
    return pptx;
  }

  var api = { build: build, COLORS: C };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PIADeck = api;
})(typeof window !== 'undefined' ? window : this);
