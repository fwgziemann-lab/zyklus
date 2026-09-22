# Zyklus Kalender

Eine kleine Web App, mit der man den Menstruationszyklus eintragen und die nächste Periode vorausberechnen lassen kann. Pro Tag lassen sich Blutungsstärke, Schmerzen, Symptome, Stimmung und Notizen erfassen.

**So funktioniert es:**

* Die App ist eine einzelne Webseite, die kostenlos auf GitHub Pages liegt. Auf deinem Rechner läuft im Alltag nichts.
* Die Daten liegen in einem eigenen, privaten Kalender „Zyklus“ im Google Konto, mit dem man sich anmeldet. Dort sieht man alle Einträge auch in der Google Kalender App.
* Auf der Webseite selbst liegen keine Daten, nur das Programm.

Diese Anleitung erklärt Schritt für Schritt, wie du die App mit Claude Code baust und online stellst.


## Was du brauchst

* Dein MacBook mit Claude Code
* Ein GitHub Konto (kostenlos)
* Ein privates Google Konto (kein Firmenkonto, weil Admins dort unter Umständen Zugriff auf Daten haben)
* Etwa eine Stunde Zeit. Die Einrichtung bei Google dauert rund 15 Minuten, den Rest baut Claude Code.

Im Projektordner liegen zwei Dateien:

* **README.md**: diese Anleitung
* **PROMPT.md**: der Auftrag, den du in Claude Code einfügst


## Schritt 1: Konten absichern

Die Daten sind genau so sicher wie deine Konten. Deshalb zuerst:

1. **Google:** Auf myaccount.google.com unter „Sicherheit“ die „Bestätigung in zwei Schritten“ einschalten.
2. **GitHub:** In GitHub unter Settings, Bereich „Password and authentication“, die Zweifaktor Anmeldung aktivieren.
3. Notiere dir deinen **GitHub Benutzernamen**. Du brauchst ihn gleich. Im Folgenden steht dafür BENUTZERNAME.


## Schritt 2: Google Cloud einrichten (einmalig)

Damit die App auf deinen Google Kalender zugreifen darf, braucht sie eine eigene Zugangskennung (Client ID). Das ist kostenlos.

Hinweis: Google ändert die Oberfläche öfter. Die Bezeichnungen können leicht abweichen.

1. Öffne console.cloud.google.com und melde dich mit deinem **privaten** Google Konto an.
2. Oben auf die Projektauswahl klicken, dann „Neues Projekt“. Name: **Zyklus**. Erstellen und das Projekt auswählen.
3. Im Menü „APIs und Dienste“ → „Bibliothek“ → nach **Google Calendar API** suchen → „Aktivieren“.
4. Im Menü **Google Auth Platform** öffnen (hieß früher „OAuth Zustimmungsbildschirm“) und auf „Jetzt starten“ klicken:
   * App Name: **Zyklus**
   * Supportadresse: deine Mailadresse
   * Zielgruppe: **Extern**
   * Kontaktadresse: deine Mailadresse
   * Richtlinien bestätigen und erstellen
5. Unter **Zielgruppe** → „Testnutzer“ → „Nutzer hinzufügen“: das Google Konto eintragen, mit dem die App benutzt wird. Nutzen mehrere Personen die App, alle eintragen. Den Status auf **„Testen“** lassen und die App **nicht** veröffentlichen. So können sich nur die eingetragenen Konten anmelden.
6. Unter **Datenzugriff** → „Bereiche hinzufügen“ → nach **calendar.app.created** suchen, auswählen und speichern. Falls der Bereich nicht in der Liste auftaucht, von Hand eintragen:
   `https://www.googleapis.com/auth/calendar.app.created`
   Dieser Bereich erlaubt der App nur den Zugriff auf den Kalender, den sie selbst anlegt. Deine anderen Termine sieht sie nicht.
   Optional zusätzlich `https://www.googleapis.com/auth/calendar.calendarlist.readonly` eintragen: Den braucht nur der Button „Kalender in Google suchen“ auf einem neuen Gerät (siehe Technische Doku, Abschnitt Scopes). Ohne ihn kann man die Kalender ID auch von Hand einfügen.
7. Unter **Clients** → „Client erstellen“:
   * Anwendungstyp: **Webanwendung**
   * Name: **Zyklus Web**
   * Autorisierte JavaScript Quellen, beide eintragen:
     `https://fwgziemann-lab.github.io`
     `http://localhost:8080`
   * Weiterleitungs URIs leer lassen
   * Erstellen
8. Die angezeigte **Client ID** kopieren (sie endet auf `.apps.googleusercontent.com`).

**Wichtig bei den JavaScript Quellen:** Nur die Domain eintragen, ohne `/zyklus` dahinter, ohne Schrägstrich am Ende und alles klein geschrieben. Ein Clientschlüssel (Client Secret) wird nicht gebraucht. Trag ihn nirgends ein.


## Schritt 3: PROMPT.md ausfüllen

Öffne PROMPT.md und ersetze oben die beiden Platzhalter:

* `BENUTZERNAME_HIER_EINTRAGEN` durch deinen GitHub Benutzernamen (hier bereits erledigt: `fwgziemann-lab`)
* `CLIENT_ID_HIER_EINTRAGEN` durch die Client ID aus Schritt 2


## Schritt 4: Mit Claude Code bauen

1. Im Finder unter „Dokumente“ einen Ordner **zyklus** anlegen und README.md und PROMPT.md hineinlegen.
2. Das Terminal öffnen und in den Ordner wechseln:
   `cd ~/Documents/zyklus`
3. Claude Code starten:
   `claude`
4. Den kompletten Inhalt von PROMPT.md einfügen und abschicken.

Claude Code arbeitet in Phasen und meldet sich nach jeder Phase. Teste dann kurz, gib Feedback und schreib zum Beispiel „weiter mit Phase 2“.

**Falls die GitHub CLI fehlt:** Sag Claude Code „Installiere mir die GitHub CLI und hilf mir beim Anmelden“. Die Anmeldung mit `gh auth login` bestätigst du selbst im Browser.

### Was du in den Phasen testest

**Phase 1: Kalender lokal**
Claude Code startet einen Testserver. Öffne http://localhost:8080 im Browser. Lege ein paar Einträge an, lade die Seite neu und prüfe, ob alles noch da ist und die Vorhersage plausibel wirkt. Öffne auch die Testseite (test.html), dort sollten alle Tests grün sein.

**Phase 2: Google Anbindung und Veröffentlichung**
Klick in der App auf „Mit Google verbinden“. Es erscheint die Warnung **„Google hat diese App nicht überprüft“**. Das ist im Testmodus normal, weil du die App selbst gebaut hast. Klick auf „Erweitert“ und dann auf „Weiter zu Zyklus“. Den Haken für den Kalenderzugriff setzen.
Danach in Google Kalender prüfen: Es gibt einen neuen Kalender „Zyklus“ mit deinen Einträgen.
Anschließend legt Claude Code das Repository an und stellt die App auf GitHub Pages online.

**Phase 3: Statistik, Arztbericht, Export**
Statistik und Druckansicht anschauen, einmal einen JSON Export machen und wieder importieren.

**Phase 4 (optional): Verschlüsselung**
In den Einstellungen die Verschlüsselung mit einem Passwort einschalten. In Google Kalender stehen danach nur noch neutrale Titel wie „● Z2“. Tab schließen, App neu öffnen: Sie fragt einmal nach dem Passwort, danach sind alle Einträge wieder sichtbar. Falsches Passwort wird abgelehnt.


## Schritt 5: Auf dem Handy nutzen

Die App erreichst du unter:
`https://fwgziemann-lab.github.io/zyklus/`

* **iPhone (Safari):** Teilen → „Zum Home Bildschirm“
* **Android (Chrome):** Menü → „Zum Startbildschirm hinzufügen“

In der **Google Kalender App** muss der Kalender „Zyklus“ eingeblendet sein. Auf Android zusätzlich in den Einstellungen der Kalender App prüfen, ob „Zyklus“ synchronisiert wird.

Tipp: Wenn Termine auf dem Sperrbildschirm auftauchen, in den Einstellungen der App den **diskreten Modus** einschalten. Dann stehen in Google nur neutrale Titel.


## Normale Nutzung

* Beim allerersten Öffnen auf einem Gerät einmal auf „Verbinden“ tippen. Danach hält die App die Verbindung von selbst: Google gibt Browser-Apps Zugangsschlüssel für jeweils eine Stunde; ist er abgelaufen, erneuert die App ihn beim nächsten Tipp automatisch (ein Google-Fenster blitzt kurz auf und schließt sich wieder, ohne Passwort). Nur wenn du im Browser bei Google abgemeldet bist, musst du dich dort neu anmelden.
* Ohne Internet kannst du trotzdem eintragen. Die App lädt alles beim nächsten Verbinden hoch. Oben siehst du, ob alles synchronisiert ist.
* Einmal im Monat einen **JSON Export** als Backup machen und privat ablegen, **nicht** im Projektordner.


## Später etwas ändern

1. Terminal öffnen: `cd ~/Documents/zyklus`
2. `claude` starten
3. Den Wunsch beschreiben, zum Beispiel „Füge ein Feld für die Temperatur hinzu“
4. Claude Code testet, speichert und lädt die Änderung hoch. Nach ein bis zwei Minuten ist die neue Version online. Seite neu laden.

**Verschlüsselung einschalten (Phase 4, ist gebaut):** In der App unter Einstellungen → „Verschlüsselung“ den Schalter umlegen, ein Passwort (mindestens 8 Zeichen) zweimal eingeben und die Warnung bestätigen. Die App schreibt danach alle Termine verschlüsselt neu. Bedenke: Danach siehst du die Details nur noch in der App, nicht mehr in der Google Kalender App. Wer das Passwort vergisst, verliert alle Daten. Deshalb vorher einen JSON Export machen.


## Probleme und Lösungen

**„Fehler 400: origin_mismatch“ bei der Anmeldung**
Die JavaScript Quelle in Google Cloud stimmt nicht. Unter Google Auth Platform → Clients prüfen, ob dort genau `https://fwgziemann-lab.github.io` steht, ohne Pfad und ohne Schrägstrich am Ende. Nach einer Änderung kann es ein paar Minuten dauern, bis sie greift.

**„Zugriff blockiert“ oder „access_denied“**
Das Google Konto ist nicht als Testnutzer eingetragen. Unter Google Auth Platform → Zielgruppe → Testnutzer hinzufügen.

**Das Anmeldefenster öffnet sich nicht**
Der Browser blockiert Popups. Popups für die Seite erlauben.

**Die neue Version ist nicht zu sehen**
Ein bis zwei Minuten warten und die Seite neu laden. Im Repository auf GitHub unter „Actions“ prüfen, ob der Pages Build durchgelaufen ist.

**Der Kalender fehlt in der Google Kalender App**
In der App den Kalender „Zyklus“ einblenden und auf Android die Synchronisierung für ihn aktivieren.

**Einträge fehlen auf einem anderen Gerät**
In der App mit Google verbinden. Der Status oben muss „synchronisiert“ zeigen.


## Sicherheit Checkliste

* Bestätigung in zwei Schritten bei Google und GitHub ist aktiv
* Privates Google Konto, kein Firmenkonto
* Den Kalender „Zyklus“ nie mit jemandem teilen
* Nie echte Daten, Exporte oder Passwörter in den Projektordner legen, das Repository ist öffentlich
* Die Google App im Status „Testen“ lassen
* Auf fremden Geräten die Option „Nichts lokal speichern“ nutzen und nach der Benutzung trennen
* Alle Vorhersagen sind Schätzungen und nicht zur Verhütung geeignet


## Dateien im Projekt

* **index.html**: die App (Aufbau und Gestaltung)
* **core.js**: die Berechnung (Perioden, Zyklen, Vorhersage, Statistik, Abbildung auf Google-Termine)
* **crypto.js**: die optionale Verschlüsselung (Web Crypto)
* **app.js**: Speicher, Google-Anbindung und Bedienoberfläche
* **stats.js**: Statistik und Arztbericht
* **test.html**, **tests.js**, **test-runner.js**: Tests für die Berechnung
* **sw.js**, **manifest.webmanifest**, **icon.svg**, **icon-180.png**, **icon-512.png**: Offline-Start und Startbildschirm-Icon
* **README.md**: diese Anleitung, unten die technische Doku
* **PROMPT.md**: der ursprüngliche Auftrag an Claude Code

Die App besteht aus mehreren Dateien statt einer einzigen, weil die Berechnung so von den Tests mitbenutzt wird und die Content Security Policy Skripte nur aus eigenen Dateien erlaubt (kein `unsafe-inline`). Es gibt trotzdem keinen Build-Schritt und kein Framework.


---

# Technische Doku

Live: https://fwgziemann-lab.github.io/zyklus/ · Repository: https://github.com/fwgziemann-lab/zyklus

## Aufbau des Codes

| Datei | Inhalt |
|---|---|
| `index.html` | Markup aller Ansichten (Kalender, Statistik, Bericht, Einstellungen, Tageseditor als `<dialog>`), CSS mit Light/Dark-Variablen, CSP-Meta-Tag, Meta-Tag `google-client-id` |
| `core.js` | Reine Funktionen ohne DOM/Netz: Datenmodell und Labels, Datumsrechnung, Periodenerkennung, Vorhersage, Statistik, Abbildung auf Google-Termine. Exportiert `window.ZyklusCore` |
| `app.js` | Zustand, Speicher (localStorage nur als Cache), Google Sync (Anmeldung, REST-Aufrufe, Laden, Warteschlange, Vorhersagen), UI (Übersicht, Kalender, Editor, Einstellungen, Export/Import). Exportiert `window.ZyklusApp` für die Konsole |
| `stats.js` | Statistik-Ansicht (KPIs, SVG-Liniendiagramm, SVG-Heatmap, Tabelle) und Arztbericht |
| `crypto.js` | Optionale Verschlüsselung: PBKDF2-Schlüsselableitung, AES-GCM, Schlüssel-Export für die Tab-Sitzung. Exportiert `window.ZyklusCrypto` |
| `sw.js` | Service Worker: eigene Dateien „erst Netz, sonst Cache“, damit die App offline öffnet. Google-Antworten werden nie gecacht |
| `tests.js` | Tests für `core.js`; `test.html` zeigt sie im Browser, `test-runner.js` rendert die Liste |

Datumsangaben sind überall Strings `YYYY-MM-DD`. Gerechnet wird in UTC-Tagen (`Date.UTC`), damit Sommerzeit und Zeitzonen keine Off-by-one-Fehler erzeugen. Nur `todayISO()` liest die lokale Uhr des Geräts.

Alle Nutzerdaten werden ausschließlich über `textContent` in den DOM geschrieben (kein `innerHTML`). Das Access Token liegt in `state.auth` im Arbeitsspeicher und zusätzlich nur für die Lebensdauer des Tabs in `sessionStorage` (`zyklus.token`, damit ein Neuladen innerhalb der Stunde keinen Klick braucht); nie in `localStorage`, und bei „Nichts lokal speichern“ gar nicht.

## Datenmodell

Ein Tageseintrag (`core.js`, `emptyEntry`):

```js
{
  date: "2026-03-05",          // Schlüssel, ein Eintrag pro Tag
  bleeding: "none" | "spotting" | "light" | "medium" | "heavy" | "very_heavy",
  periodStart: false,          // Schalter „Erster Tag der Periode“
  pain: 0,                     // 0–10
  painLocations: ["abdomen", "back", "head", "breast", "legs"],
  symptoms: ["cramps", "bloating", "nausea", "fatigue", "headache", "migraine",
             "breast_tenderness", "skin", "cravings", "digestion", "sleep"],
  mood: null | "good" | "balanced" | "irritable" | "sad" | "anxious" | "energetic",
  medication: false, medicationName: "", medicationCount: 0,
  product: null | "pad" | "tampon" | "cup" | "underwear", productChanges: 0,
  note: "",                    // max. 1000 Zeichen
  updatedAt: "2026-03-05T18:00:00.000Z"
}
```

Im Arbeitsspeicher liegen die Einträge als Objekt `{ "YYYY-MM-DD": entry }`. Ein Eintrag ohne jeden Inhalt (`isEntryEmpty`) wird gelöscht statt gespeichert. `normalizeEntry` bereinigt alles, was von außen kommt (Google, Import), und verwirft unbekannte Werte.

Lokal (nur wenn „Nichts lokal speichern“ aus ist) gibt es vier Schlüssel in `localStorage`: `zyklus.settings`, `zyklus.entries` (Cache), `zyklus.queue` (noch nicht hochgeladene Änderungen) und `zyklus.remote` (bekannte Google-Event-IDs). Der Schalter „Nichts lokal speichern“ selbst liegt in `sessionStorage` und gilt bis zum Schließen des Tabs.

JSON-Export: `{ app: "zyklus", version: 1, exportedAt, settings: { defaultCycle, defaultPeriod }, entries: [ … ] }`. Der Import akzeptiert dieses Format oder ein reines Array von Einträgen; vorhandene Tage werden überschrieben.

## Termine in Google

Beim ersten Verbinden legt die App per `calendars.insert` einen eigenen Kalender an (Name aus den Einstellungen, Standard „Zyklus“) und merkt sich die Kalender ID in den Einstellungen. Es werden keine Freigaben (ACLs) gesetzt.

Drei Termintypen, alle ganztägig (`start.date`, `end.date` exklusiv, also Folgetag), `transparency: transparent` (blockiert keine Zeit), `visibility: private`, keine Erinnerungen außer der optionalen am Vorhersage-Termin:

| Typ | Event-ID | Titel (normal) | Titel (diskret) | colorId |
|---|---|---|---|---|
| Tag | `ckd` + `YYYYMMDD`, z. B. `ckd20260305` | `🩸 Periode Tag 2 · stark · Schmerz 6/10`, `🩸 Schmierblutung`, `Symptome · Kopfschmerzen`, `Notiz` … | `● Z2` (mit Blutung) / `○ Z15` (ohne) | 11 Tomato (ab mittel), 4 Flamingo (leicht, Schmierblutung), 8 Graphite (ohne Blutung) |
| Vorhersage | `ckp` + Startdatum | `Periode erwartet (ca.)`, mehrtägig; bei unregelmäßigem Zyklus über den ganzen Zeitraum | `◌ ca.` | 6 Tangerine |
| Fruchtbares Fenster | `ckf` + Startdatum | `Fruchtbares Fenster (ca.)` | `◌ +` | 2 Sage |

Event-IDs dürfen laut API nur `a–v` und `0–9` enthalten (base32hex), daher die Präfixe ohne `y` oder `z`. Deterministische IDs verhindern Duplikate: Beim Schreiben versucht die App `events.insert` mit der ID; antwortet Google mit 409 (ID existiert, auch wenn der Termin früher gelöscht wurde), folgt `events.update` mit `status: confirmed`, was den Termin überschreibt bzw. wiederbelebt. Löschen toleriert 404 und 410.

Strukturierte Daten liegen in `extendedProperties.private`:

```
app   = "zyklus"            Kennung der App
v     = "1"                 Datenversion
type  = "day" | "prediction" | "fertile"
date  = "YYYY-MM-DD"
data  = JSON (nur Typ day): {"b":"heavy","ps":1,"p":6,"pl":["abdomen"],"s":["cramps"],"m":"irritable","med":1,"medn":"Ibuprofen","medc":2,"pr":"tampon","prc":5,"u":"…"}
note  = Notiz (nur Typ day, max. 1000 Zeichen)
```

Google begrenzt jede Property auf 1024 Zeichen (Wert) und 44 Zeichen (Schlüssel); `data` bleibt mit allen Feldern weit darunter, die Notiz hat deshalb eine eigene Property und ist in der App auf 1000 Zeichen begrenzt. Beim Laden (`events.list` mit `privateExtendedProperty=app=zyklus`, `singleEvents=true`, Zeitraum 3 Jahre zurück bis 1 Jahr voraus, mit `pageToken`-Pagination, `maxResults=2500`) wertet `parseEvent` ausschließlich diese Properties aus, nie Titel oder Beschreibung. Die Beschreibung ist eine lesbare Zusammenfassung für die Google Kalender App.

Sync-Ablauf (`fullSync` in `app.js`): Kalender sicherstellen → alle App-Termine laden → lokale Einträge komplett durch den Google-Stand ersetzen (Google ist die Quelle der Wahrheit; in Google gelöschte Termine verschwinden so auch in der App) → offene Änderungen aus der Warteschlange darüberlegen und hochladen → Vorhersagen abgleichen. Jede Änderung in der App landet zuerst in der Warteschlange (`zyklus.queue`, pro Datum nur die letzte Änderung) und wird sofort hochgeladen, wenn ein Token da ist; sonst beim nächsten Verbinden. Beim Speichern eines Tages werden auch die Nachbartage derselben Periode neu hochgeladen, weil sich deren Titel („Periode Tag 2“) ändern können.

Vorhersagen: Bei jeder Neuberechnung vergleicht `syncPredictions` die gewünschten Vorhersage-Termine (Signatur aus Inhalt und bekannten IDs) mit dem letzten Stand. Nur bei Änderung werden veraltete Termine gelöscht und die aktuellen neu geschrieben. Die Erinnerung „einen Tag vorher um HH:MM“ wird als `reminders.overrides` mit `minutes = 24·60 − (HH·60 + MM)` am ersten Vorhersage-Termin gesetzt (ganztägige Termine beginnen um 0:00).

### Anmeldung und Scopes

Anmeldung über Google Identity Services (`https://accounts.google.com/gsi/client`, Token-Modell, `initTokenClient` / `requestAccessToken`). Es gibt kein Backend und kein Client Secret; die Client ID ist öffentlich und steht im Meta-Tag `google-client-id` in `index.html` (alternativ in den Einstellungen). Das Anmeldefenster wird nur aus einem Klick/Tipp heraus geöffnet, damit Popup-Blocker nicht greifen. Access Tokens gelten etwa eine Stunde; die App merkt sich den Ablauf und versucht beim nächsten Tipp irgendwo in der App eine stille Erneuerung (`prompt: ''`, Google schließt das Fenster bei bestehender Anmeldung sofort wieder). Schlägt das fehl, bleibt der Button „Erneut verbinden“. Ein gültiges Token wird beim Start aus `sessionStorage` übernommen und die App synchronisiert sofort. Beim Trennen wird das Token bei Google widerrufen (`revoke`) und der lokale Cache (Einträge, Warteschlange, bekannte IDs) gelöscht; Einstellungen inklusive Kalender ID bleiben, damit beim nächsten Verbinden kein zweiter Kalender entsteht.

Standard-Scope ist ausschließlich `https://www.googleapis.com/auth/calendar.app.created`. Laut aktueller Google-Doku deckt er `calendars.insert`, `calendars.get` sowie `events.list/insert/update/delete` auf den selbst angelegten Kalendern ab, **nicht** aber `calendarList.list`. Folge: Auf einem neuen Gerät kann die App ihren Kalender nicht selbst wiederfinden, solange die Kalender ID nicht lokal bekannt ist. Dafür gibt es zwei Wege:

1. Kalender ID in Google Kalender nachschlagen (Einstellungen → Kalender „Zyklus“ → „Kalender-ID“) und in den Einstellungen der App einfügen. Kein zusätzlicher Scope nötig.
2. Button „Kalender in Google suchen“: fordert einmalig zusätzlich `https://www.googleapis.com/auth/calendar.calendarlist.readonly` an (inkrementell, Google zeigt dafür einen eigenen Zustimmungsdialog). Dieser Scope zeigt nur die Liste der Kalender (Namen, IDs), keine Termine. Die App nutzt ihn ausschließlich für diese Suche und wählt den Kalender mit dem passenden Namen bzw. der App-Beschreibung.

Der breitere Scope wird also nicht standardmäßig angefragt, sondern nur auf ausdrücklichen Klick.

## Vorhersage

Alles in `core.js`, getestet in `tests.js`:

1. **Perioden erkennen** (`detectPeriods`): Alle Tage mit Blutung (inkl. Schmierblutung) oder gesetztem Schalter „Erster Tag“ werden zu Läufen zusammengefasst; Lücken bis 2 Tage bleiben im selben Lauf. Ein Lauf ist eine Periode, wenn er einen markierten Starttag oder mindestens einen Tag mit Blutung ab „leicht“ enthält. Nur Schmierblutung ergibt keine Periode. Der Start ist der erste Tag ab „leicht“ oder ein markierter Tag; markierte Starttage teilen einen Lauf in mehrere Perioden (so lassen sich auch sehr kurze Abstände von Hand erfassen). Ende ist der letzte Blutungstag des Laufs.
2. **Zyklen** (`computeCycles`): Zykluslänge = Tage zwischen zwei Periodenstarts. Der letzte Zyklus ist offen. Längen unter 18 oder über 50 Tagen gelten als Ausreißer: Sie bleiben in der Statistik sichtbar (orange, ⚠), zählen aber nicht für die Vorhersage.
3. **Vorhersage** (`predict`): Zykluslänge = gerundeter Durchschnitt der bis zu 6 letzten vollständigen Zyklen ohne Ausreißer; Periodendauer = gerundeter Durchschnitt der letzten 6 Perioden. Sind weniger als 2 gültige Zyklen vorhanden, gelten die Standardwerte aus den Einstellungen (28 und 5 Tage), und die App zeigt das an. Nächster Start = letzter Start + Zykluslänge, insgesamt 3 Vorhersagen. Eisprung = erwarteter Start − 14 Tage, fruchtbares Fenster = Eisprung − 5 bis Eisprung + 1. Schwanken die gültigen Zykluslängen um mehr als 7 Tage, ist der Zyklus „unregelmäßig“: Die Vorhersage wird als Zeitraum von (letzter Start + kürzester Zyklus) bis (letzter Start + längster Zyklus) angezeigt und in Google als entsprechend langer Termin geschrieben.
4. **Heute** (`predict` liefert `cycleDay`, `phase`, `daysUntil`, `overdueDays`): Phase „Menstruation“ während der laufenden Periode, „Follikelphase“ bis zum Tag vor dem Eisprungfenster, „Eisprung“ von Eisprung − 1 bis + 1, danach „Lutealphase“; liegt der erwartete Start in der Vergangenheit, „Periode überfällig“ mit Anzahl Tage.
5. **Automatischer Vorschlag** (`suggestPeriodStart`): Der Schalter „Erster Tag der Periode“ wird im Editor vorgeschlagen, wenn die Blutung ab „leicht“ ist, an den 3 Vortagen keine Blutung eingetragen ist und der letzte Periodenstart mindestens 10 Tage zurückliegt. Der Vorschlag lässt sich immer von Hand ändern.

Die Statistik (`computeStats`) rechnet mit **allen** Zyklen inklusive Ausreißern (Durchschnitt, Spanne, Tabelle) und bildet die Heatmap „Schmerz pro Zyklustag“ als Durchschnitt der Schmerzstärke je Zyklustag über alle Zyklen.

## Tests starten

* Im Browser: `test.html` öffnen, lokal unter http://localhost:8080/test.html oder live unter https://fwgziemann-lab.github.io/zyklus/test.html. Alle Tests müssen grün sein.
* Im Terminal (ohne Browser): im Projektordner `node tests.js` ausführen. Beendet sich mit Exit-Code 1, wenn ein Test fehlschlägt.

Abgedeckte Fälle: Datumsrechnung über Monats-, Jahres- und Sommerzeitwechsel, regelmäßiger und unregelmäßiger Zyklus, Lücke in der Periode, nur Schmierblutung, manuelle Starttage, zu wenig Daten (Standardwerte), Ausreißer, Jahreswechsel in der Vorhersage, Schmerz-Heatmap, Event-IDs, Rundreise Eintrag → Google-Termin → Eintrag, diskrete Titel, Erinnerungsminuten, Bereinigung von Import-Daten, Verschlüsselung (Rundreise, falsches Passwort, Stückelung).

## Lokale Entwicklung

Im Projektordner einen einfachen Server auf Port 8080 starten (diese Adresse ist bei Google als JavaScript-Quelle eingetragen):

```bash
python3 -m http.server 8080 --bind 127.0.0.1
```

Dann http://localhost:8080 öffnen. Nach Änderungen: `git add -A && git commit -m "…" && git push`; GitHub Pages baut die Seite in ein bis zwei Minuten neu. Der Service Worker lädt eigene Dateien immer zuerst aus dem Netz, eine neue Version erscheint also nach einem Neuladen mit Verbindung.

## Verschlüsselung (Phase 4, optional, in den Einstellungen einschaltbar)

Alle Bodies, die an Google gehen, laufen in `app.js` durch `encodeForRemote()`, alles Geladene durch `decodeFromRemote()` (Abschnitt 4.8). Ist die Verschlüsselung an:

* **Schlüssel**: PBKDF2-SHA-256 mit 200 000 Runden und 16 Byte zufälligem Salt aus dem Passwort (NFKC-normalisiert), AES-GCM 256 Bit. Jede Nachricht bekommt eine zufällige 12-Byte-IV; Format `base64(IV ‖ Ciphertext ‖ Tag)`. GCM prüft die Integrität, ein falsches Passwort fällt beim Entschlüsseln auf.
* **In Google**: Titel immer neutral (wie diskreter Modus, erzwungen), Beschreibung leer. In `extendedProperties.private` bleiben `app`, `v`, `type`, `date` lesbar (das Datum verrät der Termin ohnehin), dazu `enc=1` und `salt`. `data` ist der Geheimtext des JSON, die Notiz liegt als Geheimtext in Stücken `n0`…`n9` zu je max. 1000 Zeichen (Google-Limit 1024 pro Property). Vorhersage- und Fruchtbarkeits-Termine tragen nur den neutralen Titel.
* **Passwort**: wird nirgends gespeichert. Der abgeleitete Schlüssel liegt im Arbeitsspeicher und, wie das Token, nur für die Tab-Sitzung in `sessionStorage` (`zyklus.key`); bei „Nichts lokal speichern“ gar nicht. Lokal gespeichert werden nur `encSalt` und `encCheck` (ein verschlüsselter Prüftext, um ein eingegebenes Passwort zu verifizieren). Auf einem neuen Gerät liest die App Salt und einen Beispiel-Geheimtext aus den Google-Terminen und prüft das Passwort damit.
* **Einschalten**: Passwort zweimal eingeben, Warnung bestätigen → Schlüssel ableiten, alle Tageseinträge in die Warteschlange, Vorhersagen neu → alles wird verschlüsselt hochgeladen. **Ausschalten** (nur entsperrt möglich): alles wieder im Klartext hochladen, Salt und Prüftext löschen.
* **Schutz des Caches**: Findet `loadRemote` verschlüsselte Termine, die nicht entschlüsselt werden können, bricht die Synchronisierung ab, ohne den lokalen Cache zu überschreiben, und öffnet die Passwortabfrage. Ohne Schlüssel wird nichts hochgeladen (`NeedKeyError`), Änderungen bleiben in der Warteschlange.
* **Lokaler Cache und JSON-Export** bleiben Klartext: Der Cache liegt nur auf dem eigenen Gerät (bei fremden Geräten „Nichts lokal speichern“ nutzen), der Export ist das Backup für den Fall eines vergessenen Passworts.
* **Tests**: Rundreise mit Umlauten und Emoji, zufällige IV, falsches Passwort und falsches Salt werden erkannt, Schlüssel-Export/Import, Stückelung langer Notizen (in `tests.js`, asynchron).
