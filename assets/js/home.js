/* Home page: hero run panel, "Agents need context" steps and "How an agent works" steps. */
(function () {
  'use strict';

  var N = window.Netwik;
  var still = N.still;
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

  var S = { t: 0, tab: 0, tabStart: 0, ctx: still ? 3 : 0, ctxStart: 0 };
  var runPanel = N.runPanel($('[data-run-panel]'));

  // How an agent works
  var tabData = [
    { stage: 'Investigating', title: 'It does the legwork.', body: 'The agent reads alarms, tickets and telemetry from the tools you already run. It checks device state, recent changes and past records at the same time.', finding: 'Collecting device state, traffic path, carrier status and the last change on each device.' },
    { stage: 'Proposing', title: 'It shows its working.', body: 'Every diagnosis and proposed next step arrives with the evidence behind it, so an engineer can check it in seconds.', finding: 'Proposed: raise a carrier case and keep traffic on the backup path. Evidence attached.' },
    { stage: 'Waiting for approval', title: 'Your engineer makes the call.', body: 'Nothing that changes the network happens without a named person approving it. The agent then carries out the step and records what it did.', finding: 'Approved by the engineer. Carrier case raised. Ticket updated.' }
  ];
  var howTabs = $$('#how-tabs .nk-tab');
  var howTitle = $('#how-title'), howBody = $('#how-body'), howStage = $('#how-stage');
  var howFinding = $('#how-finding'), howApproval = $('#how-approval');
  var howBars = $$('#how-bars .nk-fill');
  var cellsHost = $('#how-cells'), cells = [];
  for (var i = 0; i < 96; i++) {
    var cell = document.createElement('span');
    cell.className = 'nk-sq';
    cellsHost.appendChild(cell);
    cells.push(cell);
  }

  // Agents need context
  var ctxData = [
    { title: 'Years of experience become playbooks.', body: 'Your best engineer knows which sites are critical and who to call, without looking anything up. That came from shadowing colleagues, living through outages and rolling back failed changes. We write it down.' },
    { title: 'One console for every site.', body: 'What engineers chase across several tools comes together in one site console, with the playbook player built in. The agent sees what a senior engineer would look up.' },
    { title: 'The agent works beside the engineer.', body: 'The agent works the incident alongside your engineer. It reads the context, follows the playbook and suggests the next step, with its evidence.' },
    { title: 'Autonomy, one task at a time.', body: 'As the agent proves itself, you grant it more autonomy, starting with the safest, highest-volume tasks. The agent earns autonomy. You grant it.' }
  ];
  var sayFull = 'The carrier circuit has been flapping since 01:58. The backup network is healthy. I suggest playbook step 5: fail over the site.';
  var ctxTabs = $$('#ctx-tabs .nk-tab');
  var ctxNum = $('#ctx-num'), ctxTitle = $('#ctx-title'), ctxBody = $('#ctx-body');
  var pbDots = $$('#ctx-playbook .nk-dot');
  var chips = $$('#ctx-chips .nk-src');
  var joinBar = $('#ctx-join'), agentSays = $('#ctx-agent'), ladderBar = $('#ctx-ladder-bar');
  var rungs = $$('#ctx-ladder .nk-rung').map(function (r) {
    return { dot: r.querySelector('.nk-rung-dot'), label: r.querySelector('.nk-rung-label') };
  });
  var zones = [$('#ctx-zone1'), $('#ctx-zone2'), $('#ctx-zone3')];

  howTabs.forEach(function (b, i) {
    b.addEventListener('click', function () { S.tab = i; S.tabStart = S.t; render(); });
  });
  ctxTabs.forEach(function (b, i) {
    b.addEventListener('click', function () { S.ctx = i; S.ctxStart = S.t; render(); });
  });

  function renderHow() {
    var t = S.t;
    var tk = still ? 999 : t - S.tabStart;
    var cur = tabData[S.tab];
    var p = tk / 7;
    howTitle.textContent = N.scramble(cur.title, p);
    howBody.textContent = N.scramble(cur.body, p);
    howStage.textContent = cur.stage;
    howFinding.textContent = cur.finding.slice(0, Math.max(0, tk * 2));
    var ac = S.tab === 2 ? '#F5A524' : '#8B9097';
    howApproval.style.color = ac;
    howApproval.style.borderColor = ac;
    howBars.forEach(function (b, i) {
      b.style.width = Math.max(0, Math.min(100, (tk - i * 5) * 6)) + '%';
    });
    var seed = Math.floor(t / 5);
    cells.forEach(function (c, i) {
      var h = (i * 7919 + seed * 104729 + (i ^ seed) * 31) % 97;
      var bg = '#26282C';
      if (!still && h < 5) bg = '#2EE6A6';
      else if (!still && h < 12) bg = '#5A5E65';
      c.style.background = bg;
    });
    howTabs.forEach(function (b, i) {
      var w = 0;
      if (i < S.tab) w = 100;
      if (i === S.tab) w = Math.min(100, Math.round(tk / 60 * 100));
      b.querySelector('.nk-tab-bar').style.width = w + '%';
      b.setAttribute('aria-pressed', i === S.tab ? 'true' : 'false');
    });
  }

  function renderCtx() {
    var ctx = S.ctx;
    var ck = still ? 999 : S.t - S.ctxStart;
    var cp = ck / 7;
    ctxNum.textContent = '0' + (ctx + 1) + ' / 04';
    ctxTitle.textContent = N.scramble(ctxData[ctx].title, cp);
    ctxBody.textContent = N.scramble(ctxData[ctx].body, cp);
    pbDots.forEach(function (d, i) {
      d.style.background = ctx > 0 || ck >= i * 7 ? '#2EE6A6' : '#3A3D42';
    });
    var lit = ctx > 1 ? 5 : ctx === 1 ? Math.min(5, Math.floor(ck / 7) + 1) : 0;
    chips.forEach(function (c, i) {
      var on = i < lit;
      c.style.color = on ? '#F2F3F5' : '#8B9097';
      c.style.borderColor = on ? '#2EE6A6' : '#2A2C30';
    });
    joinBar.style.width = (lit * 20) + '%';
    agentSays.textContent = ctx > 2 ? sayFull : ctx === 2 ? sayFull.slice(0, ck * 3) : 'Waiting for context.';
    var reached = ctx === 3 ? Math.min(4, Math.floor(ck / 8) + 1) : 0;
    rungs.forEach(function (r, i) {
      r.dot.style.background = i < reached ? '#2EE6A6' : '#3A3D42';
      r.label.style.color = i < reached ? '#F2F3F5' : '#8B9097';
    });
    ladderBar.style.width = (reached <= 1 ? 0 : (reached - 1) * 20) + '%';
    zones.forEach(function (z, i) { z.style.opacity = ctx >= i + 1 ? '1' : '0.35'; });
    ctxTabs.forEach(function (b, i) {
      var w = 0;
      if (i < ctx) w = 100;
      if (i === ctx) w = Math.min(100, Math.round(ck / 58 * 100));
      b.querySelector('.nk-tab-bar').style.width = w + '%';
      b.setAttribute('aria-pressed', i === ctx ? 'true' : 'false');
    });
  }

  // What we build: layers light up from the bottom
  var layers = $$('#build-layers .nk-layer');
  function renderBuild() {
    var phase = still ? 3 : Math.floor(S.t / 20) % 5;
    layers.forEach(function (l) {
      l.classList.toggle('is-lit', Number(l.getAttribute('data-layer')) <= phase);
    });
  }

  // How you start: progress bars fill one after another
  var startBars = $$('#start-steps .nk-fill');
  function renderStart() {
    var sp = still ? 999 : S.t % 110;
    startBars.forEach(function (b, i) {
      b.style.width = Math.max(0, Math.min(100, Math.round((sp - i * 25) / 25 * 100))) + '%';
    });
  }

  function render() {
    renderBuild();
    renderHow();
    renderCtx();
    renderStart();
  }

  N.run({
    interval: 120,
    blocks: 12,
    onTick: function (t) {
      S.t = t;
      if (!still) {
        if (t - S.tabStart >= 60) { S.tab = (S.tab + 1) % 3; S.tabStart = t; }
        if (t - S.ctxStart >= 58) { S.ctx = (S.ctx + 1) % 4; S.ctxStart = t; }
      }
      render();
      runPanel(t);
    }
  });
})();
