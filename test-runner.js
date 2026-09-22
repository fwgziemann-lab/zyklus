/* Zeigt die Ergebnisse aus tests.js auf test.html an. */
(function () {
  'use strict';
  const list = document.getElementById('results');
  const summary = document.getElementById('summary');
  const res = window.ZyklusTests.run(function (ok, name, msg) {
    const li = document.createElement('li');
    li.className = ok ? 'ok' : 'fail';
    li.textContent = name;
    if (msg) {
      const m = document.createElement('span');
      m.className = 'msg';
      m.textContent = msg;
      li.appendChild(m);
    }
    list.appendChild(li);
  });
  summary.className = res.failed ? 'fail' : 'ok';
  summary.textContent = res.failed
    ? res.failed + ' von ' + res.total + ' Tests fehlgeschlagen'
    : 'Alle ' + res.total + ' Tests bestanden';
})();
