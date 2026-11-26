// Main application loop for Solaris Wing: Caldera Sortie.
// Initializes Three.js renderer, world, aircraft, physics, HUD, audio, and sortie UI flow.

import * as THREE from 'three';
import { ATMOSPHERE_PRESETS, MISSIONS, RUNWAY } from './config.js';
import { createWorld } from './terrain.js';
import { createAircraft } from './aircraft.js';
import { createInitialFlightState, stepFlightPhysics } from './physics.js';
import { createControls } from './controls.js';
import { createCameraRig } from './camera.js';
import { createMissionManager } from './missions.js';
import { createHudRenderer } from './hud.js';
import { createEffects } from './effects.js';
import { createAudioEngine } from './audio.js';

const sceneCanvas = document.getElementById('scene-canvas');
const hudCanvas = document.getElementById('hud-canvas');
const topBar = document.getElementById('top-bar');
const hudMissionName = document.getElementById('hud-mission-name');
const hudObjectiveText = document.getElementById('hud-objective-text');
const statusEl = document.getElementById('status');

const briefingOverlay = document.getElementById('briefing-overlay');
const pauseOverlay = document.getElementById('pause-overlay');
const debriefOverlay = document.getElementById('debrief-overlay');

const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.35, 8000);

const world = createWorld(scene);
const aircraft = createAircraft();
scene.add(aircraft.root);

const cameraRig = createCameraRig(camera);
const missions = createMissionManager(scene);
const hud = createHudRenderer(hudCanvas);
const effects = createEffects(scene);
const audio = createAudioEngine();

let selectedMissionId = 'rings';
let selectedAtmoId = 'golden';
let preset = ATMOSPHERE_PRESETS[selectedAtmoId];
let phase = 'briefing'; // 'briefing' | 'flying' | 'paused' | 'debrief'
let launchMode = 'air';
let flightState = createInitialFlightState(MISSIONS.rings.airStart, 100);
let bannerText = '';
let bannerTimer = 0;

function showBanner(msg, secs = 2.6) {
  bannerText = msg;
  bannerTimer = secs;
  statusEl.textContent = msg;
}

function setAtmosphere(atmoId) {
  selectedAtmoId = atmoId;
  preset = ATMOSPHERE_PRESETS[atmoId] ?? ATMOSPHERE_PRESETS.golden;
  world.applyAtmosphere(preset);
  document.querySelectorAll('.atmo-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.atmo === selectedAtmoId);
  });
}

function startSortie(mode = launchMode) {
  launchMode = mode;
  audio.unlock();
  const m = MISSIONS[selectedMissionId] ?? MISSIONS.rings;
  missions.loadMission(m.id);

  const startSpec =
    mode === 'runway'
      ? { x: RUNWAY.thresholdWestX + 26, y: RUNWAY.elevation + 1.42, z: RUNWAY.centerZ, headingDeg: 90, speedMs: 0 }
      : m.airStart;

  flightState = createInitialFlightState(startSpec, m.startFuel);
  if (mode === 'runway') {
    flightState.throttle = 0.0;
    showBanner('RUNWAY 09 READY — SHIFT FOR FULL THROTTLE', 3.5);
  } else {
    showBanner(`${m.title.toUpperCase()} — FOLLOW AMBER MARKER`, 3.0);
  }

  phase = 'flying';
  briefingOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  debriefOverlay.classList.add('hidden');
  topBar.classList.remove('hidden');
  cameraRig.setMode('chase');
  cameraRig.snapTo(flightState);
}

function openDebrief(isCrash) {
  phase = 'debrief';
  const st = missions.getStatus();
  const eyebrow = document.getElementById('debrief-eyebrow');
  const title = document.getElementById('debrief-title');
  const summary = document.getElementById('debrief-summary');
  const gradeEl = document.getElementById('stat-grade');

  if (isCrash) {
    eyebrow.textContent = 'SORTIE TERMINATED';
    title.textContent = 'AIRCRAFT LOST';
    summary.textContent = flightState.crashReason;
    gradeEl.textContent = 'F';
    gradeEl.style.color = '#ff5b6e';
  } else {
    eyebrow.textContent = 'SORTIE COMPLETE';
    title.textContent = 'RUNWAY 09 RECOVERY';
    const fpmAbs = Math.abs(flightState.touchdownFpm);
    const grade =
      st.completedCount >= st.totalCount && fpmAbs < 260 && flightState.hull >= 95
        ? 'S'
        : st.completedCount >= st.totalCount && flightState.hull >= 70
          ? 'A'
          : 'B';
    summary.textContent =
      fpmAbs < 220
        ? `Greased landing onto Runway 09 (${flightState.touchdownFpm} FPM).`
        : `Firm landing onto Runway 09 (${flightState.touchdownFpm} FPM).`;
    gradeEl.textContent = grade;
    gradeEl.style.color = grade === 'S' ? '#42f59b' : '#ffaa33';
  }

  document.getElementById('stat-objectives').textContent = `${st.completedCount} / ${st.totalCount}`;
  document.getElementById('stat-fpm').textContent = isCrash ? 'IMPACT' : `${flightState.touchdownFpm} FPM`;
  document.getElementById('stat-systems').textContent = `${Math.round(flightState.fuel)}% / ${Math.round(flightState.hull)}%`;
  document.getElementById('stat-score').textContent = st.score.toLocaleString();

  debriefOverlay.classList.remove('hidden');
  cameraRig.setMode('orbit');
}

const controls = createControls(sceneCanvas, {
  onToggleCamera: () => {
    if (phase !== 'flying') return;
    const next = cameraRig.toggleMode();
    showBanner(next === 'cockpit' ? '3D COCKPIT VIEW' : 'CHASE CAMERA', 1.6);
  },
  onToggleGear: () => {
    if (phase !== 'flying' || flightState.onGround) return;
    flightState.gearDown = !flightState.gearDown;
    audio.playServo();
    showBanner(flightState.gearDown ? 'LANDING GEAR DOWN' : 'LANDING GEAR RETRACTED', 1.5);
  },
  onToggleFlaps: () => {
    if (phase !== 'flying') return;
    flightState.flaps = flightState.flaps ? 0 : 1;
    audio.playServo();
    showBanner(flightState.flaps ? 'FLAPS DEPLOYED' : 'FLAPS RETRACTED', 1.5);
  },
  onToggleAirbrake: () => {
    if (phase !== 'flying') return;
    flightState.airbrake = !flightState.airbrake;
    audio.playServo();
    showBanner(flightState.airbrake ? 'AIRBRAKE EXTENDED' : 'AIRBRAKE STOWED', 1.5);
  },
  onMouseToggle: (active) => {
    showBanner(active ? 'MOUSE FLIGHT STICK ACTIVE (M TO RELEASE)' : 'KEYBOARD FLIGHT CONTROLS', 1.8);
  },
  onThrottleWheel: (delta) => {
    if (phase !== 'flying') return;
    flightState.throttle = Math.max(0, Math.min(1, flightState.throttle + delta));
  },
  onAction: () => {
    if (phase === 'briefing') {
      startSortie('air');
      return;
    }
    if (phase !== 'flying') return;
    const st = missions.getStatus();
    if (st.mission.id === 'supply') {
      const res = missions.dropSupplyCrate(flightState);
      audio.playDrop();
      if (res.msg) showBanner(res.msg, 2.2);
    } else {
      flightState.throttle = 1.0;
      showBanner('AFTERBURNER ENGAGED', 1.5);
    }
  },
  onTogglePause: () => {
    if (phase === 'flying') {
      phase = 'paused';
      document.getElementById('pause-mission-title').textContent = MISSIONS[selectedMissionId].title.toUpperCase();
      pauseOverlay.classList.remove('hidden');
    } else if (phase === 'paused') {
      phase = 'flying';
      pauseOverlay.classList.add('hidden');
    }
  },
});

// UI wiring
document.querySelectorAll('.mission-card').forEach((card) => {
  card.addEventListener('click', () => {
    selectedMissionId = card.dataset.mission;
    document.querySelectorAll('.mission-card').forEach((c) => c.classList.toggle('selected', c === card));
    setAtmosphere(MISSIONS[selectedMissionId].defaultAtmo);
  });
});

document.querySelectorAll('.atmo-btn').forEach((btn) => {
  btn.addEventListener('click', () => setAtmosphere(btn.dataset.atmo));
});

document.getElementById('btn-launch-air').addEventListener('click', () => startSortie('air'));
document.getElementById('btn-launch-runway').addEventListener('click', () => startSortie('runway'));
document.getElementById('btn-resume').addEventListener('click', () => {
  phase = 'flying';
  pauseOverlay.classList.add('hidden');
});
document.getElementById('btn-restart-pause').addEventListener('click', () => startSortie(launchMode));
document.getElementById('btn-menu-pause').addEventListener('click', () => {
  phase = 'briefing';
  pauseOverlay.classList.add('hidden');
  topBar.classList.add('hidden');
  briefingOverlay.classList.remove('hidden');
});
document.getElementById('btn-retry').addEventListener('click', () => startSortie(launchMode));
document.getElementById('btn-menu-debrief').addEventListener('click', () => {
  phase = 'briefing';
  debriefOverlay.classList.add('hidden');
  topBar.classList.add('hidden');
  briefingOverlay.classList.remove('hidden');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Optional query presets (?shot=cover|cockpit|canyon|landing) for deterministic showcase inspection
function applyShowcasePresetIfRequested() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return;

  if (shot === 'cover') {
    selectedMissionId = 'rings';
    setAtmosphere('golden');
    startSortie('air');
    flightState.position.set(-465, 114, 30);
    flightState.quaternion.setFromEuler(new THREE.Euler(-0.015, -Math.PI * 0.48, -0.22, 'YXZ'));
    flightState.velocity.set(82, -0.6, -4);
    flightState.throttle = 0.88;
    flightState.afterburner = true;
    flightState.gearDown = false;
    flightState.fuel = 86;
    missions.addTouchdownBonus(1850);
    cameraRig.setMode('chase');
    cameraRig.snapTo(flightState);
    bannerText = '';
  } else if (shot === 'cockpit') {
    selectedMissionId = 'rings';
    setAtmosphere('golden');
    startSortie('air');
    missions.advanceTo(2);
    missions.addTouchdownBonus(1400);
    flightState.position.set(275, 102, 550);
    flightState.quaternion.setFromEuler(new THREE.Euler(-0.06, -Math.PI * 0.74, 0.14, 'YXZ'));
    flightState.velocity.set(58, -2.5, 50);
    flightState.throttle = 0.78;
    flightState.gearDown = false;
    flightState.fuel = 82;
    cameraRig.setMode('cockpit');
    cameraRig.snapTo(flightState);
    bannerText = '';
  } else if (shot === 'canyon') {
    selectedMissionId = 'supply';
    setAtmosphere('noon');
    startSortie('air');
    missions.addTouchdownBonus(950);
    flightState.position.set(238, 114, 755);
    flightState.quaternion.setFromEuler(new THREE.Euler(-0.04, -Math.PI * 0.78, -0.20, 'YXZ'));
    flightState.velocity.set(46, -1.6, 48);
    flightState.throttle = 0.65;
    flightState.flaps = 1;
    flightState.airbrake = true;
    flightState.fuel = 64;
    flightState.hull = 88;
    cameraRig.setMode('chase');
    cameraRig.snapTo(flightState);
    missions.dropSupplyCrate(flightState);
    bannerText = '';
  } else if (shot === 'landing') {
    selectedMissionId = 'rings';
    setAtmosphere('golden');
    startSortie('air');
    missions.advanceTo(9);
    missions.addTouchdownBonus(4250);
    flightState.position.set(-592, 18.2, 0);
    flightState.quaternion.setFromEuler(new THREE.Euler(-0.045, -Math.PI * 0.5, 0.0, 'YXZ'));
    flightState.velocity.set(52, -2.6, 0);
    flightState.throttle = 0.28;
    flightState.gearDown = true;
    flightState.flaps = 1;
    flightState.airbrake = true;
    flightState.fuel = 52;
    flightState.hull = 94;
    cameraRig.setMode('chase');
    cameraRig.snapTo(flightState);
    bannerText = '';
  }
}

setAtmosphere('golden');
missions.loadMission('rings');
cameraRig.snapTo(flightState);
applyShowcasePresetIfRequested();

let lastTime = performance.now();
let simTime = 0;

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  simTime += dt;

  if (phase === 'briefing') {
    // Live scenic flyby preview behind the briefing panel
    const angle = simTime * 0.14;
    flightState.position.set(Math.cos(angle) * 520 + 180, 185 + Math.sin(simTime * 0.4) * 14, Math.sin(angle) * 460);
    const tangentHeading = Math.atan2(-Math.sin(angle) * 520, Math.cos(angle) * 460);
    flightState.quaternion.setFromEuler(new THREE.Euler(0.03, -tangentHeading, -0.26, 'YXZ'));
    flightState.headingDeg = ((tangentHeading * 180) / Math.PI + 360) % 360;
    flightState.gearDown = false;
    flightState.throttle = 0.76;
    world.update(simTime, dt, flightState, preset);
    aircraft.updateVisuals(flightState, simTime, false);
    cameraRig.update(flightState, dt, simTime);
    renderer.render(scene, camera);
    return;
  }

  if (phase === 'flying') {
    const input = controls.sample();
    stepFlightPhysics(flightState, input, preset, dt, simTime, (st, onRw, sinkFpm) => {
      audio.playTouchdown();
      effects.spawnTouchdownSmoke(st.position);
      if (onRw) {
        missions.addTouchdownBonus(sinkFpm < 260 ? 600 : 300);
        showBanner(`TOUCHDOWN ${-sinkFpm} FPM — BRAKE (B) TO STOP`, 3.0);
      } else {
        showBanner('OFF-RUNWAY TOUCHDOWN — TAXI OR RE-TAKEOFF', 2.8);
      }
    });

    missions.update(flightState, dt, simTime, (cleared) => {
      audio.playRingClear();
      effects.spawnRingClear(new THREE.Vector3(cleared.x, cleared.y, cleared.z));
      showBanner(`${cleared.label} CLEARED`, 2.0);
    });

    if (flightState.crashed) {
      audio.playCrash();
      effects.spawnCrashBurst(flightState.position);
      openDebrief(true);
    } else if (flightState.landed && missions.getStatus().allObjectivesDone) {
      openDebrief(false);
    } else if (flightState.landed && selectedMissionId === 'free' && Math.abs(flightState.touchdownFpm) > 0) {
      showBanner(`STOPPED ON RUNWAY 09 (${flightState.touchdownFpm} FPM) — SHIFT TO TAKEOFF`, 2.5);
    }
  }

  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0) bannerText = '';
  }

  const mStatus = missions.getStatus();
  hudMissionName.textContent = mStatus.mission.title.toUpperCase();
  hudObjectiveText.textContent = mStatus.allObjectivesDone
    ? 'RTB RUNWAY 09'
    : `${mStatus.mission.id === 'supply' ? 'DROPS' : 'GATE'} ${Math.min(mStatus.completedCount + 1, mStatus.totalCount)} / ${mStatus.totalCount}`;

  world.update(simTime, dt, flightState, preset);
  effects.update(flightState, dt);
  audio.update(flightState, phase !== 'flying');

  const camMode = cameraRig.getMode();
  aircraft.updateVisuals(flightState, simTime, camMode === 'cockpit');
  cameraRig.update(flightState, dt, simTime);
  renderer.render(scene, camera);

  if (phase === 'flying' || phase === 'debrief') {
    hud.render(flightState, camera, preset, mStatus, camMode, bannerText);
  }
}

requestAnimationFrame(tick);
