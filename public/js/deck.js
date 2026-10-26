/* Generador de la presentación (PptxGenJS) con el formato VNET del comité PIA */
(function (root) {
  'use strict';
  var C = { purple: '440099', magenta: 'CC04FF', ink: '241338', muted: '6B5F80', soft: 'F6F2FC', line: 'E3DAF2', lav: 'E9E0F7', white: 'FFFFFF', grey: '9A90AB' };
  var FONT = 'Montserrat';

  function pct(x) { return x === null || x === undefined ? '-' : Math.round(x * 100) + '%'; }
  function num(n) { return (n === null || n === undefined) ? '-' : Number(n).toLocaleString('es-VE'); }
  function tk(n, word) { word = word || 'Ticket'; return !n ? '-' : num(n) + ' ' + (n === 1 ? word : word + 's'); }

  function build(PptxGenJS, R, assets, E) {
    var pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in
    pptx.author = R.responsable || 'VNET';
    pptx.title = 'Gestión SGU vs País - ' + R.periodo;
    var K = R.kpi, idx = 0, PAGE = 18;
    function pages(rows) { var out = []; for (var i = 0; i < rows.length; i += PAGE) out.push(rows.slice(i, i + PAGE)); return out.length ? out : [[]]; }
    var total = 5 + pages(R.tiempoCategoria).length + pages(R.tiempoGrupo).length;

    function base(title) {
      idx++;
      var s = pptx.addSlide();
      s.background = { data: assets.bg };
      s.addText('ATENCIÓN AL CLIENTE · ' + idx + '/' + total, { x: 0.72, y: 0.42, w: 8, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: C.magenta, charSpacing: 1.5, margin: 0 });
      s.addText(title, { x: 0.72, y: 0.72, w: 10, h: 0.6, fontFace: FONT, fontSize: 26, bold: true, color: C.ink, margin: 0 });
      return s;
    }
    function meta(s, y) {
      s.addText([
        { text: 'RESPONSABLE  ', options: { color: C.magenta, bold: true, fontSize: 8 } },
        { text: (R.responsable || '-') + '        ', options: { color: C.muted, fontSize: 10 } },
        { text: 'PERÍODO  ', options: { color: C.magenta, bold: true, fontSize: 8 } },
        { text: R.periodo + ' ' + R.anio + '        ', options: { color: C.muted, fontSize: 10 } },
        { text: 'FECHA DE CORTE  ', options: { color: C.magenta, bold: true, fontSize: 8 } },
        { text: R.corteTxt, options: { color: C.muted, fontSize: 10 } }
      ], { x: 0.72, y: y, w: 11, h: 0.3, fontFace: FONT, margin: 0, valign: 'middle' });
    }
    // Tarjeta KPI: titulo, etiqueta (gris), valor grande, complemento junto al valor, nota inferior
    function card(s, x, y, w, h, o) {
      s.addShape(pptx.ShapeType.roundRect, { x: x, y: y, w: w, h: h, rectRadius: 0.12, fill: { color: C.soft }, line: { color: C.line, width: 1 } });
      var t = [{ text: o.title, options: { bold: true, color: C.ink, fontSize: 12 } }];
      if (o.tag) t.push({ text: '   ' + o.tag, options: { color: C.grey, fontSize: 9 } });
      s.addText(t, { x: x + 0.22, y: y + 0.12, w: w - 0.4, h: 0.35, fontFace: FONT, margin: 0, valign: 'middle' });
      var vs = o.valueSize || 26;
      var v = [{ text: String(o.value), options: { bold: true, color: C.purple, fontSize: vs } }];
      if (o.extra) v.push({ text: '   ' + o.extra, options: { bold: true, color: C.ink, fontSize: 11 } });
      s.addText(v, { x: x + 0.22, y: y + 0.47, w: w - 0.4, h: h - 0.47 - (o.note ? 0.42 : 0.15), fontFace: FONT, margin: 0, valign: 'middle', fit: 'shrink' });
      if (o.note) s.addText(o.note, { x: x + 0.22, y: y + h - 0.4, w: w - 0.4, h: 0.3, fontFace: FONT, fontSize: 8.5, color: C.muted, margin: 0, valign: 'middle', italic: !!o.noteItalic });
    }
    function th(text, extra) { return { text: text, options: Object.assign({ bold: true, color: C.white, fill: { color: C.purple }, align: 'center', valign: 'middle' }, extra || {}) }; }
    function sh(text, extra) { return { text: text, options: Object.assign({ bold: true, color: C.purple, fill: { color: C.lav }, align: 'center', valign: 'middle' }, extra || {}) }; }
    function td(text, extra) { return { text: String(text), options: Object.assign({ color: C.ink, align: 'center', valign: 'middle' }, extra || {}) }; }
    function tot(text, extra) { return { text: String(text), options: Object.assign({ bold: true, color: C.purple, fill: { color: C.lav }, align: 'center', valign: 'middle' }, extra || {}) }; }
    function fitRows(n, avail, max) { // ajusta alto de fila y letra según cuántas filas se filtraron
      var h = Math.min(max, avail / n);
      return { rowH: h, fontSize: h >= 0.3 ? 9 : (h >= 0.24 ? 8 : (h >= 0.2 ? 7 : 6)), margin: h >= 0.24 ? [2, 4, 2, 4] : [0, 3, 0, 3] };
    }
    var tableBase = { fontFace: FONT, fontSize: 9, border: { type: 'solid', pt: 0.5, color: C.line }, margin: [2, 4, 2, 4] };

    /* 1. Portada */
    var s1 = pptx.addSlide();
    s1.background = { data: assets.cover };
    s1.addText(R.periodo, { x: 1.15, y: 2.85, w: 6.3, h: 0.9, fontFace: FONT, fontSize: 44, bold: true, color: C.white, margin: 0 });
    s1.addText('Reporte por área · Comité PIA · Piloto San Agustín', { x: 1.15, y: 3.75, w: 6.3, h: 0.45, fontFace: FONT, fontSize: 16, color: 'D9CCF2', margin: 0 });
    s1.addText('Atención al Cliente · Fecha de corte ' + R.corteTxt, { x: 1.15, y: 6.45, w: 7, h: 0.35, fontFace: FONT, fontSize: 11, color: 'D9CCF2', margin: 0 });

    /* 2. Resumen de indicadores */
    var s2 = base('ATC · Resumen de indicadores');
    meta(s2, 1.38);
    var cw = 3.95, ch = 1.62, gx = 0.18, gy = 0.17, x0 = 0.45, y0 = 1.82;
    function cx(c) { return x0 + c * (cw + gx); } function cy(r) { return y0 + r * (ch + gy); }
    card(s2, cx(0), cy(0), cw, ch, { title: 'Índice de Resolución PIA', value: pct(K.irPct), extra: num(K.irNum) + ' Casos', note: 'de los ' + num(K.irDen) + ' casos (GLPI SGU + tipificados) en el período' });
    card(s2, cx(1), cy(0), cw, ch, { title: 'Resolución en 1er contacto (FCR)', value: pct(K.fcrPct), extra: num(K.fcr) + ' Casos', note: 'de los ' + num(K.tipSA) + ' casos tipificados en el período' });
    card(s2, cx(2), cy(0), cw, ch, { title: 'Productividad del punto PIA', value: num(K.tipSA) + ' Casos', note: 'de los cuales ' + num(K.escalados) + ' fueron escalados a GLPI' });
    card(s2, cx(0), cy(1), cw, ch, { title: 'Resolución en la jornada', tag: 'Últimos 7 días', value: pct(K.jornadaPct), extra: num(K.jornadaMismoDia) + (K.jornadaMismoDia === 1 ? ' Caso' : ' Casos'), note: 'de los ' + num(K.jornadaAbiertos) + ' tickets SGU abiertos en la semana (' + R.semana.desde + ' al ' + R.semana.hasta + ')' });
    card(s2, cx(1), cy(1), cw, ch, { title: 'Satisfacción / NPS', tag: 'Trimestral', value: K.nps ? K.nps : '', note: K.nps ? '' : 'Pendiente por cargar' , noteItalic: !K.nps});
    card(s2, cx(2), cy(1), cw, ch, { title: 'Reincidencia de fallas', value: num(K.reincAbonados) + ' Abonados', extra: num(K.reincTickets) + ' Tickets', note: 'de los ' + num(K.sguTotal) + ' tickets SGU en GLPI' });
    card(s2, cx(0), cy(2), cw, ch, { title: 'Comparativo PIA vs. regular', tag: 'Mensual', value: K.comparativo.valor, valueSize: 22, note: K.comparativo.aFavor ? '- ' + K.comparativo.aFavor : '' });
    card(s2, cx(1), cy(2), cw, ch, { title: 'Upgrades y SVA', tag: 'Mensual', value: num(K.svaTotal) + (K.svaTotal === 1 ? ' Upgrade' : ' Upgrades'), note: K.sva.filter(function (x) { return x.n; }).map(function (x) { return x.label + ': ' + x.n; }).join(' · ') || 'Sin activaciones registradas' });
    card(s2, cx(2), cy(2), cw, ch, { title: 'Tiempo promedio de resolución', value: E.fmtDur(K.tiempoSGU.avg), valueSize: 22, note: 'de los ' + num(K.tiempoSGU.n) + ' tickets SGU resueltos en GLPI' });

    /* 3. Tiempo de resolución PIA vs resto (se reparte en varias láminas si el filtro deja muchas filas) */
    var head3 = function () { return [
      [th('Categoría', { rowspan: 2, align: 'left' }), th('Total de San Agustín', { colspan: 2 }), th('Diferente a San Agustín', { colspan: 2 })],
      [sh('Nro Total'), sh('Promedio Resolución'), sh('Nro Total'), sh('Promedio Resolución')]
    ]; };
    var data3 = R.tiempoCategoria.map(function (r) {
      var f = r.total ? tot : td;
      return [f(r.total ? 'Promedio' : r.label, { align: 'left' }), f(tk(r.sgu.n)), f(E.fmtDur(r.sgu.avg)), f(tk(r.pais.n)), f(E.fmtDur(r.pais.avg))];
    });
    pages(data3).forEach(function (chunk, pi, all) {
      var s3 = base('ATC · Tiempo de resolución PIA vs. resto' + (all.length > 1 ? '  (' + (pi + 1) + '/' + all.length + ')' : ''));
      var rows3 = head3().concat(chunk);
      s3.addTable(rows3, Object.assign({}, tableBase, fitRows(rows3.length, 5.35, 0.36), { x: 0.35, y: 1.6, w: 8.45, colW: [3.45, 1.15, 1.35, 1.15, 1.35] }));
      if (pi > 0) return;
      var sx = 9.05, sw = 3.9, sch = 1.2;
      card(s3, sx, 1.6, sw, sch, { title: 'Casos resueltos en SGU', value: tk(K.sguRes), valueSize: 18, note: 'de los ' + num(K.sguTotal) + ' tickets SGU en GLPI' });
      card(s3, sx, 1.6 + (sch + 0.12), sw, sch, { title: 'Resueltos en 1er contacto', value: num(K.fcr) + ' Casos', valueSize: 18, note: 'de los ' + num(K.tipSA) + ' casos tipificados en el período' });
      card(s3, sx, 1.6 + 2 * (sch + 0.12), sw, sch, { title: 'Resueltos escalados por PIA', value: tk(K.piaRes), valueSize: 18, note: 'de los ' + num(K.piaTotal) + ' tickets que creó el PIA en GLPI para SGU' });
      card(s3, sx, 1.6 + 3 * (sch + 0.12), sw, sch, { title: 'Resueltos fuera de San Agustín', value: tk(K.paisRes), valueSize: 18, note: 'de los ' + num(K.paisTotal) + ' tickets del resto del país en GLPI' });
    });

    /* 4. Canal de creación de casos SGU */
    var s4 = base('ATC · Canal de creación de casos SGU');
    var w4 = 3.95;
    card(s4, cx(0), 1.6, w4, 1.5, { title: 'Creados por el PIA', value: pct(K.sguTotal ? K.piaTotal / K.sguTotal : null), extra: tk(K.piaTotal), note: 'de los ' + num(K.sguTotal) + ' tickets SGU en GLPI' });
    card(s4, cx(1), 1.6, w4, 1.5, { title: 'Creados en otros canales', value: pct(K.sguTotal ? K.otrasTotal / K.sguTotal : null), extra: tk(K.otrasTotal), note: 'de los ' + num(K.sguTotal) + ' tickets SGU en GLPI' });
    card(s4, cx(2), 1.6, w4, 1.5, { title: 'Reincidencia de clientes', value: num(K.reincAbonados) + ' Abonados', extra: tk(K.reincTickets), note: 'de los ' + num(K.sguTotal) + ' tickets SGU en GLPI' });
    function bar100(s, y, label, parts) {
      s.addText(label, { x: 0.5, y: y, w: 12, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.ink, margin: 0 });
      var tw = 12.3, x = 0.5, sum = parts.reduce(function (a, p) { return a + p.n; }, 0) || 1;
      parts.forEach(function (p) {
        var w = Math.max(tw * p.n / sum, 0.02);
        s.addShape(pptx.ShapeType.rect, { x: x, y: y + 0.38, w: w, h: 0.75, fill: { color: p.color }, line: { color: p.color, width: 0 } });
        if (w > 1.3) s.addText(pct(p.n / sum) + ' ' + p.label + ' (' + num(p.n) + ')', { x: x, y: y + 0.38, w: w, h: 0.75, fontFace: FONT, fontSize: 11, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });
        else s.addText(pct(p.n / sum) + ' ' + p.label + ' (' + num(p.n) + ')', { x: x, y: y + 1.15, w: 3.2, h: 0.28, fontFace: FONT, fontSize: 9, bold: true, color: p.color, margin: 0 });
        x += w;
      });
    }
    bar100(s4, 3.45, 'Tickets SGU por canal de creación', [{ label: 'Otras unidades', n: K.otrasTotal, color: '8A12D6' }, { label: 'PIA', n: K.piaTotal, color: 'C77DF0' }]);
    bar100(s4, 5.05, 'Tickets en GLPI (todo el país): San Agustín vs. otras oficinas', [{ label: 'SGU', n: K.sguTotal, color: C.purple }, { label: 'Otras oficinas', n: K.paisTotal, color: C.magenta }]);

    /* 5. Reincidencias */
    var s5 = base('ATC · Reincidencias de clientes');
    var rc = R.reincidencia;
    card(s5, 0.45, 1.5, 2.55, 1.0, { title: 'Abonados', value: num(K.reincAbonados), valueSize: 22 });
    card(s5, 3.15, 1.5, 2.55, 1.0, { title: 'Tickets', value: num(K.reincTickets), valueSize: 22 });
    s5.addText('Fallas relacionadas del mismo cliente · de los ' + num(K.sguTotal) + ' tickets SGU en GLPI', { x: 0.45, y: 2.6, w: 5.3, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted, margin: 0 });
    var cats = Object.keys(rc.porCategoria);
    if (cats.length) {
      s5.addText('Categorías de los tickets', { x: 0.45, y: 3.0, w: 5.3, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.ink, margin: 0 });
      s5.addChart(pptx.ChartType.bar, [{ name: 'Tickets', labels: cats, values: cats.map(function (c) { return rc.porCategoria[c]; }) }], {
        x: 0.35, y: 3.3, w: 5.5, h: 3.4, barDir: 'col', chartColors: ['8A12D6'], showValue: true, dataLabelColor: C.ink, dataLabelFontSize: 9, dataLabelFontFace: FONT,
        catAxisLabelFontSize: 8, catAxisLabelFontFace: FONT, catAxisLabelColor: C.muted, valAxisHidden: true, valGridLine: { style: 'none' }, catAxisLineShow: false, barGapWidthPct: 60
      });
    } else {
      s5.addText('Sin reincidencias de fallas en el período.', { x: 0.45, y: 3.2, w: 5.3, h: 0.4, fontFace: FONT, fontSize: 12, color: C.muted, margin: 0 });
    }
    var maxRows = 13, list = rc.clientes.slice(0, maxRows);
    var rows5 = [[th('Cliente', { align: 'left' }), th('Categoría', { align: 'left' }), th('Ticket'), th('Contactos')]];
    list.forEach(function (c) {
      var catsC = []; c.tickets.forEach(function (t) { var k = t.categoria.replace(/^FTTH > /, ''); if (catsC.indexOf(k) < 0) catsC.push(k); });
      rows5.push([td(c.nombre, { align: 'left', bold: true, fontSize: 8 }), td(catsC.join('\n'), { align: 'left', fontSize: 8 }), td(c.tickets.map(function (t) { return t.id; }).join('\n'), { fontSize: 8 }), td(c.tickets.length, { bold: true })]);
    });
    if (!list.length) rows5.push([td('Sin reincidencias', { colspan: 4, color: C.muted })]);
    s5.addTable(rows5, Object.assign({}, tableBase, { x: 6.1, y: 1.5, w: 6.85, colW: [2.85, 2.05, 1.05, 0.9], fontSize: 8 }));
    if (rc.clientes.length > maxRows) s5.addText('+ ' + (rc.clientes.length - maxRows) + ' clientes más (ver reporte en Excel)', { x: 6.1, y: 6.85, w: 6.8, h: 0.25, fontFace: FONT, fontSize: 8, italic: true, color: C.muted, margin: 0 });

    /* 6. Grupo técnico */
    var head6 = function () { return [
      [th('Grupo Técnico', { rowspan: 2, align: 'left' }), th('Ecosistema PIA', { colspan: 2 }), th('Total de San Agustín', { colspan: 2 }), th('Diferente a San Agustín', { colspan: 2 })],
      [sh('Tickets Resueltos'), sh('Promedio Resolución'), sh('Tickets Resueltos'), sh('Promedio Resolución'), sh('Tickets Resueltos'), sh('Promedio Resolución')]
    ]; };
    var data6 = R.tiempoGrupo.map(function (r) {
      var f = r.total ? tot : td;
      return [f(r.total ? 'Total / Promedio' : r.label, { align: 'left' }), f(tk(r.pia.n)), f(E.fmtDur(r.pia.avg)), f(tk(r.sgu.n)), f(E.fmtDur(r.sgu.avg)), f(tk(r.pais.n)), f(E.fmtDur(r.pais.avg))];
    });
    pages(data6).forEach(function (chunk, pi, all) {
      var s6 = base('ATC · Grupo técnico: PIA vs. San Agustín' + (all.length > 1 ? '  (' + (pi + 1) + '/' + all.length + ')' : ''));
      var rows6 = head6().concat(chunk);
      s6.addTable(rows6, Object.assign({}, tableBase, fitRows(rows6.length, 5.35, 0.33), { x: 0.35, y: 1.6, w: 12.6, colW: [4.5, 1.3, 1.4, 1.3, 1.4, 1.3, 1.4] }));
    });

    /* 7 y 8. Resolución dentro de la jornada */
    function jornadaTable(s, groups, y) {
      var head1 = [th('Día', { rowspan: 2 }), th('Fecha', { rowspan: 2 })], head2 = [];
      groups.forEach(function (g) {
        head1.push(th(g.label, { colspan: g.pct ? 6 : 5 }));
        head2.push(sh('Abiertos'), sh('Pendientes'), sh('Resueltos'), sh('Acum. Pendiente'), sh('Acum. Resuelto'));
        if (g.pct) head2.push(sh('% Resueltos en la jornada'));
      });
      var rows = [head1, head2];
      var dash = function (n) { return n ? num(n) : '-'; };
      for (var i = 0; i < 7; i++) {
        var f0 = groups[0].data.filas[i], r = [td(f0.dia), td(f0.fecha)];
        groups.forEach(function (g) {
          var f = g.data.filas[i];
          r.push(td(dash(f.abiertos)), td(f.abiertos ? num(f.pendientes) : '-'), td(dash(f.resueltos)), td(num(f.accPend)), td(num(f.accRes)));
          if (g.pct) r.push(td(pct(f.pct)));
        });
        rows.push(r);
      }
      var tr = [tot('Total semanal', { colspan: 2 })];
      groups.forEach(function (g) {
        var t = g.data.total;
        tr.push(tot(num(t.abiertos)), tot(num(t.pendientes)), tot(num(t.resueltos)), tot(num(t.accPend)), tot(num(t.accRes)));
        if (g.pct) tr.push(tot(pct(t.pct)));
      });
      rows.push(tr);
      var ncol = 2 + groups.reduce(function (a, g) { return a + (g.pct ? 6 : 5); }, 0);
      var w = groups.length === 1 ? 9.0 : 12.6;
      var first = groups.length === 1 ? 1.4 : 1.05;
      var colW = [first, 1.15]; for (var c = 2; c < ncol; c++) colW.push((w - first - 1.15) / (ncol - 2));
      s.addTable(rows, Object.assign({}, tableBase, { x: (13.333 - w) / 2, y: y, w: w, colW: colW, rowH: 0.38, fontSize: groups.length === 1 ? 10 : 8.5 }));
    }
    var s7 = base('ATC · Resolución dentro de la jornada');
    s7.addText('Todo San Agustín (tickets SGU) · últimos 7 días antes del corte (' + R.semana.desde + ' al ' + R.semana.hasta + ')', { x: 0.72, y: 1.35, w: 11, h: 0.3, fontFace: FONT, fontSize: 10, color: C.muted, margin: 0 });
    jornadaTable(s7, [{ label: 'Todo San Agustín', data: R.jornada.sgu, pct: true }], 1.95);
    s7.addText('Abiertos: tickets creados ese día · Pendientes: creados ese día y no resueltos el mismo día · Resueltos: tickets solucionados ese día · % Resueltos en la jornada: creados y resueltos el mismo día / creados.', { x: 0.72, y: 6.35, w: 11.9, h: 0.45, fontFace: FONT, fontSize: 8, italic: true, color: C.muted, margin: 0 });

    var s8 = base('ATC · Resolución dentro de la jornada');
    s8.addText('Ecosistema PIA vs. resto de San Agustín · ' + R.semana.desde + ' al ' + R.semana.hasta, { x: 0.72, y: 1.35, w: 11, h: 0.3, fontFace: FONT, fontSize: 10, color: C.muted, margin: 0 });
    jornadaTable(s8, [{ label: 'Ecosistema PIA', data: R.jornada.pia, pct: true }, { label: 'San Agustín (otras unidades)', data: R.jornada.otras, pct: true }], 1.95);

    return pptx;
  }

  var api = { build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PIADeck = api;
})(typeof window !== 'undefined' ? window : this);
