// Mission manager for Caldera Ring Trial, Beacon Supply Drop, Storm Intercept, and Free Flight.
// Renders 3D aerial target rings, supply drop pads, storm beacon drones, and parachute crates.

import * as THREE from 'three';
import { MISSIONS, RUNWAY } from './config.js';
import { getTerrainHeight } from './terrain.js';

export function createMissionManager(scene) {
  const group = new THREE.Group();
  scene.add(group);

  let currentMission = MISSIONS.rings;
  let items = [];
  let crates = [];
  let currentIndex = 0;
  let completedCount = 0;
  let totalCount = 0;
  let allObjectivesDone = false;
  let score = 0;
  let elapsedSec = 0;

  // Return-to-base final gate over Runway 09
  const rtbRing = new THREE.Group();
  const rtbTorus = new THREE.Mesh(
    new THREE.TorusGeometry(28, 1.4, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0x38ff8c, transparent: true, opacity: 0.85 }),
  );
  rtbTorus.rotation.y = Math.PI / 2;
  rtbRing.add(rtbTorus);
  rtbRing.position.set(RUNWAY.thresholdWestX - 75, RUNWAY.elevation + 24, RUNWAY.centerZ);
  rtbRing.visible = false;
  group.add(rtbRing);

  function clearObjects() {
    for (const item of items) {
      if (item.mesh) group.remove(item.mesh);
    }
    for (const c of crates) {
      group.remove(c.mesh);
    }
    items = [];
    crates = [];
    rtbRing.visible = false;
  }

  function makeGateMesh(radius, isActive) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: isActive ? 0xffb32c : 0x36c7ff,
      transparent: true,
      opacity: isActive ? 0.95 : 0.32,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, isActive ? 1.85 : 1.15, 10, 36), mat);
    g.add(ring);

    const innerMat = new THREE.MeshBasicMaterial({
      color: isActive ? 0x58ffe0 : 0x1b7ea8,
      transparent: true,
      opacity: isActive ? 0.35 : 0.1,
      side: THREE.DoubleSide,
    });
    const inner = new THREE.Mesh(new THREE.RingGeometry(radius - 4.2, radius - 1.5, 32), innerMat);
    g.add(inner);

    return { group: g, mat, innerMat };
  }

  function loadMission(missionId) {
    clearObjects();
    currentMission = MISSIONS[missionId] ?? MISSIONS.rings;
    currentIndex = 0;
    completedCount = 0;
    allObjectivesDone = false;
    score = 0;
    elapsedSec = 0;

    if (currentMission.id === 'rings' || currentMission.id === 'free') {
      const gates = currentMission.gates;
      totalCount = gates.length;
      for (let i = 0; i < gates.length; i++) {
        const spec = gates[i];
        const nextSpec = gates[(i + 1) % gates.length];
        const built = makeGateMesh(spec.radius, i === 0);
        built.group.position.set(spec.x, spec.y, spec.z);
        built.group.lookAt(nextSpec.x, nextSpec.y, nextSpec.z);
        group.add(built.group);
        items.push({
          kind: 'gate',
          x: spec.x,
          y: spec.y,
          z: spec.z,
          radius: spec.radius,
          label: spec.label,
          done: false,
          mesh: built.group,
          mat: built.mat,
          innerMat: built.innerMat,
        });
      }
    } else if (currentMission.id === 'supply') {
      const zones = currentMission.dropZones;
      totalCount = zones.length;
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        const gy = z.x < -800 ? 6.6 : getTerrainHeight(z.x, z.z);
        const zoneGroup = new THREE.Group();
        zoneGroup.position.set(z.x, gy + 0.5, z.z);

        const padRing = new THREE.Mesh(
          new THREE.RingGeometry(22, 28, 32),
          new THREE.MeshBasicMaterial({ color: 0xffaa33, side: THREE.DoubleSide }),
        );
        padRing.rotation.x = -Math.PI / 2;
        zoneGroup.add(padRing);

        const pillarMat = new THREE.MeshBasicMaterial({
          color: i === 0 ? 0x42f59b : 0xffaa33,
          transparent: true,
          opacity: i === 0 ? 0.38 : 0.16,
          side: THREE.DoubleSide,
        });
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 175, 16, 1, true), pillarMat);
        pillar.position.y = 87;
        zoneGroup.add(pillar);

        group.add(zoneGroup);
        items.push({
          kind: 'drop',
          x: z.x,
          y: gy + 45,
          z: z.z,
          radius: z.radius,
          label: z.label,
          done: false,
          mesh: zoneGroup,
          mat: pillarMat,
        });
      }
    } else if (currentMission.id === 'storm') {
      const targets = currentMission.targets;
      totalCount = targets.length;
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const built = makeGateMesh(t.radius, i === 0);
        built.group.position.set(t.x, t.y, t.z);
        const core = new THREE.Mesh(
          new THREE.OctahedronGeometry(7.5, 0),
          new THREE.MeshBasicMaterial({ color: 0xff6633, wireframe: true }),
        );
        built.group.add(core);
        group.add(built.group);
        items.push({
          kind: 'storm',
          x: t.x,
          y: t.y,
          z: t.z,
          radius: t.radius,
          label: t.label,
          done: false,
          mesh: built.group,
          mat: built.mat,
          innerMat: built.innerMat,
          core,
        });
      }
    }
  }

  function advanceTo(index) {
    currentIndex = Math.min(index, items.length);
    completedCount = index;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (i < index) {
        it.done = true;
        it.mesh.visible = false;
      } else {
        it.done = false;
        it.mesh.visible = true;
        const isNext = i === index;
        if (it.kind === 'gate' || it.kind === 'storm') {
          it.mat.color.setHex(isNext ? 0xffb32c : 0x36c7ff);
          it.mat.opacity = isNext ? 0.96 : 0.28;
          if (it.innerMat) it.innerMat.opacity = isNext ? 0.36 : 0.08;
        } else if (it.kind === 'drop') {
          it.mat.color.setHex(isNext ? 0x42f59b : 0xffaa33);
          it.mat.opacity = isNext ? 0.42 : 0.14;
        }
      }
    }
    if (index >= items.length && currentMission.requireLanding) {
      allObjectivesDone = true;
      rtbRing.visible = true;
    }
  }

  function dropSupplyCrate(state) {
    if (currentMission.id !== 'supply' || allObjectivesDone) return { hit: false, msg: '' };
    const crateGroup = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.6, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 }),
    );
    crateGroup.add(box);
    const chute = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, side: THREE.DoubleSide }),
    );
    chute.position.y = 5.2;
    crateGroup.add(chute);

    crateGroup.position.copy(state.position).add(new THREE.Vector3(0, -3.5, 0));
    group.add(crateGroup);
    crates.push({
      mesh: crateGroup,
      vel: new THREE.Vector3(state.velocity.x * 0.35, -8.5, state.velocity.z * 0.35),
      landed: false,
      age: 0,
    });

    const target = items[currentIndex];
    if (!target) return { hit: false, msg: 'CRATE RELEASED' };
    const horizDist = Math.hypot(state.position.x - target.x, state.position.z - target.z);
    if (horizDist <= target.radius && state.aglM <= 185 && state.speedKnots <= 185) {
      target.done = true;
      target.mesh.visible = false;
      completedCount++;
      score += 850;
      currentIndex++;
      if (currentIndex >= items.length) {
        allObjectivesDone = true;
        rtbRing.visible = true;
      } else {
        advanceTo(currentIndex);
      }
      return { hit: true, msg: `${target.label} SUPPLIED (+850)` };
    }
    return { hit: false, msg: horizDist > target.radius ? 'OFF TARGET — FLY OVER PAD' : 'TOO FAST OR HIGH (<185 KT)' };
  }

  function update(state, dt, timeSec, onClearObjective) {
    elapsedSec += dt;

    // Update active falling supply crates
    for (let i = crates.length - 1; i >= 0; i--) {
      const c = crates[i];
      c.age += dt;
      if (!c.landed) {
        c.vel.x *= Math.exp(-1.2 * dt);
        c.vel.z *= Math.exp(-1.2 * dt);
        c.mesh.position.addScaledVector(c.vel, dt);
        const gy = Math.max(0, getTerrainHeight(c.mesh.position.x, c.mesh.position.z));
        if (c.mesh.position.y <= gy + 1.4) {
          c.mesh.position.y = gy + 1.4;
          c.landed = true;
        }
      }
      if (c.age > 24) {
        group.remove(c.mesh);
        crates.splice(i, 1);
      }
    }

    // Animate current gate/beacon
    for (let i = currentIndex; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'gate' || it.kind === 'storm') {
        it.mesh.rotation.z = timeSec * (i === currentIndex ? 0.65 : 0.25);
        if (it.core) {
          it.core.rotation.y = timeSec * 1.8;
          it.core.rotation.x = timeSec * 1.1;
        }
      }
    }

    if (rtbRing.visible) {
      rtbTorus.rotation.z = timeSec * 0.9;
    }

    const active = items[currentIndex];
    if (active && (active.kind === 'gate' || active.kind === 'storm')) {
      const dist = Math.hypot(
        state.position.x - active.x,
        state.position.y - active.y,
        state.position.z - active.z,
      );
      if (dist <= active.radius + 9) {
        active.done = true;
        active.mesh.visible = false;
        completedCount++;
        score += 500 + Math.round(state.speedKnots * 2);
        currentIndex++;
        if (currentIndex >= items.length) {
          if (currentMission.requireLanding) {
            allObjectivesDone = true;
            rtbRing.visible = true;
          } else {
            // Free flight loops gates endlessly
            advanceTo(0);
          }
        } else {
          advanceTo(currentIndex);
        }
        onClearObjective?.(active);
      }
    }

    // Set nextTarget pointer on flight state for HUD & Cockpit ND
    if (allObjectivesDone) {
      state.nextTarget = {
        x: RUNWAY.thresholdWestX,
        y: RUNWAY.elevation + 16,
        z: RUNWAY.centerZ,
        label: 'RTB RUNWAY 09',
      };
    } else if (items[currentIndex]) {
      const it = items[currentIndex];
      state.nextTarget = { x: it.x, y: it.y, z: it.z, label: it.label };
    } else {
      state.nextTarget = {
        x: RUNWAY.thresholdWestX,
        y: RUNWAY.elevation + 16,
        z: RUNWAY.centerZ,
        label: 'RUNWAY 09',
      };
    }
  }

  function getStatus() {
    return {
      mission: currentMission,
      completedCount,
      totalCount,
      allObjectivesDone,
      score,
      elapsedSec,
      items,
      currentIndex,
    };
  }

  function addTouchdownBonus(points) {
    score += points;
  }

  return {
    loadMission,
    advanceTo,
    dropSupplyCrate,
    update,
    getStatus,
    addTouchdownBonus,
  };
}
