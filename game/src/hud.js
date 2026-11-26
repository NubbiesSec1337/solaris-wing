// Crisp collimated 2D canvas HUD overlay: pitch ladder, flight path marker, rolling
// airspeed/altitude/heading tapes, 3D target reticle, fuel/hull systems card, and tactical radar.

import * as THREE from 'three';
import { RUNWAY } from './config.js';

export function createHudRenderer(hudCanvas) {
  const ctx = hudCanvas.getContext('2d');
  const tmpProj = new THREE.Vector3();

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (hudCanvas.width !== Math.round(w * dpr) || hudCanvas.height !== Math.round(h * dpr)) {
      hudCanvas.width = Math.round(w * dpr);
      hudCanvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function drawTopHeadingTape(w, state) {
    const tapeW = 360;
    const cx = w * 0.5;
    const topY = 58;

    ctx.save();
    ctx.fillStyle = 'rgba(6, 14, 24, 0.56)';
    ctx.strokeStyle = 'rgba(110, 235, 255, 0.32)';
    ctx.lineWidth = 1;
    ctx.fillRect(cx - tapeW / 2, topY, tapeW, 34);
    ctx.strokeRect(cx - tapeW / 2, topY, tapeW, 34);

    ctx.beginPath();
    ctx.rect(cx - tapeW / 2 + 2, topY, tapeW - 4, 34);
    ctx.clip();

    const pxPerDeg = 4.2;
    const hdg = state.headingDeg;
    const startDeg = Math.floor((hdg - 45) / 5) * 5;
    const endDeg = Math.ceil((hdg + 45) / 5) * 5;

    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    for (let d = startDeg; d <= endDeg; d += 5) {
      const diff = d - hdg;
      const x = cx + diff * pxPerDeg;
      const norm = ((d % 360) + 360) % 360;
      const major = norm % 15 === 0;
      ctx.strokeStyle = 'rgba(130, 255, 200, 0.78)';
      ctx.beginPath();
      ctx.moveTo(x, topY + 34);
      ctx.lineTo(x, topY + (major ? 22 : 27));
      ctx.stroke();

      if (major) {
        const label =
          norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : String(norm).padStart(3, '0');
        ctx.fillStyle = '#c8ffe6';
        ctx.fillText(label, x, topY + 15);
      }
    }

    // Target bearing bug
    if (state.nextTarget) {
      const dx = state.nextTarget.x - state.position.x;
      const dz = state.nextTarget.z - state.position.z;
      const targetHdg = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
      let delta = targetHdg - hdg;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      const bx = Math.max(cx - tapeW / 2 + 8, Math.min(cx + tapeW / 2 - 8, cx + delta * pxPerDeg));
      ctx.fillStyle = '#ffaa33';
      ctx.beginPath();
      ctx.moveTo(bx, topY + 2);
      ctx.lineTo(bx - 6, topY + 11);
      ctx.lineTo(bx + 6, topY + 11);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Digital HDG box
    ctx.fillStyle = 'rgba(6, 16, 26, 0.9)';
    ctx.strokeStyle = '#4ef5a8';
    ctx.fillRect(cx - 32, topY + 34, 64, 21);
    ctx.strokeRect(cx - 32, topY + 34, 64, 21);
    ctx.fillStyle = '#8effca';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`HDG ${String(Math.round(hdg)).padStart(3, '0')}`, cx, topY + 49);
  }

  function drawSideTapes(w, h, state) {
    const cy = h * 0.48;
    const tapeH = 220;

    // LEFT TAPE: AIRSPEED (KTS)
    const leftX = Math.max(24, w * 0.14);
    ctx.fillStyle = 'rgba(6, 14, 24, 0.56)';
    ctx.strokeStyle = 'rgba(100, 245, 190, 0.32)';
    ctx.fillRect(leftX, cy - tapeH / 2, 74, tapeH);
    ctx.strokeRect(leftX, cy - tapeH / 2, 74, tapeH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(leftX, cy - tapeH / 2, 74, tapeH);
    ctx.clip();

    const spd = state.speedKnots;
    const pxPerKt = 2.6;
    const sStart = Math.floor((spd - 45) / 10) * 10;
    const sEnd = Math.ceil((spd + 45) / 10) * 10;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    for (let k = sStart; k <= sEnd; k += 10) {
      if (k < 0) continue;
      const y = cy - (k - spd) * pxPerKt;
      const major = k % 20 === 0;
      ctx.strokeStyle = 'rgba(130, 255, 200, 0.75)';
      ctx.beginPath();
      ctx.moveTo(leftX + 74, y);
      ctx.lineTo(leftX + (major ? 60 : 66), y);
      ctx.stroke();
      if (major) {
        ctx.fillStyle = '#c8ffe6';
        ctx.fillText(String(k), leftX + 56, y + 4);
      }
    }
    ctx.restore();

    // SPD Digital Box
    ctx.fillStyle = 'rgba(6, 16, 26, 0.92)';
    ctx.strokeStyle = '#4ef5a8';
    ctx.fillRect(leftX - 8, cy - 16, 86, 32);
    ctx.strokeRect(leftX - 8, cy - 16, 86, 32);
    ctx.fillStyle = '#70ffbe';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SPD KT', leftX - 2, cy - 4);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(String(Math.round(spd)).padStart(3, ' '), leftX + 18, cy + 12);

    // RIGHT TAPE: ALTITUDE (FT)
    const rightX = Math.min(w - 98, w * 0.86 - 74);
    ctx.fillStyle = 'rgba(6, 14, 24, 0.56)';
    ctx.strokeStyle = 'rgba(100, 245, 190, 0.32)';
    ctx.fillRect(rightX, cy - tapeH / 2, 74, tapeH);
    ctx.strokeRect(rightX, cy - tapeH / 2, 74, tapeH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(rightX, cy - tapeH / 2, 74, tapeH);
    ctx.clip();

    const alt = state.altitudeFt;
    const pxPerFt = 0.24;
    const aStart = Math.floor((alt - 450) / 100) * 100;
    const aEnd = Math.ceil((alt + 450) / 100) * 100;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    for (let a = aStart; a <= aEnd; a += 100) {
      if (a < 0) continue;
      const y = cy - (a - alt) * pxPerFt;
      const major = a % 200 === 0;
      ctx.strokeStyle = 'rgba(130, 255, 200, 0.75)';
      ctx.beginPath();
      ctx.moveTo(rightX, y);
      ctx.lineTo(rightX + (major ? 14 : 8), y);
      ctx.stroke();
      if (major) {
        ctx.fillStyle = '#c8ffe6';
        ctx.fillText(String(a), rightX + 18, y + 4);
      }
    }
    ctx.restore();

    // ALT Digital Box
    ctx.fillStyle = 'rgba(6, 16, 26, 0.92)';
    ctx.strokeStyle = '#4ef5a8';
    ctx.fillRect(rightX - 4, cy - 16, 88, 32);
    ctx.strokeRect(rightX - 4, cy - 16, 88, 32);
    ctx.fillStyle = '#70ffbe';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ALT FT', rightX + 3, cy - 4);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(String(Math.round(alt)).padStart(4, ' '), rightX + 20, cy + 12);

    // Vertical Speed + AGL beneath Alt tape
    ctx.fillStyle = 'rgba(6, 16, 26, 0.85)';
    ctx.fillRect(rightX, cy + tapeH / 2 + 6, 74, 34);
    ctx.strokeStyle = 'rgba(100, 245, 190, 0.28)';
    ctx.strokeRect(rightX, cy + tapeH / 2 + 6, 74, 34);
    ctx.fillStyle = state.vsiFpm < -800 ? '#ff6b6b' : '#b7f7d8';
    ctx.font = 'bold 11px monospace';
    const vsiSign = state.vsiFpm >= 0 ? '+' : '';
    ctx.fillText(`VS ${vsiSign}${Math.round(state.vsiFpm)}`, rightX + 6, cy + tapeH / 2 + 20);
    ctx.fillStyle = '#7de7ff';
    ctx.fillText(`AGL ${Math.round(state.aglM * 3.28)}ft`, rightX + 6, cy + tapeH / 2 + 34);
  }

  function drawPitchLadder(w, h, state, isCockpit) {
    const cx = w * 0.5;
    const cy = isCockpit ? h * 0.42 : h * 0.48;
    const scale = isCockpit ? 4.4 : 3.2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, isCockpit ? 135 : 145, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(cx, cy);
    ctx.rotate(state.rollRad);
    ctx.translate(0, state.pitchDeg * scale);

    ctx.strokeStyle = 'rgba(84, 255, 178, 0.72)';
    ctx.fillStyle = 'rgba(84, 255, 178, 0.88)';
    ctx.lineWidth = 1.6;
    ctx.font = 'bold 11px monospace';

    // Horizon line
    ctx.beginPath();
    ctx.moveTo(-110, 0);
    ctx.lineTo(-28, 0);
    ctx.moveTo(28, 0);
    ctx.lineTo(110, 0);
    ctx.stroke();

    for (const deg of [-30, -20, -10, 10, 20, 30]) {
      const y = -deg * scale;
      if (deg < 0) ctx.setLineDash([5, 4]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(-64, y);
      ctx.lineTo(-22, y);
      ctx.lineTo(-22, y + (deg > 0 ? 7 : -7));
      ctx.moveTo(64, y);
      ctx.lineTo(22, y);
      ctx.lineTo(22, y + (deg > 0 ? 7 : -7));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = 'right';
      ctx.fillText(String(deg), -68, y + 4);
      ctx.textAlign = 'left';
      ctx.fillText(String(deg), 68, y + 4);
    }
    ctx.restore();

    // Fixed boresight / flight watermark
    ctx.strokeStyle = '#ffbe3d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy);
    ctx.lineTo(cx - 6, cy);
    ctx.lineTo(cx, cy + 6);
    ctx.lineTo(cx + 6, cy);
    ctx.lineTo(cx + 18, cy);
    ctx.stroke();
  }

  function drawTargetReticle(w, h, state, camera, isCockpit) {
    if (!state.nextTarget) return;
    tmpProj.set(state.nextTarget.x, state.nextTarget.y, state.nextTarget.z).project(camera);
    const dist = Math.hypot(
      state.nextTarget.x - state.position.x,
      state.nextTarget.y - state.position.y,
      state.nextTarget.z - state.position.z,
    );

    if (tmpProj.z > 1) return;
    const sx = (tmpProj.x * 0.5 + 0.5) * w;
    const sy = (-tmpProj.y * 0.5 + 0.5) * h;

    const maxY = isCockpit ? h * 0.56 : h - 155;
    const clampedX = Math.max(120, Math.min(w - 120, sx));
    const clampedY = Math.max(70, Math.min(maxY, sy));
    const onScreen = sx >= 24 && sx <= w - 24 && sy >= 40 && sy <= maxY;

    ctx.save();
    ctx.strokeStyle = onScreen ? '#ffbe3d' : '#ff6b4a';
    ctx.fillStyle = '#ffbe3d';
    ctx.lineWidth = 2;

    ctx.translate(clampedX, clampedY);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(14, 0);
    ctx.lineTo(0, 14);
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.stroke();

    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${state.nextTarget.label}`, 0, -20);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.round(dist)}m`, 0, 28);
    ctx.restore();
  }

  function drawSystemsPanel(h, state, preset, missionStatus) {
    const x = 16;
    const y = h - 134;
    const pw = 258;
    const ph = 118;

    ctx.fillStyle = 'rgba(7, 14, 24, 0.78)';
    ctx.strokeStyle = 'rgba(110, 210, 255, 0.34)';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, pw, ph);
    ctx.strokeRect(x, y, pw, ph);

    const thrPct = Math.round(state.throttle * 100);
    const fuelPct = Math.round(state.fuel);
    const hullPct = Math.round(state.hull);

    const drawBar = (label, pct, by, color, extra = '') => {
      ctx.fillStyle = '#9fc0de';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 10, by + 10);

      ctx.fillStyle = '#182436';
      ctx.fillRect(x + 58, by, 126, 11);
      ctx.fillStyle = color;
      ctx.fillRect(x + 58, by, Math.max(2, (pct / 100) * 126), 11);

      ctx.fillStyle = '#eef6ff';
      ctx.fillText(`${pct}%${extra}`, x + 192, by + 10);
    };

    drawBar('THR', thrPct, y + 12, state.afterburner ? '#ff7033' : '#42f59b', state.afterburner ? ' AB' : '');
    drawBar('FUEL', fuelPct, y + 32, fuelPct < 22 ? '#ff4757' : '#58e1ff');
    drawBar('HULL', hullPct, y + 52, hullPct < 40 ? '#ff4757' : '#70f58c');

    // Gear / Flaps / Brake / Wind row
    const pills = [
      { txt: 'GEAR', on: state.gearDown, col: '#42f59b' },
      { txt: 'FLAPS', on: state.flaps > 0, col: '#58e1ff' },
      { txt: 'BRAKE', on: state.airbrake, col: '#ffaa33' },
    ];
    pills.forEach((p, i) => {
      const px = x + 10 + i * 56;
      const py = y + 73;
      ctx.fillStyle = p.on ? p.col : 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(px, py, 50, 18);
      ctx.fillStyle = p.on ? '#081018' : '#7388a1';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.txt, px + 25, py + 12);
    });

    ctx.fillStyle = '#ffbe4f';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${missionStatus.score}`, x + 180, y + 86);

    ctx.fillStyle = '#9db6d1';
    ctx.font = '11px monospace';
    ctx.fillText(
      `WIND ${preset.windHeadingDeg}°/${Math.round(preset.windSpeed * 1.94)}KT  G:${state.gForce.toFixed(1)}`,
      x + 10,
      y + 108,
    );
  }

  function drawRadar(w, h, state, missionStatus) {
    const r = 64;
    const cx = w - 82;
    const cy = h - 82;

    ctx.save();
    ctx.fillStyle = 'rgba(6, 16, 22, 0.78)';
    ctx.strokeStyle = 'rgba(72, 245, 168, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.clip();

    // Range rings
    ctx.strokeStyle = 'rgba(72, 245, 168, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    const hdgRad = (state.headingDeg * Math.PI) / 180;
    const fwdX = Math.sin(hdgRad);
    const fwdZ = -Math.cos(hdgRad);
    const rightX = Math.cos(hdgRad);
    const rightZ = Math.sin(hdgRad);
    const scale = (r - 8) / 1600;

    const toRadar = (wx, wz) => {
      const dx = wx - state.position.x;
      const dz = wz - state.position.z;
      return {
        x: cx + (dx * rightX + dz * rightZ) * scale,
        y: cy - (dx * fwdX + dz * fwdZ) * scale,
      };
    };

    // Runway vector on radar
    const rw1 = toRadar(RUNWAY.thresholdWestX, RUNWAY.centerZ);
    const rw2 = toRadar(RUNWAY.thresholdEastX, RUNWAY.centerZ);
    ctx.strokeStyle = '#6fe8ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rw1.x, rw1.y);
    ctx.lineTo(rw2.x, rw2.y);
    ctx.stroke();

    // Mission objectives on radar
    for (let i = missionStatus.currentIndex; i < missionStatus.items.length; i++) {
      const it = missionStatus.items[i];
      const p = toRadar(it.x, it.z);
      ctx.fillStyle = i === missionStatus.currentIndex ? '#ffbe3d' : 'rgba(88, 225, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === missionStatus.currentIndex ? 4.5 : 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center aircraft icon
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx - 4.5, cy + 5);
    ctx.lineTo(cx + 4.5, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#8ef5c0';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TACTICAL RADAR', cx, cy + r + 13);
  }

  function drawBanner(w, h, state, bannerText) {
    if (state.stallWarning) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.85)';
      ctx.fillRect(w * 0.5 - 105, h * 0.22, 210, 28);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('STALL WARNING — PITCH DOWN', w * 0.5, h * 0.22 + 19);
    } else if (state.fuel < 15 && !state.onGround) {
      ctx.fillStyle = 'rgba(217, 119, 6, 0.88)';
      ctx.fillRect(w * 0.5 - 95, h * 0.22, 190, 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LOW FUEL — RTB RUNWAY 09', w * 0.5, h * 0.22 + 18);
    }

    if (bannerText) {
      ctx.fillStyle = 'rgba(6, 16, 28, 0.84)';
      ctx.strokeStyle = '#ffbe3d';
      ctx.fillRect(w * 0.5 - 165, h * 0.78, 330, 32);
      ctx.strokeRect(w * 0.5 - 165, h * 0.78, 330, 32);
      ctx.fillStyle = '#ffdf85';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(bannerText, w * 0.5, h * 0.78 + 20);
    }
  }

  function render(state, camera, preset, missionStatus, camMode, bannerText) {
    const { w, h } = resize();
    ctx.clearRect(0, 0, w, h);

    const isCockpit = camMode === 'cockpit';
    drawTopHeadingTape(w, state);
    drawSideTapes(w, h, state);
    drawPitchLadder(w, h, state, isCockpit);
    drawTargetReticle(w, h, state, camera, isCockpit);
    drawSystemsPanel(h, state, preset, missionStatus);
    drawRadar(w, h, state, missionStatus);
    drawBanner(w, h, state, bannerText);
  }

  return { render };
}
