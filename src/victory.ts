import "./victory.css";

const DURATION_MS = 5000;
const BURST_LIFETIME_MS = 1150;
const PARTICLES_PER_BURST = 26;
const mountedCelebrations = new WeakMap<HTMLElement, () => void>();
const colours = ["#ffda83", "#86e9d7", "#ffb29c", "#d7c0ff"];
const bursts = [
  { at: 220, x: .19, y: .40, colour: 0 },
  { at: 760, x: .80, y: .37, colour: 1 },
  { at: 1320, x: .28, y: .27, colour: 2 },
  { at: 1950, x: .72, y: .50, colour: 3 },
  { at: 2600, x: .15, y: .57, colour: 1 },
  { at: 3220, x: .85, y: .31, colour: 0 },
  { at: 3750, x: .27, y: .34, colour: 3 },
];

export function mountVictoryCelebration(host: HTMLElement, reducedMotion: boolean): () => void {
  mountedCelebrations.get(host)?.();

  const stage = document.createElement("div");
  stage.className = "victory-celebration";
  stage.dataset.state = reducedMotion ? "static" : "animated";
  stage.setAttribute("role", "img");
  stage.setAttribute("aria-label", "Victory! Four aces crowned with stars and celebratory fireworks.");
  stage.innerHTML = `
    <div class="victory-celebration__art" aria-hidden="true">
      <span class="victory-celebration__star victory-celebration__star--one">✦</span>
      <span class="victory-celebration__star victory-celebration__star--two">✧</span>
      <span class="victory-celebration__star victory-celebration__star--three">✧</span>
      <span class="victory-celebration__star victory-celebration__star--four">✦</span>
      <div class="victory-celebration__emblem">
        <span class="victory-celebration__crown">✦</span>
        <span class="victory-celebration__card victory-celebration__card--clubs"><small>A</small>♣</span>
        <span class="victory-celebration__card victory-celebration__card--diamonds"><small>A</small>♦</span>
        <span class="victory-celebration__card victory-celebration__card--spades"><small>A</small>♠</span>
        <span class="victory-celebration__card victory-celebration__card--hearts"><small>A</small>♥</span>
      </div>
      <span class="victory-celebration__caption">Beautifully played!</span>
    </div>`;
  host.append(stage);

  const dialog = host.closest("dialog");
  let canvas: HTMLCanvasElement | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let frame: number | undefined;
  let finishTimer: number | undefined;
  let disposed = false;

  function stopAnimation(): void {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    if (finishTimer !== undefined) window.clearTimeout(finishTimer);
    frame = undefined;
    finishTimer = undefined;
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    canvas?.remove();
    canvas = undefined;
  }

  function cleanup(): void {
    if (disposed) return;
    disposed = true;
    stopAnimation();
    dialog?.removeEventListener("close", cleanup);
    window.removeEventListener("pagehide", cleanup);
    stage.remove();
    if (mountedCelebrations.get(host) === cleanup) mountedCelebrations.delete(host);
  }

  mountedCelebrations.set(host, cleanup);
  dialog?.addEventListener("close", cleanup);
  window.addEventListener("pagehide", cleanup);
  if (reducedMotion) return cleanup;

  canvas = document.createElement("canvas");
  canvas.className = "victory-celebration__canvas";
  canvas.setAttribute("aria-hidden", "true");
  stage.prepend(canvas);
  const context = canvas.getContext("2d");
  if (!context) {
    console.warn("Victory celebration: Canvas 2D is unavailable; displaying the static illustration.");
    stage.dataset.state = "static";
    stopAnimation();
    return cleanup;
  }

  let width = 1;
  let height = 1;
  const startedAt = performance.now();

  function finish(): void {
    if (disposed) return;
    stage.dataset.state = "finished";
    stopAnimation();
  }

  function resize(): void {
    if (!canvas || disposed) return;
    const bounds = stage.getBoundingClientRect();
    width = Math.max(1, Math.min(1200, Math.round(bounds.width)));
    height = Math.max(1, Math.min(160, Math.round(bounds.height)));
    const density = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.ceil(width * density);
    canvas.height = Math.ceil(height * density);
    context!.setTransform(density, 0, 0, density, 0, 0);
  }

  function draw(now: number): void {
    if (disposed) return;
    const elapsed = now - startedAt;
    if (elapsed >= DURATION_MS) {
      finish();
      return;
    }

    context!.clearRect(0, 0, width, height);
    context!.lineCap = "round";
    const radius = Math.min(width * .23, height * .46);
    for (const burst of bursts) {
      const age = elapsed - burst.at;
      if (age < -420 || age > BURST_LIFETIME_MS) continue;
      const originX = width * burst.x;
      const originY = height * burst.y;
      context!.strokeStyle = colours[burst.colour];
      if (age < 0) {
        const progress = 1 + age / 420;
        const rocketY = height - (height - originY) * progress;
        context!.globalAlpha = .65 * Math.sin(progress * Math.PI);
        context!.lineWidth = 2;
        context!.beginPath();
        context!.moveTo(originX, rocketY + 10);
        context!.lineTo(originX, rocketY);
        context!.stroke();
        continue;
      }

      const progress = age / BURST_LIFETIME_MS;
      // Fixed spokes are evaluated in place: seven bursts, no growing particle arrays.
      for (let i = 0; i < PARTICLES_PER_BURST; i++) {
        const angle = i * Math.PI * 2 / PARTICLES_PER_BURST + burst.colour * .17;
        const reach = radius * (i % 3 === 0 ? .64 : 1);
        const distance = reach * (1 - Math.pow(1 - progress, 3));
        const tail = Math.max(0, distance - 5 * (1 - progress));
        const fall = progress * progress * height * .19;
        context!.globalAlpha = Math.min(1, age / 150) * Math.pow(1 - progress, 1.3);
        context!.lineWidth = i % 3 === 0 ? 2.5 : 1.7;
        context!.beginPath();
        context!.moveTo(originX + Math.cos(angle) * tail, originY + Math.sin(angle) * tail + fall);
        context!.lineTo(originX + Math.cos(angle) * distance, originY + Math.sin(angle) * distance + fall);
        context!.stroke();
      }
    }
    context!.globalAlpha = 1;
    frame = window.requestAnimationFrame(draw);
  }

  resize();
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  finishTimer = window.setTimeout(finish, DURATION_MS);
  frame = window.requestAnimationFrame(draw);
  return cleanup;
}
