// Smooth Chase Camera, Lit 3D Cockpit Camera, and Scenic Orbit Camera.
// Chase camera keeps clear sightline to aircraft, horizon, and targets ahead without clipping terrain.

import * as THREE from 'three';
import { getTerrainHeight } from './terrain.js';

export function createCameraRig(camera) {
  let mode = 'chase'; // 'chase' | 'cockpit' | 'orbit'
  const smoothPos = new THREE.Vector3();
  const smoothLook = new THREE.Vector3();
  let initialized = false;

  function setMode(nextMode) {
    mode = nextMode;
    initialized = false;
  }

  function toggleMode() {
    mode = mode === 'chase' ? 'cockpit' : 'chase';
    initialized = false;
    return mode;
  }

  function getMode() {
    return mode;
  }

  function snapTo(state) {
    initialized = false;
    update(state, 0.016, 0);
  }

  function update(state, dt, timeSec) {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(state.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(state.quaternion);

    if (mode === 'cockpit') {
      // Eye point inside canopy looking over the lit 3D dashboard & collimated HUD glass
      const eyeOffset = new THREE.Vector3(0, 0.78, -1.36)
        .addScaledVector(right, -state.controls.roll * 0.03)
        .addScaledVector(up, -state.controls.pitch * 0.02);
      const worldEye = eyeOffset.applyQuaternion(state.quaternion).add(state.position);
      const lookTarget = state.position
        .clone()
        .addScaledVector(fwd, 95)
        .addScaledVector(up, -11.5);

      camera.position.copy(worldEye);
      camera.up.copy(up);
      camera.lookAt(lookTarget);
      return;
    }

    if (mode === 'orbit') {
      const angle = timeSec * 0.25 + 0.55;
      const dist = 24;
      const desired = new THREE.Vector3(
        state.position.x + Math.cos(angle) * dist,
        state.position.y + 6.5,
        state.position.z + Math.sin(angle) * dist,
      );
      const minGnd = Math.max(2, getTerrainHeight(desired.x, desired.z) + 4);
      desired.y = Math.max(desired.y, minGnd);
      camera.position.copy(desired);
      camera.up.set(0, 1, 0);
      camera.lookAt(state.position);
      return;
    }

    // Chase view: elevated behind aircraft so aircraft, lit wings, horizon, and target ahead align cleanly
    const speedZoom = Math.min(2.6, state.speedMs * 0.018);
    const desiredPos = state.position
      .clone()
      .addScaledVector(fwd, -(14.5 + speedZoom))
      .addScaledVector(up, 3.6)
      .add(new THREE.Vector3(0, 1.45, 0));

    // Clamp above terrain/water so camera never clips underground
    const camGround = Math.max(0, getTerrainHeight(desiredPos.x, desiredPos.z));
    if (desiredPos.y < camGround + 2.8) {
      desiredPos.y = camGround + 2.8;
    }

    const desiredLook = state.position
      .clone()
      .addScaledVector(fwd, 36)
      .add(new THREE.Vector3(0, 1.2, 0));

    if (!initialized) {
      smoothPos.copy(desiredPos);
      smoothLook.copy(desiredLook);
      initialized = true;
    } else {
      const posBlend = 1 - Math.exp(-9.5 * dt);
      const lookBlend = 1 - Math.exp(-13.5 * dt);
      smoothPos.lerp(desiredPos, posBlend);
      smoothLook.lerp(desiredLook, lookBlend);
    }

    camera.position.copy(smoothPos);
    camera.up.set(0, 1, 0);
    camera.lookAt(smoothLook);
  }

  return { setMode, toggleMode, getMode, snapTo, update };
}
