/* Use case walkthrough page. Reads ?id= and builds the page from the entry in data.js. */
(function () {
  'use strict';

  var N = window.Netwik;
  var host = document.getElementById('uc');
  var id = new URLSearchParams(window.location.search).get('id');
  var uc = null;
  window.NetwikData.ALL.forEach(function (c) { if (c.detail && c.id === id) uc = c; });

  var MONO = "font-family: 'JetBrains Mono', ui-monospace, monospace";
  var BTN = 'background: #0A0A0B; color: #FFFFFF; text-decoration: none; font-weight: 600; font-size: 16px; padding: 15px 22px';
  var H2 = 'margin: 0; font-weight: 500; font-size: clamp(34px, 4vw, 50px); line-height: 1.05; letter-spacing: -0.04em';
  var SECTION = 'padding: 88px 28px; border-bottom: 1px solid #E2E4E7';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function two(n) { return (n < 9 ? '0' : '') + (n + 1); }

  if (!uc) {
    host.innerHTML =
      '<section style="' + SECTION + '; display: flex; flex-direction: column; align-items: flex-start; gap: 22px">' +
      '<h1 style="' + H2 + '">This use case is not written up yet.</h1>' +
      '<p style="margin: 0; color: #5B6068">I am adding walkthroughs one at a time. The ones that are ready are on the home page.</p>' +
      '<a href="index.html#use-cases" class="nk-btn" style="' + BTN + '">See the use cases &nbsp;→</a>' +
      '</section>';
    N.run({ interval: 120, blocks: 4 });
    return;
  }

  var d = uc.detail;
  document.title = uc.title + ': Netwik';

  // Section heading for the three things every agent is built on.
  function builtOn(num, name, anchor, title, intro) {
    return '<div style="display: flex; flex-direction: column; gap: 16px; max-width: 640px; margin-bottom: 44px">' +
      '<a href="built-on.html#' + anchor + '" style="' + MONO + '; font-size: 13px; color: #5B6068; align-self: flex-start; padding: 6px 0">' + num + ' / 03 &nbsp;' + name + '</a>' +
      '<h2 style="' + H2 + '">' + title + '</h2>' +
      '<p style="margin: 0; color: #5B6068">' + intro + '</p>' +
      '</div>';
  }

  function steps(list, dark) {
    var line = dark ? '#2A2C30' : '#E2E4E7';
    return list.map(function (text, i) {
      var last = i === list.length - 1;
      var colour = !dark ? '#5B6068' : last ? '#F5A524' : '#2EE6A6';
      return '<li style="display: flex; gap: 16px; padding: 16px 22px' + (last ? '' : '; border-bottom: 1px solid ' + line) + '">' +
        '<span style="flex: none; ' + MONO + '; font-size: 12px; color: ' + colour + '; padding-top: 4px">' + two(i) + '</span>' +
        '<span>' + esc(text) + '</span></li>';
    }).join('');
  }

  function limits(title, dot, list) {
    return '<div style="border: 1px solid #E2E4E7; padding: 24px; display: flex; flex-direction: column; gap: 16px">' +
      '<div style="display: flex; align-items: center; gap: 10px"><span style="flex: none; width: 7px; height: 7px; background: ' + dot + '"></span>' +
      '<h3 style="margin: 0; font-weight: 500; font-size: 21px; letter-spacing: -0.02em">' + title + '</h3></div>' +
      '<ul style="margin: 0; padding: 0 0 0 20px; display: flex; flex-direction: column; gap: 10px; font-size: 16px; color: #3D4147">' +
      list.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
      '</ul></div>';
  }

  var html = '';

  // Hero: what the agent does, beside an illustrative run
  html +=
    '<section style="padding: 56px 28px 72px; display: flex; flex-wrap: wrap; align-items: center; gap: 48px; border-bottom: 1px solid #E2E4E7">' +
    '<div style="flex: 1 1 440px; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 22px">' +
    '<nav aria-label="Breadcrumb" style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 14px; color: #5B6068">' +
    '<a href="index.html#use-cases" style="padding: 12px 0">Use cases</a><span aria-hidden="true">/</span><span aria-current="page">' + esc(uc.proc) + '</span></nav>' +
    '<h1 class="nk-rise" style="margin: 0; font-weight: 500; font-size: clamp(38px, 5vw, 68px); line-height: 1.03; letter-spacing: -0.045em">' + esc(uc.title) + '.</h1>' +
    '<p class="nk-rise" style="margin: 0; font-size: 20px; line-height: 1.45; color: #5B6068; max-width: 480px; animation-delay: .1s">' + esc(d.summary) + '</p>' +
    '<div style="display: flex; flex-wrap: wrap; gap: 6px">' +
    uc.doms.map(function (dom) { return '<span class="nk-tag">' + esc(dom) + '</span>'; }).join('') +
    '</div></div>' +
    '<div class="nk-rise" data-run-panel style="flex: 1 1 440px; min-width: 0; background: #131416; color: #F2F3F5; animation-delay: .2s">' +
    '<div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 16px 22px; border-bottom: 1px solid #2A2C30; font-size: 14px">' +
    '<span style="font-weight: 500">' + esc(uc.proc) + ' agent</span><span style="color: #A3A7AE">Illustrative run</span></div>' +
    '<div style="padding: 22px; display: flex; flex-direction: column; gap: 16px; font-size: 15px; line-height: 1.4">' +
    d.steps.map(function (s) {
      return '<div class="nk-step"><span class="nk-step-dot"></span><div><div class="nk-step-title">' + esc(s[0]) + '</div><div class="nk-step-sub">' + esc(s[1]) + '</div></div></div>';
    }).join('') +
    '</div>' +
    '<div style="padding: 14px 22px 16px; border-top: 1px solid #2A2C30; display: flex; gap: 12px; ' + MONO + '; font-size: 13px; line-height: 1.5; min-height: 78px">' +
    '<span style="flex: none; color: #A3A7AE">' + esc(d.ticketLabel) + '</span><span><span data-run-typed></span><span class="nk-cursor"></span></span></div>' +
    '<div style="height: 3px; background: #2A2C30"><div class="nk-fill" data-run-bar style="width: 0%"></div></div>' +
    '</div></section>';

  // Before and after
  html +=
    '<section style="' + SECTION + '">' +
    '<h2 style="margin: 0 0 44px; text-align: center; font-weight: 500; font-size: clamp(36px, 4.6vw, 60px); line-height: 1.03; letter-spacing: -0.045em">Before and after.</h2>' +
    '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr)); gap: 12px">' +
    '<div style="border: 1px solid #E2E4E7; display: flex; flex-direction: column">' +
    '<h3 style="margin: 0; padding: 18px 22px; font-weight: 500; font-size: 24px; letter-spacing: -0.03em; border-bottom: 1px solid #E2E4E7">Today</h3>' +
    '<ol style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; font-size: 16px">' + steps(d.today, false) + '</ol></div>' +
    '<div style="background: #131416; color: #F2F3F5; display: flex; flex-direction: column">' +
    '<h3 style="margin: 0; padding: 18px 22px; font-weight: 500; font-size: 24px; letter-spacing: -0.03em; border-bottom: 1px solid #2A2C30">With the agent</h3>' +
    '<ol style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; font-size: 16px">' + steps(d.withAgent, true) + '</ol></div>' +
    '</div></section>';

  // What the engineer gets
  html +=
    '<section style="' + SECTION + '; display: flex; flex-wrap: wrap; align-items: center; gap: 40px 64px">' +
    '<div style="flex: 1 1 320px; min-width: 0; display: flex; flex-direction: column; gap: 16px">' +
    '<h2 style="' + H2 + '">What the engineer gets.</h2>' +
    '<p style="margin: 0; color: #5B6068; max-width: 400px">A short answer with the evidence behind it, and a clear statement of what still needs a person. This output is illustrative.</p></div>' +
    '<pre aria-label="Illustrative output" style="flex: 999 1 420px; min-width: 0; margin: 0; background: #131416; color: #D5D8DC; padding: 24px; ' + MONO + '; font-size: 14px; line-height: 1.8; overflow-x: auto">' +
    d.output.lines.map(esc).join('\n') + '\n' +
    '<span style="color: ' + (d.output.tone === 'amber' ? '#F5A524' : '#2EE6A6') + '">' + esc(d.output.last) + '</span></pre>' +
    '</section>';

  // 01 Context
  html +=
    '<section style="' + SECTION + '">' +
    builtOn('01', 'Context', 'context', 'What it needs to know.', 'The agent is only as good as what it knows about the network. This is the context this use case depends on.') +
    '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 12px">' +
    d.context.map(function (c, i) {
      return '<div style="background: #131416; color: #F2F3F5; padding: 24px; display: flex; flex-direction: column; gap: 10px">' +
        '<span style="' + MONO + '; font-size: 12px; color: #2EE6A6">' + two(i) + '</span>' +
        '<h3 style="margin: 0; font-weight: 500; font-size: 21px; letter-spacing: -0.02em">' + esc(c[0]) + '</h3>' +
        '<p style="margin: 0; color: #A3A7AE; font-size: 16px">' + esc(c[1]) + '</p></div>';
    }).join('') +
    '</div></section>';

  // 02 Foundation
  html +=
    '<section style="' + SECTION + '">' +
    builtOn('02', 'Foundation', 'foundation', 'The tools it works through.', 'The agent reads from and writes to the systems the team already uses. Tickets and audit trails stay where they are. The product names are examples.') +
    '<div style="border: 1px solid #E2E4E7; display: flex; flex-direction: column">' +
    d.tools.map(function (t, i) {
      return '<div style="display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 24px; padding: 18px 22px' + (i === d.tools.length - 1 ? '' : '; border-bottom: 1px solid #E2E4E7') + '">' +
        '<span style="color: #5B6068; font-size: 16px">' + esc(t[0]) + '</span>' +
        '<span style="font-size: 23px; font-weight: 500; letter-spacing: -0.03em"><span style="font-size: 13px; font-weight: 400; letter-spacing: 0; color: #5B6068">for example&nbsp; </span>' + esc(t[1]) + '</span>' +
        '<span style="flex: 1 1 100%; color: #5B6068; font-size: 15px">' + esc(t[2]) + '</span></div>';
    }).join('') +
    '</div></section>';

  // 03 Autonomy
  html +=
    '<section style="' + SECTION + '">' +
    builtOn('03', 'Autonomy', 'autonomy', 'What it is allowed to do.', 'Clear limits on what the agent may do alone. These are a starting point: more is granted one task at a time, as the agent proves itself.') +
    '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(310px, 100%), 1fr)); gap: 12px">' +
    limits('Does on its own', '#12B886', d.alone) +
    limits('Does after a person approves', '#F5A524', d.approval) +
    limits('Never does', '#0A0A0B', d.never) +
    '</div>' +
    '<div style="margin-top: 36px"><a href="index.html#use-cases" class="nk-btn" style="' + BTN + '">See more use cases &nbsp;→</a></div>' +
    '</section>';

  host.innerHTML = html;

  N.run({ interval: 120, blocks: 10, onTick: N.runPanel(host.querySelector('[data-run-panel]'), d.ticket) });
})();
