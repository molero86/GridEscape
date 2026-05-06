/* =====================================================
   GridEscape — script.js
   Motor de juego, IA, turnos, niveles y power-ups
   ===================================================== */

'use strict';

// ═══════════════════════════════════════════════════════
// CONSTANTES DE TIPOS DE CELDA
// ═══════════════════════════════════════════════════════
const CELL = Object.freeze({
  EMPTY:   'empty',
  WALL:    'wall',
  HERO:    'hero',
  VILLAIN: 'villain',
  EXIT:    'exit',
  POWERUP: 'powerup',
});

// Tipos de power-up disponibles
const POWER = Object.freeze({
  SPRINT: 'sprint',   // ⚡ 2 movimientos seguidos
  FREEZE: 'freeze',   // ❄️ villano inmóvil 2 turnos
  SHIELD: 'shield',   // 🛡️ absorbe 1 ataque
});

// Emojis de los power-ups
const POWER_EMOJI = {
  [POWER.SPRINT]: '⚡',
  [POWER.FREEZE]: '❄️',
  [POWER.SHIELD]: '🛡️',
};

const STORAGE_KEYS = Object.freeze({
  CURRENT_LEVEL_TO_PLAY: 'current_level_to_play',
});

// ═══════════════════════════════════════════════════════
// DEFINICIÓN DE NIVELES
// Cada nivel: bioma, emojis, muros y power-ups iniciales
// ═══════════════════════════════════════════════════════
const LEVELS = [
  // ── Nivel 1: Jungla (tutorial, pocos muros) ──
  {
    id: 1,
    name: 'Jungla',
    biomeClass: 'biome-jungle',
    hero:    '🤠',
    villain: '🐅',
    exit:    '🏁',
    wall:    '🌳',
    heroStart:    { r: 0, c: 0 },
    villainStart: { r: 9, c: 9 },
    exitPos:      { r: 4, c: 9 },
    // Muros: array de {r, c}
    walls: [
      {r:1,c:2},{r:2,c:2},{r:3,c:2},{r:4,c:2},
      {r:6,c:1},{r:6,c:2},{r:6,c:3},
      {r:2,c:5},{r:3,c:5},{r:4,c:5},{r:5,c:5},
      {r:7,c:5},{r:8,c:5},
      {r:1,c:7},{r:2,c:7},{r:3,c:7},
      {r:5,c:8},{r:6,c:8},{r:7,c:8},
    ],
    // Power-ups: array de {r, c, type}
    powerups: [
      { r: 3, c: 4, type: POWER.SPRINT },
      { r: 7, c: 2, type: POWER.FREEZE },
      { r: 0, c: 6, type: POWER.SHIELD },
    ],
  },

  // ── Nivel 2: Nieve (laberinto medio) ──
  {
    id: 2,
    name: 'Ártico',
    biomeClass: 'biome-snow',
    hero:    '🐧',
    villain: '👹',
    exit:    '🏔️',
    wall:    '🧊',
    heroStart:    { r: 0, c: 0 },
    villainStart: { r: 0, c: 9 },
    exitPos:      { r: 9, c: 5 },
    walls: [
      // Columna vertical con hueco
      {r:0,c:3},{r:1,c:3},{r:3,c:3},{r:4,c:3},{r:5,c:3},
      // Horizontal central
      {r:5,c:1},{r:5,c:2},{r:5,c:4},{r:5,c:5},{r:5,c:6},
      // Corredor derecho
      {r:1,c:6},{r:2,c:6},{r:3,c:6},{r:4,c:6},
      // Bloques inferiores
      {r:7,c:2},{r:7,c:3},{r:7,c:4},
      {r:8,c:7},{r:8,c:8},
      {r:3,c:8},{r:4,c:8},{r:4,c:9},
      {r:6,c:9},{r:7,c:9},
    ],
    powerups: [
      { r: 2, c: 1, type: POWER.SHIELD },
      { r: 4, c: 7, type: POWER.SPRINT },
      { r: 6, c: 4, type: POWER.FREEZE },
      { r: 9, c: 0, type: POWER.SPRINT },
    ],
  },

  // ── Nivel 3: Desierto (máxima dificultad) ──
  {
    id: 3,
    name: 'Desierto',
    biomeClass: 'biome-desert',
    hero:    '🐪',
    villain: '🧟',
    exit:    '🏺',
    wall:    '🌵',
    heroStart:    { r: 9, c: 0 },
    villainStart: { r: 0, c: 5 },
    exitPos:      { r: 0, c: 0 },
    walls: [
      // Laberinto denso
      {r:1,c:1},{r:2,c:1},{r:3,c:1},{r:4,c:1},
      {r:6,c:1},{r:7,c:1},{r:8,c:1},
      {r:1,c:3},{r:2,c:3},{r:3,c:3},
      {r:5,c:3},{r:6,c:3},{r:7,c:3},{r:8,c:3},
      {r:1,c:5},{r:2,c:5},{r:3,c:5},{r:4,c:5},
      {r:6,c:5},{r:7,c:5},
      {r:2,c:7},{r:3,c:7},{r:4,c:7},{r:5,c:7},{r:6,c:7},
      {r:8,c:7},{r:9,c:7},
      {r:0,c:2},{r:0,c:4},{r:0,c:6},{r:0,c:8},
      {r:4,c:0},{r:5,c:0},{r:6,c:0},
      {r:5,c:9},{r:6,c:9},{r:7,c:9},
      {r:9,c:2},{r:9,c:4},{r:9,c:6},
    ],
    powerups: [
      { r: 5, c: 2, type: POWER.FREEZE },
      { r: 3, c: 6, type: POWER.SHIELD },
      { r: 8, c: 4, type: POWER.SPRINT },
      { r: 1, c: 8, type: POWER.FREEZE },
    ],
  },
];

/** Convierte un nivel del Workshop al formato interno del juego. */
function mapCustomLevelToGameLevel(rawLevel) {
  if (!rawLevel || typeof rawLevel !== 'object') return null;

  const parsedSize = Number(rawLevel.gridSize);
  const gridSize = Number.isInteger(parsedSize) ? Math.max(8, Math.min(15, parsedSize)) : 10;
  const wallList = Array.isArray(rawLevel.walls) ? rawLevel.walls : [];
  const boosterList = Array.isArray(rawLevel.boosters) ? rawLevel.boosters : [];

  const powerups = boosterList
    .filter(b => b && Number.isInteger(b.r) && Number.isInteger(b.c))
    .map(b => ({
      r: b.r,
      c: b.c,
      type: [POWER.SPRINT, POWER.FREEZE, POWER.SHIELD].includes(b.type) ? b.type : POWER.SPRINT,
    }));

  const baseLevel = {
    id: 'Workshop',
    name: typeof rawLevel.name === 'string' && rawLevel.name.trim() ? rawLevel.name.trim() : 'Nivel Workshop',
    biomeClass: typeof rawLevel.biomeClass === 'string' ? rawLevel.biomeClass : 'biome-jungle',
    hero: rawLevel.heroEmoji || '🤠',
    villain: rawLevel.villainEmoji || '🐅',
    exit: '🏁',
    wall: rawLevel.wallEmoji || '🌳',
    gridSize,
    heroStart: rawLevel.heroPos,
    villainStart: rawLevel.villainPos,
    exitPos: rawLevel.exitPos,
    walls: wallList,
    powerups,
  };

  const hasRequiredPoints =
    baseLevel.heroStart && baseLevel.villainStart && baseLevel.exitPos &&
    Number.isInteger(baseLevel.heroStart.r) && Number.isInteger(baseLevel.heroStart.c) &&
    Number.isInteger(baseLevel.villainStart.r) && Number.isInteger(baseLevel.villainStart.c) &&
    Number.isInteger(baseLevel.exitPos.r) && Number.isInteger(baseLevel.exitPos.c);

  if (!hasRequiredPoints) return null;
  return baseLevel;
}

// ═══════════════════════════════════════════════════════
// CLASE PRINCIPAL: Game
// Encapsula todo el estado y la lógica del juego
// ═══════════════════════════════════════════════════════
class Game {
  constructor() {
    // ── Tamaño del grid (configurable) ──
    this.GRID_SIZE = 10;

    // ── Referencias al DOM ──
    this.canvasEl       = document.getElementById('canvas-3d');
    this.hudLevel       = document.getElementById('hud-level');
    this.hudMoves       = document.getElementById('hud-moves');
    this.hudPower       = document.getElementById('hud-power');
    this.hudBiome       = document.getElementById('hud-biome');
    this.appEl          = document.getElementById('app');

    // ── Renderer 3D ──
    this.renderer3d     = null;

    this.modalWin       = document.getElementById('modal-win');
    this.modalLose      = document.getElementById('modal-lose');
    this.modalComplete  = document.getElementById('modal-complete');
    this.winMovesText   = document.getElementById('win-moves-text');

    // ── Estado del juego ──
    this.currentLevelIndex = 0;  // índice en el array levels
    this.levels = LEVELS;
    this.level  = null;           // objeto de nivel actual
    this.grid   = [];             // matriz 10x10 de tipos de celda
    this.cells  = [];             // matriz 10x10 de elementos DOM
    this.hero   = { r: 0, c: 0 };
    this.villain = { r: 0, c: 0 };
    this.villainOrigin = { r: 0, c: 0 }; // posición inicial del villano (para reset con escudo)
    this.moveCount  = 0;

    // ── Estado de power-ups ──
    this.activePower    = null;  // power-up activo que tiene el héroe
    this.sprintPending  = false; // el héroe tiene un 2.º movimiento disponible
    this.frozenTurns    = 0;     // turnos que el villano permanece inmóvil
    this.hasShield      = false; // el héroe tiene escudo activo

    // ── Lock de input para evitar movimientos mientras se procesa ──
    this.inputLocked = false;

    this._tryLoadWorkshopLevel();

    this._bindEvents();
  }

  /** Si hay un nivel del Workshop pendiente, lo carga como sesión actual. */
  _tryLoadWorkshopLevel() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEYS.CURRENT_LEVEL_TO_PLAY);
    } catch {
      return;
    }

    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const workshopLevel = mapCustomLevelToGameLevel(parsed);
      if (workshopLevel) {
        this.levels = [workshopLevel];
        this.currentLevelIndex = 0;
      }
    } catch {
      // ignorar JSON inválido
    } finally {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_LEVEL_TO_PLAY);
    }
  }

  // ───────────────────────────────────────────────────
  // INICIALIZACIÓN DE NIVEL
  // ───────────────────────────────────────────────────

  /** Arranca o reinicia el nivel indicado por this.currentLevelIndex */
  loadLevel() {
    this.level = this.levels[this.currentLevelIndex] || this.levels[0];
    this.GRID_SIZE = this.level.gridSize || 10;

    // Resetear estado
    this.moveCount     = 0;
    this.activePower   = null;
    this.sprintPending = false;
    this.frozenTurns   = 0;
    this.hasShield     = false;
    this.inputLocked   = false;

    // Cambiar clase de bioma en el contenedor
    this.appEl.className = this.level.biomeClass;
    this.hudBiome.textContent = this.level.name;
    this.hudLevel.textContent = this.level.id;

    // Construir la matriz lógica
    this._buildGrid();

    // Inicializar renderer 3D si es la primera vez
    if (!this.renderer3d) {
      this.renderer3d = new Renderer3D(this.canvasEl);
    }

    // Construir tablero 3D desde cero
    this.renderer3d.buildBoard(this.grid, this.level);

    // Crear personajes 3D
    this.renderer3d.createCharacter('hero', this.hero.r, this.hero.c, this.level);
    this.renderer3d.createCharacter('villain', this.villain.r, this.villain.c, this.level);

    // Actualizar HUD
    this._updateHUD();
  }

  /** Construye la matriz grid[][] con los tipos de celda del nivel */
  _buildGrid() {
    const N = this.GRID_SIZE;
    const lvl = this.level;

    // Inicializar todo como vacío
    this.grid = Array.from({ length: N }, () => Array(N).fill(CELL.EMPTY));

    // Colocar muros
    for (const { r, c } of lvl.walls) {
      if (this._inBounds(r, c)) this.grid[r][c] = CELL.WALL;
    }

    // Colocar power-ups
    for (const { r, c } of lvl.powerups) {
      if (this._inBounds(r, c) && this.grid[r][c] === CELL.EMPTY) {
        this.grid[r][c] = CELL.POWERUP;
      }
    }

    // Colocar salida
    const { r: er, c: ec } = lvl.exitPos;
    this.grid[er][ec] = CELL.EXIT;

    // Colocar héroe y villano (NOTA: NO se ponen en el grid, solo en variables separadas)
    this.hero    = { ...lvl.heroStart };
    this.villain = { ...lvl.villainStart };
    this.villainOrigin = { ...lvl.villainStart };

    // ── Validar conectividad del nivel ──
    this._ensureConnectivity();
  }

  /**
   * Verifica que no haya zonas aisladas donde héroe/villano queden atrapados.
   * Remueve muros estratégicamente si es necesario para asegurar jugabilidad.
   */
  _ensureConnectivity() {
    const N = this.GRID_SIZE;

    // 1. Verificar si el héroe puede llegar a la salida
    if (!this._canReach(this.hero, this.level.exitPos)) {
      // Remover muros hasta encontrar camino
      this._removeWallsUntilReachable(this.hero, this.level.exitPos);
    }

    // 2. Verificar si el villano puede alcanzar el héroe
    if (!this._canReach(this.villain, this.hero)) {
      // Remover muros hasta encontrar camino
      this._removeWallsUntilReachable(this.villain, this.hero);
    }
  }

  /**
   * Verifica si hay un camino desde 'from' hasta 'to' usando BFS.
   * @param {{r, c}} from - posición inicial
   * @param {{r, c}} to - posición destino
   * @returns {boolean}
   */
  _canReach(from, to) {
    const N = this.GRID_SIZE;
    const visited = Array.from({ length: N }, () => Array(N).fill(false));
    const queue = [from];
    visited[from.r][from.c] = true;

    const dirs = [
      { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
      { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
    ];

    while (queue.length > 0) {
      const cur = queue.shift();

      if (cur.r === to.r && cur.c === to.c) {
        return true; // Encontró camino
      }

      for (const d of dirs) {
        const nr = cur.r + d.dr;
        const nc = cur.c + d.dc;

        if (!this._inBounds(nr, nc))    continue;
        if (visited[nr][nc])            continue;
        if (this.grid[nr][nc] === CELL.WALL) continue;

        visited[nr][nc] = true;
        queue.push({ r: nr, c: nc });
      }
    }

    return false; // No hay camino
  }

  /**
   * Remueve muros hasta que 'from' pueda alcanzar 'to'.
   * Estrategia: remover muros que están "cerca" del camino que debería tomar.
   * @param {{r, c}} from - posición inicial
   * @param {{r, c}} to - posición destino
   */
  _removeWallsUntilReachable(from, to) {
    const maxAttempts = 20;
    let attempts = 0;

    while (!this._canReach(from, to) && attempts < maxAttempts) {
      // Encontrar muros cercanos a la línea imaginaria entre from y to
      const wallsToRemove = this._findBlockingWalls(from, to);

      if (wallsToRemove.length === 0) {
        // Si no hay muros cercanos, remover un muro aleatorio
        const randomWall = this._getRandomWall();
        if (randomWall) {
          this.grid[randomWall.r][randomWall.c] = CELL.EMPTY;
        }
      } else {
        // Remover el primer muro bloqueante
        const wall = wallsToRemove[0];
        this.grid[wall.r][wall.c] = CELL.EMPTY;
      }

      attempts++;
    }
  }

  /**
   * Encuentra muros que están "bloqueando" el camino directo entre dos puntos.
   * @param {{r, c}} from
   * @param {{r, c}} to
   * @returns {Array} array de posiciones de muros
   */
  _findBlockingWalls(from, to) {
    const result = [];
    const dirs = [
      { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
      { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
    ];

    // Buscar muros en las 4 direcciones principales entre from y to
    const dr = Math.sign(to.r - from.r);
    const dc = Math.sign(to.c - from.c);

    // Explorar en forma de cruz desde 'from' hacia 'to'
    let curr = { r: from.r, c: from.c };
    for (let step = 0; step < 15; step++) {
      // Buscar muros adyacentes a la posición actual
      for (const d of dirs) {
        const nr = curr.r + d.dr;
        const nc = curr.c + d.dc;
        if (this._inBounds(nr, nc) && this.grid[nr][nc] === CELL.WALL) {
          result.push({ r: nr, c: nc });
        }
      }

      // Avanzar hacia el objetivo
      if (curr.r !== to.r) curr.r += dr;
      if (curr.c !== to.c) curr.c += dc;

      if (curr.r === to.r && curr.c === to.c) break;
    }

    return result.slice(0, 3); // Retornar los primeros 3 muros encontrados
  }

  /**
   * Retorna un muro aleatorio del grid.
   * @returns {{r, c}|null}
   */
  _getRandomWall() {
    const walls = [];
    for (let r = 0; r < this.GRID_SIZE; r++) {
      for (let c = 0; c < this.GRID_SIZE; c++) {
        if (this.grid[r][c] === CELL.WALL) {
          walls.push({ r, c });
        }
      }
    }
    if (walls.length === 0) return null;
    return walls[Math.floor(Math.random() * walls.length)];
  }

  // ───────────────────────────────────────────────────
  // RENDERIZADO
  // ───────────────────────────────────────────────────

  /** Renderizado completo — solo al iniciar/reiniciar nivel */
  _renderFullBoard() {
    // Ya no necesitamos renderizar en 2D, todo es 3D
    // Esta función se mantiene por compatibilidad pero no hace nada
  }

  /**
   * Actualiza visualmente solo una celda en (r, c).
   * Se llama tras cada movimiento para optimizar el rendimiento.
   */
  _updateCell(r, c) {
    // En modo 3D, no necesitamos actualizar celdas individuales
    // Todo se maneja en el renderer 3D
  }

  /** Actualiza el HUD con el estado actual */
  _updateHUD() {
    this.hudMoves.textContent = this.moveCount;

    if (this.activePower) {
      this.hudPower.textContent  = POWER_EMOJI[this.activePower];
      this.hudPower.classList.add('has-power');
    } else if (this.hasShield) {
      this.hudPower.textContent  = '🛡️';
      this.hudPower.classList.add('has-power');
    } else {
      this.hudPower.textContent  = '—';
      this.hudPower.classList.remove('has-power');
    }
  }

  // ───────────────────────────────────────────────────
  // MOVIMIENTO DEL HÉROE (Turno del jugador)
  // ───────────────────────────────────────────────────

  /**
   * Procesa la dirección del jugador.
   * @param {string} dir - 'up'|'down'|'left'|'right'
   */
  moveHero(dir) {
    if (this.inputLocked) return;

    const delta = {
      up:    { dr: -1, dc:  0 },
      down:  { dr:  1, dc:  0 },
      left:  { dr:  0, dc: -1 },
      right: { dr:  0, dc:  1 },
    };

    const d = delta[dir];
    if (!d) return;

    const nr = this.hero.r + d.dr;
    const nc = this.hero.c + d.dc;

    // ── Validar movimiento ──
    if (!this._inBounds(nr, nc))            return; // fuera del tablero
    if (this.grid[nr][nc] === CELL.WALL)    return; // muro bloqueante
    if (nr === this.villain.r && nc === this.villain.c) {
      // Villano en la casilla destino → game over (a menos que tengamos escudo)
      if (this.hasShield) {
        this._triggerShield();
        return;
      }
      this._gameOver();
      return;
    }

    // ── Guardar posición anterior del héroe ──
    const oldR = this.hero.r, oldC = this.hero.c;

    // ── Comprobar si recoge un power-up ──
    if (this.grid[nr][nc] === CELL.POWERUP) {
      this._collectPowerup(nr, nc);
      // Efecto visual 3D
      if (this.renderer3d) {
        this.renderer3d.effectPowerupCollected(nr, nc);
      }
    }

    // ── Comprobar si llega a la salida ──
    const isExit = this.grid[nr][nc] === CELL.EXIT;

    // ── Mover héroe (solo actualizar variable, no el grid) ──
    this.hero = { r: nr, c: nc };

    // ── Animar movimiento en 3D ──
    if (this.renderer3d) {
      this.renderer3d.animateCharacterMove('hero', oldR, oldC, nr, nc);
    }

    this.moveCount++;
    this._updateHUD();

    if (isExit) {
      this._levelWin();
      return;
    }

    // ── Comprobar si es un turno de sprint (2 movimientos seguidos) ──
    if (this.sprintPending) {
      this.sprintPending = false;
      this._updateHUD(); // limpiar indicador sprint
      // El villano no se mueve entre los dos pasos del sprint
      return;
    }

    // ── Turno del villano ──
    this._villainTurn();
  }

  // ───────────────────────────────────────────────────
  // TURNO DEL VILLANO (IA)
  // ───────────────────────────────────────────────────

  /** Calcula y ejecuta el movimiento del villano */
  _villainTurn() {
    // Si está congelado, descontar turno y no moverse
    if (this.frozenTurns > 0) {
      this.frozenTurns--;
      this._updateCell(this.villain.r, this.villain.c); // actualizar emoji (quitar ❄️ si es 0)
      return;
    }

    const move = this._calculateVillainMove();
    if (!move) return; // sin movimiento disponible

    const { nr, nc } = move;

    // Si el villano llega a la celda del héroe → game over o escudo
    if (nr === this.hero.r && nc === this.hero.c) {
      if (this.hasShield) {
        this._triggerShield();
        return;
      }
      this._gameOver();
      return;
    }

    // Mover villano (solo actualizar variable, no el grid)
    const oldR = this.villain.r, oldC = this.villain.c;
    this.villain = { r: nr, c: nc };

    // Animar movimiento en 3D
    if (this.renderer3d) {
      this.renderer3d.animateCharacterMove('villain', oldR, oldC, nr, nc);
    }

    // Actualizar efecto de peligro
    if (this.renderer3d) {
      const isDanger = this._manhattan(this.hero, this.villain) <= 2;
      this.renderer3d.effectDanger(this.hero.r, this.hero.c, isDanger);
    }
  }

  /**
   * IA del villano: BFS para encontrar el primer paso del camino más corto.
   * Si BFS no llega al héroe (bloqueado), usa la heurística de distancia Manhattan.
   * @returns {{nr: number, nc: number}|null}
   */
  _calculateVillainMove() {
    // ── BFS hacia el héroe ──
    const target = this.hero;
    const start  = this.villain;
    const N      = this.GRID_SIZE;

    const visited = Array.from({ length: N }, () => Array(N).fill(false));
    const parent  = Array.from({ length: N }, () => Array(N).fill(null));

    const queue = [{ r: start.r, c: start.c }];
    visited[start.r][start.c] = true;

    const dirs = [
      { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
      { dr:  0, dc: -1 }, { dr: 0, dc: 1 },
    ];

    let found = false;

    bfsLoop:
    while (queue.length > 0) {
      const cur = queue.shift();

      for (const d of dirs) {
        const nr = cur.r + d.dr;
        const nc = cur.c + d.dc;

        if (!this._inBounds(nr, nc)) continue;
        if (visited[nr][nc])         continue;
        // El villano puede pasar por vacío, powerup, exit o la posición del héroe
        const cellType = this.grid[nr][nc];
        if (cellType === CELL.WALL)    continue;

        visited[nr][nc]       = true;
        parent[nr][nc]        = { r: cur.r, c: cur.c };
        queue.push({ r: nr, c: nc });

        if (nr === target.r && nc === target.c) {
          found = true;
          break bfsLoop;
        }
      }
    }

    if (found) {
      // Reconstruir camino desde héroe hasta villano
      let node = { r: target.r, c: target.c };
      while (parent[node.r][node.c] &&
             !(parent[node.r][node.c].r === start.r && parent[node.r][node.c].c === start.c)) {
        node = parent[node.r][node.c];
      }
      // node ahora es el primer paso desde el villano
      return { nr: node.r, nc: node.c };
    }

    // ── Fallback heurístico si BFS no encontró ruta ──
    return this._greedyVillainMove();
  }

  /**
   * Movimiento voraz: elige la dirección que más reduce la distancia Manhattan.
   * @returns {{nr: number, nc: number}|null}
   */
  _greedyVillainMove() {
    const dirs = [
      { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
      { dr:  0, dc: -1 }, { dr: 0, dc: 1 },
    ];

    let best = null;
    let bestDist = Infinity;

    for (const d of dirs) {
      const nr = this.villain.r + d.dr;
      const nc = this.villain.c + d.dc;

      if (!this._inBounds(nr, nc)) continue;
      const cellType = this.grid[nr][nc];
      if (cellType === CELL.WALL) continue;

      const dist = this._manhattan({ r: nr, c: nc }, this.hero);
      if (dist < bestDist) {
        bestDist = dist;
        best = { nr, nc };
      }
    }

    return best;
  }

  // ───────────────────────────────────────────────────
  // POWER-UPS
  // ───────────────────────────────────────────────────

  /**
   * El héroe recoge el power-up ubicado en (r, c).
   * @param {number} r
   * @param {number} c
   */
  _collectPowerup(r, c) {
    const pu = this.level.powerups.find(p => p.r === r && p.c === c);
    if (!pu) return;

    switch (pu.type) {
      case POWER.SPRINT:
        this.activePower   = POWER.SPRINT;
        this.sprintPending = true;  // el próximo movimiento no activa el turno del villano
        break;

      case POWER.FREEZE:
        this.activePower = null;
        this.frozenTurns = 2;       // villano inmóvil los próximos 2 turnos del jugador
        break;

      case POWER.SHIELD:
        this.activePower = null;
        this.hasShield   = true;
        break;
    }

    // Si era sprint, mantener activePower para el HUD; si no, limpiar tras aplicar
    if (pu.type !== POWER.SPRINT) {
      this.activePower = pu.type; // mostrar brevemente en HUD
      // Lo limpiamos tras actualizar HUD
      setTimeout(() => {
        if (this.activePower === pu.type && pu.type !== POWER.SPRINT) {
          this.activePower = null;
          this._updateHUD();
        }
      }, 600);
    }

    // Eliminar el power-up del nivel para que no reaparezca
    this.level.powerups = this.level.powerups.filter(p => !(p.r === r && p.c === c));
  }

  /**
   * El escudo absorbe el ataque del villano:
   * el villano regresa a su posición inicial.
   */
  _triggerShield() {
    this.hasShield = false;
    this.activePower = null;

    // Devolver villano a su origen (solo actualizar variable, no el grid)
    const oldR = this.villain.r, oldC = this.villain.c;
    this.villain = { ...this.villainOrigin };

    // Animar regreso en 3D
    if (this.renderer3d) {
      this.renderer3d.animateCharacterMove('villain', oldR, oldC, this.villain.r, this.villain.c);
    }

    this._updateHUD();
  }

  // ───────────────────────────────────────────────────
  // CONDICIONES DE FIN
  // ───────────────────────────────────────────────────

  /** El héroe llega a la salida → victoria */
  _levelWin() {
    this.inputLocked = true;
    this.winMovesText.textContent = `Movimientos: ${this.moveCount}`;
    const nextIndex = this.currentLevelIndex + 1;

    if (nextIndex >= this.levels.length) {
      // Último nivel superado → juego completado
      setTimeout(() => this._showModal(this.modalComplete), 400);
    } else {
      setTimeout(() => this._showModal(this.modalWin), 400);
    }
  }

  /** El villano atrapa al héroe → derrota */
  _gameOver() {
    this.inputLocked = true;
    setTimeout(() => this._showModal(this.modalLose), 300);
  }

  // ───────────────────────────────────────────────────
  // UTILIDADES
  // ───────────────────────────────────────────────────

  /** Distancia Manhattan entre dos posiciones {r, c} */
  _manhattan(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
  }

  /** Comprueba si (r, c) está dentro de los límites del grid */
  _inBounds(r, c) {
    return r >= 0 && r < this.GRID_SIZE && c >= 0 && c < this.GRID_SIZE;
  }

  /** Muestra un modal y oculta los demás */
  _showModal(modal) {
    [this.modalWin, this.modalLose, this.modalComplete].forEach(m => {
      m.classList.remove('active');
    });
    modal.classList.add('active');
  }

  /** Oculta todos los modales */
  _hideModals() {
    [this.modalWin, this.modalLose, this.modalComplete].forEach(m => {
      m.classList.remove('active');
    });
  }

  // ───────────────────────────────────────────────────
  // EVENTOS
  // ───────────────────────────────────────────────────

  _bindEvents() {
    // ── Teclado ──
    document.addEventListener('keydown', (e) => {
      const keyMap = {
        ArrowUp:    'up',    w: 'up',    W: 'up',
        ArrowDown:  'down',  s: 'down',  S: 'down',
        ArrowLeft:  'left',  a: 'left',  A: 'left',
        ArrowRight: 'right', d: 'right', D: 'right',
      };
      const dir = keyMap[e.key];
      if (dir) {
        e.preventDefault(); // evita scroll de la página
        this.moveHero(dir);
      }
    });

    // ── Botones táctiles ──
    document.querySelectorAll('.touch-btn[data-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.dir;
        if (dir && dir !== 'none') this.moveHero(dir);
      });
    });

    // ── Gestos swipe en móvil (sobre el canvas) ──
    let touchStartX = 0;
    let touchStartY = 0;
    let trackingSwipe = false;

    this.canvasEl.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      trackingSwipe = true;
    }, { passive: true });

    this.canvasEl.addEventListener('touchend', (e) => {
      if (!trackingSwipe || e.changedTouches.length === 0) return;
      trackingSwipe = false;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - touchStartX;
      const dy = endY - touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const minSwipe = 24;

      if (absDx < minSwipe && absDy < minSwipe) return;

      if (absDx >= absDy) {
        this.moveHero(dx > 0 ? 'right' : 'left');
      } else {
        this.moveHero(dy > 0 ? 'down' : 'up');
      }
    }, { passive: true });

    // ── Modales ──
    document.getElementById('btn-next-level').addEventListener('click', () => {
      this._hideModals();
      this.currentLevelIndex++;
      this.loadLevel();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      this._hideModals();
      this.loadLevel();
    });

    document.getElementById('btn-play-again').addEventListener('click', () => {
      this._hideModals();
      this.currentLevelIndex = 0;
      this.loadLevel();
    });

    // ── Pantalla de inicio ──
    document.getElementById('btn-start').addEventListener('click', () => {
      document.getElementById('start-screen').classList.remove('active');
      this.loadLevel();
    });
  }
}

// ═══════════════════════════════════════════════════════
// PUNTO DE ENTRADA
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Crear instancia global del juego
  window.game = new Game();
  // El nivel se carga al pulsar "Comenzar" (btn-start → loadLevel)

  // Toggle de controles táctiles
  const toggleControls = document.getElementById('toggle-controls');
  const touchControls  = document.getElementById('touch-controls');
  if (toggleControls && touchControls) {
    toggleControls.addEventListener('change', () => {
      touchControls.classList.toggle('visible', toggleControls.checked);
    });
  }
});
