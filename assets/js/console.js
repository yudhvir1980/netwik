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
  var out = document.getElementById('out');

  var state = { user: null, liveCalls: false, snow: false, snowHost: null };

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

  refresh();
  if (N && N.run) N.run({ interval: 120, blocks: 6 });
})();
