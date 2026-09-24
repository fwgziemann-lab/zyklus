/*
 * Zyklus – Statistik und Arztbericht (stats.js)
 *
 * Rendert die Ansichten "Statistik" und "Bericht" aus den Ergebnissen von
 * core.js. Diagramme werden als SVG direkt im DOM aufgebaut (keine Bibliothek).
 * Nutzerdaten (Notizen usw.) werden ausschließlich per textContent gesetzt.
 */
(function () {
  'use strict';
  const C = window.ZyklusCore;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function $(id) { return document.getElementById(id); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  function svgEl(tag, attrs, text) {
    const n = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function fmt1(n) { return n === null || n === undefined ? '–' : String(n).replace('.', ','); }
  function dash(v) { return v === null || v === undefined || v === '' ? '–' : v; }

  /* ------------------------------------------------------------------ */
  /* Statistik                                                           */
  /* ------------------------------------------------------------------ */

  function render(state) {
    const s = C.computeStats(state.entries);
    const p = state.pred;

    // KPIs
    const kpis = $('stats-kpis');
    clear(kpis);
    $('stats-empty').hidden = s.cycleCount > 0;
    if (s.cycleCount > 0) {
      const items = [
        ['Ø Zyklus', fmt1(s.avgCycle) + ' Tage'],
        ['Schwankung', s.minCycle + '–' + s.maxCycle + ' Tage'],
        ['Ø Periode', fmt1(s.avgPeriod) + ' Tage'],
        ['Zyklen erfasst', String(s.cycleCount)],
        ['Für Vorhersage', p.usingDefaults ? 'Standardwerte' : p.cycleLength + ' Tage' + (p.irregular ? ' (unregelmäßig)' : '')]
      ];
      items.forEach(function (it) {
        kpis.appendChild(el('div', { class: 'kpi' }, [el('div', { class: 'v', text: it[1] }), el('div', { class: 'l', text: it[0] })]));
      });
    }

    // Diagramm Zykluslängen
    const chart = $('stats-chart');
    clear(chart);
    if (s.cycleLengths.length >= 1) chart.appendChild(lineChart(s.cycleLengths, s.avgCycle));
    else chart.appendChild(el('p', { class: 'small muted', text: 'Noch kein vollständiger Zyklus.' }));

    // Heatmap
    const heat = $('stats-heatmap');
    clear(heat);
    if (s.painHeatmap.length) heat.appendChild(heatmap(s.painHeatmap));
    else heat.appendChild(el('p', { class: 'small muted', text: 'Noch keine Schmerzangaben erfasst.' }));

    // Tabelle
    const table = $('stats-table');
    clear(table);
    table.appendChild(el('thead', null, [el('tr', null, [
      el('th', { text: 'Start' }), el('th', { class: 'num', text: 'Zyklus' }), el('th', { class: 'num', text: 'Periode' }),
      el('th', { text: 'Max. Blutung' }), el('th', { class: 'num', text: 'Ø Schmerz' }), el('th', { class: 'num', text: 'Max. Schmerz' })
    ])]));
    const tbody = el('tbody');
    s.rows.forEach(function (r) {
      tbody.appendChild(el('tr', { class: r.outlier ? 'outlier' : '' }, [
        el('td', { text: C.formatDE(r.start) }),
        el('td', { class: 'num', text: r.open ? 'läuft' : r.cycleLength + (r.outlier ? ' ⚠' : '') }),
        el('td', { class: 'num', text: String(r.periodLength) }),
        el('td', { text: C.BLEEDING_LABEL[r.maxBleeding] }),
        el('td', { class: 'num', text: r.avgPain ? fmt1(r.avgPain) : '–' }),
        el('td', { class: 'num', text: r.maxPain ? String(r.maxPain) : '–' })
      ]));
    });
    table.appendChild(tbody);
  }

  /** Liniendiagramm der Zykluslängen über die Zeit. */
  function lineChart(data, avg) {
    const W = 640, H = 220, padL = 36, padR = 14, padT = 14, padB = 34;
    const svg = svgEl('svg', { class: 'chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Zykluslängen über die Zeit' });
    const lens = data.map(function (d) { return d.length; });
    let yMin = Math.min(18, Math.min.apply(null, lens)) - 2, yMax = Math.max(40, Math.max.apply(null, lens)) + 2;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const inset = 16; // Abstand der ersten/letzten Punkte zum Rand, damit Beschriftungen nicht kollidieren
    const x = function (i) { return data.length === 1 ? padL + innerW / 2 : padL + inset + (i / (data.length - 1)) * (innerW - 2 * inset); };
    const y = function (v) { return padT + (1 - (v - yMin) / (yMax - yMin)) * innerH; };

    // Normalbereich 18–50 als leichtes Band (auf sichtbaren Bereich begrenzt)
    const bandTop = y(Math.min(yMax, C.CYCLE_MAX)), bandBottom = y(Math.max(yMin, C.CYCLE_MIN));
    svg.appendChild(svgEl('rect', { class: 'band', x: padL, y: bandTop, width: innerW, height: Math.max(0, bandBottom - bandTop) }));

    // Gitter und Y-Beschriftung
    const step = (yMax - yMin) > 30 ? 10 : 5;
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
      svg.appendChild(svgEl('line', { class: 'grid', x1: padL, x2: W - padR, y1: y(v), y2: y(v) }));
      svg.appendChild(svgEl('text', { x: padL - 6, y: y(v) + 4, 'text-anchor': 'end' }, String(v)));
    }
    // Durchschnitt
    if (avg !== null) {
      svg.appendChild(svgEl('line', { class: 'grid avg', x1: padL, x2: W - padR, y1: y(avg), y2: y(avg) }));
      svg.appendChild(svgEl('text', { x: W - padR, y: y(avg) + 12, 'text-anchor': 'end' }, 'Ø ' + fmt1(avg)));
    }
    // Linie
    if (data.length > 1) {
      const d = data.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.length).toFixed(1); }).join(' ');
      svg.appendChild(svgEl('path', { class: 'line', d: d }));
    }
    // Punkte und X-Beschriftung
    const labelEvery = Math.max(1, Math.ceil(data.length / 8));
    data.forEach(function (p, i) {
      const c = svgEl('circle', { class: 'dot' + (p.outlier ? ' outlier' : ''), cx: x(i), cy: y(p.length), r: 4.5 });
      c.appendChild(svgEl('title', {}, C.formatDE(p.start) + ': ' + p.length + ' Tage'));
      svg.appendChild(c);
      svg.appendChild(svgEl('text', { x: x(i), y: y(p.length) - 9, 'text-anchor': 'middle' }, String(p.length)));
      if (i % labelEvery === 0 || i === data.length - 1) {
        svg.appendChild(svgEl('text', { x: x(i), y: H - padB + 16, 'text-anchor': 'middle' }, C.formatShortDE(p.start) + p.start.slice(2, 4)));
      }
    });
    return svg;
  }

  /** Heatmap: durchschnittlicher Schmerz pro Zyklustag. */
  function heatmap(rows) {
    const maxDay = Math.min(40, Math.max.apply(null, rows.map(function (r) { return r.day; })));
    const cols = 10, size = 56, gap = 4, labelH = 0;
    const nRows = Math.ceil(maxDay / cols);
    const W = cols * (size + gap) - gap, H = nRows * (size + gap) - gap + labelH;
    const svg = svgEl('svg', { class: 'chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Schmerz pro Zyklustag' });
    const byDay = {};
    rows.forEach(function (r) { byDay[r.day] = r; });
    for (let d = 1; d <= maxDay; d++) {
      const i = d - 1, cx = (i % cols) * (size + gap), cy = Math.floor(i / cols) * (size + gap);
      const r = byDay[d];
      const v = r ? r.avg : 0;
      const alpha = r ? 0.08 + (v / 10) * 0.92 : 0.04;
      const g = svgEl('g');
      g.appendChild(svgEl('rect', { x: cx, y: cy, width: size, height: size, rx: 8, fill: 'var(--accent)', 'fill-opacity': alpha.toFixed(2) }));
      g.appendChild(svgEl('text', { x: cx + 6, y: cy + 15, 'font-size': '11', fill: v > 5 ? '#fff' : 'var(--muted)' }, 'T' + d));
      if (r) {
        g.appendChild(svgEl('text', { x: cx + size / 2, y: cy + size / 2 + 10, 'text-anchor': 'middle', 'font-size': '18', 'font-weight': '700', fill: v > 5 ? '#fff' : 'var(--text)' }, fmt1(v)));
        g.appendChild(svgEl('title', {}, 'Zyklustag ' + d + ': Ø ' + fmt1(v) + '/10, max ' + r.max + ' (' + r.n + ' Einträge)'));
      }
      svg.appendChild(g);
    }
    return svg;
  }

  /* ------------------------------------------------------------------ */
  /* Arztbericht                                                         */
  /* ------------------------------------------------------------------ */

  function renderReport(state) {
    const root = $('report');
    clear(root);
    const s = C.computeStats(state.entries);
    const p = state.pred;
    const cycles = p.cycles.slice(-6);
    const today = C.todayISO();

    root.appendChild(el('h2', { text: 'Zyklusbericht' }));
    root.appendChild(el('p', { class: 'small muted', text: 'Erstellt am ' + C.formatDE(today) + ' · Zeitraum: ' + (cycles.length ? C.formatDE(cycles[0].start) + ' bis ' + C.formatDE(today) : '–') + ' · Alle Angaben sind Selbstbeobachtungen.' }));

    if (!cycles.length) {
      root.appendChild(el('p', { text: 'Noch keine Perioden eingetragen.' }));
      return;
    }

    // Zusammenfassung
    const sum = el('div', { class: 'kpis', style: 'margin:.75rem 0 1rem' });
    [
      ['Ø Zykluslänge', s.avgCycle !== null ? fmt1(s.avgCycle) + ' Tage (' + s.minCycle + '–' + s.maxCycle + ')' : '–'],
      ['Ø Periodendauer', s.avgPeriod !== null ? fmt1(s.avgPeriod) + ' Tage (' + s.minPeriod + '–' + s.maxPeriod + ')' : '–'],
      ['Letzte Periode', p.lastPeriod ? C.formatDE(p.lastPeriod.start) : '–'],
      ['Zyklen im Bericht', String(cycles.length)]
    ].forEach(function (it) {
      sum.appendChild(el('div', { class: 'kpi' }, [el('div', { class: 'v', style: 'font-size:1.1rem', text: it[1] }), el('div', { class: 'l', text: it[0] })]));
    });
    root.appendChild(sum);

    // Übersichtstabelle
    root.appendChild(el('h3', { text: 'Zyklen im Überblick', style: 'margin:.5rem 0' }));
    const t = el('table');
    t.appendChild(el('thead', null, [el('tr', null, [
      el('th', { text: 'Periodenstart' }), el('th', { class: 'num', text: 'Zyklus (Tage)' }), el('th', { class: 'num', text: 'Periode (Tage)' }),
      el('th', { text: 'Max. Blutung' }), el('th', { class: 'num', text: 'Ø Schmerz' }), el('th', { class: 'num', text: 'Max. Schmerz' }), el('th', { text: 'Schmerzmittel' })
    ])]));
    const tb = el('tbody');
    cycles.forEach(function (c) {
      const meds = c.period.days.filter(function (d) { return d.medication; }).length;
      tb.appendChild(el('tr', null, [
        el('td', { text: C.formatDE(c.start) }),
        el('td', { class: 'num', text: c.length === null ? 'läuft' : String(c.length) + (c.outlier ? ' *' : '') }),
        el('td', { class: 'num', text: String(c.period.length) }),
        el('td', { text: C.BLEEDING_LABEL[c.period.maxBleeding] }),
        el('td', { class: 'num', text: c.period.avgPain ? fmt1(c.period.avgPain) : '–' }),
        el('td', { class: 'num', text: c.period.maxPain ? String(c.period.maxPain) : '–' }),
        el('td', { text: meds ? meds + ' Tag' + (meds === 1 ? '' : 'e') : '–' })
      ]));
    });
    t.appendChild(tb);
    root.appendChild(el('div', { class: 'table-wrap' }, [t]));
    if (cycles.some(function (c) { return c.outlier; })) {
      root.appendChild(el('p', { class: 'small muted', text: '* Zykluslänge außerhalb 18–50 Tage; für die Vorhersage nicht berücksichtigt.' }));
    }

    // Tagesdetails pro Zyklus (alle Einträge des Zyklus, nicht nur Blutungstage)
    root.appendChild(el('h3', { text: 'Tagesdetails', style: 'margin:1rem 0 .5rem' }));
    const list = Object.keys(state.entries).sort();
    cycles.forEach(function (c, i) {
      const next = cycles[i + 1];
      const days = list.filter(function (d) { return d >= c.start && (!next || d < next.start); }).map(function (d) { return state.entries[d]; });
      root.appendChild(el('h4', { text: 'Zyklus ab ' + C.formatDE(c.start) + (c.length ? ' (' + c.length + ' Tage)' : ' (laufend)'), style: 'margin:.75rem 0 .3rem;font-size:.95rem' }));
      const dt = el('table');
      dt.appendChild(el('thead', null, [el('tr', null, [
        el('th', { text: 'Datum' }), el('th', { class: 'num', text: 'ZT' }), el('th', { text: 'Blutung' }), el('th', { class: 'num', text: 'Schmerz' }),
        el('th', { text: 'Ort' }), el('th', { text: 'Symptome' }), el('th', { text: 'Stimmung' }), el('th', { text: 'Medikament' }), el('th', { text: 'Produkt' }), el('th', { text: 'GV' }), el('th', { text: 'Notiz' })
      ])]));
      const dtb = el('tbody');
      days.forEach(function (e) {
        dtb.appendChild(el('tr', null, [
          el('td', { text: C.formatDE(e.date) + (e.periodStart ? ' ●' : '') }),
          el('td', { class: 'num', text: String(C.diffDays(c.start, e.date) + 1) }),
          el('td', { text: e.bleeding === 'none' ? '–' : C.BLEEDING_LABEL[e.bleeding] }),
          el('td', { class: 'num', text: e.pain ? e.pain + '/10' : '–' }),
          el('td', { text: dash(e.painLocations.map(function (l) { return C.PAIN_LOCATION_LABEL[l]; }).join(', ')) }),
          el('td', { text: dash(e.symptoms.map(function (x) { return C.SYMPTOM_LABEL[x]; }).join(', ')), style: 'white-space:normal' }),
          el('td', { text: e.mood ? C.MOOD_LABEL[e.mood] : '–' }),
          el('td', { text: e.medication ? ('ja' + (e.medicationName ? ' ' + e.medicationName : '') + (e.medicationCount ? ' ×' + e.medicationCount : '')) : '–' }),
          el('td', { text: e.product ? C.PRODUCT_LABEL[e.product] + (e.productChanges ? ' (' + e.productChanges + '×)' : '') : '–' }),
          el('td', { text: e.sex ? ('ja' + (e.sexProtection ? ', ' + C.SEX_PROTECTION_LABEL[e.sexProtection] : '')) : '–' }),
          el('td', { text: dash(e.note), style: 'white-space:normal;max-width:16rem' })
        ]));
      });
      dt.appendChild(dtb);
      root.appendChild(el('div', { class: 'table-wrap' }, [dt]));
    });
    root.appendChild(el('p', { class: 'small muted', style: 'margin-top:1rem', text: '● = als erster Tag der Periode markiert · ZT = Zyklustag · GV = Geschlechtsverkehr · Schmerz auf einer Skala von 0 bis 10 · Erstellt mit der Zyklus App; Vorhersagen sind Schätzungen und nicht zur Verhütung geeignet.' }));
  }

  window.ZyklusStats = { render: render, renderReport: renderReport };
})();
