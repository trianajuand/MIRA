// MIRA · Registro de eventos, resultados de las pruebas y exportación a CSV.
'use strict';

// ---------- Registro ----------
function logEvent(tipo, detalle = '', dur = '') {
  const e = { hora: new Date().toISOString(), participante: pid(), entrada: inputMode(), tipo, detalle, dur_ms: dur };
  events.push(e);
  if (events.length > 5000) events.shift();
  const el = $('log');
  el.textContent = events.slice(-40).reverse().map(x => `${x.hora.slice(11, 19)}  ${x.tipo}${x.dur_ms !== '' ? ' ' + x.dur_ms + ' ms' : ''}${x.detalle ? ' · ' + x.detalle : ''}`).join('\n');
}
const COLS = ['fecha', 'participante', 'prueba', 'entrada', 'teclado', 'cierre_ms', 'barrido_ms', 'objetivo', 'resultado', 'duracion_s', 'aciertos', 'intentos', 'falsos_positivos', 'fp_por_min', 'espontaneos', 'ppm', 'distancia_edicion', 'borrados', 'selecciones'];
function addResult(r) {
  const row = Object.assign({ fecha: new Date().toISOString().slice(0, 19).replace('T', ' '), participante: pid(), entrada: inputMode(), teclado: cfg.layout, cierre_ms: cfg.hold, barrido_ms: cfg.interval }, r);
  results.push(row);
  try { localStorage.setItem('mira_results', JSON.stringify(results)); } catch (e) { /* sin almacenamiento */ }
  renderResults();
}
function renderResults() {
  const t = $('resTable');
  if (!results.length) { t.innerHTML = '<tr><td style="color:var(--muted)">Aún no hay resultados.</td></tr>'; return; }
  const rows = results.slice(-12).reverse().map(r => {
    let d = '';
    if (r.prueba === 'reposo') d = `${r.falsos_positivos} FP en ${r.duracion_s} s (${r.fp_por_min}/min), ${r.espontaneos} espontáneos`;
    else if (r.prueba === 'pautados') d = `${r.aciertos}/${r.intentos} detectados, ${r.falsos_positivos} FP`;
    else if (r.prueba === 'calibracion') d = `${r.resultado} en ${r.duracion_s} s (intento ${r.intentos})`;
    else d = `«${r.objetivo}» en ${r.duracion_s} s · ${r.ppm} ppm${r.teclado === 'alfabetico' && r.prueba === 'mensaje_mira' ? ' · alfabético' : ''}${r.distancia_edicion !== undefined ? ' · dist. ' + r.distancia_edicion : ''}`;
    return `<tr><td>${esc(r.participante)}</td><td>${esc(r.prueba)}${r.entrada === 'simulado' ? ' (sim.)' : r.entrada === 'clic' ? ' (clic)' : ''}</td><td>${esc(d)}</td></tr>`;
  });
  t.innerHTML = '<tr><th>Part.</th><th>Prueba</th><th>Resultado</th></tr>' + rows.join('');
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function downloadCsv(name, cols, rows) {
  const q = v => { v = v === undefined || v === null ? '' : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const txt = '﻿' + [cols.join(';'), ...rows.map(r => cols.map(c => q(r[c])).join(';'))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
