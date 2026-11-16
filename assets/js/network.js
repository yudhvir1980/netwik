/* network.html: the network the agents work on.
 *
 * Built from customer-data.js, the same file customer.html reads. The counts
 * under `estate` came from the ServiceNow instance; the per-site designs are
 * the standard design, and the page labels each as what it is.
 *
 * Nothing moves by itself. The only state is which kind of device and which
 * kind of site are picked. No innerHTML: nodes come from el().
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
  /* The colour of each kind of thing in a site drawing. */
  var KIND_TONE = { edge: 'blue', firewall: 'amber', 'switch': 'ink', ap: 'green', controller: 'grey', link: 'grey' };

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function sty(node, css) { node.setAttribute('style', css); return node; }
  function id(name) { return document.getElementById(name); }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function swatch(colour, size) {
    return sty(el('span'), 'flex: none; display: inline-block; width: ' + size + 'px; height: ' + size + 'px; background: ' + colour);
  }
  function set(name, text) { var node = id(name); if (node) node.textContent = text; }

  var E = D.estate;
  var kindByKey = {};
  E.kinds.forEach(function (k) { kindByKey[k.key] = k; });
  var tierByKey = {};
  D.tiers.forEach(function (t) { tierByKey[t.key] = t; });

  var pick = { kind: null, tier: 'T1' };
  var painters = [];
  function paint() { painters.forEach(function (fn) { fn(); }); }

  /* ---- the headline numbers --------------------------------------------- */

  function buildStats() {
    var host = id('nw-stats');
    if (!host) return;
    var rows = [[num(E.total), 'Devices in all']];
    E.kinds.forEach(function (k) { rows.push([num(k.count), k.name]); });
    rows.push([E.sites, 'Sites in the instance']);
    rows.forEach(function (row) {
      var cell = el('div', 'nk-cu-stat');
      cell.appendChild(el('div', 'nk-cu-statnum', row[0]));
      cell.appendChild(el('div', 'nk-cu-statlabel', row[1]));
      host.appendChild(cell);
    });
  }

  /* ---- one square for every device -------------------------------------- */

  function buildGrid() {
    var chipHost = id('nw-kind-chips');
    var host = id('nw-grid');
    var legend = id('nw-kinds');
    if (!host) return;

    /* The few important devices first, then the many. */
    var order = E.kinds.slice().sort(function (a, b) { return a.count - b.count; });
    var cells = [];
    order.forEach(function (k) {
      for (var n = 0; n < k.count; n++) {
        var cell = el('span');
        cell.style.background = tone(k.tone).solid;
        host.appendChild(cell);
        cells.push({ node: cell, key: k.key });
      }
    });

    var chips = [];
    if (chipHost) {
      [{ key: null, label: 'All ' + num(E.total) }].concat(order.map(function (k) {
        return { key: k.key, label: k.name + ' · ' + num(k.count), colour: tone(k.tone).solid };
      })).forEach(function (c) {
        var chip = el('button', 'nk-chip nk-cu-chip');
        chip.type = 'button';
        if (c.colour) chip.appendChild(swatch(c.colour, 10));
        chip.appendChild(el('span', null, c.label));
        chip.addEventListener('click', function () { pick.kind = c.key; paint(); });
        chipHost.appendChild(chip);
        chips.push({ chip: chip, key: c.key });
      });
    }

    var cards = [];
    if (legend) {
      order.forEach(function (k) {
        var c = tone(k.tone);
        var card = sty(el('div'), 'border-top: 3px solid ' + c.solid + '; padding-top: 12px; min-width: 0');
        var top = sty(el('div'), 'display: flex; align-items: baseline; gap: 10px');
        top.appendChild(sty(el('span', null, num(k.count)), 'font-size: 34px; font-weight: 500; line-height: 1; letter-spacing: -.035em; font-variant-numeric: tabular-nums'));
        var share = k.count / E.total * 100;
        top.appendChild(sty(el('span', null, (share < 10 ? share.toFixed(1) : Math.round(share)) + '%'), 'font-size: 15px; color: #5B6068'));
        card.appendChild(top);
        card.appendChild(sty(el('div', null, k.name), 'margin-top: 6px; font-size: 16px; font-weight: 500'));
        card.appendChild(sty(el('div', null, k.does), 'margin-top: 2px; font-size: 14px; line-height: 1.4; color: #5B6068'));
        legend.appendChild(card);
        cards.push({ card: card, key: k.key });
      });
    }

    painters.push(function () {
      cells.forEach(function (c) { c.node.style.opacity = !pick.kind || c.key === pick.kind ? '1' : '0.12'; });
      chips.forEach(function (c) { c.chip.setAttribute('aria-pressed', c.key === pick.kind ? 'true' : 'false'); });
      cards.forEach(function (c) { c.card.style.opacity = !pick.kind || c.key === pick.kind ? '1' : '0.4'; });
    });

    set('nw-controllers', 'Not in the ' + num(E.total) + ': ' + E.controllers + ' Wi-Fi controllers, which manage the access points. The instance records them differently, so the agents count them separately.');
  }

  /* ---- how one site is put together ------------------------------------- */

  function buildDesign() {
    var chipHost = id('nw-tier-chips');
    var host = id('nw-design');
    if (!host) return;

    var chips = [];
    if (chipHost) {
      D.tiers.forEach(function (t) {
        var chip = el('button', 'nk-chip nk-cu-chip');
        chip.type = 'button';
        chip.appendChild(el('span', null, t.one));
        chip.addEventListener('click', function () { pick.tier = t.key; paint(); });
        chipHost.appendChild(chip);
        chips.push({ chip: chip, key: t.key });
      });
    }

    var shown = null;
    painters.push(function () {
      chips.forEach(function (c) { c.chip.setAttribute('aria-pressed', c.key === pick.tier ? 'true' : 'false'); });
      if (shown === pick.tier) return;
      shown = pick.tier;
      host.textContent = '';
      var t = tierByKey[pick.tier];
      var rows = D.designs[pick.tier];
      var devices = 0, aps = 0;
      rows.forEach(function (r) {
        if (r.kind === 'ap') aps += r.n;
        else if (r.kind !== 'link') devices += r.n;
      });

      var head = sty(el('div'), 'display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 16px; padding-bottom: 16px');
      head.appendChild(sty(el('span', null, 'One ' + t.one.toLowerCase()),
        'font-size: 26px; font-weight: 500; letter-spacing: -.03em'));
      head.appendChild(sty(el('span', null, devices + ' devices' + (aps ? ' and ' + aps + ' access points' : '') + ' · ' + t.count + ' sites like this in the design'),
        'font-size: 15px; color: #5B6068'));
      host.appendChild(head);

      rows.forEach(function (r) {
        var c = tone(KIND_TONE[r.kind]);
        var row = el('div', 'nk-cu-drow');
        var left = el('div', 'nk-cu-dname');
        left.appendChild(sty(el('div', null, r.name), 'font-size: 16px; font-weight: 500'));
        if (r.note) left.appendChild(sty(el('div', null, r.note), 'font-size: 14px; color: #5B6068; line-height: 1.4; margin-top: 2px'));
        row.appendChild(left);
        row.appendChild(sty(el('div', 'nk-cu-dnum', r.n ? num(r.n) : 'None'),
          'color: ' + (r.n ? '#0A0A0B' : '#8B9097')));
        var squares = el('div', 'nk-cu-dsquares');
        squares.setAttribute('aria-hidden', 'true');
        var size = r.n > 60 ? 8 : 14;
        for (var k = 0; k < r.n; k++) {
          var sq = swatch(c.solid, size);
          if (r.kind === 'link') sty(sq, 'flex: none; display: inline-block; width: 30px; height: 4px; margin: 5px 0; background: ' + c.solid);
          squares.appendChild(sq);
        }
        row.appendChild(squares);
        host.appendChild(row);
      });
    });
  }

  /* ---- a few facts ------------------------------------------------------ */

  function buildFacts() {
    var host = id('nw-facts');
    if (!host) return;
    function card(big, title, text) {
      var c = sty(el('div'), 'border: 1px solid ' + LINE + '; padding: 20px 20px 22px; min-width: 0');
      c.appendChild(sty(el('div', null, big), 'font-size: 44px; font-weight: 500; line-height: 1; letter-spacing: -.04em; font-variant-numeric: tabular-nums'));
      c.appendChild(sty(el('div', null, title), 'margin-top: 10px; font-size: 17px; font-weight: 500; line-height: 1.25'));
      c.appendChild(sty(el('div', null, text), 'margin-top: 6px; font-size: 15px; line-height: 1.45; color: #5B6068'));
      host.appendChild(c);
      return c;
    }
    card(E.internetFacing, 'can be reached from the internet',
      'The ' + kindByKey.edge.count + ' WAN edge routers and the ' + kindByKey.firewall.count + ' firewalls, and nothing else. A flaw in one of these is the urgent kind.');
    card(num(E.total), 'record which software they run',
      'Every one of them. Without that, nobody can say which devices a newly announced flaw applies to.');
    card(E.models, 'models of equipment',
      'Each carries the date its maker stops supporting it, so old kit can be found before it becomes a risk.');
    var makers = card(E.makers.length, 'makers',
      E.makers.map(function (m) { return m.name + ': ' + num(m.count); }).join('. ') + '.');
    var bar = sty(el('div'), 'margin-top: 14px; display: flex; height: 12px; gap: 2px');
    bar.setAttribute('aria-hidden', 'true');
    E.makers.forEach(function (m) {
      bar.appendChild(sty(el('div'), 'flex: ' + m.count + ' 1 0; min-width: 6px; background: ' + tone(m.tone).solid));
    });
    makers.appendChild(bar);
  }

  /* ---- lines, history and tools ----------------------------------------- */

  function buildLinks() {
    set('nw-links-count', String(E.links));
    var host = id('nw-links');
    if (!host) return;
    D.links.forEach(function (l, k) {
      var card = sty(el('div'), 'border-top: 3px solid ' + (k < 2 ? '#0A0A0B' : '#8B9097') + '; padding-top: 14px; min-width: 0');
      card.appendChild(sty(el('div', null, l.name), 'font-size: 20px; font-weight: 500; letter-spacing: -.02em'));
      card.appendChild(sty(el('div', null, l.what), 'margin-top: 6px; font-size: 15px; line-height: 1.45; color: #3D4147'));
      card.appendChild(sty(el('div', null, l.where), 'margin-top: 8px; font-size: 14px; color: #5B6068'));
      host.appendChild(card);
    });
  }

  function buildHistory() {
    var host = id('nw-history');
    if (!host) return;
    E.history.forEach(function (h) {
      var card = sty(el('div'), 'border: 1px solid ' + LINE + '; padding: 18px 20px 20px; min-width: 0');
      card.appendChild(sty(el('div', null, h.shown), 'font-size: 30px; font-weight: 500; line-height: 1.05; letter-spacing: -.035em'));
      card.appendChild(sty(el('div', null, h.name), 'margin-top: 8px; font-size: 16px; font-weight: 500'));
      card.appendChild(sty(el('div', null, h.what), 'margin-top: 2px; font-size: 14px; line-height: 1.4; color: #5B6068'));
      host.appendChild(card);
    });
  }

  function buildTools() {
    var host = id('nw-tools');
    if (!host) return;
    D.tools.forEach(function (t) {
      var row = sty(el('div'), 'display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 18px; padding: 14px 0; border-top: 1px solid ' + LINE);
      var name = sty(el('div'), 'flex: 1 1 240px; min-width: 0');
      name.appendChild(sty(el('span', null, 'For example '), 'font-size: 14px; color: #5B6068'));
      name.appendChild(sty(el('span', null, t.name), 'font-size: 17px; font-weight: 500'));
      row.appendChild(name);
      row.appendChild(sty(el('div', null, t.what), 'flex: 2 1 260px; min-width: 0; font-size: 15px; color: #3D4147'));
      row.appendChild(sty(el('div', null, t.today ? 'The agents read this today' : 'Not connected yet'),
        'flex: none; font-size: 14px; font-weight: 500; color: ' + (t.today ? '#0B7A58' : '#5B6068')));
      host.appendChild(row);
    });
  }

  set('nw-checked', E.checked);
  buildStats();
  buildGrid();
  buildDesign();
  buildFacts();
  buildLinks();
  buildHistory();
  buildTools();
  paint();

  N.run({ interval: 120, blocks: 6 });
})();
