// MIRA · Detección del parpadeo voluntario: máquina de estados, cámara, EAR y calibración.
'use strict';

// ---------- Detector: máquina de estados por duración del cierre ----------
// REPOSO -> CERRADO (el EAR baja del umbral) -> VOLUNTARIO (el cierre supera el tiempo mínimo) -> REPOSO (al abrir).
// Si el ojo se abre antes del tiempo mínimo, el cierre se descarta como espontáneo.
function onEye(closed, now) {
  if (det.state === 'SIN SEÑAL') det.state = 'REPOSO';
  if (closed && det.state === 'REPOSO') { det.state = 'CERRADO'; det.closedAt = now; }
  else if (closed && det.state === 'CERRADO' && now - det.closedAt >= cfg.hold) { det.state = 'VOLUNTARIO'; onVoluntary(now); }
  else if (!closed && det.state !== 'REPOSO') {
    const d = Math.round(now - det.closedAt);
    if (det.state === 'CERRADO') {
      stats.spont++; stats.spontMs += d;
      if (test && test.spont !== undefined) test.spont++;
      logEvent('cierre_espontaneo', '', d);
    } else logEvent('cierre_voluntario', '', d);
    det.state = 'REPOSO';
  }
}
function onVoluntary(now) {
  stats.vol++;
  beep(880, 160);
  if (test && test.type === 'reposo') { test.fp++; return; }
  if (test && test.type === 'pautados') {
    if (test.cueOpen) { test.hits++; test.cueOpen = false; } else test.fp++;
    return;
  }
  if (scan.active) scanSelect();
}

// ---------- Cámara y EAR ----------
const R_EYE = [33, 160, 158, 133, 153, 144];
const L_EYE = [362, 385, 387, 263, 373, 380];
function eyeEAR(lm, idx, w, h) {
  const p = idx.map(i => [lm[i].x * w, lm[i].y * h]);
  const d = (a, b) => Math.hypot(p[a][0] - p[b][0], p[a][1] - p[b][1]);
  return (d(1, 5) + d(2, 4)) / (2 * d(0, 3));
}
async function startCamera() {
  if (cam.running || cam.loading) return;
  cam.loading = true; $('btnCam').disabled = true;
  try {
    setBanner('Cargando el modelo de detección facial…');
    const vision = await import(`${MP_BASE}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
    const mk = delegate => vision.FaceLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL_URL, delegate }, runningMode: 'VIDEO', numFaces: 1 });
    try { cam.landmarker = await mk('GPU'); } catch (e) { cam.landmarker = await mk('CPU'); }
    setBanner('Solicitando permiso de cámara…');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
    const v = $('video'); v.srcObject = stream; await v.play();
    $('camoff').style.display = 'none';
    cam.running = true;
    $('btnCal').disabled = false; $('btnCal').classList.add('primary'); $('btnCam').classList.remove('primary');
    $('btnCam').textContent = 'Cámara activa';
    setBanner('Cámara lista. Ubique el rostro frente a la cámara, con luz de frente, y pulse «2. Calibrar».', 'good');
    logEvent('camara', 'activa');
  } catch (e) {
    $('btnCam').disabled = false;
    const n = e && e.name;
    const why = n === 'NotReadableError' ? 'La cámara está siendo usada por otro programa. Cierre Zoom, Teams, Meet, la app Cámara u otras pestañas que la usen y pulse de nuevo «1. Activar cámara».'
      : n === 'NotAllowedError' ? 'El permiso de cámara fue denegado. Pulse el icono a la izquierda de la dirección (localhost:8765), permita la cámara y recargue la página.'
      : n === 'NotFoundError' ? 'Este computador no tiene una cámara disponible.'
      : 'No se pudo iniciar la cámara o el modelo: ' + (e && e.message ? e.message : e) + '. Revise la conexión (el modelo se descarga la primera vez).';
    setBanner(why, 'err');
  }
  cam.loading = false;
}
function processVideo(now) {
  const v = $('video');
  if (v.readyState < 2 || v.currentTime === cam.lastTime) return;
  cam.lastTime = v.currentTime;
  let lm = null;
  try { const r = cam.landmarker.detectForVideo(v, now); lm = r.faceLandmarks && r.faceLandmarks[0]; } catch (e) { lm = null; }
  if (calib.resolve) calib.frames++;
  if (lm) {
    const raw = (eyeEAR(lm, R_EYE, v.videoWidth, v.videoHeight) + eyeEAR(lm, L_EYE, v.videoWidth, v.videoHeight)) / 2;
    cam.recent.push(raw); if (cam.recent.length > 3) cam.recent.shift();
    cam.ear = cam.recent.reduce((a, b) => a + b, 0) / cam.recent.length;
    cam.face = true; cam.lastFace = now;
    if (calib.resolve) calib.buf.push(cam.ear);
    chartBuf.push({ t: now, ear: cam.ear });
  } else if (now - cam.lastFace > 400) { cam.face = false; cam.recent = []; }
}

// ---------- Calibración individual ----------
function collect(ms, label) {
  return new Promise(res => { calib.buf = []; calib.frames = 0; calib.label = label; calib.until = performance.now() + ms; calib.resolve = res; });
}
async function calibrate() {
  if (!cam.running || calib.running || test) return;
  calib.running = true; calib.attempts++;
  S.calibrated = false; scanStop();
  $('btnCal').disabled = true;
  const t0 = performance.now();
  speak('Mire la pantalla con los ojos abiertos, con normalidad.');
  const open = await collect(cfg.calOpen * 1000, 'Paso 1 de 2 · Mire la pantalla con los ojos abiertos, con normalidad');
  beep(440, 250);
  speak('Ahora cierre los ojos y manténgalos cerrados hasta oír el tono.');
  calib.label = 'Paso 2 de 2 · Cierre los ojos y manténgalos cerrados hasta oír el tono'; calib.until = performance.now() + 6500;
  await sleep(3500);
  const closed = await collect(3000, 'Paso 2 de 2 · Cierre los ojos y manténgalos cerrados hasta oír el tono');
  beep(880, 150); setTimeout(() => beep(1175, 220), 180);
  calib.label = '';
  const dur = ((performance.now() - t0) / 1000).toFixed(1);
  const o = median(open.buf), c = pct(closed.buf, 0.3);
  let err = '';
  if (open.buf.length < open.frames * 0.6 || closed.buf.length < 10) err = 'No se detectó el rostro de forma estable. Acerque la cámara, mejore la luz de frente y repita la calibración.';
  else if (!(o - c >= 0.05)) err = 'No se notó diferencia suficiente entre ojos abiertos y cerrados. Repita la calibración cerrando los ojos al oír el tono grave.';
  if (err) {
    setBanner(err, 'err'); speak('No se pudo calibrar. Intente de nuevo.');
    addResult({ prueba: 'calibracion', resultado: 'fallida', duracion_s: dur, intentos: calib.attempts });
  } else {
    S.open = o; S.closed = c; S.thr = c + 0.4 * (o - c); S.thrOpen = c + 0.55 * (o - c); S.calibrated = true;
    det.eyeClosed = false;
    $('calInfo').textContent = `Calibración: EAR abierto ${o.toFixed(3)}, cerrado ${c.toFixed(3)}, umbral ${S.thr.toFixed(3)}.`;
    setBanner('Calibración lista. Para elegir, mantenga los ojos cerrados hasta oír el tono.', 'good');
    speak('Calibración lista.');
    addResult({ prueba: 'calibracion', resultado: 'ok', duracion_s: dur, intentos: calib.attempts });
    $('btnScan').disabled = false;
    scanStart();
    setTimeout(() => { if (!test && !calib.running) setBanner(''); }, 6000);
  }
  logEvent('calibracion', err ? 'fallida' : `ok abierto=${o.toFixed(3)} cerrado=${c.toFixed(3)}`);
  $('btnCal').disabled = false;
  calib.running = false;
}
function calibTick(now) {
  if (!calib.running || !calib.label) return;
  const left = Math.max(0, Math.ceil((calib.until - now) / 1000));
  setBanner(`${calib.label} (${left} s)`);
  if (calib.resolve && now >= calib.until) { const r = calib.resolve; calib.resolve = null; r({ buf: calib.buf, frames: calib.frames }); }
}
