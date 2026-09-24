/*
 * Zyklus v2 – Dauerhafte Anmeldung (auth.js)
 *
 * Unterschied zu Version 1: Dort lief die Anmeldung vollständig im Browser
 * (Google Identity Services). Google gibt reinen Browser-Apps nur Schlüssel mit
 * einer Stunde Gültigkeit, deshalb war bei jedem Öffnen ein Tippen nötig.
 *
 * Hier übernimmt eine kleine Serverfunktion bei Supabase den Teil, den Google
 * nur einem Server anvertraut:
 *
 *   1. Einmalig: Die App schickt den Nutzer zu Google (ganz normaler Seitenwechsel,
 *      kein Popup). Google schickt einen Einmal-Code zurück.
 *   2. Die App gibt den Code an die Funktion "google-connect". Diese tauscht ihn
 *      zusammen mit dem geheimen Clientschlüssel gegen einen DAUERHAFTEN Schlüssel
 *      und verwahrt ihn. Zurück kommt nur ein Geräte-Geheimnis.
 *   3. Ab jetzt holt die App bei jedem Start über "google-token" still einen
 *      frischen Stundenschlüssel. Kein Anmelden, kein Fenster, kein Tippen.
 *
 * Was wo liegt:
 *   - Dauerhafter Google-Schlüssel: nur auf dem Server (Supabase), nie im Browser.
 *   - Geräte-Geheimnis: nur in diesem Browser (localStorage), nie auf dem Server
 *     im Klartext (dort liegt nur dessen Hash).
 *   - Zugriffsschlüssel: nur im Arbeitsspeicher, läuft nach einer Stunde ab.
 *   - Gesundheitsdaten: ausschließlich im Google Kalender, nie bei Supabase.
 *
 * Sicherheit: PKCE (RFC 7636), damit der Einmal-Code unterwegs nichts nützt.
 */
(function (root) {
  'use strict';

  const CFG = root.ZyklusConfig || {};
  const SUPABASE_URL = (CFG.supabaseUrl || '').replace(/\/+$/, '');
  const SUPABASE_KEY = CFG.supabaseKey || '';
  const CLIENT_ID = CFG.googleClientId || '';
  const SCOPE = CFG.scope || 'https://www.googleapis.com/auth/calendar.app.created';

  const KEY_DEVICE = 'zyklus.device';     // Geräte-Geheimnis (dauerhaft)
  const KEY_VERIFIER = 'zyklus.pkce';     // nur während der Anmeldung
  const KEY_STATE = 'zyklus.oauthstate';
  const SAFETY_MS = 90 * 1000;            // Schlüssel vorzeitig erneuern

  const mem = { token: null, expiresAt: 0, email: null, inflight: null };

  /* ---------------- Hilfsfunktionen ---------------- */

  function store(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { /* privater Modus o. ä. */ }
  }
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function session(key, value) {
    try {
      if (value === undefined) return sessionStorage.getItem(key);
      if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  function b64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function randomString(bytes) {
    const a = new Uint8Array(bytes);
    crypto.getRandomValues(a);
    return b64url(a);
  }
  async function challenge(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return b64url(digest);
  }

  /** Adresse dieser App ohne Query und Anker – muss in Google eingetragen sein. */
  function redirectUri() {
    return location.origin + location.pathname.replace(/index\.html$/, '');
  }

  function configured() {
    return !!(SUPABASE_URL && SUPABASE_KEY && CLIENT_ID);
  }
  function connected() {
    return !!read(KEY_DEVICE);
  }
  function deviceSecret() {
    return read(KEY_DEVICE);
  }

  async function callFunction(name, body) {
    const res = await fetch(SUPABASE_URL + '/functions/v1/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify(body)
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      const err = new Error((data && (data.detail || data.error)) || ('HTTP ' + res.status));
      err.code = data && data.error;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ---------------- Anmeldung (einmalig) ---------------- */

  /**
   * Schickt zu Google. Ein normaler Seitenwechsel, kein Popup – deshalb blockiert
   * kein Browser etwas, und es funktioniert auch als App auf dem Startbildschirm.
   */
  async function connect() {
    if (!configured()) throw new Error('Supabase oder Google Client ID fehlt in der Konfiguration.');
    const verifier = randomString(48);
    const state = randomString(16);
    session(KEY_VERIFIER, verifier);
    session(KEY_STATE, state);
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri(),
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',        // nötig für den dauerhaften Schlüssel
      prompt: 'consent',             // sonst gibt Google beim zweiten Mal keinen heraus
      include_granted_scopes: 'true',
      state: state,
      code_challenge: await challenge(verifier),
      code_challenge_method: 'S256'
    });
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
  }

  /**
   * Nach der Rückkehr von Google: Code einlösen. Gibt true zurück, wenn eine
   * Anmeldung verarbeitet wurde (egal ob erfolgreich).
   */
  async function handleRedirect() {
    const q = new URLSearchParams(location.search);
    const code = q.get('code');
    const error = q.get('error');
    if (!code && !error) return false;

    const verifier = session(KEY_VERIFIER);
    const expected = session(KEY_STATE);
    session(KEY_VERIFIER, null);
    session(KEY_STATE, null);
    cleanUrl();

    if (error) throw new Error(describe(error));
    if (!verifier) throw new Error('Anmeldung abgebrochen (die Sitzung ging verloren). Bitte noch einmal versuchen.');
    if (expected && q.get('state') !== expected) throw new Error('Sicherheitsprüfung fehlgeschlagen. Bitte noch einmal versuchen.');

    const data = await callFunction('google-connect', {
      code: code,
      code_verifier: verifier,
      redirect_uri: redirectUri(),
      label: navigator.userAgent.slice(0, 80)
    });
    store(KEY_DEVICE, data.device_secret);
    mem.token = data.access_token;
    mem.expiresAt = Date.now() + (data.expires_in * 1000) - SAFETY_MS;
    mem.email = data.email || null;
    return true;
  }

  function cleanUrl() {
    try { history.replaceState(null, '', redirectUri()); } catch (e) { /* egal */ }
  }

  function describe(code) {
    if (code === 'access_denied') return 'Zugriff abgelehnt. Wurde das Google Konto freigegeben?';
    return 'Anmeldung fehlgeschlagen (' + code + ').';
  }

  /* ---------------- Zugriffsschlüssel (jedes Mal still) ---------------- */

  function hasToken() {
    return !!mem.token && Date.now() < mem.expiresAt;
  }

  /**
   * Liefert einen gültigen Zugriffsschlüssel. Holt bei Bedarf still einen neuen.
   * Wirft NotConnected, wenn dieses Gerät noch nicht verbunden ist, und Revoked,
   * wenn der Zugriff bei Google entzogen wurde (dann ist neues Verbinden nötig).
   */
  async function getToken() {
    if (hasToken()) return mem.token;
    if (!connected()) { const e = new Error('Dieses Gerät ist noch nicht verbunden.'); e.code = 'not_connected'; throw e; }
    if (mem.inflight) return mem.inflight;
    mem.inflight = (async function () {
      try {
        const data = await callFunction('google-token', { device_secret: deviceSecret() });
        mem.token = data.access_token;
        mem.expiresAt = Date.now() + (data.expires_in * 1000) - SAFETY_MS;
        mem.email = data.email || mem.email;
        return mem.token;
      } catch (e) {
        if (e.code === 'revoked' || e.code === 'unknown_device') {
          store(KEY_DEVICE, null);
          mem.token = null; mem.expiresAt = 0;
          const err = new Error('Die Verbindung zu Google wurde beendet. Bitte einmal neu verbinden.');
          err.code = 'revoked';
          throw err;
        }
        throw e;
      } finally {
        mem.inflight = null;
      }
    })();
    return mem.inflight;
  }

  /** Verbindung dieses Geräts lösen und den Zugriff bei Google widerrufen. */
  async function disconnect() {
    const secret = deviceSecret();
    mem.token = null; mem.expiresAt = 0; mem.email = null;
    store(KEY_DEVICE, null);
    if (secret) {
      try { await callFunction('google-token', { device_secret: secret, revoke: 1 }); } catch (e) { /* egal */ }
    }
  }

  root.ZyklusAuth = {
    configured: configured,
    connected: connected,
    connect: connect,
    handleRedirect: handleRedirect,
    getToken: getToken,
    hasToken: hasToken,
    disconnect: disconnect,
    redirectUri: redirectUri,
    account: function () { return mem.email; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
