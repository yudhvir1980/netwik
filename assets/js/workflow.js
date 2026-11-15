/* workflow.html: a replay of the zero-day vulnerability flow, stage by stage.
 *
 * One playhead, measured in seconds of replay time, driven by the single tick
 * loop every page on this site shares. Everything drawn is a pure function of
 * that playhead, so seeking to a stage and playing into it produce the same
 * picture. Clicking a stage moves the playhead; nothing keeps hidden state.
 *
 * Scenes are rebuilt only when the stage changes. Within a stage the scene
 * gets an update(p) call each tick, p running 0 to 1 across the stage.
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

  var TONES = {
    plain: { fg: '#A3A7AE', bar: '#4A4D53' },
    good: { fg: '#2EE6A6', bar: '#12B886' },
    warn: { fg: '#F5A524', bar: '#C97F12' },
    hot: { fg: '#FF6B6E', bar: '#E5484D' }
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

  /* Eases a bar so it settles rather than stopping dead. */
  function ease(p) { return 1 - Math.pow(1 - clamp(p, 0, 1), 3); }

  /* A stagger: row i of n starts at i/n and finishes a third of the way later. */
  function step(p, i, n) {
    var span = 1 / Math.max(1, n);
    return clamp((p - i * span * 0.75) / (span * 1.4), 0, 1);
  }

  function num(value) {
    return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

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

  /* ---- the stage rail --------------------------------------------------- */

  var railRows = [];

  function buildRail(onSeek) {
    var host = id('wf-rail');
    if (!host) return;
    marks.forEach(function (m, i) {
      var s = m.stage;
      var aut = D.autonomy[s.autonomy] || D.autonomy.agent;
      var row = el('button', 'nk-wf-row');
      row.type = 'button';
      row.setAttribute('aria-label', 'Stage ' + s.n + ', ' + s.name);

      var top = sty(el('span'), 'display: flex; align-items: baseline; gap: 10px');
      var numEl = sty(el('span', 'nk-wf-rownum', s.n === 2.5 ? '2b' : String(s.n)),
        'font-family: var(--mono); font-size: 12px; color: #6B7076; flex: none; width: 20px');
      var nameEl = sty(el('span', null, s.name),
        'font-size: 14px; line-height: 1.3; flex: 1 1 auto; min-width: 0');
      top.appendChild(numEl);
      top.appendChild(nameEl);

      var meta = sty(el('span'),
        'display: flex; align-items: center; gap: 8px; padding-left: 30px; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: #6B7076');
      var autEl = sty(el('span', null, aut.label), 'color: ' + tone(aut.tone).fg);
      meta.appendChild(autEl);
      if (s.status === 'running') {
        meta.appendChild(sty(el('span', null, '· live today'), 'color: #6B7076'));
      }

      var bar = sty(el('span', 'nk-wf-rowbar'), 'width: 0');
      var track = sty(el('span'), 'display: block; height: 2px; margin: 8px 0 0 30px; background: #26282C');
      track.appendChild(bar);

      row.appendChild(top);
      row.appendChild(meta);
      row.appendChild(track);
      row.addEventListener('click', function () { onSeek(i); });
      host.appendChild(row);

      railRows.push({ row: row, bar: bar, num: numEl, name: nameEl });
    });
  }

  function paintRail(idx, p) {
    railRows.forEach(function (r, i) {
      var done = i < idx;
      var active = i === idx;
      r.row.setAttribute('aria-current', active ? 'step' : 'false');
      r.row.style.opacity = active ? '1' : (done ? '.72' : '.38');
      r.row.style.background = active ? '#1C2A26' : 'transparent';
      r.row.style.borderLeftColor = active ? '#2EE6A6' : (done ? '#4A4D53' : 'transparent');
      r.num.style.color = active ? '#2EE6A6' : '#6B7076';
      r.bar.style.width = (done ? 100 : (active ? Math.round(p * 100) : 0)) + '%';
      r.bar.style.background = active ? '#2EE6A6' : '#4A4D53';
    });
  }

  /* ---- scenes ----------------------------------------------------------- */

  function sceneShell(host) {
    host.textContent = '';
    return sty(host, 'position: relative; min-height: 300px');
  }

  /* A row of label, sub-label, bar and value. The workhorse of the page. */
  function rowList(host, rows, opts) {
    var options = opts || {};
    var list = sty(el('div'), 'display: flex; flex-direction: column; gap: 2px');
    var built = [];

    rows.forEach(function (r) {
      var t = tone(r.tone);
      var wrap = sty(el('div', 'nk-wf-item'),
        'padding: 13px 0; border-bottom: 1px solid #26282C; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 16px');

      var left = sty(el('div'), 'flex: 1 1 260px; min-width: 0');
      left.appendChild(sty(el('div', null, r.label), 'font-size: 15px; color: #F2F3F5'));
      if (r.sub) {
        left.appendChild(sty(el('div', null, r.sub),
          'font-size: 13px; line-height: 1.4; color: #8B9097; margin-top: 2px'));
      }

      var value = sty(el('div', null, ''),
        'flex: none; font-family: var(--mono); font-size: 13px; color: ' + t.fg);

      wrap.appendChild(left);
      wrap.appendChild(value);

      var track = sty(el('div'), 'flex: 1 1 100%; height: 3px; background: #26282C; margin-top: 4px');
      var bar = sty(el('div'), 'height: 100%; width: 0; background: ' + t.bar);
      track.appendChild(bar);
      wrap.appendChild(track);

      list.appendChild(wrap);
      built.push({ wrap: wrap, bar: bar, value: value, row: r });
    });

    host.appendChild(list);

    return function (p) {
      built.forEach(function (b, i) {
        var q = options.instant ? 1 : step(p, i, built.length);
        b.wrap.style.opacity = String(0.25 + 0.75 * clamp(q * 3, 0, 1));
        b.bar.style.width = (ease(q) * (b.row.bar === undefined ? 1 : b.row.bar) * 100) + '%';
        if (typeof b.row.value === 'number') {
          b.value.textContent = q > 0.02 ? num(b.row.value * ease(q)) : '';
        } else {
          b.value.textContent = q > 0.55 ? b.row.value : '';
        }
      });
    };
  }

  function sceneIntake(host, viz) {
    sceneShell(host);
    var card = sty(el('div'),
      'border: 1px solid #2A2C30; background: #0E0F11; padding: 0');
    var head = sty(el('div'),
      'display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-bottom: 1px solid #2A2C30; font-size: 13px; color: #8B9097');
    head.appendChild(sty(el('span', 'nk-live'), 'width: 7px; height: 7px; background: #E5484D; flex: none'));
    head.appendChild(el('span', null, 'Vendor advisory, inbound'));
    card.appendChild(head);

    var body = sty(el('div'), 'padding: 6px 18px 18px');
    var built = [];
    viz.fields.forEach(function (f) {
      var row = sty(el('div'),
        'display: flex; flex-wrap: wrap; gap: 4px 18px; padding: 11px 0; border-bottom: 1px solid #1E2023');
      row.appendChild(sty(el('span', null, f[0]),
        'flex: none; width: 92px; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: #6B7076'));
      var val = sty(el('span', null, ''),
        'flex: 1 1 200px; min-width: 0; font-family: var(--mono); font-size: 13px; line-height: 1.5; color: #F2F3F5; word-break: break-word');
      row.appendChild(val);
      body.appendChild(row);
      built.push({ row: row, val: val, text: f[1] });
    });
    card.appendChild(body);
    host.appendChild(card);

    var stamp = sty(el('div', null,
      'Checked against every advisory already recorded. No prior record found, so one is created rather than a second investigation into the same flaw.'),
      'margin-top: 16px; font-size: 13px; line-height: 1.5; color: #8B9097');
    host.appendChild(stamp);

    return function (p) {
      built.forEach(function (b, i) {
        var q = step(p, i, built.length);
        b.row.style.opacity = String(0.2 + 0.8 * clamp(q * 4, 0, 1));
        b.val.textContent = q <= 0 ? '' : N.scramble(b.text, clamp(q * 1.3, 0, 1));
      });
      stamp.style.opacity = String(clamp((p - 0.75) * 4, 0, 1));
    };
  }

  function sceneFunnel(host, viz) {
    sceneShell(host);
    var update = rowList(host, viz.rows);

    var sitesWrap = null;
    var siteCells = [];
    if (viz.sites) {
      sitesWrap = sty(el('div'),
        'margin-top: 22px; display: flex; flex-wrap: wrap; gap: 10px');
      viz.sites.forEach(function (s) {
        var cell = sty(el('div'),
          'flex: 1 1 140px; min-width: 0; border: 1px solid #2A2C30; padding: 14px 16px');
        cell.appendChild(sty(el('div', null, s.label),
          'font-family: var(--mono); font-size: 13px; color: #2EE6A6'));
        cell.appendChild(sty(el('div', null, s.sub),
          'font-size: 12px; color: #6B7076; margin-top: 2px'));
        var v = sty(el('div', null, '0'),
          'font-size: 30px; line-height: 1.1; letter-spacing: -.03em; color: #F2F3F5; margin-top: 10px');
        cell.appendChild(v);
        sitesWrap.appendChild(cell);
        siteCells.push({ cell: cell, v: v, target: s.value });
      });
      host.appendChild(sitesWrap);
    }

    return function (p) {
      update(p);
      siteCells.forEach(function (c, i) {
        var q = clamp((p - 0.55 - i * 0.07) * 5, 0, 1);
        c.cell.style.opacity = String(0.2 + 0.8 * q);
        c.cell.style.borderColor = q > 0.9 ? '#2A2C30' : '#1E2023';
        c.v.textContent = num(c.target * ease(q));
      });
    };
  }

  /* 755 squares, one per device, each taking its colour as the sweep reaches
     it. The point of the picture is the ratio: twelve lit cells in a wall. */
  function sceneGrid(host, viz) {
    sceneShell(host);

    var hot = {}, dim = {};
    var i;
    for (i = 0; i < viz.hot; i++) hot[(i * 61 + 29) % viz.total] = true;
    for (i = 0; i < viz.dim; i++) {
      var k = (i * 149 + 11) % viz.total;
      if (!hot[k]) dim[k] = true;
    }

    var grid = sty(el('div', 'nk-wf-grid'), '');
    var cells = [];
    var painted = [];
    for (i = 0; i < viz.total; i++) {
      var cell = el('span');
      grid.appendChild(cell);
      cells.push(cell);
      painted.push('');
    }
    host.appendChild(grid);

    var legend = sty(el('div'),
      'margin-top: 18px; display: flex; flex-direction: column; gap: 9px');
    var legendRows = [];
    viz.legend.forEach(function (entry) {
      var row = sty(el('div'),
        'display: flex; align-items: baseline; gap: 10px; font-size: 13px; color: #8B9097');
      var swatchColour = entry[0] === 'hot' ? '#E5484D' : (entry[0] === 'dim' ? '#3A3D42' : '#1F6B55');
      row.appendChild(sty(el('span'),
        'flex: none; width: 9px; height: 9px; background: ' + swatchColour));
      row.appendChild(el('span', null, entry[1]));
      legend.appendChild(row);
      legendRows.push(row);
    });
    host.appendChild(legend);

    return function (p) {
      var front = clamp(p * 1.15, 0, 1) * viz.total;
      for (var j = 0; j < cells.length; j++) {
        var colour;
        if (j > front) colour = '#1A1B1E';
        else if (j > front - 14) colour = '#2EE6A6';
        else if (hot[j]) colour = '#E5484D';
        else if (dim[j]) colour = '#3A3D42';
        else colour = '#1F6B55';
        /* Only the cells the sweep is crossing change, so the comparison is
           against what was last written rather than the computed style. */
        if (painted[j] !== colour) {
          cells[j].style.background = colour;
          painted[j] = colour;
        }
      }
      legendRows.forEach(function (row, k) {
        row.style.opacity = String(clamp((p - 0.6 - k * 0.08) * 6, 0, 1));
      });
    };
  }

  /* A stage that stops and waits for a person. The waiting is the content. */
  function sceneGate(host, viz) {
    sceneShell(host);

    var banner = sty(el('div'),
      'border: 1px solid #C97F12; background: #1E1708; padding: 16px 18px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px');
    var pip = sty(el('span', 'nk-live'), 'width: 9px; height: 9px; background: #F5A524; flex: none');
    banner.appendChild(pip);
    var bannerText = sty(el('span', null, 'Waiting on a person'),
      'font-size: 14px; color: #F5A524; letter-spacing: .02em');
    banner.appendChild(bannerText);
    var who = sty(el('span', null, viz.who),
      'font-size: 13px; color: #8B9097; margin-left: auto');
    banner.appendChild(who);
    host.appendChild(banner);

    var question = sty(el('p', null, viz.question),
      'margin: 22px 0 0; font-size: clamp(20px, 2.2vw, 26px); line-height: 1.25; letter-spacing: -.02em; color: #F2F3F5');
    host.appendChild(question);

    var opts = sty(el('div'), 'margin-top: 20px; display: flex; flex-wrap: wrap; gap: 10px');
    var optCells = [];
    viz.options.forEach(function (o) {
      var t = tone(o.tone);
      var cell = sty(el('div'),
        'flex: 1 1 200px; min-width: 0; border: 1px solid #2A2C30; padding: 14px 16px');
      cell.appendChild(sty(el('div', null, o.label), 'font-size: 15px; color: ' + t.fg));
      cell.appendChild(sty(el('div', null, o.note),
        'font-size: 13px; line-height: 1.4; color: #8B9097; margin-top: 4px'));
      opts.appendChild(cell);
      optCells.push(cell);
    });
    host.appendChild(opts);

    var answer = sty(el('div'),
      'margin-top: 20px; border-left: 2px solid #2EE6A6; padding: 2px 0 2px 16px');
    answer.appendChild(sty(el('div', null, 'Answered'),
      'font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #2EE6A6'));
    var answerText = sty(el('div', null, ''),
      'font-family: var(--mono); font-size: 13px; line-height: 1.6; color: #F2F3F5; margin-top: 6px; min-height: 2.6em');
    answer.appendChild(answerText);
    host.appendChild(answer);

    return function (p) {
      var answered = p > 0.55;
      pip.style.background = answered ? '#12B886' : '#F5A524';
      pip.className = answered ? '' : 'nk-live';
      bannerText.textContent = answered ? 'Answered, the flow continues' : 'Waiting on a person';
      bannerText.style.color = answered ? '#2EE6A6' : '#F5A524';
      banner.style.borderColor = answered ? '#1F6B55' : '#C97F12';
      banner.style.background = answered ? '#0F1A16' : '#1E1708';
      optCells.forEach(function (cell, i) {
        var q = clamp((p - 0.2 - i * 0.1) * 6, 0, 1);
        cell.style.opacity = String(0.2 + 0.8 * q);
      });
      var typed = clamp((p - 0.6) / 0.3, 0, 1);
      answer.style.opacity = String(clamp(typed * 4, 0, 1));
      answerText.textContent = viz.answer.slice(0, Math.round(viz.answer.length * typed));
    };
  }

  function sceneBoard(host, viz) {
    sceneShell(host);
    var top = sty(el('div'), 'display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 22px');
    var cells = [];
    viz.headline.forEach(function (h) {
      var cell = sty(el('div'),
        'flex: 1 1 130px; min-width: 0; border: 1px solid #2A2C30; padding: 14px 16px');
      var v = sty(el('div', null, '0'),
        'font-size: clamp(28px, 3.4vw, 40px); line-height: 1; letter-spacing: -.04em; color: #F2F3F5');
      cell.appendChild(v);
      cell.appendChild(sty(el('div', null, h.label),
        'font-size: 12px; line-height: 1.35; color: #8B9097; margin-top: 8px'));
      top.appendChild(cell);
      cells.push({ v: v, target: Number(String(h.value).replace(/[^0-9.]/g, '')) || 0, raw: h.value });
    });
    host.appendChild(top);
    var update = rowList(host, viz.rows);

    return function (p) {
      cells.forEach(function (c, i) {
        var q = clamp((p - i * 0.06) * 2.4, 0, 1);
        c.v.textContent = num(c.target * ease(q));
      });
      update(clamp((p - 0.25) / 0.75, 0, 1));
    };
  }

  function buildScene(stage) {
    var host = id('wf-scene');
    if (!host) return function () {};
    var viz = stage.viz;
    if (viz.kind === 'intake') return sceneIntake(host, viz);
    if (viz.kind === 'funnel') return sceneFunnel(host, viz);
    if (viz.kind === 'grid') return sceneGrid(host, viz);
    if (viz.kind === 'gate') return sceneGate(host, viz);
    if (viz.kind === 'board') return sceneBoard(host, viz);
    sceneShell(host);
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
    while (logShown < want) {
      var row = sty(el('div', 'nk-wf-logline'),
        'display: flex; gap: 10px; padding: 2px 0');
      row.appendChild(sty(el('span', null, '>'), 'flex: none; color: #2EE6A6'));
      row.appendChild(el('span', null, lines[logShown].text));
      host.appendChild(row);
      logShown++;
    }
    host.scrollTop = host.scrollHeight;
  }

  /* ---- the header and the counters -------------------------------------- */

  function paintHeader(mark, p) {
    var s = mark.stage;
    var aut = D.autonomy[s.autonomy] || D.autonomy.agent;
    var numEl = id('wf-stage-num');
    if (numEl) numEl.textContent = 'Stage ' + (s.n === 2.5 ? '2, continued' : s.n);
    var nameEl = id('wf-stage-name');
    if (nameEl) nameEl.textContent = s.name;
    var headEl = id('wf-stage-head');
    if (headEl) headEl.textContent = s.head;
    var bodyEl = id('wf-stage-body');
    if (bodyEl) bodyEl.textContent = s.body;
    var agentEl = id('wf-stage-agent');
    if (agentEl) agentEl.textContent = s.agent + ' agent';
    var autEl = id('wf-stage-autonomy');
    if (autEl) {
      autEl.textContent = aut.label;
      autEl.style.color = tone(aut.tone).fg;
      autEl.style.borderColor = tone(aut.tone).bar;
    }
    var statusEl = id('wf-stage-status');
    if (statusEl) {
      statusEl.textContent = s.status === 'running' ? 'Built and running today' : 'Designed, not built yet';
      statusEl.style.color = s.status === 'running' ? '#2EE6A6' : '#8B9097';
    }
    var pb = id('wf-stage-bar');
    if (pb) pb.style.width = Math.round(p * 100) + '%';
  }

  function paintCounters(head) {
    var manual = 0, assisted = 0;
    marks.forEach(function (m) {
      var p = clamp((head - m.start) / m.stage.secs, 0, 1);
      manual += m.stage.manual * p;
      assisted += m.stage.assisted * p;
    });

    var mEl = id('wf-manual');
    if (mEl) mEl.textContent = manual.toFixed(manual < 10 ? 1 : 0);
    var aEl = id('wf-assisted');
    if (aEl) aEl.textContent = assisted.toFixed(assisted < 10 ? 1 : 0);
    var sEl = id('wf-saved');
    if (sEl) {
      var saved = manual > 0 ? Math.round((1 - assisted / manual) * 100) : 0;
      sEl.textContent = saved + '%';
    }

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

    var cEl = id('wf-clock');
    if (cEl) {
      var secs = Math.floor(head);
      cEl.textContent = Math.floor(secs / 60) + ':' + (secs % 60 < 10 ? '0' : '') + (secs % 60);
    }
    var bar = id('wf-bar');
    if (bar) bar.style.width = (head / TOTAL * 100) + '%';
  }

  function set(elementId, text) {
    var node = id(elementId);
    if (node) node.textContent = text;
  }

  /* ---- the loop --------------------------------------------------------- */

  var head = 0;
  var playing = !still;
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
    }
    update(p);
    paintRail(idx, p);
    paintHeader(mark, p);
    paintCounters(head);
    paintLog(head);
  }

  function setPlaying(on) {
    playing = on;
    var btn = id('wf-play');
    if (!btn) return;
    btn.textContent = on ? 'Pause' : (head >= TOTAL ? 'Replay' : 'Play');
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  /* Under reduced motion there is no loop to play into a stage, so a seek
     lands on that stage already finished rather than on an empty scene. */
  function seek(i) {
    head = still ? marks[i].end - 0.001 : marks[i].start;
    shownIdx = -1;
    logShown = 0;
    var host = id('wf-log');
    if (host) host.textContent = '';
    paint();
    if (!still) setPlaying(true);
  }

  buildRail(seek);

  var playBtn = id('wf-play');
  if (playBtn) {
    playBtn.addEventListener('click', function () {
      if (head >= TOTAL) { head = 0; shownIdx = -1; logShown = 0; id('wf-log').textContent = ''; }
      setPlaying(!playing);
    });
  }
  var restartBtn = id('wf-restart');
  if (restartBtn) restartBtn.addEventListener('click', function () { seek(0); });

  var totalEl = id('wf-total');
  if (totalEl) {
    var t = Math.round(TOTAL);
    totalEl.textContent = Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60);
  }
  set('wf-manual-total', String(Math.round(D.totals.manual)));
  set('wf-assisted-total', String(Math.round(D.totals.assisted)));

  if (still) {
    /* Reduced motion: no loop, so the last stage is shown finished and the
       play control is removed rather than left there doing nothing. */
    head = TOTAL;
    paint();
    if (playBtn) playBtn.style.display = 'none';
    if (restartBtn) restartBtn.textContent = 'Back to the first stage';
  } else {
    setPlaying(true);
  }

  N.run({
    interval: 60,
    blocks: 6,
    onTick: function () {
      if (still) return;
      if (playing) {
        head += STEP;
        if (head >= TOTAL) { head = TOTAL; setPlaying(false); }
      }
      paint();
    }
  });
})();
