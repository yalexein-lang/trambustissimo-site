// One closed, smooth cylinder in 3D; the browser composites one finished raster.
// Geometry is independent of pointer state. No CSS face mesh or stretched capsule.
export const METAL_LEVER_MODEL = Object.freeze({
  revision: 'metal-bay-solid-1', width: 28, height: 30, pivot: [14, 14.1],
  eye: [38, -9, 140], radius: 2.5, length: 22, throwDegrees: 26,
});
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const frames = new Map();
const frameImages = new WeakMap();

function frameImageUrl(frame) {
  const cached = frameImages.get(frame); if (cached) return cached;
  const raster = document.createElement('canvas'); raster.width = frame.width; raster.height = frame.height;
  const context = raster.getContext('2d'); if (!context) throw new Error('metalBaySelector.rasterCanvasUnavailable');
  context.putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0);
  const url = raster.toDataURL('image/png'); frameImages.set(frame, url); return url;
}

export function leverGeometry(position) {
  const t = clamp(Number.isFinite(Number(position)) ? Number(position) : .5, 0, 1);
  const angle = (1 - 2 * t) * METAL_LEVER_MODEL.throwDegrees * Math.PI / 180;
  const axis = [0, Math.sin(angle), Math.cos(angle)];
  const project = (x, y, z) => {
    const [ex, ey, ez] = METAL_LEVER_MODEL.eye, k = ez / (ez - z);
    return [METAL_LEVER_MODEL.pivot[0] + (x - ex * z / ez) * k, METAL_LEVER_MODEL.pivot[1] + (y - ey * z / ez) * k];
  };
  return {position: t, angle: angle * 180 / Math.PI, axis,
    pivot: [...METAL_LEVER_MODEL.pivot], tip: project(0, axis[1] * (METAL_LEVER_MODEL.length + METAL_LEVER_MODEL.radius), axis[2] * (METAL_LEVER_MODEL.length + METAL_LEVER_MODEL.radius)),
    length: METAL_LEVER_MODEL.length, radius: METAL_LEVER_MODEL.radius};
}

export function renderLeverFrame(position, resolution = 8) {
  const g = leverGeometry(position), scale = clamp(Math.round(resolution), 2, 8);
  const key = `${g.position.toFixed(8)}:${scale}`;
  if (frames.has(key)) return frames.get(key);
  const width = 28 * scale, height = 30 * scale;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const solid = new Uint8Array(width * height);
  const shadow = new Float32Array(width * height);
  const [ex, ey, ez] = METAL_LEVER_MODEL.eye;
  const ay = g.axis[1], az = g.axis[2], radius = g.radius, length = g.length;
  let sidePixels = 0, tipPixels = 0, tipNormalAxialMin = Infinity, tipNormalAxialMax = -Infinity, minX = width, minY = height, maxX = -1, maxY = -1;
  // Reused intersection result: distance, normal, axial position. No per-ray objects.
  const hit = new Float64Array(6);
  function intersect(ox, oy, oz, dx, dy, dz) {
    const oa = oy * ay + oz * az, da = dy * ay + dz * az;
    const a = dx * dx + dy * dy + dz * dz - da * da;
    const b = ox * dx + oy * dy + oz * dz - oa * da;
    const c = ox * ox + oy * oy + oz * oz - oa * oa - radius * radius;
    const disc = b * b - a * c;
    let best = Infinity, kind = 0, q = 0;
    if (a > 1e-12 && disc >= 0) {
      const root = Math.sqrt(disc);
      for (let sign = -1; sign <= 1; sign += 2) {
        const distance = (-b + sign * root) / a;
        const axial = oa + distance * da;
        if (distance > 1e-6 && distance < best && axial >= -.65 && axial <= length && oz + distance * dz >= 0) {
          best = distance; q = axial; kind = 1;
        }
      }
    }
    // Rounded nose: sphere centred on the shaft tip, clipped to the forward hemisphere.
    const sx = ox, sy = oy - length * ay, sz = oz - length * az;
    const sphereA = dx * dx + dy * dy + dz * dz;
    const sphereB = sx * dx + sy * dy + sz * dz;
    const sphereC = sx * sx + sy * sy + sz * sz - radius * radius;
    const sphereDisc = sphereB * sphereB - sphereA * sphereC;
    if (sphereA > 1e-12 && sphereDisc >= 0) {
      const root = Math.sqrt(sphereDisc);
      for (let sign = -1; sign <= 1; sign += 2) {
        const distance = (-sphereB + sign * root) / sphereA;
        if (!(distance > 1e-6 && distance < best)) continue;
        const hy = oy + distance * dy, hz = oz + distance * dz;
        const axial = hy * ay + hz * az;
        if (axial >= length && hz >= 0) { best = distance; q = axial; kind = 2; }
      }
    }
    if (!kind) return 0;
    hit[0] = best; hit[4] = q;
    if (kind === 1) {
      hit[1] = (ox + best * dx) / radius;
      hit[2] = (oy + best * dy - q * ay) / radius;
      hit[3] = (oz + best * dz - q * az) / radius;
    } else {
      hit[1] = (ox + best * dx) / radius;
      hit[2] = (oy + best * dy - length * ay) / radius;
      hit[3] = (oz + best * dz - length * az) / radius;
    }
    hit[5] = kind; return kind;
  }
  const lightLength = Math.hypot(-.45, -.6, 2.6);
  const lx = -.45 / lightLength, ly = -.6 / lightLength, lz = 2.6 / lightLength;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = (x + .5) / scale - METAL_LEVER_MODEL.pivot[0], py = (y + .5) / scale - METAL_LEVER_MODEL.pivot[1];
    const dx = px - ex, dy = py - ey, dz = -ez, at = (y * width + x) * 4;
    const kind = intersect(ex, ey, ez, dx, dy, dz);
    if (kind) {
      const distance = hit[0], nx = hit[1], ny = hit[2], nz = hit[3];
      const dl = Math.hypot(dx, dy, dz), vx = -dx / dl, vy = -dy / dl, vz = -dz / dl;
      const hv = Math.hypot(lx + vx, ly + vy, lz + vz);
      const specular = Math.pow(Math.max(0, (nx * (lx + vx) + ny * (ly + vy) + nz * (lz + vz)) / hv), 28);
      const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
      const nv = nx * vx + ny * vy + nz * vz;
      const rx = 2 * nv * nx - vx, ry = 2 * nv * ny - vy;
      const reflection = Math.exp(-Math.pow((rx + .25) / .38, 2)) * .72 + Math.exp(-Math.pow((ry + .2) / .7, 2)) * .28;
      let metal = 64 + 105 * diffuse + 75 * reflection + 65 * specular;
      if (kind === 2) {
        metal += 12 + 18 * specular;
        const normalAxial = ny * ay + nz * az;
        tipNormalAxialMin = Math.min(tipNormalAxialMin, normalAxial);
        tipNormalAxialMax = Math.max(tipNormalAxialMax, normalAxial);
        tipPixels++;
      } else sidePixels++;
      pixels[at] = clamp(metal, 0, 255); pixels[at + 1] = clamp(metal * 1.008, 0, 255);
      pixels[at + 2] = clamp(metal * .986, 0, 255); pixels[at + 3] = 255;
      solid[y * width + x] = kind;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    } else {
      // One cast shadow. Its alpha is blurred below, not three offset silhouettes.
      shadow[y * width + x] = intersect(px, py, .015, lx, ly, lz) ? 25 : 0;
      pixels[at] = 39; pixels[at + 1] = 35; pixels[at + 2] = 29;
    }
  }
  const sigma = scale * .55, blurRadius = Math.ceil(sigma * 2.5), kernel = [];
  let total = 0;
  for (let k = -blurRadius; k <= blurRadius; k++) { const weight = Math.exp(-k * k / (2 * sigma * sigma)); kernel.push(weight); total += weight; }
  const intermediate = new Float32Array(shadow.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let sum = 0; for (let k = -blurRadius; k <= blurRadius; k++) if (x + k >= 0 && x + k < width) sum += shadow[y * width + x + k] * kernel[k + blurRadius];
    intermediate[y * width + x] = sum / total;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (!solid[y * width + x]) {
    let sum = 0; for (let k = -blurRadius; k <= blurRadius; k++) if (y + k >= 0 && y + k < height) sum += intermediate[(y + k) * width + x] * kernel[k + blurRadius];
    pixels[(y * width + x) * 4 + 3] = sum / total;
  }
  const frame = {width, height, pixels, solid, geometry: g, sidePixels, tipPixels,
    tipNormalSpread: Number.isFinite(tipNormalAxialMin) && Number.isFinite(tipNormalAxialMax) ? tipNormalAxialMax - tipNormalAxialMin : 0,
    bounds: {left: minX / scale, top: minY / scale, right: (maxX + 1) / scale, bottom: (maxY + 1) / scale}};
  if (frames.size >= 64) frames.delete(frames.keys().next().value);
  frames.set(key, frame);
  return frame;
}

const STYLE_ID = 'metal-bay-selector-solid-v1';
function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const sheet = document.createElement('style'); sheet.id = STYLE_ID;
  sheet.textContent = `
.moog-header-choice.metal-bay-selector{position:relative;width:52px;min-width:52px;height:48px;min-height:48px;box-sizing:border-box;display:block;background:transparent;border:0;box-shadow:none;overflow:visible}
.metal-bay-selector .mbs-label,.metal-bay-selector .mbs-value{position:absolute;left:1px;right:1px;z-index:2;margin:0;text-align:center;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:900 5.2px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;color:#5e564a}
.metal-bay-selector .mbs-label{top:1px}.metal-bay-selector .mbs-value{bottom:1px;color:color-mix(in srgb,var(--product-accent,#765a52) 72%,#282723)}
.metal-bay-selector .mbs-input{position:absolute;inset:0;box-sizing:border-box;width:100%;height:100%;min-width:44px;min-height:44px;margin:0;padding:0;appearance:none;-webkit-appearance:none;border:0;background:transparent;box-shadow:none;transform:none;filter:none;opacity:1;cursor:ns-resize;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;overflow:visible}
.metal-bay-selector .mbs-input:focus-visible{outline:2px solid var(--product-accent,#357f78);outline-offset:-1px}
.metal-bay-selector .mbs-bay{position:absolute;left:50%;top:7px;width:28px;height:30px;box-sizing:border-box;transform:translateX(-50%);border:1px solid rgba(75,69,59,.62);border-radius:7px;background:radial-gradient(ellipse at 50% 9%,rgba(255,255,255,.46) 0 18%,transparent 54%),linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.025) 22%,rgba(64,57,47,.06) 74%,rgba(47,42,35,.16)),linear-gradient(90deg,#958b78 0%,#b6aa93 7%,#ded1b8 18%,#f2e7d1 37%,#f7ecd7 50%,#e2d4ba 70%,#b8aa91 90%,#8d8371 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.78),inset 0 0 0 1px rgba(255,255,255,.18),inset 2px 0 2px rgba(255,255,255,.16),inset -2px 0 2px rgba(63,53,40,.12),inset 0 -2px 3px rgba(54,45,34,.22),0 1px 0 rgba(255,255,255,.28),0 1.4px 2px rgba(58,46,31,.18);pointer-events:none}
.metal-bay-selector .mbs-groove{position:absolute;left:50%;top:50%;width:8px;height:16px;box-sizing:border-box;transform:translate(-50%,-50%);border:1px solid rgba(30,29,25,.82);border-radius:5px;background:radial-gradient(ellipse at 42% 34%,#23231f 0 15%,#11120f 46%,#050605 78%,#020302 100%);box-shadow:inset 0 2px 4px rgba(0,0,0,.96),inset 1px 0 1px rgba(255,255,255,.05),0 0 0 1px rgba(255,255,255,.06)}
.metal-bay-selector .mbs-tick{position:absolute;left:2px;right:2px;height:.7px;top:var(--mbs-tick-y);background:linear-gradient(90deg,rgba(57,52,45,.56) 0 20%,transparent 20% 80%,rgba(57,52,45,.56) 80% 100%);box-shadow:none;pointer-events:none}
.metal-bay-selector .mbs-solid{position:absolute;left:-1px;top:-1px;width:28px;height:30px;display:block;pointer-events:none;border:0;background:transparent;box-shadow:none;transform:none;filter:none;opacity:1;image-rendering:auto}
.metal-bay-selector .mbs-input:hover,.metal-bay-selector .mbs-input:active{background:transparent;box-shadow:none;transform:none;filter:none;opacity:1}
.mav-sub-strip .moog-header-choice.metal-bay-selector{width:46px;min-width:46px}
`; document.head.append(sheet);
}

export function createMetalBaySelector({spec, api, label}) {
  if (!spec?.id || typeof api?.read !== 'function' || typeof api?.write !== 'function') throw new Error('metalBaySelector.invalidContract');
  installStyles();
  const endpoint = `control.${spec.id}`;
  const min = Number(spec.minimum ?? 0), max = Number(spec.maximum ?? 1), step = Number(spec.quantize ?? 1);
  const choices = Array.isArray(spec.choices) && spec.choices.length ? spec.choices :
    Array.from({length: clamp(Math.floor((max - min) / (step > 0 ? step : 1) + 1e-9) + 1, 1, 32)}, (_, i) => ({value: min + i * (step > 0 ? step : 1), label: String(min + i * (step > 0 ? step : 1))}));
  if (choices.some(row => !Number.isFinite(Number(row.value)))) throw new Error('metalBaySelector.nonFiniteChoice');
  const root = document.createElement('div'); root.className = 'moog-header-choice metal-bay-selector';
  root.dataset.interfaceFamily = METAL_LEVER_MODEL.revision; root.dataset.choiceCount = String(choices.length);
  root.dataset.visualApproval = 'pending-human';
  const caption = document.createElement('span'); caption.className = 'mbs-label'; caption.textContent = label || spec.label || spec.id;
  const input = document.createElement('button'); input.className = 'moog-header-choice__face mbs-input'; input.type = 'button';
  input.setAttribute('role', 'slider'); input.setAttribute('aria-orientation', 'vertical');
  input.setAttribute('aria-label', spec.label || spec.id); input.setAttribute('aria-valuemin', '0'); input.setAttribute('aria-valuemax', String(choices.length - 1));
  const bay = document.createElement('span'); bay.className = 'mbs-bay'; bay.setAttribute('aria-hidden', 'true');
  const groove = document.createElement('i'); groove.className = 'mbs-groove'; bay.append(groove);
  for (let i = 0; i < choices.length; i++) {
    const tick = document.createElement('i'); tick.className = 'mbs-tick'; tick.dataset.index = String(i);
    tick.style.setProperty('--mbs-tick-y', `${choices.length <= 1 ? 14 : 24 - i * 20 / (choices.length - 1)}px`); bay.append(tick);
  }
  const solid = document.createElement('img'); solid.className = 'mbs-solid'; solid.width = 224; solid.height = 240; solid.draggable = false;
  solid.setAttribute('aria-hidden', 'true'); bay.append(solid);
  const output = document.createElement('output'); output.className = 'mbs-value';
  input.append(bay, output); root.append(caption, input);
  const nearest = value => choices.reduce((best, row, i) => Math.abs(Number(row.value) - value) < Math.abs(Number(choices[best].value) - value) ? i : best, 0);
  let current = Number(api.read(endpoint) ?? spec.default ?? choices[0].value), index = -1, gesture = null, suppressPointerClick = false;
  const sync = value => {
    const n = Number(value); if (!Number.isFinite(n)) return;
    current = n; const next = nearest(n); if (next === index) return; index = next;
    const frame = renderLeverFrame(choices.length <= 1 ? .5 : index / (choices.length - 1));
    const url = frameImageUrl(frame); if (solid.src !== url) solid.src = url;
    root.dataset.position = String(index); root.dataset.angle = String(frame.geometry.angle);
    const text = String(choices[index].label ?? choices[index].value);
    output.textContent = text.replace(/^STRAIGHT\s+/i, '').replace(/^DOTTED\s+/i, 'D ').replace(/^TRIPLET\s+/i, 'T ').replace(/\s*BAR$/i, 'B').replace('EXT RESET', 'EXT').slice(0, 8);
    input.setAttribute('aria-valuenow', String(index)); input.setAttribute('aria-valuetext', text);
    input.title = `${spec.label || spec.id} · ${text}`;
  };
  const write = (next, transaction) => {
    const row = choices[clamp(next, 0, choices.length - 1)];
    if (Number(row.value) !== current) api.write(endpoint, Number(row.value), transaction ?? undefined);
    sync(api.read(endpoint) ?? row.value);
  };
  const finish = (event, cancelled = false) => {
    if (!gesture || (event?.pointerId !== undefined && event.pointerId !== gesture.id)) return;
    event?.preventDefault?.(); const active = gesture; gesture = null; root.dataset.dragging = '0';
    window.removeEventListener('blur', blur);
    window.removeEventListener('pointerup', globalUp);
    window.removeEventListener('pointercancel', globalCancel);
    // Consume the compatibility click after EVERY pointer gesture, not only a tap.
    suppressPointerClick = true;
    try {
      if (cancelled) { if (current !== active.value) api.write(endpoint, active.value, active.transaction ?? undefined); sync(api.read(endpoint) ?? active.value); }
      else if (!active.moved) write((active.index + 1) % choices.length, active.transaction);
    } finally {
      try { if (active.transaction !== null) api.endTransaction?.(active.transaction, cancelled ? 'cancel' : 'commit'); }
      finally { try { if (input.hasPointerCapture?.(active.id)) input.releasePointerCapture(active.id); } catch {} }
    }
  };
  const blur = () => finish(null, true);
  const globalUp = event => finish(event, !root.isConnected);
  const globalCancel = event => finish(event, true);
  input.addEventListener('pointerdown', event => {
    if (gesture || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); input.focus({preventScroll: true}); suppressPointerClick = false;
    gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, index, value: current, moved: false,
      scale: Math.max(.1, input.getBoundingClientRect().height / input.offsetHeight),
      transaction: api.beginTransaction?.({kind: 'header-metal-choice', endpointId: endpoint}) ?? null};
    root.dataset.dragging = '1'; window.addEventListener('blur', blur);
    window.addEventListener('pointerup', globalUp);
    window.addEventListener('pointercancel', globalCancel);
    try { input.setPointerCapture(event.pointerId); } catch {}
  });
  input.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    event.preventDefault();
    const dy = (gesture.y - event.clientY) / gesture.scale, dx = (event.clientX - gesture.x) / gesture.scale;
    if (Math.hypot(dx, dy) > 4) gesture.moved = true;
    const stepPx = Math.max(8, Math.min(18, 72 / Math.max(1, choices.length - 1)));
    write(gesture.index + Math.trunc(dy / stepPx), gesture.transaction);
  });
  input.addEventListener('pointerup', event => finish(event));
  input.addEventListener('pointercancel', event => finish(event, true));
  input.addEventListener('lostpointercapture', event => finish(event, true));
  input.addEventListener('click', event => {
    event.preventDefault(); if (gesture) return;
    if (event.detail !== 0 && suppressPointerClick) { suppressPointerClick = false; return; }
    write((index + 1) % choices.length);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape' && gesture) { event.preventDefault(); finish(null, true); return; }
    if (gesture || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') write(0); else if (event.key === 'End') write(choices.length - 1);
    else write(index + (['ArrowUp', 'ArrowRight', 'PageUp'].includes(event.key) ? 1 : -1) * (event.key.startsWith('Page') ? 4 : 1));
  });
  root.disposeMetalSelector = () => { finish(null, true); window.removeEventListener('blur', blur); };
  sync(current); return {root, sync};
}
