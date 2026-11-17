// MIRA · Configuración, distribución del teclado y estado compartido de la aplicación.
'use strict';

const MP_VERSION = '0.10.14';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// ---------- Configuración ----------
const cfg = { hold: 500, interval: 1000, calOpen: 15, sound: true, sim: false, layout: 'frecuencia' };

// ---------- Teclado: frases rápidas, acciones y letras por frecuencia en español ----------
const DEFAULT_PHRASES = ['Sí', 'No', 'Necesito ayuda', 'Tengo dolor', 'Tengo sed', 'Necesito ir al baño'];
let PHRASES = [...DEFAULT_PHRASES];
try {
  const saved = JSON.parse(localStorage.getItem('mira_phrases') || 'null');
  if (Array.isArray(saved) && saved.length === DEFAULT_PHRASES.length && saved.every(s => typeof s === 'string' && s.trim())) PHRASES = saved.map(s => s.trim().slice(0, 40));
} catch (e) { /* se usan las frases originales */ }
const LAYOUTS = {
  frecuencia: ['EAOSRN', 'IDLCTU', 'MPBGVY', 'QHFZJÑ', 'XKW.,?'],
  alfabetico: ['ABCDEF', 'GHIJKL', 'MNÑOPQ', 'RSTUVW', 'XYZ.,?'],
};
const LETTERS = LAYOUTS.frecuencia;
const ROWS = [
  PHRASES.map(t => ({ t, kind: 'phrase' })),
  [{ t: 'Espacio', kind: 'space' }, { t: 'Borrar', kind: 'back' }, { t: 'Hablar', kind: 'speak' }, { t: 'Limpiar', kind: 'clear' }],
  ...LETTERS.map(r => [...r].map(t => ({ t, kind: 'char' }))),
];

// ---------- Estado ----------
const S = { calibrated: false, open: null, closed: null, thr: null, thrOpen: null };
const cam = { running: false, loading: false, landmarker: null, lastTime: -1, ear: null, face: false, lastFace: 0, recent: [] };
const det = { state: 'SIN SEÑAL', closedAt: 0, eyeClosed: false };
const scan = { active: false, level: 'row', row: 0, col: 0, elapsed: 0, passes: 0 };
const calib = { running: false, resolve: null, buf: [], frames: 0, until: 0, label: '', attempts: 0 };
const stats = { spont: 0, vol: 0, spontMs: 0, t0: performance.now() };
let msg = '';
let test = null;
let spaceDown = false;
let events = [];
let results = [];
const dichos = [];
const chartBuf = [];

try { results = JSON.parse(localStorage.getItem('mira_results') || '[]'); } catch (e) { results = []; }
