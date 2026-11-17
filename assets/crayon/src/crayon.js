// 蜡笔 / 彩铅画法工具。背景、物件、角色的"手绘质感"都从这里来。
// 只用 Canvas 2D；随机数全部有种子（mulberry32），同一个种子每次画出来都一样。
import { mulberry32, clamp01 } from "./util.js";

export const W = 1920;
export const H = 1080;

export function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// ---------- 颜色 ----------
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(hex, a = 1) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
export function mix(a, b, k) {
  const A = rgb(a);
  const B = rgb(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join("");
}
/** 压暗：往深靛色走（这个画风不用纯黑） */
export const darker = (hex, k = 0.3) => mix(hex, "#1c1733", k);
export const lighter = (hex, k = 0.3) => mix(hex, "#fffaf0", k);
/** 在一组颜色里按权重随机挑一个 */
export function pick(rnd, list) {
  if (typeof list[0] === "string") return list[Math.floor(rnd() * list.length)];
  const total = list.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [c, w] of list) if ((r -= w) <= 0) return c;
  return list[list.length - 1][0];
}

// ---------- 纹理（只生成一次） ----------
let TEX = null;
export function textures() {
  if (TEX) return TEX;
  const rnd = mulberry32(20261113);

  // 纸纹：随机亮点，像彩铅在纸面上留下的小空隙
  const tooth = canvas(256, 256);
  {
    const g = tooth.getContext("2d");
    const im = g.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const v = rnd();
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 255;
      im.data[i * 4 + 3] = v > 0.74 ? Math.round(((v - 0.74) / 0.26) * 255) : 0;
    }
    g.putImageData(im, 0, 0);
  }

  // 横向拖拽纹：蜡笔横涂时留下的一条条空隙（天空、海面用）
  const streak = canvas(1024, 256);
  {
    const g = streak.getContext("2d");
    const im = g.createImageData(1024, 256);
    const CELL = 32; // 1024 / 32 = 32 段，左右能接上
    for (let y = 0; y < 256; y++) {
      const r = mulberry32(9000 + y);
      const vals = Array.from({ length: 1024 / CELL }, () => r());
      const thin = r() < 0.35; // 有些行是细长的亮缝
      for (let x = 0; x < 1024; x++) {
        const i = Math.floor(x / CELL);
        const f = (x % CELL) / CELL;
        const u = f * f * (3 - 2 * f);
        const v = vals[i] * (1 - u) + vals[(i + 1) % vals.length] * u;
        const a = clamp01((v - (thin ? 0.5 : 0.62)) * 4.2);
        const p = (y * 1024 + x) * 4;
        im.data[p] = im.data[p + 1] = im.data[p + 2] = 255;
        im.data[p + 3] = Math.round(a * 255);
      }
    }
    g.putImageData(im, 0, 0);
  }

  // 彩铅排线：很多条斜向短线（约 -60°）。白色用来提亮（screen），深色用来压暗（multiply）
  const hatch = (seed, color, n, ang, wMin = 0.8, wMax = 2.4) => {
    const c = canvas(256, 256);
    const g = c.getContext("2d");
    const r = mulberry32(seed);
    g.strokeStyle = color;
    g.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const x = r() * 256;
      const y = r() * 256;
      const len = 16 + r() * 48;
      const a = ang + (r() - 0.5) * 0.16;
      g.globalAlpha = 0.25 + r() * 0.6;
      g.lineWidth = wMin + r() * (wMax - wMin);
      for (const ox of [-256, 0, 256])
        for (const oy of [-256, 0, 256]) {
          g.beginPath();
          g.moveTo(x + ox, y + oy);
          g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
          g.stroke();
        }
    }
    return c;
  };
  const hatchW = hatch(11, "#ffffff", 240, -1.05);
  const hatchK = hatch(12, "#2a2240", 240, -1.05);
  const hatchV = hatch(13, "#2a2240", 200, -1.45, 0.8, 2.0); // 接近竖直的排线（墙、草坡）
  const hatchWV = hatch(14, "#ffffff", 200, -1.45, 0.8, 2.0);
  const hatchKH = hatch(15, "#2a2240", 220, -0.06, 0.8, 2.2); // 接近水平的排线（地面、海面）
  const hatchWH = hatch(16, "#ffffff", 220, -0.06, 0.8, 2.2);

  // 角色身上的白色斜划痕和小方点（像彩铅在纸上留下的空隙）
  const scratch = canvas(512, 512);
  {
    const g = scratch.getContext("2d");
    const r = mulberry32(31);
    g.strokeStyle = "#ffffff";
    g.lineCap = "round";
    for (let i = 0; i < 22; i++) {
      const x = r() * 512;
      const y = r() * 512;
      const len = 30 + r() * 110;
      const a = -1.12 + (r() - 0.5) * 0.08;
      g.globalAlpha = 0.25 + r() * 0.45;
      g.lineWidth = 1 + r() * 1.8;
      for (const ox of [-512, 0, 512])
        for (const oy of [-512, 0, 512]) {
          g.beginPath();
          g.moveTo(x + ox, y + oy);
          g.lineTo(x + ox - Math.cos(a) * len, y + oy - Math.sin(a) * len);
          g.stroke();
        }
    }
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 18; i++) {
      g.globalAlpha = 0.3 + r() * 0.4;
      const s = 2 + r() * 4;
      g.fillRect(r() * 512, r() * 512, s, s);
    }
  }

  TEX = { tooth, streak, hatchW, hatchK, hatchV, hatchWV, hatchKH, hatchWH, scratch };
  return TEX;
}

// 每个 context 各自缓存 pattern；k = 纹理缩放（画在缩放过的坐标系里时，用 1/scale 保持屏幕上的密度）
const PATS = new WeakMap();
export function pat(ctx, name, k = 1, ox = 0, oy = 0) {
  let m = PATS.get(ctx);
  if (!m) PATS.set(ctx, (m = {}));
  const p = m[name] || (m[name] = ctx.createPattern(textures()[name], "repeat"));
  p.setTransform(new DOMMatrix([k, 0, 0, k, ox, oy]));
  return p;
}

// ---------- 平涂 + 描边 + 排线 ----------
/**
 * 蜡笔平涂：底色 → 内侧一圈同色系深描边 → 排线压暗 → 排线提亮 → 纸纹亮点。
 * o: { fill, line, lw, shade, hl, fleck, k(纹理缩放), dir: "d"(斜)|"h"(横)|"v"(竖) }
 */
const DIRS = { d: ["hatchK", "hatchW"], v: ["hatchV", "hatchWV"], h: ["hatchKH", "hatchWH"] };
export function crayon(ctx, path, o) {
  const { fill, line = darker(fill, 0.34), lw = 6, shade = 0.2, hl = 0.14, fleck = 0.22, k = 1 } = o;
  const dir = o.dir || (o.hatch === "hatchV" ? "v" : "d");
  const [hatch, hatchHi] = DIRS[dir];
  ctx.save();
  ctx.fillStyle = fill;
  ctx.fill(path);
  ctx.clip(path);
  if (lw > 0) {
    ctx.lineWidth = lw * 2;
    ctx.lineJoin = "round";
    ctx.strokeStyle = line;
    ctx.stroke(path);
  }
  if (shade > 0) {
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = shade;
    ctx.fillStyle = pat(ctx, hatch, k);
    ctx.fill(path);
  }
  if (hl > 0) {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = hl;
    ctx.fillStyle = pat(ctx, hatchHi, k);
    ctx.fill(path);
  }
  if (fleck > 0) {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = fleck;
    ctx.fillStyle = pat(ctx, "tooth", k);
    ctx.fill(path);
  }
  ctx.restore();
}

/** 把一整层"蜡化"：用纸纹在上面抠出细小空隙（底下的东西会透出来一点） */
export function waxify(ctx, amount = 0.2, k = 1) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = amount;
  ctx.fillStyle = pat(ctx, "tooth", k);
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

// ---------- 线 ----------
/** 歪歪扭扭的蜡笔线（两遍：一遍实、一遍虚），pts = [[x,y],...] */
export function scribble(ctx, pts, { color, width = 6, seed = 1, jitter = 1.4, alpha = 1, passes = 2, step = 10 } = {}) {
  const rnd = mulberry32(seed);
  const seg = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let j = 0; j < n; j++) seg.push([ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n]);
  }
  seg.push(pts[pts.length - 1]);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  for (let p = 0; p < passes; p++) {
    ctx.globalAlpha = alpha * (p === 0 ? 0.95 : 0.4);
    ctx.lineWidth = width * (p === 0 ? 1 : 0.62);
    ctx.beginPath();
    seg.forEach(([x, y], i) => {
      const jx = (rnd() - 0.5) * jitter * 2;
      const jy = (rnd() - 0.5) * jitter * 2;
      if (i) ctx.lineTo(x + jx, y + jy);
      else ctx.moveTo(x + jx, y + jy);
    });
    ctx.stroke();
  }
  ctx.restore();
}

/** 一条横向蜡笔笔触的形状：中心线 yc(x)、粗细 th(x)，两头收尖，边缘毛糙 */
export function ribbon(x0, x1, yc, th, { rough = 3, seed = 1, step = 14, taper = 140 } = {}) {
  const rnd = mulberry32(seed);
  const top = [];
  const bot = [];
  for (let x = x0; x <= x1 + 0.1; x += step) {
    const e = Math.min(1, (x - x0) / taper, (x1 - x) / taper);
    const tk = th(x) * Math.sqrt(Math.max(0.04, e));
    const y = yc(x);
    top.push([x, y - tk / 2 + (rnd() - 0.5) * rough]);
    bot.push([x, y + tk / 2 + (rnd() - 0.5) * rough]);
  }
  const p = new Path2D();
  p.moveTo(...top[0]);
  top.forEach((q) => p.lineTo(...q));
  bot.reverse().forEach((q) => p.lineTo(...q));
  p.closePath();
  return p;
}

/**
 * 画一组横向蜡笔笔触：先全部填到临时层，再用拖拽纹抠出空隙，最后叠回去。
 * list: [{ x0, x1, y, th, amp, freq, phase, color, alpha }]
 */
export function strokes(ctx, list, { streak = 0.55, seed = 1, bristles = true } = {}) {
  const L = canvas(ctx.canvas.width, ctx.canvas.height);
  const g = L.getContext("2d");
  g.setTransform(ctx.getTransform());
  const rnd = mulberry32(seed);
  list.forEach((b, i) => {
    const amp = b.amp ?? 10;
    const freq = b.freq ?? 0.004;
    const ph = b.phase ?? rnd() * 6.28;
    const yc = (x) => b.y + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 2.7 + ph * 1.7) * amp * 0.35;
    const th = (x) => b.th * (0.78 + 0.22 * Math.sin(x * 0.011 + ph * 2.1));
    g.globalAlpha = b.alpha ?? 1;
    g.fillStyle = b.color;
    g.fill(ribbon(b.x0, b.x1, yc, th, { seed: seed * 131 + i, rough: b.rough ?? 4 }));
    if (bristles) {
      // 笔触里的几根"笔毛"细线：同色更深 / 更浅
      g.lineCap = "round";
      const n = Math.max(1, Math.round(b.th / 14));
      for (let j = 0; j < n; j++) {
        const off = (rnd() - 0.5) * b.th * 0.7;
        const xa = b.x0 + rnd() * (b.x1 - b.x0) * 0.3;
        const xb = b.x1 - rnd() * (b.x1 - b.x0) * 0.3;
        g.globalAlpha = (b.alpha ?? 1) * (0.25 + rnd() * 0.3);
        g.strokeStyle = rnd() < 0.5 ? darker(b.color, 0.18) : lighter(b.color, 0.22);
        g.lineWidth = 1.5 + rnd() * 2.5;
        g.beginPath();
        for (let x = xa; x <= xb; x += 18) {
          const y = yc(x) + off;
          if (x === xa) g.moveTo(x, y);
          else g.lineTo(x, y + (rnd() - 0.5) * 1.5);
        }
        g.stroke();
      }
    }
  });
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = streak;
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = pat(g, "streak");
  g.fillRect(0, 0, L.width, L.height);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(L, 0, 0);
  ctx.restore();
}

// ---------- 草 ----------
/**
 * 草地：底色 + 成千上万根短竖线（远处短细、近处长粗）。
 * region: Path2D（草地范围）；y0 = 地平线，y1 = 最近处
 */
export function grass(ctx, region, { base, blades, x0, x1, y0, y1, density = 0.012, minLen = 8, maxLen = 64, minW = 1.2, maxW = 4.6, seed = 1, lean = 0 }) {
  crayon(ctx, region, { fill: base, lw: 0, shade: 0.28, hl: 0.08, fleck: 0.12, hatch: "hatchV" });
  const rnd = mulberry32(seed);
  const n = Math.round((x1 - x0) * (y1 - y0) * density);
  const list = [];
  for (let i = 0; i < n; i++) list.push([x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), rnd(), rnd(), rnd(), rnd()]);
  list.sort((a, b) => a[1] - b[1]);
  ctx.save();
  ctx.clip(region);
  ctx.lineCap = "round";
  for (const [x, y, r1, r2, r3, r4] of list) {
    const d = (y - y0) / (y1 - y0); // 0 远 → 1 近
    const len = (minLen + (maxLen - minLen) * d * d) * (0.55 + r1 * 0.9);
    const a = lean + (r2 - 0.5) * 0.32;
    ctx.strokeStyle = pick(() => r3, blades);
    ctx.globalAlpha = 0.65 + r4 * 0.35;
    ctx.lineWidth = minW + (maxW - minW) * d * (0.6 + r4 * 0.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(a) * len, y - Math.cos(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- 光 ----------
export function glow(ctx, x, y, r, color, a = 0.6, op = "screen") {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.35, rgba(color, a * 0.42));
  g.addColorStop(0.7, rgba(color, a * 0.1));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** 星星：小米字 + 中心亮点 + 柔光；tw = 闪烁 0–1 */
export function star(ctx, x, y, s, tw = 1, color = "#f8f4ed") {
  glow(ctx, x, y, s * 5, color, 0.32 * tw);
  ctx.save();
  ctx.strokeStyle = rgba(color, 0.55 + 0.45 * tw);
  ctx.lineWidth = Math.max(1, s * 0.32);
  ctx.lineCap = "round";
  const r = s * (0.8 + 0.4 * tw);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3 + 0.3;
    ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.fillStyle = rgba(color, 0.9);
  ctx.beginPath();
  ctx.arc(x, y, s * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 发光的光点（萤火、灯光颗粒） */
export function mote(ctx, x, y, r, color, a = 1) {
  glow(ctx, x, y, r * 6, color, 0.45 * a);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = lighter(color, 0.5);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 闭着眼的脸（太阳 / 月亮）：两道弯弯的眼 + 小嘴 + 腮红 */
export function sleepyFace(ctx, x, y, r, { ink = "#9a7a3a", blush = "#eca49e", smile = 0.6 } = {}) {
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, r * 0.045);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * r * 0.3, y - r * 0.06, r * 0.13, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.beginPath();
  if (smile > 0) ctx.arc(x, y + r * 0.2, r * 0.14 * smile + 1, 0.2 * Math.PI, 0.8 * Math.PI);
  else {
    ctx.moveTo(x - r * 0.08, y + r * 0.3);
    ctx.lineTo(x + r * 0.08, y + r * 0.3);
  }
  ctx.stroke();
  ctx.fillStyle = rgba(blush, 0.55);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * r * 0.52, y + r * 0.2, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------- 镜头（2.5D 分层） ----------
/**
 * cam = { x, y, z }：镜头看着主体平面上的 (x, y)，放大 z 倍。
 * depth：1 = 主体平面，越小越远（移动、放大都越少）。
 */
export function withCam(ctx, cam, depth, fn) {
  const z = 1 + (cam.z - 1) * depth;
  const lx = W / 2 + (cam.x - W / 2) * depth;
  const ly = H / 2 + (cam.y - H / 2) * depth;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-lx, -ly);
  fn(ctx);
  ctx.restore();
}

/** 预先画好的一层（带边距的大画布）：layer = { c: canvas, x, y }（世界坐标里左上角的位置） */
export function makeLayer(x, y, w, h, draw) {
  const c = canvas(w, h);
  const g = c.getContext("2d");
  g.translate(-x, -y);
  draw(g);
  return { c, x, y };
}
/** 一层的虚化版本（景深：前景、特写时的背景） */
export function blurLayer(layer, px) {
  const c = canvas(layer.c.width, layer.c.height);
  const g = c.getContext("2d");
  g.filter = `blur(${px}px)`;
  g.drawImage(layer.c, 0, 0);
  return { c, x: layer.x, y: layer.y };
}
export function drawLayer(ctx, cam, depth, layer, alpha = 1) {
  withCam(ctx, cam, depth, (g) => {
    g.globalAlpha = alpha;
    g.drawImage(layer.c, layer.x, layer.y);
  });
}

/** 一拍二：每 2 帧（24 fps 下 = 1/12 s）才换一张画 */
export const onTwos = (t) => Math.floor(t * 12 + 1e-4) / 12;
