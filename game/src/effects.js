// Atmospheric flight effects: wingtip condensation ribbons, damage smoke,
// runway touchdown tire puffs, and ring-clear shockwave rings.

import * as THREE from 'three';

export function createEffects(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const particles = [];
  const puffGeo = new THREE.SphereGeometry(0.55, 6, 6);
  const shockGeo = new THREE.RingGeometry(1, 3.2, 24);

  function spawnParticle(pos, vel, color, size, life, opacity = 0.75) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(puffGeo, mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(size);
    group.add(mesh);
    particles.push({ mesh, mat, vel, life, maxLife: life, startSize: size, growth: 1.8 });
  }

  function spawnTouchdownSmoke(pos) {
    for (let i = 0; i < 6; i++) {
      const p = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.6, -0.75, (Math.random() - 0.5) * 1.5));
      const v = new THREE.Vector3((Math.random() - 0.5) * 3, 1.2 + Math.random() * 1.5, (Math.random() - 0.5) * 3);
      spawnParticle(p, v, 0xe2e8f0, 0.45, 0.9, 0.36);
    }
  }

  function spawnRingClear(pos) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x58ffe0,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(shockGeo, mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(4);
    group.add(mesh);
    particles.push({
      mesh,
      mat,
      vel: new THREE.Vector3(0, 0, 0),
      life: 0.7,
      maxLife: 0.7,
      startSize: 4,
      growth: 18,
    });
  }

  function spawnCrashBurst(pos) {
    for (let i = 0; i < 18; i++) {
      const col = i % 2 === 0 ? 0xff6b2b : 0x262930;
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 28,
        6 + Math.random() * 18,
        (Math.random() - 0.5) * 28,
      );
      spawnParticle(pos, v, col, 1.6 + Math.random() * 1.4, 2.2, 0.85);
    }
  }

  let trailAccum = 0;
  function update(state, dt) {
    trailAccum += dt;
    if (!state.crashed && !state.onGround && trailAccum >= 0.03) {
      trailAccum = 0;
      // Subtle wingtip condensation under high G or crisp turn
      if (state.speedKnots > 175 && (Math.abs(state.controls.roll) > 0.35 || state.gForce > 1.75)) {
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(state.quaternion);
        for (const side of [-5.25, 5.25]) {
          const tipPos = state.position.clone().addScaledVector(right, side);
          spawnParticle(tipPos, new THREE.Vector3(0, 0.05, 0), 0xeef7ff, 0.16, 0.42, 0.22);
        }
      }
      // Damage smoke if hull < 65%
      if (state.hull < 65) {
        spawnParticle(
          state.position.clone(),
          new THREE.Vector3((Math.random() - 0.5) * 2, 1.8, (Math.random() - 0.5) * 2),
          0x373c44,
          1.1,
          1.4,
          0.55,
        );
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        group.remove(p.mesh);
        p.mat.dispose();
        particles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      const t = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(p.startSize + t * p.growth);
      p.mat.opacity = Math.max(0, (1 - t) * 0.72);
    }
  }

  return { spawnTouchdownSmoke, spawnRingClear, spawnCrashBurst, update };
}
