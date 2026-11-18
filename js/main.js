// MIRA · Gráfica, indicadores, bucle principal, eventos de la interfaz y arranque.
'use strict';

// ---------- Gráfica del EAR ----------
const ctx = $('chart').getContext('2d');
function drawChart(now) {
  const W = 672, H = 180, span = 8000;
  while (chartBuf.length && now - chartBuf[0].t > span) chartBuf.shift();
  ctx.clearRect(0, 0, W, H);
  const maxY = Math.max(0.42, (S.open || 0.3) * 1.25);
  const y = v => H - 6 - (Math.min(v, maxY) / maxY) * (H - 12);
  const x = t => W - ((now - t) / span) * W;
  if (S.calibrated) {
    ctx.strokeStyle = '#fb923c'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, y(S.thr)); ctx.lineTo(W, y(S.thr)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#fb923c'; ctx.font = '20px system-ui'; ctx.fillText('umbral', 8, y(S.thr) - 6);
  }
  if (chartBuf.length > 1) {
    ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 3; ctx.beginPath();
    chartBuf.forEach((p, i) => i ? ctx.lineTo(x(p.t), y(p.ear)) : ctx.moveTo(x(p.t), y(p.ear)));
    ctx.stroke();
  } else {
    ctx.fillStyle = '#5b6b7b'; ctx.font = '20px system-ui'; ctx.fillText('Señal del ojo (EAR) en tiempo real', 12, H / 2);
  }
}

// ---------- Indicadores ----------
function setChip(id, text, cls) { const c = $(id); if (c.textContent !== text) c.textContent = text; c.className = 'chip ' + cls; }
function updateUI(now) {
  if (cfg.sim) setChip('chipCam', 'Modo simulado (barra espaciadora)', 'warn');
  else if (!cam.running) setChip('chipCam', 'Cámara apagada', '');
  else if (!cam.face) setChip('chipCam', 'No se detecta el rostro', 'bad');
  else setChip('chipCam', 'Rostro detectado', 'ok');
  if (cfg.sim) setChip('chipCal', 'Sin calibración (simulado)', '');
  else setChip('chipCal', S.calibrated ? 'Calibrado' : (calib.running ? 'Calibrando…' : 'Sin calibrar'), S.calibrated ? 'ok' : '');
  setChip('chipScan', scan.active ? 'Barrido activo' : 'Barrido detenido', scan.active ? 'ok' : '');
  $('btnScan').textContent = scan.active ? 'Pausar barrido' : 'Iniciar barrido';
  const sn = $('stateName');
  if (sn.textContent !== det.state) sn.textContent = det.state;
  sn.style.color = det.state === 'VOLUNTARIO' ? 'var(--ok)' : det.state === 'CERRADO' ? 'var(--accent)' : det.state === 'REPOSO' ? 'var(--text)' : 'var(--muted)';
  const f = det.state === 'CERRADO' ? Math.min(1, (now - det.closedAt) / cfg.hold) : det.state === 'VOLUNTARIO' ? 1 : 0;
  $('holdFill').style.width = (f * 100) + '%';
  $('holdFill').style.background = det.state === 'VOLUNTARIO' ? 'var(--ok)' : 'var(--accent)';
  $('earVal').textContent = cam.running && cam.face && cam.ear !== null ? 'EAR ' + cam.ear.toFixed(2) : 'EAR –';
  $('stSpont').textContent = stats.spont; $('stVol').textContent = stats.vol;
  $('stSpontMs').textContent = stats.spont ? Math.round(stats.spontMs / stats.spont) : '–';
  const s = Math.floor((now - stats.t0) / 1000);
  $('stTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  renderScan();
}

// ---------- Bucle principal ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(100, now - last); last = now;
  if (cam.running) processVideo(now);
  let closed = null;
  if (cfg.sim) closed = spaceDown;
  else if (cam.running && cam.face && S.calibrated && cam.ear !== null) {
    closed = det.eyeClosed ? cam.ear < S.thrOpen : cam.ear < S.thr;
    det.eyeClosed = closed;
  }
  if (closed === null) det.state = 'SIN SEÑAL'; else onEye(closed, now);
  scanTick(dt, closed !== null);
  calibTick(now);
  testTick(now);
  drawChart(now);
  updateUI(now);
  requestAnimationFrame(frame);
}

// ---------- Eventos de la interfaz ----------
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.id === b.dataset.tab));
}));
$('btnCam').addEventListener('click', startCamera);
$('btnCal').addEventListener('click', calibrate);
$('btnScan').addEventListener('click', () => { if (scan.active) scanStop(); else if (hasSignal()) scanStart(); });
$('btnRest').addEventListener('click', startRest);
$('btnCue').addEventListener('click', startCue);
$('btnWrite').addEventListener('click', startWrite);
$('btnCancel').addEventListener('click', cancelTest);
$('btnCsv').addEventListener('click', () => downloadCsv('mira_resultados.csv', COLS, results));
$('btnCsvEv').addEventListener('click', () => downloadCsv('mira_eventos.csv', ['hora', 'participante', 'entrada', 'tipo', 'detalle', 'dur_ms'], events));
$('btnClear').addEventListener('click', () => {
  if (!confirm('¿Borrar todos los resultados guardados en este navegador? Exporte el CSV antes si los necesita.')) return;
  results = []; try { localStorage.removeItem('mira_results'); } catch (e) { /* nada */ } renderResults();
});
$('target').addEventListener('change', () => { $('targetCustom').style.display = $('target').value === '__custom' ? 'block' : 'none'; });
const bindRange = (id, key) => { const el = $(id), out = $(id + 'V'); const f = () => { cfg[key] = +el.value; out.textContent = el.value; }; el.addEventListener('input', f); f(); };
bindRange('hold', 'hold'); bindRange('interval', 'interval');
$('calOpen').addEventListener('change', () => { cfg.calOpen = +$('calOpen').value; });
// ---------- Frases rápidas editables ----------
function applyPhrases() {
  PHRASES.forEach((p, i) => { ROWS[0][i].t = p; cellEls[0][i].textContent = p; });
  const ps = $('phraseSel'), keep = ps.selectedIndex;
  ps.innerHTML = '<option value="">Seleccione una frase…</option>' + PHRASES.map((p, i) => `<option value="${i}">${esc(p)}</option>`).join('');
  ps.selectedIndex = Math.max(0, keep);
  const tg = $('target'), prev = tg.value;
  tg.innerHTML = [...PHRASES, 'AGUA', 'FRIO', 'HOLA MAMA'].map(p => `<option>${esc(p)}</option>`).join('') + '<option value="__custom">Otro (escribir abajo)…</option>';
  if ([...tg.options].some(o => o.value === prev)) tg.value = prev;
  $('targetCustom').style.display = tg.value === '__custom' ? 'block' : 'none';
}
function savePhrases() { try { localStorage.setItem('mira_phrases', JSON.stringify(PHRASES)); } catch (e) { /* sin almacenamiento */ } }
function phraseNote(text, bad) { const n = $('phraseInfo'); n.textContent = text; n.style.color = bad ? 'var(--bad)' : 'var(--ok)'; }
$('phraseSel').addEventListener('change', () => {
  const i = $('phraseSel').value;
  $('phraseNew').value = '';
  $('phraseNew').placeholder = i === '' ? 'Nuevo mensaje' : `¿Por cuál mensaje desea cambiar «${PHRASES[+i]}»?`;
  phraseNote('', false);
  if (i !== '') setTimeout(() => $('phraseNew').focus(), 0);
});
function changePhrase() {
  const i = $('phraseSel').value, txt = $('phraseNew').value.replace(/\s+/g, ' ').trim();
  if (test) return phraseNote('Termine o cancele la prueba antes de cambiar las frases.', true);
  if (i === '') return phraseNote('Primero seleccione en la lista la frase que desea cambiar.', true);
  if (!txt) return phraseNote('Escriba el nuevo mensaje.', true);
  if (PHRASES.some((p, k) => k !== +i && norm(p) === norm(txt))) return phraseNote('Ese mensaje ya está en las frases rápidas.', true);
  const old = PHRASES[+i];
  PHRASES[+i] = txt; savePhrases(); applyPhrases();
  $('phraseNew').value = ''; $('phraseNew').placeholder = `¿Por cuál mensaje desea cambiar «${txt}»?`;
  phraseNote(`«${old}» se cambió por «${txt}».`, false);
  logEvent('frase_cambiada', `${old} -> ${txt}`);
}
$('btnPhrase').addEventListener('click', changePhrase);
$('phraseNew').addEventListener('keydown', e => { if (e.key === 'Enter') changePhrase(); });
$('btnPhraseReset').addEventListener('click', () => {
  if (test) return phraseNote('Termine o cancele la prueba antes de cambiar las frases.', true);
  PHRASES = [...DEFAULT_PHRASES]; savePhrases(); applyPhrases();
  $('phraseSel').selectedIndex = 0; $('phraseNew').value = ''; $('phraseNew').placeholder = 'Nuevo mensaje';
  phraseNote('Se restauraron las frases originales.', false);
});
$('layout').addEventListener('change', () => {
  if (test) { $('layout').value = cfg.layout; setBanner('Termine o cancele la prueba antes de cambiar el teclado.', 'err'); return; }
  cfg.layout = $('layout').value;
  LAYOUTS[cfg.layout].forEach((r, i) => [...r].forEach((ch, j) => { ROWS[2 + i][j].t = ch; cellEls[2 + i][j].textContent = ch; }));
  if (scan.active) scanStart();
  logEvent('teclado', cfg.layout);
});
$('sound').addEventListener('change', () => { cfg.sound = $('sound').checked; });
$('sim').addEventListener('change', () => {
  cfg.sim = $('sim').checked; spaceDown = false; det.state = 'SIN SEÑAL';
  $('btnScan').disabled = !hasSignal();
  if (cfg.sim) { scanStart(); setBanner('Modo simulado: mantenga pulsada la barra espaciadora para «cerrar los ojos».'); }
  else { if (!hasSignal()) scanStop(); setBanner(''); }
  $('sim').blur();
  $('btnSim').textContent = cfg.sim ? 'Salir del modo simulado' : 'Probar sin cámara (barra espaciadora)';
});
$('btnSim').addEventListener('click', () => { $('sim').click(); $('btnSim').blur(); });
// Tras elegir en una lista, se suelta el foco para que la barra espaciadora vuelva a actuar como párpado.
document.querySelectorAll('select').forEach(s => s.addEventListener('change', () => s.blur()));
const typing = e => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'checkbox' && e.target.type !== 'range';
window.addEventListener('keydown', e => { if (cfg.sim && e.code === 'Space' && !typing(e)) { e.preventDefault(); spaceDown = true; } });
window.addEventListener('keyup', e => { if (cfg.sim && e.code === 'Space' && !typing(e)) { e.preventDefault(); spaceDown = false; } });
window.addEventListener('blur', () => { spaceDown = false; });
// Prepara el audio en el primer gesto para que el primer tono no cause una pausa.
window.addEventListener('pointerdown', () => {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { /* sin audio */ }
}, { once: true });

buildGrid(); applyPhrases(); renderMsg(); renderResults(); renderHistory();
requestAnimationFrame(frame);
