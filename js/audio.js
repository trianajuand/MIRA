// MIRA · Tonos de confirmación y síntesis de voz.
'use strict';

// ---------- Sonido y voz ----------
let actx = null;
function beep(freq = 880, ms = 140) {
  if (!cfg.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(0.18, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + ms / 1000);
    o.start(); o.stop(actx.currentTime + ms / 1000);
  } catch (e) { /* sin audio */ }
}
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const vs = speechSynthesis.getVoices();
  const v = vs.find(v => /^es[-_](CO|MX|US|419)/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang));
  if (v) u.voice = v;
  u.lang = v ? v.lang : 'es-ES';
  u.rate = 0.95;
  speechSynthesis.speak(u);
}
if ('speechSynthesis' in window) speechSynthesis.getVoices();
