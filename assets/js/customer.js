/* customer.html: the made-up company behind the demos.
 *
 * Everything on the page is built from customer-data.js. Nothing here moves
 * by itself: the only state is which kind of site and which site are picked,
 * and the buttons are the only things that change it.
 *
 * Like use-cases.js, this file never uses innerHTML. Nodes come from el() and
 * svg(), which set textContent and attributes.
 */
(function () {
  'use strict';

  var N = window.Netwik;
  var D = window.NetwikCustomer;
  if (!N || !D) return;

  var LINE = '#E2E4E7';
  var TONES = {
    ink: { fg: '#0A0A0B', solid: '#0A0A0B', tint: '#EEF0F2' },
    green: { fg: '#0B7A58', solid: '#12B886', tint: '#DFF3EB' },
    amber: { fg: '#8A5300', solid: '#F5A524', tint: '#FCEBC8' },
    blue: { fg: '#2F4EB2', solid: '#3E63DD', tint: '#E4EAFB' },
    grey: { fg: '#5B6068', solid: '#8B9097', tint: '#EEF0F2' }
  };
  function tone(name) { return TONES[name] || TONES.grey; }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function sty(node, css) { node.setAttribute('style', css); return node; }
  function id(name) { return document.getElementById(name); }
  function svg(tag, attrs) {
    var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var key in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, key)) node.setAttribute(key, attrs[key]);
    }
    return node;
  }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function swatch(colour, size) {
    return sty(el('span'), 'flex: none; display: inline-block; width: ' + size + 'px; height: ' + size + 'px; background: ' + colour);
  }

  var tierByKey = {};
  D.tiers.forEach(function (t) { tierByKey[t.key] = t; });

  var pick = { tier: null, site: null };
  var painters = [];
  function paint() { painters.forEach(function (fn) { fn(); }); }

  /* ---- the headline numbers --------------------------------------------- */

  function buildStats() {
    var host = id('cu-stats');
    if (!host) return;
    var p = D.profile;
    [
      [num(p.employees), 'people'],
      [p.revenue, 'revenue a year'],
      [p.sites, 'sites'],
      [p.regions, 'regions'],
      [p.regulated, 'regulated plants'],
      [p.hq, 'head office']
    ].forEach(function (row) {
      var cell = el('div', 'nk-cu-stat');
      cell.appendChild(el('div', 'nk-cu-statnum', row[0]));
      cell.appendChild(el('div', 'nk-cu-statlabel', row[1]));
      host.appendChild(cell);
    });
  }

  /* ---- the kinds of site, as filter chips ------------------------------- */

  function buildTierChips() {
    var host = id('cu-tier-chips');
    if (!host) return;
    var chips = [{ key: null, label: 'All ' + D.sites.length + ' sites' }].concat(D.tiers.map(function (t) {
      return { key: t.key, label: t.name + ' · ' + t.count, colour: tone(t.tone).solid };
    })).map(function (c) {
      var chip = el('button', 'nk-chip nk-cu-chip');
      chip.type = 'button';
      if (c.colour) chip.appendChild(swatch(c.colour, 10));
      chip.appendChild(el('span', null, c.label));
      chip.addEventListener('click', function () {
        pick.tier = c.key;
        if (pick.site !== null && c.key && D.sites[pick.site].tier !== c.key) pick.site = null;
        paint();
      });
      host.appendChild(chip);
      return { chip: chip, key: c.key };
    });
    painters.push(function () {
      chips.forEach(function (c) {
        c.chip.setAttribute('aria-pressed', c.key === pick.tier ? 'true' : 'false');
      });
    });
  }

  /* ---- the map ---------------------------------------------------------- */

  var CELL = 10;

  /* Sites in the same city would sit on top of each other, so nudge them
     apart. The map is coarse enough that a few pixels do not mislead. */
  function place() {
    var L = D.land;
    var pts = D.sites.map(function (s) {
      return { x: (s.lon - L.lon0) / L.step * CELL, y: (L.lat0 - s.lat) / L.step * CELL };
    });
    var MIN = 17;
    for (var round = 0; round < 80; round++) {
      for (var a = 0; a < pts.length; a++) {
        for (var b = a + 1; b < pts.length; b++) {
          var dx = pts[b].x - pts[a].x, dy = pts[b].y - pts[a].y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d >= MIN) continue;
          if (d < 0.01) { dx = Math.cos(a + b); dy = Math.sin(a + b); d = 1; }
          var push = (MIN - d) / 2;
          pts[a].x -= dx / d * push; pts[a].y -= dy / d * push;
          pts[b].x += dx / d * push; pts[b].y += dy / d * push;
        }
      }
    }
    return pts;
  }

  function buildMap() {
    var host = id('cu-map');
    if (!host) return;
    var rows = D.land.rows;
    var w = rows[0].length * CELL, h = rows.length * CELL;
    var root = svg('svg', { viewBox: '0 0 ' + w + ' ' + h, role: 'img',
      'aria-label': 'A map of the world with a dot for each of the 31 sites. The list below the map holds the same sites.' });

    var land = svg('g', { fill: '#D9DCE0' });
    rows.forEach(function (row, r) {
      for (var c = 0; c < row.length; c++) {
        if (row.charAt(c) !== '#') continue;
        land.appendChild(svg('circle', { cx: c * CELL + CELL / 2, cy: r * CELL + CELL / 2, r: 2.6 }));
      }
    });
    root.appendChild(land);

    var pts = place();
    var dots = [];
    /* Small offices first, so the bigger sites are drawn on top of them. */
    D.sites.map(function (s, i) { return i; }).sort(function (a, b) {
      return D.sites[b].tier < D.sites[a].tier ? -1 : 1;
    }).forEach(function (i) {
      var s = D.sites[i];
      var g = svg('g', { 'class': 'nk-cu-dot' });
      var ring = s.loaded ? svg('circle', { cx: pts[i].x, cy: pts[i].y, r: 11.5, fill: 'none', stroke: '#0A0A0B', 'stroke-width': 1.5 }) : null;
      if (ring) g.appendChild(ring);
      var dot = svg('circle', { cx: pts[i].x, cy: pts[i].y, r: 7, fill: tone(tierByKey[s.tier].tone).solid, stroke: '#FFFFFF', 'stroke-width': 2 });
      g.appendChild(dot);
      var title = svg('title', {});
      title.textContent = s.name + ', ' + tierByKey[s.tier].one.toLowerCase();
      g.appendChild(title);
      g.addEventListener('click', function () { pick.site = pick.site === i ? null : i; paint(); });
      root.appendChild(g);
      dots.push({ g: g, dot: dot, i: i });
    });
    host.appendChild(root);
    /* On a phone the map scrolls sideways. Start it on Europe, where most sites are. */
    host.scrollLeft = (host.scrollWidth - host.clientWidth) * 0.42;

    painters.push(function () {
      dots.forEach(function (d) {
        var s = D.sites[d.i];
        var on = !pick.tier || s.tier === pick.tier;
        var chosen = pick.site === d.i;
        d.g.setAttribute('opacity', on || chosen ? '1' : '0.16');
        d.dot.setAttribute('r', chosen ? 10 : 7);
        d.dot.setAttribute('stroke', chosen ? '#0A0A0B' : '#FFFFFF');
        if (chosen) root.appendChild(d.g);
      });
    });
  }

  /* ---- the card for the chosen site ------------------------------------- */

  function buildSiteCard() {
    var host = id('cu-site');
    if (!host) return;
    var shown = -2;
    painters.push(function () {
      var now = pick.site === null ? -1 : pick.site;
      if (now === shown) return;
      shown = now;
      host.textContent = '';
      if (now < 0) {
        host.appendChild(sty(el('p', null, 'Choose a dot on the map, or a name in the list below, to see what that site is.'),
          'margin: 0; color: #5B6068'));
        return;
      }
      var s = D.sites[now];
      var t = tierByKey[s.tier];
      var c = tone(t.tone);
      var head = sty(el('div'), 'flex: 1 1 240px; min-width: 0');
      head.appendChild(sty(el('span', null, t.one), 'display: inline-block; font-size: 13px; font-weight: 500; padding: 3px 9px; color: ' + c.fg + '; background: ' + c.tint));
      head.appendChild(sty(el('div', null, s.name), 'margin-top: 8px; font-size: 26px; font-weight: 500; letter-spacing: -.03em; line-height: 1.1'));
      head.appendChild(sty(el('div', null, s.place), 'margin-top: 4px; color: #5B6068; font-size: 15px'));
      host.appendChild(head);
      [
        ['People', t.users],
        ['Promised working time', t.target + ' of each month'],
        ['Changes', s.tier === 'T2' ? 'Only in an approved weekend window' : 'In a normal change window'],
        ['In the instance today', s.loaded ? 'Yes, its devices are loaded' : (s.tier === 'T4' ? 'One sales office is, not confirmed which' : 'Not yet')]
      ].forEach(function (row) {
        var cell = sty(el('div'), 'flex: 1 1 150px; min-width: 0');
        cell.appendChild(sty(el('div', null, row[0]), 'font-size: 13px; color: #5B6068'));
        cell.appendChild(sty(el('div', null, row[1]), 'margin-top: 3px; font-size: 15px; font-weight: 500; line-height: 1.35'));
        host.appendChild(cell);
      });
    });
  }

  /* ---- every site by region --------------------------------------------- */

  function buildSiteList() {
    var host = id('cu-sitelist');
    if (!host) return;
    var buttons = [];
    D.regions.forEach(function (r) {
      var col = el('div');
      var mine = [];
      D.sites.forEach(function (s, i) { if (s.region === r.key) mine.push(i); });
      col.appendChild(sty(el('h3', null, r.name), 'margin: 0; font-size: 17px; font-weight: 500'));
      col.appendChild(sty(el('div', null, mine.length + ' sites'), 'font-size: 14px; color: #5B6068; margin-top: 2px'));
      var list = sty(el('div'), 'margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px');
      mine.forEach(function (i) {
        var s = D.sites[i];
        var b = el('button', 'nk-cu-site');
        b.type = 'button';
        b.appendChild(swatch(tone(tierByKey[s.tier].tone).solid, 9));
        b.appendChild(el('span', null, s.name));
        b.setAttribute('aria-label', s.name + ', ' + tierByKey[s.tier].one.toLowerCase());
        b.addEventListener('click', function () { pick.site = pick.site === i ? null : i; paint(); });
        list.appendChild(b);
        buttons.push({ b: b, i: i });
      });
      col.appendChild(list);
      host.appendChild(col);
    });
    painters.push(function () {
      buttons.forEach(function (x) {
        var s = D.sites[x.i];
        x.b.setAttribute('aria-pressed', pick.site === x.i ? 'true' : 'false');
        x.b.style.opacity = !pick.tier || s.tier === pick.tier || pick.site === x.i ? '1' : '0.35';
      });
    });
  }

  /* ---- the five kinds of site ------------------------------------------- */

  function buildTiers() {
    var host = id('cu-tiers');
    if (!host) return;
    D.tiers.forEach(function (t) {
      var c = tone(t.tone);
      var card = sty(el('div'), 'border: 1px solid ' + LINE + '; border-top: 3px solid ' + c.solid + '; padding: 18px 18px 20px; display: flex; flex-direction: column; gap: 10px; min-width: 0');
      var top = sty(el('div'), 'display: flex; align-items: baseline; gap: 10px');
      top.appendChild(sty(el('span', null, t.count), 'font-size: 44px; font-weight: 500; line-height: 1; letter-spacing: -.04em; font-variant-numeric: tabular-nums'));
      top.appendChild(sty(el('span', null, t.name), 'font-size: 17px; font-weight: 500; line-height: 1.2'));
      card.appendChild(top);
      var squares = sty(el('div'), 'display: flex; flex-wrap: wrap; gap: 3px');
      squares.setAttribute('aria-hidden', 'true');
      for (var k = 0; k < t.count; k++) squares.appendChild(swatch(c.solid, 10));
      card.appendChild(squares);
      card.appendChild(sty(el('p', null, t.why), 'margin: 0; font-size: 15px; line-height: 1.45; color: #3D4147'));
      var foot = sty(el('div'), 'margin-top: auto; padding-top: 12px; border-top: 1px solid ' + LINE + '; font-size: 14px; color: #5B6068; line-height: 1.5');
      foot.appendChild(el('div', null, t.users));
      foot.appendChild(el('div', null, t.level + ' service: working ' + t.target + ' of the month'));
      card.appendChild(foot);
      host.appendChild(card);
    });
  }

  /* ---- people, as bars -------------------------------------------------- */

  function buildBars(hostId, rows, colour, extra) {
    var host = id(hostId);
    if (!host) return;
    var total = 0, most = 0;
    rows.forEach(function (r) { total += r.people; if (r.people > most) most = r.people; });
    rows.forEach(function (r) {
      var row = sty(el('div'), 'padding: 12px 0; border-top: 1px solid ' + LINE);
      var top = sty(el('div'), 'display: flex; align-items: baseline; justify-content: space-between; gap: 12px');
      top.appendChild(sty(el('span', null, r.name), 'font-size: 16px; font-weight: 500'));
      top.appendChild(sty(el('span', null, num(r.people) + ' · ' + Math.round(r.people / total * 100) + '%'),
        'flex: none; font-size: 15px; color: #3D4147; font-variant-numeric: tabular-nums'));
      row.appendChild(top);
      var track = sty(el('div'), 'margin-top: 8px; height: 12px; background: #EEF0F2');
      track.appendChild(sty(el('div'), 'height: 100%; width: ' + (r.people / most * 100) + '%; background: ' + colour));
      row.appendChild(track);
      if (extra) row.appendChild(sty(el('div', null, extra(r)), 'margin-top: 6px; font-size: 14px; color: #5B6068'));
      host.appendChild(row);
    });
  }

  /* ---- who does what ---------------------------------------------------- */

  function buildWho() {
    var host = id('cu-who');
    if (host) {
      D.who.forEach(function (w) {
        var c = tone(w.tone);
        var card = sty(el('div'), 'border: 1px solid ' + LINE + '; border-top: 3px solid ' + c.solid + '; padding: 20px 20px 22px; min-width: 0');
        card.appendChild(sty(el('div', null, w.role), 'font-size: 14px; color: ' + c.fg + '; font-weight: 500'));
        card.appendChild(sty(el('h3', null, w.side), 'margin: 4px 0 0; font-size: 26px; font-weight: 500; letter-spacing: -.03em'));
        card.appendChild(sty(el('p', null, w.line), 'margin: 8px 0 0; font-size: 15px; line-height: 1.45; color: #3D4147'));
        var list = sty(el('ul'), 'margin: 14px 0 0; padding: 0; list-style: none');
        w.people.forEach(function (p) {
          list.appendChild(sty(el('li', null, p), 'padding: 8px 0; border-top: 1px solid ' + LINE + '; font-size: 15px; line-height: 1.4'));
        });
        card.appendChild(list);
        host.appendChild(card);
      });
    }

    var path = id('cu-path');
    if (!path) return;
    path.appendChild(sty(el('h3', null, 'The path of one fault'), 'margin: 0 0 14px; font-size: 17px; font-weight: 500'));
    var steps = sty(el('ol', 'nk-cu-steps'), 'margin: 0; padding: 0; list-style: none');
    [
      ['Veridian', 'ink', 'Someone at a plant reports slow Wi-Fi to the service desk'],
      ['Netwik', 'green', 'The operations centre picks it up and works out how many people are affected'],
      ['Netwik', 'green', 'The Wi-Fi engineers find the cause'],
      ['Suppliers', 'grey', 'The maker is called, if the fault is in its equipment'],
      ['Veridian', 'ink', 'The site confirms it is fixed']
    ].forEach(function (s, k) {
      var c = tone(s[1]);
      var li = sty(el('li'), 'border-top: 3px solid ' + c.solid + '; padding: 12px 14px 0 0; min-width: 0');
      li.appendChild(sty(el('div', null, (k + 1) + ' · ' + s[0]), 'font-size: 13px; font-weight: 500; color: ' + c.fg));
      li.appendChild(sty(el('div', null, s[2]), 'margin-top: 4px; font-size: 15px; line-height: 1.4'));
      steps.appendChild(li);
    });
    path.appendChild(steps);
  }

  /* ---- the promises ----------------------------------------------------- */

  function buildLevels() {
    var host = id('cu-levels');
    if (!host) return;
    var levels = {};
    var order = [];
    D.tiers.forEach(function (t) {
      if (!levels[t.level]) { levels[t.level] = { name: t.level, target: t.target, sites: 0, kinds: [] }; order.push(t.level); }
      levels[t.level].sites += t.count;
      levels[t.level].kinds.push(t.name.toLowerCase());
    });
    order.forEach(function (key) {
      var l = levels[key];
      /* What the promise allows to go wrong, in a 30 day month. */
      var mins = Math.round((100 - parseFloat(l.target)) / 100 * 30 * 24 * 60);
      var down = mins < 90 ? mins + ' minutes' : (Math.floor(mins / 60) + ' hours ' + (mins % 60 ? (mins % 60) + ' minutes' : '')).replace(/\s+$/, '');
      var row = sty(el('div'), 'padding: 14px 0; border-top: 1px solid ' + LINE + '; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 18px');
      row.appendChild(sty(el('div', null, l.target), 'flex: none; width: 110px; font-size: 30px; font-weight: 500; letter-spacing: -.035em; line-height: 1; font-variant-numeric: tabular-nums'));
      var body = sty(el('div'), 'flex: 1 1 200px; min-width: 0');
      body.appendChild(sty(el('div', null, l.name + ' · ' + l.sites + ' sites'), 'font-size: 16px; font-weight: 500'));
      body.appendChild(sty(el('div', null, 'For ' + l.kinds.join(', ')), 'font-size: 14px; color: #5B6068; line-height: 1.4'));
      body.appendChild(sty(el('div', null, 'Allows about ' + down + ' of downtime a month'), 'margin-top: 4px; font-size: 14px; color: #3D4147'));
      row.appendChild(body);
      host.appendChild(row);
    });
  }

  function buildPromises() {
    var host = id('cu-promises');
    if (!host) return;
    var table = el('table');
    var head = el('tr');
    ['How serious', 'Answered within', 'Fixed within', 'Clock runs'].forEach(function (h) {
      var th = el('th', null, h);
      th.setAttribute('scope', 'col');
      head.appendChild(th);
    });
    var thead = el('thead');
    thead.appendChild(head);
    table.appendChild(thead);
    var body = el('tbody');
    D.promises.forEach(function (p) {
      var tr = el('tr');
      var th = el('th');
      th.setAttribute('scope', 'row');
      th.appendChild(sty(el('span', null, p.level), 'font-family: var(--mono); font-size: 13px; color: #5B6068; margin-right: 8px'));
      th.appendChild(el('span', null, p.name));
      tr.appendChild(th);
      tr.appendChild(el('td', null, p.respond));
      tr.appendChild(el('td', null, p.fix));
      tr.appendChild(el('td', null, p.hours));
      body.appendChild(tr);
    });
    table.appendChild(body);
    host.appendChild(table);
  }

  buildStats();
  buildTierChips();
  buildMap();
  buildSiteCard();
  buildSiteList();
  buildTiers();
  buildBars('cu-regions', D.regions, '#0A0A0B', function (r) {
    var n = D.sites.filter(function (s) { return s.region === r.key; }).length;
    return n + ' sites';
  });
  buildBars('cu-units', D.units, '#12B886');
  buildWho();
  buildLevels();
  buildPromises();
  paint();

  N.run({ interval: 120, blocks: 6 });
})();
