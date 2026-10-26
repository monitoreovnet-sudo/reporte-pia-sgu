/* Lienzo HTML compatible con la parte de PptxGenJS que usa deck.js.
 * Permite dibujar en pantalla exactamente las mismas diapositivas que se descargan en .pptx
 * (y de ahí exportarlas a PDF). Unidades: pulgadas; 1 pulgada = 100 px en el lienzo base.
 */
(function (root) {
  'use strict';
  var PX = 100, PT = 100 / 72; // px por pulgada, px por punto tipográfico

  function HtmlDeck() {
    this.slides = [];
    this.ShapeType = { roundRect: 'roundRect', rect: 'rect' };
    this.ChartType = { bar: 'bar' };
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
      tr.style.height = (o.rowH ? o.rowH * PX : 30) + 'px';
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
        td.style.verticalAlign = co.valign === 'middle' ? 'middle' : (co.valign || 'top');
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

  function drawChart(e) {
    var o = e.o, el = document.createElement('div'), d = e.data[0] || { labels: [], values: [] };
    box(el, o);
    var W = o.w * PX, H = o.h * PX, n = d.labels.length || 1;
    var max = Math.max.apply(null, d.values.concat([1]));
    var labH = 38, topPad = 22, plotH = H - labH - topPad;
    var slot = W / n, bw = slot * (1 - (o.barGapWidthPct || 60) / 100 / (1 + (o.barGapWidthPct || 60) / 100));
    var color = col((o.chartColors || ['440099'])[0]);
    var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    d.labels.forEach(function (lab, i) {
      var v = d.values[i], h = plotH * v / max, x = i * slot + (slot - bw) / 2, y = topPad + plotH - h;
      var r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', bw); r.setAttribute('height', Math.max(h, 1)); r.setAttribute('fill', color);
      svg.appendChild(r);
      if (o.showValue) {
        var t = document.createElementNS(ns, 'text');
        t.setAttribute('x', x + bw / 2); t.setAttribute('y', y - 6); t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-size', (o.dataLabelFontSize || 9) * PT); t.setAttribute('fill', col(o.dataLabelColor, '#241338'));
        t.setAttribute('font-family', 'Montserrat, system-ui, sans-serif'); t.textContent = v;
        svg.appendChild(t);
      }
    });
    el.appendChild(svg);
    var labs = document.createElement('div');
    labs.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:' + labH + 'px;display:flex;font-family:Montserrat,system-ui,sans-serif;line-height:1.1;text-align:center;';
    labs.style.fontSize = (o.catAxisLabelFontSize || 8) * PT + 'px';
    labs.style.color = col(o.catAxisLabelColor, '#6B5F80');
    d.labels.forEach(function (lab) { var s = document.createElement('div'); s.style.flex = '1'; s.style.padding = '2px'; s.textContent = lab; labs.appendChild(s); });
    el.appendChild(labs);
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
