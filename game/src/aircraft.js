// Sculpted 3D S-14 Kestrel aircraft model, animated control surfaces, retractable gear,
// navigation strobes, afterburner glow, and detailed 3D cockpit with live lit instrument MFDs.

import * as THREE from 'three';

function createCockpitPanelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, texture };
}

function drawCockpitInstruments(panel, state) {
  const { ctx, canvas, texture } = panel;
  const w = canvas.width;
  const h = canvas.height;

  // Dark weathered bezel background
  ctx.fillStyle = '#0d131b';
  ctx.fillRect(0, 0, w, h);

  // Subtle panel screws & metallic trim
  ctx.strokeStyle = '#2c3948';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  // LEFT MFD: Artificial Horizon & Attitude Indicator
  ctx.save();
  ctx.beginPath();
  ctx.rect(18, 16, 146, 160);
  ctx.clip();

  ctx.fillStyle = '#07141e';
  ctx.fillRect(18, 16, 146, 160);

  const cx = 91;
  const cy = 96;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.rollRad);
  const pitchShift = Math.max(-44, Math.min(44, (state.pitchDeg / 45) * 44));
  ctx.translate(0, pitchShift);

  ctx.fillStyle = '#1b5f9e';
  ctx.fillRect(-120, -140, 240, 140);
  ctx.fillStyle = '#6b4226';
  ctx.fillRect(-120, 0, 240, 140);
  ctx.strokeStyle = '#8ef5b0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-90, 0);
  ctx.lineTo(90, 0);
  ctx.stroke();

  // Pitch rungs inside ADI
  ctx.strokeStyle = 'rgba(235, 250, 255, 0.75)';
  ctx.lineWidth = 1.4;
  for (const deg of [-20, -10, 10, 20]) {
    const py = (-deg / 45) * 44;
    ctx.beginPath();
    ctx.moveTo(-22, py);
    ctx.lineTo(22, py);
    ctx.stroke();
  }
  ctx.restore();

  // Fixed miniature aircraft reference symbol
  ctx.strokeStyle = '#ffbe3d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy);
  ctx.lineTo(cx - 7, cy);
  ctx.lineTo(cx, cy + 5);
  ctx.lineTo(cx + 7, cy);
  ctx.lineTo(cx + 24, cy);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = '#38d8ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 16, 146, 160);
  ctx.fillStyle = '#7de7ff';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('PFD ATTITUDE', 26, 30);

  // CENTER MFD: Navigation / Radar + Heading & Target Bearing
  ctx.fillStyle = '#061712';
  ctx.fillRect(182, 16, 148, 160);
  ctx.strokeStyle = '#3ef5a3';
  ctx.lineWidth = 2;
  ctx.strokeRect(182, 16, 148, 160);

  const rx = 256;
  const ry = 104;
  ctx.strokeStyle = 'rgba(62, 245, 163, 0.32)';
  ctx.lineWidth = 1;
  for (const r of [20, 40, 56]) {
    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(rx - 56, ry);
  ctx.lineTo(rx + 56, ry);
  ctx.moveTo(rx, ry - 56);
  ctx.lineTo(rx, ry + 56);
  ctx.stroke();

  // Heading & target bug on ND
  ctx.fillStyle = '#8ef5c0';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`HDG ${String(Math.round(state.headingDeg)).padStart(3, '0')}`, 192, 32);
  ctx.fillStyle = '#ffbe3d';
  ctx.fillText(`SPD ${Math.round(state.speedKnots)}KT`, 262, 32);

  if (state.nextTarget) {
    const dx = state.nextTarget.x - state.position.x;
    const dz = state.nextTarget.z - state.position.z;
    const hdgRad = (state.headingDeg * Math.PI) / 180;
    const fwdX = Math.sin(hdgRad);
    const fwdZ = -Math.cos(hdgRad);
    const rightX = Math.cos(hdgRad);
    const rightZ = Math.sin(hdgRad);
    const localFwd = dx * fwdX + dz * fwdZ;
    const localRight = dx * rightX + dz * rightZ;
    const scale = 52 / 1400;
    const px = Math.max(-52, Math.min(52, localRight * scale));
    const py = Math.max(-52, Math.min(52, -localFwd * scale));
    ctx.fillStyle = '#ffaa22';
    ctx.beginPath();
    ctx.arc(rx + px, ry + py, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Aircraft center triangle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(rx, ry - 6);
  ctx.lineTo(rx - 5, ry + 5);
  ctx.lineTo(rx + 5, ry + 5);
  ctx.closePath();
  ctx.fill();

  // RIGHT MFD: Engine / Fuel / Altitude / Systems
  ctx.fillStyle = '#0c131f';
  ctx.fillRect(348, 16, 146, 160);
  ctx.strokeStyle = '#ffaa33';
  ctx.lineWidth = 2;
  ctx.strokeRect(348, 16, 146, 160);

  ctx.fillStyle = '#ffbe4f';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('EICAS / SYS', 356, 30);

  const bars = [
    { label: 'THR', val: state.throttle, color: state.afterburner ? '#ff6b35' : '#43f59b' },
    { label: 'FUEL', val: state.fuel / 100, color: state.fuel < 22 ? '#ff445a' : '#4ad2ff' },
    { label: 'HULL', val: state.hull / 100, color: state.hull < 40 ? '#ff445a' : '#80f58c' },
  ];
  bars.forEach((b, idx) => {
    const bx = 358 + idx * 44;
    ctx.fillStyle = '#1b2638';
    ctx.fillRect(bx, 42, 28, 76);
    const fillH = Math.max(2, Math.min(76, b.val * 76));
    ctx.fillStyle = b.color;
    ctx.fillRect(bx, 42 + (76 - fillH), 28, fillH);
    ctx.fillStyle = '#dbe9ff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(b.label, bx + 1, 132);
  });

  // Gear / Flaps / Brake status lights at bottom right
  const badges = [
    { label: 'GEAR', on: state.gearDown, col: '#42f59b' },
    { label: 'FLAP', on: state.flaps > 0, col: '#58e1ff' },
    { label: 'BRK', on: state.airbrake, col: '#ffaa33' },
  ];
  badges.forEach((bg, idx) => {
    const x = 356 + idx * 44;
    ctx.fillStyle = bg.on ? bg.col : '#253142';
    ctx.fillRect(x, 144, 38, 22);
    ctx.fillStyle = bg.on ? '#081018' : '#71849c';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(bg.label, x + 5, 159);
  });

  texture.needsUpdate = true;
}

export function createAircraft() {
  const root = new THREE.Group();
  const exteriorGroup = new THREE.Group();
  const cockpitGroup = new THREE.Group();
  root.add(exteriorGroup);
  root.add(cockpitGroup);

  const hullMat = new THREE.MeshStandardMaterial({ color: 0xd9e1ea, roughness: 0.34, metalness: 0.55 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x262e3a, roughness: 0.45, metalness: 0.75 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xe66525, roughness: 0.38, metalness: 0.35 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x4ca6d8,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.46,
  });

  // Main fuselage (forward along -Z in local Three.js space)
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.74, 7.6, 14), hullMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  exteriorGroup.add(fuselage);

  // Nose radome
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.7, 14), darkMetalMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -5.15;
  nose.castShadow = true;
  exteriorGroup.add(nose);

  // Orange livery spine stripe
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 5.4), accentMat);
  spine.position.set(0, 0.64, 0.6);
  exteriorGroup.add(spine);

  // Canopy dome
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.64, 16, 12), glassMat);
  canopy.scale.set(0.86, 0.72, 2.25);
  canopy.position.set(0, 0.54, -2.05);
  exteriorGroup.add(canopy);

  // Side engine intakes
  for (const side of [-1, 1]) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 3.2), darkMetalMat);
    intake.position.set(side * 0.72, -0.06, -0.5);
    intake.castShadow = true;
    exteriorGroup.add(intake);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 2.4), accentMat);
    stripe.position.set(side * 0.73, 0.08, -0.4);
    exteriorGroup.add(stripe);
  }

  // Swept main wings
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -1.3);
  wingShape.lineTo(4.7, 0.9);
  wingShape.lineTo(4.7, 1.85);
  wingShape.lineTo(0, 1.45);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.12, bevelEnabled: false });
  wingGeo.rotateX(Math.PI / 2);

  const rightWing = new THREE.Mesh(wingGeo, hullMat);
  rightWing.position.set(0.55, 0.06, -0.4);
  rightWing.castShadow = true;
  exteriorGroup.add(rightWing);

  const leftWing = rightWing.clone();
  leftWing.scale.x = -1;
  leftWing.position.x = -0.55;
  exteriorGroup.add(leftWing);

  // Wingtip accent rails & navigation lights
  const portLightMat = new THREE.MeshBasicMaterial({ color: 0xff3048 });
  const stbdLightMat = new THREE.MeshBasicMaterial({ color: 0x30ff84 });
  const tailStrobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const portPod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.35, 8), accentMat);
  portPod.rotation.x = Math.PI / 2;
  portPod.position.set(-5.25, 0.0, 0.95);
  exteriorGroup.add(portPod);

  const stbdPod = portPod.clone();
  stbdPod.position.x = 5.25;
  exteriorGroup.add(stbdPod);

  const portNav = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), portLightMat);
  portNav.position.set(-5.25, 0.0, 0.25);
  exteriorGroup.add(portNav);

  const stbdNav = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), stbdLightMat);
  stbdNav.position.set(5.25, 0.0, 0.25);
  exteriorGroup.add(stbdNav);

  // Moving ailerons
  const aileronGeo = new THREE.BoxGeometry(1.9, 0.08, 0.42);
  const leftAileron = new THREE.Mesh(aileronGeo, accentMat);
  leftAileron.position.set(-3.4, 0.02, 1.48);
  exteriorGroup.add(leftAileron);

  const rightAileron = new THREE.Mesh(aileronGeo, accentMat);
  rightAileron.position.set(3.4, 0.02, 1.48);
  exteriorGroup.add(rightAileron);

  // Horizontal stabilizers + animated elevators
  const hStabGeo = new THREE.BoxGeometry(3.4, 0.09, 0.95);
  const hStab = new THREE.Mesh(hStabGeo, darkMetalMat);
  hStab.position.set(0, 0.08, 3.3);
  hStab.castShadow = true;
  exteriorGroup.add(hStab);

  const elevatorPivot = new THREE.Group();
  elevatorPivot.position.set(0, 0.08, 3.78);
  const elevatorMesh = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.08, 0.44), accentMat);
  elevatorMesh.position.z = 0.2;
  elevatorPivot.add(elevatorMesh);
  exteriorGroup.add(elevatorPivot);

  // Twin canted vertical tail fins + rudders
  const rudders = [];
  for (const side of [-1, 1]) {
    const finGroup = new THREE.Group();
    finGroup.position.set(side * 0.72, 0.45, 3.15);
    finGroup.rotation.z = -side * 0.24;

    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.45, 1.25), hullMat);
    fin.position.y = 0.68;
    fin.castShadow = true;
    finGroup.add(fin);

    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 1.05), accentMat);
    tip.position.y = 1.32;
    finGroup.add(tip);

    const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.1, 0.42), accentMat);
    rudder.position.set(0, 0.62, 0.72);
    finGroup.add(rudder);
    rudders.push(rudder);

    exteriorGroup.add(finGroup);
  }

  const tailStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), tailStrobeMat);
  tailStrobe.position.set(0, 0.65, 3.9);
  exteriorGroup.add(tailStrobe);

  // Ventral airbrake flap
  const airbrakePivot = new THREE.Group();
  airbrakePivot.position.set(0, 0.66, 1.65);
  const airbrakePanel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 1.15), accentMat);
  airbrakePanel.position.z = 0.55;
  airbrakePivot.add(airbrakePanel);
  exteriorGroup.add(airbrakePivot);

  // Twin engine nozzles + glowing afterburner cones
  const abFlames = [];
  const abFlameMat = new THREE.MeshBasicMaterial({
    color: 0xff8c2b,
    transparent: true,
    opacity: 0.85,
  });
  for (const side of [-0.34, 0.34]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.23, 0.65, 12), darkMetalMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(side, -0.02, 3.92);
    exteriorGroup.add(nozzle);

    const glowRing = new THREE.Mesh(
      new THREE.CircleGeometry(0.21, 12),
      new THREE.MeshBasicMaterial({ color: 0xffb347 }),
    );
    glowRing.position.set(side, -0.02, 4.26);
    exteriorGroup.add(glowRing);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.3, 10), abFlameMat);
    flame.rotation.x = Math.PI / 2;
    flame.position.set(side, -0.02, 5.4);
    exteriorGroup.add(flame);
    abFlames.push(flame);
  }

  // Retractable tricycle landing gear
  const gearGroup = new THREE.Group();
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.9 });
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x9aa6b5, metalness: 0.8, roughness: 0.3 });

  const gearSpecs = [
    { x: 0, y: -0.52, z: -3.25, radius: 0.24 },
    { x: -1.35, y: -0.45, z: 0.65, radius: 0.30 },
    { x: 1.35, y: -0.45, z: 0.65, radius: 0.30 },
  ];
  for (const gs of gearSpecs) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), strutMat);
    strut.position.set(gs.x, gs.y - 0.42, gs.z);
    gearGroup.add(strut);

    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(gs.radius, gs.radius, 0.18, 12), tireMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(gs.x, gs.y - 0.86, gs.z);
    gearGroup.add(wheel);
  }
  exteriorGroup.add(gearGroup);

  // ---------------- DETAILED 3D COCKPIT INTERIOR ----------------
  const cockpitPanel = createCockpitPanelTexture();

  // Dark cockpit tub, slim upper visor glare shield, and illuminated console frame
  const tubMat = new THREE.MeshStandardMaterial({ color: 0x18202c, roughness: 0.78, metalness: 0.35 });
  const consoleBezel = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.44, 0.16), tubMat);
  consoleBezel.position.set(0, 0.41, -2.26);
  consoleBezel.rotation.x = -0.18;
  cockpitGroup.add(consoleBezel);

  const coamingVisor = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.06, 0.46), tubMat);
  coamingVisor.position.set(0, 0.62, -2.42);
  cockpitGroup.add(coamingVisor);

  // Side consoles with backlit status strips
  for (const side of [-1, 1]) {
    const consoleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.30, 1.35), tubMat);
    consoleMesh.position.set(side * 0.56, 0.28, -2.05);
    cockpitGroup.add(consoleMesh);

    const statusStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.02, 0.58),
      new THREE.MeshBasicMaterial({ color: side < 0 ? 0x38ff9c : 0xffaa33 }),
    );
    statusStrip.position.set(side * 0.53, 0.44, -2.02);
    cockpitGroup.add(statusStrip);
  }

  // Lit multi-function instrument dashboard (unobstructed & slightly tilted toward pilot)
  const mfdScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.08, 0.39),
    new THREE.MeshBasicMaterial({ map: cockpitPanel.texture }),
  );
  mfdScreen.position.set(0, 0.42, -2.17);
  mfdScreen.rotation.x = -0.18;
  cockpitGroup.add(mfdScreen);

  // Illuminated caution/master-arm LED indicators along upper console brow
  const ledColors = [0x42f59b, 0x42f59b, 0x58e1ff, 0xffaa33, 0x42f59b];
  ledColors.forEach((col, i) => {
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.022, 0.02),
      new THREE.MeshBasicMaterial({ color: col }),
    );
    led.position.set(-0.22 + i * 0.11, 0.59, -2.21);
    cockpitGroup.add(led);
  });

  // Canopy framing arch & windshield struts
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x222a34, roughness: 0.5, metalness: 0.7 });
  const canopyArch = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.032, 8, 24, Math.PI), frameMat);
  canopyArch.position.set(0, 0.54, -2.35);
  cockpitGroup.add(canopyArch);

  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.85, 8), frameMat);
    strut.position.set(side * 0.38, 0.70, -2.55);
    strut.rotation.x = 0.78;
    strut.rotation.z = side * 0.32;
    cockpitGroup.add(strut);
  }

  // Collimated HUD glass combiner above glare shield
  const hudFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.30, 0.012),
    new THREE.MeshBasicMaterial({ color: 0x45ffaa, transparent: true, opacity: 0.12 }),
  );
  hudFrame.position.set(0, 0.76, -2.36);
  hudFrame.rotation.x = -0.30;
  cockpitGroup.add(hudFrame);

  // Animated center control stick
  const stickPivot = new THREE.Group();
  stickPivot.position.set(0, 0.10, -1.86);
  const stickShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.28, 8), darkMetalMat);
  stickShaft.position.y = 0.14;
  stickPivot.add(stickShaft);
  const stickGrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.06), accentMat);
  stickGrip.position.y = 0.28;
  stickPivot.add(stickGrip);
  cockpitGroup.add(stickPivot);

  // Animated left-hand throttle lever
  const throttlePivot = new THREE.Group();
  throttlePivot.position.set(-0.46, 0.34, -2.02);
  const throttleArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.11), accentMat);
  throttlePivot.add(throttleArm);
  cockpitGroup.add(throttlePivot);

  function updateVisuals(state, timeSec, isCockpitView) {
    root.position.copy(state.position);
    root.quaternion.copy(state.quaternion);

    // Toggle exterior nose/cockpit clarity in 1st-person cockpit view
    exteriorGroup.visible = !isCockpitView;
    cockpitGroup.visible = isCockpitView;

    // Control surfaces
    leftAileron.rotation.x = state.controls.roll * 0.45;
    rightAileron.rotation.x = -state.controls.roll * 0.45;
    elevatorPivot.rotation.x = state.controls.pitch * 0.42;
    for (const r of rudders) {
      r.rotation.y = state.controls.yaw * 0.42;
    }
    airbrakePivot.rotation.x = state.airbrake ? 0.65 : 0;
    gearGroup.visible = state.gearDown;

    // Stick & throttle animations in cockpit
    stickPivot.rotation.x = state.controls.pitch * 0.32;
    stickPivot.rotation.z = -state.controls.roll * 0.36;
    throttlePivot.position.z = -1.92 - state.throttle * 0.24;

    // Afterburner & throttle plume scaling
    const plumeScale = state.throttle > 0.15 ? 0.25 + state.throttle * (state.afterburner ? 1.55 : 0.72) : 0.01;
    abFlameMat.color.setHex(state.afterburner ? 0x6ce2ff : 0xff8c2b);
    abFlameMat.opacity = state.throttle > 0.15 ? (state.afterburner ? 0.92 : 0.62) : 0;
    for (const f of abFlames) {
      f.scale.set(1, plumeScale + Math.sin(timeSec * 45) * 0.08, 1);
    }

    // Navigation strobes
    const strobe = Math.sin(timeSec * 9.5) > 0.78;
    tailStrobeMat.color.setHex(strobe ? 0xffffff : 0x3b4250);

    if (isCockpitView) {
      drawCockpitInstruments(cockpitPanel, state);
    }
  }

  return { root, updateVisuals };
}
