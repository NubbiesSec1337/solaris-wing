// 6-DOF quaternion aerodynamics, fuel & hull simulation, wind/turbulence,
// and runway landing vs. terrain/water crash detection.

import * as THREE from 'three';
import { AIRCRAFT_SPEC, RUNWAY } from './config.js';
import { getTerrainHeight, isOnRunway } from './terrain.js';

const UP = new THREE.Vector3(0, 1, 0);

export function createInitialFlightState(startSpec, startFuel = 100) {
  const pos = new THREE.Vector3(startSpec.x, startSpec.y, startSpec.z);
  const headingRad = (startSpec.headingDeg * Math.PI) / 180;
  // Three.js aircraft faces -Z locally; heading 0 = North (-Z), 90 = East (+X)
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -headingRad, 0, 'YXZ'));
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  const vel = fwd.multiplyScalar(startSpec.speedMs);

  return {
    position: pos,
    velocity: vel,
    quaternion: quat,
    angularVel: new THREE.Vector3(0, 0, 0),
    throttle: startSpec.speedMs > 5 ? 0.72 : 0.0,
    afterburner: false,
    gearDown: startSpec.speedMs < 5,
    flaps: startSpec.speedMs < 5 ? 1 : 0, // 0 or 1
    airbrake: false,
    fuel: startFuel,
    hull: 100,
    speedMs: startSpec.speedMs,
    speedKnots: startSpec.speedMs * AIRCRAFT_SPEC.msToKnots,
    altitudeM: startSpec.y,
    altitudeFt: startSpec.y * AIRCRAFT_SPEC.metersToFeet,
    aglM: Math.max(0, startSpec.y - getTerrainHeight(startSpec.x, startSpec.z)),
    vsiFpm: 0,
    headingDeg: startSpec.headingDeg,
    pitchDeg: 0,
    rollRad: 0,
    aoaDeg: 0,
    gForce: 1.0,
    stallWarning: false,
    onGround: startSpec.speedMs < 5,
    landed: false,
    crashed: false,
    crashReason: '',
    touchdownFpm: 0,
    controls: { pitch: 0, roll: 0, yaw: 0 },
    nextTarget: null,
  };
}

export function stepFlightPhysics(state, input, preset, dt, timeSec, onTouchdown) {
  if (state.crashed) return;

  // Throttle control
  state.throttle = Math.max(0, Math.min(1, state.throttle + input.throttleDelta * dt * 0.55));
  state.afterburner = state.throttle > 0.92 && state.fuel > 0.5;

  // Fuel burn
  if (state.fuel > 0) {
    const burnRate = state.afterburner
      ? AIRCRAFT_SPEC.fuelBurnAfterburner
      : AIRCRAFT_SPEC.fuelBurnIdle + state.throttle * AIRCRAFT_SPEC.fuelBurnMil;
    state.fuel = Math.max(0, state.fuel - burnRate * dt);
  }

  const effectiveThrottle = state.fuel > 0 ? state.throttle : 0;
  const thrustAccel =
    effectiveThrottle *
    (AIRCRAFT_SPEC.thrustBase + (state.afterburner ? AIRCRAFT_SPEC.afterburnerBonus : 0));

  // Local aircraft axes
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quaternion).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(state.quaternion).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(state.quaternion).normalize();

  // Ambient wind vector
  const windRad = (preset.windHeadingDeg * Math.PI) / 180;
  const windVec = new THREE.Vector3(
    -Math.sin(windRad) * preset.windSpeed,
    0,
    Math.cos(windRad) * preset.windSpeed,
  );
  const relVel = state.velocity.clone().sub(windVec);
  const airspeed = Math.max(0.1, relVel.length());

  const fwdSpeed = relVel.dot(fwd);
  const vertSpeedLocal = relVel.dot(up);
  const sideSpeedLocal = relVel.dot(right);

  const aoaRad = Math.atan2(-vertSpeedLocal, Math.max(8, Math.abs(fwdSpeed)));
  state.aoaDeg = (aoaRad * 180) / Math.PI;

  // Control authority scales smoothly with airspeed so controls work cleanly at every speed
  const authority = state.onGround
    ? Math.min(1, Math.max(0.18, airspeed / 35))
    : Math.min(1.15, Math.max(0.32, airspeed / 58));

  state.controls.pitch = input.pitch;
  state.controls.roll = input.roll;
  state.controls.yaw = input.yaw;

  // Target angular velocities in body frame
  const targetPitchVel = input.pitch * AIRCRAFT_SPEC.pitchRate * authority;
  const targetRollVel = -input.roll * AIRCRAFT_SPEC.rollRate * authority;
  const bankTurnRate = -right.y * 0.52 * Math.min(1, airspeed / 55);
  const targetYawVel = -input.yaw * AIRCRAFT_SPEC.yawRate * authority + bankTurnRate;

  const damp = 1 - Math.exp(-7.5 * dt);
  state.angularVel.x += (targetPitchVel - state.angularVel.x) * damp;
  state.angularVel.z += (targetRollVel - state.angularVel.z) * damp;
  state.angularVel.y += (targetYawVel - state.angularVel.y) * damp;

  // Subtle storm turbulence when airborne
  if (!state.onGround && preset.turbulence > 0.05) {
    const turb = preset.turbulence * (0.4 + 0.6 * Math.min(1, airspeed / 90));
    state.angularVel.x += Math.sin(timeSec * 3.7) * turb * 0.22 * dt;
    state.angularVel.z += Math.cos(timeSec * 4.3) * turb * 0.35 * dt;
  }

  // Stall nose-drop & warning
  state.stallWarning =
    !state.onGround && (airspeed < AIRCRAFT_SPEC.stallSpeedMs + 6 || Math.abs(state.aoaDeg) > 22);
  if (!state.onGround && airspeed < AIRCRAFT_SPEC.stallSpeedMs) {
    state.angularVel.x -= (1 - airspeed / AIRCRAFT_SPEC.stallSpeedMs) * 0.95 * dt;
  }

  // Integrate rotation
  const dq = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      state.angularVel.x * dt,
      state.angularVel.y * dt,
      state.angularVel.z * dt,
      'YXZ',
    ),
  );
  state.quaternion.multiply(dq).normalize();

  // Aerodynamic forces: balanced 1G trim at cruise speed & gentle AoA lift response
  const speedRatio = Math.min(1.35, airspeed / AIRCRAFT_SPEC.cruiseSpeedMs);
  const aoaLift = Math.max(-0.55, Math.min(1.15, 1 + aoaRad * 2.4));
  const stallPenalty = airspeed < AIRCRAFT_SPEC.stallSpeedMs ? airspeed / AIRCRAFT_SPEC.stallSpeedMs : 1;
  const liftAccel =
    9.81 * speedRatio * (AIRCRAFT_SPEC.liftSlope + state.flaps * AIRCRAFT_SPEC.flapsLiftBonus) * aoaLift * stallPenalty;

  const dragCoeff =
    AIRCRAFT_SPEC.baseDrag +
    (state.gearDown ? AIRCRAFT_SPEC.gearDrag : 0) +
    (state.flaps ? AIRCRAFT_SPEC.flapsDrag : 0) +
    (state.airbrake ? AIRCRAFT_SPEC.airbrakeDrag : 0);

  const accel = new THREE.Vector3();
  accel.addScaledVector(fwd, thrustAccel);
  accel.addScaledVector(up, liftAccel);
  accel.y -= 9.81;

  // Parasitic + induced drag opposing relative airflow
  const dragMag = dragCoeff * airspeed * airspeed * 0.0085 + Math.abs(aoaRad) * AIRCRAFT_SPEC.inducedDragFactor * airspeed * 0.06;
  accel.addScaledVector(relVel.clone().normalize(), -dragMag);

  // Weathercock lateral stability (reduces side-slip)
  accel.addScaledVector(right, -sideSpeedLocal * 1.45);
  // Subtle vertical damping toward airframe pitch alignment
  accel.addScaledVector(up, -vertSpeedLocal * 0.55);

  const prevVy = state.velocity.y;
  state.velocity.addScaledVector(accel, dt);

  // Clamp max aerodynamic velocity
  if (state.velocity.length() > AIRCRAFT_SPEC.maxSpeedMs) {
    state.velocity.setLength(AIRCRAFT_SPEC.maxSpeedMs);
  }

  state.position.addScaledVector(state.velocity, dt);

  // Keep within archipelago bounds gently (soft turn-back boundary at 2200m)
  const radial = Math.hypot(state.position.x, state.position.z);
  if (radial > 2150) {
    const inward = new THREE.Vector3(-state.position.x, 0, -state.position.z).normalize();
    state.velocity.addScaledVector(inward, (radial - 2150) * 0.35 * dt);
  }

  // Ground / ocean / runway collision handling
  const groundY = Math.max(0, getTerrainHeight(state.position.x, state.position.z));
  const clearance = state.gearDown ? 1.42 : 0.72;
  const minCenterY = groundY + clearance;

  const euler = new THREE.Euler().setFromQuaternion(state.quaternion, 'YXZ');
  const bankDeg = Math.abs((euler.z * 180) / Math.PI);
  const pitchDeg = (euler.x * 180) / Math.PI;
  const sinkFpm = -state.velocity.y * AIRCRAFT_SPEC.mpsToFpm;
  const onRw = isOnRunway(state.position.x, state.position.z);
  const overWater = getTerrainHeight(state.position.x, state.position.z) < 0.2;

  if (state.position.y <= minCenterY) {
    const wasAirborne = !state.onGround;
    if (overWater) {
      state.crashed = true;
      state.hull = 0;
      state.crashReason = 'Ocean impact — altitude dropped below sea level.';
      state.position.y = 0.7;
      state.velocity.multiplyScalar(0.1);
      return;
    }

    if (wasAirborne) {
      if (!state.gearDown) {
        state.crashed = true;
        state.hull = 0;
        state.crashReason = 'Belly impact — landing gear was retracted (press G).';
        state.position.y = minCenterY;
        state.velocity.multiplyScalar(0.15);
        return;
      }
      if (bankDeg > 24 || pitchDeg < -18) {
        state.crashed = true;
        state.hull = 0;
        state.crashReason = `Wing/nose strike on touchdown (${Math.round(bankDeg)}° bank).`;
        state.position.y = minCenterY;
        state.velocity.multiplyScalar(0.15);
        return;
      }
      if (sinkFpm > 1250 || (!onRw && sinkFpm > 720)) {
        state.crashed = true;
        state.hull = 0;
        state.crashReason = `Hard terrain impact at ${Math.round(sinkFpm)} FPM.`;
        state.position.y = minCenterY;
        state.velocity.multiplyScalar(0.15);
        return;
      }

      // Survivable touchdown!
      state.touchdownFpm = Math.round(-sinkFpm);
      const impactDmg = sinkFpm > 600 ? Math.round((sinkFpm - 600) * 0.045) : 0;
      const offRunwayDmg = onRw ? 0 : 12;
      state.hull = Math.max(0, state.hull - impactDmg - offRunwayDmg);
      if (state.hull <= 0) {
        state.crashed = true;
        state.crashReason = 'Airframe structural failure from rough touchdown.';
        return;
      }
      if (onTouchdown) {
        onTouchdown(state, onRw, Math.round(sinkFpm));
      }
    }

    // Ground roll physics
    state.onGround = true;
    state.position.y = minCenterY;
    if (state.velocity.y < 0) state.velocity.y = 0;

    // Level wings gradually on ground
    const flatEuler = new THREE.Euler(
      Math.max(-0.04, Math.min(0.24, euler.x)),
      euler.y,
      euler.z * Math.exp(-8 * dt),
      'YXZ',
    );
    state.quaternion.setFromEuler(flatEuler);

    // Wheel friction & braking
    const brakeFactor = state.airbrake ? 1.85 : onRw ? 0.18 : 0.72;
    const horizSpeed = Math.hypot(state.velocity.x, state.velocity.z);
    if (horizSpeed > 0.2) {
      const decel = Math.min(horizSpeed, (brakeFactor * 11 + (state.throttle < 0.08 ? 4.5 : 0)) * dt);
      const scale = (horizSpeed - decel) / horizSpeed;
      state.velocity.x *= scale;
      state.velocity.z *= scale;
    } else if (state.throttle < 0.05) {
      state.velocity.set(0, 0, 0);
    }

    // Check full stop on runway for sortie completion
    if (onRw && state.velocity.length() < 3.2 && state.throttle < 0.12) {
      state.landed = true;
    }
  } else {
    state.onGround = false;
  }

  // Update telemetry readouts
  state.speedMs = state.velocity.length();
  state.speedKnots = state.speedMs * AIRCRAFT_SPEC.msToKnots;
  state.altitudeM = state.position.y;
  state.altitudeFt = state.position.y * AIRCRAFT_SPEC.metersToFeet;
  state.aglM = Math.max(0, state.position.y - groundY);
  state.vsiFpm = state.velocity.y * AIRCRAFT_SPEC.mpsToFpm;
  state.gForce = Math.max(0.2, Math.min(9.0, 1 + (state.velocity.y - prevVy) / (9.81 * Math.max(0.004, dt))));

  // Heading: 0 = North (-Z), 90 = East (+X), 180 = South (+Z), 270 = West (-X)
  const heading = (Math.atan2(fwd.x, -fwd.z) * 180) / Math.PI;
  state.headingDeg = (heading + 360) % 360;
  state.pitchDeg = (Math.asin(Math.max(-1, Math.min(1, fwd.y))) * 180) / Math.PI;
  state.rollRad = Math.atan2(right.y, up.dot(UP));
}
