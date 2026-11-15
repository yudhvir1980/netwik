/* workflow.html: an interactive run of the zero-day vulnerability flow.
 *
 * The visitor picks a vendor and a kind of flaw and publishes the alert. The
 * fourteen steps then run once, one after another, and stop wherever a person
 * has to decide; the visitor makes that decision with a button. When the run
 * is complete nothing moves any more, and every step can be opened to read
 * what the agent did, its output, and the human action.
 *
 * State lives in one `run` object: which scenario, which step, how far
 * through it, and the decisions made so far. The one tick loop every page
 * shares advances it; nothing else does, apart from the buttons. Under
 * reduced motion there is no loop, so each press runs straight to the next
 * decision, or to the end.
 *
 * The detail panel is rebuilt only when a different step is shown. It then
 * gets update(p, mode) calls, mode being 'live', 'waiting' or 'final'.
 *
 * Nodes are built with el(), which sets textContent, so no value is ever
 * interpolated into markup.
 */
(function () {
  'use strict';

  var D = window.NetwikFlow;
  var N = window.Netwik;
  if (!D || !N) return;

  var TICK = 0.06;          /* seconds per tick, matching interval 60 */
  var STEP_SECS = 4.2;      /* how long a step takes to run */
  var GRID_SECS = 6;        /* the device check has more to show */
  var HOLD_TICKS = 16;      /* a pause on a decision's outcome before moving on */
  var still = N.still;
  var LINE = '#E2E4E7';

  /* fg is text on white, solid is a fill, mid is that fill not yet reached,
     tint is a quiet background. */
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
  /* Hides a node without losing the display value its inline style gave it. */
  function show(node, on) {
    if (node.wfDisplay === undefined) node.wfDisplay = node.style.display;
    node.style.display = on ? node.wfDisplay : 'none';
  }

  function set(elementId, text) {
    var node = id(elementId);
    if (node) node.textContent = text;
  }

  function num(value) {
    return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function label(text) {
    return sty(el('div', null, text), 'font-size: 13px; font-weight: 600; color: #5B6068; margin: 26px 0 10px');
  }

  /* ---- state ------------------------------------------------------------ */

  var pick = { vendor: D.vendors[0].key, flaw: D.flaws[0].key };
  var preview = D.build(pick.vendor, pick.flaw);

  /* null until the alert is published. */
  var run = null;
  var shown = { run: null, view: -2 };
  var update = function () {};

  function busy() { return !!run && run.phase !== 'done'; }
  function steps() { return (run ? run.scenario : preview).steps; }

  /* ---- blocks: the things a step can show ------------------------------- */

  function blockList(host, block) {
    if (block.title) host.appendChild(label(block.title));
    var list = sty(el('div'), 'border-top: 1px solid ' + LINE);
    block.rows.forEach(function (r) {
      var t = tone(r.tone);
      var wrap = sty(el('div'),
        'padding: 12px 0; border-bottom: 1px solid ' + LINE + '; display: flex; align-items: flex-start; gap: 12px');
      wrap.appendChild(sty(el('span'),
        'flex: none; width: 8px; height: 8px; margin-top: 8px; background: ' + t.solid));
      var left = sty(el('div'), 'flex: 1 1 auto; min-width: 0');
      left.appendChild(sty(el('div', null, r.label), 'font-size: 16px; font-weight: 500; color: #0A0A0B'));
      if (r.sub) {
        left.appendChild(sty(el('div', null, r.sub), 'font-size: 15px; line-height: 1.4; color: #5B6068; margin-top: 2px'));
      }
      wrap.appendChild(left);
      wrap.appendChild(sty(el('span', null, r.value),
        'flex: none; margin-top: 2px; font-size: 13px; font-weight: 500; padding: 3px 9px; white-space: nowrap; color: '
        + t.fg + '; background: ' + t.tint));
      list.appendChild(wrap);
    });
    host.appendChild(list);
  }

  function blockNumbers(host, block) {
    var wrap = sty(el('div'), 'display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px');
    block.items.forEach(function (it) {
      var cell = sty(el('div'),
        'flex: 1 1 120px; box-sizing: border-box; min-width: 0; border: 1px solid ' + LINE + '; background: #FFFFFF; padding: 14px 16px');
      cell.appendChild(sty(el('div', null, num(it.value)),
        'font-size: 32px; line-height: 1; letter-spacing: -.035em; font-variant-numeric: tabular-nums; color: '
        + (it.tone ? tone(it.tone).fg : '#0A0A0B')));
      cell.appendChild(sty(el('div', null, it.label),
        'font-size: 14px; font-weight: 500; line-height: 1.3; color: #0A0A0B; margin-top: 10px'));
      if (it.sub) cell.appendChild(sty(el('div', null, it.sub), 'font-size: 13px; color: #5B6068; margin-top: 1px'));
      wrap.appendChild(cell);
    });
    host.appendChild(wrap);
  }

  function blockNote(host, block) {
    host.appendChild(sty(el('p', null, block.text),
      'margin: 18px 0 0; padding-left: 14px; border-left: 2px solid #0A0A0B; font-size: 16px; line-height: 1.5; color: #0A0A0B'));
  }

  /* The facts and sections of one document, or of one tab of it. */
  function docBody(host, part) {
    if (part.facts) {
      var dl = sty(el('dl'), 'margin: 0; font-size: 15px; line-height: 1.45');
      part.facts.forEach(function (f, i) {
        var row = sty(el('div'),
          'display: flex; flex-wrap: wrap; gap: 2px 16px; padding: 9px 0' + (i ? '; border-top: 1px solid ' + LINE : ''));
        row.appendChild(sty(el('dt', null, f[0]), 'flex: none; width: 132px; color: #5B6068'));
        row.appendChild(sty(el('dd', null, f[1]), 'margin: 0; flex: 1 1 200px; min-width: 0; font-weight: 500; overflow-wrap: anywhere'));
        dl.appendChild(row);
      });
      host.appendChild(dl);
    }
    (part.sections || []).forEach(function (s, i) {
      var top = (i || part.facts) ? 'margin-top: 14px; padding-top: 14px; border-top: 1px solid ' + LINE : '';
      var sec = sty(el('div'), s.h || !i ? top : 'margin-top: 10px');
      if (s.h) sec.appendChild(sty(el('div', null, s.h), 'font-size: 14px; font-weight: 600; margin-bottom: 4px'));
      if (s.p) sec.appendChild(sty(el('p', null, s.p), 'margin: 0; font-size: 15px; line-height: 1.55; color: #3D4147'));
      if (s.items) {
        var ol = sty(el('ol'), 'margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.55; color: #3D4147');
        s.items.forEach(function (text) { ol.appendChild(el('li', null, text)); });
        sec.appendChild(ol);
      }
      host.appendChild(sec);
    });
  }

  function blockDoc(host, block) {
    host.appendChild(label('Output'));
    var card = sty(el('div'), 'border: 1px solid ' + LINE + '; background: #FFFFFF');
    var head = sty(el('div'),
      'display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; padding: 11px 18px; border-bottom: 1px solid '
      + LINE + '; font-size: 14px');
    head.appendChild(sty(el('span', null, block.title), 'font-weight: 600'));
    head.appendChild(sty(el('span', null, 'Illustrative'), 'color: #5B6068'));
    card.appendChild(head);

    var body = sty(el('div'), 'padding: 8px 18px 16px');
    if (block.tabs) {
      var bar = sty(el('div'), 'display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 18px 0');
      var buttons = [];
      var open = function (k) {
        buttons.forEach(function (b, j) { b.setAttribute('aria-pressed', j === k ? 'true' : 'false'); });
        body.textContent = '';
        docBody(body, block.tabs[k]);
      };
      block.tabs.forEach(function (tab, k) {
        var b = el('button', 'nk-wf-tab', tab.label);
        b.type = 'button';
        b.addEventListener('click', function () { open(k); });
        bar.appendChild(b);
        buttons.push(b);
      });
      card.appendChild(bar);
      open(0);
    } else {
      docBody(body, block);
    }
    card.appendChild(body);
    host.appendChild(card);
  }

  /* 755 squares, one per device. The point of the picture is the ratio.
     Returns a painter taking how far the check has got, 0 to 1. */
  function blockGrid(host, block) {
    var COLOURS = { unseen: '#ECEEF0', front: '#0A0A0B', hot: '#E5484D', dim: '#A9AEB6', clear: '#BFE6D6' };
    var kind = [];
    var i;
    for (i = 0; i < block.total; i++) kind.push('clear');
    for (i = 0; i < block.hot; i++) kind[(i * 61 + 29) % block.total] = 'hot';
    var left = block.dim;
    /* 149 shares no factor with 755, so this visits every square once. */
    for (i = 0; i < block.total && left > 0; i++) {
      var k = (i * 149 + 11) % block.total;
      if (kind[k] === 'clear') { kind[k] = 'dim'; left--; }
    }

    host.appendChild(sty(el('div', null, num(block.total) + ' devices, one square each'),
      'font-size: 14px; color: #5B6068; margin: 26px 0 10px'));
    var grid = el('div', 'nk-wf-grid');
    var cells = [];
    var painted = [];
    for (i = 0; i < block.total; i++) {
      var cell = el('span');
      grid.appendChild(cell);
      cells.push(cell);
      painted.push('');
    }
    host.appendChild(grid);

    var legend = sty(el('div'), 'margin-top: 14px; display: flex; flex-direction: column; gap: 6px');
    block.legend.forEach(function (entry) {
      var row = sty(el('div'), 'display: flex; align-items: baseline; gap: 10px; font-size: 15px; color: #3D4147');
      row.appendChild(sty(el('span'), 'flex: none; width: 9px; height: 9px; background: ' + COLOURS[entry[0]]));
      row.appendChild(el('span', null, entry[1]));
      legend.appendChild(row);
    });
    host.appendChild(legend);

    return function (q) {
      var front = clamp(q, 0, 1) * block.total;
      for (var j = 0; j < cells.length; j++) {
        var colour;
        if (j >= front) colour = COLOURS.unseen;
        else if (j > front - 14 && q < 1) colour = COLOURS.front;
        else colour = COLOURS[kind[j]];
        if (painted[j] !== colour) {
          cells[j].style.background = colour;
          painted[j] = colour;
        }
      }
    };
  }

  /* ---- the detail panel ------------------------------------------------- */

  function buildIdle(host) {
    var box = sty(el('div'), 'max-width: 520px; padding: 24px 0');
    box.appendChild(sty(el('h2', null, 'Nothing has run yet'),
      'margin: 0; font-weight: 500; font-size: clamp(26px, 2.8vw, 34px); line-height: 1.1; letter-spacing: -.035em'));
    box.appendChild(sty(el('p', null,
      'Choose a vendor and a flaw at the top of the page, then publish the alert. The fourteen steps listed here run one after another. Where a person has to decide, the run stops and waits for you.'),
      'margin: 14px 0 22px; font-size: 17px; line-height: 1.5; color: #5B6068'));
    var again = el('button', 'nk-wf-play', 'Publish the alert');
    again.type = 'button';
    again.addEventListener('click', start);
    box.appendChild(again);
    host.appendChild(box);
    return function () {};
  }

  function buildDetail(i) {
    var host = id('wf-detail');
    if (!host) return function () {};
    host.textContent = '';
    if (!run) return buildIdle(host);

    var s = run.scenario.steps[i];
    var aut = D.autonomy[s.autonomy] || D.autonomy.agent;
    var t = tone(aut.tone);
    var built = s.status === 'running';

    var top = sty(el('div'), 'display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px');
    top.appendChild(sty(el('span', null, 'Step ' + s.n), 'font-family: var(--mono); font-size: 13px; color: #5B6068'));
    top.appendChild(sty(el('span', null, aut.label),
      'font-size: 13px; font-weight: 500; padding: 3px 9px; color: ' + t.fg + '; background: ' + t.tint));
    top.appendChild(sty(el('span', null, built ? 'Built and running today' : 'Designed, not built yet'),
      'margin-left: auto; font-size: 14px; font-weight: 500; color: ' + (built ? '#0B7A58' : '#5B6068')));
    host.appendChild(top);

    host.appendChild(sty(el('h2', null, s.name),
      'margin: 14px 0 0; font-weight: 500; font-size: clamp(26px, 2.8vw, 34px); line-height: 1.1; letter-spacing: -.035em'));
    host.appendChild(sty(el('p', null, s.what),
      'margin: 12px 0 0; font-size: 17px; line-height: 1.55; color: #3D4147; max-width: 660px'));

    /* What the agent did, one line at a time while the step runs. */
    host.appendChild(label('What the ' + s.agent + ' agent did'));
    var acts = sty(el('div'), 'display: flex; flex-direction: column; gap: 6px');
    var actRows = s.activity.map(function (text) {
      var row = sty(el('div', 'nk-wf-in'), 'display: flex; align-items: baseline; gap: 10px; font-size: 16px; line-height: 1.45');
      row.appendChild(sty(el('span', null, '✓'), 'flex: none; color: #0B7A58; font-weight: 600'));
      row.appendChild(el('span', null, text));
      acts.appendChild(row);
      return row;
    });
    var working = sty(el('div'), 'display: flex; align-items: center; gap: 10px; font-size: 15px; color: #5B6068; margin-top: 2px');
    working.appendChild(sty(el('span', 'nk-live'), 'flex: none; width: 8px; height: 8px; background: #12B886'));
    working.appendChild(el('span', null, 'Working'));
    acts.appendChild(working);
    host.appendChild(acts);

    /* The human action: a question with buttons, then the answer. */
    var ask = null, answer = null, answerText = null;
    if (s.decision) {
      var d = s.decision;
      ask = sty(el('div', 'nk-wf-in'), 'margin-top: 26px; border: 1px solid #F5A524; background: #FFF6E3; padding: 18px 20px 20px');
      var askTop = sty(el('div'), 'display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 14px');
      askTop.appendChild(sty(el('span', 'nk-live'), 'flex: none; width: 9px; height: 9px; background: #F5A524'));
      askTop.appendChild(sty(el('span', null, 'The run has stopped. A person has to decide'), 'font-weight: 600; color: #8A5300'));
      askTop.appendChild(sty(el('span', null, d.who), 'margin-left: auto; color: #3D4147'));
      ask.appendChild(askTop);
      ask.appendChild(sty(el('p', null, d.ask),
        'margin: 12px 0 0; font-size: clamp(20px, 2.1vw, 24px); font-weight: 500; line-height: 1.25; letter-spacing: -.02em'));
      var choices = sty(el('div'), 'margin-top: 16px; display: flex; flex-wrap: wrap; gap: 10px');
      d.options.forEach(function (o, k) {
        var b = el('button', 'nk-wf-choice');
        b.type = 'button';
        b.appendChild(sty(el('span', null, o.label), 'display: block; font-size: 16px; font-weight: 600'));
        b.appendChild(sty(el('span', null, o.note), 'display: block; font-size: 14px; line-height: 1.35; margin-top: 2px; opacity: .8'));
        b.addEventListener('click', function () { decide(i, k); });
        choices.appendChild(b);
      });
      ask.appendChild(choices);
      ask.appendChild(sty(el('p', null, 'In this demo you answer as the ' + d.who.charAt(0).toLowerCase() + d.who.slice(1) + '.'),
        'margin: 12px 0 0; font-size: 14px; color: #5B6068'));
      host.appendChild(ask);

      answer = sty(el('div', 'nk-wf-in'), 'margin-top: 26px; border: 1px solid #12B886; background: #EAF7F1; padding: 16px 20px');
      answer.appendChild(sty(el('div', null, 'Human action: ' + d.who), 'font-size: 14px; font-weight: 600; color: #0B7A58'));
      answer.appendChild(sty(el('div', null, d.ask), 'font-size: 15px; color: #3D4147; margin-top: 6px'));
      answerText = sty(el('div', null, ''), 'font-size: 17px; font-weight: 500; line-height: 1.45; margin-top: 6px');
      answer.appendChild(answerText);
      host.appendChild(answer);
    }

    /* The output. */
    var out = el('div', 'nk-wf-in');
    var grids = [];
    s.blocks.forEach(function (block) {
      if (block.kind === 'doc') blockDoc(out, block);
      else if (block.kind === 'list') blockList(out, block);
      else if (block.kind === 'numbers') blockNumbers(out, block);
      else if (block.kind === 'note') blockNote(out, block);
      else if (block.kind === 'grid') grids.push(blockGrid(out, block));
    });
    host.appendChild(out);

    var hasGrid = grids.length > 0;

    return function (p, mode) {
      var live = mode === 'live';
      var n = actRows.length;
      actRows.forEach(function (row, k) {
        show(row, !live || p >= (k + 1) / (n + 1) * 0.62);
      });
      show(working, live && p < 0.66);
      /* A grid step shows its picture from the start, filling as it checks. */
      show(out, !live || hasGrid || p >= 0.66);
      grids.forEach(function (paint) { paint(live ? p / 0.6 : 1); });

      if (ask) {
        var made = run.decisions[i];
        var decided = made !== undefined;
        show(ask, mode === 'waiting' && !decided);
        show(answer, decided);
        if (decided) answerText.textContent = s.decision.options[made].outcome;
      }
    };
  }

  /* ---- the step list ---------------------------------------------------- */

  var rows = [];

  function buildSteps() {
    var host = id('wf-steps');
    if (!host) return;
    host.textContent = '';
    rows = [];
    steps().forEach(function (s, i) {
      var aut = D.autonomy[s.autonomy] || D.autonomy.agent;
      var row = el('button', 'nk-wf-step');
      row.type = 'button';
      var mark = el('span', 'nk-wf-mark');
      row.appendChild(mark);
      row.appendChild(el('span', 'nk-wf-stepnum', s.n));
      row.appendChild(el('span', 'nk-wf-stepname', s.name));
      var state = el('span', 'nk-wf-stepstate', '');
      row.appendChild(state);
      row.addEventListener('click', function () {
        if (!run || (run.phase !== 'done' && i > run.idx)) return;
        run.view = i;
        /* Looking back at a finished step stops the view following the run. */
        run.follow = i === run.idx;
        paint();
      });
      host.appendChild(row);
      rows.push({ row: row, mark: mark, state: state, tone: tone(aut.tone), name: s.name, n: s.n });
    });
  }

  function paintSteps() {
    var host = id('wf-steps');
    rows.forEach(function (r, i) {
      var st = 'todo';
      if (run) {
        if (run.phase === 'done' || i < run.idx) st = 'done';
        else if (i === run.idx) st = run.phase === 'waiting' ? 'waiting' : 'running';
      }
      var words = { todo: '', running: 'Running', waiting: 'Needs a person', done: 'Done' }[st];
      if (r.state.textContent !== words) r.state.textContent = words;
      r.state.style.color = st === 'waiting' ? '#8A5300' : (st === 'running' ? '#0A0A0B' : '#5B6068');
      r.row.setAttribute('data-state', st);
      r.row.disabled = !(run && (run.phase === 'done' || i <= run.idx));
      r.row.setAttribute('aria-label', 'Step ' + r.n + ', ' + r.name + (words ? '. ' + words : ''));
      r.mark.style.background = st === 'todo' ? r.tone.mid : r.tone.solid;
      r.mark.className = 'nk-wf-mark' + (st === 'running' || st === 'waiting' ? ' nk-live' : '');

      var current = !!run && i === run.view;
      if (current) r.row.setAttribute('aria-current', 'step');
      else r.row.removeAttribute('aria-current');
      /* On a phone the list is one scrolling row, so keep the step in sight. */
      if (current && host && host.scrollWidth > host.clientWidth) {
        host.scrollLeft = r.row.offsetLeft - host.offsetLeft - host.clientWidth / 2 + r.row.offsetWidth / 2;
      }
    });
  }

  /* ---- the run bar and the counters ------------------------------------- */

  function paintBar() {
    var title = id('wf-run-title');
    var sc = run ? run.scenario : preview;
    if (title) title.textContent = sc.vendor.name + ': ' + sc.flaw.label.toLowerCase();

    var state = id('wf-run-state');
    var bar = id('wf-progress');
    var total = steps().length;
    var text = 'Not started', colour = '#5B6068', done = 0, fill = '#12B886';
    if (run) {
      var s = run.scenario.steps[run.idx];
      if (run.phase === 'done') {
        text = 'Run complete. Choose any step to see what it did.';
        colour = '#0B7A58';
        done = total;
      } else if (run.phase === 'waiting') {
        text = 'Stopped at step ' + s.n + '. Waiting for: ' + s.decision.who;
        colour = '#8A5300';
        fill = '#F5A524';
        done = run.idx + 1;
      } else {
        text = 'Running step ' + s.n + ': ' + s.name;
        colour = '#0A0A0B';
        done = run.idx + clamp(run.p, 0, 1);
      }
    }
    if (state) { state.textContent = text; state.style.color = colour; }
    if (bar) { bar.style.width = (done / total * 100) + '%'; bar.style.background = fill; }

    var reset = id('wf-reset');
    if (reset) show(reset, !!run);
    var trigger = id('wf-trigger');
    if (trigger) {
      trigger.disabled = busy();
      trigger.textContent = busy() ? 'Run in progress' : (run ? 'Publish a new alert' : 'Publish the alert');
    }
  }

  function paintCounters() {
    var c = { checked: 0, risk: 0, fixed: 0 };
    var decisions = 0;
    if (run) {
      run.scenario.steps.forEach(function (s, i) {
        var finished = run.phase === 'done' || i < run.idx || (i === run.idx && run.hold > 0);
        if (run.decisions[i] !== undefined) decisions++;
        if (!finished || !s.after) return;
        for (var key in s.after) {
          if (Object.prototype.hasOwnProperty.call(s.after, key)) c[key] = s.after[key];
        }
      });
    }
    set('wf-stat-checked', num(c.checked));
    set('wf-stat-risk', num(c.risk));
    set('wf-stat-fixed', num(c.fixed));
    set('wf-stat-decisions', num(decisions));
  }

  /* ---- the scenario picker ---------------------------------------------- */

  var chipSets = [];

  function buildPicker(hostId, options, field) {
    var host = id(hostId);
    if (!host) return;
    var chips = options.map(function (o) {
      var chip = el('button', 'nk-chip', o.label);
      chip.type = 'button';
      chip.addEventListener('click', function () {
        if (busy()) return;
        pick[field] = o.key;
        paintPicker();
      });
      host.appendChild(chip);
      return { chip: chip, key: o.key };
    });
    chipSets.push({ chips: chips, field: field });
  }

  function paintPicker() {
    preview = D.build(pick.vendor, pick.flaw);
    chipSets.forEach(function (set_) {
      set_.chips.forEach(function (c) {
        c.chip.setAttribute('aria-pressed', c.key === pick[set_.field] ? 'true' : 'false');
        c.chip.disabled = busy();
      });
    });
    set('wf-flaw-plain', preview.flaw.plain);
    set('wf-alert-title', preview.alert.title);
    set('wf-alert-vendor', preview.alert.vendor);
    set('wf-alert-severity', preview.alert.severity);
    set('wf-alert-attacked', preview.alert.attacked);
    set('wf-alert-ref', preview.alert.ref);
    set('wf-real', preview.real
      ? 'The device numbers in this scenario are real. They come from a match against a live instance.'
      : 'The device numbers in this scenario are made up, to show how the flow changes. Only Cisco with the login bypass uses real numbers.');
    if (!run) { buildSteps(); paint(); }
  }

  /* ---- running ---------------------------------------------------------- */

  function paint() {
    var view = run ? run.view : -1;
    if (shown.run !== run || shown.view !== view) {
      shown = { run: run, view: view };
      update = buildDetail(view);
    }
    if (run) {
      var mode = 'final';
      if (run.phase !== 'done' && view === run.idx) {
        mode = run.phase === 'waiting' ? 'waiting' : (run.hold > 0 ? 'final' : 'live');
      }
      update(run.p, mode);
    }
    paintSteps();
    paintBar();
    paintCounters();
  }

  /* The current step has finished its work. Stop for a person, or move on. */
  function finishStep() {
    var s = run.scenario.steps[run.idx];
    if (s.decision && run.decisions[run.idx] === undefined) {
      run.phase = 'waiting';
      run.p = 1;
      return;
    }
    if (run.idx >= run.scenario.steps.length - 1) {
      run.phase = 'done';
      run.p = 1;
      run.hold = 0;
      return;
    }
    run.idx += 1;
    if (run.follow) run.view = run.idx;
    run.p = 0;
    run.hold = 0;
  }

  /* Without a tick loop, run straight to the next decision or to the end. */
  function runThrough() {
    while (run.phase === 'running') finishStep();
  }

  function decide(i, choice) {
    if (!run || run.phase !== 'waiting' || i !== run.idx) return;
    run.decisions[i] = choice;
    run.phase = 'running';
    run.hold = HOLD_TICKS;
    if (still) runThrough();
    paint();
  }

  function start() {
    if (busy()) return;
    run = {
      scenario: D.build(pick.vendor, pick.flaw),
      idx: 0, view: 0, follow: true, p: 0, hold: 0,
      phase: 'running',
      decisions: {}
    };
    buildSteps();
    if (still) runThrough();
    paintPicker();
    paint();
    var section = id('run');
    if (section && section.scrollIntoView) {
      section.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function reset() {
    run = null;
    paintPicker();
    var setup = id('setup');
    if (setup && setup.scrollIntoView) {
      setup.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function tick() {
    if (!run || run.phase !== 'running') return;
    if (run.hold > 0) {
      run.hold -= 1;
      if (run.hold === 0) finishStep();
    } else {
      var hasGrid = run.scenario.steps[run.idx].blocks.some(function (b) { return b.kind === 'grid'; });
      run.p += TICK / (hasGrid ? GRID_SECS : STEP_SECS);
      if (run.p >= 1) finishStep();
    }
    paint();
  }

  buildPicker('wf-vendors', D.vendors, 'vendor');
  buildPicker('wf-flaws', D.flaws, 'flaw');

  var trigger = id('wf-trigger');
  if (trigger) trigger.addEventListener('click', start);
  var resetBtn = id('wf-reset');
  if (resetBtn) resetBtn.addEventListener('click', reset);

  paintPicker();

  N.run({ interval: 60, blocks: 6, onTick: tick });
})();
