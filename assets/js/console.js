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
  var out = document.getElementById('out');

  var state = { user: null, liveCalls: false, snow: false, snowHost: null, snowWrite: false };

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

  fixButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      runFix(button, button.getAttribute('data-fix'), button.getAttribute('data-mode'));
    });
  });

  refresh();
  if (N && N.run) N.run({ interval: 120, blocks: 6 });
})();
