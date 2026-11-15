import { useEffect, useRef, useState } from 'react';
import { createHorizonRenderer } from './horizon-renderer';

const INITIAL_CAMERA = { yaw: -0.24, pitch: 0.37, zoom: 1, lookX: 0, lookY: 0 };
const clamp = (value: number, lower: number, upper: number) => Math.min(upper, Math.max(lower, value));

function mountScene(canvas: HTMLCanvasElement, onReady: (ready: boolean) => void) {
  let renderer: ReturnType<typeof createHorizonRenderer> = null;
  let animation = 0;
  let lastFrame = 0;
  let elapsed = 0;
  let pulse = 5;
  let visible = true;
  let motion = false;
  let ready = false;
  let dragging = false;
  let distanceMoved = 0;
  const pointers = new Map<number, { x: number; y: number }>();
  const target = { ...INITIAL_CAMERA };
  const camera = { ...INITIAL_CAMERA };
  const pixelBudget = window.matchMedia('(pointer: coarse)').matches ? 480_000 : 780_000;

  function schedule() {
    if (!animation && renderer && visible && !document.hidden) {
      animation = window.requestAnimationFrame(draw);
    }
  }

  function stop() {
    window.cancelAnimationFrame(animation);
    animation = 0;
    lastFrame = 0;
  }

  function draw(now: number) {
    animation = 0;
    if (!renderer || !visible || document.hidden) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    if (lastFrame && now - lastFrame < 26 && motion) {
      schedule();
      return;
    }

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6, Math.sqrt(pixelBudget / (width * height)));
    const drawingWidth = Math.max(1, Math.round(width * pixelRatio));
    const drawingHeight = Math.max(1, Math.round(height * pixelRatio));
    if (canvas.width !== drawingWidth) canvas.width = drawingWidth;
    if (canvas.height !== drawingHeight) canvas.height = drawingHeight;

    const duration = lastFrame ? Math.min((now - lastFrame) / 1_000, 0.09) : 1 / 35;
    lastFrame = now;
    if (motion) elapsed += duration;
    pulse = motion ? Math.min(5, pulse + duration) : 5;
    const blend = motion ? 1 - Math.exp(-duration * (dragging ? 19 : 10)) : 1;
    for (const key of ['yaw', 'pitch', 'zoom', 'lookX', 'lookY'] as const) {
      camera[key] += (target[key] - camera[key]) * blend;
    }
    renderer.draw({ ...camera, time: elapsed, pulse });
    if (!ready) {
      ready = true;
      onReady(true);
    }
    if (motion) schedule();
  }

  function start() {
    renderer = createHorizonRenderer(canvas);
    schedule();
  }

  function onContextLost(event: Event) {
    event.preventDefault();
    stop();
    ready = false;
    onReady(false);
    pointers.clear();
    dragging = false;
    delete canvas.dataset.dragging;
    renderer = null;
  }

  function onVisibility() {
    if (document.hidden) stop();
    else schedule();
  }

  function orbit(deltaX: number, deltaY: number) {
    target.yaw -= deltaX * 0.007;
    target.pitch = clamp(target.pitch + deltaY * 0.007, -1.25, 1.25);
  }

  function zoom(amount: number) {
    target.zoom = clamp(target.zoom * Math.exp(amount), 0.68, 1.42);
    schedule();
  }

  function playPulse() {
    if (!motion) return;
    pulse = 0;
    schedule();
  }

  function onPointerDown(event: PointerEvent) {
    if (!renderer || event.button !== 0) return;
    if (pointers.size === 0) distanceMoved = 0;
    else distanceMoved = 6;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    dragging = true;
    canvas.dataset.dragging = 'true';
  }

  function onPointerMove(event: PointerEvent) {
    if (!renderer) return;
    const previous = pointers.get(event.pointerId);
    const x = event.clientX;
    const y = event.clientY;
    if (previous) {
      const deltaX = x - previous.x;
      const deltaY = y - previous.y;
      distanceMoved += Math.hypot(deltaX, deltaY);
      if (pointers.size === 1) {
        orbit(deltaX, deltaY);
      } else if (pointers.size === 2) {
        for (const [id, other] of pointers) {
          if (id === event.pointerId) continue;
          const previousDistance = Math.hypot(previous.x - other.x, previous.y - other.y);
          const nextDistance = Math.hypot(x - other.x, y - other.y);
          if (previousDistance > 8 && nextDistance > 8) zoom(Math.log(nextDistance / previousDistance));
        }
      }
      pointers.set(event.pointerId, { x, y });
    } else if (event.pointerType === 'mouse') {
      const bounds = canvas.getBoundingClientRect();
      target.lookX = ((x - bounds.left) / bounds.width) * 2 - 1;
      target.lookY = ((bounds.top - y) / bounds.height) * 2 + 1;
    }
    schedule();
  }

  function onPointerEnd(event: PointerEvent) {
    if (!pointers.delete(event.pointerId) || pointers.size > 0) return;
    dragging = false;
    delete canvas.dataset.dragging;
    if (event.type === 'pointerup' && distanceMoved < 5) playPulse();
  }

  function onPointerLeave() {
    target.lookX = 0;
    target.lookY = 0;
    schedule();
  }

  function onWheel(event: WheelEvent) {
    if (!renderer || !event.shiftKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY || event.deltaX;
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    zoom(-clamp(delta * units, -140, 140) * 0.002);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    switch (event.key) {
      case 'ArrowLeft':
        orbit(-28, 0);
        break;
      case 'ArrowRight':
        orbit(28, 0);
        break;
      case 'ArrowUp':
        orbit(0, -23);
        break;
      case 'ArrowDown':
        orbit(0, 23);
        break;
      case '+':
      case '=':
        zoom(0.11);
        break;
      case '-':
        zoom(-0.11);
        break;
      case 'Enter':
      case ' ':
        playPulse();
        break;
      default:
        return;
    }
    event.preventDefault();
    schedule();
  }

  const resize = new ResizeObserver(schedule);
  resize.observe(canvas);
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting === true;
    if (visible) schedule();
    else stop();
  });
  visibility.observe(canvas);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', start);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('lostpointercapture', onPointerEnd);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisibility);
  start();

  return {
    setMotion(enabled: boolean) {
      motion = enabled;
      stop();
      schedule();
    },
    reset() {
      Object.assign(target, INITIAL_CAMERA);
      pulse = 5;
      schedule();
    },
    dispose() {
      stop();
      resize.disconnect();
      visibility.disconnect();
      renderer?.dispose();
      delete canvas.dataset.dragging;
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', start);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
      canvas.removeEventListener('lostpointercapture', onPointerEnd);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}

export function HorizonScene({
  label,
  motion,
  resetKey,
}: {
  label: string;
  motion: boolean;
  resetKey: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ReturnType<typeof mountScene> | null>(null);
  const lastReset = useRef(resetKey);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvas.current) return;
    scene.current = mountScene(canvas.current, setReady);
    return () => {
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.setMotion(motion);
  }, [motion]);

  useEffect(() => {
    if (lastReset.current === resetKey) return;
    lastReset.current = resetKey;
    scene.current?.reset();
  }, [resetKey]);

  return (
    <canvas
      ref={canvas}
      className="horizon-canvas"
      role="img"
      aria-label={label}
      inert={!ready}
      tabIndex={ready ? 0 : undefined}
      data-ready={ready || undefined}
    />
  );
}
