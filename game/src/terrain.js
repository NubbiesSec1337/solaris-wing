// Procedural volcanic archipelago terrain, Runway 09/27 airfield with live PAPI lights,
// coastal lighthouse, basalt sea arch, offshore carrier barge, and drifting cloud deck.

import * as THREE from 'three';
import { RUNWAY } from './config.js';

function hash2d(ix, iz) {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2d(ix, iz);
  const b = hash2d(ix + 1, iz);
  const c = hash2d(ix, iz + 1);
  const d = hash2d(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x, z, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, z * freq);
    freq *= 2.04;
    amp *= 0.48;
  }
  return sum;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function gaussian(dx, dz, sx, sz) {
  return Math.exp(-((dx * dx) / (2 * sx * sx) + (dz * dz) / (2 * sz * sz)));
}

/**
 * Deterministic heightmap for the Solaris Archipelago (in meters above sea level).
 * Includes flat Runway 09/27 plateau, towering volcanic caldera, alpine fjord, and outer islands.
 */
export function getTerrainHeight(x, z) {
  const n1 = fbm(x * 0.0014 + 4.2, z * 0.0014 - 2.1, 4);
  const n2 = fbm(x * 0.0045 - 1.3, z * 0.0045 + 7.7, 3);
  const ridge = 1 - Math.abs(n2 * 2 - 1);

  // Main landmass envelope
  let h = -24;

  // Airfield peninsula around (-220, 0)
  h += 38 * gaussian(x + 210, z, 480, 270);

  // Dramatic volcanic caldera at (920, -245)
  const calDx = x - 920;
  const calDz = z + 245;
  const calDist = Math.hypot(calDx, calDz);
  const calBase = 415 * Math.exp(-(calDist * calDist) / (2 * 440 * 440));
  const rimBump = 145 * Math.exp(-Math.pow((calDist - 235) / 88, 2)) * (0.78 + 0.35 * ridge);
  const craterBowl = 225 * Math.exp(-(calDist * calDist) / (2 * 135 * 135));
  h += calBase + rimBump - craterBowl;

  // Northern alpine fjord massif & canyon walls
  const fjordWallN = 320 * gaussian(x - 360, z + 960, 480, 210) * (0.7 + 0.55 * ridge);
  const fjordWallS = 240 * gaussian(x - 420, z + 430, 390, 150) * (0.65 + 0.5 * n1);
  const fjordChannel = 155 * gaussian(x - 380, z + 680, 540, 115);
  h += fjordWallN + fjordWallS - fjordChannel;

  // Eastern coastal cliffs
  h += 210 * gaussian(x - 950, z - 440, 260, 280) * (0.7 + 0.45 * n1);

  // Southern Lighthouse island
  h += 62 * gaussian(x - 340, z - 880, 220, 190) * (0.75 + 0.4 * n2);

  // Distant scenic peaks along perimeter
  h += 260 * gaussian(x + 1150, z + 1050, 380, 360) * (0.65 + 0.5 * ridge);
  h += 220 * gaussian(x - 1450, z - 980, 420, 380) * (0.7 + 0.45 * ridge);

  // Fine organic terrain relief
  if (h > -8) {
    h += (n1 - 0.45) * 48 + (ridge - 0.4) * 26;
  }

  // Carve flat coastal plateau around Runway 09/27
  const rwDx = Math.max(0, Math.abs(x - RUNWAY.centerX) - RUNWAY.length * 0.56);
  const rwDz = Math.max(0, Math.abs(z - RUNWAY.centerZ) - 92);
  const rwDist = Math.hypot(rwDx, rwDz);
  const padMask = 1 - smoothstep(10, 175, rwDist);
  h = h * (1 - padMask) + (RUNWAY.elevation - 0.12) * padMask;

  // Carve flat pad for lighthouse helipad (350, 890)
  const lhDist = Math.hypot(x - 350, z - 890);
  const lhMask = 1 - smoothstep(28, 72, lhDist);
  h = h * (1 - lhMask) + 28 * lhMask;

  // Carve flat pad for North Fjord Outpost (420, -820)
  const nfDist = Math.hypot(x - 420, z + 820);
  const nfMask = 1 - smoothstep(28, 72, nfDist);
  h = h * (1 - nfMask) + 42 * nfMask;

  // Carve flat pad for East Volcano Camp (1040, 160)
  const evDist = Math.hypot(x - 1040, z - 160);
  const evMask = 1 - smoothstep(28, 75, evDist);
  h = h * (1 - evMask) + 82 * evMask;

  return h;
}

export function isOnRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.centerX) <= RUNWAY.length * 0.52 &&
    Math.abs(z - RUNWAY.centerZ) <= RUNWAY.width * 0.65
  );
}

function createRunwayTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Asphalt base
  ctx.fillStyle = '#252a33';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle tire rubber wear along centerline
  const wear = ctx.createLinearGradient(0, 80, 0, 176);
  wear.addColorStop(0, 'rgba(18, 20, 26, 0)');
  wear.addColorStop(0.5, 'rgba(14, 16, 20, 0.55)');
  wear.addColorStop(1, 'rgba(18, 20, 26, 0)');
  ctx.fillStyle = wear;
  ctx.fillRect(140, 75, canvas.width - 280, 106);

  // Edge stripes
  ctx.fillStyle = '#e7edf5';
  ctx.fillRect(28, 14, canvas.width - 56, 6);
  ctx.fillRect(28, canvas.height - 20, canvas.width - 56, 6);

  // Threshold piano keys (both ends)
  for (const baseX of [48, canvas.width - 138]) {
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(baseX, 28 + i * 35, 90, 18);
    }
  }

  // Runway numbers 09 (west) and 27 (east)
  ctx.fillStyle = '#f2f6fc';
  ctx.font = 'bold 54px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(210, 128);
  ctx.rotate(Math.PI / 2);
  ctx.fillText('09', 0, 0);
  ctx.restore();

  ctx.save();
  ctx.translate(canvas.width - 210, 128);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('27', 0, 0);
  ctx.restore();

  // Touchdown bars
  for (const bx of [320, canvas.width - 375]) {
    ctx.fillRect(bx, 54, 54, 14);
    ctx.fillRect(bx, canvas.height - 68, 54, 14);
  }

  // Centerline dashes
  for (let x = 290; x < canvas.width - 290; x += 86) {
    ctx.fillRect(x, 124, 48, 8);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildTerrainMesh() {
  const size = 4600;
  const segs = 192;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getTerrainHeight(x, z);
    pos.setY(i, y);

    const calDist = Math.hypot(x - 920, z + 245);
    if (y < -1) {
      c.setRGB(0.08, 0.24, 0.30);
    } else if (y < 4.5) {
      // Warm coastal sand
      c.setRGB(0.79, 0.72, 0.56);
    } else if (y < 52) {
      // Lush emerald coastal meadow
      const t = (y - 4.5) / 47.5;
      c.setRGB(0.18 + t * 0.06, 0.44 - t * 0.08, 0.22 - t * 0.04);
    } else if (y < 180) {
      // Alpine ridge & basalt slope
      const t = (y - 52) / 128;
      c.setRGB(0.24 + t * 0.14, 0.34 - t * 0.06, 0.20 + t * 0.06);
    } else if (y < 330) {
      // Volcanic basalt rock
      const t = (y - 180) / 150;
      c.setRGB(0.32 + t * 0.12, 0.27 + t * 0.09, 0.24 + t * 0.09);
    } else {
      // Sunlit volcanic snow/ash peaks
      c.setRGB(0.78, 0.80, 0.85);
    }

    // Subtle high-frequency terrain micro-contrast for recognizable slopes
    const micro = hash2d(Math.round(x * 0.08), Math.round(z * 0.08)) * 0.06 - 0.03;
    c.offsetHSL(0, 0, micro);

    // Geothermal amber tint inside volcano crater
    if (calDist < 120 && y < 270) {
      c.lerp(new THREE.Color(0xc95a24), 0.48);
    }

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.04,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

function buildAirfield() {
  const group = new THREE.Group();

  // Concrete apron
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x3b424d, roughness: 0.88 });
  const apron = new THREE.Mesh(new THREE.BoxGeometry(220, 0.35, 74), apronMat);
  apron.position.set(-220, RUNWAY.elevation - 0.15, -48);
  apron.receiveShadow = true;
  group.add(apron);

  // Runway strip
  const runwayTex = createRunwayTexture();
  const runwayMat = new THREE.MeshStandardMaterial({
    map: runwayTex,
    roughness: 0.82,
    metalness: 0.08,
  });
  const runway = new THREE.Mesh(new THREE.BoxGeometry(RUNWAY.length, 0.32, RUNWAY.width), runwayMat);
  runway.position.set(RUNWAY.centerX, RUNWAY.elevation - 0.12, RUNWAY.centerZ);
  runway.receiveShadow = true;
  group.add(runway);

  // Edge lights (left & right of runway)
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xfff1c4 });
  const edgeGeo = new THREE.SphereGeometry(0.45, 6, 6);
  for (let x = RUNWAY.thresholdWestX; x <= RUNWAY.thresholdEastX; x += 38) {
    for (const zOff of [-RUNWAY.width * 0.5 - 1.2, RUNWAY.width * 0.5 + 1.2]) {
      const bulb = new THREE.Mesh(edgeGeo, edgeMat);
      bulb.position.set(x, RUNWAY.elevation + 0.38, zOff);
      group.add(bulb);
    }
  }

  // Green threshold lights (west end, RWY 09) & red end lights (east end)
  const greenMat = new THREE.MeshBasicMaterial({ color: 0x38ff8c });
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff3b52 });
  for (let z = -15; z <= 15; z += 6) {
    const gBulb = new THREE.Mesh(edgeGeo, greenMat);
    gBulb.position.set(RUNWAY.thresholdWestX - 8, RUNWAY.elevation + 0.42, z);
    group.add(gBulb);

    const rBulb = new THREE.Mesh(edgeGeo, redMat);
    rBulb.position.set(RUNWAY.thresholdEastX + 8, RUNWAY.elevation + 0.42, z);
    group.add(rBulb);
  }

  // PAPI 4-light precision approach path indicator (south/north side of RWY 09)
  const papiLights = [];
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.7 });
  for (let i = 0; i < 4; i++) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.2), housingMat);
    housing.position.set(RUNWAY.papiX, RUNWAY.elevation + 0.7, RUNWAY.papiZ - i * 3.6);
    group.add(housing);

    const lampMat = new THREE.MeshBasicMaterial({ color: i < 2 ? 0xffffff : 0xff3040 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.78, 10, 10), lampMat);
    lamp.position.set(RUNWAY.papiX - 1.1, RUNWAY.elevation + 0.85, RUNWAY.papiZ - i * 3.6);
    group.add(lamp);
    papiLights.push(lampMat);
  }

  // Two hangars with extruded semi-circular barrel-vault roofs
  const hangarMat = new THREE.MeshStandardMaterial({ color: 0x627082, roughness: 0.65, metalness: 0.35 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd96b27, roughness: 0.5 });
  const roofShape = new THREE.Shape();
  roofShape.absarc(0, 0, 15.2, 0, Math.PI, false);
  roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 44, bevelEnabled: false });
  roofGeo.translate(0, 0, -22);
  roofGeo.rotateY(Math.PI / 2);

  for (const hx of [-295, -165]) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(44, 14, 30), hangarMat);
    body.position.set(hx, RUNWAY.elevation + 7, -64);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(hx, RUNWAY.elevation + 14, -64);
    roof.castShadow = true;
    group.add(roof);
  }

  // Control tower with glowing cab + rotating radar dish
  const towerShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 5.4, 28, 10),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.6 }),
  );
  towerShaft.position.set(RUNWAY.towerPos.x, RUNWAY.elevation + 14, RUNWAY.towerPos.z);
  towerShaft.castShadow = true;
  group.add(towerShaft);

  const towerCab = new THREE.Mesh(
    new THREE.CylinderGeometry(7.2, 5.2, 5.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x56d8ff, emissive: 0x1c759e, emissiveIntensity: 0.9, roughness: 0.2 }),
  );
  towerCab.position.set(RUNWAY.towerPos.x, RUNWAY.elevation + 29.5, RUNWAY.towerPos.z);
  group.add(towerCab);

  const towerRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(7.8, 7.8, 1.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x26303d, roughness: 0.7 }),
  );
  towerRoof.position.set(RUNWAY.towerPos.x, RUNWAY.elevation + 32.8, RUNWAY.towerPos.z);
  group.add(towerRoof);

  const radarPivot = new THREE.Group();
  radarPivot.position.set(RUNWAY.towerPos.x, RUNWAY.elevation + 35, RUNWAY.towerPos.z);
  const radarBar = new THREE.Mesh(
    new THREE.BoxGeometry(7.5, 1.1, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0x552200 }),
  );
  radarPivot.add(radarBar);
  group.add(radarPivot);

  // Windsock near west threshold
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 9, 6),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }),
  );
  pole.position.set(-415, RUNWAY.elevation + 4.5, 32);
  group.add(pole);

  const windsockPivot = new THREE.Group();
  windsockPivot.position.set(-415, RUNWAY.elevation + 8.8, 32);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 5.2, 8, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xff6622, side: THREE.DoubleSide }),
  );
  sock.rotation.z = -Math.PI / 2;
  sock.position.x = 2.6;
  windsockPivot.add(sock);
  group.add(windsockPivot);

  return { group, papiLights, radarPivot, windsockPivot };
}

function buildLandmarks() {
  const group = new THREE.Group();

  // Basalt Sea Arch at (430, 0, 685) oriented for dramatic fly-throughs
  const archMat = new THREE.MeshStandardMaterial({ color: 0x45413e, roughness: 0.92, flatShading: true });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(62, 14, 9, 20, Math.PI), archMat);
  arch.position.set(430, 12, 685);
  arch.rotation.y = Math.PI * 0.38;
  arch.castShadow = true;
  arch.receiveShadow = true;
  group.add(arch);

  // Coastal Lighthouse at (350, 28, 890)
  const lhX = 350;
  const lhZ = 890;
  const lhBaseY = getTerrainHeight(lhX, lhZ);
  const lhTower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.8, 5.0, 34, 12),
    new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.5 }),
  );
  lhTower.position.set(lhX, lhBaseY + 17, lhZ);
  lhTower.castShadow = true;
  group.add(lhTower);

  const lhStripe = new THREE.Mesh(
    new THREE.CylinderGeometry(3.55, 4.1, 10, 12),
    new THREE.MeshStandardMaterial({ color: 0xd93829, roughness: 0.5 }),
  );
  lhStripe.position.set(lhX, lhBaseY + 20, lhZ);
  group.add(lhStripe);

  const lhBeacon = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 4.2, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe484 }),
  );
  lhBeacon.position.set(lhX, lhBaseY + 35.5, lhZ);
  group.add(lhBeacon);

  // Offshore Carrier / Helideck Barge at (-940, 0, 580)
  const bargeGroup = new THREE.Group();
  bargeGroup.position.set(-940, 2.2, 580);
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(110, 8, 36),
    new THREE.MeshStandardMaterial({ color: 0x2c3644, roughness: 0.75 }),
  );
  hull.castShadow = true;
  hull.receiveShadow = true;
  bargeGroup.add(hull);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(106, 0.5, 32),
    new THREE.MeshStandardMaterial({ color: 0x3f4956, roughness: 0.85 }),
  );
  deck.position.y = 4.2;
  bargeGroup.add(deck);

  const island = new THREE.Mesh(
    new THREE.BoxGeometry(18, 12, 7),
    new THREE.MeshStandardMaterial({ color: 0x556272, roughness: 0.7 }),
  );
  island.position.set(16, 10, -11);
  bargeGroup.add(island);
  group.add(bargeGroup);

  // Volcano crater magma glow disc
  const magma = new THREE.Mesh(
    new THREE.CircleGeometry(78, 24),
    new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.85 }),
  );
  magma.rotation.x = -Math.PI / 2;
  magma.position.set(920, 206, -245);
  group.add(magma);

  // Mountain relay towers with blinking obstruction lights
  const beaconMats = [];
  const towerCoords = [
    [660, -890],
    [1080, 120],
    [-1120, -1020],
  ];
  for (const [tx, tz] of towerCoords) {
    const ty = getTerrainHeight(tx, tz);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 1.4, 34, 6),
      new THREE.MeshStandardMaterial({ color: 0xcfd8e3, metalness: 0.4 }),
    );
    mast.position.set(tx, ty + 17, tz);
    group.add(mast);

    const lightMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 8), lightMat);
    orb.position.set(tx, ty + 34.5, tz);
    group.add(orb);
    beaconMats.push(lightMat);
  }

  return { group, beaconMats, lhBeacon };
}

function buildCloudDeck() {
  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1.0,
    metalness: 0.0,
    transparent: true,
    opacity: 0.78,
  });
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);

  for (let i = 0; i < 48; i++) {
    const cluster = new THREE.Group();
    const angle = hash2d(i * 3.1, 1.7) * Math.PI * 2;
    const dist = 380 + hash2d(i * 7.3, 4.9) * 1650;
    cluster.position.set(
      Math.cos(angle) * dist,
      290 + hash2d(i * 2.9, 8.2) * 185,
      Math.sin(angle) * dist,
    );

    const puffs = 3 + Math.floor(hash2d(i, 12.1) * 4);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      const scaleX = 36 + hash2d(i * 11 + p, 3.3) * 42;
      const scaleY = 12 + hash2d(i * 11 + p, 5.1) * 14;
      const scaleZ = 28 + hash2d(i * 11 + p, 9.7) * 34;
      puff.scale.set(scaleX, scaleY, scaleZ);
      puff.position.set(
        (hash2d(p, i * 2) - 0.5) * 62,
        (hash2d(p * 3, i) - 0.5) * 10,
        (hash2d(p, i * 5) - 0.5) * 44,
      );
      cluster.add(puff);
    }
    cloudGroup.add(cluster);
  }

  return { cloudGroup, cloudMat };
}

function buildSkyDome() {
  const geo = new THREE.SphereGeometry(5200, 32, 20);
  const uniforms = {
    uTopColor: { value: new THREE.Color(0x163d6e) },
    uMidColor: { value: new THREE.Color(0x4c82b0) },
    uHorizonColor: { value: new THREE.Color(0xf7b267) },
    uSunDir: { value: new THREE.Vector3(0.68, 0.32, -0.66).normalize() },
    uSunColor: { value: new THREE.Color(0xffd79e) },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      varying vec3 vWorldPos;
      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = clamp(dir.y, -0.1, 1.0);
        vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.24, h));
        col = mix(col, uTopColor, smoothstep(0.24, 0.88, h));
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        col += uSunColor * pow(sunDot, 220.0) * 1.4;
        col += uSunColor * pow(sunDot, 18.0) * 0.24;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return { mesh: new THREE.Mesh(geo, mat), uniforms };
}

function buildFoliage() {
  const treeCount = 340;
  const trunkGeo = new THREE.CylinderGeometry(0.45, 0.7, 4.5, 5);
  trunkGeo.translate(0, 2.25, 0);
  const crownGeo = new THREE.ConeGeometry(3.4, 10.5, 6);
  crownGeo.translate(0, 8.2, 0);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4f3a27, roughness: 0.9 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x265e2d, roughness: 0.85 });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
  crowns.castShadow = true;

  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let i = 0; i < 1600 && placed < treeCount; i++) {
    const x = (hash2d(i * 1.7, 3.1) - 0.5) * 2800;
    const z = (hash2d(i * 5.3, 8.7) - 0.5) * 2600;
    if (Math.abs(x - RUNWAY.centerX) < 340 && Math.abs(z - RUNWAY.centerZ) < 120) continue;
    const y = getTerrainHeight(x, z);
    if (y < 6 || y > 95) continue;

    const s = 0.8 + hash2d(i, 19.3) * 0.75;
    dummy.position.set(x, y - 0.3, z);
    dummy.rotation.y = hash2d(i, 2.2) * Math.PI * 2;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    crowns.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  trunks.count = placed;
  crowns.count = placed;

  const group = new THREE.Group();
  group.add(trunks);
  group.add(crowns);
  return group;
}

export function createWorld(scene) {
  const terrain = buildTerrainMesh();
  scene.add(terrain);
  scene.add(buildFoliage());

  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0e4466,
    roughness: 0.16,
    metalness: 0.72,
    transparent: true,
    opacity: 0.94,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(11000, 11000, 1, 1), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = 0;
  ocean.receiveShadow = true;
  scene.add(ocean);

  const airfield = buildAirfield();
  scene.add(airfield.group);

  const landmarks = buildLandmarks();
  scene.add(landmarks.group);

  const clouds = buildCloudDeck();
  scene.add(clouds.cloudGroup);

  const sky = buildSkyDome();
  scene.add(sky.mesh);

  const sunLight = new THREE.DirectionalLight(0xffd79e, 2.6);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 2600;
  const d = 750;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const hemiLight = new THREE.HemisphereLight(0x9ecbff, 0x5c4332, 0.95);
  scene.add(hemiLight);

  function applyAtmosphere(preset) {
    sky.uniforms.uTopColor.value.setHex(preset.skyTop);
    sky.uniforms.uMidColor.value.setHex(preset.skyMid);
    sky.uniforms.uHorizonColor.value.setHex(preset.skyHorizon);
    sky.uniforms.uSunColor.value.setHex(preset.sunColor);
    sky.uniforms.uSunDir.value.set(...preset.sunDir).normalize();

    scene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);
    sunLight.color.setHex(preset.sunColor);
    sunLight.intensity = preset.sunIntensity;
    hemiLight.color.setHex(preset.hemiSky);
    hemiLight.groundColor.setHex(preset.hemiGround);
    hemiLight.intensity = preset.hemiIntensity;
    oceanMat.color.setHex(preset.oceanDeep);
    clouds.cloudMat.color.setHex(preset.id === 'storm' ? 0x9aa4b4 : 0xffffff);
  }

  function update(timeSec, dt, planeState, preset) {
    // Keep shadow frustum centered near aircraft
    const sunDir = sky.uniforms.uSunDir.value;
    sunLight.target.position.set(planeState.position.x, 0, planeState.position.z);
    sunLight.position.set(
      planeState.position.x + sunDir.x * 1100,
      sunDir.y * 1100,
      planeState.position.z + sunDir.z * 1100,
    );
    sky.mesh.position.set(planeState.position.x, 0, planeState.position.z);

    // Subtle ocean specular ripple & windsock + radar animation
    oceanMat.roughness = 0.14 + Math.sin(timeSec * 1.4) * 0.03;
    airfield.radarPivot.rotation.y += dt * 1.45;
    const windRad = (preset.windHeadingDeg * Math.PI) / 180;
    airfield.windsockPivot.rotation.y = windRad + Math.sin(timeSec * 3.1) * 0.08;

    // PAPI live glide-slope indication relative to Runway 09 touchdown point
    const distToTd = RUNWAY.touchdownX - planeState.position.x;
    const heightAboveRw = planeState.position.y - RUNWAY.elevation;
    const glideDeg = distToTd > 20 ? (Math.atan2(heightAboveRw, distToTd) * 180) / Math.PI : 3.2;
    const thresholds = [2.2, 2.7, 3.3, 3.9];
    for (let i = 0; i < 4; i++) {
      airfield.papiLights[i].color.setHex(glideDeg > thresholds[i] ? 0xf8fbff : 0xff2b3d);
    }

    // Drift clouds gently
    for (const c of clouds.cloudGroup.children) {
      c.position.x += dt * (preset.windSpeed * 0.55);
      if (c.position.x > 2200) c.position.x = -2200;
    }

    // Blink mountain obstruction beacons
    const blinkOn = Math.sin(timeSec * 3.8) > 0.2;
    for (const m of landmarks.beaconMats) {
      m.color.setHex(blinkOn ? 0xff3b30 : 0x451210);
    }
  }

  return { applyAtmosphere, update };
}
