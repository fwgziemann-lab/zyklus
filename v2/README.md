# Zyklus Version 2 – dauerhaft angemeldet

Diese Version liegt neben der bisherigen App und ändert nichts an ihr:

* **Version 1 (unverändert):** https://fwgziemann-lab.github.io/zyklus/
* **Version 2 (diese):** https://fwgziemann-lab.github.io/zyklus/v2/

Beide speichern in denselben Google Kalender „Zyklus“. Du kannst also jederzeit zurückwechseln.

## Was ist anders?

Bisher lief die Anmeldung vollständig im Browser. Google gibt reinen Browser‑Apps aber nur Schlüssel mit **einer Stunde** Gültigkeit – deshalb war bei jedem Öffnen ein Tippen nötig.

Version 2 nutzt den Weg, den alle dauerhaft angemeldeten Apps gehen: Eine kleine Serverfunktion verwahrt den **dauerhaften Schlüssel**. Ablauf:

1. **Einmalig:** Du tippst auf „Mit Google verbinden“. Die Seite wechselt zu Google (kein Popup), du bestätigst, und kommst zurück.
2. Die Serverfunktion tauscht den Einmal‑Code gegen einen dauerhaften Schlüssel und verwahrt ihn. Dein Browser bekommt nur ein zufälliges Geräte‑Geheimnis.
3. **Ab dann:** Bei jedem Öffnen holt die App still einen frischen Stundenschlüssel. Keine Anmeldung, kein Fenster, kein Tippen.

**Wo liegt was?**

| | Ort |
|---|---|
| Deine Zyklusdaten | ausschließlich im Google Kalender (wie bisher) |
| Dauerhafter Google‑Schlüssel | nur auf dem Server (Supabase, Frankfurt) |
| Geräte‑Geheimnis | nur in deinem Browser; der Server kennt davon nur den Hash |
| Geheimer Clientschlüssel | nur als Secret bei Supabase, nie im Repository |

Der Server speichert **keine Gesundheitsdaten**. Er könnte mit dem Dauerschlüssel aber auf den Kalender zugreifen – das ist der Preis für „dauerhaft angemeldet“ und gilt für jede App, die das kann.

## Einrichtung (einmalig, ca. 10 Minuten)

Ohne diese drei Schritte zeigt die App „Server nicht eingerichtet“.

### 1. Google: Weiterleitungs‑Adressen eintragen

Google Cloud Console → **Google Auth Platform → Clients** → Client „Zyklus Web“ öffnen.
Unter **Autorisierte Weiterleitungs‑URIs** beide eintragen (bisher war das Feld leer):

```
https://fwgziemann-lab.github.io/zyklus/v2/
http://localhost:8080/v2/
```

Die JavaScript‑Quellen bleiben, wie sie sind. Speichern.

### 2. Google: App veröffentlichen

Google Auth Platform → **Zielgruppe** → Veröffentlichungsstatus auf **„In Produktion“** stellen.

**Warum das sein muss:** Laut Google‑Doku verfällt der dauerhafte Schlüssel im Status „Testen“ nach **7 Tagen**. Dann müsstest du dich wöchentlich neu anmelden.

Was sich dadurch ändert: Die Warnung „Google hat diese App nicht überprüft“ bleibt bestehen (die App ist nicht verifiziert), und grundsätzlich könnte sich jede Person mit dem Link anmelden. Das ist unkritisch, weil die App nur den Bereich `calendar.app.created` nutzt: Jede Anmeldung bekommt einen **eigenen** Kalender im **eigenen** Google Konto. Fremde können deine Daten damit nicht sehen.

### 3. Supabase: Clientschlüssel hinterlegen

In der Google Cloud Console beim Client „Zyklus Web“ den **Clientschlüssel** (Client Secret) anzeigen bzw. neu erstellen und kopieren.

Dann im Supabase‑Projekt **mail-ticket-app** → Project Settings → **Edge Functions → Secrets** zwei Einträge anlegen:

| Name | Wert |
|---|---|
| `ZYKLUS_GOOGLE_CLIENT_ID` | `762515296645-r3kg3ah6n0l301qbocm6o66dc1jv97f5.apps.googleusercontent.com` |
| `ZYKLUS_GOOGLE_CLIENT_SECRET` | der kopierte Clientschlüssel |

Direktlink: https://supabase.com/dashboard/project/yhjznfgwliflplmwucms/settings/functions

Die Namen beginnen bewusst mit `ZYKLUS_`, damit sie sich nicht mit möglichen späteren Einstellungen der Mail‑Ticket‑App überschneiden.

**Dringend empfohlen – dritter Eintrag:** `ZYKLUS_ALLOWED_EMAILS` mit den Google‑Konten, die die App benutzen dürfen, durch Komma getrennt, zum Beispiel:

```
fwgzie@gmail.com,konto-der-freundin@gmail.com
```

Ist dieser Eintrag gesetzt, weist der Server jedes andere Google‑Konto beim Verbinden ab und gibt den gerade erhaltenen Zugriff sofort an Google zurück. Ohne den Eintrag darf sich jedes Google‑Konto verbinden – dann jeweils nur mit seinem **eigenen** Kalender im **eigenen** Konto, fremde Daten sind dabei nie sichtbar.

**Wichtig:** Der Clientschlüssel gehört nirgendwo anders hin – nicht ins Repository, nicht in die App, nicht in eine Nachricht.

### 4. Fertig

https://fwgziemann-lab.github.io/zyklus/v2/ öffnen → „Mit Google verbinden“ → bestätigen. Danach: App schließen, wieder öffnen – oben muss ohne Zutun „synchronisiert“ stehen.

Auf dem Handy: Seite öffnen → Menü → „Zum Startbildschirm hinzufügen“.

## Technik

| Teil | Wo |
|---|---|
| App | GitHub Pages, Ordner `v2/` |
| `auth.js` | Anmeldung über Authorization Code mit PKCE, Verwaltung des Geräte‑Geheimnisses |
| `config.js` | öffentliche Adressen und Schlüssel |
| Serverfunktion `zyklus-google-connect` | tauscht den Einmal‑Code gegen den Dauerschlüssel und verwahrt ihn |
| Serverfunktion `zyklus-google-token` | gibt frische Stundenschlüssel aus, löscht bei Entzug |
| Tabelle `zyklus_devices` | Hash des Geräte‑Geheimnisses, Dauerschlüssel, Zeitstempel; RLS an, keine Policy – nur die Serverfunktionen kommen heran |

Supabase‑Projekt: **mail-ticket-app** (Region Frankfurt, `yhjznfgwliflplmwucms`).

### Warum das die Mail‑Ticket‑App nicht stört

Die Zyklus‑Teile liegen im selben Projekt, sind aber vollständig getrennt:

* **Tabelle:** heißt `zyklus_devices`. Die Mail‑Ticket‑App hat keine Tabelle dieses Namens (ihre heißen `Ticket`, `Order`, `Product` …). Es wurde nichts Bestehendes verändert, nur eine Tabelle hinzugefügt.
* **Funktionen:** heißen `zyklus-google-connect` und `zyklus-google-token`. Die Mail‑Ticket‑App hatte vorher **gar keine** Edge Functions.
* **Secrets:** heißen `ZYKLUS_GOOGLE_*` und können deshalb nichts überschreiben.
* **Rechte:** Die Tabelle hat RLS an und bewusst keine Policy; `anon` und `authenticated` wurden alle Rechte entzogen. Nur die beiden Funktionen kommen heran.
* **Projektschlüssel:** Die öffentliche Zyklus‑App enthält **keinen** Supabase‑Schlüssel. Die beiden Funktionen sind ohne ihn erreichbar, also steht kein Schlüssel des Mail‑Ticket‑Projekts auf einer öffentlichen Webseite.
* **Last:** ein paar Datenbankzugriffe pro Tag, ein Datensatz pro Gerät.

Rückstandslos entfernen ließe sich alles mit `drop table public.zyklus_devices;` und dem Löschen der beiden Funktionen.

## Wer kann die App benutzen?

Die Webseite selbst ist öffentlich erreichbar – das ist bei GitHub Pages so und lässt sich nicht abschalten, ohne die App unbrauchbar zu machen. Wichtig ist aber der Unterschied zwischen *Seite* und *Daten*:

* Wer die Adresse öffnet, sieht eine **leere App**. Es sind keinerlei Daten enthalten.
* Verbindet sich jemand mit seinem eigenen Google‑Konto, legt die App in **dessen** Konto einen eigenen Kalender an. Eure Einträge liegen in **eurem** Konto und sind für ihn nicht erreichbar – die Berechtigung `calendar.app.created` erlaubt nur Zugriff auf selbst angelegte Kalender.
* Mit `ZYKLUS_ALLOWED_EMAILS` (siehe oben) lässt sich zusätzlich festlegen, dass sich überhaupt nur bestimmte Konten verbinden dürfen.
* Keinen Schutz gibt es derzeit gegen jemanden, der das **entsperrte Handy** in die Hand bekommt: Dort ist die App offen wie jede andere App auch. Eine eigene PIN‑Sperre für die App ist nicht eingebaut.

## Wenn etwas nicht geht

**„Server nicht eingerichtet“** – die beiden Secrets in Supabase fehlen (Schritt 3).

**„Konto nicht freigegeben“** – das Google‑Konto steht nicht in `ZYKLUS_ALLOWED_EMAILS`.

**„redirect_uri_mismatch“ bei Google** – Schritt 1 fehlt oder die Adresse stimmt nicht genau (mit Schrägstrich am Ende).

**Nach 7 Tagen wieder abgemeldet** – Schritt 2 fehlt, die App steht noch auf „Testen“.

**„Neu verbinden nötig“** – der Zugriff wurde bei Google entzogen (myaccount.google.com → Sicherheit → Drittanbieter‑Apps) oder sechs Monate nicht genutzt. Einmal neu verbinden.

**Verbindung auf einem Gerät lösen** – Einstellungen → „Trennen“. Das widerruft den Zugriff bei Google und löscht den Eintrag auf dem Server.

**Option „Nichts lokal speichern“** – dann kann das Geräte‑Geheimnis nicht gespeichert werden; die dauerhafte Verbindung funktioniert auf diesem Gerät nicht. Für fremde Geräte ist genau das gewollt.
