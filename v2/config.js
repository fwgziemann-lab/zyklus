/*
 * Zyklus v2 – Konfiguration (config.js)
 *
 * Diese Werte sind öffentlich unkritisch: Die Client ID steht ohnehin im
 * Quelltext jeder Browser-App, und der Supabase-Schlüssel ist der öffentliche
 * ("publishable") Schlüssel. Der GEHEIME Clientschlüssel von Google liegt
 * ausschließlich als Secret in den Supabase Edge Functions und niemals hier.
 */
window.ZyklusConfig = {
  // Supabase-Projekt "zyklus" (Frankfurt)
  supabaseUrl: 'https://vuflkltoonlgvesopcju.supabase.co',
  supabaseKey: 'sb_publishable_G31Nfwz3XQDol93ZhfMI_w_6AvRobf3',

  // Google OAuth Client (Webanwendung)
  googleClientId: '762515296645-r3kg3ah6n0l301qbocm6o66dc1jv97f5.apps.googleusercontent.com',

  // Nur der selbst angelegte Kalender, keine anderen Termine
  scope: 'https://www.googleapis.com/auth/calendar.app.created'
};
