# Auftrag für Claude Code: Zyklus Kalender

Im aktuellen Ordner liegen README.md (meine Bauanleitung) und PROMPT.md (dieser Auftrag). Lies beide zuerst.

Mein GitHub Benutzername: fwgziemann-lab
Google OAuth Client ID: 762515296645-r3kg3ah6n0l301qbocm6o66dc1jv97f5.apps.googleusercontent.com (falls noch leer, frag mich in Phase 2 danach)

Baue mir eine Web App zum Tracken des Menstruationszyklus als einzelne HTML Datei (index.html, HTML, CSS und Vanilla JavaScript, kein Build Schritt, kein Framework). Die App wird über GitHub Pages veröffentlicht, damit auf meinem Rechner im Alltag nichts laufen muss und sie auch auf dem Handy funktioniert. Die Daten werden in einem eigenen Google Kalender gespeichert, sodass man alle Einträge auch direkt in Google Kalender sehen kann. Sprache der Oberfläche: Deutsch.

## Ziel
Man trägt pro Tag Blutung, Schmerzen und Symptome ein. Die App erkennt daraus die Zyklen, berechnet Durchschnittswerte und sagt die nächsten Perioden voraus. Alles wird als Termin in einem separaten Google Kalender abgelegt und von dort wieder geladen.

## 1. Tageseintrag
Ein Klick auf einen Tag im Kalender öffnet einen Editor (auf dem Handy als Bottom Sheet). Felder:
• Blutung: keine, Schmierblutung, leicht, mittel, stark, sehr stark (große Buttons mit Tropfen Symbolen)
• Erster Tag der Periode: Schalter. Die App schlägt ihn automatisch vor, wenn eine Blutung ab „leicht“ eingetragen wird und die letzte Periode mindestens 10 Tage zurückliegt. Schmierblutung allein startet keine Periode. Manuell überschreibbar.
• Schmerzen: Stärke 0 bis 10 (Slider) und Ort als Mehrfachauswahl: Unterleib, Rücken, Kopf, Brust, Beine
• Symptome (Mehrfachauswahl): Krämpfe, Blähungen, Übelkeit, Müdigkeit, Kopfschmerzen, Migräne, Brustspannen, Hautunreinheiten, Heißhunger, Verdauungsprobleme, Schlafprobleme
• Stimmung: gut, ausgeglichen, gereizt, traurig, ängstlich, energiegeladen
• Schmerzmittel: ja oder nein, optional Name und Anzahl
• Hygieneprodukt und Anzahl Wechsel (Binde, Tampon, Menstruationstasse, Periodenunterwäsche), damit sich die Stärke objektiver einschätzen lässt
• Notiz als Freitext
Auf der Startansicht zusätzlich ein großer Button „Periode hat heute begonnen“ für den schnellsten Eintrag.

## 2. Ansichten
• Übersicht oben: aktueller Zyklustag, voraussichtliche Phase (Menstruation, Follikelphase, Eisprung, Lutealphase), „Nächste Periode in ca. X Tagen (Datum)“ oder „X Tage über der Zeit“
• Monatskalender: Woche beginnt am Montag, deutsche Datumsformate, Monatswechsel per Pfeil und Wischgeste, heute hervorgehoben. Farbcodes: eingetragene Blutung rot mit Farbtiefe je nach Stärke, vorhergesagte Periode hellrot gestrichelt, fruchtbares Fenster grün, voraussichtlicher Eisprung als Punkt, kleine Symbole für Schmerzen und Notizen. Legende unter dem Kalender.
• Statistik: Tabelle der letzten Zyklen (Start, Zykluslänge, Periodendauer, maximale Blutungsstärke, durchschnittlicher und maximaler Schmerz), Durchschnitt und Schwankungsbreite, Diagramm der Zykluslängen über die Zeit und eine Heatmap „Schmerz pro Zyklustag“. Diagramme selbst mit SVG zeichnen, keine Chart Bibliothek.
• Arztbericht: Druckansicht der letzten 6 Zyklen mit allen Werten für den Frauenarzttermin (über window.print)
• Einstellungen: Google verbinden und trennen, Status der Synchronisierung, Standardwerte für Zyklus und Periodenlänge, diskreter Modus, Vorhersagen in Google schreiben (an/aus), fruchtbares Fenster in Google schreiben (an/aus, Standard aus), Erinnerung einen Tag vor der erwarteten Periode (an/aus mit Uhrzeit), „Nichts lokal speichern“ für fremde Geräte (an/aus), JSON Export und Import, alle Daten löschen

## 3. Berechnung (als reine Funktionen, getrennt von der UI)
• Eine Periode ist eine Folge von Blutungstagen, Lücken von bis zu 2 Tagen gehören noch zur selben Periode
• Zykluslänge = Tage zwischen zwei Periodenstarts
• Vorhersage: Durchschnitt der letzten 6 Zyklen. Ausreißer unter 18 oder über 50 Tagen für die Vorhersage ignorieren, in der Statistik aber anzeigen.
• Periodendauer: Durchschnitt der letzten 6 Perioden
• Bei weniger als 2 erfassten Zyklen die Standardwerte aus den Einstellungen nutzen (28 und 5 Tage) und das in der App anzeigen
• Eisprung: erwarteter nächster Periodenstart minus 14 Tage, fruchtbares Fenster 5 Tage davor bis 1 Tag danach
• Unregelmäßigkeit: Schwankt die Zykluslänge um mehr als 7 Tage, die Vorhersage als Zeitraum statt als festes Datum anzeigen
• Die nächsten 3 Perioden vorhersagen
• Intern nur mit Datumsstrings ohne Uhrzeit rechnen, damit Sommerzeit und Zeitzonen keine Fehler verursachen
• Deutlicher Hinweis in der App: Alle Vorhersagen sind Schätzungen und nicht zur Verhütung geeignet
Schreibe für diese Funktionen Tests (test.html, die im Browser alle Fälle prüft: regelmäßig, unregelmäßig, Lücke in der Periode, nur Schmierblutung, zu wenig Daten, Jahreswechsel).

## 4. Google Kalender als Speicher
• Anmeldung über Google Identity Services (Token Client) im Browser, danach direkte Aufrufe der Google Calendar REST API per fetch. Kein Backend, kein Client Secret.
• Scope: https://www.googleapis.com/auth/calendar.app.created, damit die App nur ihren eigenen Kalender sieht und nicht die übrigen Termine. Prüfe in der aktuellen Google Doku, ob alle benötigten Aufrufe damit funktionieren. Nur wenn nicht, auf einen breiteren Scope ausweichen, mir das vorher sagen und in der README begründen.
• Beim ersten Verbinden einen neuen Kalender „Zyklus“ anlegen (Name in den Einstellungen änderbar) und die Kalender ID lokal merken. Keine Freigaben setzen.
• Ein Termin pro eingetragenem Tag: ganztägig (Achtung, bei ganztägigen Terminen ist das Enddatum exklusiv), Transparenz „frei“, damit er keine Zeit blockiert, Sichtbarkeit privat, keine Erinnerungen.
• Titel lesbar, z. B. „🩸 Periode Tag 2 · stark · Schmerz 6/10“ oder „Symptome · Kopfschmerzen“. Im diskreten Modus neutrale Titel wie „● Z2“ ohne Gesundheitsbegriffe, weil Kalendertitel auf dem Sperrbildschirm und in Widgets auftauchen.
• Beschreibung: lesbare Zusammenfassung aller Werte, damit man die Einträge auch in der Google Kalender App verfolgen kann.
• Strukturierte Daten zusätzlich in extendedProperties.private (Kennung der App, Typ, Datum, alle Felder). Beim Laden werden nur diese Daten ausgewertet. Größenlimits der extendedProperties beachten, lange Notizen notfalls nur in der Beschreibung ablegen.
• Farben über colorId: Periode rot, leichte Blutung und Schmierblutung heller, Vorhersage eine eigene Farbe, fruchtbares Fenster grün.
• Vorhersagen als eigener Termintyp: pro erwarteter Periode ein mehrtägiger Termin „Periode erwartet (ca.)“. Bei jeder Neuberechnung alte Vorhersagen löschen und neu schreiben.
• Duplikate vermeiden: deterministische Event IDs pro Datum und Typ verwenden (erlaubte Zeichen laut API prüfen) und den Fall abfangen, dass eine ID schon existiert oder früher gelöscht wurde.
• Laden: alle App Termine eines Zeitraums (z. B. letzte 3 Jahre bis 1 Jahr in die Zukunft) mit Pagination abrufen.
• Wird ein Termin direkt in Google Kalender gelöscht, verschwindet der Eintrag beim nächsten Laden auch in der App.
• Google ist die Quelle der Wahrheit. localStorage dient nur als Cache für schnellen Start und Offline Nutzung. Änderungen ohne Verbindung in eine Warteschlange legen und beim nächsten Verbinden hochladen. Sichtbarer Status: synchronisiert, wird gespeichert, offline, Verbindung erneuern.
• Access Tokens laufen nach etwa einer Stunde ab: wenn möglich still erneuern, sonst einen Button „Erneut verbinden“ zeigen. Das Anmeldefenster nur nach einem Tippen oder Klick öffnen, damit Popup Blocker nicht greifen. Alle localStorage Zugriffe in try/catch.
• Client ID als Konstante oben in index.html (ist öffentlich unkritisch) und alternativ in den Einstellungen eintragbar.

## 5. Sicherheit
• Alle Eingaben, vor allem Notizen, nur als Text rendern, nie als HTML (kein innerHTML mit Nutzerdaten)
• Access Token nur im Arbeitsspeicher halten, nie in localStorage
• Beim Trennen von Google den lokalen Cache komplett löschen
• Bei aktivierter Option „Nichts lokal speichern“ gar nichts in localStorage schreiben
• Content Security Policy per Meta Tag, die nur eigene Skripte und Google Identity Services sowie die Google APIs erlaubt
• Keine externen Schriften, keine weiteren externen Skripte, kein Tracking, keine Analyse Tools
• Baue die Architektur so, dass später eine optionale Verschlüsselung ergänzt werden kann (siehe Phase 4), baue sie aber jetzt noch nicht

## 6. Hosting über GitHub Pages
• Lege auf meinem GitHub Konto ein öffentliches Repository „zyklus“ an (öffentlich, weil GitHub Pages im kostenlosen Tarif das braucht), pushe den Code und aktiviere GitHub Pages aus dem Hauptbranch (main, Ordner root). Nutze dafür die GitHub CLI (gh). Falls sie fehlt oder ich nicht angemeldet bin, hilf mir dabei und sag mir genau, was ich selbst tun muss.
• Die App läuft unter https://fwgziemann-lab.github.io/zyklus/, also nur relative Pfade verwenden, damit sie im Unterpfad funktioniert.
• Niemals Geheimnisse oder persönliche Daten ins Repository: keine echten Testdaten, keine JSON Exporte, keine Tokens. Passende .gitignore anlegen, die z. B. alle JSON Exporte ausschließt.
• Für die lokale Entwicklung einen einfachen Server auf Port 8080 nutzen (http://localhost:8080 ist in Google als Quelle eingetragen). Das ist nur zum Testen, im Alltag läuft nichts lokal.
• Nach jeder abgeschlossenen Phase committen und pushen und mir die Live Adresse nennen.

## 7. Design und Technik
• Mobile first, große Touch Flächen, funktioniert auch am Desktop, Dark Mode passend zum System
• Ruhige, freundliche Farben, nicht kitschig, Systemschriften
• Meta Tags und ein Icon, damit man die Seite auf iPhone und Android zum Startbildschirm hinzufügen kann
• Code sauber gegliedert und kommentiert: Datenmodell, Berechnung, Google Sync, UI

## 8. Dokumentation
• In README.md steht meine Bauanleitung. Den bestehenden Teil nicht umschreiben, außer um echte Fehler zu korrigieren (dann sag mir, was du geändert hast).
• Ersetze die Platzhalter BENUTZERNAME durch meinen echten GitHub Benutzernamen.
• Ergänze am Ende von README.md einen Abschnitt „Technische Doku“: Aufbau des Codes, Datenmodell, wie die Termine in Google aussehen, wie Vorhersagen berechnet werden, wie man die Tests startet.

## Vorgehen
Arbeite in Phasen und zeig mir nach jeder kurz, was funktioniert und wie ich es teste:
1. Datenmodell, Berechnung mit Tests, Kalender, Tageseditor, lokale Speicherung. Lokal auf Port 8080 testen.
2. Google Anbindung: Anmeldung, Kalender anlegen, Laden, Speichern, Vorhersagen, Offline Warteschlange. Danach Repository anlegen und über GitHub Pages veröffentlichen.
3. Statistik, Arztbericht, Export und Import, Sicherheit prüfen, Feinschliff, technische Doku.
4. Optional, nur wenn ich es ausdrücklich sage: Verschlüsselung mit eigenem Passwort (Web Crypto, AES GCM), bevor Daten an Google gehen. In Google stehen dann nur neutrale Titel, die Details sieht man nur in der App. Das Passwort wird nirgends gespeichert, beim Einschalten werden alle vorhandenen Termine verschlüsselt neu geschrieben. Deutlicher Hinweis, dass bei vergessenem Passwort alle Daten verloren sind.

Stell Rückfragen nur, wenn etwas wirklich unklar ist. Prüfe Details der Google APIs und von GitHub Pages in der aktuellen Doku statt aus dem Gedächtnis.
