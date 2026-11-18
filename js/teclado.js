// MIRA · Teclado en pantalla, acciones de cada casilla y barrido fila-columna.
'use strict';

// ---------- Interfaz: teclado ----------
const cellEls = [];
function buildGrid() {
  const g = $('grid');
  ROWS.forEach((row, ri) => {
    const r = document.createElement('div'); r.className = 'row';
    cellEls.push([]);
    row.forEach((c, ci) => {
      const el = document.createElement('div');
      el.className = 'cell' + (c.kind === 'phrase' ? ' phrase small' : c.kind !== 'char' ? ' act small' : '');
      el.textContent = c.t;
      el.addEventListener('click', () => { activate(ri, ci, 'clic'); });
      r.appendChild(el); cellEls[ri].push(el);
    });
    g.appendChild(r);
  });
}
let lastScanKey = '';
function renderScan() {
  const key = scan.active ? `${scan.level}:${scan.row}:${scan.col}` : 'off';
  if (key === lastScanKey) return;
  lastScanKey = key;
  [...$('grid').children].forEach((r, ri) => {
    r.classList.toggle('active', scan.active && scan.level === 'row' && ri === scan.row);
    r.classList.toggle('chosen', scan.active && scan.level === 'col' && ri === scan.row);
    cellEls[ri].forEach((c, ci) => c.classList.toggle('active', scan.active && scan.level === 'col' && ri === scan.row && ci === scan.col));
  });
}
function renderMsg() {
  $('message').innerHTML = msg ? esc(msg).replace(/ /g, '&nbsp;') + '<span class="caret"></span>' : '<span class="ph">El mensaje aparece aquí…</span>';
}
function renderHistory() {
  $('history').innerHTML = dichos.length ? 'Últimos mensajes dichos: ' + dichos.slice(-3).reverse().map(h => `<b>«${esc(h)}»</b>`).join(' · ') : '';
}
function setBanner(text, cls = '') {
  const b = $('banner');
  if (!text) { b.className = ''; b.textContent = ''; return; }
  if (b.textContent !== text) b.textContent = text;
  b.className = 'show ' + cls;
}

// ---------- Acciones del teclado ----------
function activate(ri, ci, via) {
  const c = ROWS[ri][ci];
  const el = cellEls[ri][ci];
  el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 350);
  logEvent('seleccion', `${c.t} (${via})`);
  if (test && test.type === 'escritura') { test.selections++; if (via === 'clic') test.clicked = true; }
  if (c.kind === 'char') msg += c.t;
  else if (c.kind === 'space') { if (msg && !msg.endsWith(' ')) msg += ' '; }
  else if (c.kind === 'back') { msg = msg.slice(0, -1); if (test && test.type === 'escritura') test.deletes++; }
  else if (c.kind === 'clear') msg = '';
  else if (c.kind === 'phrase') { say(c.t); writeHook(c.t, true); }
  else if (c.kind === 'speak') { const m = msg.trim(); if (m) { say(m); msg = ''; writeHook(m, false); } }
  renderMsg();
}
function say(text) { speak(text); dichos.push(text); renderHistory(); logEvent('voz', text); }

// ---------- Barrido fila–columna ----------
function scanStart() { scan.active = true; scan.level = 'row'; scan.row = 0; scan.col = 0; scan.elapsed = 0; scan.passes = 0; }
function scanStop() { scan.active = false; }
function scanTick(dt, signal) {
  if (!scan.active || !signal || det.state !== 'REPOSO') return;
  scan.elapsed += dt;
  if (scan.elapsed < cfg.interval) return;
  scan.elapsed = 0;
  if (scan.level === 'row') scan.row = (scan.row + 1) % ROWS.length;
  else {
    scan.col++;
    if (scan.col >= ROWS[scan.row].length) {
      scan.col = 0; scan.passes++;
      if (scan.passes >= 2) { scan.level = 'row'; scan.row = 0; scan.passes = 0; }
    }
  }
}
function scanSelect() {
  if (scan.level === 'row') { scan.level = 'col'; scan.col = 0; scan.passes = 0; }
  else { activate(scan.row, scan.col, 'parpadeo'); scan.level = 'row'; scan.row = 0; }
  scan.elapsed = 0;
}
