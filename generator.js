'use strict';

const CUSTOM_LEVELS_KEY = 'grid_escape_custom_levels';
const CURRENT_LEVEL_KEY = 'current_level_to_play';

const BIOMES = {
  bosque: {
    label: 'Bosque',
    wall: '🌲',
    hero: '🤠',
    villain: '🐅',
    villainName: 'Tigre',
    biomeClass: 'biome-jungle',
    badgeBg: '#28573a',
    badgeText: '#dbffe5',
  },
  desierto: {
    label: 'Desierto',
    wall: '🌵',
    hero: '🐪',
    villain: '🧟',
    villainName: 'Momia',
    biomeClass: 'biome-desert',
    badgeBg: '#915f18',
    badgeText: '#fff1cf',
  },
  nieve: {
    label: 'Nieve',
    wall: '🧊',
    hero: '🐧',
    villain: '👹',
    villainName: 'Yeti',
    biomeClass: 'biome-snow',
    badgeBg: '#2f6d95',
    badgeText: '#e9f8ff',
  },
  espacio: {
    label: 'Espacio',
    wall: '☄️',
    hero: '🚀',
    villain: '👽',
    villainName: 'Alien',
    biomeClass: 'biome-space',
    badgeBg: '#2d3f92',
    badgeText: '#e7ebff',
  },
};

const DIFFICULTIES = {
  easy: { label: 'Easy', wallRatio: 0.1, minDistance: 7, maxDistance: Infinity, boosterCount: 3 },
  normal: { label: 'Normal', wallRatio: 0.2, minDistance: 4, maxDistance: 6, boosterCount: 2 },
  hard: { label: 'Hard', wallRatio: 0.3, minDistance: 1, maxDistance: 3, boosterCount: 1 },
  nightmare: { label: 'Nightmare', wallRatio: 0.35, minDistance: 1, maxDistance: 2, boosterCount: 0 },
};

const BOOSTER_TYPES = ['sprint', 'freeze', 'shield'];

const dom = {
  name: document.getElementById('level-name'),
  biome: document.getElementById('biome-select'),
  difficulty: document.getElementById('difficulty-select'),
  size: document.getElementById('grid-size'),
  btnGenerate: document.getElementById('btn-generate'),
  btnSave: document.getElementById('btn-save'),
  btnClear: document.getElementById('btn-clear'),
  previewGrid: document.getElementById('preview-grid'),
  previewWrap: document.getElementById('preview-grid-wrap'),
  toolButtons: Array.from(document.querySelectorAll('.tool-btn[data-tool]')),
  vaultGrid: document.getElementById('vault-grid'),
  validation: document.getElementById('validation-message'),
  biomeBadge: document.getElementById('biome-badge'),
  diffBadge: document.getElementById('difficulty-badge'),
};

const state = {
  gridSize: Number(dom.size.value),
  walls: new Set(),
  heroPos: null,
  villainPos: null,
  exitPos: null,
  boosters: [],
  cellSizePx: 30,
  activeTool: 'wall',
};

function keyOf(pos) {
  return `${pos.r},${pos.c}`;
}

function parseKey(key) {
  const [r, c] = key.split(',').map(Number);
  return { r, c };
}

function manhattan(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

function inBounds(r, c, n) {
  return r >= 0 && r < n && c >= 0 && c < n;
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function randomCell(n) {
  return { r: randomInt(n), c: randomInt(n) };
}

function updatePreviewCellSize() {
  const n = state.gridSize || 10;
  const wrapWidth = dom.previewWrap ? dom.previewWrap.clientWidth : 0;
  const wrapHeight = dom.previewWrap ? dom.previewWrap.clientHeight : 0;
  const safeWidth = Math.max(160, wrapWidth - 16);
  const safeHeight = Math.max(160, wrapHeight - 16);
  const gap = 4;
  const rawCellByWidth = Math.floor((safeWidth - (n - 1) * gap) / n);
  const rawCellByHeight = Math.floor((safeHeight - (n - 1) * gap) / n);
  const rawCell = Math.min(rawCellByWidth, rawCellByHeight);
  state.cellSizePx = Math.max(10, Math.min(34, rawCell));
  dom.previewGrid.style.setProperty('--cell-size', `${state.cellSizePx}px`);
}

function readLevelsFromStorage() {
  try {
    const raw = localStorage.getItem(CUSTOM_LEVELS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLevelsToStorage(levels) {
  localStorage.setItem(CUSTOM_LEVELS_KEY, JSON.stringify(levels));
}

function setFeedback(message, isError = true) {
  dom.validation.style.color = isError ? '#ffd4d4' : '#c8ffd2';
  dom.validation.textContent = message;
}

function getEmptyCells(n) {
  const occupied = new Set(state.walls);
  if (state.heroPos) occupied.add(keyOf(state.heroPos));
  if (state.villainPos) occupied.add(keyOf(state.villainPos));
  if (state.exitPos) occupied.add(keyOf(state.exitPos));
  for (const b of state.boosters) occupied.add(keyOf(b));

  const empties = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const k = `${r},${c}`;
      if (!occupied.has(k)) empties.push({ r, c });
    }
  }
  return empties;
}

function bfsReachable(start, end, wallSet, n) {
  const q = [start];
  const visited = Array.from({ length: n }, () => Array(n).fill(false));
  visited[start.r][start.c] = true;
  const dirs = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];

  while (q.length > 0) {
    const cur = q.shift();
    if (cur.r === end.r && cur.c === end.c) return true;

    for (const d of dirs) {
      const nr = cur.r + d.dr;
      const nc = cur.c + d.dc;
      if (!inBounds(nr, nc, n)) continue;
      if (visited[nr][nc]) continue;
      if (wallSet.has(`${nr},${nc}`)) continue;
      visited[nr][nc] = true;
      q.push({ r: nr, c: nc });
    }
  }

  return false;
}

function heroHasExit(stateObj) {
  if (!stateObj.heroPos || !stateObj.exitPos) return false;
  return bfsReachable(stateObj.heroPos, stateObj.exitPos, stateObj.walls, stateObj.gridSize);
}

function villainCanReachHero(stateObj) {
  if (!stateObj.heroPos || !stateObj.villainPos) return false;
  return bfsReachable(stateObj.villainPos, stateObj.heroPos, stateObj.walls, stateObj.gridSize);
}

function heroNotTrapped(stateObj) {
  const p = stateObj.heroPos;
  if (!p) return false;
  const dirs = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];
  return dirs.some((d) => {
    const nr = p.r + d.dr;
    const nc = p.c + d.dc;
    return inBounds(nr, nc, stateObj.gridSize) && !stateObj.walls.has(`${nr},${nc}`);
  });
}

function validateCurrentLevel() {
  const n = state.gridSize;
  if (!state.heroPos || !state.villainPos || !state.exitPos) {
    return { valid: false, message: 'Falta héroe, villano o salida.' };
  }

  if (!heroNotTrapped(state)) {
    return { valid: false, message: 'Nivel no válido: el héroe está encerrado.' };
  }

  if (!heroHasExit(state)) {
    return { valid: false, message: 'Nivel no válido: no hay camino del héroe a la salida.' };
  }

  if (!villainCanReachHero(state)) {
    return { valid: false, message: 'Nivel no válido: el villano no puede alcanzar al héroe.' };
  }

  for (const key of state.walls) {
    const { r, c } = parseKey(key);
    if (!inBounds(r, c, n)) {
      return { valid: false, message: 'Hay muros fuera del tablero.' };
    }
  }

  return { valid: true, message: 'Nivel válido y jugable.' };
}

function pickPositionByDistance(origin, n, minD, maxD, forbidden) {
  for (let i = 0; i < 600; i++) {
    const p = randomCell(n);
    const k = keyOf(p);
    if (forbidden.has(k)) continue;
    const d = manhattan(origin, p);
    if (d >= minD && d <= maxD) return p;
  }
  return null;
}

function distributeWalls(n, wallTarget, forbiddenSet) {
  const walls = new Set();
  let guard = 0;
  while (walls.size < wallTarget && guard < n * n * 20) {
    const p = randomCell(n);
    const k = keyOf(p);
    if (forbiddenSet.has(k)) {
      guard++;
      continue;
    }
    walls.add(k);
    guard++;
  }
  return walls;
}

function createBoosters(n, count, occupied) {
  const boosters = [];
  let tries = 0;
  while (boosters.length < count && tries < 1000) {
    const p = randomCell(n);
    const k = keyOf(p);
    if (occupied.has(k)) {
      tries++;
      continue;
    }
    occupied.add(k);
    boosters.push({ r: p.r, c: p.c, type: BOOSTER_TYPES[boosters.length % BOOSTER_TYPES.length] });
    tries++;
  }
  return boosters;
}

function generateDraft() {
  const n = Number(dom.size.value);
  const diff = DIFFICULTIES[dom.difficulty.value];
  const maxDistance = Number.isFinite(diff.maxDistance) ? diff.maxDistance : n * 2;

  for (let attempt = 0; attempt < 300; attempt++) {
    const heroPos = randomCell(n);
    const occupied = new Set([keyOf(heroPos)]);

    const villainPos = pickPositionByDistance(heroPos, n, diff.minDistance, maxDistance, occupied);
    if (!villainPos) continue;
    occupied.add(keyOf(villainPos));

    const exitPos = pickPositionByDistance(heroPos, n, Math.max(2, diff.minDistance - 1), n * 2, occupied);
    if (!exitPos) continue;
    occupied.add(keyOf(exitPos));

    const wallTarget = Math.floor(n * n * diff.wallRatio);
    const walls = distributeWalls(n, wallTarget, occupied);

    const snapshot = {
      gridSize: n,
      walls,
      heroPos,
      villainPos,
      exitPos,
      boosters: [],
    };

    if (!heroNotTrapped(snapshot) || !heroHasExit(snapshot) || !villainCanReachHero(snapshot)) {
      continue;
    }

    const boosterOccupied = new Set([...occupied, ...walls]);
    const boosters = createBoosters(n, diff.boosterCount, boosterOccupied);

    state.gridSize = n;
    state.walls = walls;
    state.heroPos = heroPos;
    state.villainPos = villainPos;
    state.exitPos = exitPos;
    state.boosters = boosters;

    renderPreview();
    const val = validateCurrentLevel();
    setFeedback(`Borrador generado. ${val.message}`, !val.valid);
    return;
  }

  setFeedback('No se pudo generar un nivel válido con esta configuración. Prueba otro tamaño o dificultad.', true);
}

function cellEmoji(r, c) {
  const biome = BIOMES[dom.biome.value];
  if (state.heroPos && state.heroPos.r === r && state.heroPos.c === c) return biome.hero;
  if (state.villainPos && state.villainPos.r === r && state.villainPos.c === c) return biome.villain;
  if (state.exitPos && state.exitPos.r === r && state.exitPos.c === c) return '🏁';
  const booster = state.boosters.find((b) => b.r === r && b.c === c);
  if (booster) return booster.type === 'freeze' ? '❄️' : booster.type === 'shield' ? '🛡️' : '⚡';
  if (state.walls.has(`${r},${c}`)) return biome.wall;
  return '';
}

function renderPreview() {
  const n = state.gridSize;
  updatePreviewCellSize();
  dom.previewGrid.style.gridTemplateColumns = `repeat(${n}, var(--cell-size))`;
  dom.previewGrid.innerHTML = '';

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'preview-cell';
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      cell.textContent = cellEmoji(r, c);
      if ((r + c) % 2 === 1) {
        cell.style.filter = 'brightness(0.92)';
      }
      dom.previewGrid.appendChild(cell);
    }
  }
}

function removeBoosterAt(r, c) {
  state.boosters = state.boosters.filter((b) => !(b.r === r && b.c === c));
}

function eraseCellAt(r, c) {
  const key = `${r},${c}`;
  state.walls.delete(key);

  if (state.heroPos && state.heroPos.r === r && state.heroPos.c === c) {
    state.heroPos = null;
  }
  if (state.villainPos && state.villainPos.r === r && state.villainPos.c === c) {
    state.villainPos = null;
  }
  if (state.exitPos && state.exitPos.r === r && state.exitPos.c === c) {
    state.exitPos = null;
  }

  removeBoosterAt(r, c);
}

function placeBoosterAt(r, c, type) {
  // No colocar boosters encima de héroe/villano/salida
  const blocked =
    (state.heroPos && state.heroPos.r === r && state.heroPos.c === c) ||
    (state.villainPos && state.villainPos.r === r && state.villainPos.c === c) ||
    (state.exitPos && state.exitPos.r === r && state.exitPos.c === c);
  if (blocked) return;

  const key = `${r},${c}`;
  state.walls.delete(key);
  removeBoosterAt(r, c);
  state.boosters.push({ r, c, type });
}

function applyToolAt(r, c) {
  if (!inBounds(r, c, state.gridSize)) return;
  const tool = state.activeTool;

  if (tool === 'erase') {
    eraseCellAt(r, c);
  } else if (tool === 'wall') {
    eraseCellAt(r, c);
    state.walls.add(`${r},${c}`);
  } else if (tool === 'hero') {
    eraseCellAt(r, c);
    state.heroPos = { r, c };
  } else if (tool === 'villain') {
    eraseCellAt(r, c);
    state.villainPos = { r, c };
  } else if (tool === 'exit') {
    eraseCellAt(r, c);
    state.exitPos = { r, c };
  } else if (tool === 'booster-sprint') {
    placeBoosterAt(r, c, 'sprint');
  } else if (tool === 'booster-freeze') {
    placeBoosterAt(r, c, 'freeze');
  } else if (tool === 'booster-shield') {
    placeBoosterAt(r, c, 'shield');
  }

  renderPreview();
  const val = validateCurrentLevel();
  setFeedback(val.message, !val.valid);
}

function toggleWallAt(r, c) {
  if (!inBounds(r, c, state.gridSize)) return;

  const blockedBySpecial =
    (state.heroPos && state.heroPos.r === r && state.heroPos.c === c) ||
    (state.villainPos && state.villainPos.r === r && state.villainPos.c === c) ||
    (state.exitPos && state.exitPos.r === r && state.exitPos.c === c) ||
    state.boosters.some((b) => b.r === r && b.c === c);

  if (blockedBySpecial) return;

  const key = `${r},${c}`;
  if (state.walls.has(key)) {
    state.walls.delete(key);
  } else {
    state.walls.add(key);
  }

  renderPreview();
  const val = validateCurrentLevel();
  setFeedback(val.message, !val.valid);
}

function toWorkshopLevel() {
  const biome = BIOMES[dom.biome.value];
  const difficultyKey = dom.difficulty.value;

  return {
    id: `lvl_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    name: dom.name.value.trim() || `Nivel ${biome.label} ${new Date().toLocaleDateString('es-ES')}`,
    biome: dom.biome.value,
    difficulty: difficultyKey,
    gridSize: state.gridSize,
    walls: Array.from(state.walls).map(parseKey),
    heroPos: { ...state.heroPos },
    villainPos: { ...state.villainPos },
    exitPos: { ...state.exitPos },
    boosters: state.boosters.map((b) => ({ ...b })),
    biomeClass: biome.biomeClass,
    heroEmoji: biome.hero,
    villainEmoji: biome.villain,
    wallEmoji: biome.wall,
  };
}

function saveCurrentLevel() {
  const validation = validateCurrentLevel();
  if (!validation.valid) {
    setFeedback(`No se puede guardar. ${validation.message}`, true);
    return;
  }

  const level = toWorkshopLevel();
  const levels = readLevelsFromStorage();
  levels.push(level);
  saveLevelsToStorage(levels);
  renderVault();
  setFeedback('Nivel guardado en Workshop.', false);
}

function clearAll() {
  state.gridSize = Number(dom.size.value);
  state.walls = new Set();
  state.heroPos = null;
  state.villainPos = null;
  state.exitPos = null;
  state.boosters = [];
  renderPreview();
  setFeedback('Preview reiniciado. Genera un nuevo borrador.', false);
}

function renderVault() {
  const levels = readLevelsFromStorage();
  dom.vaultGrid.innerHTML = '';

  if (levels.length === 0) {
    const p = document.createElement('p');
    p.className = 'vault-empty';
    p.textContent = 'Aun no hay niveles guardados. Usa "Generar Borrador Aleatorio" y guarda tu primer mapa.';
    dom.vaultGrid.appendChild(p);
    return;
  }

  levels.forEach((lvl) => {
    const biome = BIOMES[lvl.biome] || BIOMES.bosque;
    const diff = DIFFICULTIES[lvl.difficulty] || DIFFICULTIES.normal;

    const card = document.createElement('div');
    card.className = 'vault-item';

    const title = document.createElement('h3');
    title.className = 'vault-title';
    title.textContent = lvl.name;

    const meta = document.createElement('div');
    meta.className = 'vault-meta';

    const biomeBadge = document.createElement('span');
    biomeBadge.className = 'badge';
    biomeBadge.textContent = biome.label;
    biomeBadge.style.background = biome.badgeBg;
    biomeBadge.style.color = biome.badgeText;

    const diffBadge = document.createElement('span');
    diffBadge.className = 'badge';
    diffBadge.textContent = diff.label;
    diffBadge.style.background = 'rgba(255,255,255,0.14)';

    const sizeBadge = document.createElement('span');
    sizeBadge.className = 'badge';
    sizeBadge.textContent = `${lvl.gridSize}x${lvl.gridSize}`;
    sizeBadge.style.background = 'rgba(0,0,0,0.28)';

    meta.appendChild(biomeBadge);
    meta.appendChild(diffBadge);
    meta.appendChild(sizeBadge);

    const actions = document.createElement('div');
    actions.className = 'vault-actions';

    const playBtn = document.createElement('button');
    playBtn.className = 'btn btn-primary';
    playBtn.type = 'button';
    playBtn.textContent = 'Jugar';
    playBtn.addEventListener('click', () => {
      localStorage.setItem(CURRENT_LEVEL_KEY, JSON.stringify(lvl));
      window.location.href = 'index.html';
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.type = 'button';
    delBtn.textContent = 'Eliminar';
    delBtn.addEventListener('click', () => {
      const next = readLevelsFromStorage().filter((item) => item.id !== lvl.id);
      saveLevelsToStorage(next);
      renderVault();
    });

    actions.appendChild(playBtn);
    actions.appendChild(delBtn);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(actions);
    dom.vaultGrid.appendChild(card);
  });
}

function updateBiomeLook() {
  document.body.className = `workshop-biome-${dom.biome.value}`;

  const biome = BIOMES[dom.biome.value];
  const diff = DIFFICULTIES[dom.difficulty.value];
  dom.biomeBadge.textContent = biome.label;
  dom.biomeBadge.style.background = biome.badgeBg;
  dom.biomeBadge.style.color = biome.badgeText;

  dom.diffBadge.textContent = diff.label;
  dom.diffBadge.style.background = 'rgba(255,255,255,0.15)';
  dom.diffBadge.style.color = '#f4fff6';

  renderPreview();
}

function initGridForSize() {
  state.gridSize = Number(dom.size.value);
  const empties = getEmptyCells(state.gridSize);
  if (empties.length === 0) {
    clearAll();
    return;
  }

  // Si cambio de tamaño y alguna coordenada queda fuera, limpiar draft.
  const anyOutside =
    (state.heroPos && !inBounds(state.heroPos.r, state.heroPos.c, state.gridSize)) ||
    (state.villainPos && !inBounds(state.villainPos.r, state.villainPos.c, state.gridSize)) ||
    (state.exitPos && !inBounds(state.exitPos.r, state.exitPos.c, state.gridSize)) ||
    Array.from(state.walls).some((k) => {
      const p = parseKey(k);
      return !inBounds(p.r, p.c, state.gridSize);
    });

  if (anyOutside) {
    clearAll();
  } else {
    renderPreview();
  }
}

function wireEvents() {
  dom.btnGenerate.addEventListener('click', generateDraft);
  dom.btnSave.addEventListener('click', saveCurrentLevel);
  dom.btnClear.addEventListener('click', clearAll);

  dom.previewGrid.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains('preview-cell')) return;
    const r = Number(target.dataset.r);
    const c = Number(target.dataset.c);
    applyToolAt(r, c);
  });

  dom.toolButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (!tool) return;
      state.activeTool = tool;
      dom.toolButtons.forEach((b) => b.classList.toggle('active', b === btn));
      setFeedback(`Herramienta activa: ${btn.textContent}`, false);
    });
  });

  dom.biome.addEventListener('change', updateBiomeLook);
  dom.difficulty.addEventListener('change', updateBiomeLook);
  dom.size.addEventListener('change', initGridForSize);
  window.addEventListener('resize', renderPreview);
}

function init() {
  wireEvents();
  updateBiomeLook();
  renderPreview();
  renderVault();
  setFeedback('Configura parámetros y genera un borrador para empezar.', false);
}

init();
