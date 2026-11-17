// 动效零件：流光、光轨、雨、彩纸、水波、火花、光柱、圆环、印章、光斑、星光。
// 全部只由时间决定（随机数带种子），可以乱序渲染。
import { mulberry32, clamp01, lerp, ease } from "./util.js";
import { W, H, canvas, rgba, glowDot, star } from "./gfx.js";

const CONF = ["#e65a4f", "#f2c14e", "#7fd3e0", "#f08a4b", "#f4efe6", "#e88aa5", "#5d8fe6"];

// ---------- 曲线与路径 ----------
export function cubicPt(P, u) {
  const v = 1 - u;
  const a = v * v * v;
  const b = 3 * v * v * u;
  const c = 3 * v * u * u;
  const d = u * u * u;
  return { x: a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], y: a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1] };
}

export function makePath(points) {
  const pts = points.map(([x, y]) => ({ x, y }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum, total: cum[cum.length - 1] };
}

export function pointAt(path, s) {
  const { pts, cum } = path;
  if (s <= 0) return { ...pts[0] };
  for (let i = 1; i < pts.length; i++) {
    if (s <= cum[i]) {
      const k = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return { x: lerp(pts[i - 1].x, pts[i].x, k), y: lerp(pts[i - 1].y, pts[i].y, k) };
    }
  }
  return { ...pts[pts.length - 1] };
}

function cutPath(path, s0, s1) {
  const out = [pointAt(path, s0)];
  for (let i = 1; i < path.pts.length - 1; i++) if (path.cum[i] > s0 && path.cum[i] < s1) out.push({ ...path.pts[i] });
  out.push(pointAt(path, s1));
  return out;
}

function strokePts(g, pts) {
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.stroke();
}

// ---------- 流光（屏幕坐标，三次贝塞尔上一段，头亮尾淡） ----------
export function comet(g, P, uHead, uTail, hex, core = "#fffaf0", scale = 1, alpha = 1) {
  if (alpha <= 0.002 || uHead <= uTail) return;
  const N = 44;
  const pts = [];
  for (let i = 0; i <= N; i++) pts.push(cubicPt(P, lerp(uTail, uHead, i / N)));
  g.save();
  g.globalCompositeOperation = "lighter";
  g.lineCap = "butt"; // 分段描边用平头，圆头会在接缝处叠出一串亮珠
  const passes = [
    [42, 0.06, hex],
    [20, 0.15, hex],
    [9, 0.42, hex],
    [3.2, 0.95, core],
  ];
  for (const [w, a, c] of passes) {
    for (let i = 1; i <= N; i++) {
      const k = i / N;
      g.strokeStyle = rgba(c, a * alpha * Math.pow(k, 1.3));
      g.lineWidth = w * scale * (0.3 + 0.7 * k);
      g.beginPath();
      g.moveTo(pts[i - 1].x, pts[i - 1].y);
      g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
    }
  }
  const h = pts[N];
  glowDot(g, h.x, h.y, 62 * scale, hex, 0.55 * alpha);
  glowDot(g, h.x, h.y, 16 * scale, "#ffffff", alpha);
  g.restore();
  star(g, h.x, h.y, 70 * scale, hex, 0.7 * alpha, { vRatio: 0.5, th: 0.04, core: 0.2 });
}

// ---------- 光轨（世界坐标折线，走过的地方一直亮着） ----------
export function trail(g, path, sHead, hex, core, { width = 1, fadeLen = Infinity, tail = 380, alpha = 1 } = {}) {
  sHead = Math.min(sHead, path.total);
  if (sHead <= 1 || alpha <= 0) return;
  g.save();
  g.globalCompositeOperation = "lighter";
  g.lineCap = "round";
  g.lineJoin = "round";
  const passes = [
    [50, 0.06, hex],
    [26, 0.14, hex],
    [12, 0.4, hex],
    [4.8, 0.92, core],
  ];
  if (!isFinite(fadeLen)) {
    const pts = cutPath(path, 0, sHead);
    for (const [w, a, c] of passes) {
      g.strokeStyle = rgba(c, a * alpha);
      g.lineWidth = w * width;
      strokePts(g, pts);
    }
  } else {
    g.lineCap = "butt";
    const s0 = Math.max(0, sHead - fadeLen);
    const N = 20;
    for (let j = 0; j < N; j++) {
      const pts = cutPath(path, lerp(s0, sHead, j / N), lerp(s0, sHead, (j + 1) / N));
      const k = Math.pow((j + 1) / N, 0.8);
      for (const [w, a, c] of passes) {
        g.strokeStyle = rgba(c, a * alpha * k);
        g.lineWidth = w * width;
        strokePts(g, pts);
      }
    }
  }
  // 头部一段更亮（平头分段，避免接缝叠出亮珠）
  g.lineCap = "butt";
  const hs0 = Math.max(0, sHead - tail);
  const N = 12;
  for (let j = 0; j < N; j++) {
    const pts = cutPath(path, lerp(hs0, sHead, j / N), lerp(hs0, sHead, (j + 1) / N));
    const k = (j + 1) / N;
    g.strokeStyle = rgba(hex, 0.28 * k * alpha);
    g.lineWidth = 30 * width * k;
    strokePts(g, pts);
    g.strokeStyle = rgba(core, 0.8 * k * alpha);
    g.lineWidth = 9 * width * k;
    strokePts(g, pts);
  }
  const h = pointAt(path, sHead);
  glowDot(g, h.x, h.y, 72 * width, hex, 0.6 * alpha);
  glowDot(g, h.x, h.y, 20 * width, "#ffffff", alpha);
  g.restore();
}

// ---------- 雨（屏幕坐标斜线） ----------
export function rain(g, t, { n = 220, seed = 3, slope = 0.22, speed = 2300, len = [26, 64], width = [1, 2], alpha = [0.2, 0.5], color = "#dfe8ff" } = {}) {
  const r = mulberry32(seed);
  g.save();
  g.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const x0 = r() * (W + 600) - 300 - slope * H * 0.5;
    const y0 = r() * (H + 300);
    const l = lerp(len[0], len[1], r());
    const sp = speed * (0.75 + r() * 0.5);
    const w = lerp(width[0], width[1], r());
    const a = lerp(alpha[0], alpha[1], r());
    const span = H + l + 120;
    const y = ((y0 + t * sp) % span) - l - 60;
    const x = x0 + slope * y;
    g.strokeStyle = rgba(color, a);
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + slope * l, y + l);
    g.stroke();
  }
  g.restore();
}

function piece(g, size, shape) {
  if (shape < 0.45) g.fillRect(-size / 2, -size / 4, size, size / 2);
  else if (shape < 0.82) {
    g.beginPath();
    g.moveTo(0, -size * 0.6);
    g.lineTo(size * 0.55, size * 0.45);
    g.lineTo(-size * 0.55, size * 0.45);
    g.closePath();
    g.fill();
  } else {
    g.beginPath();
    g.arc(0, 0, size * 0.28, 0, Math.PI * 2);
    g.fill();
  }
}

// ---------- 漂浮彩纸（街道镜头，随镜头前推向外扩散） ----------
export function floatConfetti(g, t, { n = 46, seed = 21, vp = [960, 500], expand = 0.7 } = {}) {
  const r = mulberry32(seed);
  g.save();
  for (let i = 0; i < n; i++) {
    const x0 = r() * W;
    const y0 = r() * H;
    const size = 4 + r() * 9;
    const col = CONF[Math.floor(r() * CONF.length)];
    const rot = r() * 6.28 + (r() - 0.5) * 7 * t;
    const shape = r();
    const dx = (r() - 0.5) * 50;
    const dy = 15 + r() * 45;
    const k = 1 + expand * t * (0.6 + (0.8 * (i % 3)) / 2);
    const x = vp[0] + (x0 - vp[0]) * k + dx * t;
    const y = vp[1] + (y0 - vp[1]) * k + dy * t;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = col;
    g.globalAlpha = 0.85;
    piece(g, size * (0.8 + 0.5 * (k - 1)), shape);
    g.restore();
  }
  g.restore();
}

// ---------- 彩纸炸开（世界坐标，指数减速） ----------
export function burst(g, age, { x, y, n = 180, seed = 9, scale = 1 } = {}) {
  if (age < 0 || age > 1.6) return;
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const ang = r() * Math.PI * 2;
    const v = 900 + r() * 2100;
    const k = 3.2 + r() * 1.0;
    const size = (8 + r() * 15) * scale;
    const col = CONF[Math.floor(r() * CONF.length)];
    const rot0 = r() * 6.28;
    const spin = (r() - 0.5) * 16;
    const shape = r();
    const delay = r() * 0.04;
    const tt = age - delay;
    if (tt < 0) continue;
    const d = (v / k) * (1 - Math.exp(-k * tt));
    const a = tt < 0.75 ? 1 : 1 - clamp01((tt - 0.75) / 0.6);
    if (a <= 0) continue;
    g.save();
    g.translate(x + Math.cos(ang) * d, y + Math.sin(ang) * d);
    g.rotate(rot0 + spin * tt);
    g.globalAlpha = a;
    g.fillStyle = col;
    piece(g, size, shape);
    g.restore();
  }
  if (age < 0.25) {
    g.save();
    g.globalCompositeOperation = "lighter";
    glowDot(g, x, y, 260 * scale * (0.6 + age * 2), "#fff2d8", (1 - age / 0.25) * 0.9);
    g.restore();
  }
}

// ---------- 落脚水波（透视压扁的椭圆） ----------
export function ripple(g, x, y, age, { hex = "#ffffff", a = 0.8, rx = 240, ratio = 0.24, rings = 3, life = 0.75 } = {}) {
  if (age < 0) return;
  g.save();
  g.globalCompositeOperation = "lighter";
  for (let k = 0; k < rings; k++) {
    const ak = age - k * 0.1;
    if (ak < 0 || ak > life) continue;
    const q = ak / life;
    const R = 16 + rx * ease.out(q);
    const al = a * Math.pow(1 - q, 1.3);
    g.strokeStyle = rgba(hex, al * 0.25);
    g.lineWidth = 10 * (1 - q) + 2;
    g.beginPath();
    g.ellipse(x, y, R, R * ratio, 0, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = rgba(hex, al);
    g.lineWidth = 3.2 * (1 - q) + 1;
    g.beginPath();
    g.ellipse(x, y, R, R * ratio, 0, 0, Math.PI * 2);
    g.stroke();
  }
  if (age < 0.4) {
    g.save();
    g.translate(x, y);
    g.scale(1, 0.32);
    glowDot(g, 0, 0, 120 * (1 - age / 0.4) + 30, hex, 0.65 * (1 - age / 0.4));
    g.restore();
  }
  g.restore();
}

/** 落脚处留下的一小片光（光柱升起前一直在） */
export function footGlow(g, x, y, age, hex, until = 1) {
  if (age < 0) return;
  const a = Math.min(1, age / 0.1) * (0.45 + 0.1 * Math.sin(age * 20)) * until;
  g.save();
  g.globalCompositeOperation = "lighter";
  g.translate(x, y);
  g.scale(1, 0.3);
  glowDot(g, 0, 0, 120, hex, a);
  glowDot(g, 0, 0, 36, "#ffffff", a * 0.8);
  g.restore();
}

// ---------- 溅起的光点（抛物线） ----------
export function splash(g, x, y, age, { hex = "#ffd27a", seed = 1, n = 18, life = 0.45 } = {}) {
  if (age < 0 || age > life + 0.1) return;
  const r = mulberry32(seed);
  g.save();
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const vx = (r() - 0.5) * 520;
    const vy = -(260 + r() * 620);
    const l = life * (0.6 + r() * 0.4);
    const sz = 2 + r() * 3.5;
    if (age > l) continue;
    const px = x + vx * age;
    const py = y + vy * age + 1300 * age * age;
    if (py > y + 4) continue;
    const a = 1 - age / l;
    glowDot(g, px, py, sz * 4, hex, 0.5 * a);
    glowDot(g, px, py, sz, "#ffffff", a);
  }
  g.restore();
}

// ---------- 光柱（从落脚点冲上画面顶） ----------
export function pillar(g, x, yBase, age, hex, { width = 64, height = 1150 } = {}) {
  if (age < 0) return;
  const grow = ease.out(clamp01(age / 0.07));
  const h = height * grow;
  const fl = 0.9 + 0.1 * Math.sin(age * 90);
  g.save();
  g.globalCompositeOperation = "lighter";
  let grd = g.createLinearGradient(x - width, 0, x + width, 0);
  grd.addColorStop(0, rgba(hex, 0));
  grd.addColorStop(0.5, rgba(hex, 0.6 * fl));
  grd.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grd;
  g.fillRect(x - width, yBase - h, width * 2, h);
  grd = g.createLinearGradient(x - width * 0.22, 0, x + width * 0.22, 0);
  grd.addColorStop(0, rgba("#ffffff", 0));
  grd.addColorStop(0.5, rgba("#ffffff", 0.95));
  grd.addColorStop(1, rgba("#ffffff", 0));
  g.fillStyle = grd;
  g.fillRect(x - width * 0.22, yBase - h, width * 0.44, h);
  g.translate(x, yBase);
  g.scale(1, 0.25);
  glowDot(g, 0, 0, width * 3.2, hex, 0.7);
  g.restore();
}

// ---------- 同心圆扩散 ----------
export function rings(g, x, y, age, { n = 4, gap = 0.075, life = 0.6, rmax = 880, hex = "#f3f0ff" } = {}) {
  if (age < 0) return;
  g.save();
  g.globalCompositeOperation = "lighter";
  for (let k = 0; k < n; k++) {
    const a = age - k * gap;
    if (a < 0 || a > life) continue;
    const q = a / life;
    const R = 26 + rmax * ease.out(q);
    const al = 0.95 * Math.pow(1 - q, 0.9);
    g.strokeStyle = rgba(hex, al * 0.18);
    g.lineWidth = 16 * (1 - q) + 4;
    g.beginPath();
    g.arc(x, y, R, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = rgba(hex, al);
    g.lineWidth = 4.2 * (1 - q) + 1.6;
    g.beginPath();
    g.arc(x, y, R, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

// ---------- 印章 ----------
const STAMPS = new Map();

/** 红印章贴图：略不规则的方块、暗部斑驳、内框、白字、磨损小洞和边缘缺口。 */
export function stampSprite(ch) {
  if (STAMPS.has(ch)) return STAMPS.get(ch);
  const S = 256;
  const c = canvas(S, S);
  const g = c.getContext("2d");
  const r = mulberry32(ch.codePointAt(0) * 7 + 3);
  const m = 22;
  const e = S - 22;
  const pts = [];
  const edge = (x0, y0, x1, y1) => {
    for (let i = 0; i < 8; i++) {
      const k = i / 8;
      pts.push([lerp(x0, x1, k) + (r() - 0.5) * 5, lerp(y0, y1, k) + (r() - 0.5) * 5]);
    }
  };
  edge(m, m, e, m);
  edge(e, m, e, e);
  edge(e, e, m, e);
  edge(m, e, m, m);
  g.fillStyle = "#bc1b23";
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) g.lineTo(p[0], p[1]);
  g.closePath();
  g.fill();
  g.save();
  g.clip();
  for (let i = 0; i < 40; i++) {
    g.fillStyle = rgba("#8b151e", 0.15 + r() * 0.3);
    g.beginPath();
    g.arc(m + r() * (e - m), m + r() * (e - m), 6 + r() * 26, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  g.strokeStyle = "#ead9c6";
  g.lineWidth = 7;
  g.strokeRect(42, 42, S - 84, S - 84);
  g.fillStyle = "#efe2d1";
  g.font = '700 146px "MVSong", serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(ch, S / 2, S / 2 + 6);
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 520; i++) {
    g.globalAlpha = 0.25 + r() * 0.75;
    g.beginPath();
    g.arc(m + r() * (e - m), m + r() * (e - m), 0.6 + r() * 2.4, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 26; i++) {
    const side = Math.floor(r() * 4);
    const k = r();
    const [x, y] = side === 0 ? [lerp(m, e, k), m] : side === 1 ? [e, lerp(m, e, k)] : side === 2 ? [lerp(m, e, k), e] : [m, lerp(m, e, k)];
    g.beginPath();
    g.arc(x, y, 2 + r() * 6, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = "source-over";
  STAMPS.set(ch, c);
  return c;
}

/** 印章砸下：0.09 秒从 2.6 倍缩到原大，转正一点，再轻轻回弹。 */
export function drawStamp(g, ch, x, y, size, age, rot = -0.14, alpha = 1) {
  if (age < 0) return;
  const p = clamp01(age / 0.09);
  let sc = lerp(2.6, 1, ease.out(p));
  if (age > 0.09 && age < 0.17) sc = 1 - 0.06 * Math.sin(((age - 0.09) / 0.08) * Math.PI);
  g.save();
  g.translate(x, y);
  g.rotate(rot - 0.12 * (1 - ease.out(p)));
  g.scale(sc, sc);
  g.globalAlpha = alpha * clamp01(age / 0.025);
  g.drawImage(stampSprite(ch), -size / 2, -size / 2, size, size);
  g.restore();
}

// ---------- 背景光斑（虚化的街灯） ----------
export function bokeh(g, t, { vp = [960, 470], seed = 4, n = 70 } = {}) {
  const r = mulberry32(seed);
  const cols = ["#ffcf7a", "#ffcf7a", "#ffe2a6", "#a9d8ff", "#f39ab8"];
  g.save();
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const dx = (r() - 0.5) * 2;
    const dy = (r() - 0.5) * 2;
    const x = vp[0] + dx * (180 + r() * 520) + t * (r() - 0.5) * 40;
    const y = vp[1] - 60 + dy * (90 + r() * 260);
    const rad = 5 + Math.pow(r(), 2) * 22;
    const col = cols[Math.floor(r() * cols.length)];
    const a = 0.25 + r() * 0.5;
    const tw = 0.8 + 0.2 * Math.sin(t * (3 + r() * 4) + i);
    g.fillStyle = rgba(col, a * 0.5 * tw);
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
    glowDot(g, x, y, rad * 1.8, col, a * 0.35 * tw);
  }
  g.restore();
}

// ---------- 星光（人物化成光点、字幕闪光） ----------
export function sparkles(g, t, emitters, { seed = 5, n = 40, hex = "#ffd98a", span = 0.25, life = 0.5, rise = 140 } = {}) {
  if (t < 0 || !emitters.length) return;
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const e = emitters[Math.floor(r() * emitters.length)];
    const jx = (r() - 0.5) * 70;
    const jy = (r() - 0.5) * 70;
    const ts = r() * span;
    const l = life * (0.6 + r() * 0.6);
    const sz = 8 + r() * 14;
    const drift = (r() - 0.5) * 80;
    const age = t - ts;
    if (age < 0 || age > l) continue;
    const k = Math.sin((Math.PI * age) / l);
    star(g, e.x + jx + drift * age, e.y + jy - rise * age, sz * k + 2, hex, k, { rot: 0.2 + i, th: 0.08 });
  }
}
