/* =====================================================
   GridEscape — renderer3d.js
   Motor de renderizado 3D con Three.js
   ===================================================== */

'use strict';

class Renderer3D {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.scene = new THREE.Scene();
    this.camera = null;
    this.renderer = null;
    this.board = null;
    this.entities = {}; // mapeo {tipo}[{r,c}] = mesh 3D
    this.cellSize = 1;
    this.gridSize = 10;
    this.gltfLoader = null;
    this.modelCache = {
      hero: null,
      villain: null,
    };
    this.modelPaths = {
      hero: 'assets/models/hero.glb',
      villain: 'assets/models/villain.glb',
    };

    // Colores por bioma (se actualizan con setTheme)
    this.colors = {
      cell: 0x3a7a30,
      cellAlt: 0x347029,
      wall: 0x1a2a10,
      hero: 0x4a9eff,
      villain: 0xff4444,
      exit: 0xffd700,
      powerup: 0xaaffaa,
    };

    this._init();
  }

  /** Inicializa Three.js */
  _init() {
    // Esperar a que el canvas tenga dimensiones
    if (this.canvas.clientWidth === 0 || this.canvas.clientHeight === 0) {
      requestAnimationFrame(() => this._init());
      return;
    }

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas, 
      antialias: true, 
      alpha: true 
    });
    this.renderer.setClearColor(0x000000, 0.1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    if (THREE.GLTFLoader) {
      this.gltfLoader = new THREE.GLTFLoader();
      this._preloadCharacterModels();
    }

    // Cámara isométrica
    const aspectRatio = this.canvas.clientWidth / this.canvas.clientHeight;
    const viewSize = 10;
    const halfHeight = viewSize / 2;
    const halfWidth = halfHeight * aspectRatio;

    this.camera = new THREE.OrthographicCamera(
      -halfWidth,
      halfWidth,
      halfHeight,
      -halfHeight,
      0.1,
      1000
    );
    this.camera.position.set(10, 12, 10);
    this.camera.lookAt(0, 0, 0);

    // Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    this.scene.add(directionalLight);

    // Renderizado
    this._onWindowResize();
    window.addEventListener('resize', () => this._onWindowResize());
    
    this._animate();
  }

  /** Precarga modelos de personaje (si existen). */
  _preloadCharacterModels() {
    const loadOne = (type) => {
      const path = this.modelPaths[type];
      console.info(`[Renderer3D] Cargando modelo ${type}: ${path}`);
      this.gltfLoader.load(
        path,
        (gltf) => {
          const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!root) return;
          root.traverse((obj) => {
            if (obj.isMesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
            }
          });
          this.modelCache[type] = root;
          console.info(`[Renderer3D] Modelo ${type} cargado correctamente.`);
          this._replaceCharacterWithModel(type);
        },
        undefined,
        () => {
          // Sin modelo o fallo de carga: se usara fallback geometrico.
          this.modelCache[type] = null;
          console.warn(`[Renderer3D] No se pudo cargar ${path}. Se usa fallback para ${type}.`);
        }
      );
    };

    loadOne('hero');
    loadOne('villain');
  }

  /**
   * Ajusta un modelo 3D para que encaje visualmente en una celda del grid.
   * Lo centra en X/Z y lo apoya sobre Y=0.
   */
  _normalizeModelForCell(model, type) {
    const targetSize = type === 'hero' ? 0.62 : 0.68;
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;

    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const uniformScale = targetSize / maxDim;
    model.scale.multiplyScalar(uniformScale);

    // Recalcular caja tras escalar y recentrar respecto al origen.
    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);

    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaledBox.min.y;
  }

  /**
   * Si ya habia un mesh fallback en escena, lo reemplaza por el modelo GLB.
   */
  _replaceCharacterWithModel(type) {
    if (!this.board || !this.modelCache[type] || !this.entities[type]?.['0']) return;

    const oldMesh = this.entities[type]['0'];
    const { r, c } = oldMesh.userData || { r: 0, c: 0 };

    this.board.remove(oldMesh);
    delete this.entities[type]['0'];

    this.createCharacter(type, r, c);
  }

  /** Construye el tablero 3D desde cero */
  buildBoard(grid, level) {
    // Limpiar escena anterior
    if (this.board) this.scene.remove(this.board);
    this.entities = {};

    this.board = new THREE.Group();
    this.scene.add(this.board);

    this.gridSize = grid.length;
    const offset = (this.gridSize * this.cellSize) / 2;

    // Crear celdas
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const x = c * this.cellSize - offset + this.cellSize / 2;
        const z = r * this.cellSize - offset + this.cellSize / 2;

        const cellType = grid[r][c];

        // Crear celda base
        const cellMesh = this._createCell(cellType, x, z, level);
        cellMesh.userData = { r, c, type: cellType };
        this.board.add(cellMesh);

        // Guardar referencia para actualización posterior
        if (!this.entities[cellType]) this.entities[cellType] = [];
        this.entities[cellType][`${r},${c}`] = cellMesh;
      }
    }

    // Actualizar tema según bioma
    this._updateThemeColors(level.biomeClass);
    
    // Reajustar cámara después de cargar el tablero
    this._onWindowResize();
  }

  /**
   * Crea una celda individual 3D
   * @param {string} cellType - tipo de celda
   * @param {number} x, z - posición
   * @param {object} level - información del nivel
   * @returns {THREE.Mesh}
   */
  _createCell(cellType, x, z, level) {
    const CELL = {
      EMPTY: 'empty',
      WALL: 'wall',
      EXIT: 'exit',
      POWERUP: 'powerup',
    };

    let geometry, material, height = 0.1;

    switch (cellType) {
      case CELL.WALL: {
        height = 0.8;
        geometry = new THREE.BoxGeometry(this.cellSize * 0.9, height, this.cellSize * 0.9);
        material = new THREE.MeshStandardMaterial({ 
          color: this.colors.wall, 
          roughness: 0.7, 
          metalness: 0.2 
        });
        break;
      }

      case CELL.EXIT: {
        height = 0.3;
        geometry = new THREE.ConeGeometry(this.cellSize * 0.4, height, 8);
        material = new THREE.MeshStandardMaterial({ 
          color: this.colors.exit, 
          emissive: 0xffa500, 
          emissiveIntensity: 0.5,
          roughness: 0.3
        });
        break;
      }

      case CELL.POWERUP: {
        height = 0.2;
        geometry = new THREE.IcosahedronGeometry(this.cellSize * 0.3, 4);
        material = new THREE.MeshStandardMaterial({ 
          color: this.colors.powerup, 
          emissive: 0x00ff00, 
          emissiveIntensity: 0.3,
          roughness: 0.4
        });
        break;
      }

      default: { // EMPTY
        geometry = new THREE.PlaneGeometry(this.cellSize, this.cellSize);
        const colorIdx = Math.abs(Math.floor(x) + Math.floor(z)) % 2;
        const color = colorIdx === 0 ? this.colors.cell : this.colors.cellAlt;
        material = new THREE.MeshStandardMaterial({ 
          color, 
          roughness: 0.8 
        });
        height = 0.01;
        break;
      }
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, height / 2, z);
    // Las celdas base deben estar sobre el plano XZ (suelo), no en XY.
    if (cellType === CELL.EMPTY) {
      mesh.rotation.x = -Math.PI / 2;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  /**
   * Crea o actualiza un personaje (héroe/villano) en 3D
   * @param {string} type - 'hero' o 'villain'
   * @param {number} r, c - posición
   * @param {object} level - información del nivel
   * @returns {THREE.Mesh}
   */
  createCharacter(type, r, c, level) {
    const offset = this.gridSize * this.cellSize / 2;
    const x = c * this.cellSize - offset + this.cellSize / 2;
    const z = r * this.cellSize - offset + this.cellSize / 2;

    let mesh;
    const color = type === 'hero' ? this.colors.hero : this.colors.villain;

    try {
      if (this.modelCache[type]) {
        mesh = new THREE.Group();
        const model = this.modelCache[type].clone(true);
        this._normalizeModelForCell(model, type);
        mesh.add(model);
      } else if (type === 'hero') {
        // Geometria compatible con r128 (sin dependencias de examples/).
        const geometry = new THREE.SphereGeometry(this.cellSize * 0.28, 16, 16);
        const material = new THREE.MeshStandardMaterial({
          color,
          emissive: 0x0066ff,
          emissiveIntensity: 0.25,
          roughness: 0.45,
          metalness: 0.1,
        });
        mesh = new THREE.Mesh(geometry, material);
      } else {
        const geometry = new THREE.BoxGeometry(this.cellSize * 0.42, this.cellSize * 0.52, this.cellSize * 0.42);
        const material = new THREE.MeshStandardMaterial({
          color,
          emissive: 0xaa0000,
          emissiveIntensity: 0.3,
          roughness: 0.6,
          metalness: 0.05,
        });
        mesh = new THREE.Mesh(geometry, material);
      }
    } catch (err) {
      // Fallback defensivo para asegurar que siempre haya personaje visible.
      const fallbackGeometry = new THREE.BoxGeometry(this.cellSize * 0.35, this.cellSize * 0.35, this.cellSize * 0.35);
      const fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
      mesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
    }

    mesh.position.set(x, this.cellSize * 0.25, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.traverse?.((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    mesh.userData = { type, r, c };

    this.board.add(mesh);

    if (!this.entities[type]) this.entities[type] = {};
    this.entities[type]['0'] = mesh;

    return mesh;
  }

  /**
   * Anima el movimiento de un personaje de (fromR, fromC) a (toR, toC)
   * @param {string} type - 'hero' o 'villain'
   * @param {number} fromR, fromC, toR, toC - posiciones
   * @param {number} duration - duración en ms
   */
  animateCharacterMove(type, fromR, fromC, toR, toC, duration = 300) {
    const mesh = this.entities[type]?.['0'];
    if (!mesh) return;

    const offset = this.gridSize * this.cellSize / 2;
    const fromX = fromC * this.cellSize - offset + this.cellSize / 2;
    const fromZ = fromR * this.cellSize - offset + this.cellSize / 2;
    const toX = toC * this.cellSize - offset + this.cellSize / 2;
    const toZ = toR * this.cellSize - offset + this.cellSize / 2;

    // Animar con GSAP
    gsap.to(mesh.position, {
      x: toX,
      z: toZ,
      duration: duration / 1000,
      ease: 'power1.inOut',
    });

    // Animación de salto (eje Y)
    gsap.to(mesh.position, {
      y: this.cellSize * 0.5,
      duration: duration / 2000,
      repeat: 1,
      yoyo: true,
      ease: 'power1.out',
    });

    mesh.userData.r = toR;
    mesh.userData.c = toC;
  }

  /**
   * Actualiza los colores según el bioma
   * @param {string} biomeClass - clase CSS del bioma
   */
  _updateThemeColors(biomeClass) {
    // Mapeo de biomas a paletas de color
    const themes = {
      'biome-jungle': {
        cell: 0x3a7a30,
        cellAlt: 0x347029,
        wall: 0x1a2a10,
      },
      'biome-snow': {
        cell: 0xe8f4fb,
        cellAlt: 0xd8ecf8,
        wall: 0xa0c8e0,
      },
      'biome-desert': {
        cell: 0xdba83a,
        cellAlt: 0xcf9f30,
        wall: 0x6a4a10,
      },
      'biome-space': {
        cell: 0x293c7a,
        cellAlt: 0x223266,
        wall: 0x5268a8,
      },
    };

    const theme = themes[biomeClass] || themes['biome-jungle'];
    Object.assign(this.colors, theme);

    // Actualizar colores de celdas existentes
    this.board.children.forEach(mesh => {
      if (mesh.userData.type === 'empty' || mesh.userData.type === undefined) {
        const colorIdx = Math.abs(Math.floor(mesh.position.x) + Math.floor(mesh.position.z)) % 2;
        const color = colorIdx === 0 ? this.colors.cell : this.colors.cellAlt;
        mesh.material.color.setHex(color);
      } else if (mesh.userData.type === 'wall') {
        mesh.material.color.setHex(this.colors.wall);
      }
    });
  }

  /**
   * Efecto visual de poder recogido
   * @param {number} r, c - posición
   */
  effectPowerupCollected(r, c) {
    const offset = this.gridSize * this.cellSize / 2;
    const x = c * this.cellSize - offset + this.cellSize / 2;
    const z = r * this.cellSize - offset + this.cellSize / 2;

    // Crear partículas de luz
    for (let i = 0; i < 5; i++) {
      const particle = this._createParticle(x, z);
      this.board.add(particle);

      gsap.to(particle.position, {
        x: x + (Math.random() - 0.5) * 3,
        y: 2,
        z: z + (Math.random() - 0.5) * 3,
        duration: 1,
        ease: 'power1.out',
        onComplete: () => this.board.remove(particle),
      });

      gsap.to(particle.material, {
        opacity: 0,
        duration: 1,
      });
    }
  }

  /** Crea una partícula de efecto */
  _createParticle(x, z) {
    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xffff00, 
      opacity: 1,
      transparent: true
    });
    const particle = new THREE.Mesh(geometry, material);
    particle.position.set(x, 0.5, z);
    return particle;
  }

  /**
   * Efecto visual de peligro (villano cerca)
   * @param {number} r, c - posición del héroe
   * @param {boolean} active - activar o desactivar
   */
  effectDanger(r, c, active) {
    const mesh = this.entities.hero?.['0'];
    if (!mesh) return;

    const setEmissive = (value) => {
      mesh.traverse?.((obj) => {
        if (obj.isMesh && obj.material && 'emissiveIntensity' in obj.material) {
          obj.material.emissiveIntensity = value;
        }
      });
      if (mesh.material && 'emissiveIntensity' in mesh.material) {
        mesh.material.emissiveIntensity = value;
      }
    };

    if (active) {
      if (mesh.material && 'emissiveIntensity' in mesh.material) {
        gsap.to(mesh.material, {
          emissiveIntensity: 0.8,
          duration: 0.3,
          repeat: -1,
          yoyo: true,
        });
      } else {
        setEmissive(0.8);
      }
    } else {
      gsap.killTweensOf(mesh.material);
      setEmissive(0.2);
    }
  }

  /** Redimensiona el renderer al cambiar el tamaño de la ventana */
  _onWindowResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    if (width === 0 || height === 0) return;

    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Actualizar cámara ortográfica con mejor ajuste
    const aspectRatio = width / height;
    const viewSize = 10; // Reducido para mejor vista
    const halfHeight = viewSize / 2;
    const halfWidth = halfHeight * aspectRatio;

    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  /** Loop de animación */
  _animate() {
    requestAnimationFrame(() => this._animate());

    // Animar power-ups girando
    if (this.entities.powerup) {
      Object.values(this.entities.powerup).forEach(mesh => {
        if (mesh) mesh.rotation.y += 0.05;
      });
    }

    this.renderer.render(this.scene, this.camera);
  }

  /** Limpia recursos */
  dispose() {
    this.renderer.dispose();
  }
}
