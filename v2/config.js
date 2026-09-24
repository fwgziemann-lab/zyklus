/*
 * Zyklus v2 – Konfiguration (config.js)
 *
 * Hier steht bewusst nur, was ohnehin öffentlich ist: die Adresse der beiden
 * Serverfunktionen und die Google Client ID (die steht im Quelltext jeder
 * Browser-App). Der geheime Clientschlüssel von Google liegt ausschließlich als
 * Secret bei Supabase.
 *
 * Auch der öffentliche Supabase-Projektschlüssel steht hier absichtlich NICHT:
 * Die beiden Zyklus-Funktionen sind ohne ihn erreichbar, und so taucht kein
 * Schlüssel des Mail-Ticket-Projekts auf einer öffentlichen Webseite auf.
 */
window.ZyklusConfig = {
  // Supabase-Projekt "mail-ticket-app" (Frankfurt). Die Zyklus-Sachen liegen dort
  // sauber getrennt: Tabelle zyklus_devices, Funktionen zyklus-google-*.
  supabaseUrl: 'https://yhjznfgwliflplmwucms.supabase.co',
  functionPrefix: 'zyklus-',

  // Google OAuth Client (Webanwendung)
  googleClientId: '762515296645-r3kg3ah6n0l301qbocm6o66dc1jv97f5.apps.googleusercontent.com',

  // Nur der selbst angelegte Kalender, keine anderen Termine
  scope: 'https://www.googleapis.com/auth/calendar.app.created'
};
