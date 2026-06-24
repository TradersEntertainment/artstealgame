/* ============================================================
   3D VIRTUAL GALLERY — Fırça İzleri
   Three.js Museum Walk-Through
   ============================================================ */
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// ─── Config ────────────────────────────────────────
const ROOM = { width: 70, height: 7, depth: 70 };
const WALL_COLOR = 0xf5f0e8;
const FLOOR_COLOR = 0x3d2b1f;
const CEILING_COLOR = 0xe8e0d0;
const FRAME_COLOR = 0x2c1a0a;
const PAINTING_HEIGHT = 1.8;
const WALK_SPEED = 5;
const EYE_HEIGHT = 1.65;
const MAX_SPOTLIGHTS = 50; // Every painting gets a spotlight

const WEAPONS = {
  pistol: {
    name: "Tabanca",
    ammoMax: 15,
    damage: 25,
    headshotDamage: 50,
    recoil: 0.04,
    fireRate: 350,
    reloadTime: 1200,
    automatic: false,
    pellets: 1,
    soundFreq: 220,
    soundType: 'sawtooth'
  },
  rifle: {
    name: "Piyade Tüfeği",
    ammoMax: 30,
    damage: 18,
    headshotDamage: 38,
    recoil: 0.02,
    fireRate: 120,
    reloadTime: 1800,
    automatic: true,
    pellets: 1,
    soundFreq: 180,
    soundType: 'sawtooth'
  },
  shotgun: {
    name: "Pompalı Tüfek",
    ammoMax: 6,
    damage: 12,
    headshotDamage: 22,
    recoil: 0.12,
    fireRate: 800,
    reloadTime: 2200,
    automatic: false,
    pellets: 5,
    spread: 0.08,
    soundFreq: 120,
    soundType: 'triangle'
  },
  sniper: {
    name: "Keskin Nişancı",
    ammoMax: 5,
    damage: 80,
    headshotDamage: 150,
    recoil: 0.20,
    fireRate: 1500,
    reloadTime: 2500,
    automatic: false,
    pellets: 1,
    soundFreq: 90,
    soundType: 'sawtooth'
  }
};

// ─── Audio System ──────────────────────────────────
let audioListener = null;

const AudioSynth = {
  ctx: null,
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },
  playShot(weaponType) {
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    
    // Noise buffer for gun blast texture
    const bufferSize = ctx.sampleRate * 0.15; // short sharp blast
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1000, now);
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    // Core tone oscillator
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    
    osc.type = WEAPONS[weaponType]?.soundType || 'sawtooth';
    const startFreq = WEAPONS[weaponType]?.soundFreq || 150;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
    
    oscGain.gain.setValueAtTime(0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
    
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    
    noise.start(now);
    osc.start(now);
    
    noise.stop(now + 0.16);
    osc.stop(now + 0.16);
  },
  playReload() {
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    
    this.playClick(now, 700, 0.08);
    this.playClick(now + 0.3, 500, 0.08);
    this.playClick(now + 0.6, 900, 0.12);
  },
  playClick(time, freq, duration) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + duration);
    
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  },
  playHitmarker() {
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  },
  playAlarm() {
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.2);
    osc.frequency.linearRampToValueAtTime(500, now + 0.4);
    
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  },
  playDeposit() {
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gain.gain.setValueAtTime(0.12, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.25);
    });
  },
  playPickup() {
    this.init();
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(1000, now + 0.2);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }
};

let bgmInterval = null;
function startBGMBeat() {
  AudioSynth.init();
  if (bgmInterval) return;
  
  let beatCount = 0;
  bgmInterval = setInterval(() => {
    const ctx = AudioSynth.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    const pitches = [55, 55, 65, 55, 55, 55, 48, 55]; // Tense spy bassline
    const pitch = pitches[beatCount % pitches.length];
    
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(15, now + 0.25);
    
    gain.gain.setValueAtTime(isCarrying ? 0.3 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
    
    beatCount++;
  }, 500); // 120 BPM
}

function initAudio() {
  if (audioListener) return;
  audioListener = new THREE.AudioListener();
  camera.add(audioListener);
  
  AudioSynth.init();
  startBGMBeat();
}

function playFootstep() {
  AudioSynth.init();
  const ctx = AudioSynth.ctx;
  if (!ctx || ctx.state !== 'running') return;
  
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(5, t + 0.08);
  
  gain.gain.setValueAtTime(0.06, t);
  gain.gain.exponentialRampToValueAtTime(0.005, t + 0.08);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(t);
  osc.stop(t + 0.08);
}
// ─── State ─────────────────────────────────────────
let camera, scene, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const clock = new THREE.Clock();
let bobTime = 0; // For head bobbing effect
const paintingMeshes = [];
let artworks = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);

let baseArrow = null;
const baseVisualMeshes = [];

// New State Variables for Heist FPS
let myWeapon = 'pistol';
let myTeam = 0;
let teamScores = [0, 0, 0, 0];
let lastFireTime = 0;
let isMouseDown = false;
let isScopeOpen = false;
const defaultFov = 65;
let dashCooldown = 0; // in seconds
let dashTime = 0; // active dash duration
const dashDirection = new THREE.Vector3();
const activePowerUps = [];
const lasers = [];
let aiGuardMesh = null;
const aiGuardPos = new THREE.Vector3();
let particleTrails = [];
const TEAM_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
let gunGroup = null;
let speedBoostTime = 0;
let WALK_SPEED_MULTIPLIER = 1.0;

// ─── Mobile Detection ──────────────────────────────
const isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1);
let mobileActive = false;

// Touch look state
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
let touchLookId = null;
let touchLookPrev = { x: 0, y: 0 };
const LOOK_SENSITIVITY = 0.004;

// Joystick state
let joystickActive = false;
let joystickInput = { x: 0, y: 0 };

// ─── DOM ───────────────────────────────────────────
const loadingScreen = document.getElementById('loading-screen');
const loadingFill = document.getElementById('loading-fill');
const loadingText = document.getElementById('loading-text');
const startOverlay = document.getElementById('start-overlay');
const hud = document.getElementById('hud');
const crosshair = document.getElementById('crosshair');
const panel = document.getElementById('artwork-panel');
const backdrop = document.getElementById('artwork-backdrop');
const joystickZone = document.getElementById('joystick-zone');
const joystickKnob = document.getElementById('joystick-knob');
const joystickBase = document.getElementById('joystick-base');
const mobileHint = document.getElementById('mobile-hint');

// ─── Room Size Calculator ──────────────────────────
let mainArtworks = [];
let specialArtworks = [];

// ─── Init ──────────────────────────────────────────
let sharedPlayerModel = null;
let playerAnimations = null;

function loadPlayerModel() {
  const loader = new GLTFLoader();
  loader.load('assets/Robot.glb', (gltf) => {
    sharedPlayerModel = gltf.scene;
    playerAnimations = gltf.animations;
    
    // Optimize shadows and material
    sharedPlayerModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    // Scale Robot up as needed
    sharedPlayerModel.scale.set(0.4, 0.4, 0.4);
  });
}

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  myTeam = parseInt(urlParams.get('team') || '0');
  myWeapon = urlParams.get('weapon') || 'pistol';
  ammo = WEAPONS[myWeapon].ammoMax;
  document.getElementById('ammo-current').textContent = ammo;
  const ammoContainer = document.getElementById('ammo-container');
  if (ammoContainer) {
    ammoContainer.innerHTML = `<span id="ammo-current">${ammo}</span> / ${ammo}`;
  }

  try {
    const res = await fetch('/api/artworks');
    const allArtworks = await res.json();
    mainArtworks = allArtworks.filter(a => (a.exhibition || '2025-2026') === '2025-2026');
    specialArtworks = allArtworks.filter(a => a.exhibition === 'ozel-koleksiyon');
    artworks = allArtworks;
  } catch {
    artworks = []; mainArtworks = []; specialArtworks = [];
  }

  loadPlayerModel();

  updateLoading(10, 'Sahne oluşturuluyor…');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);
  scene.fog = new THREE.FogExp2(0x050505, 0.035);

  // Camera
  camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
  
  // Flashlight
  const flashlight = new THREE.SpotLight(0xffffff, 3.0, 50, Math.PI / 7, 0.5, 1.5);
  flashlight.position.set(0, 0, 0);
  flashlight.target.position.set(0, 0, -1);
  camera.add(flashlight);
  camera.add(flashlight.target);
  
  // Custom Gun Model based on weapon type selection
  createGunModel(myWeapon);
  
  scene.add(camera);
  
  // Default camera position before we receive spawn base from server
  camera.position.set(0, EYE_HEIGHT, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  document.body.appendChild(renderer.domElement);

  updateLoading(20, 'Işıklar yerleştiriliyor…');
  controls = new PointerLockControls(camera, document.body);
  createLights();

  updateLoading(30, 'Müze inşa ediliyor…');
  createArena();
  createSkybox();
  createDust();

  updateLoading(50, 'Eserler asılıyor…');
  const allArtworks = [...mainArtworks, ...specialArtworks];
  await createPaintings(allArtworks);

  updateLoading(90, 'Son rötuşlar…');
  createDecorations();
  createPowerUps();
  createLasers();

  updateLoading(100, 'Hazır!');

  // Events
  setupEvents();

  // Hide loading, show start
  setTimeout(() => {
    loadingScreen.classList.add('fade-out');
    startOverlay.classList.remove('hidden');
    if (isMobile) {
      document.getElementById('start-click-text').textContent = 'Dokunarak başlayın';
    }
    setTimeout(() => loadingScreen.style.display = 'none', 600);
  }, 500);

  // Start render loop
  animate();
}

function updateLoading(pct, text) {
  loadingFill.style.width = pct + '%';
  loadingText.textContent = text;
}

function createLights() {
  // Ambient — darker for heist
  scene.add(new THREE.AmbientLight(0x101520, 0.02));

  // Ceiling lights spread (dim red/orange)
  const lightsX = 3;
  const lightsZ = 3;
  
  for (let ix = 0; ix < lightsX; ix++) {
    for (let iz = 0; iz < lightsZ; iz++) {
      const px = (ix / (lightsX - 1) - 0.5) * (ROOM.width * 0.7);
      const pz = (iz / (lightsZ - 1) - 0.5) * (ROOM.depth * 0.7);
      const light = new THREE.PointLight(0xff5533, 0.08, ROOM.depth);
      light.position.set(px, ROOM.height - 0.5, pz);
      scene.add(light);
    }
  }
}

function addPaintingSpotlight(x, y, z, rotY) {
  // Spawn a dim point light in front of the painting
  const dirX = Math.sin(rotY);
  const dirZ = Math.cos(rotY);
  const light = new THREE.PointLight(0xfff5e6, 0.15, 6);
  light.position.set(x + dirX * 1.5, y + 0.5, z + dirZ * 1.5);
  scene.add(light);
}

// ─── Minecraft Glass Texture Generator ─────────────
function createMinecraftGlassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');

  // Semi-transparent base
  ctx.fillStyle = 'rgba(180, 220, 255, 0.15)';
  ctx.fillRect(0, 0, 16, 16);

  // Borders (light cyan)
  ctx.fillStyle = 'rgba(210, 240, 255, 0.7)';
  ctx.fillRect(0, 0, 16, 1); // top
  ctx.fillRect(0, 15, 16, 1); // bottom
  ctx.fillRect(0, 0, 1, 16); // left
  ctx.fillRect(15, 0, 1, 16); // right

  // Diagonal streaks (classic Minecraft glass look)
  ctx.fillStyle = 'rgba(230, 250, 255, 0.6)';
  // Main streak
  for(let i=0; i<4; i++) ctx.fillRect(2+i, 4+i, 2, 2);
  for(let i=0; i<3; i++) ctx.fillRect(9+i, 11+i, 2, 2);
  // Minor streak
  ctx.fillRect(11, 3, 2, 2);
  ctx.fillRect(13, 5, 2, 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter; // Sharp pixel edges!
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ─── Arena ──────────────────────────────────────────
function createArena() {
  // Floor (Reflective Marble Effect)
  const floorGeo = new THREE.PlaneGeometry(ROOM.width, ROOM.depth);
  const floorReflector = new Reflector(floorGeo, {
    clipBias: 0.003,
    textureWidth: window.innerWidth > 800 ? 1024 : 512,
    textureHeight: window.innerHeight > 800 ? 1024 : 512,
    color: 0x889999,
  });
  floorReflector.rotation.x = -Math.PI / 2;
  floorReflector.position.set(0, 0, 0);
  scene.add(floorReflector);

  const floorMat = new THREE.MeshStandardMaterial({
    color: FLOOR_COLOR, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.01, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  // Ceiling with Skylight
  const ceilMat = new THREE.MeshStandardMaterial({ color: CEILING_COLOR, roughness: 0.9 });
  const holeWidth = ROOM.width * 0.45;
  const holeDepth = ROOM.depth * 0.45;
  const ceilZLen = (ROOM.depth - holeDepth) / 2;

  const ceil1 = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ceilZLen), ceilMat);
  ceil1.rotation.x = Math.PI / 2; ceil1.position.set(0, ROOM.height, -ROOM.depth/2 + ceilZLen/2); scene.add(ceil1);

  const ceil2 = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ceilZLen), ceilMat);
  ceil2.rotation.x = Math.PI / 2; ceil2.position.set(0, ROOM.height, ROOM.depth/2 - ceilZLen/2); scene.add(ceil2);

  const ceilXLen = (ROOM.width - holeWidth) / 2;
  const ceil3 = new THREE.Mesh(new THREE.PlaneGeometry(ceilXLen, holeDepth), ceilMat);
  ceil3.rotation.x = Math.PI / 2; ceil3.position.set(-ROOM.width/2 + ceilXLen/2, ROOM.height, 0); scene.add(ceil3);

  const ceil4 = new THREE.Mesh(new THREE.PlaneGeometry(ceilXLen, holeDepth), ceilMat);
  ceil4.rotation.x = Math.PI / 2; ceil4.position.set(ROOM.width/2 - ceilXLen/2, ROOM.height, 0); scene.add(ceil4);

  // Skylight Glass
  const mcGlassTex = createMinecraftGlassTexture();
  mcGlassTex.repeat.set(Math.ceil(holeWidth / 1.5), Math.ceil(holeDepth / 1.5));
  const glassGeo = new THREE.PlaneGeometry(holeWidth, holeDepth);
  const glassMat = new THREE.MeshBasicMaterial({ map: mcGlassTex, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
  const glassPane = new THREE.Mesh(glassGeo, glassMat);
  glassPane.rotation.x = Math.PI / 2; glassPane.position.set(0, ROOM.height, 0); scene.add(glassPane);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.85 });
  const skirtMat = new THREE.MeshStandardMaterial({ color: 0x2c2420, roughness: 0.6 });
  const skirtH = 0.12;

  // Left wall
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.depth, ROOM.height), wallMat);
  leftWall.position.set(-ROOM.width / 2, ROOM.height / 2, 0);
  leftWall.rotation.y = Math.PI / 2; scene.add(leftWall);
  const ls = new THREE.Mesh(new THREE.BoxGeometry(0.02, skirtH, ROOM.depth), skirtMat);
  ls.position.set(-ROOM.width / 2 + 0.01, skirtH / 2, 0); scene.add(ls);

  // Right wall
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.depth, ROOM.height), wallMat);
  rightWall.position.set(ROOM.width / 2, ROOM.height / 2, 0);
  rightWall.rotation.y = -Math.PI / 2; scene.add(rightWall);
  const rs = new THREE.Mesh(new THREE.BoxGeometry(0.02, skirtH, ROOM.depth), skirtMat);
  rs.position.set(ROOM.width / 2 - 0.01, skirtH / 2, 0); scene.add(rs);

  // Back wall
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.height), wallMat);
  backWall.position.set(0, ROOM.height / 2, -ROOM.depth / 2); scene.add(backWall);

  // Front wall
  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.height), wallMat);
  frontWall.position.set(0, ROOM.height / 2, ROOM.depth / 2);
  frontWall.rotation.y = Math.PI; scene.add(frontWall);

  // Central Exhibit Partitions
  const partitions = [
    { x: 0, z: -12, rotY: 0 },
    { x: 0, z: 12, rotY: 0 },
    { x: -12, z: 0, rotY: Math.PI / 2 },
    { x: 12, z: 0, rotY: Math.PI / 2 }
  ];
  
  const partitionMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.8 });
  const partitionBaseMat = new THREE.MeshStandardMaterial({ color: 0x2c2420, roughness: 0.6 });
  const partitionGeo = new THREE.BoxGeometry(8, 3.5, 0.4);
  
  partitions.forEach((p) => {
    const wall = new THREE.Mesh(partitionGeo, partitionMat);
    wall.position.set(p.x, 1.75, p.z);
    wall.rotation.y = p.rotY;
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.1, 0.5), partitionBaseMat);
    baseMesh.position.set(0, -1.7, 0);
    wall.add(baseMesh);
  });

  // Atrium Columns (8 majestic pillars)
  const columnMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 0.2 });
  const columnGeo = new THREE.BoxGeometry(1.5, ROOM.height, 1.5);
  
  const columnPositions = [
    { x: -18, z: -18 }, { x: 18, z: -18 },
    { x: -18, z: 18 }, { x: 18, z: 18 },
    { x: -18, z: 0 }, { x: 18, z: 0 },
    { x: 0, z: -18 }, { x: 0, z: 18 }
  ];
  
  columnPositions.forEach((pos) => {
    const col = new THREE.Mesh(columnGeo, columnMat);
    col.position.set(pos.x, ROOM.height / 2, pos.z);
    col.castShadow = true;
    col.receiveShadow = true;
    scene.add(col);
  });
}

function createSkybox() {
  const texLoader = new THREE.TextureLoader();
  const skyWidth = ROOM.width * 3.0;
  const skyDepth = ROOM.depth * 3.0;
  const skyTex = texLoader.load('images/starry_sky_ai.png');
  skyTex.colorSpace = THREE.SRGBColorSpace;
  skyTex.wrapS = THREE.MirroredRepeatWrapping;
  skyTex.wrapT = THREE.MirroredRepeatWrapping;
  skyTex.repeat.set(15, 15);
  
  const skyGeo = new THREE.PlaneGeometry(skyWidth, skyDepth);
  
  const skylightBase = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ map: skyTex, color: 0x444455 }));
  skylightBase.rotation.x = Math.PI / 2; skylightBase.position.set(0, ROOM.height + 3.5, 0); scene.add(skylightBase);

  const skylightGlow = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ map: skyTex, color: 0xffeebb, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.45 }));
  skylightGlow.rotation.x = Math.PI / 2; skylightGlow.position.set(0, ROOM.height + 3.49, 0); scene.add(skylightGlow);
}

// ─── Particles ─────────────────────────────────────
let dustParticles;
function createDust() {
  const particleCount = 100;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(particleCount * 3);
  for(let i=0; i<particleCount; i++) {
    pos[i*3] = (Math.random() - 0.5) * ROOM.width; // x
    pos[i*3+1] = Math.random() * ROOM.height; // y
    pos[i*3+2] = (Math.random() - 0.5) * ROOM.depth; // z
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffeebb,
    size: 0.04,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending
  });
  dustParticles = new THREE.Points(geo, mat);
  scene.add(dustParticles);
}

// ─── Paintings ─────────────────────────────────────
const PAINTING_SLOTS = [
  // Outer Back Wall (Z = -35m, facing Z+)
  { x: -18, y: 1.8, z: -34.85, rotY: 0 },
  { x: 0, y: 1.8, z: -34.85, rotY: 0 },
  { x: 18, y: 1.8, z: -34.85, rotY: 0 },

  // Outer Front Wall (Z = 35m, facing Z-)
  { x: -18, y: 1.8, z: 34.85, rotY: Math.PI },
  { x: 0, y: 1.8, z: 34.85, rotY: Math.PI },
  { x: 18, y: 1.8, z: 34.85, rotY: Math.PI },

  // Outer Left Wall (X = -35m, facing X+)
  { x: -34.85, y: 1.8, z: -18, rotY: Math.PI / 2 },
  { x: -34.85, y: 1.8, z: 0, rotY: Math.PI / 2 },
  { x: -34.85, y: 1.8, z: 18, rotY: Math.PI / 2 },

  // Outer Right Wall (X = 35m, facing X-)
  { x: 34.85, y: 1.8, z: -18, rotY: -Math.PI / 2 },
  { x: 34.85, y: 1.8, z: 0, rotY: -Math.PI / 2 },
  { x: 34.85, y: 1.8, z: 18, rotY: -Math.PI / 2 },

  // Central Partitions
  // Partition North (Z = -12)
  { x: 0, y: 1.8, z: -11.75, rotY: 0 },
  { x: 0, y: 1.8, z: -12.25, rotY: Math.PI },
  // Partition South (Z = 12)
  { x: 0, y: 1.8, z: 12.25, rotY: 0 },
  { x: 0, y: 1.8, z: 11.75, rotY: Math.PI },
  // Partition West (X = -12)
  { x: -11.75, y: 1.8, z: 0, rotY: Math.PI / 2 },
  { x: -12.25, y: 1.8, z: 0, rotY: -Math.PI / 2 },
  // Partition East (X = 12)
  { x: 12.25, y: 1.8, z: 0, rotY: Math.PI / 2 },
  { x: 12.75, y: 1.8, z: 0, rotY: -Math.PI / 2 }
];

async function createPaintings(list) {
  const loader = new THREE.TextureLoader();
  const count = Math.min(list.length, PAINTING_SLOTS.length);
  if (count === 0) return;

  for (let i = 0; i < count; i++) {
    const artwork = list[i];
    const slot = PAINTING_SLOTS[i];
    if (!artwork || !slot) continue;

    await new Promise((resolve) => {
      loader.load(
        artwork.image,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          const aspect = tex.image.width / tex.image.height;
          const pw = PAINTING_HEIGHT * aspect;
          const ph = PAINTING_HEIGHT;

          // Frame
          const framePad = 0.08;
          const frameDepth = 0.04;
          const frameGeo = new THREE.BoxGeometry(pw + framePad * 2, ph + framePad * 2, frameDepth);
          const frameMat = new THREE.MeshStandardMaterial({ color: FRAME_COLOR, roughness: 0.4, metalness: 0.3 });
          const frame = new THREE.Mesh(frameGeo, frameMat);
          frame.castShadow = true;

          // Canvas
          const canvasGeo = new THREE.PlaneGeometry(pw, ph);
          const canvasMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
          const canvasMesh = new THREE.Mesh(canvasGeo, canvasMat);
          canvasMesh.position.z = frameDepth / 2 + 0.001;

          const group = new THREE.Group();
          group.add(frame);
          group.add(canvasMesh);

          // Name plate
          createNamePlate(group, artwork, pw);

          group.position.set(slot.x, slot.y + 0.2, slot.z);
          group.rotation.y = slot.rotY;

          scene.add(group);

          addPaintingSpotlight(slot.x, slot.y, slot.z, slot.rotY);

          // Store for raycasting
          canvasMesh.userData = { artworkId: artwork.id, artwork };
          paintingMeshes.push(canvasMesh);

          updateLoading(50 + Math.round(40 * (i + 1) / count), `Eser asılıyor: ${i + 1}/${count}`);
          resolve();
        },
        undefined,
        () => resolve()
      );
    });
  }
}

function createNamePlate(group, artwork, paintingWidth) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 80;

  ctx.fillStyle = '#1a1815';
  ctx.fillRect(0, 0, 512, 80);
  ctx.fillStyle = '#c9a96e';
  ctx.fillRect(0, 0, 512, 2);

  ctx.fillStyle = '#f5f0e8';
  ctx.font = 'bold 22px serif';
  ctx.textAlign = 'center';
  ctx.fillText(artwork.title, 256, 32);

  ctx.fillStyle = '#a09080';
  ctx.font = 'italic 16px serif';
  ctx.fillText(`${artwork.artist} · ${artwork.grade}`, 256, 58);

  const tex = new THREE.CanvasTexture(canvas);
  const plateGeo = new THREE.PlaneGeometry(paintingWidth * 0.7, paintingWidth * 0.7 * (80 / 512));
  const plateMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.y = -(PAINTING_HEIGHT / 2 + 0.18);
  plate.position.z = 0.025;
  group.add(plate);
}

// ─── Decorations ───────────────────────────────────
function createDecorations() {
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x2c2420, roughness: 0.6, metalness: 0.1 });
  const benchGeo = new THREE.BoxGeometry(2, 0.45, 0.6);

  const benchCoords = [
    { x: 0, z: 0, rotY: 0 },
    { x: -12, z: -12, rotY: Math.PI / 4 },
    { x: 12, z: 12, rotY: Math.PI / 4 },
    { x: -12, z: 12, rotY: -Math.PI / 4 },
    { x: 12, z: -12, rotY: -Math.PI / 4 }
  ];

  benchCoords.forEach((bc) => {
    const bench = new THREE.Mesh(benchGeo, benchMat);
    bench.position.set(bc.x, 0.225, bc.z);
    bench.rotation.y = bc.rotY;
    bench.castShadow = true;
    bench.receiveShadow = true;
    scene.add(bench);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.06, 0.45, 0.06);
    [[-0.9, -0.25], [-0.9, 0.25], [0.9, -0.25], [0.9, 0.25]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, benchMat);
      leg.position.set(lx, 0.225, lz);
      bench.add(leg);
    });
  });
}

// ─── Events ────────────────────────────────────────
function setupEvents() {
  if (isMobile) {
    setupMobileEvents();
  } else {
    setupDesktopEvents();
  }

  // Close panel (shared)
  const closeBtn = document.getElementById('panel-close');
  const handleClose = (e) => {
    if (e.type === 'touchstart') e.preventDefault();
    panel.classList.remove('open');
    backdrop.classList.remove('open');
    if (isMobile) {
      mobileActive = true;
      joystickZone.style.display = 'block';
      mobileHint.style.display = 'block';
    } else {
      controls.lock();
    }
  };
  closeBtn.addEventListener('click', handleClose);
  closeBtn.addEventListener('touchstart', handleClose, { passive: false });
  backdrop.addEventListener('click', handleClose);

  // Resize (shared)
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ─── Desktop Events ────────────────────────────────
function setupDesktopEvents() {
  startOverlay.addEventListener('click', (e) => {
    if (e.target.tagName.toLowerCase() === 'input') return;
    initAudio();
    if (window.fsflTrackAction) window.fsflTrackAction('Sanal Tura Başladı (Masaüstü)');
    controls.lock();
  });

  controls.addEventListener('lock', () => {
    startOverlay.classList.add('hidden');
    hud.style.display = '';
    crosshair.style.display = '';
    const hc = document.getElementById('health-bar-container');
    const sb = document.getElementById('scoreboard');
    const am = document.getElementById('ammo-container');
    if (hc) hc.style.display = 'block';
    if (sb) sb.style.display = 'block';
    if (am) am.style.display = 'block';
  });

  controls.addEventListener('unlock', () => {
    if (!panel.classList.contains('open') && (typeof isDead === 'undefined' || !isDead)) {
      startOverlay.classList.remove('hidden');
    }
    hud.style.display = 'none';
    crosshair.style.display = 'none';
    const hc = document.getElementById('health-bar-container');
    const sb = document.getElementById('scoreboard');
    const am = document.getElementById('ammo-container');
    if (hc) hc.style.display = 'none';
    if (sb) sb.style.display = 'none';
    if (am) am.style.display = 'none';
  });

  document.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': moveForward = true; break;
      case 'KeyS': case 'ArrowDown': moveBackward = true; break;
      case 'KeyA': case 'ArrowLeft': moveLeft = true; break;
      case 'KeyD': case 'ArrowRight': moveRight = true; break;
    }
  });

  document.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': moveForward = false; break;
      case 'KeyS': case 'ArrowDown': moveBackward = false; break;
      case 'KeyA': case 'ArrowLeft': moveLeft = false; break;
      case 'KeyD': case 'ArrowRight': moveRight = false; break;
    }
  });

  // PC click: Use document-level 'click' which fires reliably under PointerLock
  document.addEventListener('click', (e) => {
    if (!controls.isLocked) return;
    
    // When pointer is locked, the center of the screen (0,0) is always the target
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(paintingMeshes);
    if (intersects.length > 0 && intersects[0].distance < 15) {
      const artwork = intersects[0].object.userData.artwork;
      if (artwork) showArtworkPanel(artwork);
    }
  });
}

// ─── Mobile Events ─────────────────────────────────
function setupMobileEvents() {
  // Start touch
  startOverlay.addEventListener('touchstart', (e) => {
    if (e.target.tagName.toLowerCase() === 'input') return;
    e.preventDefault();
    initAudio();
    if (window.fsflTrackAction) window.fsflTrackAction('Sanal Tura Başladı (Mobil)');
    startOverlay.classList.add('hidden');
    mobileActive = true;
    joystickZone.style.display = 'block';
    mobileHint.style.display = 'block';
    euler.setFromQuaternion(camera.quaternion);
  });

  // Joystick
  let joystickTouchId = null;
  const joystickRect = () => joystickBase.getBoundingClientRect();
  const joystickRadius = 60;
  const knobMax = 38;

  joystickBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const t = e.changedTouches[0];
    joystickTouchId = t.identifier;
    joystickActive = true;
    joystickKnob.classList.add('active');
    updateJoystick(t);
  });

  joystickBase.addEventListener('touchmove', (e) => {
    e.preventDefault();
    e.stopPropagation();
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId) {
        updateJoystick(t);
        break;
      }
    }
  });

  const resetJoystick = () => {
    joystickTouchId = null;
    joystickActive = false;
    joystickInput = { x: 0, y: 0 };
    joystickKnob.style.transform = 'translate(-50%, -50%)';
    joystickKnob.classList.remove('active');
  };

  joystickBase.addEventListener('touchend', resetJoystick);
  joystickBase.addEventListener('touchcancel', resetJoystick);

  function updateJoystick(touch) {
    const rect = joystickRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > knobMax) {
      dx = (dx / dist) * knobMax;
      dy = (dy / dist) * knobMax;
    }
    joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joystickInput = { x: dx / knobMax, y: dy / knobMax };
  }

  // Touch look (right half of screen, i.e. not joystick)
  renderer.domElement.style.touchAction = 'none'; // Prevent native browser actions like pull-to-refresh
  
  renderer.domElement.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!mobileActive) return;
    for (const t of e.changedTouches) {
      // Ignore touches on joystick area
      if (t.clientX < 180 && t.clientY > window.innerHeight - 180) continue;
      if (touchLookId === null) {
        touchLookId = t.identifier;
        touchLookPrev = { x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: false });

  renderer.domElement.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!mobileActive || touchLookId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier === touchLookId) {
        const dx = t.clientX - touchLookPrev.x;
        const dy = t.clientY - touchLookPrev.y;
        euler.y -= dx * LOOK_SENSITIVITY;
        euler.x -= dy * LOOK_SENSITIVITY;
        euler.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, euler.x));
        camera.quaternion.setFromEuler(euler);
        touchLookPrev = { x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: false });

  const releaseLook = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === touchLookId) {
        touchLookId = null;
      }
    }
  };
  renderer.domElement.addEventListener('touchend', releaseLook, { passive: true });
  renderer.domElement.addEventListener('touchcancel', releaseLook, { passive: true });

  // Tap to inspect painting (short tap detection)
  let tapStart = 0;
  let tapPos = { x: 0, y: 0 };
  renderer.domElement.addEventListener('touchstart', (e) => {
    tapStart = Date.now();
    tapPos = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }, { passive: true });

  renderer.domElement.addEventListener('touchend', (e) => {
    if (!mobileActive) return;
    const elapsed = Date.now() - tapStart;
    const t = e.changedTouches[0];
    const moved = Math.abs(t.clientX - tapPos.x) + Math.abs(t.clientY - tapPos.y);
    if (elapsed < 300 && moved < 20) {
      // Short tap — check painting hit
      const nx = (t.clientX / window.innerWidth) * 2 - 1;
      const ny = -(t.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const intersects = raycaster.intersectObjects(paintingMeshes);
      if (intersects.length > 0 && intersects[0].distance < 15) {
        const artwork = intersects[0].object.userData.artwork;
        if (artwork) {
          mobileActive = false;
          joystickZone.style.display = 'none';
          mobileHint.style.display = 'none';
          showArtworkPanel(artwork);
        }
      }
    }
  }, { passive: true });
}

let currentSlide = 0;
let totalSlides = 0;

function showArtworkPanel(artwork) {
  if (!isMobile) controls.unlock();
  
  if (window.fsflTrackAction) window.fsflTrackAction('Eser İnceledi: ' + artwork.title);
  
  document.getElementById('panel-overline').textContent = artwork.techniqueLabel || '';
  document.getElementById('panel-title').textContent = artwork.title;
  document.getElementById('panel-artist').textContent = `${artwork.artist} · ${artwork.grade}`;
  document.getElementById('panel-technique').textContent = artwork.techniqueLabel || '';
  document.getElementById('panel-dimensions').textContent = artwork.dimensions || '';
  document.getElementById('panel-desc').textContent = artwork.description || '';
  
  // Setup Carousel
  const track = document.getElementById('carousel-track');
  const dotsContainer = document.getElementById('carousel-dots');
  
  // Gather images
  const images = [];
  if (artwork.image) images.push(artwork.image);
  if (artwork.image2) images.push(artwork.image2);
  if (artwork.image3) images.push(artwork.image3);
  
  totalSlides = images.length;
  currentSlide = 0;
  currentPanelImages = images;
  
  track.innerHTML = images.map(src => `<div class="carousel-slide"><img src="${src}" alt="" /></div>`).join('');
  
  if (totalSlides > 1) {
    dotsContainer.innerHTML = images.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}"></div>`).join('');
    dotsContainer.style.display = 'flex';
  } else {
    dotsContainer.style.display = 'none';
  }
  
  updateCarousel();
  
  // Reset sheet visibility
  document.getElementById('panel-content').classList.remove('hidden');
  
  // Show hint briefly
  const hint = document.getElementById('carousel-hint');
  if (hint) {
    hint.style.opacity = '1';
    setTimeout(() => { hint.style.opacity = '0'; }, 3000);
  }
  
  panel.classList.add('open');
  backdrop.classList.add('open');
}

function updateCarousel() {
  const track = document.getElementById('carousel-track');
  track.style.transform = `translateX(-${currentSlide * 100}%)`;
  
  const dots = document.querySelectorAll('.dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentSlide);
  });
}

// Carousel Interactions (Swipe & Click)
const carouselContainer = document.getElementById('carousel-container');
let swipeStartX = 0;
let swipeCurrentX = 0;
let isSwiping = false;

carouselContainer.addEventListener('touchstart', (e) => {
  swipeStartX = e.touches[0].clientX;
  isSwiping = true;
});

carouselContainer.addEventListener('touchmove', (e) => {
  if (!isSwiping) return;
  swipeCurrentX = e.touches[0].clientX;
});

carouselContainer.addEventListener('touchend', (e) => {
  if (!isSwiping) return;
  isSwiping = false;
  const diffX = swipeStartX - (swipeCurrentX || swipeStartX);
  
  if (Math.abs(diffX) > 50) {
    // Swipe
    if (diffX > 0 && currentSlide < totalSlides - 1) {
      currentSlide++; // swipe left
    } else if (diffX < 0 && currentSlide > 0) {
      currentSlide--; // swipe right
    }
    updateCarousel();
  } else if (Math.abs(diffX) < 10) {
    // Tap -> toggle bottom sheet
    document.getElementById('panel-content').classList.toggle('hidden');
  }
  swipeCurrentX = 0;
});

carouselContainer.addEventListener('mousedown', (e) => {
  swipeStartX = e.clientX;
  isSwiping = true;
});

carouselContainer.addEventListener('mousemove', (e) => {
  if (!isSwiping) return;
  swipeCurrentX = e.clientX;
});

carouselContainer.addEventListener('mouseup', (e) => {
  if (!isSwiping) return;
  isSwiping = false;
  const diffX = swipeStartX - (swipeCurrentX || swipeStartX);
  
  if (Math.abs(diffX) > 50) {
    if (diffX > 0 && currentSlide < totalSlides - 1) {
      currentSlide++;
    } else if (diffX < 0 && currentSlide > 0) {
      currentSlide--;
    }
    updateCarousel();
  } else if (Math.abs(diffX) < 10) {
    document.getElementById('panel-content').classList.toggle('hidden');
  }
  swipeCurrentX = 0;
});


// ─── Fullscreen Lightbox ───────────────────────────
const fullscreenLightbox = document.getElementById('fullscreen-lightbox');
const fullscreenImg = document.getElementById('fullscreen-img');
const fullscreenCloseBtn = document.getElementById('fullscreen-close');
const fullscreenBtn = document.getElementById('fullscreen-btn');
let currentPanelImages = [];

function openFullscreen() {
  if (currentPanelImages.length === 0) return;
  const src = currentPanelImages[currentSlide] || currentPanelImages[0];
  fullscreenImg.src = src;
  fullscreenLightbox.classList.add('open');
}

function closeFullscreen() {
  fullscreenLightbox.classList.remove('open');
}

if (fullscreenBtn) {
  fullscreenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openFullscreen();
  });
}

fullscreenCloseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  closeFullscreen();
});

fullscreenLightbox.addEventListener('click', (e) => {
  if (e.target === fullscreenLightbox || e.target === fullscreenImg) {
    closeFullscreen();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && fullscreenLightbox.classList.contains('open')) {
    closeFullscreen();
  }
});


// ─── Animation Loop ────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const isActive = isMobile ? mobileActive : controls.isLocked;

  if (isActive) {
    const damping = 8;
    velocity.x -= velocity.x * damping * delta;
    velocity.z -= velocity.z * damping * delta;

    if (isMobile && joystickActive) {
      // Joystick input → direction relative to camera facing
      velocity.z += joystickInput.y * WALK_SPEED * delta * 10;
      velocity.x += joystickInput.x * WALK_SPEED * delta * 10;

      // Move in camera direction
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

      camera.position.addScaledVector(forward, -velocity.z * delta);
      camera.position.addScaledVector(right, velocity.x * delta);
    } else if (!isMobile) {
      direction.z = Number(moveForward) - Number(moveBackward);
      direction.x = Number(moveRight) - Number(moveLeft);
      direction.normalize();
      
      const currentSpeed = (isSprinting && moveForward ? WALK_SPEED * 1.6 : WALK_SPEED) * WALK_SPEED_MULTIPLIER * (isCarrying ? 0.85 : 1.0);

      if (moveForward || moveBackward) velocity.z -= direction.z * currentSpeed * delta * 10;
      if (moveLeft || moveRight) velocity.x -= direction.x * currentSpeed * delta * 10;

      controls.moveRight(-velocity.x * delta);
      controls.moveForward(-velocity.z * delta);
    }

    // Clamp to room bounds
    const margin = 1.2;
    camera.position.x = Math.max(-ROOM.width / 2 + margin, Math.min(ROOM.width / 2 - margin, camera.position.x));
    camera.position.z = Math.max(-ROOM.depth / 2 + margin, Math.min(ROOM.depth / 2 - margin, camera.position.z));
    
    // Dash updates
    if (dashTime > 0) {
      dashTime -= delta;
      const dashSpeed = 25;
      camera.position.addScaledVector(dashDirection, dashSpeed * delta);
      if (dashTime <= 0) {
        dashTime = 0;
        camera.fov = isScopeOpen ? 20 : defaultFov;
        camera.updateProjectionMatrix();
      }
    }
    
    if (dashCooldown > 0) {
      dashCooldown -= delta;
      const fill = document.getElementById('dash-cooldown-fill');
      if (fill) {
        fill.style.width = Math.max(0, 100 - (dashCooldown / 3.0) * 100) + '%';
      }
    }

    // Speed boost timer
    if (speedBoostTime > 0) {
      speedBoostTime -= delta;
      if (speedBoostTime <= 0) {
        speedBoostTime = 0;
        WALK_SPEED_MULTIPLIER = 1.0;
      }
    }

    // Smooth return of gun position after recoil
    if (gunGroup) {
      gunGroup.position.z += (-0.45 - gunGroup.position.z) * 0.15;
      gunGroup.position.y += (-0.22 - gunGroup.position.y) * 0.15;
    }

    // Automatic weapon continuous firing
    if (isMouseDown && WEAPONS[myWeapon].automatic && !isReloading && !isDead) {
      fireWeapon();
    }

    // Head Bobbing & Footsteps
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    if (speed > 1.0 && dashTime <= 0) {
      const prevBob = bobTime;
      bobTime += delta * 12; // bob speed
      camera.position.y = EYE_HEIGHT + Math.sin(bobTime) * 0.06; // bob amplitude
      
      if (Math.floor(prevBob / Math.PI) < Math.floor(bobTime / Math.PI)) {
        playFootstep();
      }
    } else {
      // Smoothly return to eye height
      camera.position.y += (EYE_HEIGHT - camera.position.y) * 0.1;
      bobTime = 0;
    }

    // Crosshair highlight when looking at a painting (interactive hint)
    if (!isMobile && crosshair) {
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const hits = raycaster.intersectObjects(paintingMeshes);
      const hint = document.getElementById('interaction-hint');
      if (hits.length > 0 && hits[0].distance < 4) {
        crosshair.style.borderColor = '#ef4444';
        crosshair.style.transform = 'translate(-50%, -50%) scale(1.5)';
        if (hint) {
          hint.innerText = isCarrying ? "Bayrağı Teslim Etmek İçin Üsse Git!" : "Tabloyu Çalmak İçin 'E'ye Bas";
          hint.style.display = 'block';
        }
      } else {
        crosshair.style.borderColor = 'rgba(255,255,255,0.7)';
        crosshair.style.transform = 'translate(-50%, -50%) scale(1)';
        if (hint) hint.style.display = 'none';
      }
    }
    
    // Update base distance text and directional arrow if carrying
    if (isCarrying && bases && myBaseIndex !== undefined) {
      const b = bases[myBaseIndex];
      const dx = camera.position.x - b.x;
      const dz = camera.position.z - b.z;
      const dist = Math.sqrt(dx*dx + dz*dz).toFixed(1);
      const distEl = document.getElementById('base-distance-text');
      if (distEl) distEl.innerText = `Üsse Uzaklık: ${dist}m`;

      // Update 3D Arrow helper
      if (baseArrow) {
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        
        // Float 1.2m in front of camera, slightly below crosshair (0.4m down)
        const arrowPos = new THREE.Vector3()
          .copy(camera.position)
          .addScaledVector(camDir, 1.2);
        arrowPos.y -= 0.4;
        baseArrow.position.copy(arrowPos);
        
        // Point from arrow pos to base pos
        const basePos = new THREE.Vector3(b.x, EYE_HEIGHT - 0.4, b.z);
        const targetDir = new THREE.Vector3().subVectors(basePos, arrowPos).normalize();
        baseArrow.setDirection(targetDir);
      }
    }

    // Send player position to server
    sendPosition();

    // Spawn golden carrier trails
    if (isCarrying && Math.random() < 0.25) {
      createGoldenParticle(camera.position.x, camera.position.y - 0.5, camera.position.z);
      if (socket) {
        socket.emit('spawn-particle', { x: camera.position.x, y: camera.position.y - 0.5, z: camera.position.z });
      }
    }
  }

  // Update particles life
  updateParticles(delta);

  // Update Lasers
  const lTime = clock.getElapsedTime();
  lasers.forEach((l) => {
    const val = l.userData.center + Math.sin(lTime * l.userData.speed) * l.userData.range;
    if (l.userData.axis === 'z') {
      l.position.z = val;
    } else {
      l.position.x = val;
    }
    
    // Check Collision with player
    let d = 999;
    if (l.userData.axis === 'z') {
      if (Math.abs(camera.position.x) < 12.5) {
        d = Math.abs(camera.position.z - l.position.z);
      }
    } else {
      if (Math.abs(camera.position.z) < 12.5) {
        d = Math.abs(camera.position.x - l.position.x);
      }
    }
    
    if (d < 0.7 && !isDead && isActive) {
      const now = Date.now();
      if (!l.userData.lastHurtTime || now - l.userData.lastHurtTime > 1000) {
        l.userData.lastHurtTime = now;
        AudioSynth.playAlarm();
        if (socket) {
          socket.emit('shoot', { targetId: myId, damage: 15 });
        }
      }
    }
  });

  // Rotate power-ups and animate them
  activePowerUps.forEach((pup) => {
    if (!pup.userData.active) return;
    pup.rotation.y += delta * 1.5;
    pup.position.y = pup.userData.basePos.y + Math.sin(clock.getElapsedTime() * 3 + pup.userData.id) * 0.1;
    
    const dist = camera.position.distanceTo(pup.position);
    if (dist < 1.3 && !isDead && isActive) {
      pup.userData.active = false;
      pup.visible = false;
      if (socket) {
        socket.emit('pickup-collected', pup.userData.id);
      }
      AudioSynth.playPickup();
      if (pup.userData.type === 'health') {
        socket.emit('shoot', { targetId: myId, damage: -50 });
      } else {
        speedBoostTime = 8.0;
        WALK_SPEED_MULTIPLIER = 1.5;
      }
    }
  });

  // Render circular mini-map radar
  if (isActive) {
    drawMiniMap();
  }

  if (dustParticles) {
    dustParticles.rotation.y += delta * 0.02;
    const positions = dustParticles.geometry.attributes.position.array;
    for (let i = 1; i < positions.length; i += 3) {
      positions[i] -= delta * 0.1; // Fall down slowly
      if (positions[i] < 0) positions[i] = ROOM.height; // Wrap around
    }
    dustParticles.geometry.attributes.position.needsUpdate = true;
  }

  if (typeof updatePlayers === 'function') updatePlayers(delta);

  renderer.render(scene, camera);
}

// ─── Start ─────────────────────────────────────────
init();

// ─── Multiplayer System ────────────────────────────
const otherPlayers = new Map(); // id → { mesh, nameSprite, targetPos, targetRot }
let socket = null;
let myId = null;
let myColor = '#c9a96e';
let myBaseIndex;
let bases = [];
let lastSendTime = 0;
const SEND_INTERVAL = 30; // ms between position broadcasts

function createBaseVisuals() {
  if (!bases) return;
  baseVisualMeshes.forEach(mesh => scene.remove(mesh));
  baseVisualMeshes.length = 0;
  
  bases.forEach((b, idx) => {
    const isMyBase = (idx === myBaseIndex);
    const color = isMyBase ? 0x4ade80 : 0xef4444; // Green for own base, Red for enemy bases
    
    const baseGroup = new THREE.Group();
    baseGroup.position.set(b.x, 0, b.z);
    
    const padGeo = new THREE.CylinderGeometry(2, 2, 0.1, 32);
    const padMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = 0.05;
    baseGroup.add(pad);
    
    const beamHeight = 15;
    const beamGeo = new THREE.CylinderGeometry(1.8, 1.8, beamHeight, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: isMyBase ? 0.25 : 0.08,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = beamHeight / 2;
    baseGroup.add(beam);
    
    // Add floating title above base
    const baseTitle = createNameSprite(isMyBase ? "ÜSSÜN (TESLİMAT)" : `DÜŞMAN ÜSSÜ (${idx === 0 ? 'Kırmızı' : idx === 1 ? 'Mavi' : idx === 2 ? 'Yeşil' : 'Sarı'})`, isMyBase ? "#4ade80" : "#ef4444");
    baseTitle.position.y = 4.0;
    baseGroup.add(baseTitle);

    scene.add(baseGroup);
    baseVisualMeshes.push(baseGroup);
  });
}

function createBaseArrow() {
  if (baseArrow) return;
  const dir = new THREE.Vector3(0, 0, -1);
  const origin = new THREE.Vector3(0, 0, 0);
  baseArrow = new THREE.ArrowHelper(dir, origin, 1.5, 0x4ade80, 0.4, 0.2);
  scene.add(baseArrow);
}

function removeBaseArrow() {
  if (baseArrow) {
    scene.remove(baseArrow);
    baseArrow = null;
  }
}

// ─── Lasers Creation ───────────────────────────────
function createLasers() {
  const laserMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.8 });
  const laserGeo = new THREE.CylinderGeometry(0.04, 0.04, 25, 8);
  
  // Symmetrical Laser Grid
  // Laser 1: Horizontal at Z = -12, moves along Z
  const l1 = new THREE.Mesh(laserGeo, laserMat);
  l1.rotation.z = Math.PI / 2;
  l1.position.set(0, 1.2, -12);
  l1.userData = { axis: 'z', center: -12, range: 8, speed: 1.8, id: 0 };
  scene.add(l1);
  lasers.push(l1);
  
  // Laser 2: Horizontal at Z = 12, moves along Z
  const l2 = new THREE.Mesh(laserGeo, laserMat);
  l2.rotation.z = Math.PI / 2;
  l2.position.set(0, 1.2, 12);
  l2.userData = { axis: 'z', center: 12, range: 8, speed: 1.8, id: 1 };
  scene.add(l2);
  lasers.push(l2);

  // Laser 3: Horizontal at X = -12, moves along X
  const l3 = new THREE.Mesh(laserGeo, laserMat);
  l3.rotation.x = Math.PI / 2;
  l3.position.set(-12, 1.2, 0);
  l3.userData = { axis: 'x', center: -12, range: 8, speed: 2.2, id: 2 };
  scene.add(l3);
  lasers.push(l3);
  
  // Laser 4: Horizontal at X = 12, moves along X
  const l4 = new THREE.Mesh(laserGeo, laserMat);
  l4.rotation.x = Math.PI / 2;
  l4.position.set(12, 1.2, 0);
  l4.userData = { axis: 'x', center: 12, range: 8, speed: 2.2, id: 3 };
  scene.add(l4);
  lasers.push(l4);
}

// ─── Power-ups Creation ────────────────────────────
function createPowerUps() {
  const hpGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const hpMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3, metalness: 0.8, emissive: 0x10b981, emissiveIntensity: 0.5 });
  
  const spdGeo = new THREE.ConeGeometry(0.3, 0.6, 4);
  const spdMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.8, emissive: 0xf59e0b, emissiveIntensity: 0.5 });
  
  const positions = [
    { x: 0, y: 1, z: -20, type: 'health', geo: hpGeo, mat: hpMat, id: 0 },
    { x: 0, y: 1, z: 20, type: 'health', geo: hpGeo, mat: hpMat, id: 1 },
    { x: -20, y: 1, z: 0, type: 'speed', geo: spdGeo, mat: spdMat, id: 2 },
    { x: 20, y: 1, z: 0, type: 'speed', geo: spdGeo, mat: spdMat, id: 3 }
  ];
  
  positions.forEach((pos) => {
    const mesh = new THREE.Mesh(pos.geo, pos.mat);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.userData = { id: pos.id, type: pos.type, active: true, basePos: new THREE.Vector3(pos.x, pos.y, pos.z) };
    scene.add(mesh);
    activePowerUps.push(mesh);
  });
}

// ─── Particle Effects ──────────────────────────────
function createGoldenParticle(x, y, z) {
  const pGeo = new THREE.SphereGeometry(0.04, 4, 4);
  const pMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.9 });
  const pMesh = new THREE.Mesh(pGeo, pMat);
  pMesh.position.set(x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.4, z + (Math.random() - 0.5) * 0.4);
  scene.add(pMesh);
  particleTrails.push({
    mesh: pMesh,
    life: 1.0, // 1s life
    velY: Math.random() * 0.4 + 0.1
  });
}

function updateParticles(delta) {
  for (let i = particleTrails.length - 1; i >= 0; i--) {
    const p = particleTrails[i];
    p.life -= delta;
    p.mesh.position.y += p.velY * delta;
    p.mesh.material.opacity = p.life;
    
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      particleTrails.splice(i, 1);
    }
  }
}

// ─── Weapon Shooting Mechanics ─────────────────────
function fireWeapon() {
  if (isReloading || isDead) return;
  if (ammo <= 0) {
    AudioSynth.playClick(AudioSynth.ctx.currentTime, 300, 0.08); // click sound
    return;
  }
  
  const now = Date.now();
  const weaponAttrs = WEAPONS[myWeapon];
  if (now - lastFireTime < weaponAttrs.fireRate) return;
  lastFireTime = now;
  
  ammo--;
  document.getElementById('ammo-current').textContent = ammo;
  
  // Sound
  AudioSynth.playShot(myWeapon);
  
  // Recoil kickback on the model
  if (gunGroup) {
    gunGroup.position.z += weaponAttrs.recoil * 1.5;
    gunGroup.position.y += weaponAttrs.recoil * 0.5;
  }
  
  // Camera recoil
  camera.rotation.x += weaponAttrs.recoil;
  setTimeout(() => {
    camera.rotation.x -= weaponAttrs.recoil;
  }, 60);

  const pellets = weaponAttrs.pellets || 1;
  const spread = weaponAttrs.spread || 0;
  
  let hitSuccess = false;
  let isHeadshotHit = false;
  
  const playerMeshes = Array.from(otherPlayers.values()).map(p => p.mesh);
  
  if (aiGuardMesh) {
    playerMeshes.push(aiGuardMesh);
  }
  
  for (let p = 0; p < pellets; p++) {
    const dirOffset = new THREE.Vector2(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread
    );
    
    raycaster.setFromCamera(dirOffset, camera);
    const hits = raycaster.intersectObjects(playerMeshes, true);
    
    if (hits.length > 0 && hits[0].distance < 45) {
      const hitObj = hits[0].object;
      const hitPoint = hits[0].point;
      
      // Check if it's the guard
      let parentObj = hitObj;
      let isGuardHit = false;
      while (parentObj) {
        if (parentObj === aiGuardMesh) {
          isGuardHit = true;
          break;
        }
        parentObj = parentObj.parent;
      }
      
      if (isGuardHit) {
        socket.emit('shoot', { targetId: 'guard', damage: weaponAttrs.damage });
        hitSuccess = true;
      } else {
        // Find which player was hit
        for (const [id, player] of otherPlayers.entries()) {
          let checkObj = hitObj;
          let isPlayerHit = false;
          while (checkObj) {
            if (checkObj === player.mesh) {
              isPlayerHit = true;
              break;
            }
            checkObj = checkObj.parent;
          }
          
          if (isPlayerHit) {
            let isHeadshot = false;
            if (hitPoint.y - player.mesh.position.y > 1.2) {
              isHeadshot = true;
              isHeadshotHit = true;
            }
            const damageVal = isHeadshot ? weaponAttrs.headshotDamage : weaponAttrs.damage;
            socket.emit('shoot', { targetId: id, isHeadshot, damage: damageVal });
            hitSuccess = true;
            break;
          }
        }
      }
    }
    
    // Draw Tracer Line
    const tracerMat = new THREE.LineBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.6 });
    const tracerPoints = [];
    tracerPoints.push(new THREE.Vector3(0.22, -0.22, -0.45)); // Gun tip local coordinates
    tracerPoints.push(new THREE.Vector3(dirOffset.x * 20, dirOffset.y * 20, -50));
    const tracerGeo = new THREE.BufferGeometry().setFromPoints(tracerPoints);
    const tracerLine = new THREE.Line(tracerGeo, tracerMat);
    camera.add(tracerLine);
    setTimeout(() => {
      camera.remove(tracerLine);
      tracerGeo.dispose();
      tracerMat.dispose();
    }, 60);
  }
  
  if (hitSuccess) {
    AudioSynth.playHitmarker();
    const hm = document.getElementById('hit-marker');
    if (hm) {
      hm.style.display = 'block';
      hm.style.color = isHeadshotHit ? '#ef4444' : 'rgba(255,255,255,0.8)';
      hm.innerText = isHeadshotHit ? '☠' : '✕';
      setTimeout(() => hm.style.display = 'none', 100);
    }
  }
}

// ─── Canvas Mini-map Radar Drawing ─────────────────
function drawMiniMap() {
  const mapCanvas = document.getElementById('mini-map');
  if (!mapCanvas) return;
  const ctx = mapCanvas.getContext('2d');
  if (!ctx) return;
  
  ctx.clearRect(0, 0, 130, 130);
  
  const cx = 65;
  const cy = 65;
  const r = 60;
  
  ctx.strokeStyle = '#c9a96e';
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(12, 11, 13, 0.7)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  ctx.strokeStyle = 'rgba(201, 169, 110, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
  ctx.stroke();
  
  const scale = r / 35;
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const yaw = Math.atan2(-camDir.x, -camDir.z); // camera angle
  
  function getRadarPos(x, z) {
    const dx = x - camera.position.x;
    const dz = z - camera.position.z;
    
    // Rotate coordinates based on camera yaw
    const rx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const ry = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    
    return {
      x: cx + rx * scale,
      y: cy + ry * scale
    };
  }
  
  // Draw bases
  if (bases) {
    bases.forEach((b, idx) => {
      const pos = getRadarPos(b.x, b.z);
      const dist = Math.sqrt((pos.x - cx)**2 + (pos.y - cy)**2);
      if (dist < r) {
        ctx.fillStyle = TEAM_COLORS[idx];
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }
  
  // Draw power-ups
  activePowerUps.forEach((pup) => {
    if (!pup.userData.active) return;
    const pos = getRadarPos(pup.position.x, pup.position.z);
    const dist = Math.sqrt((pos.x - cx)**2 + (pos.y - cy)**2);
    if (dist < r) {
      ctx.fillStyle = pup.userData.type === 'health' ? '#10b981' : '#f59e0b';
      ctx.fillRect(pos.x - 2, pos.y - 2, 4, 4);
    }
  });
  
  // Draw AI Guard Drone
  if (aiGuardMesh) {
    const pos = getRadarPos(aiGuardMesh.position.x, aiGuardMesh.position.z);
    const dist = Math.sqrt((pos.x - cx)**2 + (pos.y - cy)**2);
    if (dist < r) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6 + Math.sin(Date.now() * 0.01) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  
  // Draw other players
  otherPlayers.forEach((p, id) => {
    const pos = getRadarPos(p.mesh.position.x, p.mesh.position.z);
    const dist = Math.sqrt((pos.x - cx)**2 + (pos.y - cy)**2);
    if (dist < r) {
      ctx.fillStyle = p.mesh.userData.color || '#fff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  
  // Draw local player in center
  ctx.fillStyle = TEAM_COLORS[myTeam] || '#c9a96e';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 5);
  ctx.lineTo(cx - 4, cy + 4);
  ctx.lineTo(cx + 4, cy + 4);
  ctx.closePath();
  ctx.fill();
}

function initMultiplayer() {
  if (typeof io === 'undefined') return;

  socket = io('/gallery');

  socket.on('init', (data) => {
    myId = data.id;
    myColor = data.color;
    myBaseIndex = data.myBaseIndex;
    bases = data.bases;
    
    // Set camera position to our base position
    if (bases && myBaseIndex !== undefined) {
      const b = bases[myBaseIndex];
      camera.position.set(b.x, EYE_HEIGHT, b.z);
    }
    
    createBaseVisuals();

    // Set initial active status of powerups
    if (data.activePowerUps) {
      const activeIds = new Set(data.activePowerUps);
      activePowerUps.forEach((pup) => {
        const act = activeIds.has(pup.userData.id);
        pup.userData.active = act;
        pup.visible = act;
      });
    }

    // Add existing players
    data.players.forEach((p) => addPlayer(p));
    updateOnlineCount();
  });

  socket.on('player-joined', (p) => {
    addPlayer(p);
    updateOnlineCount();
  });

  socket.on('player-moved', (data) => {
    const player = otherPlayers.get(data.id);
    if (player) {
      player.targetPos = data.position;
      player.targetRot = data.rotation;
    }
  });

  socket.on('player-left', (id) => {
    removePlayer(id);
    updateOnlineCount();
  });

  socket.on('player-hit', (data) => {
    if (data.id === myId) {
      document.getElementById('health-bar-fill').style.width = data.health + '%';
      const overlay = document.getElementById('damage-overlay');
      if (overlay) {
        overlay.classList.add('active');
        setTimeout(() => overlay.classList.remove('active'), 200);
      }
    }
  });

  socket.on('player-died', (data) => {
    if (data.killerName && data.victimName) {
      const kf = document.getElementById('kill-feed');
      const item = document.createElement('div');
      item.innerHTML = `<span style="color:#ef4444">${data.killerName}</span> 🔫 <span>${data.victimName}</span>`;
      if (kf) kf.appendChild(item);
      setTimeout(() => item.remove(), 4000);
    }
    
    if (data.id === myId) {
      isDead = true;
      if (isCarrying) {
        isCarrying = false;
        document.getElementById('carry-status').style.display = 'none';
        removeBaseArrow();
      }
      document.getElementById('respawn-screen').style.display = 'flex';
      controls.unlock();
    } else {
      const p = otherPlayers.get(data.id);
      if (p) p.mesh.rotation.x = Math.PI / 2;
    }
    
    if (data.killerId === myId) {
      document.getElementById('kill-val').textContent = data.killerKills;
    }
    if (data.id === myId) {
      document.getElementById('death-val').textContent = data.victimDeaths;
    }
  });

  socket.on('player-respawned', (data) => {
    if (data.id === myId) {
      isDead = false;
      ammo = WEAPONS[myWeapon].ammoMax;
      document.getElementById('ammo-current').textContent = ammo;
      document.getElementById('respawn-screen').style.display = 'none';
      document.getElementById('health-bar-fill').style.width = '100%';
      camera.position.set(data.position.x, data.position.y, data.position.z);
      controls.lock();
    } else {
      const p = otherPlayers.get(data.id);
      if (p) {
        p.mesh.rotation.x = 0;
        p.targetPos = data.position;
      }
    }
  });

  socket.on('painting-stolen', (data) => {
    if (data.playerId === myId) {
      isCarrying = true;
      document.getElementById('carry-status').style.display = 'block';
      createBaseArrow();
    }
    const painting = paintingMeshes.find(m => m.userData.artworkId === data.artworkId);
    if (painting && painting.parent) {
      painting.parent.remove(painting);
    }
  });

  socket.on('painting-deposited', (data) => {
    if (data.playerId === myId) {
      isCarrying = false;
      document.getElementById('carry-status').style.display = 'none';
      document.getElementById('score-val').textContent = data.newScore;
      removeBaseArrow();
      AudioSynth.playDeposit();
    }
  });

  socket.on('team-scores-updated', (scores) => {
    teamScores = scores;
    for (let i = 0; i < 4; i++) {
      const scoreEl = document.getElementById(`team-score-${i}`);
      if (scoreEl) scoreEl.textContent = scores[i];
    }
  });

  socket.on('pickup-collected', (id) => {
    const pup = activePowerUps.find(p => p.userData.id === id);
    if (pup) {
      pup.userData.active = false;
      pup.visible = false;
    }
  });

  socket.on('pickup-respawned', (id) => {
    const pup = activePowerUps.find(p => p.userData.id === id);
    if (pup) {
      pup.userData.active = true;
      pup.visible = true;
    }
  });

  socket.on('spawn-particle', (data) => {
    createGoldenParticle(data.x, data.y, data.z);
  });

  socket.on('guard-sync', (data) => {
    aiGuardPos.set(data.x, data.y, data.z);
    if (!aiGuardMesh) {
      const guardGeo = new THREE.SphereGeometry(0.6, 16, 16);
      const guardMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2, metalness: 0.8, emissive: 0xef4444, emissiveIntensity: 0.5 });
      aiGuardMesh = new THREE.Mesh(guardGeo, guardMat);
      
      const coneGeo = new THREE.ConeGeometry(2, 6, 16, 1, true);
      const coneMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.rotation.x = Math.PI;
      cone.position.y = -3;
      aiGuardMesh.add(cone);
      
      scene.add(aiGuardMesh);
    }
    
    aiGuardMesh.position.copy(aiGuardPos);
    aiGuardMesh.material.emissiveIntensity = data.hasTarget ? 1.5 : 0.5;
  });

  socket.on('guard-shoot', (data) => {
    AudioSynth.playAlarm();
    
    if (aiGuardMesh) {
      const laserMat = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 2 });
      const points = [
        aiGuardMesh.position.clone(),
        new THREE.Vector3(data.targetX, EYE_HEIGHT, data.targetZ)
      ];
      const laserGeo = new THREE.BufferGeometry().setFromPoints(points);
      const laserLine = new THREE.Line(laserGeo, laserMat);
      scene.add(laserLine);
      setTimeout(() => {
        scene.remove(laserLine);
        laserGeo.dispose();
        laserMat.dispose();
      }, 150);
    }
  });

  socket.on('guard-destroyed', (data) => {
    const kf = document.getElementById('kill-feed');
    const item = document.createElement('div');
    item.innerHTML = `<span style="color:#ef4444">${data.killerName}</span> 💥 <span>🤖 MUHAFIZ DRON</span>`;
    if (kf) kf.appendChild(item);
    setTimeout(() => item.remove(), 4000);
  });
}

let isDead = false;
let ammo = 15;
let isReloading = false;
let isCarrying = false;
let isSprinting = false;

window.addEventListener('mousedown', (e) => {
  if (!controls || !controls.isLocked || isDead) return;

  if (e.button === 0) {
    isMouseDown = true;
    if (!WEAPONS[myWeapon].automatic) {
      fireWeapon();
    }
  } else if (e.button === 2 && myWeapon === 'sniper') {
    isScopeOpen = !isScopeOpen;
    const scopeEl = document.getElementById('sniper-scope');
    if (isScopeOpen) {
      camera.fov = 20;
      camera.updateProjectionMatrix();
      if (scopeEl) scopeEl.style.display = 'block';
      if (gunGroup) gunGroup.visible = false;
    } else {
      camera.fov = defaultFov;
      camera.updateProjectionMatrix();
      if (scopeEl) scopeEl.style.display = 'none';
      if (gunGroup) gunGroup.visible = true;
    }
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    isMouseDown = false;
  }
});

window.addEventListener('keydown', (e) => {
  if (!controls || !controls.isLocked || isDead) return;
  const key = e.key.toLowerCase();
  
  if (key === 'shift') isSprinting = true;
  
  if (key === 'r' && ammo < WEAPONS[myWeapon].ammoMax && !isReloading) {
    isReloading = true;
    document.getElementById('ammo-current').textContent = '...';
    AudioSynth.playReload();
    setTimeout(() => {
      ammo = WEAPONS[myWeapon].ammoMax;
      document.getElementById('ammo-current').textContent = ammo;
      isReloading = false;
    }, WEAPONS[myWeapon].reloadTime);
  }
  
  if (key === 'e') {
    if (isCarrying) {
      socket.emit('deposit-painting');
    } else {
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const hits = raycaster.intersectObjects(paintingMeshes);
      if (hits.length > 0 && hits[0].distance < 4) {
        const artId = hits[0].object.userData.artworkId;
        socket.emit('steal-painting', artId);
      }
    }
  }

  if (e.code === 'Space') {
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    if (dashCooldown <= 0 && speed > 0.5) {
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      
      dashDirection.set(0, 0, 0);
      if (moveForward) dashDirection.addScaledVector(forward, 1);
      if (moveBackward) dashDirection.addScaledVector(forward, -1);
      if (moveRight) dashDirection.addScaledVector(right, 1);
      if (moveLeft) dashDirection.addScaledVector(right, -1);
      dashDirection.normalize();
      
      if (dashDirection.lengthSq() > 0) {
        dashTime = 0.2;
        dashCooldown = 3.0;
        
        camera.fov = 85;
        camera.updateProjectionMatrix();
        AudioSynth.playClick(AudioSynth.ctx.currentTime, 800, 0.25);
      }
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key.toLowerCase() === 'shift') isSprinting = false;
});

function getPlayerName() {
  const input = document.getElementById('player-name');
  return (input?.value || '').trim() || 'Ziyaretçi';
}

function sendName() {
  const name = getPlayerName();
  if (socket) {
    socket.emit('set-player-info', {
      name,
      team: myTeam,
      weapon: myWeapon
    });
  }
}

function sendPosition() {
  if (!socket || !myId) return;
  const now = Date.now();
  if (now - lastSendTime < SEND_INTERVAL) return;
  lastSendTime = now;

  socket.emit('move', {
    position: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    },
    rotation: {
      x: camera.rotation.x,
      y: camera.rotation.y,
    },
  });
}

function addPlayer(data) {
  if (data.id === myId) return;
  if (otherPlayers.has(data.id)) return;

  const color = new THREE.Color(data.color || '#c9a96e');
  const group = new THREE.Group();

  let mixer = null;
  let actionIdle = null;
  let actionWalk = null;
  let currentAction = null;

  if (sharedPlayerModel) {
    const clone = SkeletonUtils.clone(sharedPlayerModel);
    
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.emissive = color;
        child.material.emissiveIntensity = 0.2;
      }
    });

    clone.position.y = -EYE_HEIGHT + 0.1; 
    clone.rotation.y = Math.PI; 

    group.add(clone);

    if (playerAnimations && playerAnimations.length > 0) {
      mixer = new THREE.AnimationMixer(clone);
      
      const idleClip = THREE.AnimationClip.findByName(playerAnimations, 'Idle');
      const walkClip = THREE.AnimationClip.findByName(playerAnimations, 'Walking') || THREE.AnimationClip.findByName(playerAnimations, 'Walk') || THREE.AnimationClip.findByName(playerAnimations, 'Run');
      
      if (idleClip) actionIdle = mixer.clipAction(idleClip);
      if (walkClip) actionWalk = mixer.clipAction(walkClip);
      
      if (actionIdle) {
        actionIdle.play();
        currentAction = actionIdle;
      }
    }
  } else {
    const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.7, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = -0.3;
    group.add(body);

    const headGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xf5e6d0, roughness: 0.7 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.35;
    group.add(head);

    const noseGeo = new THREE.ConeGeometry(0.06, 0.12, 4);
    const noseMat = new THREE.MeshStandardMaterial({ color });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0.3, 0.2);
    group.add(nose);
  }

  const nameSprite = createNameSprite(data.name || 'Ziyaretçi', data.color);
  nameSprite.position.y = 0.7;
  group.add(nameSprite);

  group.position.set(
    data.position?.x || 0,
    data.position?.y || EYE_HEIGHT,
    data.position?.z || 15
  );

  group.userData = { color: data.color };

  scene.add(group);
  otherPlayers.set(data.id, {
    mesh: group,
    nameSprite,
    mixer,
    actionIdle,
    actionWalk,
    currentAction,
    targetPos: data.position || { x: 0, y: EYE_HEIGHT, z: 15 },
    targetRot: data.rotation || { x: 0, y: 0 },
  });
}

function createNameSprite(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(12, 11, 13, 0.75)';
  ctx.beginPath();
  ctx.roundRect(16, 8, 224, 44, 22);
  ctx.fill();

  ctx.strokeStyle = color || '#c9a96e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(16, 8, 224, 44, 22);
  ctx.stroke();

  ctx.fillStyle = '#f5f0e8';
  ctx.font = '500 20px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.5, 0.38, 1);
  return sprite;
}

function removePlayer(id) {
  const player = otherPlayers.get(id);
  if (player) {
    scene.remove(player.mesh);
    player.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
    otherPlayers.delete(id);
  }
}

function updateOnlineCount() {
  const el = document.getElementById('online-num');
  if (el) el.textContent = otherPlayers.size + 1;
}

function updatePlayers(delta) {
  const time = Date.now() * 0.005;
  otherPlayers.forEach((player) => {
    let speed = 0;
    if (player.targetPos) {
      const dx = player.targetPos.x - player.mesh.position.x;
      const dz = player.targetPos.z - player.mesh.position.z;
      speed = Math.sqrt(dx*dx + dz*dz);
      
      player.mesh.position.x += dx * 0.15;
      player.mesh.position.z += dz * 0.15;
      
      if (!player.mixer) {
        let yTarget = player.targetPos.y;
        if (speed > 0.01) {
          yTarget += Math.sin(time) * 0.05;
        }
        player.mesh.position.y += (yTarget - player.mesh.position.y) * 0.15;
      }
    }

    if (player.targetRot) {
      const targetY = player.targetRot.y || 0;
      let diff = targetY - player.mesh.rotation.y;
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      player.mesh.rotation.y += diff * 0.15;
    }

    if (player.nameSprite) {
      player.nameSprite.lookAt(camera.position);
    }

    if (player.mixer) {
      player.mixer.update(delta || 0.016);
      
      let targetAction = speed > 0.02 ? player.actionWalk : player.actionIdle;
      
      if (targetAction && targetAction !== player.currentAction) {
        targetAction.reset().fadeIn(0.2).play();
        if (player.currentAction) {
          player.currentAction.fadeOut(0.2);
        }
        player.currentAction = targetAction;
      }
    }
  });
}

// Hook into start overlay click to send info
const startOvl = document.getElementById('start-overlay');
if (startOvl) {
  const startHandler = (e) => {
    if (e.target.tagName.toLowerCase() === 'input') return;
    sendName();
  };
  startOvl.addEventListener('click', startHandler, true);
  startOvl.addEventListener('touchstart', startHandler, true);
}

// Init multiplayer after a short delay to let everything load
setTimeout(() => {
  initMultiplayer();
}, 1000);

// Helper functions (createPowerUps, createLasers, etc) are defined above and called in init().

