/* Shared behaviour: drifting glyph margins, the incident run panel and the tick loop. */
(function () {
  'use strict';

  var GLYPHS = '.:-=+*x<>/%#';
  var still = false;
  try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function glyph() {
    return GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
  }

  // Reveal text left to right; the unrevealed part is random glyphs.
  function scramble(text, p) {
    if (p >= 1) return text;
    var n = Math.floor(text.length * p);
    var out = text.slice(0, n);
    for (var i = n; i < text.length; i++) {
      out += text.charAt(i) === ' ' ? ' ' : glyph();
    }
    return out;
  }

  function margins(count) {
    var rows = 46, cols = 30, field = [];
    for (var r = 0; r < rows; r++) {
      var line = [];
      var len = Math.random() < 0.25 ? 0 : Math.floor(Math.random() * cols);
      for (var c = 0; c < cols; c++) {
        line.push(c < len && Math.random() < 0.7 ? glyph() : ' ');
      }
      field.push(line);
    }

    function make(host) {
      var list = [];
      if (!host) return list;
      for (var b = 0; b < count; b++) {
        var pre = document.createElement('pre');
        pre.className = 'nk-margin-text';
        host.appendChild(pre);
        list.push(pre);
      }
      return list;
    }
    var leftPres = make(document.querySelector('.nk-margin-left .nk-margin-inner'));
    var rightPres = make(document.querySelector('.nk-margin-right .nk-margin-inner'));

    function paint() {
      var left = field.map(function (l) { return l.slice().reverse().join(''); }).join('\n');
      var right = field.map(function (l) { return l.join(''); }).join('\n');
      leftPres.forEach(function (pre, b) { pre.textContent = b % 2 ? right : left; });
      rightPres.forEach(function (pre, b) { pre.textContent = b % 2 ? left : right; });
    }

    function mutate() {
      for (var i = 0; i < 26; i++) {
        var r = Math.floor(Math.random() * rows);
        var c = Math.floor(Math.random() * cols);
        field[r][c] = Math.random() < 0.45 ? ' ' : glyph();
      }
    }

    paint();
    return function () { mutate(); paint(); };
  }

  // The "Illustrative run" panel. `text` is what gets typed into the last line.
  function runPanel(root, text) {
    if (!root) return function () {};
    var rows = Array.prototype.slice.call(root.querySelectorAll('.nk-step')).map(function (row) {
      return { row: row, dot: row.querySelector('.nk-step-dot') };
    });
    var typedEl = root.querySelector('[data-run-typed]');
    var bar = root.querySelector('[data-run-bar]');
    var ticket = text || 'Carrier fault on the primary circuit. Backup path is carrying traffic. Evidence attached.';

    return function (t) {
      var cyc = still ? 999 : t % 120;
      var idx = Math.min(4, Math.floor(cyc / 11));
      rows.forEach(function (r, i) {
        var dot = '#3A3D42';
        if (i < idx) dot = '#8B9097';
        if (i === idx) dot = i === 4 ? '#F5A524' : '#2EE6A6';
        r.row.style.opacity = i <= idx ? '1' : '0.3';
        r.dot.style.background = dot;
      });
      if (typedEl) typedEl.textContent = ticket.slice(0, Math.max(0, (cyc - 33) * 2));
      if (bar) bar.style.width = Math.min(100, Math.round(cyc / 90 * 100)) + '%';
    };
  }

  // One shared tick loop per page.
  function run(opts) {
    var t = 0;
    var tickMargins = margins(opts.blocks || 6);
    var onTick = opts.onTick || function () {};
    onTick(0);
    if (still) return;
    setInterval(function () {
      if (document.hidden) return;
      t += 1;
      tickMargins();
      onTick(t);
    }, opts.interval || 120);
  }

  window.Netwik = { still: still, glyph: glyph, scramble: scramble, runPanel: runPanel, run: run };
})();
