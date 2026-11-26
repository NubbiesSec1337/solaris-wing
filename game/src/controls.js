// Unified keyboard and virtual mouse-stick flight controls with deadzone & clean bindings.

export function createControls(canvas, callbacks) {
  const keys = new Set();
  let mouseActive = false;
  let mouseStickX = 0;
  let mouseStickY = 0;

  function applyDeadzone(val, dz = 0.08) {
    if (Math.abs(val) < dz) return 0;
    const sign = Math.sign(val);
    return (sign * (Math.abs(val) - dz)) / (1 - dz);
  }

  window.addEventListener('keydown', (e) => {
    const code = e.code;
    keys.add(code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      e.preventDefault();
    }
    if (e.repeat) return;

    if (code === 'KeyV') callbacks.onToggleCamera?.();
    if (code === 'KeyG') callbacks.onToggleGear?.();
    if (code === 'KeyF') callbacks.onToggleFlaps?.();
    if (code === 'KeyB') callbacks.onToggleAirbrake?.();
    if (code === 'KeyM') {
      mouseActive = !mouseActive;
      if (!mouseActive) {
        mouseStickX = 0;
        mouseStickY = 0;
      }
      callbacks.onMouseToggle?.(mouseActive);
    }
    if (code === 'Space') callbacks.onAction?.();
    if (code === 'KeyP' || code === 'Escape') callbacks.onTogglePause?.();
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!mouseActive) return;
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    mouseStickX = Math.max(-1, Math.min(1, nx * 1.35));
    mouseStickY = Math.max(-1, Math.min(1, ny * 1.35));
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0 && !mouseActive) {
      // Allow holding mouse button on viewport to steer temporarily if desired
      mouseActive = true;
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      mouseStickX = Math.max(-1, Math.min(1, nx * 1.35));
      mouseStickY = Math.max(-1, Math.min(1, ny * 1.35));
    }
  });

  window.addEventListener('mouseup', () => {
    // Keep mouse active only if toggled with M; release drag steering gently
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      callbacks.onThrottleWheel?.(e.deltaY < 0 ? 0.06 : -0.06);
    },
    { passive: false },
  );

  function sample() {
    let pitch = 0;
    let roll = 0;
    let yaw = 0;
    let throttleDelta = 0;

    if (keys.has('KeyW') || keys.has('ArrowUp')) pitch -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) pitch += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) roll -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) roll += 1;
    if (keys.has('KeyQ')) yaw -= 1;
    if (keys.has('KeyE')) yaw += 1;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyR')) throttleDelta += 1;
    if (keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC')) throttleDelta -= 1;

    if (mouseActive) {
      const mx = applyDeadzone(mouseStickX);
      const my = applyDeadzone(mouseStickY);
      if (roll === 0) roll = mx;
      if (pitch === 0) pitch = -my;
    }

    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      yaw: Math.max(-1, Math.min(1, yaw)),
      throttleDelta,
      mouseActive,
    };
  }

  function resetMouse() {
    mouseActive = false;
    mouseStickX = 0;
    mouseStickY = 0;
  }

  return { sample, resetMouse };
}
