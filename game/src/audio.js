// Procedural Web Audio API sound engine: engine turbine drone, wind rush,
// stall alarm, gear/flap servo, ring-clear chime, crate release, and touchdown chirp.

export function createAudioEngine() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let started = false;

  function unlock() {
    if (started) {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    ctx = new AudioCtx();
    started = true;

    // Turbine / engine drone
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 68;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 280;

    engineGain = ctx.createGain();
    engineGain.gain.value = 0.03;

    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();

    // Wind noise buffer
    const bufLen = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 540;

    windGain = ctx.createGain();
    windGain.gain.value = 0.01;

    noiseSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    noiseSrc.start();
  }

  function update(state, paused) {
    if (!ctx || !engineOsc || !engineGain || !windGain) return;
    const now = ctx.currentTime;
    if (paused || state.crashed) {
      engineGain.gain.setTargetAtTime(0.001, now, 0.08);
      windGain.gain.setTargetAtTime(0.001, now, 0.08);
      return;
    }

    const rpmFreq = 58 + state.throttle * 95 + (state.afterburner ? 38 : 0);
    engineOsc.frequency.setTargetAtTime(rpmFreq, now, 0.08);
    engineGain.gain.setTargetAtTime(0.025 + state.throttle * 0.055, now, 0.08);

    const windLevel = Math.min(0.06, (state.speedKnots / 260) * 0.05);
    windGain.gain.setTargetAtTime(windLevel, now, 0.1);
  }

  function playTone(freq, duration = 0.16, type = 'sine', vol = 0.08) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function playRingClear() {
    playTone(587.3, 0.14, 'triangle', 0.09);
    setTimeout(() => playTone(880, 0.22, 'triangle', 0.09), 75);
  }

  function playDrop() {
    playTone(240, 0.18, 'sawtooth', 0.07);
  }

  function playTouchdown() {
    playTone(130, 0.14, 'square', 0.06);
  }

  function playCrash() {
    playTone(62, 0.48, 'sawtooth', 0.16);
  }

  function playServo() {
    playTone(320, 0.09, 'sine', 0.04);
  }

  return { unlock, update, playRingClear, playDrop, playTouchdown, playCrash, playServo };
}
