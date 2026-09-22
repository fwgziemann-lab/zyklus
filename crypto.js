/*
 * Zyklus – Verschlüsselung (crypto.js)
 *
 * Optionale Ende-zu-Ende-Verschlüsselung der Daten, bevor sie an Google gehen.
 *   - Schlüssel: PBKDF2-SHA-256 aus dem Passwort, 200 000 Runden, 16 Byte Salt
 *   - Daten: AES-GCM 256 Bit, 12 Byte zufällige IV pro Nachricht
 *   - Format eines Geheimtexts: base64( IV || Ciphertext || Tag )
 * Das Passwort wird nirgends gespeichert. Ein falsches Passwort fällt beim
 * Entschlüsseln auf (GCM prüft die Integrität), es braucht keinen separaten
 * Prüfwert. Läuft im Browser und in Node (globalThis.crypto).
 */
(function (root) {
  'use strict';
  const subtle = root.crypto && root.crypto.subtle;
  const ITERATIONS = 200000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function toB64(bytes) {
    let s = '';
    const u = new Uint8Array(bytes);
    for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }
  function fromB64(b64) {
    const s = atob(b64);
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }

  function available() { return !!subtle; }

  function randomSalt() {
    const s = new Uint8Array(16);
    root.crypto.getRandomValues(s);
    return toB64(s);
  }

  /** Leitet den AES-Schlüssel aus Passwort und Salt ab (dauert auf Handys ~1 s). */
  async function deriveKey(password, saltB64) {
    const base = await subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey(
      { name: 'PBKDF2', salt: fromB64(saltB64), iterations: ITERATIONS, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }

  async function encrypt(key, text) {
    const iv = new Uint8Array(12);
    root.crypto.getRandomValues(iv);
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(text));
    const out = new Uint8Array(12 + ct.byteLength);
    out.set(iv, 0);
    out.set(new Uint8Array(ct), 12);
    return toB64(out);
  }

  /** Wirft bei falschem Schlüssel oder manipulierten Daten. */
  async function decrypt(key, b64) {
    const all = fromB64(b64);
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12));
    return dec.decode(pt);
  }

  /** Schlüssel für die Tab-Sitzung exportieren/importieren (nie das Passwort). */
  async function exportKey(key) { return toB64(await subtle.exportKey('raw', key)); }
  async function importKey(b64) {
    return subtle.importKey('raw', fromB64(b64), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }

  /** Teilt einen langen String in Stücke von max. `size` Zeichen (extendedProperties-Limit 1024). */
  function chunk(str, size) {
    const out = [];
    for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
    return out;
  }

  root.ZyklusCrypto = {
    available: available, randomSalt: randomSalt, deriveKey: deriveKey,
    encrypt: encrypt, decrypt: decrypt, exportKey: exportKey, importKey: importKey,
    chunk: chunk, ITERATIONS: ITERATIONS
  };
})(typeof window !== 'undefined' ? window : globalThis);
