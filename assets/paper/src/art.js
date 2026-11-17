// 场景美术：全部用 Canvas 2D 代码画（不用生图模型）。
import { mulberry32 } from "./util.js";
import { paperGrain, dieCut, dieCutLine, makeCanvas } from "./paper.js";

// 调色板（LOOK）：夜蓝 + 台灯暖黄 + 纸白，低饱和；不用紫色渐变和霓虹
// 布景剪纸的纸边：比人物的白边暗、窄，避免在夜色里发亮像霓虹
const EDGE = "#d6cbb6";

export const PAL = {
  skyEdge: "#1d2846",
  skyMid: "#30436b",
  skyGlow: "#4a5e8a",
  moon: "#f3e2a6",
  moonShade: "#e3cd86",
  star: "#f6ecd0",
  bldA: "#263251",
  bldB: "#2d3a5b",
  bldRoof: "#1f2944",
  winLit: "#f2c56b",
  winDark: "#1c253d",
  wall: "#9aa3b5",
  wallCap: "#848ea2",
  rail: "#3b455c",
  roof: "#7c8599",
  roofLine: "#6c758a",
  ink: "#efe4c8",
  wood: "#4a3426",
  woodDark: "#33231a",
  cover: "#6b2c2a",
  pageEdge: "#ece2cc",
};

// ---------- 背页：夜空 ----------
export function drawSky(ctx, W, H, seed, moon) {
  const rand = mulberry32(seed);
  const g = ctx.createRadialGradient(moon.x, moon.y, 0, moon.x, moon.y, W * 0.95);
  g.addColorStop(0, PAL.skyGlow);
  g.addColorStop(0.4, PAL.skyMid);
  g.addColorStop(1, PAL.skyEdge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // 月晕
  const halo = ctx.createRadialGradient(moon.x, moon.y, 0, moon.x, moon.y, W * 0.22);
  halo.addColorStop(0, "rgba(243,226,166,0.30)");
  halo.addColorStop(1, "rgba(243,226,166,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);
  // 薄云（印刷感的柔边）
  ctx.save();
  ctx.filter = "blur(14px)";
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(86,106,148,${0.16 + rand() * 0.14})`;
    ctx.beginPath();
    ctx.ellipse(rand() * W, H * (0.12 + rand() * 0.45), W * (0.08 + rand() * 0.12), H * (0.025 + rand() * 0.03), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // 星星
  for (let i = 0; i < 170; i++) {
    const x = rand() * W;
    const y = rand() * H * 0.72;
    const dm = Math.hypot(x - moon.x, y - moon.y);
    if (dm < W * 0.09) continue;
    ctx.fillStyle = `rgba(246,236,208,${0.25 + rand() * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + rand() * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // 几颗四角星
  for (let i = 0; i < 7; i++) {
    const x = W * 0.05 + rand() * W * 0.9;
    const y = H * 0.05 + rand() * H * 0.5;
    if (Math.hypot(x - moon.x, y - moon.y) < W * 0.12) continue;
    if (x < W * 0.55 && y < H * 0.34) continue; // 给歌词留白
    const s = 9 + rand() * 9;
    ctx.fillStyle = "rgba(246,236,208,0.85)";
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.fill();
  }
  paperGrain(ctx, W, H, seed + 1, 9, 500);
}

// ---------- 半月（剪纸） ----------
export function drawMoon(ctx, W, H) {
  const cx = W * 0.44;
  const cy = H / 2;
  const r = W * 0.36;
  const p = new Path2D();
  p.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
  p.bezierCurveTo(cx + r * 0.16, cy + r * 0.55, cx + r * 0.16, cy - r * 0.55, cx, cy - r);
  p.closePath();
  dieCut(ctx, p, W * 0.035);
  const g = ctx.createRadialGradient(cx + r * 0.55, cy - r * 0.2, r * 0.1, cx + r * 0.3, cy, r * 1.1);
  g.addColorStop(0, "#f8ebba");
  g.addColorStop(1, PAL.moonShade);
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  const rand = mulberry32(42);
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = `rgba(205,180,110,${0.25 + rand() * 0.2})`;
    ctx.beginPath();
    ctx.arc(cx + r * (0.2 + rand() * 0.6), cy + r * (rand() * 1.4 - 0.7), r * (0.05 + rand() * 0.1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  paperGrain(ctx, W, H, 77, 8);
}

// ---------- 远处的旧楼（剪纸剪影） ----------
export function drawSkyline(ctx, W, H, seed) {
  const rand = mulberry32(seed);
  const border = 5;
  const blds = [];
  let x = -6;
  while (x < W + 6) {
    const w = 120 + rand() * 170;
    const h = H * (0.38 + rand() * 0.5);
    blds.push({ x, w, h, top: H - h, box: rand() < 0.45, ant: rand() < 0.4, tone: rand() < 0.5 ? PAL.bldA : PAL.bldB });
    x += w - 2;
  }
  const shapes = [];
  for (const b of blds) {
    const p = new Path2D();
    p.rect(b.x, b.top, b.w, b.h + 20);
    shapes.push({ p, fill: b.tone });
    if (b.box) {
      const bw = b.w * (0.25 + rand() * 0.25);
      const bx = b.x + b.w * (0.1 + rand() * 0.5);
      const q = new Path2D();
      q.rect(bx, b.top - 34, bw, 40);
      shapes.push({ p: q, fill: PAL.bldRoof });
    }
  }
  const lines = [];
  for (const b of blds) {
    if (!b.ant) continue;
    const ax = b.x + b.w * (0.2 + rand() * 0.6);
    const l = new Path2D();
    l.moveTo(ax, b.top);
    l.lineTo(ax, b.top - 70 - rand() * 40);
    l.moveTo(ax - 22, b.top - 52);
    l.lineTo(ax + 22, b.top - 52);
    lines.push(l);
  }
  for (const s of shapes) dieCut(ctx, s.p, border, 0, EDGE);
  for (const l of lines) dieCutLine(ctx, l, 5, border, EDGE);
  for (const s of shapes) {
    ctx.fillStyle = s.fill;
    ctx.fill(s.p);
  }
  ctx.strokeStyle = PAL.bldRoof;
  ctx.lineWidth = 5;
  for (const l of lines) ctx.stroke(l);
  // 窗户：稀疏一些，只有少数亮着
  for (const b of blds) {
    const cols = Math.max(2, Math.floor((b.w - 30) / 36));
    const rows = Math.floor((b.h - 36) / 46);
    const gx = (b.w - cols * 36) / 2 + 10;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rand() < 0.13;
        ctx.fillStyle = lit ? PAL.winLit : PAL.winDark;
        ctx.globalAlpha = lit ? 0.9 : 0.55;
        ctx.fillRect(b.x + gx + c * 36, b.top + 26 + r * 46, 14, 18);
      }
    }
    ctx.globalAlpha = 1;
  }
  paperGrain(ctx, W, H, seed + 3, 10, 300);
}

// ---------- 天台女儿墙 + 栏杆 ----------
export function drawParapet(ctx, W, H, seed) {
  const border = 4;
  const wallTop = H * 0.5;
  const railTop = H * 0.12;
  const wall = new Path2D();
  wall.rect(0, wallTop, W, H - wallTop + 10);
  const rails = new Path2D();
  rails.moveTo(0, railTop);
  rails.lineTo(W, railTop);
  for (let x = 60; x < W; x += 150) {
    rails.moveTo(x, railTop);
    rails.lineTo(x, wallTop);
  }
  dieCut(ctx, wall, border, 0, EDGE);
  dieCutLine(ctx, rails, 7, border, EDGE);
  ctx.fillStyle = PAL.wall;
  ctx.fill(wall);
  ctx.fillStyle = PAL.wallCap;
  ctx.fillRect(0, wallTop, W, H * 0.09);
  ctx.strokeStyle = PAL.rail;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.stroke(rails);
  // 水渍
  const rand = mulberry32(seed);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(70,78,96,${0.08 + rand() * 0.1})`;
    ctx.fillRect(rand() * W, wallTop + H * 0.09, 6 + rand() * 18, H * (0.1 + rand() * 0.3));
  }
  paperGrain(ctx, W, H, seed + 5, 10, 200);
}

// ---------- 老式电视天线 ----------
export function drawAntenna(ctx, W, H) {
  const border = 5;
  const cx = W / 2;
  const p = new Path2D();
  p.moveTo(cx, H);
  p.lineTo(cx, H * 0.05);
  const bars = [
    [H * 0.1, W * 0.42],
    [H * 0.2, W * 0.34],
    [H * 0.3, W * 0.26],
  ];
  for (const [y, half] of bars) {
    p.moveTo(cx - half, y);
    p.lineTo(cx + half, y);
    p.moveTo(cx - half, y);
    p.lineTo(cx - half, y - H * 0.03);
    p.moveTo(cx + half, y);
    p.lineTo(cx + half, y - H * 0.03);
  }
  dieCutLine(ctx, p, 8, border, EDGE);
  ctx.strokeStyle = "#2f3546";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.stroke(p);
}

// ---------- 双人木长椅 ----------
export function drawBench(ctx, W, H) {
  const border = 12;
  const wood = "#a8754c";
  const woodDark = "#7d5235";
  const planks = [];
  const plank = (x, y, w, h) => {
    const p = new Path2D();
    p.roundRect(x, y, w, h, h * 0.3);
    planks.push(p);
    return p;
  };
  // 靠背两条、坐板一条（正面看）
  plank(W * 0.06, H * 0.12, W * 0.88, H * 0.1);
  plank(W * 0.06, H * 0.28, W * 0.88, H * 0.1);
  plank(W * 0.02, H * 0.5, W * 0.96, H * 0.13);
  const legs = new Path2D();
  for (const fx of [0.14, 0.86]) {
    legs.moveTo(W * fx, H * 0.1);
    legs.lineTo(W * fx, H * 0.98);
  }
  legs.moveTo(W * 0.5, H * 0.1);
  legs.lineTo(W * 0.5, H * 0.5);
  dieCutLine(ctx, legs, W * 0.045, border);
  for (const p of planks) dieCut(ctx, p, border);
  ctx.strokeStyle = woodDark;
  ctx.lineWidth = W * 0.045;
  ctx.lineCap = "round";
  ctx.stroke(legs);
  for (const p of planks) {
    ctx.fillStyle = wood;
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = "rgba(90,58,36,0.35)";
    ctx.lineWidth = 3;
    for (let y = 0; y < H; y += 9) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(W * 0.3, y + 3, W * 0.6, y - 3, W, y + 1);
      ctx.stroke();
    }
    ctx.restore();
  }
  paperGrain(ctx, W, H, 33, 10);
}

// ---------- 天台水箱 ----------
export function drawWaterTank(ctx, W, H) {
  const border = 12;
  const legs = new Path2D();
  for (const fx of [0.2, 0.4, 0.6, 0.8]) {
    legs.moveTo(W * fx, H * 0.6);
    legs.lineTo(W * fx + (fx < 0.5 ? -8 : 8), H);
  }
  const tank = new Path2D();
  tank.roundRect(W * 0.1, H * 0.16, W * 0.8, H * 0.48, 22);
  const lid = new Path2D();
  lid.ellipse(W * 0.5, H * 0.16, W * 0.4, H * 0.06, 0, 0, Math.PI * 2);
  dieCutLine(ctx, legs, 12, border);
  dieCut(ctx, tank, border);
  dieCut(ctx, lid, border);
  ctx.strokeStyle = "#4a4f5c";
  ctx.lineWidth = 12;
  ctx.stroke(legs);
  ctx.fillStyle = "#bdb5a3";
  ctx.fill(tank);
  ctx.save();
  ctx.clip(tank);
  ctx.fillStyle = "rgba(160,110,70,0.35)";
  for (const fx of [0.3, 0.52, 0.7]) ctx.fillRect(W * fx, H * 0.2, 9, H * 0.3);
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(W * 0.1, H * 0.16, W * 0.18, H * 0.5);
  ctx.restore();
  ctx.fillStyle = "#a59d8b";
  ctx.fill(lid);
  paperGrain(ctx, W, H, 91, 10);
}

// ---------- 底页：方砖地面（天台、广场、站台都能用） ----------
export function drawTileFloor(ctx, W, H, seed) {
  const rand = mulberry32(seed);
  ctx.fillStyle = PAL.roof;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = PAL.roofLine;
  ctx.lineWidth = 4;
  for (let x = 0; x <= W; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(60,66,82,${0.05 + rand() * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(rand() * W, rand() * H, 30 + rand() * 120, 14 + rand() * 50, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // 靠近书脊处更暗（折页阴影）
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.25);
  g.addColorStop(0, "rgba(20,24,36,0.35)");
  g.addColorStop(1, "rgba(20,24,36,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.25);
  paperGrain(ctx, W, H, seed + 2, 10, 600);
}

// ---------- 书桌木纹 ----------
export function drawDesk(ctx, W, H, seed) {
  const rand = mulberry32(seed);
  ctx.fillStyle = PAL.wood;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 220; i++) {
    const y = rand() * H;
    ctx.strokeStyle = rand() < 0.5 ? `rgba(30,18,10,${0.08 + rand() * 0.14})` : `rgba(120,86,60,${0.05 + rand() * 0.08})`;
    ctx.lineWidth = 1 + rand() * 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    const a = rand() * 26 - 13;
    ctx.bezierCurveTo(W * 0.3, y + a, W * 0.66, y - a, W, y + rand() * 10 - 5);
    ctx.stroke();
  }
  // 木板接缝
  ctx.strokeStyle = "rgba(20,12,8,0.45)";
  ctx.lineWidth = 4;
  for (const y of [H * 0.34, H * 0.68]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  paperGrain(ctx, W, H, seed + 9, 12);
}

// ---------- 背景房间（预先虚化，当作景深） ----------
export function drawRoom(W, H) {
  const off = makeCanvas(W, H);
  const o = off.getContext("2d");
  const rand = mulberry32(5);
  const g = o.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1a2031");
  g.addColorStop(1, "#272c3b");
  o.fillStyle = g;
  o.fillRect(0, 0, W, H);
  // 书架（左）
  o.fillStyle = "#1e2433";
  o.fillRect(W * 0.02, H * 0.18, W * 0.22, H * 0.82);
  for (let s = 0; s < 4; s++) {
    let bx = W * 0.03;
    const sy = H * (0.22 + s * 0.19);
    while (bx < W * 0.22) {
      const bw = W * (0.006 + rand() * 0.01);
      const bh = H * (0.1 + rand() * 0.06);
      o.fillStyle = ["#3a3040", "#2f3b4a", "#4a3a2c", "#2c3a34", "#4a2f2f"][Math.floor(rand() * 5)];
      o.fillRect(bx, sy + H * 0.17 - bh, bw, bh);
      bx += bw + 2;
    }
  }
  // 窗
  const wx = W * 0.56;
  const wy = H * 0.1;
  const ww = W * 0.3;
  const wh = H * 0.62;
  const sky = o.createLinearGradient(0, wy, 0, wy + wh);
  sky.addColorStop(0, "#2a3f68");
  sky.addColorStop(1, "#405a8c");
  o.fillStyle = sky;
  o.fillRect(wx, wy, ww, wh);
  // 窗外的月亮与远处灯火
  o.fillStyle = "rgba(233,220,174,0.9)";
  o.beginPath();
  o.arc(wx + ww * 0.72, wy + wh * 0.22, W * 0.018, 0, Math.PI * 2);
  o.fill();
  for (let i = 0; i < 40; i++) {
    o.fillStyle = `rgba(240,184,96,${0.3 + rand() * 0.4})`;
    o.beginPath();
    o.arc(wx + rand() * ww, wy + wh * (0.72 + rand() * 0.26), 3 + rand() * 7, 0, Math.PI * 2);
    o.fill();
  }
  o.strokeStyle = "#0b0e16";
  o.lineWidth = W * 0.008;
  o.strokeRect(wx, wy, ww, wh);
  o.beginPath();
  o.moveTo(wx + ww / 2, wy);
  o.lineTo(wx + ww / 2, wy + wh);
  o.moveTo(wx, wy + wh * 0.45);
  o.lineTo(wx + ww, wy + wh * 0.45);
  o.stroke();
  // 窗帘
  for (const side of [wx - W * 0.07, wx + ww - W * 0.01]) {
    o.fillStyle = "#1c2233";
    o.fillRect(side, wy - H * 0.04, W * 0.08, wh + H * 0.12);
    for (let k = 0; k < 4; k++) {
      o.fillStyle = "rgba(0,0,0,0.25)";
      o.fillRect(side + k * W * 0.02, wy - H * 0.04, W * 0.006, wh + H * 0.12);
    }
  }
  // 台灯照到墙上的暖光
  const lamp = o.createRadialGradient(W * 0.2, H * 0.95, 0, W * 0.2, H * 0.95, W * 0.45);
  lamp.addColorStop(0, "rgba(255,200,130,0.42)");
  lamp.addColorStop(1, "rgba(255,200,130,0)");
  o.fillStyle = lamp;
  o.fillRect(0, 0, W, H);

  const out = makeCanvas(W, H);
  const c = out.getContext("2d");
  c.filter = "blur(14px)";
  c.drawImage(off, 0, 0);
  c.filter = "none";
  return out;
}

// ---------- 桌上的道具 ----------
export function drawClockFace(ctx, W, H) {
  ctx.fillStyle = "#efe6d0";
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, W * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a3330";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.lineWidth = i % 3 === 0 ? 8 : 4;
    ctx.beginPath();
    ctx.moveTo(W / 2 + Math.cos(a) * W * 0.36, H / 2 + Math.sin(a) * H * 0.36);
    ctx.lineTo(W / 2 + Math.cos(a) * W * 0.43, H / 2 + Math.sin(a) * H * 0.43);
    ctx.stroke();
  }
  // 指针停在 10:10（示意）
  const hand = (ang, len, w) => {
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2);
    ctx.lineTo(W / 2 + Math.sin(ang) * len, H / 2 - Math.cos(ang) * len);
    ctx.stroke();
  };
  hand(((10 + 10 / 60) / 12) * Math.PI * 2, W * 0.24, 10);
  hand((10 / 60) * Math.PI * 2, W * 0.36, 6);
}

// ---------- 书的封面：暗红布面 + 烫金书名 + 半月 ----------
/** 书名、副标题由调用方传入（buildBookWorld 的 cover 参数）；不传就是占位字 */
export function drawCover(ctx, W, H, { title = "片名", subtitle = "" } = {}) {
  const FONT = '"MVSong", "Songti TC", "Songti SC", serif';
  ctx.fillStyle = PAL.cover;
  ctx.fillRect(0, 0, W, H);
  // 布纹
  const rand = mulberry32(19);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = `rgba(${rand() < 0.5 ? "255,220,200" : "20,0,0"},${0.03 + rand() * 0.05})`;
    ctx.fillRect(rand() * W, rand() * H, 2 + rand() * 3, 1);
  }
  // 烫金双线边框
  ctx.strokeStyle = "rgba(226,196,130,0.85)";
  ctx.lineWidth = 6;
  ctx.strokeRect(W * 0.05, H * 0.08, W * 0.9, H * 0.84);
  ctx.lineWidth = 2;
  ctx.strokeRect(W * 0.065, H * 0.11, W * 0.87, H * 0.78);
  // 半月
  ctx.fillStyle = "#ead7a2";
  ctx.beginPath();
  ctx.arc(W * 0.5, H * 0.33, H * 0.09, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  // 书名
  ctx.fillStyle = "#ead7a2";
  ctx.textAlign = "center";
  ctx.font = `700 ${Math.round(H * 0.16)}px ${FONT}`;
  ctx.fillText(title, W * 0.5, H * 0.66);
  ctx.font = `700 ${Math.round(H * 0.045)}px ${FONT}`;
  ctx.fillStyle = "rgba(234,215,162,0.8)";
  if (subtitle) ctx.fillText(subtitle, W * 0.5, H * 0.8);
  ctx.textAlign = "left";
}
