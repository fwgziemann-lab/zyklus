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
Wird nur gebaut, wenn du es ausdrücklich sagst (siehe unten).


## Schritt 5: Auf dem Handy nutzen

Die App erreichst du unter:
`https://fwgziemann-lab.github.io/zyklus/`

* **iPhone (Safari):** Teilen → „Zum Home Bildschirm“
* **Android (Chrome):** Menü → „Zum Startbildschirm hinzufügen“

In der **Google Kalender App** muss der Kalender „Zyklus“ eingeblendet sein. Auf Android zusätzlich in den Einstellungen der Kalender App prüfen, ob „Zyklus“ synchronisiert wird.

Tipp: Wenn Termine auf dem Sperrbildschirm auftauchen, in den Einstellungen der App den **diskreten Modus** einschalten. Dann stehen in Google nur neutrale Titel.


## Normale Nutzung

* Beim Öffnen einmal auf „Mit Google verbinden“ tippen. Die App speichert aus Sicherheitsgründen keine dauerhaften Zugangsschlüssel, deshalb ist das je nach Browser öfter nötig.
* Ohne Internet kannst du trotzdem eintragen. Die App lädt alles beim nächsten Verbinden hoch. Oben siehst du, ob alles synchronisiert ist.
* Einmal im Monat einen **JSON Export** als Backup machen und privat ablegen, **nicht** im Projektordner.


## Später etwas ändern

1. Terminal öffnen: `cd ~/Documents/zyklus`
2. `claude` starten
3. Den Wunsch beschreiben, zum Beispiel „Füge ein Feld für die Temperatur hinzu“
4. Claude Code testet, speichert und lädt die Änderung hoch. Nach ein bis zwei Minuten ist die neue Version online. Seite neu laden.

**Verschlüsselung nachrüsten:** Schreib „Bau jetzt Phase 4 (Verschlüsselung) aus PROMPT.md“. Bedenke: Danach siehst du die Details nur noch in der App, nicht mehr in der Google Kalender App. Wer das Passwort vergisst, verliert alle Daten.


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

* **index.html**: die App
* **test.html**: Tests für die Berechnung
* **README.md**: diese Anleitung, unten ergänzt Claude Code die technische Doku
* **PROMPT.md**: der ursprüngliche Auftrag an Claude Code
