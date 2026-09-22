/*
 * Tests für core.js. Läuft im Browser (test.html) und in Node (node tests.js).
 * Die Testdaten sind erfunden.
 */
(function (root) {
  'use strict';
  const C = root.ZyklusCore || (typeof require === 'function' ? (require('./core.js'), globalThis.ZyklusCore) : null);
  const X = root.ZyklusCrypto || (typeof require === 'function' ? (require('./crypto.js'), globalThis.ZyklusCrypto) : null);
  const tests = [];
  function test(name, fn) { tests.push({ name: name, fn: fn }); }

  function assert(cond, msg) { if (!cond) throw new Error(msg || 'Bedingung nicht erfüllt'); }
  function eq(actual, expected, msg) {
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'erwartet ' + b + ', erhalten ' + a);
  }

  /* Hilfsfunktionen zum Aufbau von Testdaten */
  function entries(list) {
    // list: [[date, bleeding, extra], ...]
    const out = {};
    list.forEach(function (item) {
      const e = C.emptyEntry(item[0]);
      e.bleeding = item[1] || 'none';
      if (item[2]) Object.keys(item[2]).forEach(function (k) { e[k] = item[2][k]; });
      out[e.date] = e;
    });
    return out;
  }
  // Periode mit `len` Tagen ab `start`, Stärkeverlauf mittel/stark/mittel/leicht...
  function period(start, len, opts) {
    const pattern = ['medium', 'heavy', 'medium', 'light', 'light', 'spotting', 'spotting'];
    const out = [];
    for (let i = 0; i < len; i++) {
      out.push([C.addDays(start, i), pattern[Math.min(i, pattern.length - 1)], opts && opts[i]]);
    }
    return out;
  }
  function concat() {
    let out = [];
    for (let i = 0; i < arguments.length; i++) out = out.concat(arguments[i]);
    return out;
  }
  const SETTINGS = { defaultCycle: 28, defaultPeriod: 5 };

  /* ---------------- Datumsfunktionen ---------------- */

  test('addDays über Monats- und Jahreswechsel', function () {
    eq(C.addDays('2025-12-30', 3), '2026-01-02');
    eq(C.addDays('2026-03-01', -1), '2026-02-28');
    eq(C.addDays('2024-02-28', 1), '2024-02-29', 'Schaltjahr');
  });

  test('diffDays ist symmetrisch und ignoriert Sommerzeit', function () {
    eq(C.diffDays('2026-03-28', '2026-03-30'), 2, 'Sommerzeitumstellung 29.3.2026');
    eq(C.diffDays('2026-10-24', '2026-10-26'), 2, 'Winterzeitumstellung 25.10.2026');
    eq(C.diffDays('2026-01-01', '2025-12-31'), -1);
  });

  test('weekdayMon: Montag = 0, Sonntag = 6', function () {
    eq(C.weekdayMon('2026-09-21'), 0, '21.9.2026 ist Montag');
    eq(C.weekdayMon('2026-09-27'), 6);
  });

  test('isValidDate lehnt ungültige Daten ab', function () {
    assert(C.isValidDate('2026-02-28'));
    assert(!C.isValidDate('2026-02-30'));
    assert(!C.isValidDate('26-02-01'));
    assert(!C.isValidDate(null));
  });

  test('formatDE', function () {
    eq(C.formatDE('2026-03-05'), '05.03.2026');
    eq(C.formatShortDE('2026-03-05'), '5.3.');
  });

  /* ---------------- Periodenerkennung ---------------- */

  test('Regelmäßiger Zyklus: Perioden und Zyklen werden erkannt', function () {
    const data = entries(concat(period('2026-01-05', 5), period('2026-02-02', 5), period('2026-03-02', 4)));
    const periods = C.detectPeriods(data);
    eq(periods.length, 3);
    eq(periods[0].start, '2026-01-05');
    eq(periods[0].end, '2026-01-09');
    eq(periods[0].length, 5);
    eq(periods[0].maxBleeding, 'heavy');
    const cycles = C.computeCycles(periods);
    eq(cycles.map(function (c) { return c.length; }), [28, 28, null]);
  });

  test('Lücke von 2 Tagen gehört noch zur selben Periode', function () {
    const data = entries([
      ['2026-04-01', 'medium'], ['2026-04-02', 'heavy'],
      // 3. und 4. April keine Blutung
      ['2026-04-05', 'light']
    ]);
    const periods = C.detectPeriods(data);
    eq(periods.length, 1);
    eq(periods[0].end, '2026-04-05');
    eq(periods[0].length, 5);
  });

  test('Lücke von 3 Tagen trennt zwei Perioden (Schmierblutung dazwischen zählt nicht als Start)', function () {
    const data = entries([
      ['2026-04-01', 'medium'], ['2026-04-02', 'heavy'],
      ['2026-04-06', 'spotting']
    ]);
    const periods = C.detectPeriods(data);
    eq(periods.length, 1, 'Schmierblutung allein ist keine Periode');
    eq(periods[0].end, '2026-04-02');
  });

  test('Nur Schmierblutung ergibt keine Periode', function () {
    const data = entries([['2026-05-01', 'spotting'], ['2026-05-02', 'spotting'], ['2026-05-03', 'spotting']]);
    eq(C.detectPeriods(data).length, 0);
    const r = C.predict(data, SETTINGS, '2026-05-10');
    eq(r.predictions.length, 0);
    eq(r.phase, 'unknown');
  });

  test('Schmierblutung vor der Periode: Start ist der erste Tag ab "leicht"', function () {
    const data = entries([['2026-06-01', 'spotting'], ['2026-06-02', 'light'], ['2026-06-03', 'heavy']]);
    const periods = C.detectPeriods(data);
    eq(periods.length, 1);
    eq(periods[0].start, '2026-06-02');
  });

  test('Manueller Starttag überschreibt die automatische Erkennung', function () {
    const data = entries([
      ['2026-06-01', 'spotting', { periodStart: true }], ['2026-06-02', 'light'], ['2026-06-03', 'heavy']
    ]);
    const periods = C.detectPeriods(data);
    eq(periods[0].start, '2026-06-01');
    eq(periods[0].manual, true);
  });

  test('Zwei manuelle Starttage in einem Lauf ergeben zwei Perioden', function () {
    const data = entries([
      ['2026-07-01', 'medium', { periodStart: true }], ['2026-07-02', 'light'],
      ['2026-07-03', 'medium', { periodStart: true }], ['2026-07-04', 'light']
    ]);
    const periods = C.detectPeriods(data);
    eq(periods.length, 2);
    eq(periods[1].start, '2026-07-03');
    eq(periods[0].end, '2026-07-02');
  });

  test('Manueller Start direkt nach einer Periode trennt sie in zwei (kurzer Zyklus)', function () {
    const data = entries(concat(period('2026-08-27', 5), [['2026-09-01', 'heavy', { periodStart: true }]]));
    const periods = C.detectPeriods(data);
    eq(periods.length, 2);
    eq(periods[0].start, '2026-08-27');
    eq(periods[0].end, '2026-08-31');
    eq(periods[1].start, '2026-09-01');
    eq(C.computeCycles(periods)[0].length, 5);
    eq(C.computeCycles(periods)[0].outlier, true);
  });

  test('Jahreswechsel: Periode über Silvester, Zyklus über zwei Jahre', function () {
    const data = entries(concat(period('2025-12-03', 5), period('2025-12-30', 5), period('2026-01-27', 5)));
    const periods = C.detectPeriods(data);
    eq(periods[1].start, '2025-12-30');
    eq(periods[1].end, '2026-01-03');
    eq(C.computeCycles(periods).map(function (c) { return c.length; }), [27, 28, null]);
  });

  /* ---------------- Vorschlag Periodenstart ---------------- */

  test('suggestPeriodStart: erste Blutung ab leicht → ja, Schmierblutung → nein', function () {
    eq(C.suggestPeriodStart({}, '2026-03-01', 'light'), true);
    eq(C.suggestPeriodStart({}, '2026-03-01', 'spotting'), false);
    eq(C.suggestPeriodStart({}, '2026-03-01', 'none'), false);
  });

  test('suggestPeriodStart: innerhalb einer laufenden Periode → nein', function () {
    const data = entries(period('2026-03-01', 3));
    eq(C.suggestPeriodStart(data, '2026-03-04', 'medium'), false, 'direkt nach Blutungstag');
    eq(C.suggestPeriodStart(data, '2026-03-06', 'medium'), false, 'Lücke von 2 Tagen');
    eq(C.suggestPeriodStart(data, '2026-03-08', 'medium'), false, 'nur 7 Tage nach Start');
    eq(C.suggestPeriodStart(data, '2026-03-11', 'medium'), true, '10 Tage nach Start');
  });

  /* ---------------- Vorhersage ---------------- */

  test('Regelmäßig: Vorhersage aus Durchschnitt der letzten Zyklen', function () {
    const data = entries(concat(
      period('2026-01-05', 5), period('2026-02-02', 5), period('2026-03-02', 5), period('2026-03-30', 5)
    ));
    const r = C.predict(data, SETTINGS, '2026-04-10');
    eq(r.usingDefaults, false);
    eq(r.cycleLength, 28);
    eq(r.periodLength, 5);
    eq(r.irregular, false);
    eq(r.predictions.length, 3);
    eq(r.predictions[0].start, '2026-04-27');
    eq(r.predictions[0].end, '2026-05-01');
    eq(r.predictions[1].start, '2026-05-25');
    eq(r.predictions[2].start, '2026-06-22');
    eq(r.predictions[0].ovulation, '2026-04-13');
    eq(r.predictions[0].fertileStart, '2026-04-08');
    eq(r.predictions[0].fertileEnd, '2026-04-14');
    eq(r.cycleDay, 12);
    eq(r.daysUntil, 17);
    eq(r.phase, 'follicular', '10.4. liegt vor dem Eisprungfenster (12.–14.4.)');
    eq(C.predict(data, SETTINGS, '2026-04-12').phase, 'ovulation');
  });

  test('Phasen im Zyklusverlauf', function () {
    const data = entries(concat(period('2026-01-05', 5), period('2026-02-02', 5), period('2026-03-02', 5)));
    eq(C.predict(data, SETTINGS, '2026-03-03').phase, 'menstruation');
    eq(C.predict(data, SETTINGS, '2026-03-10').phase, 'follicular');
    eq(C.predict(data, SETTINGS, '2026-03-16').phase, 'ovulation', 'Eisprung am 16.3.');
    eq(C.predict(data, SETTINGS, '2026-03-20').phase, 'luteal');
    const late = C.predict(data, SETTINGS, '2026-04-02');
    eq(late.phase, 'overdue');
    eq(late.overdueDays, 3);
  });

  test('Unregelmäßig: Schwankung > 7 Tage → Zeitraum statt Datum', function () {
    // Zyklen 24, 35, 26, 33
    const starts = ['2026-01-01', '2026-01-25', '2026-03-01', '2026-03-27', '2026-04-29'];
    const data = entries(concat.apply(null, starts.map(function (s) { return period(s, 4); })));
    const r = C.predict(data, SETTINGS, '2026-05-05');
    eq(r.irregular, true);
    eq(r.minCycle, 24);
    eq(r.maxCycle, 35);
    eq(r.cycleLength, 30, 'Mittel von 24,35,26,33 = 29.5 → 30');
    eq(r.predictions[0].rangeStart, '2026-05-23');
    eq(r.predictions[0].rangeEnd, '2026-06-03');
    assert(r.predictions[0].rangeStart !== r.predictions[0].rangeEnd);
  });

  test('Ausreißer (< 18 oder > 50 Tage) werden für die Vorhersage ignoriert, aber in der Statistik gezeigt', function () {
    // Zyklen 28, 60 (Ausreißer), 28
    const data = entries(concat(period('2026-01-01', 5), period('2026-01-29', 5), period('2026-03-30', 5), period('2026-04-27', 5)));
    const r = C.predict(data, SETTINGS, '2026-05-01');
    eq(r.cycleLength, 28);
    eq(r.validCycleCount, 2);
    eq(r.usingDefaults, false);
    const s = C.computeStats(data);
    eq(s.rows.length, 4);
    const outlier = s.rows.filter(function (x) { return x.outlier; });
    eq(outlier.length, 1);
    eq(outlier[0].cycleLength, 60);
    eq(s.avgCycle, 38.7, 'Statistik rechnet mit allen Zyklen');
  });

  test('Zu wenig Daten: Standardwerte aus den Einstellungen', function () {
    const data = entries(period('2026-02-10', 4));
    const r = C.predict(data, { defaultCycle: 30, defaultPeriod: 6 }, '2026-02-20');
    eq(r.usingDefaults, true);
    eq(r.cycleLength, 30);
    eq(r.periodLength, 6);
    eq(r.predictions[0].start, '2026-03-12');
    eq(r.predictions[0].end, '2026-03-17');
    eq(r.cycleDay, 11);
    // Ein vollständiger Zyklus reicht noch nicht (mindestens 2)
    const data2 = entries(concat(period('2026-01-10', 4), period('2026-02-10', 4)));
    eq(C.predict(data2, SETTINGS, '2026-02-20').usingDefaults, true);
  });

  test('Nur die letzten 6 Zyklen zählen für die Vorhersage', function () {
    // 3 alte Zyklen à 35 Tage, dann 6 Zyklen à 27 Tage
    const list = [];
    let d = '2025-01-01';
    for (let i = 0; i < 3; i++) { list.push.apply(list, period(d, 4)); d = C.addDays(d, 35); }
    for (let i = 0; i < 7; i++) { list.push.apply(list, period(d, 4)); d = C.addDays(d, 27); }
    const r = C.predict(entries(list), SETTINGS, C.addDays(d, -20));
    eq(r.cycleLength, 27);
    eq(r.irregular, false);
  });

  test('Jahreswechsel in der Vorhersage', function () {
    const data = entries(concat(period('2025-10-20', 5), period('2025-11-17', 5), period('2025-12-15', 5)));
    const r = C.predict(data, SETTINGS, '2025-12-28');
    eq(r.predictions[0].start, '2026-01-12');
    eq(r.predictions[0].ovulation, '2025-12-29');
    eq(r.predictions[0].fertileStart, '2025-12-24');
    eq(r.predictions[0].fertileEnd, '2025-12-30');
    eq(r.daysUntil, 15);
  });

  /* ---------------- Statistik ---------------- */

  test('Statistik: Schmerz-Heatmap pro Zyklustag', function () {
    const data = entries(concat(
      period('2026-01-01', 3, [{ pain: 6 }, { pain: 8 }, { pain: 2 }]),
      period('2026-01-29', 3, [{ pain: 4 }, { pain: 6 }, { pain: 0 }])
    ));
    const s = C.computeStats(data);
    eq(s.painHeatmap[0], { day: 1, avg: 5, max: 6, n: 2 });
    eq(s.painHeatmap[1], { day: 2, avg: 7, max: 8, n: 2 });
    eq(s.rows[1].avgPain, 5.3, 'Durchschnitt nur über Tage mit Schmerz');
    eq(s.rows[1].maxPain, 8);
  });

  /* ---------------- Google-Abbildung ---------------- */

  test('Event-IDs verwenden nur erlaubte Zeichen (a-v, 0-9)', function () {
    ['day', 'prediction', 'fertile'].forEach(function (t) {
      const id = C.eventId(t, '2026-09-22');
      assert(C.isValidEventId(id), id);
    });
    eq(C.eventId('day', '2026-09-22'), 'ckd20260922');
    assert(!C.isValidEventId('zyk20260922'), 'z ist nicht erlaubt');
    assert(!C.isValidEventId('abc'), 'zu kurz');
  });

  test('Tageseintrag → Event → Tageseintrag (Rundreise)', function () {
    const e = C.emptyEntry('2026-09-22');
    e.bleeding = 'heavy'; e.periodStart = true; e.pain = 6; e.painLocations = ['abdomen', 'back'];
    e.symptoms = ['cramps', 'fatigue']; e.mood = 'irritable'; e.medication = true;
    e.medicationName = 'Ibuprofen'; e.medicationCount = 2; e.product = 'tampon'; e.productChanges = 5;
    e.note = 'Test <b>Notiz</b> mit Umlauten äöü'; e.updatedAt = '2026-09-22T10:00:00.000Z';
    const periods = C.detectPeriods({ '2026-09-22': e });
    const ev = C.buildDayEvent(e, { periods: periods, discreet: false });
    eq(ev.start.date, '2026-09-22');
    eq(ev.end.date, '2026-09-23', 'Enddatum exklusiv');
    eq(ev.transparency, 'transparent');
    eq(ev.visibility, 'private');
    eq(ev.reminders.useDefault, false);
    eq(ev.colorId, C.COLOR.period);
    eq(ev.summary, '🩸 Periode Tag 1 · stark · Schmerz 6/10');
    assert(ev.description.indexOf('Ibuprofen ×2') >= 0);
    assert(ev.extendedProperties.private.data.length <= 1024);
    const back = C.parseEvent({ id: 'x', extendedProperties: ev.extendedProperties });
    eq(back.type, 'day');
    eq(back.entry, e);
  });

  test('Diskreter Modus: neutrale Titel ohne Gesundheitsbegriffe', function () {
    const data = entries(concat(period('2026-09-01', 5)));
    const periods = C.detectPeriods(data);
    const ev = C.buildDayEvent(data['2026-09-02'], { periods: periods, discreet: true });
    eq(ev.summary, '● Z2');
    const e2 = C.emptyEntry('2026-09-15'); e2.symptoms = ['headache'];
    eq(C.buildDayEvent(e2, { periods: periods, discreet: true }).summary, '○ Z15');
    eq(C.buildDayEvent(e2, { periods: periods, discreet: false }).summary, 'Symptome · Kopfschmerzen');
    const pred = { start: '2026-09-29', end: '2026-10-03', rangeStart: '2026-09-29', rangeEnd: '2026-09-29', ovulation: '2026-09-15', fertileStart: '2026-09-10', fertileEnd: '2026-09-16' };
    eq(C.buildPredictionEvent(pred, { discreet: true }).summary, '◌ ca.');
    eq(C.buildPredictionEvent(pred, { discreet: false }).summary, 'Periode erwartet (ca.)');
  });

  test('Vorhersage-Event: Erinnerung am Vortag um 20:00 = 240 Minuten vorher', function () {
    const pred = { start: '2026-09-29', end: '2026-10-03', rangeStart: '2026-09-29', rangeEnd: '2026-09-29', ovulation: '2026-09-15', fertileStart: '2026-09-10', fertileEnd: '2026-09-16' };
    const ev = C.buildPredictionEvent(pred, { reminderTime: '20:00' });
    eq(ev.reminders.overrides, [{ method: 'popup', minutes: 240 }]);
    eq(ev.end.date, '2026-10-04');
    eq(C.buildPredictionEvent(pred, {}).reminders.overrides, []);
    const f = C.buildFertileEvent(pred, {});
    eq(f.start.date, '2026-09-10');
    eq(f.end.date, '2026-09-17');
    eq(f.colorId, C.COLOR.fertile);
  });

  test('parseEvent ignoriert fremde und gelöschte Termine', function () {
    eq(C.parseEvent({ id: 'a', summary: 'Zahnarzt' }), null);
    eq(C.parseEvent({ id: 'a', extendedProperties: { private: { app: 'andere' } } }), null);
    eq(C.parseEvent({ id: 'a', status: 'cancelled', extendedProperties: { private: { app: 'zyklus', type: 'day', date: '2026-01-01', data: '{}' } } }), null);
    const r = C.parseEvent({ id: 'a', extendedProperties: { private: { app: 'zyklus', type: 'day', date: '2026-01-01', data: 'kein json' } } });
    eq(r.entry.bleeding, 'none', 'kaputte Daten ergeben einen leeren Eintrag');
  });

  test('normalizeEntry bereinigt Import-Daten', function () {
    const e = C.normalizeEntry({ date: '2026-01-01', bleeding: 'unsinn', pain: 99, symptoms: ['cramps', 'cramps', 'xyz'], note: 12 });
    eq(e.bleeding, 'none');
    eq(e.pain, 10);
    eq(e.symptoms, ['cramps']);
    eq(e.note, '');
    eq(C.normalizeEntry({ date: 'kein datum' }), null);
    assert(C.isEntryEmpty(C.emptyEntry('2026-01-01')));
    assert(!C.isEntryEmpty(e));
  });

  /* ---------------- Verschlüsselung (Phase 4, asynchron) ---------------- */

  test('Verschlüsselung: Rundreise mit Umlauten, falsches Passwort wird erkannt', async function () {
    assert(X && X.available(), 'Web Crypto verfügbar');
    const salt = X.randomSalt();
    assert(salt.length >= 20, 'Salt base64');
    const key = await X.deriveKey('geheim-Passwort', salt);
    const ct = await X.encrypt(key, 'Notiz äöü 🩸 <b>x</b>');
    assert(ct !== 'Notiz äöü 🩸 <b>x</b>' && ct.indexOf('Notiz') < 0, 'kein Klartext im Geheimtext');
    eq(await X.decrypt(key, ct), 'Notiz äöü 🩸 <b>x</b>');
    const ct2 = await X.encrypt(key, 'gleicher Text');
    assert(ct2 !== await X.encrypt(key, 'gleicher Text'), 'zufällige IV: gleicher Text ergibt anderen Geheimtext');
    const wrong = await X.deriveKey('geheim-passwort', salt); // nur Groß/Klein anders
    let failed = false;
    try { await X.decrypt(wrong, ct); } catch (e) { failed = true; }
    assert(failed, 'falsches Passwort muss fehlschlagen');
    const other = await X.deriveKey('geheim-Passwort', X.randomSalt());
    failed = false;
    try { await X.decrypt(other, ct); } catch (e) { failed = true; }
    assert(failed, 'anderes Salt muss fehlschlagen');
  });

  test('Verschlüsselung: Schlüssel export/import für die Tab-Sitzung, Stückelung langer Notizen', async function () {
    const key = await X.deriveKey('pw12345678', X.randomSalt());
    const raw = await X.exportKey(key);
    const key2 = await X.importKey(raw);
    eq(await X.decrypt(key2, await X.encrypt(key, 'hallo')), 'hallo');
    const long = new Array(1001).join('ä'); // 1000 Umlaute = 2000 Bytes
    const ct = await X.encrypt(key, long);
    const chunks = X.chunk(ct, 1000);
    assert(chunks.length >= 2 && chunks.every(function (c) { return c.length <= 1000; }), 'Stücke ≤ 1000 Zeichen');
    eq(await X.decrypt(key, chunks.join('')), long);
  });

  /* ---------------- Runner ---------------- */

  /** Führt alle Tests nacheinander aus (synchron oder asynchron) und meldet jedes Ergebnis. */
  async function run(report) {
    let passed = 0, failed = 0;
    for (const t of tests) {
      try { await t.fn(); passed++; report(true, t.name); }
      catch (err) { failed++; report(false, t.name, err.message); }
    }
    return { passed: passed, failed: failed, total: tests.length };
  }

  root.ZyklusTests = { run: run, tests: tests };

  // Direkt in Node ausführen: node tests.js
  if (typeof module !== 'undefined' && typeof require === 'function' && require.main === module) {
    run(function (ok, name, msg) {
      console.log((ok ? '  ok   ' : '  FAIL ') + name + (msg ? '\n         ' + msg : ''));
    }).then(function (res) {
      console.log('\n' + res.passed + '/' + res.total + ' Tests bestanden' + (res.failed ? ', ' + res.failed + ' fehlgeschlagen' : ''));
      process.exit(res.failed ? 1 : 0);
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
