// 通用美术（全部 Canvas 2D 蜡笔画法）：夜空、晚霞、暮色、云、月亮、太阳、光束、楼群、心、海鸥、盆栽、星星、窗灯……
// 配色见 references/style-crayon.md：黄昏暖黄橙、夜晚蓝紫，没有纯黑纯白。
import { crayon, strokes, scribble, glow, star, sleepyFace, darker, lighter, rgba, pick, pat } from "./crayon.js";
import { mulberry32 } from "./util.js";

const P = () => new Path2D();
export function circle(x, y, r) {
  const p = P();
  p.arc(x, y, r, 0, Math.PI * 2);
  return p;
}
export function rect(x, y, w, h) {
  const p = P();
  p.rect(x, y, w, h);
  return p;
}
export function rrect(x, y, w, h, r) {
  const p = P();
  p.roundRect(x, y, w, h, r);
  return p;
}

// ---------- 天空 ----------
function skyBase(g, X, Y, w, h, stops) {
  const grd = g.createLinearGradient(0, Y, 0, Y + h);
  for (const [y, c] of stops) grd.addColorStop(Math.min(1, Math.max(0, (y - Y) / h)), c);
  g.fillStyle = grd;
  g.fillRect(X, Y, w, h);
}
function skyStrokes(g, X, Y, w, h, seed, n, colorAt, thick = [26, 84]) {
  const r = mulberry32(seed);
  const list = [];
  for (let i = 0; i < n; i++) {
    const y = Y + 20 + r() * h * 0.92;
    const len = 520 + r() * 1500;
    const x0 = X - 120 + r() * (w - len * 0.4);
    list.push({ x0, x1: x0 + len, y, th: thick[0] + r() * (thick[1] - thick[0]), amp: 5 + r() * 14, freq: 0.0018 + r() * 0.003, color: colorAt(y, r), alpha: 0.72 + r() * 0.28 });
  }
  strokes(g, list, { streak: 0.5, seed });
}

/** 夜空：上深下浅的蓝紫，横向蜡笔笔触，远处小星点 */
export function nightSky(g, X, Y, w, h, seed = 3, horizon = 980) {
  skyBase(g, X, Y, w, h, [
    [-150, "#17183f"], [220, "#1f2155"], [520, "#2a2f6e"], [horizon - 200, "#384590"], [horizon, "#4757a0"],
  ]);
  skyStrokes(g, X, Y, w, h, seed, 30, (y, r) => {
    const d = (y + 150) / (horizon + 150);
    if (d < 0.35) return pick(r, ["#1c1d4c", "#24275f", "#2a2d68", "#2e3271"]);
    if (d < 0.65) return pick(r, ["#2e3271", "#353d7b", "#3b4486", "#4b4881"]);
    return pick(r, ["#42559d", "#4b4881", "#594a6a", "#3e4c94", "#5562a8"]);
  });
  skyStrokes(g, X, Y, w, h, seed + 7, 12, (y, r) => pick(r, ["#5a6ab0", "#6070b4", "#4f4a86"]), [6, 16]);
  g.save();
  g.globalCompositeOperation = "screen";
  g.globalAlpha = 0.06;
  g.fillStyle = pat(g, "hatchWH");
  g.fillRect(X, Y, w, h);
  g.globalAlpha = 0.12;
  g.fillStyle = pat(g, "tooth");
  g.fillRect(X, Y, w, h);
  g.restore();
  // 远处很小的星点（不闪）
  const r = mulberry32(seed + 99);
  g.fillStyle = "rgba(240,236,255,0.55)";
  for (let i = 0; i < 140; i++) {
    const s = 0.8 + r() * 1.6;
    g.fillRect(X + r() * w, Y + r() * (horizon - Y) * 0.8, s, s);
  }
}

/** 晚霞：暖黄底，红橙长笔触，亮黄高光 */
export function sunsetSky(g, X, Y, w, h, seed = 5, horizon = 620) {
  skyBase(g, X, Y, w, h, [
    [-150, "#e3a055"], [200, "#eab765"], [430, "#efc977"], [horizon - 40, "#f3db96"], [horizon, "#f6e3a8"], [horizon + 200, "#f6e3a8"],
  ]);
  skyStrokes(g, X, Y, w, horizon - Y, seed, 30, (y, r) => {
    const d = (y + 150) / (horizon + 150);
    if (d < 0.45) return pick(r, [["#e0704a", 3], ["#e4844f", 3], ["#d9663f", 2], ["#e89a8a", 1], ["#f0c060", 1]]);
    if (d < 0.8) return pick(r, [["#e48a52", 2], ["#f0b45c", 3], ["#f6e59a", 2], ["#e0704a", 1]]);
    return pick(r, ["#f6e59a", "#f8ecb4", "#f0c060"]);
  });
  skyStrokes(g, X, Y, w, horizon - Y, seed + 11, 14, (y, r) => pick(r, ["#f8eaa8", "#fbefc0", "#f2a070"]), [6, 18]);
  g.save();
  g.globalCompositeOperation = "screen";
  g.globalAlpha = 0.1;
  g.fillStyle = pat(g, "tooth");
  g.fillRect(X, Y, w, h);
  g.restore();
}

/** 暮色：上面紫蓝、下面还留一点粉橙（黄昏转夜的过渡） */
export function duskSky(g, X, Y, w, h, seed = 6, horizon = 900) {
  skyBase(g, X, Y, w, h, [
    [-150, "#2a2a63"], [200, "#3c3a7a"], [480, "#6a5288"], [horizon - 160, "#b9758a"], [horizon, "#e6a07a"],
  ]);
  skyStrokes(g, X, Y, w, horizon - Y, seed, 28, (y, r) => {
    const d = (y + 150) / (horizon + 150);
    if (d < 0.4) return pick(r, ["#2f2f6e", "#3a3878", "#45428a"]);
    if (d < 0.75) return pick(r, ["#5c4a86", "#77598e", "#8a6492", "#4f4a8a"]);
    return pick(r, ["#c47d8a", "#d88e80", "#e8a37c", "#b76c86"]);
  });
  g.save();
  g.globalCompositeOperation = "screen";
  g.globalAlpha = 0.1;
  g.fillStyle = pat(g, "tooth");
  g.fillRect(X, Y, w, h);
  g.restore();
}

/** 一朵云：几个圆拼起来，平底，粉色 + 密斜排线 */
export function cloud(g, x, y, s, color = "#e6a495", seed = 1) {
  const r = mulberry32(seed);
  const p = P();
  const bumps = [[-0.8, 0.05, 0.42], [-0.35, -0.22, 0.55], [0.18, -0.32, 0.62], [0.68, -0.08, 0.45], [1.0, 0.1, 0.3]];
  for (const [bx, by, br] of bumps) p.arc(x + bx * s, y + by * s, br * s * (0.92 + r() * 0.16), 0, Math.PI * 2);
  p.rect(x - 0.95 * s, y - 0.05 * s, 2.05 * s, 0.32 * s);
  crayon(g, p, { fill: color, line: darker(color, 0.12), lw: 0, shade: 0.34, hl: 0.3, fleck: 0.2 });
}

// ---------- 月亮、太阳 ----------
/** 满月：淡黄，大光晕，闭眼的脸（face: false 不画脸） */
export function moon(g, x, y, r, { face = true, haloA = 1 } = {}) {
  glow(g, x, y, r * 4.6, "#efe2a2", 0.28 * haloA);
  glow(g, x, y, r * 2.1, "#f6eebe", 0.36 * haloA);
  crayon(g, circle(x, y, r), { fill: "#f3eabd", line: "#cdbd86", lw: r * 0.06, shade: 0.14, hl: 0.3, fleck: 0.3 });
  // 两块淡淡的月斑
  g.save();
  g.fillStyle = "rgba(205,188,134,0.28)";
  g.beginPath();
  g.ellipse(x - r * 0.45, y - r * 0.42, r * 0.16, r * 0.11, 0.3, 0, Math.PI * 2);
  g.ellipse(x + r * 0.5, y + r * 0.5, r * 0.12, r * 0.09, -0.2, 0, Math.PI * 2);
  g.fill();
  g.restore();
  if (face) sleepyFace(g, x, y + r * 0.04, r, { ink: "#a48c52", blush: "#eca49e", smile: 0.45 });
}

/** 夕阳：黄色圆 + 橙色边，一圈短光芒，闭眼微笑 */
export function sun(g, x, y, r, T = 0) {
  glow(g, x, y, r * 6, "#fff1b8", 0.42);
  glow(g, x, y, r * 2.4, "#fff6d0", 0.5);
  g.save();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.1;
    const r0 = r * 1.28;
    const r1 = r * (i % 2 ? 1.62 : 1.85) + Math.sin(T * 6 + i) * r * 0.04;
    scribble(g, [[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]], { color: "#fbf0bc", width: r * 0.07, seed: 40 + i, jitter: 0.8 });
  }
  g.restore();
  crayon(g, circle(x, y, r), { fill: "#f7d867", line: "#e2a243", lw: r * 0.08, shade: 0.12, hl: 0.3, fleck: 0.2 });
  sleepyFace(g, x, y, r, { ink: "#b07a2a", blush: "#f2a080", smile: 0.8 });
}

/** 从太阳射出的大光束（screen 叠加） */
export function godRays(g, x, y, rays, alpha = 0.2) {
  g.save();
  g.globalCompositeOperation = "screen";
  for (const [ang, spread, len] of rays) {
    const grd = g.createRadialGradient(x, y, 0, x, y, len);
    grd.addColorStop(0, `rgba(255,246,206,${alpha})`);
    grd.addColorStop(1, "rgba(255,246,206,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang - spread) * len, y + Math.sin(ang - spread) * len);
    g.lineTo(x + Math.cos(ang + spread) * len, y + Math.sin(ang + spread) * len);
    g.closePath();
    g.fill();
  }
  g.restore();
}

// ---------- 楼群天际线 ----------
/**
 * 一排楼：方块楼身 + 窗格（少数亮暖灯）+ 楼顶的小方块和天线。
 * o: { x0, x1, base, top:[min,max], colors, line, lit, seed, win:[w,h], windows(收集窗格), allDark(全部先画成暗窗) }
 */
export function buildings(g, o) {
  const { x0, x1, base, top, colors, line = "#1b1d42", lit = 0.15, seed = 1, win = [14, 18], lw = 3, litColor = "#f2c56b", dark = 0.28 } = o;
  const r = mulberry32(seed);
  let x = x0;
  const blocks = [];
  while (x < x1) {
    const bw = 110 + r() * 140;
    const ty = top[0] + r() * (top[1] - top[0]);
    blocks.push({ x, w: bw, top: ty, color: pick(r, colors), seed: Math.floor(r() * 1e6) });
    x += bw - 4 + r() * 10;
  }
  for (const b of blocks) {
    const br = mulberry32(b.seed);
    // 楼顶杂物（画在楼身之前，楼身会盖住它们的下端）
    if (br() < 0.45) {
      const tx = b.x + 16 + br() * (b.w - 70);
      crayon(g, rrect(tx, b.top - 34, 46, 38, 8), { fill: lighter(b.color, 0.12), line, lw: 2.5, shade: 0.2, hl: 0.08 });
    }
    if (br() < 0.6) {
      const ax = b.x + 20 + br() * (b.w - 40);
      const ah = 40 + br() * 50;
      scribble(g, [[ax, b.top + 2], [ax + (br() - 0.5) * 6, b.top - ah]], { color: line, width: 3, seed: b.seed + 1, jitter: 0.8 });
      for (let j = 0; j < 2; j++) {
        const yy = b.top - ah * (0.55 + j * 0.3);
        const ww = 14 + br() * 16;
        scribble(g, [[ax - ww, yy + 3], [ax + ww, yy - 3]], { color: line, width: 2.5, seed: b.seed + 2 + j, jitter: 0.6 });
      }
    }
    crayon(g, rect(b.x, b.top, b.w, base - b.top), { fill: b.color, line, lw, shade: 0.26, hl: 0.06, fleck: 0.12, dir: "v" });
    // 窗
    const [ww, wh] = win;
    const gx = ww + 12;
    const gy = wh + 16;
    const cols = Math.max(1, Math.floor((b.w - 22) / gx));
    const rows = Math.max(1, Math.floor((base - b.top - 24) / gy));
    const ox = b.x + (b.w - cols * gx + 12) / 2;
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) {
        const wx = ox + j * gx;
        const wy = b.top + 18 + i * gy;
        const isLit = br() < lit;
        if (o.windows) o.windows.push({ x: wx, y: wy, w: ww, h: wh, lit: isLit, k: br(), dark: rgba(darker(b.color, dark), 0.85) });
        if (isLit && !o.allDark) {
          glow(g, wx + ww / 2, wy + wh / 2, ww * 2.2, litColor, 0.28);
          g.fillStyle = litColor;
          g.fillRect(wx, wy, ww, wh);
          g.fillStyle = rgba("#fff3c4", 0.5);
          g.fillRect(wx + 2, wy + 2, ww * 0.4, wh - 4);
        } else {
          g.fillStyle = rgba(darker(b.color, dark), 0.85);
          g.fillRect(wx, wy, ww, wh);
        }
      }
  }
}

// ---------- 小物件 ----------
export function heartPath(x, y, s) {
  const p = P();
  p.moveTo(x, y + s * 0.9);
  p.bezierCurveTo(x - s * 1.25, y + s * 0.05, x - s * 0.95, y - s * 1.0, x, y - s * 0.4);
  p.bezierCurveTo(x + s * 0.95, y - s * 1.0, x + s * 1.25, y + s * 0.05, x, y + s * 0.9);
  p.closePath();
  return p;
}
export function heart(g, x, y, s, color = "#ec8a9a") {
  glow(g, x, y, s * 3, "#ffd0d8", 0.35);
  crayon(g, heartPath(x, y, s), { fill: color, line: darker(color, 0.28), lw: s * 0.08, shade: 0.16, hl: 0.3, fleck: 0.2 });
  g.save();
  g.fillStyle = "rgba(255,245,245,0.75)";
  g.beginPath();
  g.ellipse(x - s * 0.45, y - s * 0.38, s * 0.16, s * 0.1, -0.6, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** 海鸥：两道弧，flap = 翅膀上下（-1..1） */
export function gull(g, x, y, s, flap = 0, color = "#5a4652") {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = s * 0.14;
  g.lineCap = "round";
  g.lineJoin = "round";
  const wy = -s * (0.45 + flap * 0.3);
  g.beginPath();
  g.moveTo(x - s, y + s * 0.1 + flap * s * 0.2);
  g.quadraticCurveTo(x - s * 0.5, y + wy, x, y);
  g.quadraticCurveTo(x + s * 0.5, y + wy, x + s, y + s * 0.1 + flap * s * 0.2);
  g.stroke();
  g.restore();
}

/** 一盆植物：陶盆 + 一团团叶子 */
export function pottedPlant(g, x, y, s, seed = 1) {
  const r = mulberry32(seed);
  const leaves = P();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.2;
    const d = s * (0.25 + r() * 0.35);
    leaves.ellipse(x + Math.cos(a) * d, y - s * 0.62 + Math.sin(a) * d * 0.8, s * (0.22 + r() * 0.12), s * (0.14 + r() * 0.08), a, 0, Math.PI * 2);
  }
  crayon(g, leaves, { fill: pick(r, ["#4f8a52", "#5a9a58", "#467c4c"]), line: "#2f5a37", lw: s * 0.03, shade: 0.3, hl: 0.14 });
  const pot = P();
  pot.moveTo(x - s * 0.34, y - s * 0.42);
  pot.lineTo(x + s * 0.34, y - s * 0.42);
  pot.lineTo(x + s * 0.26, y);
  pot.lineTo(x - s * 0.26, y);
  pot.closePath();
  crayon(g, pot, { fill: "#b8664a", line: "#7c3f2c", lw: s * 0.03, shade: 0.2, hl: 0.12 });
}

/** 星星列表（世界坐标）：画的时候按时间闪 */
export function starList(seed, n, x0, x1, y0, y1) {
  const r = mulberry32(seed);
  return Array.from({ length: n }, () => ({ x: x0 + r() * (x1 - x0), y: y0 + r() * (y1 - y0), s: 1.6 + r() * r() * 5, ph: r() * 6.28, sp: 1.5 + r() * 2.5 }));
}
export function drawStars(g, list, T) {
  for (const s of list) {
    const tw = 0.5 + 0.5 * Math.sin(T * s.sp + s.ph);
    if (s.s > 3.2) star(g, s.x, s.y, s.s, tw);
    else {
      g.fillStyle = `rgba(248,244,237,${0.4 + 0.5 * tw})`;
      g.beginPath();
      g.arc(s.x, s.y, s.s * 0.45, 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** 动态窗灯：on(w) 返回这扇窗现在的亮度 0–1（开场一盏盏亮、结尾一盏盏灭） */
export function drawWindowLights(g, list, on, litColor = "#f2c56b") {
  for (const w of list) {
    const a = on(w);
    if (a <= 0) continue;
    glow(g, w.x + w.w / 2, w.y + w.h / 2, w.w * 2.2, litColor, 0.28 * a);
    g.globalAlpha = a;
    g.fillStyle = litColor;
    g.fillRect(w.x, w.y, w.w, w.h);
    g.fillStyle = rgba("#fff3c4", 0.5);
    g.fillRect(w.x + 2, w.y + 2, w.w * 0.4, w.h - 4);
    g.globalAlpha = 1;
  }
}

/** 半月 / 弯月：满月减掉一个偏移的圆（cut = 偏移量，0.5 左右是半月） */
export function crescent(g, x, y, r, cut = 0.55, { face = true, haloA = 1, tilt = -0.5 } = {}) {
  glow(g, x, y, r * 4, "#efe2a2", 0.24 * haloA);
  glow(g, x, y, r * 1.9, "#f6eebe", 0.3 * haloA);
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  const p = new Path2D();
  p.arc(0, 0, r, Math.PI * 0.5, Math.PI * 1.5);
  const cx = r * cut;
  const rr = Math.hypot(cx, r);
  const a0 = Math.atan2(-r, -cx);
  const a1 = Math.atan2(r, -cx);
  p.arc(cx, 0, rr, a0, a1, true);
  p.closePath();
  crayon(g, p, { fill: "#f3eabd", line: "#cdbd86", lw: r * 0.07, shade: 0.14, hl: 0.3, fleck: 0.3 });
  if (face) {
    g.strokeStyle = "#a48c52";
    g.lineCap = "round";
    g.lineWidth = Math.max(2, r * 0.05);
    g.beginPath();
    g.arc(-r * 0.55, -r * 0.12, r * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
    g.fillStyle = rgba("#eca49e", 0.55);
    g.beginPath();
    g.ellipse(-r * 0.62, r * 0.16, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}
