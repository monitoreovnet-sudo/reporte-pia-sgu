/* Lienzo HTML compatible con la parte de PptxGenJS que usa deck.js.
 * Permite dibujar en pantalla exactamente las mismas diapositivas que se descargan en .pptx
 * (y de ahí exportarlas a PDF). Unidades: pulgadas; 1 pulgada = 100 px en el lienzo base.
 */
(function (root) {
  'use strict';
  var PX = 100, PT = 100 / 72; // px por pulgada, px por punto tipográfico

  function HtmlDeck() {
    this.slides = [];
    this.ShapeType = { roundRect: 'roundRect', rect: 'rect', line: 'line' };
    this.ChartType = { bar: 'bar', doughnut: 'doughnut' };
    this.layout = 'LAYOUT_WIDE';
  }
  HtmlDeck.prototype.addSlide = function () {
    var s = { background: null, els: [] };
    var api = {
      _s: s,
      addText: function (text, o) { s.els.push({ t: 'text', text: text, o: o || {} }); return api; },
      addShape: function (type, o) { s.els.push({ t: 'shape', type: type, o: o || {} }); return api; },
      addTable: function (rows, o) { s.els.push({ t: 'table', rows: rows, o: o || {} }); return api; },
      addChart: function (type, data, o) { s.els.push({ t: 'chart', type: type, data: data, o: o || {} }); return api; },
      addImage: function (o) { s.els.push({ t: 'image', o: o || {} }); return api; }
    };
    Object.defineProperty(api, 'background', { set: function (v) { s.background = v; }, get: function () { return s.background; } });
    this.slides.push(api);
    return api;
  };

  function col(c, fb) { return c ? '#' + String(c).replace('#', '') : (fb || 'inherit'); }
  function box(el, o) {
    el.style.position = 'absolute';
    el.style.left = (o.x || 0) * PX + 'px';
    el.style.top = (o.y || 0) * PX + 'px';
    if (o.w != null) el.style.width = o.w * PX + 'px';
    if (o.h != null) el.style.height = o.h * PX + 'px';
  }
  function styleRun(span, o) {
    if (o.fontFace) span.style.fontFamily = '"' + o.fontFace + '", "Montserrat", system-ui, sans-serif';
    if (o.fontSize) span.style.fontSize = o.fontSize * PT + 'px';
    if (o.bold) span.style.fontWeight = '700';
    if (o.italic) span.style.fontStyle = 'italic';
    if (o.color) span.style.color = col(o.color);
    if (o.charSpacing) span.style.letterSpacing = o.charSpacing * PT * 0.1 + 'em';
  }

  function drawText(e) {
    var o = e.o, el = document.createElement('div');
    box(el, o);
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.justifyContent = o.valign === 'middle' ? 'center' : (o.valign === 'bottom' ? 'flex-end' : 'flex-start');
    el.style.textAlign = o.align || 'left';
    el.style.lineHeight = '1.2';
    el.style.overflow = 'hidden';
    var inner = document.createElement('div');
    styleRun(inner, o);
    if (!o.fontSize) inner.style.fontSize = 18 * PT + 'px';
    if (!o.color) inner.style.color = '#000';
    inner.style.whiteSpace = 'pre-wrap';
    if (Array.isArray(e.text)) {
      e.text.forEach(function (r) {
        var sp = document.createElement('span');
        sp.textContent = r.text;
        styleRun(sp, r.options || {});
        inner.appendChild(sp);
      });
    } else inner.textContent = e.text;
    el.appendChild(inner);
    return el;
  }

  function drawShape(e) {
    var o = e.o, el = document.createElement('div');
    if (e.type === 'line') {
      box(el, { x: o.x, y: o.y, w: Math.max(o.w, 0.01), h: Math.max(o.h, 0.01) });
      var lw = Math.max(((o.line && o.line.width) || 1) * PT, 1) + 'px solid ' + col(o.line && o.line.color, '#ccc');
      if (!o.w) { el.style.width = '0'; el.style.borderLeft = lw; } else { el.style.height = '0'; el.style.borderTop = lw; }
      return el;
    }
    box(el, o);
    el.style.background = o.fill ? col(o.fill.color) : 'transparent';
    if (o.line && o.line.width) el.style.border = Math.max(o.line.width * PT, 1) + 'px solid ' + col(o.line.color);
    if (e.type === 'roundRect') el.style.borderRadius = (o.rectRadius != null ? o.rectRadius : 0.1) * PX + 'px';
    el.style.boxSizing = 'border-box';
    return el;
  }

  function drawTable(e) {
    var o = e.o, el = document.createElement('table');
    box(el, { x: o.x, y: o.y, w: o.w });
    el.style.borderCollapse = 'collapse';
    el.style.tableLayout = 'fixed';
    el.style.fontFamily = '"' + (o.fontFace || 'Montserrat') + '", system-ui, sans-serif';
    el.style.fontSize = (o.fontSize || 10) * PT + 'px';
    el.style.lineHeight = '1.15';
    var cg = document.createElement('colgroup');
    (o.colW || []).forEach(function (w) { var c = document.createElement('col'); c.style.width = w * PX + 'px'; cg.appendChild(c); });
    el.appendChild(cg);
    var m = o.margin || [2, 4, 2, 4];
    var bd = o.border ? Math.max((o.border.pt || 1) * PT, 0.6) + 'px solid ' + col(o.border.color) : 'none';
    var body = document.createElement('tbody');
    e.rows.forEach(function (row) {
      var tr = document.createElement('tr');
      var rh = Array.isArray(o.rowH) ? o.rowH[body.children.length] : o.rowH;
      tr.style.height = (rh ? rh * PX : 30) + 'px';
      row.forEach(function (cell) {
        var c = typeof cell === 'object' && cell !== null ? cell : { text: String(cell) };
        var co = c.options || {}, td = document.createElement('td');
        if (co.colspan) td.colSpan = co.colspan;
        if (co.rowspan) td.rowSpan = co.rowspan;
        td.textContent = c.text;
        td.style.whiteSpace = 'pre-wrap';
        td.style.border = bd;
        td.style.padding = m[0] * PT + 'px ' + m[1] * PT + 'px ' + m[2] * PT + 'px ' + m[3] * PT + 'px';
        td.style.textAlign = co.align || 'left';
        var va = co.valign || o.valign;
        td.style.verticalAlign = va === 'middle' ? 'middle' : (va || 'top');
        td.style.background = co.fill ? col(co.fill.color) : 'transparent';
        td.style.color = col(co.color, '#000');
        if (co.bold) td.style.fontWeight = '700';
        if (co.fontSize) td.style.fontSize = co.fontSize * PT + 'px';
        td.style.overflow = 'hidden';
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    el.appendChild(body);
    return el;
  }

  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, at) { var e = document.createElementNS(NS, tag); Object.keys(at).forEach(function (k) { e.setAttribute(k, at[k]); }); return e; }
  function svgText(svg, x, y, t, o) {
    var e = svgEl('text', { x: x, y: y, 'text-anchor': o.anchor || 'middle', 'dominant-baseline': o.base || 'middle', 'font-size': o.size || 10, fill: o.fill || '#241338', 'font-family': 'Montserrat, system-ui, sans-serif', 'font-weight': o.bold ? 700 : 400 });
    e.textContent = t; svg.appendChild(e); return e;
  }
  function legendHtml(el, names, colors, o, pos) {
    var lg = document.createElement('div');
    lg.style.cssText = 'position:absolute;display:flex;gap:4px 12px;flex-wrap:wrap;font-family:Montserrat,system-ui,sans-serif;color:#241338;' +
      (pos === 'r' ? 'right:0;top:0;bottom:0;width:120px;flex-direction:column;justify-content:center;' : 'left:0;right:0;bottom:0;height:22px;justify-content:center;align-items:center;');
    lg.style.fontSize = (o.legendFontSize || 9) * PT + 'px';
    names.forEach(function (n, i) { var s = document.createElement('span'); s.innerHTML = '<i style="display:inline-block;width:9px;height:9px;margin-right:5px;background:' + colors[i % colors.length] + '"></i>'; s.appendChild(document.createTextNode(n)); lg.appendChild(s); });
    el.appendChild(lg);
  }
  function drawChart(e) {
    var o = e.o, el = document.createElement('div');
    box(el, o);
    var W = o.w * PX, H = o.h * PX, colors = (o.chartColors || ['440099']).map(function (c) { return col(c); });
    var legPos = o.showLegend ? (o.legendPos || 'b') : null;
    var plotW = W - (legPos === 'r' ? 125 : 0), plotH = H - (legPos === 'b' ? 26 : 0);
    var svg = svgEl('svg', { width: plotW, height: plotH, viewBox: '0 0 ' + plotW + ' ' + plotH });
    svg.style.position = 'absolute'; svg.style.left = '0'; svg.style.top = '0';
    var series = e.data, labels = (series[0] || {}).labels || [];
    var lblSize = (o.dataLabelFontSize || 9) * PT, lblColor = col(o.dataLabelColor, '#241338'), catSize = (o.catAxisLabelFontSize || 9) * PT;

    if (e.type === 'doughnut') {
      var vals = series[0].values, tot = vals.reduce(function (a, b) { return a + b; }, 0) || 1;
      var R = Math.min(plotW, plotH) / 2 - 6, r = R * (o.holeSize || 50) / 100, cx = plotW / 2, cy = plotH / 2, a0 = -Math.PI / 2;
      vals.forEach(function (v, i) {
        var f = v / tot; if (f <= 0) return;
        var a1 = a0 + f * 2 * Math.PI, lg = f > 0.5 ? 1 : 0, c = colors[i % colors.length];
        if (f > 0.9999) { svg.appendChild(svgEl('circle', { cx: cx, cy: cy, r: (R + r) / 2, fill: 'none', stroke: c, 'stroke-width': R - r })); }
        else svg.appendChild(svgEl('path', { d: 'M' + (cx + R * Math.cos(a0)) + ',' + (cy + R * Math.sin(a0)) + ' A' + R + ',' + R + ' 0 ' + lg + ' 1 ' + (cx + R * Math.cos(a1)) + ',' + (cy + R * Math.sin(a1)) + ' L' + (cx + r * Math.cos(a1)) + ',' + (cy + r * Math.sin(a1)) + ' A' + r + ',' + r + ' 0 ' + lg + ' 0 ' + (cx + r * Math.cos(a0)) + ',' + (cy + r * Math.sin(a0)) + ' Z', fill: c, stroke: '#fff', 'stroke-width': 1.5 }));
        if (o.showPercent || o.showValue) { var am = (a0 + a1) / 2, rm = (R + r) / 2; svgText(svg, cx + rm * Math.cos(am), cy + rm * Math.sin(am), o.showPercent ? Math.round(f * 100) + '%' : v, { size: lblSize, fill: lblColor, bold: o.dataLabelFontBold }); }
        a0 = a1;
      });
      el.appendChild(svg);
      if (legPos) legendHtml(el, labels, colors, o, legPos);
      return el;
    }

    var horiz = o.barDir === 'bar', grouping = o.barGrouping || 'clustered', n = labels.length || 1, ns = series.length;
    var stacked = grouping === 'stacked' || grouping === 'percentStacked';
    var totals = labels.map(function (_, i) { return series.reduce(function (a, s) { return a + (s.values[i] || 0); }, 0); });
    var max = grouping === 'percentStacked' ? 1 : (stacked ? Math.max.apply(null, totals.concat([1])) : Math.max.apply(null, series.reduce(function (a, s) { return a.concat(s.values); }, [1])));
    var gap = (o.barGapWidthPct != null ? o.barGapWidthPct : 100) / 100;
    if (horiz) {
      var labW = o.catAxisHidden ? 0 : Math.min(plotW * 0.36, 150), valPad = o.dataLabelPosition === 'outEnd' ? 34 : 6, areaW = plotW - labW - valPad;
      var slot = plotH / n, band = slot / (1 + gap), bh = stacked ? band : band / ns;
      labels.forEach(function (lab, i) {
        var y0 = i * slot + (slot - band) / 2;
        if (!o.catAxisHidden) svgText(svg, labW - 6, y0 + band / 2, lab, { anchor: 'end', size: catSize, fill: col(o.catAxisLabelColor, '#241338') });
        var acc = 0;
        series.forEach(function (s, si) {
          var v = s.values[i] || 0, val = grouping === 'percentStacked' ? (totals[i] ? v / totals[i] : 0) : v, w = areaW * val / max;
          var x = labW + (stacked ? areaW * acc / max : 0), y = stacked ? y0 : y0 + si * bh;
          svg.appendChild(svgEl('rect', { x: x, y: y, width: Math.max(w, v ? 1 : 0), height: bh - (stacked ? 0 : 1), fill: colors[si % colors.length] }));
          if (o.showValue && v) {
            if (o.dataLabelPosition === 'outEnd' && !stacked) svgText(svg, x + w + 4, y + bh / 2, v, { anchor: 'start', size: lblSize, fill: lblColor });
            else if (w > 14) svgText(svg, x + w / 2, y + bh / 2, v, { size: lblSize, fill: lblColor });
          }
          acc += val;
        });
      });
    } else {
      var labH = 34, top = 16, areaH = plotH - labH - top, slotW = plotW / n, bandW = slotW / (1 + gap), bw = stacked ? bandW : bandW / ns;
      labels.forEach(function (lab, i) {
        var x0 = i * slotW + (slotW - bandW) / 2, acc = 0;
        series.forEach(function (s, si) {
          var v = s.values[i] || 0, h = areaH * v / max, x = stacked ? x0 : x0 + si * bw, y = top + areaH - h - (stacked ? areaH * acc / max : 0);
          svg.appendChild(svgEl('rect', { x: x, y: y, width: bw - (stacked ? 0 : 2), height: Math.max(h, 0), fill: colors[si % colors.length] }));
          if (o.showValue) svgText(svg, x + (bw - 2) / 2, y - 7, v, { size: lblSize, fill: lblColor });
          acc += v;
        });
        if (!o.catAxisHidden) svgText(svg, i * slotW + slotW / 2, top + areaH + 12, lab, { size: catSize, fill: col(o.catAxisLabelColor, '#241338') });
      });
      svg.appendChild(svgEl('line', { x1: 0, x2: plotW, y1: top + areaH, y2: top + areaH, stroke: '#D9CCEC' }));
    }
    el.appendChild(svg);
    if (legPos) legendHtml(el, series.map(function (s) { return s.name; }), colors, o, legPos);
    return el;
  }

  /** Dibuja una diapositiva en un contenedor; devuelve el lienzo base (1333 x 750 px). */
  function renderSlide(slideApi, container) {
    var s = slideApi._s, stage = document.createElement('div');
    stage.className = 'slide-stage';
    stage.style.cssText = 'position:relative;width:1333.33px;height:750px;overflow:hidden;background:#fff;font-family:Montserrat,system-ui,sans-serif;';
    if (s.background && s.background.data) {
      var img = document.createElement('img');
      img.src = 'data:' + s.background.data;
      img.alt = '';
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;max-width:none;';
      stage.appendChild(img);
    } else if (s.background && s.background.color) stage.style.background = col(s.background.color);
    s.els.forEach(function (e) {
      var el = e.t === 'text' ? drawText(e) : e.t === 'shape' ? drawShape(e) : e.t === 'table' ? drawTable(e) : e.t === 'chart' ? drawChart(e) : null;
      if (el) stage.appendChild(el);
    });
    if (container) container.appendChild(stage);
    return stage;
  }

  var api = { HtmlDeck: HtmlDeck, renderSlide: renderSlide, WIDTH: 1333.33, HEIGHT: 750 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SlidesHtml = api;
})(typeof window !== 'undefined' ? window : this);
