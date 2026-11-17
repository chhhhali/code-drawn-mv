// 街景的美术：街景背景纸、一排街边小楼、路灯、纸音符、街道地面。内容是示意，新片按自己的地点改。
import { mulberry32 } from "./util.js";
import { paperGrain, dieCut, dieCutLine } from "./paper.js";
import { PAL } from "./art.js";

const EDGE = "#d6cbb6";
const FONT = '"MVSong", "Songti TC", "Songti SC", serif';

// ---------- 背景纸：夜空 + 远处楼影（+ 路灯光晕） ----------
export function drawStreetSky(ctx, W, H, seed, glow) {
  const rand = mulberry32(seed);
  const g = ctx.createRadialGradient(W * 0.78, H * 0.1, 0, W * 0.78, H * 0.1, W * 0.9);
  g.addColorStop(0, "#43577f");
  g.addColorStop(0.45, PAL.skyMid);
  g.addColorStop(1, PAL.skyEdge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(246,236,208,${0.2 + rand() * 0.5})`;
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H * 0.4, 1 + rand() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // 远处楼影（印刷的，比剪纸更暗更淡）
  let x = 0;
  ctx.fillStyle = "#26304b";
  while (x < W) {
    const w = 140 + rand() * 260;
    const h = H * (0.25 + rand() * 0.25);
    ctx.fillRect(x, H * 0.82 - h, w + 2, h + H * 0.2);
    x += w;
  }
  ctx.fillStyle = "rgba(242,197,107,0.5)";
  for (let i = 0; i < 90; i++) ctx.fillRect(rand() * W, H * (0.5 + rand() * 0.3), 10, 13);
  // 路灯的光晕
  if (glow) {
    const lg = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, W * 0.16);
    lg.addColorStop(0, "rgba(255,214,150,0.45)");
    lg.addColorStop(1, "rgba(255,214,150,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, H);
  }
  paperGrain(ctx, W, H, seed + 1, 9, 400);
}

// ---------- 一排街边小楼（窗、阳台栏杆、底层亮着的店面；signs 给了才画竖招牌） ----------
export function drawStreetHouses(ctx, W, H, seed, { signs = [] } = {}) {
  const rand = mulberry32(seed);
  const border = 5;
  const tones = ["#5a6075", "#675b55", "#4f5b6c", "#5e5468", "#596a66"];
  const houses = [];
  let x = -4;
  let i = 0;
  while (x < W + 4) {
    const w = 300 + rand() * 180;
    const h = H * (0.72 + rand() * 0.26);
    houses.push({ x, w, h, top: H - h, tone: tones[i % tones.length], sign: signs.length ? signs[i % signs.length] : "" });
    x += w - 2;
    i++;
  }
  for (const b of houses) {
    const p = new Path2D();
    p.rect(b.x, b.top, b.w, b.h + 10);
    dieCut(ctx, p, border, 0, EDGE);
  }
  for (const b of houses) {
    ctx.fillStyle = b.tone;
    ctx.fillRect(b.x, b.top, b.w, b.h + 10);
    // 檐口
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(b.x, b.top, b.w, 16);
    // 各层窗户 + 阳台栏杆
    const floors = Math.floor((b.h - 220) / 150);
    for (let f = 0; f < floors; f++) {
      const y = b.top + 40 + f * 150;
      for (let c = 0; c < 2; c++) {
        const wx = b.x + 34 + c * (b.w / 2 - 10);
        const lit = rand() < 0.38;
        ctx.fillStyle = lit ? PAL.winLit : "#252c40";
        ctx.globalAlpha = lit ? 0.9 : 0.85;
        ctx.fillRect(wx, y, b.w / 2 - 70, 78);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(25,25,30,0.6)";
        ctx.lineWidth = 4;
        ctx.strokeRect(wx, y, b.w / 2 - 70, 78);
      }
      ctx.strokeStyle = "rgba(30,30,36,0.7)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(b.x + 16, y + 104);
      ctx.lineTo(b.x + b.w - 16, y + 104);
      for (let r = b.x + 24; r < b.x + b.w - 16; r += 22) {
        ctx.moveTo(r, y + 84);
        ctx.lineTo(r, y + 104);
      }
      ctx.stroke();
    }
    // 底层：亮着的店面、半拉的卷闸
    const shopTop = H - 230;
    ctx.fillStyle = "#e7b86c";
    ctx.fillRect(b.x + 20, shopTop + 40, b.w - 40, 190);
    ctx.fillStyle = "rgba(60,62,72,0.85)";
    ctx.fillRect(b.x + 20, shopTop + 40, b.w - 40, 70 + rand() * 60);
    ctx.strokeStyle = "rgba(30,30,36,0.5)";
    ctx.lineWidth = 2;
    for (let y = shopTop + 46; y < shopTop + 160; y += 9) {
      ctx.beginPath();
      ctx.moveTo(b.x + 20, y);
      ctx.lineTo(b.x + b.w - 20, y);
      ctx.stroke();
    }
    ctx.fillStyle = b.tone;
    ctx.fillRect(b.x, shopTop, b.w, 40);
    ctx.fillRect(b.x, shopTop, 20, 230);
    ctx.fillRect(b.x + b.w - 20, shopTop, 20, 230);
    // 竖招牌（新片自己给字；不给就不画）
    if (b.sign) {
      const sx = b.x + b.w - 70;
      const sy = b.top + 60;
      const len = [...b.sign].length;
      ctx.fillStyle = "#efe4c8";
      ctx.fillRect(sx, sy, 48, 30 + len * 54);
      ctx.strokeStyle = "#8a3a30";
      ctx.lineWidth = 4;
      ctx.strokeRect(sx + 4, sy + 4, 40, 22 + len * 54);
      ctx.fillStyle = "#8a3a30";
      ctx.font = `700 40px ${FONT}`;
      ctx.textAlign = "center";
      [...b.sign].forEach((ch, k) => ctx.fillText(ch, sx + 24, sy + 58 + k * 54));
      ctx.textAlign = "left";
    }
  }
  paperGrain(ctx, W, H, seed + 4, 10, 300);
}

// ---------- 路灯 ----------
export function drawStreetLamp(ctx, W, H) {
  const border = 8;
  const post = new Path2D();
  post.moveTo(W * 0.5, H);
  post.lineTo(W * 0.5, H * 0.16);
  post.quadraticCurveTo(W * 0.5, H * 0.08, W * 0.3, H * 0.08);
  const head = new Path2D();
  head.moveTo(W * 0.12, H * 0.08);
  head.lineTo(W * 0.48, H * 0.08);
  head.lineTo(W * 0.42, H * 0.14);
  head.lineTo(W * 0.18, H * 0.14);
  head.closePath();
  dieCutLine(ctx, post, 16, border, EDGE);
  dieCut(ctx, head, border, 0, EDGE);
  ctx.strokeStyle = "#2f3546";
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.stroke(post);
  ctx.fillStyle = "#2f3546";
  ctx.fill(head);
  ctx.fillStyle = "#ffe3a8";
  ctx.fillRect(W * 0.2, H * 0.135, W * 0.2, H * 0.02);
}

// ---------- 纸音符 ----------
export function drawNote(ctx, W, H, double = false) {
  const border = 9;
  const p = new Path2D();
  p.ellipse(W * 0.32, H * 0.78, W * 0.2, H * 0.13, -0.4, 0, Math.PI * 2);
  if (double) p.ellipse(W * 0.78, H * 0.68, W * 0.18, H * 0.12, -0.4, 0, Math.PI * 2);
  const stem = new Path2D();
  stem.moveTo(W * 0.5, H * 0.76);
  stem.lineTo(W * 0.5, H * 0.12);
  if (double) {
    stem.lineTo(W * 0.94, H * 0.04);
    stem.lineTo(W * 0.94, H * 0.66);
  } else {
    stem.quadraticCurveTo(W * 0.8, H * 0.22, W * 0.76, H * 0.46);
  }
  dieCut(ctx, p, border);
  dieCutLine(ctx, stem, 12, border);
  ctx.fillStyle = "#f3e2a6";
  ctx.fill(p);
  ctx.strokeStyle = "#f3e2a6";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(stem);
}

// ---------- 地面：马路（中间一条虚线）+ 人行道 ----------
// D = 地面纸的深度（世界单位，SCENE.D）；人行道从 z = 2.75 开始，人物站在 z ≈ 2.6–3.0 正好落在路沿上
export function drawStreetFloor(ctx, W, H, seed, D) {
  const rand = mulberry32(seed);
  const zy = (z) => (z / D) * H;
  ctx.fillStyle = "#3b404c";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(${rand() < 0.5 ? "255,255,255" : "0,0,0"},${0.03 + rand() * 0.05})`;
    ctx.fillRect(rand() * W, rand() * H, 2, 2);
  }
  // 车道中线（虚线）
  ctx.fillStyle = "rgba(226,214,182,0.7)";
  for (let x = 20; x < W; x += 180) ctx.fillRect(x, zy(1.7) - 5, 100, 10);
  // 人行道
  const curb = zy(2.75);
  ctx.fillStyle = "#77757a";
  ctx.fillRect(0, curb, W, H - curb);
  ctx.fillStyle = "#5e5c62";
  ctx.fillRect(0, curb, W, 14);
  ctx.strokeStyle = "rgba(60,58,64,0.6)";
  ctx.lineWidth = 3;
  for (let x = 0; x < W; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, curb + 14);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = curb + 14; y < H; y += 120) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  paperGrain(ctx, W, H, seed + 2, 10, 300);
}
