/*
 * Zyklus – App (app.js)
 *
 * Gliederung:
 *   1. Konfiguration
 *   2. Speicher (localStorage nur als Cache, alles in try/catch)
 *   3. Zustand
 *   4. Google Sync (Anmeldung, REST-Aufrufe, Laden, Warteschlange, Vorhersagen)
 *   5. UI (Hilfsfunktionen, Übersicht, Kalender, Editor, Einstellungen, Export)
 *   6. Start
 *
 * Grundsätze:
 *   - Google Kalender ist die Quelle der Wahrheit, localStorage nur Cache.
 *   - Nutzerdaten werden ausschließlich per textContent gerendert, nie als HTML.
 *   - Das Access Token liegt nur im Arbeitsspeicher.
 *   - Vorbereitet für eine spätere Verschlüsselung: alle Google-Bodies entstehen
 *     in encodeForRemote()/decodeFromRemote(); dort könnte später ver- und
 *     entschlüsselt werden, ohne den Rest zu ändern.
 */
(function () {
  'use strict';
  const C = window.ZyklusCore;

  /* ================================================================== */
  /* 1. Konfiguration                                                    */
  /* ================================================================== */

  const APP_VERSION = '0.1.0';
  // Die Client ID ist öffentlich unkritisch. Sie steht im <meta name="google-client-id">
  // in index.html und kann alternativ in den Einstellungen eingetragen werden.
  const META_CLIENT_ID = (document.querySelector('meta[name="google-client-id"]') || {}).content || '';
  const SCOPE_MAIN = 'https://www.googleapis.com/auth/calendar.app.created';
  const SCOPE_LIST = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly';
  const API = 'https://www.googleapis.com/calendar/v3/';
  const LOAD_PAST_DAYS = 3 * 365;
  const LOAD_FUTURE_DAYS = 365;
  const TOKEN_SAFETY_MS = 60 * 1000;

  const DEFAULT_SETTINGS = {
    clientId: '',
    calendarId: '',
    calendarName: 'Zyklus',
    defaultCycle: 28,
    defaultPeriod: 5,
    discreet: false,
    writePredictions: true,
    writeFertile: false,
    reminder: false,
    reminderTime: '20:00',
    connectedBefore: false
  };

  /* ================================================================== */
  /* 2. Speicher                                                         */
  /* ================================================================== */

  const KEYS = { settings: 'zyklus.settings', entries: 'zyklus.entries', queue: 'zyklus.queue', remote: 'zyklus.remote' };
  const NOLOCAL_KEY = 'zyklus.nolocal';

  function noLocal() {
    try { return sessionStorage.getItem(NOLOCAL_KEY) === '1'; } catch (e) { return false; }
  }
  function setNoLocal(on) {
    try { if (on) sessionStorage.setItem(NOLOCAL_KEY, '1'); else sessionStorage.removeItem(NOLOCAL_KEY); } catch (e) { /* egal */ }
    if (on) clearLocal();
  }
  function storeGet(key, fallback) {
    if (noLocal()) return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function storeSet(key, value) {
    if (noLocal()) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* voll oder gesperrt */ }
  }
  function clearLocal() {
    try { Object.keys(KEYS).forEach(function (k) { localStorage.removeItem(KEYS[k]); }); } catch (e) { /* egal */ }
  }

  /* ================================================================== */
  /* 3. Zustand                                                          */
  /* ================================================================== */

  const state = {
    settings: Object.assign({}, DEFAULT_SETTINGS, storeGet(KEYS.settings, {})),
    entries: loadEntries(),
    queue: storeGet(KEYS.queue, []),
    // Bekannte Google-Termine: Datum → Event-ID, plus Signatur der zuletzt geschriebenen Vorhersagen
    remote: Object.assign({ days: {}, predictions: {}, fertile: {}, predSig: '' }, storeGet(KEYS.remote, {})),
    view: 'calendar',
    month: null,          // { y, m }
    pred: null,           // Ergebnis von C.predict
    editing: null,        // { entry, original, touchedStart }
    auth: { token: null, expiresAt: 0, client: null, pending: null, scope: '' },
    syncing: false,
    status: { kind: '', text: '' }
  };
  const today = function () { return C.todayISO(); };
  state.month = { y: +today().slice(0, 4), m: +today().slice(5, 7) };

  function loadEntries() {
    const raw = storeGet(KEYS.entries, {});
    const out = {};
    Object.keys(raw).forEach(function (k) {
      const e = C.normalizeEntry(raw[k]);
      if (e && !C.isEntryEmpty(e)) out[e.date] = e;
    });
    return out;
  }
  function persist() {
    storeSet(KEYS.entries, state.entries);
    storeSet(KEYS.queue, state.queue);
    storeSet(KEYS.remote, state.remote);
    storeSet(KEYS.settings, state.settings);
  }
  function recompute() {
    state.pred = C.predict(state.entries, state.settings, today());
  }
  function clientId() {
    return (state.settings.clientId || META_CLIENT_ID || '').trim();
  }

  /* ================================================================== */
  /* 4. Google Sync                                                      */
  /* ================================================================== */

  /* ---- 4.1 Anmeldung (Google Identity Services, Token Client) ---- */

  function gisReady() {
    return !!(window.google && google.accounts && google.accounts.oauth2);
  }
  function hasToken() {
    return !!state.auth.token && Date.now() < state.auth.expiresAt;
  }

  /**
   * Fordert ein Access Token an. Muss aus einem Klick/Tipp heraus aufgerufen werden,
   * sonst blockiert der Browser das Anmeldefenster.
   * opts: { prompt: ''|'consent', scope }
   */
  function requestToken(opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      if (!gisReady()) return reject(new Error('Google Anmeldung ist noch nicht geladen. Bitte kurz warten und erneut tippen.'));
      const id = clientId();
      if (!id) return reject(new Error('Keine Google Client ID hinterlegt. Bitte in den Einstellungen eintragen.'));
      const scope = opts.scope || SCOPE_MAIN;
      if (!state.auth.client || state.auth.clientIdUsed !== id) {
        state.auth.client = google.accounts.oauth2.initTokenClient({
          client_id: id,
          scope: SCOPE_MAIN,
          callback: function (resp) {
            const p = state.auth.pending; state.auth.pending = null;
            if (!resp || resp.error) {
              if (p) p.reject(new Error(describeAuthError(resp && resp.error)));
              return;
            }
            state.auth.token = resp.access_token;
            state.auth.expiresAt = Date.now() + (resp.expires_in * 1000) - TOKEN_SAFETY_MS;
            state.auth.scope = resp.scope || '';
            state.settings.connectedBefore = true;
            persist();
            if (p) p.resolve(resp);
          },
          error_callback: function (err) {
            const p = state.auth.pending; state.auth.pending = null;
            if (p) p.reject(new Error(describeAuthError(err && err.type)));
          }
        });
        state.auth.clientIdUsed = id;
      }
      state.auth.pending = { resolve: resolve, reject: reject };
      state.auth.client.requestAccessToken({
        prompt: opts.prompt !== undefined ? opts.prompt : (state.settings.connectedBefore ? '' : 'consent'),
        scope: scope,
        include_granted_scopes: true
      });
    });
  }

  function describeAuthError(code) {
    switch (code) {
      case 'popup_closed': return 'Anmeldefenster wurde geschlossen.';
      case 'popup_failed_to_open': return 'Das Anmeldefenster wurde blockiert. Bitte Popups für diese Seite erlauben.';
      case 'access_denied': return 'Zugriff abgelehnt. Ist das Google Konto als Testnutzer eingetragen?';
      case 'invalid_client': return 'Client ID ungültig (Fehler invalid_client).';
      default: return 'Anmeldung fehlgeschlagen' + (code ? ' (' + code + ')' : '') + '.';
    }
  }

  function disconnect() {
    const t = state.auth.token;
    state.auth.token = null; state.auth.expiresAt = 0;
    if (t && gisReady()) { try { google.accounts.oauth2.revoke(t, function () {}); } catch (e) { /* egal */ } }
    state.settings.connectedBefore = false;
    // Lokalen Cache komplett leeren (Einträge, Warteschlange, bekannte Termine);
    // Einstellungen inkl. Kalender ID bleiben, sonst würde beim nächsten Verbinden
    // ein zweiter Kalender entstehen.
    state.entries = {}; state.queue = [];
    state.remote = { days: {}, predictions: {}, fertile: {}, predSig: '' };
    clearLocal();
    storeSet(KEYS.settings, state.settings);
    recompute();
    setStatus('', 'nicht verbunden');
    render();
  }

  /* ---- 4.2 REST-Aufrufe ---- */

  function AuthError(msg) { this.name = 'AuthError'; this.message = msg; }
  AuthError.prototype = Object.create(Error.prototype);

  async function api(method, path, body, query, attempt) {
    if (!hasToken()) throw new AuthError('Verbindung abgelaufen');
    let url = API + path;
    if (query) {
      const q = Object.keys(query).filter(function (k) { return query[k] !== undefined && query[k] !== null; })
        .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]); }).join('&');
      if (q) url += '?' + q;
    }
    const opts = { method: method, headers: { Authorization: 'Bearer ' + state.auth.token } };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (res.status === 401) {
      state.auth.token = null; state.auth.expiresAt = 0;
      throw new AuthError('Verbindung abgelaufen');
    }
    if (res.status === 204) return null;
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const reason = (data && data.error && data.error.errors && data.error.errors[0] && data.error.errors[0].reason) || '';
      const rateLimited = res.status === 429 || (res.status === 403 && /rateLimit|quota/i.test(reason));
      if ((rateLimited || res.status >= 500) && (attempt || 0) < 3) {
        // Ratenlimit oder Serverfehler: kurz warten und erneut versuchen
        await new Promise(function (r) { setTimeout(r, 800 * Math.pow(2, attempt || 0)); });
        return api(method, path, body, query, (attempt || 0) + 1);
      }
      const err = new Error((data && data.error && data.error.message) || ('HTTP ' + res.status));
      err.status = res.status;
      err.reason = reason;
      throw err;
    }
    return data;
  }

  /* ---- 4.3 Kalender anlegen / finden ---- */

  async function ensureCalendar() {
    const s = state.settings;
    if (s.calendarId) {
      try {
        await api('GET', 'calendars/' + encodeURIComponent(s.calendarId));
        return s.calendarId;
      } catch (e) {
        if (e instanceof AuthError) throw e;
        if (e.status !== 404 && e.status !== 403) throw e;
        // Kalender nicht gefunden (gelöscht, falsche ID oder nicht von der App angelegt)
        if (!confirm('Der Kalender mit der gespeicherten ID wurde nicht gefunden.\n\nNeuen Kalender „' + (s.calendarName || 'Zyklus') + '“ anlegen? (Abbrechen, wenn du die Kalender ID in den Einstellungen prüfen willst.)')) {
          throw new Error('Kalender nicht gefunden. Bitte Kalender ID prüfen.');
        }
        s.calendarId = '';
      }
    }
    const cal = await api('POST', 'calendars', {
      summary: s.calendarName || 'Zyklus',
      description: 'Kalender der Zyklus App. Einträge bitte in der App bearbeiten. Nicht teilen.',
      timeZone: (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Europe/Berlin'
    });
    s.calendarId = cal.id;
    persist();
    toast('Kalender „' + (s.calendarName || 'Zyklus') + '“ in Google angelegt');
    return cal.id;
  }

  /** Sucht den App-Kalender über die Kalenderliste (braucht den Zusatz-Scope). */
  async function findCalendar() {
    await requestToken({ scope: SCOPE_MAIN + ' ' + SCOPE_LIST, prompt: '' });
    let pageToken = null, found = [];
    do {
      const res = await api('GET', 'users/me/calendarList', undefined, { minAccessRole: 'owner', maxResults: 250, pageToken: pageToken });
      (res.items || []).forEach(function (c) {
        if ((c.description || '').indexOf('Zyklus App') >= 0 || c.summary === (state.settings.calendarName || 'Zyklus')) found.push(c);
      });
      pageToken = res.nextPageToken;
    } while (pageToken);
    if (!found.length) throw new Error('Kein Kalender „' + (state.settings.calendarName || 'Zyklus') + '“ gefunden.');
    state.settings.calendarId = found[0].id;
    persist();
    return found[0];
  }

  /* ---- 4.4 Laden ---- */

  /** Hier könnte später entschlüsselt werden. */
  function decodeFromRemote(ev) { return C.parseEvent(ev); }
  /** Hier könnte später verschlüsselt werden. */
  function encodeForRemote(body) { return body; }

  async function loadRemote() {
    const calId = state.settings.calendarId;
    const t = today();
    const entries = {}, remote = { days: {}, predictions: {}, fertile: {}, predSig: state.remote.predSig };
    let pageToken = null;
    do {
      const res = await api('GET', 'calendars/' + encodeURIComponent(calId) + '/events', undefined, {
        privateExtendedProperty: 'app=' + C.APP_ID,
        singleEvents: 'true',
        showDeleted: 'false',
        maxResults: 2500,
        timeMin: C.addDays(t, -LOAD_PAST_DAYS) + 'T00:00:00Z',
        timeMax: C.addDays(t, LOAD_FUTURE_DAYS) + 'T00:00:00Z',
        fields: 'nextPageToken,items(id,status,start,end,extendedProperties)',
        pageToken: pageToken
      });
      (res.items || []).forEach(function (ev) {
        const parsed = decodeFromRemote(ev);
        if (!parsed) return;
        if (parsed.type === 'day') {
          if (!C.isEntryEmpty(parsed.entry)) entries[parsed.entry.date] = parsed.entry;
          remote.days[parsed.entry.date] = ev.id;
        } else if (parsed.type === 'prediction') {
          remote.predictions[parsed.date] = ev.id;
        } else if (parsed.type === 'fertile') {
          remote.fertile[parsed.date] = ev.id;
        }
      });
      pageToken = res.nextPageToken;
    } while (pageToken);
    return { entries: entries, remote: remote };
  }

  /* ---- 4.5 Warteschlange (Änderungen, die noch nach Google müssen) ---- */

  function enqueue(op) {
    // Pro Datum nur die letzte Änderung behalten
    state.queue = state.queue.filter(function (q) { return q.date !== op.date; });
    state.queue.push(op);
    persist();
  }

  function queueDay(date) {
    const e = state.entries[date];
    if (e) enqueue({ op: 'upsert', date: date, entry: e, ts: Date.now() });
    else enqueue({ op: 'delete', date: date, ts: Date.now() });
  }

  async function pushDay(entry) {
    const calId = state.settings.calendarId;
    const id = C.eventId('day', entry.date);
    const body = encodeForRemote(C.buildDayEvent(entry, { periods: state.pred.periods, discreet: state.settings.discreet }));
    await upsertEvent(calId, id, body);
    state.remote.days[entry.date] = id;
  }

  async function upsertEvent(calId, id, body) {
    const base = 'calendars/' + encodeURIComponent(calId) + '/events';
    try {
      await api('POST', base, Object.assign({ id: id }, body));
    } catch (e) {
      if (e instanceof AuthError || e.status !== 409) throw e;
      // ID existiert bereits (auch wenn der Termin früher gelöscht wurde): überschreiben und wiederbeleben
      await api('PUT', base + '/' + id, Object.assign({ status: 'confirmed' }, body));
    }
  }

  async function deleteEvent(calId, id) {
    try {
      await api('DELETE', 'calendars/' + encodeURIComponent(calId) + '/events/' + id);
    } catch (e) {
      if (e instanceof AuthError) throw e;
      if (e.status !== 404 && e.status !== 410) throw e;
    }
  }

  async function flushQueue() {
    const calId = state.settings.calendarId;
    while (state.queue.length) {
      const op = state.queue[0];
      if (op.op === 'upsert') {
        const entry = state.entries[op.date] || C.normalizeEntry(op.entry);
        if (entry && !C.isEntryEmpty(entry)) await pushDay(entry);
        else await deleteEvent(calId, C.eventId('day', op.date));
      } else {
        await deleteEvent(calId, C.eventId('day', op.date));
        delete state.remote.days[op.date];
      }
      state.queue.shift();
      persist();
    }
  }

  /* ---- 4.6 Vorhersagen nach Google schreiben ---- */

  async function syncPredictions() {
    const s = state.settings, calId = s.calendarId, p = state.pred;
    const ctx = { discreet: s.discreet, reminderTime: s.reminder ? s.reminderTime : null };
    const wantPred = {}, wantFert = {};
    if (p && p.predictions.length) {
      p.predictions.forEach(function (pr, i) {
        if (s.writePredictions) wantPred[pr.start] = C.buildPredictionEvent(pr, Object.assign({}, ctx, { reminderTime: i === 0 ? ctx.reminderTime : null }));
        if (s.writeFertile) wantFert[pr.fertileStart] = C.buildFertileEvent(pr, ctx);
      });
    }
    const sig = JSON.stringify([wantPred, wantFert, Object.keys(state.remote.predictions).sort(), Object.keys(state.remote.fertile).sort()]);
    if (sig === state.remote.predSig) return; // nichts geändert

    // Alte Vorhersagen löschen
    const stalePred = Object.keys(state.remote.predictions).filter(function (d) { return !wantPred[d]; });
    for (const d of stalePred) { await deleteEvent(calId, state.remote.predictions[d]); delete state.remote.predictions[d]; }
    const staleFert = Object.keys(state.remote.fertile).filter(function (d) { return !wantFert[d]; });
    for (const d of staleFert) { await deleteEvent(calId, state.remote.fertile[d]); delete state.remote.fertile[d]; }
    // Neue schreiben
    for (const d of Object.keys(wantPred)) {
      const id = C.eventId('prediction', d);
      await upsertEvent(calId, id, encodeForRemote(wantPred[d]));
      state.remote.predictions[d] = id;
    }
    for (const d of Object.keys(wantFert)) {
      const id = C.eventId('fertile', d);
      await upsertEvent(calId, id, encodeForRemote(wantFert[d]));
      state.remote.fertile[d] = id;
    }
    state.remote.predSig = JSON.stringify([wantPred, wantFert, Object.keys(state.remote.predictions).sort(), Object.keys(state.remote.fertile).sort()]);
    persist();
  }

  /* ---- 4.7 Ablauf: verbinden, laden, hochladen ---- */

  /** Vollständige Synchronisierung. Google gewinnt, offene lokale Änderungen werden danach hochgeladen. */
  async function fullSync() {
    if (state.syncing) return;
    state.syncing = true;
    setStatus('busy', 'wird geladen …');
    try {
      await ensureCalendar();
      const remote = await loadRemote();
      // Lokale, noch nicht hochgeladene Änderungen behalten
      state.queue.forEach(function (op) {
        if (op.op === 'upsert' && op.entry) remote.entries[op.date] = C.normalizeEntry(op.entry);
        else delete remote.entries[op.date];
      });
      state.entries = remote.entries;
      state.remote = remote.remote;
      recompute();
      render();
      setStatus('busy', 'wird gespeichert …');
      await flushQueue();
      await syncPredictions();
      persist();
      setStatus('ok', 'synchronisiert');
    } catch (e) {
      handleSyncError(e);
    } finally {
      state.syncing = false;
      render();
    }
  }

  /** Nur hochladen (nach einer Änderung). */
  async function pushChanges() {
    if (state.syncing) return;
    if (!hasToken()) { setStatus(state.settings.connectedBefore ? 'warn' : '', state.settings.connectedBefore ? 'Verbindung erneuern' : 'nicht verbunden'); return; }
    if (!navigator.onLine) { setStatus('warn', 'offline'); return; }
    state.syncing = true;
    setStatus('busy', 'wird gespeichert …');
    try {
      await ensureCalendar();
      await flushQueue();
      await syncPredictions();
      setStatus('ok', 'synchronisiert');
    } catch (e) {
      handleSyncError(e);
    } finally {
      state.syncing = false;
      renderStatus();
    }
  }

  function handleSyncError(e) {
    console.warn('Sync', e);
    if (e instanceof AuthError) setStatus('warn', 'Verbindung erneuern');
    else if (!navigator.onLine) setStatus('warn', 'offline');
    else setStatus('err', 'Fehler: ' + (e.message || e));
  }

  /** Aus einem Klick heraus: anmelden (oder Token erneuern) und dann synchronisieren. */
  async function connectAndSync(opts) {
    try {
      if (!hasToken()) {
        setStatus('busy', 'Anmeldung …');
        await requestToken(opts || {});
      }
      await fullSync();
    } catch (e) {
      handleSyncError(e);
      render();
    }
  }

  /* ================================================================== */
  /* 5. UI                                                               */
  /* ================================================================== */

  /* ---- 5.1 Hilfsfunktionen ---- */

  const $ = function (id) { return document.getElementById(id); };
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function setStatus(kind, text) {
    state.status = { kind: kind, text: text };
    renderStatus();
  }
  function renderStatus() {
    const chip = $('sync-status');
    chip.className = 'status' + (state.status.kind ? ' ' + state.status.kind : '');
    let text = state.status.text || 'nicht verbunden';
    if (state.queue.length && state.status.kind !== 'busy') text += ' · ' + state.queue.length + ' offen';
    chip.textContent = text;
    const top = $('btn-connect-top');
    const needs = !hasToken();
    top.hidden = !needs;
    top.textContent = state.settings.connectedBefore ? 'Erneut verbinden' : 'Verbinden';
    $('btn-connect').textContent = hasToken() ? 'Verbunden' : (state.settings.connectedBefore ? 'Erneut verbinden' : 'Mit Google verbinden');
    $('btn-connect').disabled = hasToken();
    $('btn-sync').disabled = !hasToken();
    const gs = $('google-status');
    if (hasToken()) gs.textContent = 'Verbunden. Kalender: ' + (state.settings.calendarId ? state.settings.calendarName || 'Zyklus' : 'wird angelegt') + '. Status: ' + (state.status.text || '');
    else if (state.settings.connectedBefore) gs.textContent = 'Verbindung abgelaufen. Einträge werden lokal gesammelt und beim nächsten Verbinden hochgeladen.' + (state.queue.length ? ' Offen: ' + state.queue.length : '');
    else gs.textContent = 'Nicht verbunden. Einträge werden nur in diesem Browser gespeichert.';
  }

  /* ---- 5.2 Ansichten wechseln ---- */

  function showView(name) {
    state.view = name;
    document.querySelectorAll('section.view').forEach(function (s) { s.classList.toggle('active', s.id === 'view-' + name); });
    document.querySelectorAll('nav.tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === name); });
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    renderStatus();
    if (state.view === 'calendar') { renderOverview(); renderCalendar(); }
    else if (state.view === 'stats' && window.ZyklusStats) window.ZyklusStats.render(state);
    else if (state.view === 'report' && window.ZyklusStats) window.ZyklusStats.renderReport(state);
    else if (state.view === 'settings') renderSettings();
  }

  /* ---- 5.3 Übersicht ---- */

  function renderOverview() {
    const p = state.pred, t = today();
    $('ov-day').textContent = p.cycleDay ? String(p.cycleDay) : '–';
    $('ov-phase').textContent = C.PHASE_LABEL[p.phase] || '–';
    let hint = '';
    if (p.phase === 'ovulation') hint = 'Eisprung ca. ' + C.formatShortDE(p.predictions[0].ovulation);
    else if (p.phase === 'follicular') hint = 'Fruchtbares Fenster ab ' + C.formatShortDE(p.predictions[0].fertileStart);
    else if (p.phase === 'menstruation' && p.lastPeriod) hint = 'Periode seit ' + C.formatShortDE(p.lastPeriod.start);
    $('ov-phase-hint').textContent = hint;
    const next = $('ov-next');
    clear(next);
    if (!p.predictions.length) {
      next.textContent = 'Noch keine Periode eingetragen. Tipp auf einen Tag oder auf „Periode hat heute begonnen“.';
    } else {
      const n = p.predictions[0];
      if (p.overdueDays > 0) {
        next.appendChild(el('strong', { text: p.overdueDays + ' Tag' + (p.overdueDays === 1 ? '' : 'e') + ' über der Zeit' }));
        next.appendChild(el('div', { class: 'small muted', text: 'Erwartet war der ' + C.formatDE(n.start) + '. Trag die Periode ein, sobald sie beginnt.' }));
      } else if (p.irregular) {
        next.appendChild(el('strong', { text: 'Nächste Periode ca. ' + C.formatShortDE(n.rangeStart) + ' bis ' + C.formatDE(n.rangeEnd) }));
        next.appendChild(el('div', { class: 'small muted', text: 'In ca. ' + p.daysUntil + ' Tagen (' + C.formatDE(n.start) + '). Deine Zyklen schwanken um mehr als 7 Tage, deshalb ein Zeitraum.' }));
      } else {
        const d = p.daysUntil;
        next.appendChild(el('strong', { text: d === 0 ? 'Nächste Periode: heute erwartet' : 'Nächste Periode in ca. ' + d + ' Tag' + (d === 1 ? '' : 'en') + ' (' + C.formatDE(n.start) + ')' }));
        next.appendChild(el('div', { class: 'small muted', text: 'Zyklus ca. ' + p.cycleLength + ' Tage, Periode ca. ' + p.periodLength + ' Tage' + (p.usingDefaults ? ' (Standardwerte)' : ' (Ø der letzten ' + p.validCycleCount + ' Zyklen)') }));
      }
    }
    $('ov-defaults').hidden = !(p.usingDefaults && p.predictions.length);
    $('btn-period-today').hidden = !!(state.entries[t] && state.entries[t].periodStart);
  }

  /* ---- 5.4 Kalender ---- */

  function renderCalendar() {
    const y = state.month.y, m = state.month.m, t = today();
    $('cal-title').textContent = C.MONTHS_DE[m - 1] + ' ' + y;
    const grid = $('cal-grid');
    clear(grid);
    const first = y + '-' + (m < 10 ? '0' : '') + m + '-01';
    const lead = C.weekdayMon(first);
    const n = C.daysInMonth(y, m);
    const p = state.pred;
    const periodStarts = {};
    p.periods.forEach(function (pp) { periodStarts[pp.start] = true; });

    for (let i = 0; i < lead; i++) grid.appendChild(el('div', { class: 'day empty' }));
    for (let d = 1; d <= n; d++) {
      const date = y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
      const e = state.entries[date];
      const cls = ['day'];
      if (date === t) cls.push('today');
      if (date > t) cls.push('future');
      if (e && C.hasBleeding(e)) cls.push('b-' + e.bleeding);
      if (periodStarts[date]) cls.push('start');
      let ovu = false;
      if (!(e && C.hasBleeding(e)) && date >= (p.lastPeriod ? p.lastPeriod.start : t)) {
        p.predictions.forEach(function (pr) {
          if (date >= pr.fertileStart && date <= pr.fertileEnd) cls.push('fertile');
          if (date === pr.ovulation) ovu = true;
          if (p.irregular) { if (date >= pr.rangeStart && date <= pr.rangeEnd) cls.push('pred', 'range'); }
          else if (date >= pr.start && date <= pr.end) cls.push('pred');
        });
      }
      const marks = [];
      if (e && e.pain > 0) marks.push('⚡');
      if (e && (e.symptoms.length || e.mood)) marks.push('✦');
      if (e && e.note) marks.push('✎');
      const cell = el('button', {
        type: 'button', class: cls.join(' '), 'data-date': date,
        'aria-label': C.formatLongDE(date) + (e ? ', Eintrag vorhanden' : ''),
        onclick: function () { openEditor(date); }
      }, [
        el('span', { class: 'num', text: String(d) }),
        marks.length ? el('span', { class: 'marks', text: marks.join('') }) : null,
        ovu ? el('span', { class: 'ovu', title: 'Eisprung (ca.)' }) : null
      ]);
      grid.appendChild(cell);
    }
  }

  function shiftMonth(delta) {
    let m = state.month.m + delta, y = state.month.y;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    state.month = { y: y, m: m };
    renderCalendar();
  }

  /* ---- 5.5 Editor ---- */

  function buildChips(container, keys, labels, onToggle) {
    clear(container);
    keys.forEach(function (k) {
      container.appendChild(el('button', { type: 'button', class: 'chip', 'data-v': k, 'aria-pressed': 'false', text: labels[k], onclick: function () { onToggle(k); } }));
    });
  }
  function setChips(container, selected) {
    container.querySelectorAll('.chip').forEach(function (b) {
      b.setAttribute('aria-pressed', selected.indexOf(b.dataset.v) >= 0 ? 'true' : 'false');
    });
  }

  function initEditor() {
    buildChips($('ed-pain-loc'), C.PAIN_LOCATIONS, C.PAIN_LOCATION_LABEL, function (k) { toggleIn(state.editing.entry.painLocations, k); setChips($('ed-pain-loc'), state.editing.entry.painLocations); });
    buildChips($('ed-symptoms'), C.SYMPTOMS, C.SYMPTOM_LABEL, function (k) { toggleIn(state.editing.entry.symptoms, k); setChips($('ed-symptoms'), state.editing.entry.symptoms); });
    buildChips($('ed-mood'), C.MOODS, C.MOOD_LABEL, function (k) { const e = state.editing.entry; e.mood = e.mood === k ? null : k; setChips($('ed-mood'), e.mood ? [e.mood] : []); });
    buildChips($('ed-product'), C.PRODUCTS, C.PRODUCT_LABEL, function (k) { const e = state.editing.entry; e.product = e.product === k ? null : k; setChips($('ed-product'), e.product ? [e.product] : []); });

    $('ed-bleeding').querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        const ed = state.editing; ed.entry.bleeding = b.dataset.v;
        if (!ed.touchedStart && !ed.original.periodStart) {
          ed.entry.periodStart = C.suggestPeriodStart(state.entries, ed.entry.date, ed.entry.bleeding);
          ed.autoStart = ed.entry.periodStart;
        }
        renderEditorFields();
      });
    });
    $('ed-period-start').addEventListener('change', function () {
      state.editing.touchedStart = true; state.editing.autoStart = false;
      state.editing.entry.periodStart = this.checked;
      renderEditorFields();
    });
    $('ed-pain').addEventListener('input', function () { state.editing.entry.pain = +this.value; $('ed-pain-out').textContent = this.value + '/10'; });
    $('ed-med').addEventListener('change', function () { state.editing.entry.medication = this.checked; $('ed-med-details').hidden = !this.checked; });
    $('ed-med-name').addEventListener('input', function () { state.editing.entry.medicationName = this.value.slice(0, 80); });
    $('ed-med-count').addEventListener('input', function () { state.editing.entry.medicationCount = Math.max(0, Math.min(99, parseInt(this.value, 10) || 0)); });
    $('ed-product-changes').addEventListener('input', function () { state.editing.entry.productChanges = Math.max(0, Math.min(99, parseInt(this.value, 10) || 0)); });
    $('ed-note').addEventListener('input', function () { state.editing.entry.note = this.value.slice(0, C.NOTE_MAX); });

    $('editor-close').addEventListener('click', function () { $('editor').close(); });
    $('editor').addEventListener('click', function (ev) { if (ev.target === $('editor')) $('editor').close(); });
    $('editor-form').addEventListener('submit', function (ev) { ev.preventDefault(); saveFromEditor(); });
    $('editor-delete').addEventListener('click', function () {
      const date = state.editing.entry.date;
      if (state.entries[date] && !confirm('Eintrag vom ' + C.formatDE(date) + ' löschen?')) return;
      applyEntry(C.emptyEntry(date));
      $('editor').close();
      toast('Eintrag gelöscht');
    });
  }

  function toggleIn(arr, k) { const i = arr.indexOf(k); if (i >= 0) arr.splice(i, 1); else arr.push(k); }

  function openEditor(date) {
    const original = state.entries[date] || C.emptyEntry(date);
    state.editing = { entry: JSON.parse(JSON.stringify(original)), original: original, touchedStart: false, autoStart: false };
    $('editor-title').textContent = C.formatLongDE(date) + (date === today() ? ' (heute)' : '');
    $('editor-delete').hidden = !state.entries[date];
    renderEditorFields();
    const dlg = $('editor');
    if (!dlg.open) dlg.showModal();
    $('editor').querySelector('.sheet-body').scrollTop = 0;
  }

  function renderEditorFields() {
    const e = state.editing.entry;
    $('ed-bleeding').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === e.bleeding ? 'true' : 'false'); });
    $('ed-period-start').checked = e.periodStart;
    $('ed-start-hint').textContent = state.editing.autoStart ? 'Automatisch vorgeschlagen, kann geändert werden' :
      (C.BLEEDING_RANK[e.bleeding] >= 2 && !e.periodStart ? 'Gehört zur laufenden Periode' : '');
    $('ed-pain').value = e.pain; $('ed-pain-out').textContent = e.pain + '/10';
    setChips($('ed-pain-loc'), e.painLocations);
    setChips($('ed-symptoms'), e.symptoms);
    setChips($('ed-mood'), e.mood ? [e.mood] : []);
    setChips($('ed-product'), e.product ? [e.product] : []);
    $('ed-med').checked = e.medication; $('ed-med-details').hidden = !e.medication;
    $('ed-med-name').value = e.medicationName; $('ed-med-count').value = e.medicationCount || '';
    $('ed-product-changes').value = e.productChanges || '';
    $('ed-note').value = e.note;
  }

  function saveFromEditor() {
    const e = C.normalizeEntry(state.editing.entry);
    applyEntry(e);
    $('editor').close();
    toast(C.isEntryEmpty(e) ? 'Eintrag gelöscht' : 'Gespeichert');
  }

  /**
   * Übernimmt einen Eintrag: lokal speichern, in die Warteschlange, neu rechnen.
   * Nachbartage derselben Periode werden mit hochgeladen, weil sich ihre Titel
   * ("Periode Tag 2") ändern können.
   */
  function applyEntry(entry) {
    const date = entry.date;
    const before = periodContaining(state.pred.periods, date);
    if (C.isEntryEmpty(entry)) delete state.entries[date];
    else { entry.updatedAt = new Date().toISOString(); state.entries[date] = entry; }
    recompute();
    const after = periodContaining(state.pred.periods, date);
    const affected = {};
    affected[date] = true;
    [before, after].forEach(function (p) { if (p) p.days.forEach(function (d) { affected[d.date] = true; }); });
    Object.keys(affected).forEach(function (d) { if (d === date || state.entries[d]) queueDay(d); });
    persist();
    render();
    // Aus einem Klick heraus: abgelaufene Verbindung still erneuern, sonst direkt hochladen
    if (!hasToken() && state.settings.connectedBefore && gisReady() && navigator.onLine) {
      requestToken({ prompt: '' }).then(pushChanges).catch(function () { setStatus('warn', 'Verbindung erneuern'); });
    } else {
      pushChanges();
    }
  }
  function periodContaining(periods, date) {
    for (let i = 0; i < periods.length; i++) {
      if (date >= periods[i].start && date <= periods[i].end) return periods[i];
    }
    return null;
  }

  function periodToday() {
    const t = today();
    const e = JSON.parse(JSON.stringify(state.entries[t] || C.emptyEntry(t)));
    if (C.BLEEDING_RANK[e.bleeding] < 2) e.bleeding = 'medium';
    e.periodStart = true;
    applyEntry(C.normalizeEntry(e));
    toast('Periodenstart für heute eingetragen');
    openEditor(t);
  }

  /* ---- 5.6 Einstellungen ---- */

  function renderSettings() {
    const s = state.settings;
    $('set-client-id').value = s.clientId;
    $('set-client-id').placeholder = META_CLIENT_ID ? 'im Code hinterlegt: ' + META_CLIENT_ID.slice(0, 18) + '…' : '…apps.googleusercontent.com';
    $('set-calendar-name').value = s.calendarName;
    $('set-calendar-id').value = s.calendarId;
    $('set-cycle').value = s.defaultCycle;
    $('set-period').value = s.defaultPeriod;
    $('set-write-pred').checked = s.writePredictions;
    $('set-write-fertile').checked = s.writeFertile;
    $('set-reminder').checked = s.reminder;
    $('set-reminder-time').value = s.reminderTime;
    $('set-reminder-time-row').hidden = !s.reminder;
    $('set-discreet').checked = s.discreet;
    $('set-nolocal').checked = noLocal();
    $('btn-disconnect').disabled = !hasToken() && !s.connectedBefore;
    $('app-version').textContent = 'Version ' + APP_VERSION;
  }

  function bindSettings() {
    function onChange(id, fn) { $(id).addEventListener('change', function () { fn(this); persist(); recompute(); render(); }); }
    onChange('set-client-id', function (i) { state.settings.clientId = i.value.trim(); state.auth.client = null; });
    onChange('set-calendar-name', function (i) { state.settings.calendarName = i.value.trim().slice(0, 60) || 'Zyklus'; });
    onChange('set-calendar-id', function (i) { state.settings.calendarId = i.value.trim(); });
    onChange('set-cycle', function (i) { state.settings.defaultCycle = Math.max(15, Math.min(90, parseInt(i.value, 10) || 28)); });
    onChange('set-period', function (i) { state.settings.defaultPeriod = Math.max(1, Math.min(14, parseInt(i.value, 10) || 5)); });
    onChange('set-write-pred', function (i) { state.settings.writePredictions = i.checked; pushChanges(); });
    onChange('set-write-fertile', function (i) { state.settings.writeFertile = i.checked; pushChanges(); });
    onChange('set-reminder', function (i) { state.settings.reminder = i.checked; pushChanges(); });
    onChange('set-reminder-time', function (i) { state.settings.reminderTime = /^\d{2}:\d{2}$/.test(i.value) ? i.value : '20:00'; pushChanges(); });
    onChange('set-discreet', function (i) {
      state.settings.discreet = i.checked;
      // Alle Termine bekommen neue Titel → alles neu hochladen
      Object.keys(state.entries).forEach(queueDay);
      state.remote.predSig = '';
      pushChanges();
    });
    $('set-nolocal').addEventListener('change', function () {
      setNoLocal(this.checked);
      if (!this.checked) persist();
      toast(this.checked ? 'Es wird nichts mehr lokal gespeichert' : 'Lokaler Cache wieder aktiv');
    });

    $('btn-connect').addEventListener('click', function () { connectAndSync(); });
    $('btn-connect-top').addEventListener('click', function () { connectAndSync(); });
    $('btn-sync').addEventListener('click', function () { connectAndSync(); });
    $('btn-disconnect').addEventListener('click', function () {
      if (!confirm('Von Google trennen? Der lokale Cache wird gelöscht. Die Daten bleiben in deinem Google Kalender.')) return;
      disconnect();
      toast('Getrennt');
    });
    $('btn-find-calendar').addEventListener('click', async function () {
      try {
        setStatus('busy', 'suche Kalender …');
        const cal = await findCalendar();
        toast('Gefunden: ' + cal.summary);
        render();
        await fullSync();
      } catch (e) { handleSyncError(e); render(); }
    });

    $('btn-export').addEventListener('click', exportJSON);
    $('btn-import').addEventListener('click', function () { $('import-file').click(); });
    $('import-file').addEventListener('change', importJSON);
    $('btn-delete-all').addEventListener('click', deleteAll);
  }

  /* ---- 5.7 Export / Import / Löschen ---- */

  function exportJSON() {
    const data = {
      app: C.APP_ID, version: C.DATA_VERSION, exportedAt: new Date().toISOString(),
      settings: { defaultCycle: state.settings.defaultCycle, defaultPeriod: state.settings.defaultPeriod },
      entries: Object.keys(state.entries).sort().map(function (k) { return state.entries[k]; })
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: 'zyklus-export-' + today() + '.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Export erstellt (' + data.entries.length + ' Einträge)');
  }

  function importJSON(ev) {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      let data;
      try { data = JSON.parse(reader.result); } catch (e) { toast('Datei ist kein gültiges JSON'); return; }
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.entries) ? data.entries : null);
      if (!list) { toast('Kein Zyklus Export erkannt'); return; }
      let n = 0;
      list.forEach(function (raw) {
        const e = C.normalizeEntry(raw);
        if (!e || C.isEntryEmpty(e)) return;
        state.entries[e.date] = e; queueDay(e.date); n++;
      });
      recompute(); persist(); render();
      toast(n + ' Einträge importiert');
      pushChanges();
    };
    reader.readAsText(file);
  }

  async function deleteAll() {
    if (!confirm('Wirklich ALLE Einträge löschen? Das betrifft auch den Google Kalender „' + state.settings.calendarName + '“.')) return;
    if (!confirm('Letzte Sicherheitsfrage: Alle Zyklusdaten unwiderruflich löschen?')) return;
    try {
      if (hasToken() && state.settings.calendarId) {
        setStatus('busy', 'lösche …');
        const remote = await loadRemote();
        const calId = state.settings.calendarId;
        const ids = [].concat(
          Object.keys(remote.remote.days).map(function (d) { return remote.remote.days[d]; }),
          Object.keys(remote.remote.predictions).map(function (d) { return remote.remote.predictions[d]; }),
          Object.keys(remote.remote.fertile).map(function (d) { return remote.remote.fertile[d]; })
        );
        for (const id of ids) await deleteEvent(calId, id);
      }
      state.entries = {}; state.queue = [];
      state.remote = { days: {}, predictions: {}, fertile: {}, predSig: '' };
      persist(); recompute();
      setStatus(hasToken() ? 'ok' : '', hasToken() ? 'synchronisiert' : 'nicht verbunden');
      render();
      toast('Alle Daten gelöscht');
    } catch (e) { handleSyncError(e); render(); }
  }

  /* ---- 5.8 Gesten und Tastatur ---- */

  function bindCalendarNav() {
    $('cal-prev').addEventListener('click', function () { shiftMonth(-1); });
    $('cal-next').addEventListener('click', function () { shiftMonth(1); });
    $('cal-today').addEventListener('click', function () {
      state.month = { y: +today().slice(0, 4), m: +today().slice(5, 7) }; renderCalendar();
    });
    let sx = 0, sy = 0, active = false;
    const grid = $('cal-grid');
    grid.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; active = true; }, { passive: true });
    grid.addEventListener('touchend', function (e) {
      if (!active) return; active = false;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftMonth(dx < 0 ? 1 : -1);
    }, { passive: true });
    $('btn-period-today').addEventListener('click', periodToday);
  }

  /* ================================================================== */
  /* 6. Start                                                            */
  /* ================================================================== */

  function init() {
    recompute();
    initEditor();
    bindSettings();
    bindCalendarNav();
    document.querySelectorAll('nav.tabs button').forEach(function (b) {
      b.addEventListener('click', function () { showView(b.dataset.view); });
    });
    $('btn-print').addEventListener('click', function () { window.print(); });
    window.addEventListener('online', function () { if (hasToken()) pushChanges(); else renderStatus(); });
    window.addEventListener('offline', function () { setStatus('warn', 'offline'); });
    // Token-Ablauf sichtbar machen
    setInterval(function () { if (state.settings.connectedBefore && !hasToken() && state.status.kind === 'ok') setStatus('warn', 'Verbindung erneuern'); }, 30000);
    // Tageswechsel: Übersicht neu rechnen
    let lastDay = today();
    setInterval(function () { const t = today(); if (t !== lastDay) { lastDay = t; recompute(); render(); } }, 60000);

    if (state.settings.connectedBefore) setStatus('warn', 'Verbindung erneuern');
    else if (!navigator.onLine) setStatus('warn', 'offline');
    else setStatus('', 'nicht verbunden');
    render();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
    }
  }

  // Für die Konsole / Fehlersuche
  window.ZyklusApp = { state: state, fullSync: fullSync, pushChanges: pushChanges, version: APP_VERSION };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
