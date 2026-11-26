// Sculpted 3D S-14 Kestrel aircraft model, animated control surfaces, retractable gear,
// navigation strobes, afterburner glow, and detailed 3D cockpit with live lit instrument MFDs.

import * as THREE from 'three';

function createAirframePanelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Brushed aircraft aluminum base
  ctx.fillStyle = '#d7e0ea';
  ctx.fillRect(0, 0, 512, 512);

  // Panel seams
  ctx.strokeStyle = 'rgba(38, 49, 64, 0.36)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  for (let x = 0; x < 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }

  // Subtle inspection panels & rivet dots
  ctx.fillStyle = 'rgba(42, 54, 68, 0.45)';
  for (let y = 8; y < 512; y += 64) {
    for (let x = 8; x < 512; x += 32) {
      ctx.fillRect(x, y, 2, 2);
      ctx.fillRect(x, y + 48, 2, 2);
    }
  }
  ctx.fillStyle = 'rgba(180, 194, 210, 0.45)';
  ctx.fillRect(66, 130, 60, 60);
  ctx.fillRect(258, 322, 60, 60);

  // High-vis tactical squadron stripe
  ctx.fillStyle = '#e66525';
  ctx.fillRect(0, 236, 512, 28);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCockpitPanelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, texture };
}

function drawAnalogDial(ctx, cx, cy, radius, title, needleAngleRad, valueText, ticks = 10, color = '#58e1ff') {
  // Recessed metallic bezel
  ctx.fillStyle = '#090d14';
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3c4a5c';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Inner dial face
  ctx.fillStyle = '#0d1520';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Scale ticks
  for (let i = 0; i <= ticks; i++) {
    const a = -Math.PI * 1.25 + (i / ticks) * (Math.PI * 1.5);
    const r0 = radius - (i % 2 === 0 ? 12 : 7);
    const r1 = radius - 3;
    ctx.strokeStyle = i >= ticks - 2 ? '#ff5b6e' : '#cfe4f8';
    ctx.lineWidth = i % 2 === 0 ? 2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }

  // Title & digital readout
  ctx.fillStyle = color;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, cx, cy - radius * 0.36);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(valueText, cx, cy + radius * 0.48);

  // Needle
  ctx.strokeStyle = '#ff9f2e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(needleAngleRad) * 10, cy - Math.sin(needleAngleRad) * 10);
  ctx.lineTo(cx + Math.cos(needleAngleRad) * (radius - 10), cy + Math.sin(needleAngleRad) * (radius - 10));
  ctx.stroke();

  ctx.fillStyle = '#cfd8e3';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawCockpitInstruments(panel, state) {
  const { ctx, canvas, texture } = panel;
  const w = canvas.width;
  const h = canvas.height;

  // Weathered brushed-gunmetal instrument panel background
  ctx.fillStyle = '#151c26';
  ctx.fillRect(0, 0, w, h);

  // Panel seam lines & corner hex bolts
  ctx.strokeStyle = '#2c3849';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.fillStyle = '#526275';
  for (const [bx, by] of [
    [18, 18], [w - 18, 18], [18, h - 18], [w - 18, h - 18],
    [336, 18], [688, 18], [336, h - 18], [688, h - 18],
  ]) {
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // LEFT BAY: Hybrid Analog Airspeed + Altimeter + Hardware Annunciators
  const spdFrac = Math.min(1, Math.max(0, state.speedKnots / 320));
  const spdAngle = -Math.PI * 1.25 + spdFrac * Math.PI * 1.5;
  drawAnalogDial(ctx, 94, 108, 66, 'IAS KT', spdAngle, `${Math.round(state.speedKnots)}`, 10, '#58e1ff');

  const altFrac = Math.min(1, Math.max(0, (state.altitudeFt % 1000) / 1000));
  const altAngle = -Math.PI * 0.5 + altFrac * Math.PI * 2;
  drawAnalogDial(ctx, 244, 108, 66, 'ALT FT', altAngle, `${Math.round(state.altitudeFt)}`, 10, '#42f59b');

  // Kollsman baro & standby annunciator panel
  ctx.fillStyle = '#0b1119';
  ctx.fillRect(28, 200, 282, 152);
  ctx.strokeStyle = '#334458';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 200, 282, 152);

  ctx.fillStyle = '#8da4bf';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('BARO 29.92 INHG   TRIM NEUTRAL', 42, 224);
  ctx.fillStyle = '#58e1ff';
  ctx.fillText(`AOA ${state.aoaDeg.toFixed(1)}°   G-LOAD ${state.gForce.toFixed(1)}G`, 42, 248);

  const lamps = [
    { label: 'GEAR', on: state.gearDown, col: '#42f59b' },
    { label: 'FLAP', on: state.flaps > 0, col: '#58e1ff' },
    { label: 'BRK', on: state.airbrake, col: '#ffaa33' },
    { label: 'AB', on: state.afterburner, col: '#ff6b35' },
    { label: 'STAL', on: state.stallWarning, col: '#ff3b52' },
  ];
  lamps.forEach((lp, i) => {
    const lx = 40 + i * 52;
    const ly = 276;
    ctx.fillStyle = lp.on ? lp.col : '#1c2635';
    ctx.fillRect(lx, ly, 46, 54);
    ctx.strokeStyle = '#3c4c63';
    ctx.strokeRect(lx, ly, 46, 54);
    ctx.fillStyle = lp.on ? '#081018' : '#647890';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(lp.label, lx + 23, ly + 32);
  });

  // CENTER BAY: Fighter Glass PFD Attitude Indicator with Softkeys
  ctx.save();
  ctx.beginPath();
  ctx.rect(356, 22, 312, 304);
  ctx.clip();

  const cx = 512;
  const cy = 174;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.rollRad);
  const pitchShift = Math.max(-88, Math.min(88, (state.pitchDeg / 45) * 88));
  ctx.translate(0, pitchShift);

  const skyGrad = ctx.createLinearGradient(0, -240, 0, 0);
  skyGrad.addColorStop(0, '#0f396b');
  skyGrad.addColorStop(1, '#2679c2');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(-260, -260, 520, 260);

  const gndGrad = ctx.createLinearGradient(0, 0, 0, 260);
  gndGrad.addColorStop(0, '#784824');
  gndGrad.addColorStop(1, '#3d2210');
  ctx.fillStyle = gndGrad;
  ctx.fillRect(-260, 0, 520, 260);

  ctx.strokeStyle = '#8ef5b0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-220, 0);
  ctx.lineTo(220, 0);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(235, 250, 255, 0.85)';
  ctx.lineWidth = 2;
  for (const deg of [-20, -10, 10, 20]) {
    const py = (-deg / 45) * 88;
    ctx.beginPath();
    ctx.moveTo(-48, py);
    ctx.lineTo(48, py);
    ctx.stroke();
  }
  ctx.restore();

  // Fixed aircraft boresight chevron & roll scale arc
  ctx.strokeStyle = '#ffbe3d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 46, cy);
  ctx.lineTo(cx - 14, cy);
  ctx.lineTo(cx, cy + 10);
  ctx.lineTo(cx + 14, cy);
  ctx.lineTo(cx + 46, cy);
  ctx.stroke();

  ctx.fillStyle = 'rgba(6, 14, 22, 0.78)';
  ctx.fillRect(364, 30, 88, 30);
  ctx.fillRect(572, 30, 88, 30);
  ctx.fillStyle = '#70ffbe';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(state.speedKnots)}KT`, 408, 50);
  ctx.fillText(`${Math.round(state.altitudeFt)}FT`, 616, 50);

  // Glass reflection sheen across PFD
  const sheen = ctx.createLinearGradient(356, 22, 668, 326);
  sheen.addColorStop(0, 'rgba(255,255,255,0.09)');
  sheen.addColorStop(0.45, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(356, 22, 312, 304);
  ctx.restore();

  ctx.strokeStyle = '#38d8ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(356, 22, 312, 304);

  // Bezel softkey labels under PFD
  ['PFD', 'ILS', 'HSI', 'NAV'].forEach((lbl, idx) => {
    const kx = 374 + idx * 72;
    ctx.fillStyle = idx === 0 ? '#2b5266' : '#1b2430';
    ctx.fillRect(kx, 336, 58, 28);
    ctx.strokeStyle = '#47596e';
    ctx.strokeRect(kx, 336, 58, 28);
    ctx.fillStyle = idx === 0 ? '#7de7ff' : '#9cb1c9';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(lbl, kx + 29, 355);
  });

  // RIGHT BAY: Moving-Map Tactical Radar + N1/EGT Gauges & Fuel/Hull Bars
  ctx.fillStyle = '#061712';
  ctx.fillRect(694, 22, 304, 210);
  ctx.strokeStyle = '#3ef5a3';
  ctx.lineWidth = 3;
  ctx.strokeRect(694, 22, 304, 210);

  const rx = 846;
  const ry = 132;
  ctx.strokeStyle = 'rgba(62, 245, 163, 0.35)';
  ctx.lineWidth = 1.5;
  for (const r of [28, 56, 84]) {
    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(rx - 84, ry);
  ctx.lineTo(rx + 84, ry);
  ctx.moveTo(rx, ry - 84);
  ctx.lineTo(rx, ry + 84);
  ctx.stroke();

  ctx.fillStyle = '#8ef5c0';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`HDG ${String(Math.round(state.headingDeg)).padStart(3, '0')}°`, 708, 46);
  ctx.fillStyle = '#ffbe3d';
  ctx.fillText(state.nextTarget ? state.nextTarget.label.slice(0, 12) : 'FREE', 858, 46);

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
    const scale = 78 / 1400;
    const px = Math.max(-78, Math.min(78, localRight * scale));
    const py = Math.max(-78, Math.min(78, -localFwd * scale));
    ctx.strokeStyle = 'rgba(255, 170, 51, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + px, ry + py);
    ctx.stroke();
    ctx.fillStyle = '#ffaa22';
    ctx.beginPath();
    ctx.arc(rx + px, ry + py, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(rx, ry - 8);
  ctx.lineTo(rx - 6, ry + 7);
  ctx.lineTo(rx + 6, ry + 7);
  ctx.closePath();
  ctx.fill();

  // Engine RPM + Fuel/Hull status bars at bottom right
  const rpmAngle = -Math.PI * 1.25 + state.throttle * Math.PI * 1.5;
  drawAnalogDial(ctx, 744, 304, 46, 'N1%', rpmAngle, `${Math.round(state.throttle * 100)}`, 8, '#ffbe4f');

  const bars = [
    { label: 'FUEL', val: state.fuel / 100, color: state.fuel < 22 ? '#ff445a' : '#4ad2ff' },
    { label: 'HULL', val: state.hull / 100, color: state.hull < 40 ? '#ff445a' : '#80f58c' },
  ];
  bars.forEach((b, idx) => {
    const by = 256 + idx * 52;
    ctx.fillStyle = '#dbe9ff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${b.label} ${Math.round(b.val * 100)}%`, 818, by + 14);
    ctx.fillStyle = '#1b2638';
    ctx.fillRect(818, by + 20, 174, 18);
    ctx.fillStyle = b.color;
    ctx.fillRect(818, by + 20, Math.max(4, b.val * 174), 18);
  });

  texture.needsUpdate = true;
}

export function createAircraft() {
  const root = new THREE.Group();
  const exteriorGroup = new THREE.Group();
  const cockpitGroup = new THREE.Group();
  root.add(exteriorGroup);
  root.add(cockpitGroup);

  const skinTex = createAirframePanelTexture();
  const hullMat = new THREE.MeshStandardMaterial({ map: skinTex, color: 0xe6edf5, roughness: 0.36, metalness: 0.52 });
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

  // Pilot helmet & headrest visible inside tinted canopy
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.3 }),
  );
  helmet.position.set(0, 0.74, -2.05);
  exteriorGroup.add(helmet);

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
