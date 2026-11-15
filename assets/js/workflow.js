/* workflow.html: a replay of the zero-day vulnerability flow, stage by stage.
 *
 * One playhead, measured in seconds of replay time, driven by the single tick
 * loop every page on this site shares. Everything drawn is a pure function of
 * that playhead, so seeking to a stage and playing into it produce the same
 * picture. Clicking a stage moves the playhead; nothing keeps hidden state.
 *
 * The timeline is the table of contents: one segment per stage, as wide as
 * the stage is long, coloured by who acts in it and hatched where the stage
 * is designed but not built.
 *
 * Scenes and the stage text are rebuilt only when the stage changes. Within a
 * stage the scene gets an update(p) call each tick, p running 0 to 1.
 *
 * Nodes are built with el(), which sets textContent, so no value is ever
 * interpolated into markup.
 */
(function () {
  'use strict';

  var D = window.NetwikFlow;
  var N = window.Netwik;
  if (!D || !N) return;

  var STEP = 0.06;          /* seconds of replay per tick, matching interval 60 */
  var still = N.still;

  /* fg is text on white, solid is a fill, mid is the same fill not yet
     reached on the timeline, tint is a quiet background. */
  var TONES = {
    plain: { fg: '#3D4147', solid: '#8B9097', mid: '#D5D8DC', tint: '#EEF0F2' },
    good: { fg: '#0B7A58', solid: '#12B886', mid: '#A9E1CC', tint: '#DFF3EB' },
    warn: { fg: '#8A5300', solid: '#F5A524', mid: '#FAD58E', tint: '#FCEBC8' },
    hot: { fg: '#C2343A', solid: '#E5484D', mid: '#F4ABAD', tint: '#FADCDD' }
  };

  function tone(name) { return TONES[name] || TONES.plain; }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function sty(node, css) { node.setAttribute('style', css); return node; }
  function id(name) { return document.getElementById(name); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function set(elementId, text) {
    var node = id(elementId);
    if (node) node.textContent = text;
  }

  /* Eases a number so it settles rather than stopping dead. */
  function ease(p) { return 1 - Math.pow(1 - clamp(p, 0, 1), 3); }

  /* A stagger: row i of n starts at i/n and finishes a third of the way later. */
  function step(p, i, n) {
    var span = 1 / Math.max(1, n);
    return clamp((p - i * span * 0.75) / (span * 1.4), 0, 1);
  }

  function num(value) {
    return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function mmss(seconds) {
    var s = Math.floor(seconds);
    return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }

  function stageLabel(n) { return n === 2.5 ? '2b' : String(n); }

  /* ---- the timeline ----------------------------------------------------- */

  var marks = [];
  var clock = 0;
  D.stages.forEach(function (s) {
    marks.push({ stage: s, start: clock, end: clock + s.secs });
    clock += s.secs;
  });
  var TOTAL = clock;

  var lines = [];
  marks.forEach(function (m) {
    var n = m.stage.log.length;
    m.stage.log.forEach(function (text, k) {
      lines.push({ time: m.start + m.stage.secs * ((k + 0.6) / (n + 0.4)), text: text });
    });
  });
  lines.sort(function (a, b) { return a.time - b.time; });

  function progressOf(stageNumber, head) {
    for (var i = 0; i < marks.length; i++) {
      if (marks[i].stage.n === stageNumber) {
        return clamp((head - marks[i].start) / marks[i].stage.secs, 0, 1);
      }
    }
    return 0;
  }

  var segs = [];

  function buildRail(onSeek) {
    var host = id('wf-rail');
    if (!host) return;
    marks.forEach(function (m, i) {
      var s = m.stage;
      var aut = D.autonomy[s.autonomy] || D.autonomy.agent;
      var t = tone(aut.tone);
      var name = 'Stage ' + stageLabel(s.n) + ': ' + s.name;

      var seg = el('button', 'nk-wf-seg');
      seg.type = 'button';
      seg.title = name;
      seg.setAttribute('aria-label', name + '. ' + aut.label + '. '
        + (s.status === 'running' ? 'Built and running today.' : 'Designed, not built yet.'));
      seg.setAttribute('data-status', s.status);
      sty(seg, 'flex: ' + s.secs + ' 1 0');

      var track = sty(el('span', 'nk-wf-track'), 'background: ' + t.mid);
      var fill = sty(el('span', 'nk-wf-fill'), 'background: ' + t.solid);
      track.appendChild(fill);
      seg.appendChild(track);
      seg.appendChild(el('span', 'nk-wf-num', stageLabel(s.n)));

      seg.addEventListener('click', function () { onSeek(i); });
      host.appendChild(seg);
      segs.push({ seg: seg, fill: fill });
    });
  }

  function paintRail(idx, p) {
    segs.forEach(function (r, i) {
      r.fill.style.width = (i < idx ? 100 : (i === idx ? p * 100 : 0)) + '%';
    });
  }

  function markRail(idx) {
    segs.forEach(function (r, i) {
      if (i === idx) r.seg.setAttribute('aria-current', 'step');
      else r.seg.removeAttribute('aria-current');
    });
  }

  /* ---- scenes ----------------------------------------------------------- */

  var LINE = '#E2E4E7';

  /* A list of things, each with a note and an outcome. The workhorse. */
  function rowList(host, rows) {
    var list = sty(el('div'), 'display: flex; flex-direction: column; border-top: 1px solid ' + LINE);
    var built = [];

    rows.forEach(function (r) {
      var t = tone(r.tone);
      var wrap = sty(el('div', 'nk-wf-item'),
        'padding: 13px 0; border-bottom: 1px solid ' + LINE + '; display: flex; align-items: flex-start; gap: 12px');

      wrap.appendChild(sty(el('span'),
        'flex: none; width: 8px; height: 8px; margin-top: 8px; background: ' + t.solid));

      var left = sty(el('div'), 'flex: 1 1 auto; min-width: 0');
      left.appendChild(sty(el('div', null, r.label), 'font-size: 16px; font-weight: 500; color: #0A0A0B'));
      if (r.sub) {
        left.appendChild(sty(el('div', null, r.sub),
          'font-size: 14px; line-height: 1.4; color: #5B6068; margin-top: 2px'));
      }
      wrap.appendChild(left);

      var value = sty(el('span', null, r.value),
        'flex: none; margin-top: 2px; font-family: var(--mono); font-size: 12px; padding: 3px 8px; white-space: nowrap; color: '
        + t.fg + '; background: ' + t.tint);
      wrap.appendChild(value);

      list.appendChild(wrap);
      built.push({ wrap: wrap, value: value });
    });

    host.appendChild(list);

    return function (p) {
      built.forEach(function (b, i) {
        var q = step(p, i, built.length);
        b.wrap.style.opacity = String(0.3 + 0.7 * clamp(q * 3, 0, 1));
        b.value.style.visibility = q > 0.55 ? 'visible' : 'hidden';
      });
    };
  }

  /* A row of bordered cells, each a number counting up over a caption. */
  function cellRow(host, items, size) {
    var wrap = sty(el('div'), 'display: flex; flex-wrap: wrap; gap: 10px');
    var cells = [];
    items.forEach(function (it) {
      var cell = sty(el('div'),
        'flex: 1 1 120px; box-sizing: border-box; min-width: 0; border: 1px solid ' + LINE + '; background: #FFFFFF; padding: 14px 16px');
      var v = sty(el('div', null, '0'),
        'font-size: ' + size + '; line-height: 1; letter-spacing: -.035em; font-variant-numeric: tabular-nums; color: #0A0A0B');
      cell.appendChild(v);
      cell.appendChild(sty(el('div', null, it.label),
        'font-size: 14px; font-weight: 500; line-height: 1.3; color: #0A0A0B; margin-top: 10px'));
      if (it.sub) {
        cell.appendChild(sty(el('div', null, it.sub), 'font-size: 13px; color: #5B6068; margin-top: 1px'));
      }
      wrap.appendChild(cell);
      cells.push({ v: v, target: Number(String(it.value).replace(/[^0-9.]/g, '')) || 0 });
    });
    host.appendChild(wrap);
    return cells;
  }

  function sceneIntake(host, viz) {
    var card = sty(el('div'), 'border: 1px solid ' + LINE + '; background: #FFFFFF');
    var head = sty(el('div', null, 'Vendor advisory, inbound'),
      'padding: 12px 18px; border-bottom: 1px solid ' + LINE + '; font-size: 14px; color: #5B6068');
    card.appendChild(head);

    var body = sty(el('div'), 'padding: 4px 18px');
    var built = [];
    viz.fields.forEach(function (f, i) {
      var row = sty(el('div', 'nk-wf-item'),
        'display: flex; flex-wrap: wrap; gap: 2px 18px; padding: 12px 0'
        + (i ? '; border-top: 1px solid ' + LINE : ''));
      row.appendChild(sty(el('span', null, f[0]), 'flex: none; width: 84px; font-size: 14px; color: #5B6068'));
      var val = sty(el('span', null, ''),
        'flex: 1 1 200px; min-width: 0; min-height: 1.5em; font-size: 16px; font-weight: 500; color: #0A0A0B; overflow-wrap: anywhere');
      row.appendChild(val);
      body.appendChild(row);
      built.push({ row: row, val: val, text: f[1] });
    });
    card.appendChild(body);
    host.appendChild(card);

    var stamp = sty(el('p', 'nk-wf-item',
      'Checked against every advisory already recorded. No prior record found, so one is created rather than a second investigation into the same flaw.'),
      'margin: 16px 0 0; padding-left: 14px; border-left: 2px solid #12B886; font-size: 14px; line-height: 1.5; color: #3D4147');
    host.appendChild(stamp);

    return function (p) {
      built.forEach(function (b, i) {
        var q = step(p * 0.8, i, built.length);
        b.row.style.opacity = String(0.3 + 0.7 * clamp(q * 4, 0, 1));
        b.val.textContent = b.text.slice(0, Math.round(b.text.length * clamp(q * 1.3, 0, 1)));
      });
      stamp.style.opacity = String(clamp((p - 0.75) * 6, 0, 1));
    };
  }

  /* A population draining through named reductions. The number is the
     picture, so there is no bar to draw out of proportion. */
  function sceneFunnel(host, viz) {
    var list = sty(el('div'), 'border-top: 1px solid ' + LINE);
    var built = [];
    viz.rows.forEach(function (r) {
      var row = sty(el('div', 'nk-wf-item'),
        'display: flex; align-items: baseline; gap: 18px; padding: 10px 0; border-bottom: 1px solid ' + LINE);
      var v = sty(el('span', null, '0'),
        'flex: none; width: 68px; text-align: right; font-size: 30px; line-height: 1.1; letter-spacing: -.035em; font-variant-numeric: tabular-nums; color: '
        + tone(r.tone).fg);
      row.appendChild(v);
      row.appendChild(sty(el('span', null, r.label), 'font-size: 16px; color: #0A0A0B'));
      list.appendChild(row);
      built.push({ row: row, v: v, target: r.value });
    });
    host.appendChild(list);

    var siteCells = [];
    if (viz.sites) {
      host.appendChild(sty(el('div'), 'height: 20px'));
      siteCells = cellRow(host, viz.sites, '30px');
    }

    return function (p) {
      built.forEach(function (b, i) {
        var q = step(p * 0.7, i, built.length);
        b.row.style.opacity = String(0.3 + 0.7 * clamp(q * 3, 0, 1));
        b.v.textContent = num(b.target * ease(q));
      });
      siteCells.forEach(function (c, i) {
        c.v.textContent = num(c.target * ease((p - 0.55 - i * 0.07) * 5));
      });
    };
  }

  /* 755 squares, one per device, each taking its colour as the sweep reaches
     it. The point of the picture is the ratio: twelve lit cells in a wall. */
  function sceneGrid(host, viz) {
    var COLOURS = { unseen: '#ECEEF0', front: '#0A0A0B', hot: '#E5484D', dim: '#A9AEB6', clear: '#BFE6D6' };
    var hot = {}, dim = {};
    var i;
    for (i = 0; i < viz.hot; i++) hot[(i * 61 + 29) % viz.total] = true;
    for (i = 0; i < viz.dim; i++) {
      var k = (i * 149 + 11) % viz.total;
      if (!hot[k]) dim[k] = true;
    }

    host.appendChild(sty(el('div', null, num(viz.total) + ' devices, one square each'),
      'font-size: 14px; color: #5B6068; margin-bottom: 12px'));

    var grid = el('div', 'nk-wf-grid');
    var cells = [];
    var painted = [];
    for (i = 0; i < viz.total; i++) {
      var cell = el('span');
      grid.appendChild(cell);
      cells.push(cell);
      painted.push('');
    }
    host.appendChild(grid);

    var legend = sty(el('div'), 'margin-top: 18px; display: flex; flex-direction: column; gap: 8px');
    var legendRows = [];
    viz.legend.forEach(function (entry) {
      var row = sty(el('div', 'nk-wf-item'),
        'display: flex; align-items: baseline; gap: 10px; font-size: 14px; color: #3D4147');
      row.appendChild(sty(el('span'),
        'flex: none; width: 9px; height: 9px; background: ' + (COLOURS[entry[0]] || COLOURS.clear)));
      row.appendChild(el('span', null, entry[1]));
      legend.appendChild(row);
      legendRows.push(row);
    });
    host.appendChild(legend);

    return function (p) {
      var front = clamp(p * 1.15, 0, 1) * viz.total;
      for (var j = 0; j < cells.length; j++) {
        var colour;
        if (j > front) colour = COLOURS.unseen;
        else if (j > front - 14 && front < viz.total) colour = COLOURS.front;
        else if (hot[j]) colour = COLOURS.hot;
        else if (dim[j]) colour = COLOURS.dim;
        else colour = COLOURS.clear;
        /* Only the cells the sweep is crossing change, so the comparison is
           against what was last written rather than the computed style. */
        if (painted[j] !== colour) {
          cells[j].style.background = colour;
          painted[j] = colour;
        }
      }
      legendRows.forEach(function (row, n) {
        row.style.opacity = String(clamp((p - 0.6 - n * 0.08) * 6, 0, 1));
      });
    };
  }

  /* A stage that stops and waits for a person. The waiting is the content. */
  function sceneGate(host, viz) {
    var banner = sty(el('div'), '');
    var pip = sty(el('span', 'nk-live'), 'width: 9px; height: 9px; flex: none');
    var bannerText = sty(el('span', null, ''), 'font-size: 15px; font-weight: 500');
    banner.appendChild(pip);
    banner.appendChild(bannerText);
    banner.appendChild(sty(el('span', null, viz.who), 'font-size: 14px; color: #3D4147; margin-left: auto'));
    host.appendChild(banner);

    host.appendChild(sty(el('p', null, viz.question),
      'margin: 22px 0 0; font-size: clamp(20px, 2.2vw, 26px); font-weight: 500; line-height: 1.25; letter-spacing: -.025em; color: #0A0A0B'));

    var opts = sty(el('div'), 'margin-top: 20px; display: flex; flex-wrap: wrap; gap: 10px');
    var optCells = [];
    viz.options.forEach(function (o) {
      var cell = sty(el('div', 'nk-wf-item'),
        'flex: 1 1 180px; min-width: 0; border: 1px solid ' + LINE + '; background: #FFFFFF; padding: 14px 16px');
      cell.appendChild(sty(el('div', null, o.label), 'font-size: 16px; font-weight: 500; color: ' + tone(o.tone).fg));
      cell.appendChild(sty(el('div', null, o.note), 'font-size: 14px; line-height: 1.4; color: #5B6068; margin-top: 3px'));
      opts.appendChild(cell);
      optCells.push(cell);
    });
    host.appendChild(opts);

    var answer = sty(el('div', 'nk-wf-item'),
      'margin-top: 20px; border-left: 2px solid #12B886; padding: 2px 0 2px 14px');
    answer.appendChild(sty(el('div', null, 'The answer, recorded with who gave it'), 'font-size: 13px; color: #0B7A58'));
    var answerText = sty(el('div', null, ''),
      'font-size: 16px; line-height: 1.45; color: #0A0A0B; margin-top: 4px; min-height: 2.9em');
    answer.appendChild(answerText);
    host.appendChild(answer);

    var BASE = 'padding: 14px 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; border: 1px solid ';
    var wasAnswered = null;

    return function (p) {
      var answered = p > 0.55;
      if (answered !== wasAnswered) {
        wasAnswered = answered;
        sty(banner, BASE + (answered ? '#12B886; background: #EAF7F1' : '#F5A524; background: #FFF6E3'));
        pip.style.background = answered ? '#12B886' : '#F5A524';
        pip.className = answered ? '' : 'nk-live';
        bannerText.textContent = answered ? 'Answered, the flow continues' : 'Stopped, waiting on a person';
        bannerText.style.color = answered ? '#0B7A58' : '#8A5300';
      }
      optCells.forEach(function (cell, i) {
        cell.style.opacity = String(0.3 + 0.7 * clamp((p - 0.15 - i * 0.1) * 6, 0, 1));
      });
      var typed = clamp((p - 0.6) / 0.3, 0, 1);
      answer.style.opacity = String(clamp(typed * 4, 0, 1));
      answerText.textContent = viz.answer.slice(0, Math.round(viz.answer.length * typed));
    };
  }

  function sceneBoard(host, viz) {
    var cells = cellRow(host, viz.headline, 'clamp(26px, 3vw, 36px)');
    host.appendChild(sty(el('div'), 'height: 20px'));
    var update = rowList(host, viz.rows);

    return function (p) {
      cells.forEach(function (c, i) {
        c.v.textContent = num(c.target * ease((p - i * 0.06) * 2.4));
      });
      update(clamp((p - 0.25) / 0.75, 0, 1));
    };
  }

  function buildScene(stage) {
    var host = id('wf-scene');
    if (!host) return function () {};
    host.textContent = '';
    var viz = stage.viz;
    if (viz.kind === 'intake') return sceneIntake(host, viz);
    if (viz.kind === 'funnel') return sceneFunnel(host, viz);
    if (viz.kind === 'grid') return sceneGrid(host, viz);
    if (viz.kind === 'gate') return sceneGate(host, viz);
    if (viz.kind === 'board') return sceneBoard(host, viz);
    return rowList(host, viz.rows);
  }

  /* ---- the log ---------------------------------------------------------- */

  var logShown = 0;

  function paintLog(head) {
    var host = id('wf-log');
    if (!host) return;

    var want = 0;
    while (want < lines.length && lines[want].time <= head) want++;

    if (want < logShown) {
      host.textContent = '';
      logShown = 0;
    }
    if (want === logShown) return;
    while (logShown < want) {
      var row = sty(el('div', 'nk-wf-logline'), 'display: flex; gap: 10px');
      row.appendChild(sty(el('span', null, '>'), 'flex: none; color: #0B7A58'));
      row.appendChild(el('span', null, lines[logShown].text));
      host.appendChild(row);
      logShown++;
    }
    host.scrollTop = host.scrollHeight;
  }

  /* ---- the stage text and the counters ---------------------------------- */

  function hours(h) { return h + (h === 1 ? ' hour' : ' hours'); }

  /* Depends on the stage alone, so it is written once per stage, not per tick. */
  function paintStage(idx) {
    var s = marks[idx].stage;
    var aut = D.autonomy[s.autonomy] || D.autonomy.agent;
    var t = tone(aut.tone);
    var built = s.status === 'running';

    set('wf-stage-num', 'Stage ' + (s.n === 2.5 ? '2, continued' : s.n));
    set('wf-stage-name', s.name);
    set('wf-stage-head', s.head);
    set('wf-stage-body', s.body);
    set('wf-stage-agent', s.agent + ' agent');
    set('wf-stage-effort', hours(s.manual) + ' by hand, ' + hours(s.assisted) + ' with the agents');

    var autEl = id('wf-stage-autonomy');
    if (autEl) {
      autEl.textContent = aut.label;
      autEl.style.color = t.fg;
      autEl.style.background = t.tint;
    }
    var statusEl = id('wf-stage-status');
    if (statusEl) {
      statusEl.textContent = built ? 'Built and running today' : 'Designed, not built yet';
      statusEl.style.color = built ? '#0B7A58' : '#3D4147';
    }

    var prev = id('wf-prev');
    if (prev) prev.disabled = idx === 0;
    var next = id('wf-next');
    if (next) next.disabled = idx === marks.length - 1;
    markRail(idx);
  }

  function paintCounters(head) {
    var assessed = 755 * progressOf(2, head);
    /* Twelve are found by matching; qualification takes three of them back
       out, because a person confirmed the feature was switched off. */
    var confirmed = 12 * progressOf(2, head);
    if (progressOf(3, head) > 0) confirmed = 12 - 3 * progressOf(3, head);
    var fixed = 9 * progressOf(11, head);
    var decisions = 0;
    [3, 5, 8, 9, 13].forEach(function (n) { decisions += progressOf(n, head); });

    set('wf-stat-assessed', num(assessed));
    set('wf-stat-vulnerable', num(confirmed));
    set('wf-stat-fixed', num(fixed));
    set('wf-stat-decisions', num(decisions));
    set('wf-clock', mmss(head));
  }

  /* ---- the loop --------------------------------------------------------- */

  var head = 0;
  var playing = false;
  var started = false;      /* true once the visitor or the page has pressed play */
  var shownIdx = -1;
  var update = function () {};

  function indexAt(at) {
    for (var i = marks.length - 1; i >= 0; i--) {
      if (at >= marks[i].start) return i;
    }
    return 0;
  }

  function paint() {
    var idx = indexAt(head);
    var mark = marks[idx];
    var p = clamp((head - mark.start) / mark.stage.secs, 0, 1);

    if (idx !== shownIdx) {
      shownIdx = idx;
      update = buildScene(mark.stage);
      paintStage(idx);
    }
    update(p);
    paintRail(idx, p);
    paintCounters(head);
    paintLog(head);
  }

  function setPlaying(on) {
    playing = on;
    if (on) started = true;
    var btn = id('wf-play');
    if (btn) btn.textContent = on ? 'Pause' : (head >= TOTAL ? 'Replay' : 'Play');
  }

  /* Under reduced motion there is no loop to play into a stage, so a seek
     lands on that stage already finished rather than on an empty scene. */
  function seek(i) {
    i = clamp(i, 0, marks.length - 1);
    head = still ? marks[i].end - 0.001 : marks[i].start;
    shownIdx = -1;
    paint();
    if (!still) setPlaying(true);
  }

  buildRail(seek);

  var playBtn = id('wf-play');
  if (playBtn) {
    playBtn.addEventListener('click', function () {
      if (head >= TOTAL) { seek(0); return; }
      setPlaying(!playing);
    });
  }
  var prevBtn = id('wf-prev');
  if (prevBtn) prevBtn.addEventListener('click', function () { seek(indexAt(head) - 1); });
  var nextBtn = id('wf-next');
  if (nextBtn) nextBtn.addEventListener('click', function () { seek(indexAt(head) + 1); });

  /* The hero comparison is the totals of the same data, drawn to scale. */
  set('wf-total', mmss(Math.round(TOTAL)));
  set('wf-manual-total', String(Math.round(D.totals.manual)));
  set('wf-assisted-total', String(Math.round(D.totals.assisted)));
  var assistedBar = id('wf-assisted-bar');
  if (assistedBar && D.totals.manual > 0) {
    assistedBar.style.width = (D.totals.assisted / D.totals.manual * 100) + '%';
  }

  if (still) {
    /* Reduced motion: no loop, so the last stage is shown finished and the
       play control is removed rather than left there doing nothing. */
    head = TOTAL;
    if (playBtn) playBtn.style.display = 'none';
  } else {
    /* The replay starts when it scrolls into view, not behind the visitor's
       back while they are still reading the introduction. */
    var player = id('replay');
    if (player && 'IntersectionObserver' in window) {
      var watcher = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (!entries[i].isIntersecting) continue;
          watcher.disconnect();
          if (!started) setPlaying(true);
          return;
        }
      }, { threshold: 0.3 });
      watcher.observe(player);
    } else {
      setPlaying(true);
    }
  }

  N.run({
    interval: 60,
    blocks: 6,
    onTick: function () {
      if (playing) {
        head += STEP;
        if (head >= TOTAL) { head = TOTAL; setPlaying(false); }
      }
      paint();
    }
  });
})();
