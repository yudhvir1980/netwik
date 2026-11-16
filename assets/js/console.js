/* Agent console. Public page, gated actions: every button here calls an api/
   route that checks the session server side. Nothing on this page is a
   security control; the server decides. */
(function () {
  'use strict';

  var N = window.Netwik;
  var who = document.getElementById('who');
  var form = document.getElementById('signin');
  var signout = document.getElementById('signout');
  var authmsg = document.getElementById('authmsg');
  var spike = document.getElementById('spike');
  var inspect = document.getElementById('inspect');
  var readiness = document.getElementById('readiness');
  var match = document.getElementById('match');
  var fixButtons = Array.prototype.slice.call(document.querySelectorAll('.nk-fixbtn'));
  var writeHint = document.getElementById('writehint');
  var schemaHint = document.getElementById('schemahint');
  var schemaButtons = Array.prototype.slice.call(document.querySelectorAll('.nk-schemabtn'));
  var runButtons = Array.prototype.slice.call(document.querySelectorAll('.nk-runbtn'));
  var loadButtons = Array.prototype.slice.call(document.querySelectorAll('.nk-loadbtn'));
  var loadHint = document.getElementById('loadhint');
  var out = document.getElementById('out');

  var state = { user: null, liveCalls: false, snow: false, snowHost: null, snowWrite: false, snowSchema: false };

  function enable(button, on) {
    if (!button) return;
    button.disabled = !on;
    button.style.opacity = on ? '1' : '.4';
    button.style.cursor = on ? 'pointer' : 'not-allowed';
  }

  function render() {
    if (state.user) {
      var bits = ['Signed in as ' + state.user];
      bits.push(state.liveCalls ? 'model calls on' : 'model calls off');
      bits.push(state.snow ? 'instance ' + (state.snowHost || 'configured') : 'instance not configured');
      who.textContent = bits.join(' · ');
      form.style.display = 'none';
      signout.style.display = 'inline-block';
    } else {
      who.textContent = 'Not signed in. Anyone may read this page; running anything needs a sign-in.';
      form.style.display = 'flex';
      signout.style.display = 'none';
    }
    enable(spike, Boolean(state.user) && state.liveCalls);
    enable(inspect, Boolean(state.user) && state.snow);
    enable(readiness, Boolean(state.user) && state.snow);
    enable(match, Boolean(state.user) && state.snow);
    /* Preview is always safe. Apply is only offered when the server will
       actually accept a write, so nobody presses it and gets a refusal. */
    fixButtons.forEach(function (b) {
      var isApply = b.getAttribute('data-mode') === 'apply';
      enable(b, Boolean(state.user) && state.snow && (!isApply || state.snowWrite));
      b.title = (isApply && !state.snowWrite)
        ? 'Writing is switched off. Set SERVICENOW_WRITE_ENABLED to true in Vercel and redeploy.'
        : '';
    });
    runButtons.forEach(function (b) { enable(b, Boolean(state.user) && state.snow); });
    loadButtons.forEach(function (b) {
      var isApply = b.getAttribute('data-mode') === 'apply';
      enable(b, Boolean(state.user) && state.snow && (!isApply || state.snowWrite));
    });
    if (loadHint) {
      loadHint.textContent = state.user && state.snow && !state.snowWrite
        ? 'Load is unavailable: writing is switched off. Set SERVICENOW_WRITE_ENABLED to true in Vercel and redeploy, then switch it back off when the load is done.'
        : '';
    }
    schemaButtons.forEach(function (b) {
      var isApply = b.getAttribute('data-mode') === 'apply';
      enable(b, Boolean(state.user) && state.snow && (!isApply || state.snowSchema));
    });
    if (schemaHint) {
      schemaHint.textContent = state.user && state.snow && !state.snowSchema
        ? 'Create is unavailable: schema changes are switched off. Set SERVICENOW_SCHEMA_ENABLED to true in Vercel and redeploy, then switch it back off once the tables exist.'
        : '';
    }
    if (writeHint) {
      writeHint.textContent = state.user && state.snow && !state.snowWrite
        ? 'Apply is unavailable: writing is switched off. Set SERVICENOW_WRITE_ENABLED to true in Vercel and redeploy, because functions read environment variables at deploy time.'
        : '';
    }
  }

  function readJson(response) {
    return response.json()
      .catch(function () { return { error: 'The server did not return JSON.' }; })
      .then(function (data) { return { status: response.status, data: data }; });
  }

  function post(path, body) {
    return fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(readJson);
  }

  function refresh() {
    return fetch('/api/me').then(readJson).then(function (result) {
      var data = result.data || {};
      state.user = data.user || null;
      state.liveCalls = Boolean(data.liveCalls);
      state.snow = Boolean(data.serviceNowConfigured);
      state.snowHost = data.serviceNowHost || null;
      state.snowWrite = Boolean(data.serviceNowWriteEnabled);
      state.snowSchema = Boolean(data.serviceNowSchemaEnabled);
      render();
    }).catch(function () {
      who.textContent = 'Could not reach the server.';
    });
  }

  /* Shared pattern: disable the button, tick a counter while waiting, print the
     result. The counter matters because the whole question on this plan is how
     long a call takes before the function is cut off. */
  function runAction(button, path, introText) {
    enable(button, false);
    var started = Date.now();
    out.textContent = introText;

    var ticking = setInterval(function () {
      out.textContent = introText + '\n\nWaiting… '
        + Math.round((Date.now() - started) / 1000) + 's elapsed in the browser.';
    }, 1000);

    function finish(text) {
      clearInterval(ticking);
      out.textContent = text;
      render();
    }

    post(path).then(function (result) {
      finish('Round trip: ' + ((Date.now() - started) / 1000).toFixed(1) + 's\n\n'
        + JSON.stringify(result.data, null, 2));
    }).catch(function (error) {
      finish('The request failed after ' + ((Date.now() - started) / 1000).toFixed(1) + 's.\n'
        + 'A hard cut-off here means the function duration cap, which is the\n'
        + 'number the measurement exists to find.\n\n' + String(error));
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    authmsg.textContent = '';
    post('/api/login', {
      username: document.getElementById('username').value,
      password: document.getElementById('password').value
    }).then(function (result) {
      if (result.status !== 200) {
        authmsg.textContent = (result.data && result.data.error) || 'Sign-in failed.';
        return;
      }
      document.getElementById('password').value = '';
      return refresh();
    }).catch(function () {
      authmsg.textContent = 'Sign-in request failed.';
    });
  });

  signout.addEventListener('click', function () {
    post('/api/logout').then(refresh);
  });

  spike.addEventListener('click', function () {
    runAction(spike, '/api/spike-latency',
      'Running one Claude call. This is the measurement, so it may take a while.');
  });

  inspect.addEventListener('click', function () {
    runAction(inspect, '/api/snow-inspect',
      'Reading the ServiceNow instance. Nothing is written and nothing is spent.');
  });

  readiness.addEventListener('click', function () {
    runAction(readiness, '/api/snow-readiness',
      'Checking whether the estate carries versions and end-of-support dates.');
  });

  match.addEventListener('click', function () {
    runAction(match, '/api/match-advisory',
      'Matching the worked advisory against the estate. No model call, no spend.');
  });

  /* Apply runs in batches, because a capped function cannot patch hundreds of
     records in one invocation. Keep calling until the server says it is done. */
  function runFix(button, fix, mode) {
    fixButtons.forEach(function (b) { enable(b, false); });
    var started = Date.now();
    var totals = { updated: 0, failed: 0, rounds: 0 };
    var last = null;

    function step() {
      totals.rounds++;
      out.textContent = (mode === 'apply' ? 'Applying' : 'Previewing') + ' "' + fix + '"…'
        + (totals.rounds > 1 ? '\n\nBatch ' + totals.rounds
            + '. Updated so far: ' + totals.updated + '.' : '');

      return post('/api/snow-fix-data', { fix: fix, mode: mode, batch: 120 })
        .then(function (result) {
          last = result;
          var data = result.data || {};
          var applied = data.result && data.result.applied;
          if (applied) {
            totals.updated += applied.updated || 0;
            totals.failed += applied.failed || 0;
          }
          if (result.status === 200 && mode === 'apply' && data.done === false
              && totals.rounds < 40 && applied && applied.updated > 0) {
            return step();
          }
          return null;
        });
    }

    step().then(function () {
      var seconds = ((Date.now() - started) / 1000).toFixed(1);
      var status = last ? last.status : 0;
      var summary;

      /* Say plainly when the server refused. Reporting "Applied ... updated 0"
         for a rejected request reads like success and hides the reason. */
      if (status !== 200) {
        var reason = (last && last.data && last.data.error) || 'The server refused the request.';
        summary = 'NOT APPLIED. The server answered ' + status + ' after '
          + seconds + 's.\n\n' + reason + '\n\n';
      } else if (mode === 'apply') {
        summary = 'Applied in ' + totals.rounds + ' batch(es) over ' + seconds + 's. '
          + 'Updated ' + totals.updated + ', failed ' + totals.failed + '.\n\n';
      } else {
        summary = 'Preview in ' + seconds + 's. Nothing was written.\n\n';
      }

      out.textContent = summary + JSON.stringify(last && last.data, null, 2);
      render();
    }).catch(function (error) {
      out.textContent = 'The request failed after '
        + ((Date.now() - started) / 1000).toFixed(1) + 's.\n\n' + String(error);
      render();
    });
  }

  /* Loading the remaining sites. One call lists the sites; then each site is
     called until it reports done, because one invocation creates one batch.
     Preview makes one read-only call per site. */
  function runLoad(mode) {
    loadButtons.forEach(function (b) { enable(b, false); });
    var started = Date.now();
    var lines = [];
    var totals = { created: 0, failed: 0, planned: 0, already: 0, calls: 0 };
    var firstSample = null;
    var stopped = null;

    function show(now) {
      out.textContent = (mode === 'apply' ? 'Loading' : 'Previewing') + ' the remaining sites. '
        + Math.round((Date.now() - started) / 1000) + 's, ' + totals.calls + ' calls.'
        + (mode === 'apply' ? ' Created ' + totals.created + ', failed ' + totals.failed + '.' : '')
        + (now ? '\n\nNow: ' + now : '') + '\n\n' + lines.join('\n');
    }

    function site(list, index) {
      if (index >= list.length || stopped) return null;
      var s = list[index];
      var seen = { created: 0, failed: 0, rounds: 0, planned: 0, already: null, last: null };

      function round() {
        seen.rounds++;
        totals.calls++;
        show(s.code + ' ' + s.name + (seen.rounds > 1 ? ', batch ' + seen.rounds : ''));
        return post('/api/snow-load-sites', { mode: mode, site: s.code, batch: 40 }).then(function (result) {
          var data = result.data || {};
          var r = data.result;
          if (result.status !== 200 || !r) {
            stopped = 'Stopped at ' + s.code + '. The server answered ' + result.status + ': '
              + (data.error || 'no reason given');
            return null;
          }
          seen.last = r;
          seen.planned = r.planned;
          if (seen.already === null) seen.already = r.alreadyThere;
          seen.created += r.created || 0;
          seen.failed += r.failed || 0;
          totals.created += r.created || 0;
          totals.failed += r.failed || 0;
          if (!firstSample && r.sample) firstSample = { site: s.code, record: r.sample };
          /* Keep going while batches are landing. A batch that creates
             nothing means something is wrong, so stop on it. */
          if (mode === 'apply' && !r.done && r.created > 0 && seen.rounds < 40) return round();
          if (mode === 'apply' && !r.done) {
            stopped = 'Stopped at ' + s.code + ': a batch created nothing. '
              + (r.errors && r.errors.length ? r.errors[0] : '');
          }
          return null;
        });
      }

      return round().then(function () {
        var r = seen.last;
        if (r) {
          totals.planned += seen.planned;
          totals.already += seen.already || 0;
          var roles = Object.keys(r.plannedByRole || {}).map(function (k) { return r.plannedByRole[k] + ' ' + k; }).join(', ');
          lines.push(s.code + '  ' + s.tier + '  ' + s.name + ': ' + seen.planned + ' devices (' + roles + '), copied from ' + r.copiedFrom
            + '. Already there ' + (seen.already || 0)
            + (mode === 'apply' ? ', created ' + seen.created + ', failed ' + seen.failed : '')
            + '. Location: ' + (r.location.found ? 'found "' + r.location.name + '"' : (r.location.created ? 'created' : 'will be created'))
            + (r.sample && r.sample.short_description ? '\n      e.g. ' + r.sample.name + ': "' + r.sample.short_description + '"'
              + (r.sampleModel ? ', model ' + r.sampleModel : '') + (r.sampleGroup ? ', support group ' + r.sampleGroup : '')
              + (r.siteTeam ? ', managed by ' + r.siteTeam : '') : '')
            + (r.warnings && r.warnings.length ? '\n      ! ' + r.warnings.join('\n      ! ') : '')
            + (r.errors && r.errors.length ? '\n      x ' + r.errors.join('\n      x ') : ''));
        }
        return site(list, index + 1);
      });
    }

    /* The devices already loaded move to their regional site IT group. New
       copies get it when they are made, so only these need it. */
    var regrouped = { updated: 0, toChange: 0 };
    function regroup(codes, index) {
      if (index >= codes.length || stopped) return null;
      var code = codes[index];
      var rounds = 0;
      var first = null;
      var done = 0;
      function round() {
        rounds++;
        totals.calls++;
        show('regrouping the devices already at ' + code + (rounds > 1 ? ', batch ' + rounds : ''));
        return post('/api/snow-load-sites', { mode: mode, regroup: code, batch: 40 }).then(function (result) {
          var data = result.data || {};
          var g = data.regroup;
          if (result.status !== 200 || !g || g.error) {
            stopped = 'Stopped regrouping at ' + code + '. ' + result.status + ': ' + (data.error || (g && g.error) || 'no reason given');
            return null;
          }
          if (!first) first = g;
          done += g.updated || 0;
          totals.failed += g.failed || 0;
          if (mode === 'apply' && !g.done && g.updated > 0 && rounds < 40) return round();
          if (mode === 'apply' && !g.done) {
            stopped = 'Stopped regrouping at ' + code + ': a batch changed nothing. ' + (g.errors && g.errors.length ? g.errors[0] : '');
          }
          return null;
        });
      }
      return round().then(function () {
        if (first) {
          regrouped.toChange += first.toChange || 0;
          regrouped.updated += done;
          lines.push(code + ': ' + first.devices + ' devices, ' + (first.toChange || 0) + ' to move to ' + first.team
            + (mode === 'apply' ? ', moved ' + done : '') + '.'
            + (first.groupsMissing && first.groupsMissing.length && index === 0
              ? '\n      ! Not in the instance yet, created on load with no members or manager: ' + first.groupsMissing.join(', ') : ''));
        }
        return regroup(codes, index + 1);
      });
    }

    var loadedCodes = [];
    totals.calls++;
    show('reading what is loaded today');
    post('/api/snow-load-sites', { mode: mode }).then(function (result) {
      var data = result.data || {};
      if (result.status !== 200 || !data.sites) {
        stopped = 'The server answered ' + result.status + ': ' + (data.error || 'no reason given');
        return null;
      }
      loadedCodes = data.loadedToday || [];
      lines.push('Loaded today: ' + (data.loadedToday || []).join(', ')
        + '. Sales offices are copied from ' + (data.salesOfficeTemplate || 'nothing') + '.');
      (data.problems || []).forEach(function (p) { lines.push('PROBLEM: ' + p); });
      lines.push('');
      if (mode === 'apply' && data.problems && data.problems.length) {
        stopped = 'Not loading until the problems above are sorted out.';
        return null;
      }
      return site(data.sites, 0);
    }).then(function () {
      if (stopped) return null;
      lines.push('');
      lines.push('Devices already loaded: "managed by" becomes the regional site IT group. The support group stays.');
      return regroup(loadedCodes, 0);
    }).then(function () {
      var seconds = ((Date.now() - started) / 1000).toFixed(0);
      var head = mode === 'apply'
        ? (stopped ? 'STOPPED EARLY. ' : 'Load finished. ') + 'Created ' + totals.created + ', moved ' + regrouped.updated
          + ' existing devices to their site team, failed ' + totals.failed
          + ', in ' + seconds + 's. Press Load again to carry on: what exists is skipped.'
        : 'Preview in ' + seconds + 's. Nothing was written. ' + totals.planned + ' devices planned, '
          + totals.already + ' already there, ' + regrouped.toChange + ' existing devices to move to their site team.';
      out.textContent = head + (stopped ? '\n\n' + stopped : '') + '\n\n' + lines.join('\n')
        + (firstSample ? '\n\nA sample of what would be created, for ' + firstSample.site + ':\n'
          + JSON.stringify(firstSample.record, null, 2) : '');
      render();
    }).catch(function (error) {
      out.textContent = 'The request failed after ' + ((Date.now() - started) / 1000).toFixed(1)
        + 's.\n\n' + String(error) + '\n\n' + lines.join('\n');
      render();
    });
  }

  loadButtons.forEach(function (button) {
    button.addEventListener('click', function () { runLoad(button.getAttribute('data-mode')); });
  });

  fixButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      runFix(button, button.getAttribute('data-fix'), button.getAttribute('data-mode'));
    });
  });

  /* Creating roughly eighty objects needs several rounds: tables first, then
     columns, because a reference column needs its target table to exist. */
  schemaButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var mode = button.getAttribute('data-mode');
      runButtons.forEach(function (b) { enable(b, Boolean(state.user) && state.snow); });
    schemaButtons.forEach(function (b) { enable(b, false); });
      var started = Date.now();
      var rounds = 0;
      var madeTables = 0;
      var madeFields = 0;
      var last = null;

      function step() {
        rounds++;
        out.textContent = (mode === 'apply' ? 'Creating' : 'Previewing')
          + ' the flow tables. Round ' + rounds + '.'
          + (madeTables || madeFields
              ? ' Tables ' + madeTables + ', columns ' + madeFields + ' so far.' : '');

        return post('/api/snow-create-tables', { mode: mode, batch: 25 })
          .then(function (result) {
            last = result;
            var data = result.data || {};
            if (data.created) {
              madeTables += (data.created.tables || []).length;
              madeFields += (data.created.fields || []).length;
            }
            var progressed = data.created
              && ((data.created.tables || []).length + (data.created.fields || []).length) > 0;
            if (result.status === 200 && mode === 'apply' && data.done === false
                && rounds < 25 && progressed) {
              return step();
            }
            return null;
          });
      }

      step().then(function () {
        var seconds = ((Date.now() - started) / 1000).toFixed(1);
        var status = last ? last.status : 0;
        var summary;
        if (status !== 200) {
          summary = 'NOT CREATED. The server answered ' + status + ' after ' + seconds + 's.\n\n'
            + ((last && last.data && last.data.error) || 'The server refused the request.') + '\n\n';
        } else if (mode === 'apply') {
          summary = 'Created ' + madeTables + ' tables and ' + madeFields
            + ' columns in ' + rounds + ' round(s) over ' + seconds + 's.\n\n';
        } else {
          summary = 'Preview in ' + seconds + 's. Nothing was created.\n\n';
        }
        out.textContent = summary + JSON.stringify(last && last.data, null, 2);
        render();
      }).catch(function (error) {
        out.textContent = 'The request failed after '
          + ((Date.now() - started) / 1000).toFixed(1) + 's.\n\n' + String(error);
        render();
      });
    });
  });

  runButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var mode = button.getAttribute('data-mode');
      runButtons.forEach(function (b) { enable(b, false); });
      var started = Date.now();
      out.textContent = mode === 'apply'
        ? 'Recording a run: advisory, vulnerable items, qualification tasks and stages.'
        : 'Previewing the run. Nothing will be written.';

      post('/api/run-advisory', { mode: mode }).then(function (result) {
        var seconds = ((Date.now() - started) / 1000).toFixed(1);
        var head = result.status !== 200
          ? 'RUN FAILED. The server answered ' + result.status + ' after ' + seconds + 's.'
          : (mode === 'apply' ? 'Run recorded in ' : 'Preview in ') + seconds + 's.';
        out.textContent = head + String.fromCharCode(10, 10)
          + JSON.stringify(result.data, null, 2);
        render();
      }).catch(function (error) {
        out.textContent = 'The request failed after '
          + ((Date.now() - started) / 1000).toFixed(1) + 's.' + String.fromCharCode(10, 10) + String(error);
        render();
      });
    });
  });

  refresh();
  if (N && N.run) N.run({ interval: 120, blocks: 6 });
})();
