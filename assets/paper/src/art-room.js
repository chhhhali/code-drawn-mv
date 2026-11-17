// 室内：墙（窗外半月）、床、床头柜台灯、纸团、木地板。
import { mulberry32 } from "./util.js";
import { paperGrain, dieCut, dieCutLine } from "./paper.js";

const FONT = '"MVSong", "Songti TC", "Songti SC", serif';

// ---------- 背景纸：墙纸 + 窗（窗外半月）+ 月历 + 台灯光晕 ----------
export function drawRoomWall(ctx, W, H, seed, win, lampGlow, cal) {
  const rand = mulberry32(seed);
  ctx.fillStyle = "#47506a";
  ctx.fillRect(0, 0, W, H);
  // 竖条纹墙纸
  for (let x = 0; x < W; x += 64) {
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fillRect(x, 0, 26, H);
    ctx.fillStyle = "rgba(240,220,170,0.06)";
    for (let y = 30; y < H; y += 90) {
      ctx.beginPath();
      ctx.arc(x + 45, y + ((x / 64) % 2) * 45, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 窗：夜空 + 半月
  const sky = ctx.createLinearGradient(0, win.y, 0, win.y + win.h);
  sky.addColorStop(0, "#1e2a48");
  sky.addColorStop(1, "#33476f");
  ctx.fillStyle = sky;
  ctx.fillRect(win.x, win.y, win.w, win.h);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(246,236,208,${0.3 + rand() * 0.5})`;
    ctx.beginPath();
    ctx.arc(win.x + rand() * win.w, win.y + rand() * win.h * 0.7, 1.2 + rand() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  const mx = win.x + win.w * 0.68;
  const my = win.y + win.h * 0.3;
  const mr = win.w * 0.11;
  const halo = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 4);
  halo.addColorStop(0, "rgba(243,226,166,0.35)");
  halo.addColorStop(1, "rgba(243,226,166,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(win.x, win.y, win.w, win.h);
  ctx.fillStyle = "#f3e2a6";
  ctx.beginPath();
  ctx.arc(mx, my, mr, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  // 窗框
  ctx.strokeStyle = "#d9cfbb";
  ctx.lineWidth = 18;
  ctx.strokeRect(win.x, win.y, win.w, win.h);
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(win.x + win.w / 2, win.y);
  ctx.lineTo(win.x + win.w / 2, win.y + win.h);
  ctx.moveTo(win.x, win.y + win.h * 0.42);
  ctx.lineTo(win.x + win.w, win.y + win.h * 0.42);
  ctx.stroke();
  // 窗台
  ctx.fillStyle = "#cfc4ae";
  ctx.fillRect(win.x - 30, win.y + win.h, win.w + 60, 26);
  // 窗帘
  for (const side of [-1, 1]) {
    const cx = side < 0 ? win.x - 90 : win.x + win.w - 40;
    ctx.fillStyle = "#7c4a3d";
    ctx.beginPath();
    ctx.moveTo(cx, win.y - 50);
    ctx.lineTo(cx + 130, win.y - 50);
    ctx.quadraticCurveTo(cx + (side < 0 ? 150 : -10), win.y + win.h * 0.5, cx + 110, win.y + win.h + 60);
    ctx.lineTo(cx + 10, win.y + win.h + 60);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 6;
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(cx + k * 30, win.y - 50);
      ctx.lineTo(cx + 10 + k * 26, win.y + win.h + 60);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#5b4636";
  ctx.fillRect(win.x - 120, win.y - 62, win.w + 240, 16);
  // 月历（不写年份）
  ctx.fillStyle = "#efe6d0";
  ctx.fillRect(cal.x, cal.y, cal.w, cal.h);
  ctx.fillStyle = "#a8473b";
  ctx.fillRect(cal.x, cal.y, cal.w, cal.h * 0.22);
  ctx.fillStyle = "rgba(60,50,45,0.55)";
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 7; c++) ctx.fillRect(cal.x + 14 + c * (cal.w - 28) / 7, cal.y + cal.h * 0.3 + r * cal.h * 0.13, (cal.w - 28) / 7 - 6, cal.h * 0.08);
  }
  // 台灯照在墙上的暖光
  const lg = ctx.createRadialGradient(lampGlow.x, lampGlow.y, 0, lampGlow.x, lampGlow.y, W * 0.24);
  lg.addColorStop(0, "rgba(255,206,140,0.5)");
  lg.addColorStop(1, "rgba(255,206,140,0)");
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, H);
  // 踢脚线
  ctx.fillStyle = "#3b2f28";
  ctx.fillRect(0, H - 40, W, 40);
  paperGrain(ctx, W, H, seed + 1, 9, 400);
}

// ---------- 床（侧面） ----------
export function drawBed(ctx, W, H) {
  const border = 12;
  const frame = new Path2D();
  frame.roundRect(W * 0.02, H * 0.05, W * 0.06, H * 0.95, 10); // 床头板
  frame.rect(W * 0.04, H * 0.62, W * 0.92, H * 0.14); // 床架
  frame.rect(W * 0.9, H * 0.4, W * 0.05, H * 0.6); // 床尾
  const legs = new Path2D();
  for (const fx of [0.06, 0.92]) legs.rect(W * fx, H * 0.74, W * 0.03, H * 0.26);
  const mattress = new Path2D();
  mattress.roundRect(W * 0.07, H * 0.38, W * 0.84, H * 0.26, 18);
  const pillow = new Path2D();
  pillow.roundRect(W * 0.09, H * 0.25, W * 0.18, H * 0.16, 30);
  const blanket = new Path2D();
  blanket.moveTo(W * 0.36, H * 0.4);
  blanket.quadraticCurveTo(W * 0.6, H * 0.3, W * 0.9, H * 0.4);
  blanket.lineTo(W * 0.92, H * 0.68);
  blanket.lineTo(W * 0.36, H * 0.68);
  blanket.closePath();
  for (const p of [frame, legs, mattress, pillow, blanket]) dieCut(ctx, p, border);
  ctx.fillStyle = "#7a5238";
  ctx.fill(frame);
  ctx.fill(legs);
  ctx.fillStyle = "#e9e4d8";
  ctx.fill(mattress);
  ctx.fillStyle = "#f2eee4";
  ctx.fill(pillow);
  ctx.fillStyle = "#6f86a8";
  ctx.fill(blanket);
  ctx.save();
  ctx.clip(blanket);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 6;
  for (let x = W * 0.36; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, H * 0.3);
    ctx.lineTo(x - 30, H * 0.7);
    ctx.stroke();
  }
  ctx.restore();
  paperGrain(ctx, W, H, 71, 9);
}

// ---------- 床头柜 + 亮着的台灯 + 收音机 ----------
export function drawNightstand(ctx, W, H) {
  const border = 10;
  const table = new Path2D();
  table.rect(W * 0.1, H * 0.55, W * 0.8, H * 0.45);
  const lamp = new Path2D();
  lamp.moveTo(W * 0.22, H * 0.08);
  lamp.lineTo(W * 0.6, H * 0.08);
  lamp.lineTo(W * 0.7, H * 0.3);
  lamp.lineTo(W * 0.12, H * 0.3);
  lamp.closePath();
  lamp.rect(W * 0.38, H * 0.3, W * 0.06, H * 0.22);
  lamp.ellipse(W * 0.41, H * 0.53, W * 0.16, H * 0.025, 0, 0, Math.PI * 2);
  const radio = new Path2D();
  radio.roundRect(W * 0.56, H * 0.42, W * 0.32, H * 0.13, 8);
  for (const p of [table, lamp, radio]) dieCut(ctx, p, border);
  ctx.fillStyle = "#6e4a33";
  ctx.fill(table);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 4;
  ctx.strokeRect(W * 0.16, H * 0.62, W * 0.68, H * 0.14);
  ctx.fillStyle = "#f6dfaa";
  ctx.fill(lamp);
  ctx.fillStyle = "#3c3c44";
  ctx.fill(radio);
  ctx.fillStyle = "#c9c2b2";
  ctx.beginPath();
  ctx.arc(W * 0.66, H * 0.485, W * 0.04, 0, Math.PI * 2);
  ctx.arc(W * 0.79, H * 0.485, W * 0.04, 0, Math.PI * 2);
  ctx.fill();
  paperGrain(ctx, W, H, 72, 9);
}

// ---------- 揉皱的信纸团 ----------
export function drawPaperBall(ctx, W, H, seed) {
  const rand = mulberry32(seed);
  const n = 11;
  const p = new Path2D();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = W * (0.36 + rand() * 0.1);
    const x = W / 2 + Math.cos(a) * r;
    const y = H / 2 + Math.sin(a) * r;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  p.closePath();
  dieCut(ctx, p, 6, 0, "#fbf7ee");
  ctx.fillStyle = "#ece4d2";
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  ctx.strokeStyle = "rgba(110,100,90,0.45)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + (rand() - 0.5) * W * 0.6, H / 2 + (rand() - 0.5) * H * 0.6);
    ctx.lineTo(W / 2 + (rand() - 0.5) * W * 0.8, H / 2 + (rand() - 0.5) * H * 0.8);
    ctx.lineTo(W / 2 + (rand() - 0.5) * W * 0.6, H / 2 + (rand() - 0.5) * H * 0.6);
    ctx.stroke();
  }
  // 信纸上的横线
  ctx.strokeStyle = "rgba(90,120,160,0.35)";
  ctx.lineWidth = 2;
  for (let y = H * 0.2; y < H * 0.8; y += 12) {
    ctx.beginPath();
    ctx.moveTo(W * 0.15, y + (rand() - 0.5) * 8);
    ctx.lineTo(W * 0.85, y + (rand() - 0.5) * 8);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------- 木地板（木条朝镜头方向延伸） ----------
export function drawFloorboards(ctx, W, H, seed) {
  const rand = mulberry32(seed);
  ctx.fillStyle = "#6a4935";
  ctx.fillRect(0, 0, W, H);
  const plank = 82;
  for (let x = 0; x < W; x += plank) {
    const tone = rand() * 18 - 9;
    ctx.fillStyle = `rgb(${106 + tone},${73 + tone},${53 + tone})`;
    ctx.fillRect(x, 0, plank - 4, H);
    ctx.strokeStyle = "rgba(40,24,14,0.25)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const gx = x + 8 + rand() * (plank - 20);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + 6, H * 0.3, gx - 6, H * 0.6, gx + 3, H);
      ctx.stroke();
    }
    // 接缝
    let y = rand() * 300;
    while (y < H) {
      ctx.fillStyle = "rgba(30,18,10,0.5)";
      ctx.fillRect(x, y, plank - 4, 3);
      y += 280 + rand() * 260;
    }
  }
  // 床下的影子（靠墙处）
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.25);
  g.addColorStop(0, "rgba(10,8,12,0.4)");
  g.addColorStop(1, "rgba(10,8,12,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.25);
  paperGrain(ctx, W, H, seed + 3, 10);
}
