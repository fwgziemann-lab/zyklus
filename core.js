/*
 * Zyklus – Berechnungskern (core.js)
 *
 * Reine Funktionen ohne DOM- oder Netzwerkzugriff. Wird von index.html (App)
 * und test.html (Tests) geladen. Alle Datumsangaben sind Strings im Format
 * "YYYY-MM-DD"; gerechnet wird ausschließlich in UTC-Tagen, damit Sommerzeit
 * und Zeitzonen keine Rolle spielen.
 *
 * Gliederung:
 *   1. Datenmodell (Konstanten, Labels, leerer Eintrag)
 *   2. Datumsfunktionen
 *   3. Periodenerkennung und Zyklen
 *   4. Vorhersage
 *   5. Statistik
 *   6. Abbildung auf Google-Kalender-Termine (Titel, Beschreibung, IDs)
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 1. Datenmodell                                                      */
  /* ------------------------------------------------------------------ */

  const APP_ID = 'zyklus';       // Kennung in extendedProperties.private.app
  const DATA_VERSION = 1;        // Version des Datenformats

  const BLEEDING = ['none', 'spotting', 'light', 'medium', 'heavy', 'very_heavy'];
  const BLEEDING_LABEL = {
    none: 'keine', spotting: 'Schmierblutung', light: 'leicht',
    medium: 'mittel', heavy: 'stark', very_heavy: 'sehr stark'
  };
  // Zahlenwert für Vergleiche (Stärke); Schmierblutung zählt nicht als "echte" Blutung
  const BLEEDING_RANK = { none: 0, spotting: 1, light: 2, medium: 3, heavy: 4, very_heavy: 5 };

  const PAIN_LOCATIONS = ['abdomen', 'back', 'head', 'breast', 'legs'];
  const PAIN_LOCATION_LABEL = {
    abdomen: 'Unterleib', back: 'Rücken', head: 'Kopf', breast: 'Brust', legs: 'Beine'
  };

  const SYMPTOMS = ['cramps', 'bloating', 'nausea', 'fatigue', 'headache', 'migraine',
    'breast_tenderness', 'skin', 'cravings', 'digestion', 'sleep'];
  const SYMPTOM_LABEL = {
    cramps: 'Krämpfe', bloating: 'Blähungen', nausea: 'Übelkeit', fatigue: 'Müdigkeit',
    headache: 'Kopfschmerzen', migraine: 'Migräne', breast_tenderness: 'Brustspannen',
    skin: 'Hautunreinheiten', cravings: 'Heißhunger', digestion: 'Verdauungsprobleme',
    sleep: 'Schlafprobleme'
  };

  const MOODS = ['good', 'balanced', 'irritable', 'sad', 'anxious', 'energetic'];
  const MOOD_LABEL = {
    good: 'gut', balanced: 'ausgeglichen', irritable: 'gereizt',
    sad: 'traurig', anxious: 'ängstlich', energetic: 'energiegeladen'
  };

  const PRODUCTS = ['pad', 'tampon', 'cup', 'underwear'];
  const PRODUCT_LABEL = {
    pad: 'Binde', tampon: 'Tampon', cup: 'Menstruationstasse', underwear: 'Periodenunterwäsche'
  };

  // Geschlechtsverkehr: bewusst nur in der Beschreibung, nie im Termintitel
  const SEX_PROTECTION = ['protected', 'unprotected'];
  const SEX_PROTECTION_LABEL = { protected: 'geschützt', unprotected: 'ungeschützt' };

  const PHASE_LABEL = {
    menstruation: 'Menstruation', follicular: 'Follikelphase',
    ovulation: 'Eisprung', luteal: 'Lutealphase', overdue: 'Periode überfällig',
    unknown: 'Unbekannt'
  };

  const NOTE_MAX = 1000; // Zeichen; passt in eine extendedProperty (max 1024)

  /** Leerer Tageseintrag für ein Datum. */
  function emptyEntry(date) {
    return {
      date: date,
      bleeding: 'none',
      periodStart: false,
      pain: 0,
      painLocations: [],
      symptoms: [],
      mood: null,
      medication: false,
      medicationName: '',
      medicationCount: 0,
      product: null,
      productChanges: 0,
      sex: false,
      sexProtection: null,
      note: '',
      updatedAt: null
    };
  }

  /** Bringt beliebige (z. B. importierte) Daten in ein sauberes Eintragsobjekt. */
  function normalizeEntry(raw) {
    if (!raw || !isValidDate(raw.date)) return null;
    const e = emptyEntry(raw.date);
    if (BLEEDING.indexOf(raw.bleeding) >= 0) e.bleeding = raw.bleeding;
    e.periodStart = !!raw.periodStart;
    e.pain = clampInt(raw.pain, 0, 10);
    e.painLocations = uniqueIn(raw.painLocations, PAIN_LOCATIONS);
    e.symptoms = uniqueIn(raw.symptoms, SYMPTOMS);
    e.mood = MOODS.indexOf(raw.mood) >= 0 ? raw.mood : null;
    e.medication = !!raw.medication;
    e.medicationName = typeof raw.medicationName === 'string' ? raw.medicationName.slice(0, 80) : '';
    e.medicationCount = clampInt(raw.medicationCount, 0, 99);
    e.product = PRODUCTS.indexOf(raw.product) >= 0 ? raw.product : null;
    e.productChanges = clampInt(raw.productChanges, 0, 99);
    e.sex = !!raw.sex;
    e.sexProtection = SEX_PROTECTION.indexOf(raw.sexProtection) >= 0 ? raw.sexProtection : null;
    e.note = typeof raw.note === 'string' ? raw.note.slice(0, NOTE_MAX) : '';
    e.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;
    return e;
  }

  /** Ein Eintrag ohne jeden Inhalt wird nicht gespeichert, sondern gelöscht. */
  function isEntryEmpty(e) {
    return e.bleeding === 'none' && !e.periodStart && e.pain === 0 &&
      e.painLocations.length === 0 && e.symptoms.length === 0 && !e.mood &&
      !e.medication && !e.product && e.productChanges === 0 && !e.sex && !e.note;
  }

  function clampInt(v, min, max) {
    const n = parseInt(v, 10);
    if (isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function uniqueIn(arr, allowed) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    arr.forEach(function (x) { if (allowed.indexOf(x) >= 0 && out.indexOf(x) < 0) out.push(x); });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* 2. Datumsfunktionen (nur Strings "YYYY-MM-DD", Rechnung in UTC)      */
  /* ------------------------------------------------------------------ */

  const DAY_MS = 86400000;

  function isValidDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }

  function toUTC(s) {
    const p = s.split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }

  function fromUTC(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }

  /** Datum plus n Tage (n darf negativ sein). */
  function addDays(s, n) {
    return fromUTC(toUTC(s) + n * DAY_MS);
  }

  /** Differenz b - a in Tagen. */
  function diffDays(a, b) {
    return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
  }

  /** Heutiges Datum in der lokalen Zeitzone des Geräts als "YYYY-MM-DD". */
  function todayISO(now) {
    const d = now || new Date();
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    return y + '-' + pad2(m) + '-' + pad2(day);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** 0 = Montag ... 6 = Sonntag */
  function weekdayMon(s) {
    return (new Date(toUTC(s)).getUTCDay() + 6) % 7;
  }

  function daysInMonth(year, month) { // month 1-12
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  /** Deutsches Datum: 05.03.2026 */
  function formatDE(s) {
    if (!isValidDate(s)) return '';
    const p = s.split('-');
    return p[2] + '.' + p[1] + '.' + p[0];
  }

  /** Kurzform: 5.3. */
  function formatShortDE(s) {
    const p = s.split('-');
    return (+p[2]) + '.' + (+p[1]) + '.';
  }

  const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
    'August', 'September', 'Oktober', 'November', 'Dezember'];
  const WEEKDAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const WEEKDAYS_LONG_DE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

  function formatLongDE(s) {
    const p = s.split('-');
    return WEEKDAYS_LONG_DE[weekdayMon(s)] + ', ' + (+p[2]) + '. ' + MONTHS_DE[+p[1] - 1] + ' ' + p[0];
  }

  /* ------------------------------------------------------------------ */
  /* 3. Periodenerkennung und Zyklen                                     */
  /* ------------------------------------------------------------------ */

  const PERIOD_GAP_MAX = 2;   // Lücken bis 2 Tage gehören noch zur selben Periode
  const NEW_PERIOD_MIN_GAP = 10; // Mindestabstand für einen automatischen Periodenstart

  function hasBleeding(e) { return BLEEDING_RANK[e.bleeding] >= 1; }
  function hasRealBleeding(e) { return BLEEDING_RANK[e.bleeding] >= 2; }

  function sortedEntries(entriesByDate) {
    const list = Object.keys(entriesByDate).map(function (k) { return entriesByDate[k]; });
    list.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return list;
  }

  /**
   * Erkennt Perioden aus den Tageseinträgen.
   * Rückgabe: Array von Perioden, aufsteigend sortiert:
   *   { start, end, length, days: [entries], maxBleeding, avgPain, maxPain, manual }
   *
   * Regeln:
   *  - Blutungstage (inkl. Schmierblutung und manuell markierte Starttage) werden
   *    zu Läufen zusammengefasst; Lücken bis PERIOD_GAP_MAX Tage bleiben im Lauf.
   *  - Ein Lauf ist eine Periode, wenn er einen manuell markierten Starttag oder
   *    mindestens einen Tag mit Blutung ab "leicht" enthält. Nur Schmierblutung
   *    ergibt keine Periode.
   *  - Der Start ist der erste Tag mit Blutung ab "leicht" oder ein markierter Tag.
   *    Markierte Starttage teilen einen Lauf in mehrere Perioden; Tage vor dem
   *    ersten markierten Start bilden eine eigene Periode, wenn sie echte Blutung haben.
   */
  function detectPeriods(entriesByDate) {
    const list = sortedEntries(entriesByDate).filter(function (e) {
      return hasBleeding(e) || e.periodStart;
    });
    const runs = [];
    let run = null;
    list.forEach(function (e) {
      if (run && diffDays(run[run.length - 1].date, e.date) <= PERIOD_GAP_MAX + 1) {
        run.push(e);
      } else {
        run = [e];
        runs.push(run);
      }
    });

    const periods = [];
    runs.forEach(function (days) {
      // Trennpunkte: alle manuell markierten Starttage; liegt der automatische
      // Start (erster Tag ab "leicht") davor, zählt er zusätzlich als Start.
      const manual = days.filter(function (e) { return e.periodStart; }).map(function (e) { return e.date; });
      const firstReal = days.filter(hasRealBleeding)[0];
      const starts = manual.slice();
      if (firstReal && (manual.length === 0 || firstReal.date < manual[0])) starts.unshift(firstReal.date);
      if (starts.length === 0) return; // nur Schmierblutung
      for (let i = 0; i < starts.length; i++) {
        const from = starts[i];
        const to = i + 1 < starts.length ? starts[i + 1] : null;
        const part = days.filter(function (e) { return e.date >= from && (to === null || e.date < to); });
        periods.push(makePeriod(part, manual.indexOf(from) >= 0));
      }
    });
    return periods;
  }

  function makePeriod(days, manual) {
    const start = days[0].date;
    // Ende = letzter Tag mit Blutung (ein markierter Starttag ohne Blutung zählt trotzdem)
    const end = days[days.length - 1].date;
    let maxB = 'none', painSum = 0, painN = 0, maxPain = 0;
    days.forEach(function (e) {
      if (BLEEDING_RANK[e.bleeding] > BLEEDING_RANK[maxB]) maxB = e.bleeding;
      if (e.pain > 0) { painSum += e.pain; painN++; }
      if (e.pain > maxPain) maxPain = e.pain;
    });
    return {
      start: start,
      end: end,
      length: diffDays(start, end) + 1,
      days: days,
      maxBleeding: maxB,
      avgPain: painN ? Math.round((painSum / painN) * 10) / 10 : 0,
      maxPain: maxPain,
      manual: manual
    };
  }

  /**
   * Zyklen aus Perioden: ein Zyklus beginnt mit einem Periodenstart und endet am
   * Tag vor dem nächsten. Der letzte Zyklus ist offen (length = null).
   * Rückgabe: [{ start, length, period, outlier }]
   */
  function computeCycles(periods) {
    return periods.map(function (p, i) {
      const next = periods[i + 1];
      const length = next ? diffDays(p.start, next.start) : null;
      return {
        start: p.start,
        length: length,
        period: p,
        outlier: length !== null && (length < CYCLE_MIN || length > CYCLE_MAX)
      };
    });
  }

  /**
   * Soll der Schalter "Erster Tag der Periode" automatisch gesetzt werden?
   * Ja, wenn die Blutung ab "leicht" ist, der Tag nicht schon zu einer laufenden
   * Periode gehört und der letzte Periodenstart mindestens 10 Tage zurückliegt.
   */
  function suggestPeriodStart(entriesByDate, date, bleeding) {
    if (BLEEDING_RANK[bleeding] < 2) return false;
    // Einträge ohne den betrachteten Tag bewerten
    const others = {};
    Object.keys(entriesByDate).forEach(function (k) {
      if (k !== date) others[k] = entriesByDate[k];
    });
    // Blutung an einem der 3 Vortage → gehört zur laufenden Periode
    for (let i = 1; i <= PERIOD_GAP_MAX + 1; i++) {
      const prev = others[addDays(date, -i)];
      if (prev && hasBleeding(prev)) return false;
    }
    const periods = detectPeriods(others);
    const before = periods.filter(function (p) { return p.start <= date; });
    if (before.length === 0) return true;
    const last = before[before.length - 1];
    return diffDays(last.start, date) >= NEW_PERIOD_MIN_GAP;
  }

  /* ------------------------------------------------------------------ */
  /* 4. Vorhersage                                                       */
  /* ------------------------------------------------------------------ */

  const CYCLE_MIN = 18;        // Ausreißergrenzen für die Vorhersage
  const CYCLE_MAX = 50;
  const HISTORY = 6;           // Anzahl der berücksichtigten Zyklen/Perioden
  const IRREGULAR_SPREAD = 7;  // Schwankung > 7 Tage → Zeitraum statt Datum
  const LUTEAL_DAYS = 14;      // Eisprung = nächster Start - 14
  const FERTILE_BEFORE = 5;
  const FERTILE_AFTER = 1;
  const PREDICTION_COUNT = 3;

  function mean(arr) {
    return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
  }

  /**
   * Berechnet Vorhersagen und den heutigen Zustand.
   * @param entriesByDate  { "YYYY-MM-DD": entry }
   * @param settings       { defaultCycle, defaultPeriod }
   * @param today          "YYYY-MM-DD"
   */
  function predict(entriesByDate, settings, today) {
    const defaults = {
      defaultCycle: clampInt(settings && settings.defaultCycle, 15, 90) || 28,
      defaultPeriod: clampInt(settings && settings.defaultPeriod, 1, 14) || 5
    };
    const periods = detectPeriods(entriesByDate);
    const cycles = computeCycles(periods);
    const completed = cycles.filter(function (c) { return c.length !== null; });
    const recent = completed.slice(-HISTORY);
    const valid = recent.filter(function (c) { return !c.outlier; }).map(function (c) { return c.length; });

    const usingDefaults = valid.length < 2;
    const cycleLength = usingDefaults ? defaults.defaultCycle : Math.round(mean(valid));
    const periodLengths = periods.slice(-HISTORY).map(function (p) { return p.length; });
    const periodLength = periods.length < 2 ? defaults.defaultPeriod
      : Math.max(1, Math.round(mean(periodLengths)));
    const minCycle = valid.length ? Math.min.apply(null, valid) : cycleLength;
    const maxCycle = valid.length ? Math.max.apply(null, valid) : cycleLength;
    const irregular = !usingDefaults && (maxCycle - minCycle) > IRREGULAR_SPREAD;

    const result = {
      periods: periods,
      cycles: cycles,
      usingDefaults: usingDefaults,
      cycleLength: cycleLength,
      periodLength: periodLength,
      minCycle: minCycle,
      maxCycle: maxCycle,
      irregular: irregular,
      validCycleCount: valid.length,
      predictions: [],
      lastPeriod: null,
      cycleDay: null,
      phase: 'unknown',
      daysUntil: null,
      overdueDays: 0
    };
    if (periods.length === 0) return result;

    // Letzte Periode, die heute oder früher begonnen hat
    const past = periods.filter(function (p) { return p.start <= today; });
    const last = past.length ? past[past.length - 1] : periods[0];
    result.lastPeriod = last;

    for (let i = 0; i < PREDICTION_COUNT; i++) {
      const start = addDays(last.start, cycleLength * (i + 1));
      const ovulation = addDays(start, -LUTEAL_DAYS);
      result.predictions.push({
        start: start,
        end: addDays(start, periodLength - 1),           // inklusiv
        rangeStart: irregular ? addDays(last.start, minCycle + cycleLength * i) : start,
        rangeEnd: irregular ? addDays(last.start, maxCycle + cycleLength * i) : start,
        ovulation: ovulation,
        fertileStart: addDays(ovulation, -FERTILE_BEFORE),
        fertileEnd: addDays(ovulation, FERTILE_AFTER)
      });
    }

    if (last.start <= today) {
      result.cycleDay = diffDays(last.start, today) + 1;
      const next = result.predictions[0];
      result.daysUntil = diffDays(today, next.start);
      if (result.daysUntil < 0) {
        result.overdueDays = -result.daysUntil;
        result.phase = 'overdue';
      } else if (today <= last.end || (result.cycleDay <= periodLength && diffDays(last.end, today) <= PERIOD_GAP_MAX)) {
        result.phase = 'menstruation';
      } else if (today < addDays(next.ovulation, -1)) {
        result.phase = 'follicular';
      } else if (today <= addDays(next.ovulation, 1)) {
        result.phase = 'ovulation';
      } else {
        result.phase = 'luteal';
      }
    }
    return result;
  }

  /* ------------------------------------------------------------------ */
  /* 5. Statistik                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Statistik über alle Zyklen.
   * Rückgabe: { rows, avgCycle, minCycle, maxCycle, avgPeriod, painHeatmap }
   *   rows: neueste zuerst, je { start, cycleLength, periodLength, maxBleeding,
   *         avgPain, maxPain, outlier, open }
   *   painHeatmap: [{ day, avg, n }] durchschnittlicher Schmerz pro Zyklustag
   */
  function computeStats(entriesByDate) {
    const periods = detectPeriods(entriesByDate);
    const cycles = computeCycles(periods);
    const rows = cycles.map(function (c) {
      return {
        start: c.start,
        cycleLength: c.length,
        periodLength: c.period.length,
        maxBleeding: c.period.maxBleeding,
        avgPain: c.period.avgPain,
        maxPain: c.period.maxPain,
        outlier: c.outlier,
        open: c.length === null
      };
    }).reverse();

    const lens = cycles.filter(function (c) { return c.length !== null; }).map(function (c) { return c.length; });
    const plens = periods.map(function (p) { return p.length; });

    // Heatmap: Schmerz pro Zyklustag über alle Zyklen
    const acc = {};
    const list = sortedEntries(entriesByDate);
    cycles.forEach(function (c, i) {
      const next = cycles[i + 1];
      list.forEach(function (e) {
        if (e.date < c.start || (next && e.date >= next.start)) return;
        const day = diffDays(c.start, e.date) + 1;
        if (day > 60) return;
        if (!acc[day]) acc[day] = { sum: 0, n: 0, max: 0 };
        acc[day].sum += e.pain;
        acc[day].n++;
        if (e.pain > acc[day].max) acc[day].max = e.pain;
      });
    });
    const heat = Object.keys(acc).map(Number).sort(function (a, b) { return a - b; }).map(function (d) {
      return { day: d, avg: Math.round((acc[d].sum / acc[d].n) * 10) / 10, max: acc[d].max, n: acc[d].n };
    });

    return {
      rows: rows,
      cycleCount: lens.length,
      avgCycle: lens.length ? Math.round(mean(lens) * 10) / 10 : null,
      minCycle: lens.length ? Math.min.apply(null, lens) : null,
      maxCycle: lens.length ? Math.max.apply(null, lens) : null,
      avgPeriod: plens.length ? Math.round(mean(plens) * 10) / 10 : null,
      minPeriod: plens.length ? Math.min.apply(null, plens) : null,
      maxPeriod: plens.length ? Math.max.apply(null, plens) : null,
      painHeatmap: heat,
      cycleLengths: cycles.filter(function (c) { return c.length !== null; })
        .map(function (c) { return { start: c.start, length: c.length, outlier: c.outlier }; })
    };
  }

  /* ------------------------------------------------------------------ */
  /* 6. Abbildung auf Google-Kalender-Termine                            */
  /* ------------------------------------------------------------------ */

  // Farben laut Google Calendar "event colors" (colors.event):
  // 11 Tomato (rot), 4 Flamingo (hellrot), 6 Tangerine (orange), 2 Sage (grün), 8 Graphite
  const COLOR = { period: '11', light: '4', prediction: '6', fertile: '2', neutral: '8' };

  /**
   * Deterministische Event-ID. Erlaubt sind laut API nur die Zeichen der
   * base32hex-Kodierung: Kleinbuchstaben a–v und Ziffern 0–9, Länge 5–1024.
   *   Tag:        ckd20260305
   *   Vorhersage: ckp20260401
   *   Fruchtbar:  ckf20260318
   */
  function eventId(type, date) {
    const prefix = { day: 'ckd', prediction: 'ckp', fertile: 'ckf' }[type];
    if (!prefix) throw new Error('unbekannter Typ ' + type);
    return prefix + date.replace(/-/g, '');
  }

  function isValidEventId(id) {
    return /^[a-v0-9]{5,1024}$/.test(id);
  }

  /**
   * Zyklustag eines Datums relativ zur letzten Periode, die an/vor dem Datum begann.
   * Gibt null zurück, wenn keine Periode bekannt ist.
   */
  function cycleDayFor(periods, date) {
    let last = null;
    periods.forEach(function (p) { if (p.start <= date) last = p; });
    return last ? diffDays(last.start, date) + 1 : null;
  }

  /** Liegt das Datum innerhalb einer erkannten Periode (Start..Ende)? */
  function periodDayFor(periods, date) {
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      if (date >= p.start && date <= p.end) return diffDays(p.start, date) + 1;
    }
    return null;
  }

  /** Lesbarer Titel für einen Tageseintrag. */
  function entryTitle(e, ctx) {
    const cycleDay = ctx.cycleDay;
    if (ctx.discreet) {
      return (hasBleeding(e) ? '●' : '○') + (cycleDay ? ' Z' + cycleDay : '');
    }
    const parts = [];
    if (hasRealBleeding(e) || (hasBleeding(e) && ctx.periodDay)) {
      parts.push('🩸 Periode' + (ctx.periodDay ? ' Tag ' + ctx.periodDay : ''));
      parts.push(BLEEDING_LABEL[e.bleeding]);
    } else if (hasBleeding(e)) {
      parts.push('🩸 Schmierblutung');
    }
    if (e.pain > 0) parts.push('Schmerz ' + e.pain + '/10');
    if (parts.length === 0) {
      if (e.symptoms.length) {
        parts.push('Symptome');
        parts.push(e.symptoms.slice(0, 2).map(function (s) { return SYMPTOM_LABEL[s]; }).join(', ') +
          (e.symptoms.length > 2 ? ' …' : ''));
      } else if (e.mood) {
        parts.push('Stimmung ' + MOOD_LABEL[e.mood]);
      } else if (e.note) {
        parts.push('Notiz');
      } else {
        parts.push('Eintrag');
      }
    } else if (e.symptoms.length && parts.length < 3) {
      parts.push(SYMPTOM_LABEL[e.symptoms[0]] + (e.symptoms.length > 1 ? ' …' : ''));
    }
    return parts.join(' · ');
  }

  /** Lesbare Beschreibung mit allen Werten (Freitext, wird nur als Text angezeigt). */
  function entryDescription(e, ctx) {
    const lines = [];
    lines.push('Datum: ' + formatDE(e.date) + (ctx.cycleDay ? ' (Zyklustag ' + ctx.cycleDay + ')' : ''));
    lines.push('Blutung: ' + BLEEDING_LABEL[e.bleeding]);
    if (e.periodStart) lines.push('Erster Tag der Periode');
    if (e.pain > 0 || e.painLocations.length) {
      lines.push('Schmerzen: ' + e.pain + '/10' +
        (e.painLocations.length ? ' (' + e.painLocations.map(function (l) { return PAIN_LOCATION_LABEL[l]; }).join(', ') + ')' : ''));
    }
    if (e.symptoms.length) lines.push('Symptome: ' + e.symptoms.map(function (s) { return SYMPTOM_LABEL[s]; }).join(', '));
    if (e.mood) lines.push('Stimmung: ' + MOOD_LABEL[e.mood]);
    if (e.medication) {
      lines.push('Schmerzmittel: ja' + (e.medicationName ? ', ' + e.medicationName : '') +
        (e.medicationCount ? ' ×' + e.medicationCount : ''));
    }
    if (e.product) {
      lines.push('Produkt: ' + PRODUCT_LABEL[e.product] + (e.productChanges ? ', ' + e.productChanges + ' Wechsel' : ''));
    }
    if (e.sex) {
      lines.push('Geschlechtsverkehr: ja' + (e.sexProtection ? ', ' + SEX_PROTECTION_LABEL[e.sexProtection] : ''));
    }
    if (e.note) lines.push('Notiz: ' + e.note);
    lines.push('');
    lines.push('Eingetragen mit der Zyklus App. Bitte hier nicht bearbeiten, Änderungen bitte in der App vornehmen.');
    return lines.join('\n');
  }

  /**
   * Google-Event für einen Tageseintrag (ohne id/calendarId).
   * ctx: { periods, discreet }
   */
  function buildDayEvent(e, ctx) {
    const periods = ctx.periods || [];
    const c = {
      discreet: !!ctx.discreet,
      cycleDay: cycleDayFor(periods, e.date),
      periodDay: periodDayFor(periods, e.date)
    };
    let colorId = COLOR.neutral;
    if (BLEEDING_RANK[e.bleeding] >= 3) colorId = COLOR.period;
    else if (BLEEDING_RANK[e.bleeding] >= 1) colorId = COLOR.light;

    // Strukturierte Daten: kompakt, ohne Notiz (die bekommt eine eigene Property)
    const data = {
      b: e.bleeding, ps: e.periodStart ? 1 : 0, p: e.pain, pl: e.painLocations,
      s: e.symptoms, m: e.mood, med: e.medication ? 1 : 0, medn: e.medicationName,
      medc: e.medicationCount, pr: e.product, prc: e.productChanges,
      sx: e.sex ? 1 : 0, sxp: e.sexProtection, u: e.updatedAt
    };
    return {
      summary: entryTitle(e, c),
      description: entryDescription(e, c),
      start: { date: e.date },
      end: { date: addDays(e.date, 1) },        // Enddatum ist exklusiv
      transparency: 'transparent',
      visibility: 'private',
      reminders: { useDefault: false, overrides: [] },
      colorId: colorId,
      extendedProperties: {
        private: {
          app: APP_ID,
          v: String(DATA_VERSION),
          type: 'day',
          date: e.date,
          data: JSON.stringify(data),
          note: e.note || ''
        }
      }
    };
  }

  /**
   * Google-Event für eine vorhergesagte Periode.
   * reminder: null oder "HH:MM" (Erinnerung am Vortag um diese Uhrzeit)
   */
  function buildPredictionEvent(pred, ctx) {
    const overrides = [];
    if (ctx.reminderTime && /^\d{2}:\d{2}$/.test(ctx.reminderTime)) {
      const hm = ctx.reminderTime.split(':');
      // Ganztägiger Termin beginnt um 0:00 → Vortag HH:MM = (24*60 - HH*60 - MM) Minuten davor
      overrides.push({ method: 'popup', minutes: 24 * 60 - (+hm[0]) * 60 - (+hm[1]) });
    }
    const irregular = pred.rangeStart !== pred.rangeEnd;
    const title = ctx.discreet ? '◌ ca.' : 'Periode erwartet (ca.)';
    const desc = ctx.discreet ? '' :
      'Voraussichtlicher Beginn: ' + (irregular ? formatDE(pred.rangeStart) + ' bis ' + formatDE(pred.rangeEnd) : formatDE(pred.start)) +
      '\nErwartete Dauer: ' + (diffDays(pred.start, pred.end) + 1) + ' Tage' +
      '\n\nSchätzung der Zyklus App. Nicht zur Verhütung geeignet.';
    return {
      summary: title,
      description: desc,
      start: { date: irregular ? pred.rangeStart : pred.start },
      end: { date: addDays(irregular ? pred.rangeEnd : pred.end, 1) },
      transparency: 'transparent',
      visibility: 'private',
      reminders: { useDefault: false, overrides: overrides },
      colorId: COLOR.prediction,
      extendedProperties: {
        private: { app: APP_ID, v: String(DATA_VERSION), type: 'prediction', date: pred.start }
      }
    };
  }

  /** Google-Event für ein fruchtbares Fenster. */
  function buildFertileEvent(pred, ctx) {
    return {
      summary: ctx.discreet ? '◌ +' : 'Fruchtbares Fenster (ca.)',
      description: ctx.discreet ? '' :
        'Voraussichtlicher Eisprung: ' + formatDE(pred.ovulation) +
        '\n\nSchätzung der Zyklus App. Nicht zur Verhütung geeignet.',
      start: { date: pred.fertileStart },
      end: { date: addDays(pred.fertileEnd, 1) },
      transparency: 'transparent',
      visibility: 'private',
      reminders: { useDefault: false, overrides: [] },
      colorId: COLOR.fertile,
      extendedProperties: {
        private: { app: APP_ID, v: String(DATA_VERSION), type: 'fertile', date: pred.fertileStart }
      }
    };
  }

  /**
   * Liest einen Tageseintrag aus einem Google-Event. Es werden ausschließlich die
   * extendedProperties ausgewertet, nie Titel oder Beschreibung.
   * Rückgabe: { type: 'day', entry } | { type: 'prediction'|'fertile', date } | null
   */
  function parseEvent(ev) {
    const p = ev && ev.extendedProperties && ev.extendedProperties.private;
    if (!p || p.app !== APP_ID) return null;
    if (ev.status === 'cancelled') return null;
    if (p.type === 'prediction' || p.type === 'fertile') {
      return { type: p.type, date: p.date, id: ev.id };
    }
    if (p.type !== 'day' || !isValidDate(p.date)) return null;
    let d = {};
    try { d = JSON.parse(p.data || '{}'); } catch (err) { d = {}; }
    const entry = normalizeEntry({
      date: p.date,
      bleeding: d.b, periodStart: !!d.ps, pain: d.p, painLocations: d.pl, symptoms: d.s,
      mood: d.m, medication: !!d.med, medicationName: d.medn, medicationCount: d.medc,
      product: d.pr, productChanges: d.prc, sex: !!d.sx, sexProtection: d.sxp,
      note: p.note, updatedAt: d.u
    });
    return entry ? { type: 'day', entry: entry, id: ev.id } : null;
  }

  /* ------------------------------------------------------------------ */
  /* Export                                                              */
  /* ------------------------------------------------------------------ */

  root.ZyklusCore = {
    APP_ID: APP_ID, DATA_VERSION: DATA_VERSION, NOTE_MAX: NOTE_MAX,
    BLEEDING: BLEEDING, BLEEDING_LABEL: BLEEDING_LABEL, BLEEDING_RANK: BLEEDING_RANK,
    PAIN_LOCATIONS: PAIN_LOCATIONS, PAIN_LOCATION_LABEL: PAIN_LOCATION_LABEL,
    SYMPTOMS: SYMPTOMS, SYMPTOM_LABEL: SYMPTOM_LABEL,
    MOODS: MOODS, MOOD_LABEL: MOOD_LABEL,
    PRODUCTS: PRODUCTS, PRODUCT_LABEL: PRODUCT_LABEL,
    SEX_PROTECTION: SEX_PROTECTION, SEX_PROTECTION_LABEL: SEX_PROTECTION_LABEL,
    PHASE_LABEL: PHASE_LABEL, MONTHS_DE: MONTHS_DE, WEEKDAYS_DE: WEEKDAYS_DE,
    COLOR: COLOR,
    CYCLE_MIN: CYCLE_MIN, CYCLE_MAX: CYCLE_MAX,
    emptyEntry: emptyEntry, normalizeEntry: normalizeEntry, isEntryEmpty: isEntryEmpty,
    isValidDate: isValidDate, addDays: addDays, diffDays: diffDays, todayISO: todayISO,
    weekdayMon: weekdayMon, daysInMonth: daysInMonth,
    formatDE: formatDE, formatShortDE: formatShortDE, formatLongDE: formatLongDE,
    hasBleeding: hasBleeding, hasRealBleeding: hasRealBleeding,
    detectPeriods: detectPeriods, computeCycles: computeCycles, suggestPeriodStart: suggestPeriodStart,
    predict: predict, computeStats: computeStats,
    cycleDayFor: cycleDayFor, periodDayFor: periodDayFor,
    eventId: eventId, isValidEventId: isValidEventId,
    entryTitle: entryTitle, entryDescription: entryDescription,
    buildDayEvent: buildDayEvent, buildPredictionEvent: buildPredictionEvent,
    buildFertileEvent: buildFertileEvent, parseEvent: parseEvent
  };
})(typeof window !== 'undefined' ? window : globalThis);
