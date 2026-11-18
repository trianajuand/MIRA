// MIRA · Pruebas de validación: reposo, cierres pautados y mensaje cotidiano.
'use strict';

// ---------- Pruebas de validación ----------
const hasSignal = () => cfg.sim || (cam.running && S.calibrated);
function needSignal() {
  if (hasSignal()) return true;
  setBanner('Para esta prueba primero active la cámara y calibre (o active el modo simulado en Ajustes).', 'err');
  return false;
}
function testBegin(t) {
  test = t; test.wasScanning = scan.active;
  $('btnCancel').disabled = false;
  ['btnRest', 'btnCue'].forEach(id => $(id).disabled = true);
  if (t.type !== 'tablero') $('btnWrite').disabled = true;
  logEvent('prueba_inicio', t.type);
}
function testEnd(msgText, cls = 'good') {
  const t = test; test = null;
  $('btnCancel').disabled = true;
  ['btnRest', 'btnCue', 'btnWrite'].forEach(id => $(id).disabled = false);
  $('btnWrite').textContent = 'Iniciar';
  if (t && t.type !== 'escritura' && t.wasScanning) scanStart();
  setBanner(msgText, cls);
  logEvent('prueba_fin', t ? t.type : '');
}
function startRest() {
  if (test || calib.running || !needSignal()) return;
  const min = +$('restMin').value;
  scanStop();
  testBegin({ type: 'reposo', fp: 0, spont: 0, t0: performance.now(), ms: min * 60000 });
}
function startCue() {
  if (test || calib.running || !needSignal()) return;
  scanStop();
  testBegin({ type: 'pautados', n: +$('cueN').value, i: 0, hits: 0, fp: 0, spont: 0, phase: 'wait', nextAt: performance.now() + 3000, cueOpen: false, cueEnd: 0, t0: performance.now() });
}
function startWrite() {
  if (test && test.type === 'tablero') { finishWrite(test.target, null); return; }
  if (test || calib.running) return;
  let target = $('target').value;
  if (target === '__custom') target = $('targetCustom').value.trim();
  if (!target) { setBanner('Escriba el mensaje objetivo.', 'err'); return; }
  if ($('method').value === 'tablero') {
    testBegin({ type: 'tablero', target, t0: performance.now() });
    $('btnWrite').textContent = 'Terminar';
    return;
  }
  if (!needSignal()) return;
  msg = ''; renderMsg();
  testBegin({ type: 'escritura', target, t0: performance.now(), deletes: 0, selections: 0 });
  scanStart();
}
function writeHook(text, isPhrase) {
  if (!test || test.type !== 'escritura') return;
  if (isPhrase && norm(text) !== norm(test.target)) return; // otra frase rápida: la prueba sigue
  finishWrite(text, test);
}
function finishWrite(finalText, t) {
  const tt = test;
  const secs = (performance.now() - tt.t0) / 1000;
  const ppm = ((finalText.length / 5) / (secs / 60)).toFixed(2);
  const r = { prueba: tt.type === 'tablero' ? 'mensaje_tablero' : 'mensaje_mira', objetivo: tt.target, resultado: finalText, duracion_s: secs.toFixed(1), ppm };
  if (tt.type === 'tablero') r.entrada = 'manual';
  if (tt.clicked) r.entrada = 'clic'; // se usó el ratón: no cuenta como selección por parpadeo
  if (t) { r.distancia_edicion = lev(norm(finalText), norm(tt.target)); r.borrados = t.deletes; r.selecciones = t.selections; }
  addResult(r);
  testEnd(`Mensaje «${tt.target}» comunicado en ${r.duracion_s} s (${ppm} palabras por minuto).`);
}
function cancelTest() { if (test) testEnd('Prueba cancelada. No se guardó ningún resultado.', ''); }
function testTick(now) {
  if (!test) return;
  if (test.type === 'reposo') {
    const left = test.ms - (now - test.t0);
    if (left <= 0) {
      const min = test.ms / 60000;
      addResult({ prueba: 'reposo', duracion_s: Math.round(test.ms / 1000), falsos_positivos: test.fp, fp_por_min: (test.fp / min).toFixed(2), espontaneos: test.spont });
      const t = test; beep(660, 300);
      testEnd(`Reposo terminado: ${t.fp} falsos positivos en ${min} min, ${t.spont} parpadeos espontáneos descartados.`);
    } else {
      const s = Math.ceil(left / 1000);
      setBanner(`Prueba de reposo · Mire la pantalla con normalidad, sin intentar seleccionar. Quedan ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · Falsos positivos: ${test.fp}`);
    }
  } else if (test.type === 'pautados') {
    if (test.phase === 'wait') {
      setBanner(`Cierres pautados · Mire la pantalla con normalidad y espere el tono (${test.i}/${test.n})`);
      if (now >= test.nextAt) { test.i++; test.phase = 'cue'; test.cueOpen = true; test.cueEnd = now + 3000; beep(330, 300); }
    } else {
      setBanner(`CIERRE LOS OJOS hasta oír el tono agudo (${test.i}/${test.n})`, 'cue');
      if (now >= test.cueEnd && det.state !== 'CERRADO') {
        test.cueOpen = false;
        if (test.i >= test.n) {
          const t = test;
          addResult({ prueba: 'pautados', duracion_s: Math.round((now - t.t0) / 1000), aciertos: t.hits, intentos: t.n, falsos_positivos: t.fp, espontaneos: t.spont });
          beep(660, 300);
          testEnd(`Cierres pautados: ${t.hits} de ${t.n} detectados (${Math.round(100 * t.hits / t.n)} %), ${t.fp} falsos positivos.`);
        } else { test.phase = 'wait'; test.nextAt = now + 3000 + Math.random() * 2000; }
      }
    }
  } else if (test.type === 'escritura') {
    setBanner(`Escriba o diga: «${test.target}» · ${((now - test.t0) / 1000).toFixed(0)} s`);
  } else if (test.type === 'tablero') {
    setBanner(`Tablero de cartón · Comuniquen «${test.target}» y pulse «Terminar» al lograrlo · ${((now - test.t0) / 1000).toFixed(0)} s`);
  }
}
