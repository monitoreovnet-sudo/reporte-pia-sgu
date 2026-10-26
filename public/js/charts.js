/* Gráficos SVG sencillos para el informe (colores fijos para que se exporten bien a PDF). */
(function (root) {
  'use strict';
  var INK = '#252423', MUTED = '#605E5C', GRID = '#EDEBE9', FONT = 'Montserrat, Segoe UI, system-ui, sans-serif';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function wrap(label, max) { // corta etiquetas largas en dos líneas
    var s = String(label), out = [];
    if (s.length <= max) return [s];
    var words = s.split(' '), line = '';
    words.forEach(function (w) {
      if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
    });
    if (line) out.push(line);
    if (out.length > 2) { out = [out[0], out.slice(1).join(' ')]; if (out[1].length > max) out[1] = out[1].slice(0, max - 1) + '…'; }
    return out;
  }
  function legend(series) {
    return '<div class="legend">' + series.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>';
  }

  /** Barras horizontales agrupadas. opts: {labels, series:[{name,color,values}], fmt(v), labelW, rowH} */
  function hbars(o) {
    var W = 640, labelW = o.labelW || 210, valW = 92, rowH = o.rowH || (o.series.length > 1 ? 34 : (o.labels.length <= 5 ? 40 : 24)), bh = (rowH - 10) / o.series.length;
    var H = o.labels.length * rowH + 8, plotW = W - labelW - valW;
    var max = 0; o.series.forEach(function (s) { s.values.forEach(function (v) { if (v > max) max = v; }); });
    if (!max) max = 1;
    var g = '';
    for (var k = 0; k <= 4; k++) { var gx = labelW + plotW * k / 4; g += '<line x1="' + gx + '" x2="' + gx + '" y1="0" y2="' + (H - 4) + '" stroke="' + GRID + '"/>'; }
    o.labels.forEach(function (lab, i) {
      var y0 = i * rowH + 5, lines = wrap(lab, 30);
      lines.forEach(function (ln, j) {
        g += '<text x="' + (labelW - 8) + '" y="' + (y0 + rowH / 2 - 4 + (j - (lines.length - 1) / 2) * 12 + 4) + '" text-anchor="end" font-size="11" fill="' + INK + '">' + esc(ln) + '</text>';
      });
      o.series.forEach(function (s, si) {
        var v = s.values[i] || 0, w = plotW * v / max, y = y0 + si * bh;
        g += '<rect x="' + labelW + '" y="' + y + '" width="' + Math.max(w, v ? 2 : 0) + '" height="' + (bh - 2) + '" fill="' + s.color + '" rx="1.5"/>';
        g += '<text x="' + (labelW + w + 6) + '" y="' + (y + bh / 2 + 2.5) + '" font-size="10" fill="' + MUTED + '">' + esc(v ? (o.fmt ? o.fmt(v, s, i) : v) : '') + '</text>';
      });
    });
    return (o.series.length > 1 ? legend(o.series) : '') +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(o.title || 'Gráfico de barras') + '" style="font-family:' + FONT + '">' + g + '</svg>';
  }

  /** Columnas agrupadas. opts: {labels, series:[{name,color,values}], fmt} */
  function columns(o) {
    var W = 640, H = o.height || 230, top = 18, bottom = 40, left = 8, n = o.labels.length || 1;
    var max = 0; o.series.forEach(function (s) { s.values.forEach(function (v) { if (v > max) max = v; }); });
    if (!max) max = 1;
    var plotH = H - top - bottom, slot = (W - left * 2) / n, inner = slot * 0.72, bw = inner / o.series.length, g = '';
    for (var k = 0; k <= 4; k++) { var gy = top + plotH * k / 4; g += '<line x1="0" x2="' + W + '" y1="' + gy + '" y2="' + gy + '" stroke="' + GRID + '"/>'; }
    o.labels.forEach(function (lab, i) {
      var x0 = left + i * slot + (slot - inner) / 2;
      o.series.forEach(function (s, si) {
        var v = s.values[i] || 0, h = plotH * v / max, x = x0 + si * bw, y = top + plotH - h;
        g += '<rect x="' + x + '" y="' + y + '" width="' + (bw - 2) + '" height="' + h + '" fill="' + s.color + '" rx="1.5"/>';
        if (v) g += '<text x="' + (x + (bw - 2) / 2) + '" y="' + (y - 4) + '" text-anchor="middle" font-size="10" fill="' + MUTED + '">' + esc(o.fmt ? o.fmt(v) : v) + '</text>';
      });
      wrap(lab, Math.max(8, Math.floor(slot / 6.5))).forEach(function (ln, j) {
        g += '<text x="' + (left + i * slot + slot / 2) + '" y="' + (H - bottom + 15 + j * 12) + '" text-anchor="middle" font-size="10.5" fill="' + INK + '">' + esc(ln) + '</text>';
      });
    });
    return (o.series.length > 1 ? legend(o.series) : '') +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(o.title || 'Gráfico de columnas') + '" style="font-family:' + FONT + '">' + g + '</svg>';
  }

  /** Anillo. opts: {parts:[{label,value,color}], center, sub} */
  function donut(o) {
    var total = o.parts.reduce(function (a, p) { return a + p.value; }, 0) || 1;
    var R = 70, r = 46, cx = 90, cy = 90, a0 = -Math.PI / 2, g = '';
    o.parts.forEach(function (p) {
      var frac = p.value / total;
      if (frac <= 0) return;
      if (frac >= 0.9999) { g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R + r) / 2 + '" fill="none" stroke="' + p.color + '" stroke-width="' + (R - r) + '"/>'; return; }
      var a1 = a0 + frac * Math.PI * 2, large = frac > 0.5 ? 1 : 0;
      var p1 = [cx + R * Math.cos(a0), cy + R * Math.sin(a0)], p2 = [cx + R * Math.cos(a1), cy + R * Math.sin(a1)];
      var p3 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)], p4 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
      g += '<path d="M' + p1 + ' A' + R + ',' + R + ' 0 ' + large + ' 1 ' + p2 + ' L' + p3 + ' A' + r + ',' + r + ' 0 ' + large + ' 0 ' + p4 + ' Z" fill="' + p.color + '" stroke="#fff" stroke-width="1.5"/>';
      a0 = a1;
    });
    g += '<text x="' + cx + '" y="' + (cy + 2) + '" text-anchor="middle" font-size="22" font-weight="700" fill="' + INK + '">' + esc(o.center || '') + '</text>';
    g += '<text x="' + cx + '" y="' + (cy + 20) + '" text-anchor="middle" font-size="10" fill="' + MUTED + '">' + esc(o.sub || '') + '</text>';
    var leg = o.parts.map(function (p) {
      return '<div class="dl"><i style="background:' + p.color + '"></i><span>' + esc(p.label) + '</span><b>' + esc(p.text || p.value) + '</b><em>' + Math.round(100 * p.value / total) + '%</em></div>';
    }).join('');
    return '<div class="donut"><svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="' + esc(o.title || 'Gráfico de anillo') + '" style="font-family:' + FONT + ';flex:none">' + g + '</svg><div class="dlegend">' + leg + '</div></div>';
  }

  var api = { hbars: hbars, columns: columns, donut: donut, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Charts = api;
})(typeof window !== 'undefined' ? window : this);
