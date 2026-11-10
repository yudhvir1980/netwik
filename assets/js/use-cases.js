/* Use case catalogue: coverage map, filters and animated cards. */
(function () {
  'use strict';

  var N = window.Netwik;

  var ALL = [
    { proc: 'Incident', title: 'WAN circuit outage triage', text: 'Groups the alarms from one outage, checks the backup path and carrier status, and opens a ticket with the diagnosis.', doms: ['WAN'], hasDetail: true },
    { proc: 'Incident', title: 'Wireless connection complaints', text: 'Works out whether a complaint comes from the access point, the radio environment, authentication or the client device.', doms: ['Wireless'], hasDetail: true },
    { proc: 'Incident', title: 'DNS resolution failures', text: 'Tests resolution from several points, finds the failing server or record, and reports what broke and since when.', doms: ['DDI'], hasDetail: true },
    { proc: 'Incident', title: 'Flapping ports and uplinks', text: 'Reads interface history and error counters to separate a cabling fault from a configuration or hardware fault.', doms: ['LAN'], hasDetail: true },
    { proc: 'Change', title: 'Change request risk review', text: 'Checks each request for a complete plan, a tested rollback, the sites affected and clashes with other changes, then gives the engineer feedback.', doms: ['LAN', 'WAN', 'Wireless', 'DDI'] },
    { proc: 'Change', title: 'Before and after verification', text: 'Captures network state before a change, captures it again afterwards and reports every difference that was not planned.', doms: ['LAN', 'WAN', 'Wireless'] },
    { proc: 'Change', title: 'DNS and DHCP change validation', text: 'Checks a record or scope change for conflicts and overlaps before it is applied.', doms: ['DDI'] },
    { proc: 'Capacity', title: 'Circuit utilisation forecast', text: 'Projects when each circuit will reach its limit and recommends the upgrade to order, with lead time taken into account.', doms: ['WAN'] },
    { proc: 'Capacity', title: 'Address pool exhaustion', text: 'Tracks DHCP scopes and subnets and warns before a site runs out of addresses.', doms: ['DDI'] },
    { proc: 'Capacity', title: 'Wireless density planning', text: 'Finds areas where client numbers are outgrowing the access points that serve them.', doms: ['Wireless'] },
    { proc: 'Release', title: 'Vulnerability to upgrade plan', text: 'Maps a new security advisory to the devices it affects, picks a target software version and proposes a staged rollout.', doms: ['LAN', 'WAN', 'Wireless'] },
    { proc: 'Release', title: 'Software version drift', text: 'Lists devices that have fallen behind the approved software version and groups them into upgrade batches.', doms: ['LAN', 'WAN', 'Wireless'] },
    { proc: 'Availability', title: 'Service level reporting', text: 'Calculates availability per site and service, and attributes each outage to its cause and owner.', doms: ['LAN', 'WAN', 'Wireless', 'DDI'] },
    { proc: 'Availability', title: 'Single point of failure check', text: 'Walks the topology to find sites and services that depend on one device, one link or one carrier.', doms: ['LAN', 'WAN'] },
    { proc: 'Problem', title: 'Recurring incident detection', text: 'Finds incidents that share a device, site, software version or cause and raises them as one problem record.', doms: ['LAN', 'WAN', 'Wireless', 'DDI'] },
    { proc: 'Problem', title: 'Root cause analysis draft', text: 'Assembles the timeline, evidence and likely cause for a major incident, ready for the team to review and correct.', doms: ['LAN', 'WAN', 'Wireless', 'DDI'] }
  ];
  var PROCS = ['All', 'Incident', 'Change', 'Capacity', 'Release', 'Availability', 'Problem'];
  var DOMS = ['All', 'LAN', 'WAN', 'Wireless', 'DDI'];
  var OFF = '#26282C', GREY = '#5A5E65', GREEN = '#2EE6A6', AMBER = '#F5A524', UP = '#1E7D5F';

  var params = new URLSearchParams(window.location.search);
  var S = {
    t: 0,
    proc: PROCS.indexOf(params.get('process')) > 0 ? params.get('process') : 'All',
    dom: DOMS.indexOf(params.get('domain')) > 0 ? params.get('domain') : 'All'
  };

  var matrixHost = document.getElementById('matrix');
  var procHost = document.getElementById('proc-chips');
  var domHost = document.getElementById('dom-chips');
  var grid = document.getElementById('cases');
  var countEl = document.getElementById('count');
  var emptyEl = document.getElementById('empty');
  document.getElementById('reset').addEventListener('click', function () { setState({ proc: 'All', dom: 'All' }); });

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function hash(a, b) { return (((a + 1) * 73856093) ^ ((b + 1) * 19349663)) >>> 0; }

  // Each process has its own little animated picture on its cards.
  function vizColor(procName, idx, i, t) {
    var f = t + idx * 7;
    var r = Math.floor(i / 14);
    var c = i % 14;
    var bg = OFF;
    if (procName === 'Incident') {
      var cy = f % 40;
      var h = hash(i, idx);
      if (cy < 24) { if (h % 6 === 0 && (h >> 4) % 22 < cy) bg = AMBER; }
      else if ((c === 6 || c === 7) && (r === 1 || r === 2)) bg = GREEN;
    } else if (procName === 'Change') {
      var pr = (f % 36) - r * 4;
      if (c < 13 && c <= pr) bg = GREY;
      if (c === 13 && pr >= 13) bg = r === idx % 4 ? AMBER : GREEN;
    } else if (procName === 'Capacity') {
      var ht = (c + 1) / 14 * 2.6 + ((f % 30) / 30) * 1.6;
      if (3 - r < ht) bg = ht >= 4 ? AMBER : GREY;
    } else if (procName === 'Release') {
      var w = Math.floor((f % 44) / 11);
      var g = Math.min(2, Math.floor(c / 5));
      if (g < w) bg = GREEN;
      else if (g === w) bg = r <= ((f % 11) / 2.75) ? GREEN : GREY;
      else bg = GREY;
    } else if (procName === 'Availability') {
      var gap = (hash(r, idx) + Math.floor(f / 3)) % 19;
      bg = c === gap || c === gap - 1 ? AMBER : UP;
    } else {
      var hp = hash(i, idx + 3);
      if (hp % 5 === 0) bg = hp % 3 === 0 && f % 10 < 5 ? GREEN : GREY;
    }
    return bg;
  }

  function renderChips(host, list, key) {
    host.textContent = '';
    list.forEach(function (label) {
      var b = el('button', 'nk-chip', label);
      b.type = 'button';
      b.setAttribute('aria-pressed', S[key] === label ? 'true' : 'false');
      b.addEventListener('click', function () { var p = {}; p[key] = label; setState(p); });
      host.appendChild(b);
    });
  }

  function renderMatrix() {
    Array.prototype.slice.call(matrixHost.querySelectorAll('[data-gen]')).forEach(function (n) { n.remove(); });
    PROCS.slice(1).forEach(function (p) {
      var label = el('span', 'nk-matrix-label', p);
      label.setAttribute('data-gen', '');
      matrixHost.appendChild(label);
      DOMS.slice(1).forEach(function (d) {
        var n = ALL.filter(function (c) { return c.proc === p && c.doms.indexOf(d) !== -1; }).length;
        var node;
        if (n === 0) {
          node = el('span', 'nk-cell-empty');
        } else {
          var sel = S.proc === p && S.dom === d;
          var lit = (S.proc === 'All' || S.proc === p) && (S.dom === 'All' || S.dom === d);
          node = el('button', 'nk-cell');
          node.type = 'button';
          node.setAttribute('aria-label', p + ' use cases for ' + d + ': ' + n);
          node.setAttribute('aria-pressed', sel ? 'true' : 'false');
          for (var k = 0; k < n; k++) {
            var dot = el('span', 'nk-cell-dot');
            dot.style.background = lit ? GREEN : GREY;
            node.appendChild(dot);
          }
          node.addEventListener('click', function () {
            setState(sel ? { proc: 'All', dom: 'All' } : { proc: p, dom: d });
          });
        }
        node.setAttribute('data-gen', '');
        matrixHost.appendChild(node);
      });
    });
  }

  var vizList = [];

  function renderCases() {
    grid.textContent = '';
    vizList = [];
    var shown = 0;
    ALL.forEach(function (c, idx) {
      if (!((S.proc === 'All' || c.proc === S.proc) && (S.dom === 'All' || c.doms.indexOf(S.dom) !== -1))) return;
      shown++;
      var card = el('article', 'nk-card');
      card.style.cssText = 'border: 1px solid #E2E4E7; display: flex; flex-direction: column';

      var viz = el('div', 'nk-viz');
      viz.setAttribute('aria-hidden', 'true');
      var squares = [];
      for (var i = 0; i < 56; i++) { var sq = el('span'); viz.appendChild(sq); squares.push(sq); }
      vizList.push({ proc: c.proc, idx: idx, squares: squares });
      card.appendChild(viz);

      var body = el('div');
      body.style.cssText = 'padding: 22px 24px 24px; display: flex; flex-direction: column; gap: 12px; flex: 1 1 auto';
      var agent = el('div');
      agent.style.cssText = 'display: flex; align-items: center; gap: 10px; font-size: 14px; color: #5B6068';
      var dot = el('span');
      dot.style.cssText = 'flex: none; width: 7px; height: 7px; background: #12B886';
      agent.appendChild(dot);
      agent.appendChild(el('span', null, c.proc + ' agent'));
      body.appendChild(agent);

      var h = el('h2', null, c.title);
      h.style.cssText = 'margin: 0; font-weight: 500; font-size: 24px; line-height: 1.15; letter-spacing: -0.03em';
      body.appendChild(h);
      var p = el('p', null, c.text);
      p.style.cssText = 'margin: 0; color: #5B6068; font-size: 16px';
      body.appendChild(p);

      var foot = el('div');
      foot.style.cssText = 'margin-top: auto; padding-top: 10px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px';
      var tags = el('div');
      tags.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px';
      c.doms.forEach(function (d) { tags.appendChild(el('span', 'nk-tag', d)); });
      foot.appendChild(tags);
      if (c.hasDetail) {
        var a = el('a', null, 'View the agent  →');
        a.href = 'incident-agent.html';
        a.style.cssText = 'font-weight: 500; font-size: 15px; padding: 12px 0';
        foot.appendChild(a);
      }
      body.appendChild(foot);
      card.appendChild(body);
      grid.appendChild(card);
    });
    countEl.textContent = shown === 1 ? '1 use case' : shown + ' use cases';
    emptyEl.hidden = shown !== 0;
    emptyEl.style.display = shown === 0 ? 'flex' : 'none';
    paintViz();
  }

  function paintViz() {
    vizList.forEach(function (v) {
      v.squares.forEach(function (sq, i) { sq.style.background = vizColor(v.proc, v.idx, i, S.t); });
    });
  }

  function syncUrl() {
    var q = new URLSearchParams();
    if (S.proc !== 'All') q.set('process', S.proc);
    if (S.dom !== 'All') q.set('domain', S.dom);
    var qs = q.toString();
    try { window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '')); } catch (e) {}
  }

  function renderAll() {
    renderChips(procHost, PROCS, 'proc');
    renderChips(domHost, DOMS, 'dom');
    renderMatrix();
    renderCases();
  }

  function setState(patch) {
    if (patch.proc !== undefined) S.proc = patch.proc;
    if (patch.dom !== undefined) S.dom = patch.dom;
    // Controls are rebuilt on every change, so put keyboard focus back where it was.
    var active = document.activeElement;
    var refocus = null;
    if (active && active.tagName === 'BUTTON' && active.id !== 'reset') {
      refocus = { parent: active.parentNode.id, label: active.getAttribute('aria-label') || active.textContent };
    }
    syncUrl();
    renderAll();
    if (refocus && refocus.parent) {
      var host = document.getElementById(refocus.parent);
      Array.prototype.slice.call(host.querySelectorAll('button')).some(function (b) {
        if ((b.getAttribute('aria-label') || b.textContent) === refocus.label) { b.focus(); return true; }
        return false;
      });
    }
  }

  renderAll();

  N.run({
    interval: 160,
    blocks: 4,
    onTick: function (t) { S.t = t; paintViz(); }
  });
})();
