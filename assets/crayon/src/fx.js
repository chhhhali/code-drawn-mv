// 动态小物件：蜡笔碎片、音符、枫叶、裂缝、流星、信封、纸团、对话气泡、照片、挂钟。
// 全部只由时间决定（种子随机），画法和 crayon.js 一致。
import { crayon, scribble, glow, darker, lighter, rgba, pick } from "./crayon.js";
import { mulberry32, clamp01, ease } from "./util.js";

const FONT = '"MVRound", "Yuanti TC", sans-serif';

// ---------- 蜡笔碎片（情绪转折时，从人物或物件上炸开的一把彩色短笔触） ----------
/**
 * spawn(r) → {x, y}：每片碎片的出生点；colors：颜色表
 * 返回的列表交给 drawShards(g, list, t) 画（t = 炸开后经过的秒数）
 */
export function makeShards(seed, n, spawn, { colors, speed = [180, 520], dir = -0.6, spread = 1.4, len = [16, 46], w = [6, 12], delay = 0.4 } = {}) {
  const r = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const p = spawn(r);
    const a = dir + (r() - 0.5) * spread;
    const v = speed[0] + r() * (speed[1] - speed[0]);
    return {
      x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      rot: r() * Math.PI, vr: (r() - 0.5) * 7, len: len[0] + r() * (len[1] - len[0]), w: w[0] + r() * (w[1] - w[0]),
      color: pick(r, colors), delay: r() * delay, wob: r() * 6.28,
    };
  });
}
export function drawShards(g, list, t, { life = 2.4, drag = 0.55, lift = -40, swirl = 30, alpha = 1 } = {}) {
  g.save();
  g.lineCap = "round";
  for (const s of list) {
    const tt = t - s.delay;
    if (tt <= 0) continue;
    const k = (1 - Math.exp(-drag * tt)) / drag; // 有阻力的位移
    const x = s.x + s.vx * k + Math.sin(tt * 2 + s.wob) * swirl * tt;
    const y = s.y + s.vy * k + lift * tt * tt * 0.5;
    const a = alpha * (1 - clamp01((tt - life * 0.55) / (life * 0.45)));
    if (a <= 0) continue;
    const rot = s.rot + s.vr * tt;
    const dx = Math.cos(rot) * s.len * 0.5;
    const dy = Math.sin(rot) * s.len * 0.5;
    g.globalAlpha = a;
    g.strokeStyle = s.color;
    g.lineWidth = s.w;
    g.beginPath();
    g.moveTo(x - dx, y - dy);
    g.lineTo(x + dx, y + dy);
    g.stroke();
    g.strokeStyle = lighter(s.color, 0.35);
    g.lineWidth = s.w * 0.35;
    g.globalAlpha = a * 0.7;
    g.beginPath();
    g.moveTo(x - dx * 0.8, y - dy * 0.8 - s.w * 0.15);
    g.lineTo(x + dx * 0.6, y + dy * 0.6 - s.w * 0.15);
    g.stroke();
  }
  g.restore();
}

// ---------- 音符 ----------
export function note(g, x, y, s, color = "#f6e3a0", rot = 0, double = false) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  glow(g, 0, 0, s * 2.6, color, 0.35);
  const p = new Path2D();
  p.ellipse(-s * 0.42, s * 0.62, s * 0.36, s * 0.26, -0.4, 0, Math.PI * 2);
  if (double) p.ellipse(s * 0.5, s * 0.46, s * 0.36, s * 0.26, -0.4, 0, Math.PI * 2);
  crayon(g, p, { fill: color, line: darker(color, 0.4), lw: s * 0.06, shade: 0.1, hl: 0.2, fleck: 0.1 });
  g.strokeStyle = darker(color, 0.4);
  g.lineCap = "round";
  g.lineWidth = s * 0.12;
  g.beginPath();
  g.moveTo(-s * 0.1, s * 0.6);
  g.lineTo(-s * 0.1, -s * 0.6);
  if (double) {
    g.lineTo(s * 0.82, -s * 0.76);
    g.lineTo(s * 0.82, s * 0.44);
  } else g.quadraticCurveTo(s * 0.5, -s * 0.4, s * 0.42, s * 0.05);
  g.stroke();
  g.restore();
}
/** 一串往某个方向飘的音符；t = 本镜头时间 */
export function drawNotes(g, list, t) {
  for (const n of list) {
    const tt = t - n.t0;
    if (tt < 0 || tt > n.life) continue;
    const a = clamp01(tt / 0.3) * (1 - clamp01((tt - n.life + 0.6) / 0.6));
    g.save();
    g.globalAlpha = a;
    note(g, n.x + n.vx * tt, n.y + n.vy * tt + Math.sin(tt * 3 + n.ph) * 14, n.s, n.color, Math.sin(tt * 2 + n.ph) * 0.25, n.double);
    g.restore();
  }
}

// ---------- 枫叶 ----------
export function mapleLeaf(g, x, y, s, rot, color) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const p = new Path2D();
  const pts = [];
  const lobes = [[0, -1], [0.38, -0.42], [0.95, -0.55], [0.62, 0.02], [0.82, 0.42], [0.2, 0.3], [0, 0.62], [-0.2, 0.3], [-0.82, 0.42], [-0.62, 0.02], [-0.95, -0.55], [-0.38, -0.42]];
  for (const [lx, ly] of lobes) pts.push([lx * s, ly * s]);
  p.moveTo(...pts[0]);
  pts.slice(1).forEach((q) => p.lineTo(...q));
  p.closePath();
  crayon(g, p, { fill: color, line: darker(color, 0.3), lw: s * 0.06, shade: 0.16, hl: 0.16, fleck: 0.1 });
  g.strokeStyle = darker(color, 0.35);
  g.lineWidth = s * 0.07;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(0, s * 0.95);
  g.lineTo(0, -s * 0.6);
  g.stroke();
  g.restore();
}
export function makeLeaves(seed, n, area, colors) {
  const r = mulberry32(seed);
  return Array.from({ length: n }, () => ({
    x: area.x + r() * area.w, y: area.y - r() * area.h, s: 12 + r() * 14, vy: 50 + r() * 60, sway: 30 + r() * 50,
    ph: r() * 6.28, vr: (r() - 0.5) * 3, color: pick(r, colors), drift: (r() - 0.3) * 30,
  }));
}
export function drawLeaves(g, list, t, bottom = 1200) {
  for (const l of list) {
    const y = l.y + l.vy * t;
    if (y > bottom) continue;
    const x = l.x + Math.sin(t * 1.4 + l.ph) * l.sway + l.drift * t;
    mapleLeaf(g, x, y, l.s, l.ph + l.vr * t + Math.sin(t * 2 + l.ph) * 0.5, l.color);
  }
}

// ---------- 裂缝 ----------
/** 一条锯齿裂缝：从 a 到 b，返回点列 */
export function crackPts(a, b, seed, rough = 22, n = 12) {
  const r = mulberry32(seed);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  const nx = -dy / l;
  const ny = dx / l;
  return Array.from({ length: n + 1 }, (_, i) => {
    const k = i / n;
    const off = i === 0 || i === n ? 0 : (r() - 0.5) * 2 * rough;
    return { x: a.x + dx * k + nx * off, y: a.y + dy * k + ny * off };
  });
}
/** 裂缝画到 prog（0–1）为止：深色粗线 + 一道亮边 */
export function drawCrack(g, pts, prog, { color = "#2a1f3a", width = 8, light = "#fff2c8" } = {}) {
  if (prog <= 0) return;
  const n = pts.length - 1;
  const upto = prog * n;
  const path = (off) => {
    g.beginPath();
    g.moveTo(pts[0].x + off, pts[0].y + off);
    for (let i = 1; i <= Math.ceil(upto); i++) {
      const k = Math.min(1, upto - (i - 1));
      const p = pts[i - 1];
      const q = pts[i];
      g.lineTo(p.x + (q.x - p.x) * k + off, p.y + (q.y - p.y) * k + off);
    }
  };
  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = rgba(light, 0.7);
  g.lineWidth = width * 0.5;
  path(width * 0.45);
  g.stroke();
  g.strokeStyle = color;
  g.lineWidth = width;
  path(0);
  g.stroke();
  g.restore();
}

// ---------- 流星 ----------
export function shootingStar(g, x, y, ang, len, a = 1) {
  if (a <= 0) return;
  const tx = x - Math.cos(ang) * len;
  const ty = y - Math.sin(ang) * len;
  g.save();
  const grd = g.createLinearGradient(tx, ty, x, y);
  grd.addColorStop(0, "rgba(255,248,220,0)");
  grd.addColorStop(1, `rgba(255,248,220,${0.9 * a})`);
  g.strokeStyle = grd;
  g.lineCap = "round";
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(tx, ty);
  g.lineTo(x, y);
  g.stroke();
  g.restore();
  glow(g, x, y, 40, "#fff4cc", 0.7 * a);
}

// ---------- 信封（label 不为空时盖一个红色方印，写 label 的字） ----------
export function envelope(g, x, y, w, rot = 0, label = "") {
  const h = w * 0.62;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const body = new Path2D();
  body.roundRect(-w / 2, -h / 2, w, h, w * 0.05);
  crayon(g, body, { fill: "#f4efe2", line: "#a99d86", lw: w * 0.03, shade: 0.12, hl: 0.08, fleck: 0.1 });
  g.strokeStyle = "rgba(150,138,118,0.8)";
  g.lineWidth = w * 0.025;
  g.beginPath();
  g.moveTo(-w / 2 + 3, -h / 2 + 3);
  g.lineTo(0, h * 0.08);
  g.lineTo(w / 2 - 3, -h / 2 + 3);
  g.stroke();
  // 邮票
  g.fillStyle = "#d9a24a";
  g.fillRect(w * 0.26, -h * 0.4, w * 0.16, h * 0.26);
  if (label) {
    g.rotate(-0.18);
    g.strokeStyle = "rgba(200,48,44,0.9)";
    g.lineWidth = w * 0.03;
    g.strokeRect(-w * 0.3, -h * 0.08, w * 0.5, h * 0.34);
    g.fillStyle = "rgba(200,48,44,0.92)";
    g.font = `700 ${Math.round(w * 0.2)}px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(label, -w * 0.05, h * 0.1);
  }
  g.restore();
}

// ---------- 纸团 ----------
export function paperBall(g, x, y, r, seed = 1) {
  const rr = mulberry32(seed);
  const p = new Path2D();
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const d = r * (0.82 + rr() * 0.26);
    if (i === 0) p.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    else p.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  p.closePath();
  crayon(g, p, { fill: "#ece6d8", line: "#a69c88", lw: r * 0.08, shade: 0.24, hl: 0.12, fleck: 0.1 });
  g.save();
  g.strokeStyle = "rgba(140,128,108,0.75)";
  g.lineWidth = Math.max(1.5, r * 0.06);
  g.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const a = rr() * 6.28;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * r * 0.1, y + Math.sin(a) * r * 0.1);
    g.lineTo(x + Math.cos(a + 0.6) * r * 0.62, y + Math.sin(a + 0.6) * r * 0.62);
    g.stroke();
  }
  g.restore();
}

// ---------- 对话气泡 ----------
export function bubble(g, x, y, w, h, text, a = 1, tail = [-1, 1]) {
  if (a <= 0) return;
  g.save();
  g.globalAlpha = a;
  const p = new Path2D();
  p.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  p.moveTo(x + tail[0] * w * 0.18, y + h * 0.4);
  p.lineTo(x + tail[0] * w * 0.36, y + h * 0.95);
  p.lineTo(x + tail[0] * w * 0.02, y + h * 0.45);
  crayon(g, p, { fill: "#f7f2e6", line: "#8f86a0", lw: 4, shade: 0.08, hl: 0.06, fleck: 0.1 });
  g.fillStyle = "#4a4466";
  g.font = `700 ${Math.round(h * 0.5)}px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, x, y - h * 0.08);
  g.restore();
}

// ---------- 照片（宝丽来）：drawInside(g, w, h) 画相片内容 ----------
export function photo(g, x, y, w, rot, drawInside, a = 1) {
  if (a <= 0) return;
  const h = w * 1.18;
  g.save();
  g.globalAlpha = a;
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = "rgba(20,16,40,0.25)";
  g.fillRect(-w / 2 + 6, -h / 2 + 8, w, h);
  const frame = new Path2D();
  frame.rect(-w / 2, -h / 2, w, h);
  crayon(g, frame, { fill: "#f6f1e4", line: "#b7ab95", lw: 3, shade: 0.1, hl: 0.06, fleck: 0.08 });
  g.save();
  const iw = w * 0.84;
  const ih = w * 0.84;
  g.translate(-iw / 2, -h / 2 + w * 0.08);
  g.beginPath();
  g.rect(0, 0, iw, ih);
  g.clip();
  drawInside(g, iw, ih);
  g.restore();
  // 图钉
  g.fillStyle = "#c94a3f";
  g.beginPath();
  g.arc(0, -h / 2 + 4, w * 0.06, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// ---------- 挂钟 ----------
export function wallClock(g, x, y, r, hourA, minA) {
  crayon(g, (() => {
    const p = new Path2D();
    p.arc(x, y, r, 0, Math.PI * 2);
    return p;
  })(), { fill: "#f2ead6", line: "#7a5a40", lw: r * 0.1, shade: 0.1, hl: 0.1, fleck: 0.1 });
  g.save();
  g.strokeStyle = "#5a4636";
  g.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.lineWidth = r * 0.05;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72);
    g.lineTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
    g.stroke();
  }
  g.lineWidth = r * 0.09;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + Math.cos(hourA - Math.PI / 2) * r * 0.45, y + Math.sin(hourA - Math.PI / 2) * r * 0.45);
  g.stroke();
  g.lineWidth = r * 0.06;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + Math.cos(minA - Math.PI / 2) * r * 0.68, y + Math.sin(minA - Math.PI / 2) * r * 0.68);
  g.stroke();
  g.fillStyle = "#c94a3f";
  g.beginPath();
  g.arc(x, y, r * 0.08, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export { ease };
