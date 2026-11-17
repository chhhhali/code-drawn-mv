// 天空、月亮、云、心形等"挂在天上"的东西。冷 = 夜蓝；暖 = 黄昏金（不用紫色渐变）。
import { mulberry32 } from "./util.js";
import { paperGrain, dieCut, PAPER_WHITE } from "./paper.js";

export const SKIES = {
  night: { glow: "#4a5e8a", mid: "#30436b", edge: "#1d2846" },
  dusk: { glow: "#f3c47c", mid: "#d99a6c", edge: "#5d6c8c" }, // 黄昏（暖）
  sunset: { glow: "#f6cf86", mid: "#e5a06a", edge: "#6d7c98" }, // 晚霞
  autumn: { glow: "#e7b071", mid: "#7c5a5a", edge: "#28304a" }, // 暖色的夜（比如秋夜）
};

/** 通用天空：径向渐变（不起色带）+ 星星 + 可选远景楼影/山 */
export function drawSkyBase(ctx, W, H, seed, { kind = "night", center = { x: W * 0.75, y: H * 0.2 }, stars = 140, city = 0, hills = false, sun = null } = {}) {
  const rand = mulberry32(seed);
  const P = SKIES[kind];
  const g = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, W * 0.95);
  g.addColorStop(0, P.glow);
  g.addColorStop(0.45, P.mid);
  g.addColorStop(1, P.edge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (sun) {
    const sg = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, sun.r * 4);
    sg.addColorStop(0, "rgba(255,226,160,0.75)");
    sg.addColorStop(1, "rgba(255,226,160,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffe6a8";
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, sun.r, Math.PI, 0);
    ctx.fill();
  }
  const starA = kind === "night" ? 1 : kind === "autumn" ? 0.8 : 0.25;
  for (let i = 0; i < stars; i++) {
    ctx.fillStyle = `rgba(246,236,208,${(0.2 + rand() * 0.6) * starA})`;
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H * 0.6, 1.1 + rand() * 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (hills) {
    ctx.fillStyle = kind === "sunset" ? "#7d849a" : "#2a3350";
    ctx.beginPath();
    ctx.moveTo(0, H * 0.7);
    for (let x = 0; x <= W; x += 60) ctx.lineTo(x, H * (0.62 - 0.08 * Math.sin(x / W * 5.2 + 1) - 0.05 * Math.sin(x / W * 13)));
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
  }
  if (city) {
    let x = 0;
    ctx.fillStyle = kind === "night" ? "#26304b" : "#6a6478";
    while (x < W) {
      const w = 120 + rand() * 240;
      const h = H * (0.12 + rand() * city);
      ctx.fillRect(x, H * 0.86 - h, w + 2, h + H * 0.2);
      x += w;
    }
    ctx.fillStyle = "rgba(242,197,107,0.55)";
    for (let i = 0; i < 80; i++) ctx.fillRect(rand() * W, H * (0.62 + rand() * 0.22), 9, 12);
  }
  paperGrain(ctx, W, H, seed + 1, 9, 400);
}

/** 柔和光晕（月晕、路灯光） */
export function glow(ctx, x, y, r, rgba = "255,214,150", a = 0.4) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgba},${a})`);
  g.addColorStop(1, `rgba(${rgba},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** 满月的左半或右半（剪纸），裂缝一侧是锯齿 */
export function drawMoonHalf(ctx, W, H, side, face = false) {
  const cx = W / 2;
  const cy = H / 2;
  const r = W * 0.44;
  const rand = mulberry32(7);
  const p = new Path2D();
  const s = side === "left" ? -1 : 1;
  p.moveTo(cx, cy - r);
  p.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, s < 0);
  // 锯齿裂缝（左右两半用同一条）
  const steps = 14;
  for (let i = steps; i >= 0; i--) {
    const y = cy - r + (2 * r * i) / steps;
    const j = (mulberry32(100 + i)() - 0.5) * r * 0.16;
    p.lineTo(cx + j, y);
  }
  p.closePath();
  dieCut(ctx, p, W * 0.03);
  const g = ctx.createRadialGradient(cx + r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, "#f9edbf");
  g.addColorStop(1, "#e3cd86");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = `rgba(205,180,110,${0.22 + rand() * 0.2})`;
    ctx.beginPath();
    ctx.arc(cx + (rand() - 0.5) * r * 1.6, cy + (rand() - 0.5) * r * 1.6, r * (0.05 + rand() * 0.1), 0, Math.PI * 2);
    ctx.fill();
  }
  if (face) drawProfileOnMoon(ctx, cx, cy, r);
  ctx.restore();
  paperGrain(ctx, W, H, 33, 8);
}

/** 满月（剪纸）；face = true 时月亮里印一个淡淡的侧脸剪影 */
export function drawFullMoon(ctx, W, H, face = false) {
  const cx = W / 2;
  const cy = H / 2;
  const r = W * 0.44;
  const p = new Path2D();
  p.arc(cx, cy, r, 0, Math.PI * 2);
  dieCut(ctx, p, W * 0.03);
  const g = ctx.createRadialGradient(cx + r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, "#f9edbf");
  g.addColorStop(1, "#e3cd86");
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  const rand = mulberry32(8);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `rgba(205,180,110,${0.2 + rand() * 0.18})`;
    ctx.beginPath();
    ctx.arc(cx + (rand() - 0.5) * r * 1.6, cy + (rand() - 0.5) * r * 1.6, r * (0.05 + rand() * 0.1), 0, Math.PI * 2);
    ctx.fill();
  }
  if (face) drawProfileOnMoon(ctx, cx, cy, r);
  ctx.restore();
  paperGrain(ctx, W, H, 34, 8);
}

// 月亮里淡淡的侧脸剪影（朝左、长发）
function drawProfileOnMoon(ctx, cx, cy, r) {
  ctx.fillStyle = "rgba(176,140,86,0.42)";
  const k = r / 100;
  ctx.beginPath();
  ctx.moveTo(cx + 10 * k, cy - 62 * k);
  ctx.bezierCurveTo(cx - 30 * k, cy - 66 * k, cx - 44 * k, cy - 34 * k, cx - 44 * k, cy - 18 * k); // 额头
  ctx.lineTo(cx - 52 * k, cy - 4 * k); // 鼻子
  ctx.lineTo(cx - 44 * k, cy + 4 * k);
  ctx.quadraticCurveTo(cx - 48 * k, cy + 12 * k, cx - 42 * k, cy + 16 * k); // 嘴
  ctx.quadraticCurveTo(cx - 40 * k, cy + 30 * k, cx - 24 * k, cy + 34 * k); // 下巴
  ctx.lineTo(cx - 10 * k, cy + 40 * k);
  ctx.bezierCurveTo(cx + 10 * k, cy + 80 * k, cx + 40 * k, cy + 90 * k, cx + 58 * k, cy + 92 * k); // 脖子与长发
  ctx.bezierCurveTo(cx + 70 * k, cy + 20 * k, cx + 64 * k, cy - 60 * k, cx + 10 * k, cy - 62 * k);
  ctx.fill();
}

/** 剪纸云 */
export function drawCloud(ctx, W, H, seed, tint = "#d9d6e0") {
  const rand = mulberry32(seed);
  const p = new Path2D();
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = W * (0.16 + (i / (n - 1)) * 0.68);
    const r = H * (0.22 + rand() * 0.16);
    p.moveTo(x + r, H * 0.62);
    p.arc(x, H * 0.62 - r * 0.2, r, 0, Math.PI * 2);
  }
  p.rect(W * 0.12, H * 0.55, W * 0.76, H * 0.26);
  dieCut(ctx, p, 8);
  ctx.fillStyle = tint;
  ctx.fill(p);
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(W * 0.12, H * 0.7, W * 0.76, H * 0.11);
}

/** 纸心（可以从中间裂开：side = "left" | "right" | "both"） */
export function drawHeart(ctx, W, H, side = "both", color = "#d9675e") {
  const p = new Path2D();
  const cx = W / 2;
  p.moveTo(cx, H * 0.88);
  p.bezierCurveTo(W * 0.02, H * 0.52, W * 0.12, H * 0.06, cx, H * 0.3);
  p.bezierCurveTo(W * 0.88, H * 0.06, W * 0.98, H * 0.52, cx, H * 0.88);
  ctx.save();
  if (side !== "both") {
    const clip = new Path2D();
    const s = side === "left" ? -1 : 1;
    clip.moveTo(cx, 0);
    for (let i = 0; i <= 8; i++) clip.lineTo(cx + (i % 2 ? 1 : -1) * W * 0.04, (H * i) / 8);
    clip.lineTo(cx + s * W, H);
    clip.lineTo(cx + s * W, 0);
    clip.closePath();
    ctx.clip(clip);
  }
  dieCut(ctx, p, 9);
  ctx.fillStyle = color;
  ctx.fill(p);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.ellipse(W * 0.32, H * 0.36, W * 0.08, H * 0.05, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 四角星（流星的头） */
export function drawSparkle(ctx, W, H) {
  const p = new Path2D();
  const c = W / 2;
  p.moveTo(c, 0);
  p.quadraticCurveTo(c, c, W, c);
  p.quadraticCurveTo(c, c, c, H);
  p.quadraticCurveTo(c, c, 0, c);
  p.quadraticCurveTo(c, c, c, 0);
  ctx.fillStyle = PAPER_WHITE;
  ctx.fill(p);
}
