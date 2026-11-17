// 剪纸道具：住宅外墙（带窗洞）、窗里的屋子、信封、栏杆、海鸥、凉亭舞台、折椅、枫叶、照片、对话气泡。
import { mulberry32 } from "./util.js";
import { paperGrain, dieCut, dieCutLine, PAPER_WHITE } from "./paper.js";

const FONT = '"MVSong", "Songti TC", "Songti SC", serif';
const EDGE = "#d6cbb6";

// ---------- 住宅外墙：一扇窗挖空（透明），能看到后面的人 ----------
// win: {x,y,w,h} 画布像素；tone: 墙色；warm: 窗里的灯是否暖黄
export function drawFacade(ctx, W, H, seed, { win, tone = "#5f6274", trim = "#4a4c5c", warm = true, plant = true, ac = true }) {
  const rand = mulberry32(seed);
  const wall = new Path2D();
  wall.rect(0, 0, W, H + 10);
  dieCut(ctx, wall, 6, 0, EDGE);
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, W, H + 10);
  // 瓷砖横缝
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 2;
  for (let y = 20; y < H; y += 38) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // 其他窗户（暗或亮）
  for (let r = 0; r < Math.floor(H / 300); r++) {
    for (let c = 0; c < Math.floor(W / 260); c++) {
      const x = 60 + c * 260;
      const y = 60 + r * 300;
      if (Math.abs(x + 80 - (win.x + win.w / 2)) < win.w && Math.abs(y + 90 - (win.y + win.h / 2)) < win.h) continue;
      const lit = rand() < 0.3;
      ctx.fillStyle = lit ? "#e9bd6c" : "#2a2f40";
      ctx.fillRect(x, y, 160, 170);
      ctx.strokeStyle = trim;
      ctx.lineWidth = 10;
      ctx.strokeRect(x, y, 160, 170);
    }
  }
  // 主窗：窗框、窗台、铁窗花
  ctx.fillStyle = trim;
  ctx.fillRect(win.x - 26, win.y - 26, win.w + 52, win.h + 52);
  ctx.fillStyle = "#cfc4ae";
  ctx.fillRect(win.x - 46, win.y + win.h, win.w + 92, 30);
  if (ac) {
    ctx.fillStyle = "#bfb9ad";
    ctx.fillRect(win.x + win.w + 60, win.y + win.h * 0.45, 170, 120);
    ctx.fillStyle = "#8f8a80";
    for (let k = 0; k < 6; k++) ctx.fillRect(win.x + win.w + 72, win.y + win.h * 0.45 + 14 + k * 17, 146, 6);
  }
  if (plant) {
    ctx.fillStyle = "#a35f3e";
    ctx.fillRect(win.x + win.w - 110, win.y + win.h - 46, 70, 48);
    ctx.fillStyle = "#4f7a4a";
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.ellipse(win.x + win.w - 75 + (k - 2) * 16, win.y + win.h - 66, 12, 30, (k - 2) * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // 挖空窗洞（透明）
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillRect(win.x, win.y, win.w, win.h);
  ctx.restore();
  // 铁窗花（画在洞上，留在前面）
  ctx.strokeStyle = trim;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(win.x + win.w / 2, win.y);
  ctx.lineTo(win.x + win.w / 2, win.y + win.h * 0.18);
  ctx.moveTo(win.x, win.y + win.h * 0.18);
  ctx.lineTo(win.x + win.w, win.y + win.h * 0.18);
  ctx.stroke();
  paperGrain(ctx, W, H, seed + 2, 10, 300);
}

/** 窗里面的房间（放在人后面）：暗暖色 + 一点灯光 */
export function drawInterior(ctx, W, H, warm = true) {
  ctx.fillStyle = warm ? "#5a4434" : "#2d2a33";
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W * 0.3, H * 0.4, W * 0.7);
  g.addColorStop(0, warm ? "rgba(255,206,140,0.55)" : "rgba(255,206,140,0.22)");
  g.addColorStop(1, "rgba(255,206,140,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(W * 0.62, H * 0.2, W * 0.2, H * 0.55); // 柜子
}

// ---------- 信封（label 不为空时盖一个红色方印，写 label 的字） ----------
export function drawEnvelope(ctx, W, H, label = "") {
  const p = new Path2D();
  p.rect(W * 0.04, H * 0.08, W * 0.92, H * 0.84);
  dieCut(ctx, p, 6, 0, PAPER_WHITE);
  ctx.fillStyle = "#efe6d1";
  ctx.fill(p);
  ctx.strokeStyle = "rgba(120,100,80,0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W * 0.04, H * 0.08);
  ctx.lineTo(W * 0.5, H * 0.52);
  ctx.lineTo(W * 0.96, H * 0.08);
  ctx.stroke();
  ctx.fillStyle = "#c0473c";
  ctx.fillRect(W * 0.76, H * 0.16, W * 0.12, H * 0.18); // 邮票
  if (label) {
    ctx.save();
    ctx.translate(W * 0.42, H * 0.66);
    ctx.rotate(-0.18);
    ctx.strokeStyle = "#c0392b";
    ctx.lineWidth = 6;
    ctx.strokeRect(-W * 0.2, -H * 0.15, W * 0.4, H * 0.28);
    ctx.fillStyle = "#c0392b";
    ctx.font = `700 ${Math.round(H * 0.2)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(label, 0, H * 0.07);
    ctx.restore();
  }
}

// ---------- 海边栏杆（可只画左/右半段） ----------
export function drawSeaRail(ctx, W, H) {
  const p = new Path2D();
  p.moveTo(0, H * 0.12);
  p.lineTo(W, H * 0.12);
  p.moveTo(0, H * 0.5);
  p.lineTo(W, H * 0.5);
  for (let x = 30; x < W; x += 120) {
    p.moveTo(x, H * 0.12);
    p.lineTo(x, H);
  }
  dieCutLine(ctx, p, 12, 6, EDGE);
  ctx.strokeStyle = "#3c4252";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.stroke(p);
}

// ---------- 海鸥 ----------
export function drawGull(ctx, W, H) {
  const p = new Path2D();
  p.moveTo(W * 0.05, H * 0.6);
  p.quadraticCurveTo(W * 0.28, H * 0.1, W * 0.5, H * 0.55);
  p.quadraticCurveTo(W * 0.72, H * 0.1, W * 0.95, H * 0.6);
  dieCutLine(ctx, p, 14, 6);
  ctx.strokeStyle = "#f4efe4";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.stroke(p);
}

// ---------- 户外小舞台（半圆顶棚 + 木台） ----------
export function drawBandstand(ctx, W, H) {
  const shell = new Path2D();
  shell.moveTo(W * 0.08, H * 0.72);
  shell.lineTo(W * 0.08, H * 0.38);
  shell.bezierCurveTo(W * 0.1, H * 0.02, W * 0.9, H * 0.02, W * 0.92, H * 0.38);
  shell.lineTo(W * 0.92, H * 0.72);
  shell.closePath();
  const deck = new Path2D();
  deck.rect(W * 0.02, H * 0.72, W * 0.96, H * 0.28);
  dieCut(ctx, shell, 10);
  dieCut(ctx, deck, 10);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.5);
  g.addColorStop(0, "#f0d8a6");
  g.addColorStop(1, "#b98c5c");
  ctx.fillStyle = g;
  ctx.fill(shell);
  ctx.strokeStyle = "rgba(110,70,40,0.35)";
  ctx.lineWidth = 6;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(W * 0.5, H * 0.72, W * 0.42 * (i / 5), H * 0.62 * (i / 5), 0, Math.PI, 0);
    ctx.stroke();
  }
  ctx.fillStyle = "#7a4e30";
  ctx.fill(deck);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let x = W * 0.06; x < W * 0.98; x += 90) ctx.fillRect(x, H * 0.75, 6, H * 0.25);
  paperGrain(ctx, W, H, 91, 10);
}

// ---------- 折椅（背面，空着） ----------
export function drawChairRow(ctx, W, H, n = 6) {
  for (let i = 0; i < n; i++) {
    const x = W * (0.06 + (i / n) * 0.9);
    const cw = (W / n) * 0.62;
    const p = new Path2D();
    p.rect(x, H * 0.1, cw, H * 0.42);
    p.rect(x + cw * 0.08, H * 0.52, cw * 0.1, H * 0.48);
    p.rect(x + cw * 0.82, H * 0.52, cw * 0.1, H * 0.48);
    dieCut(ctx, p, 6, 0, EDGE);
    ctx.fillStyle = "#4c5a6e";
    ctx.fill(p);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x + 6, H * 0.14, cw - 12, H * 0.06);
  }
}

// ---------- 枫叶 ----------
export function drawMaple(ctx, W, H, color = "#c8553d") {
  const p = new Path2D();
  const cx = W / 2;
  const cy = H * 0.5;
  // 七个叶尖：上面三个长、两侧两对短，叶尖之间有小锯齿
  const tips = [[-90, 0.46], [-48, 0.4], [-132, 0.4], [-8, 0.34], [-172, 0.34], [38, 0.24], [142, 0.24]].sort((a, b) => a[0] - b[0]);
  const ordered = tips.map(([deg, r]) => [((deg + 360) % 360), r]).sort((a, b) => a[0] - b[0]);
  ordered.forEach(([deg, r], i) => {
    const a = (deg * Math.PI) / 180;
    const next = ordered[(i + 1) % ordered.length];
    const midDeg = next[0] > deg ? (deg + next[0]) / 2 : (deg + next[0] + 360) / 2;
    const m = (midDeg * Math.PI) / 180;
    const tip = [cx + Math.cos(a) * W * r, cy + Math.sin(a) * W * r];
    const notch = [cx + Math.cos(m) * W * 0.13, cy + Math.sin(m) * W * 0.13];
    const tooth = [cx + Math.cos(a + 0.18) * W * r * 0.7, cy + Math.sin(a + 0.18) * W * r * 0.7];
    if (i === 0) p.moveTo(...tip);
    else p.lineTo(...tip);
    p.lineTo(...tooth);
    p.lineTo(...notch);
  });
  p.closePath();
  dieCut(ctx, p, 5);
  ctx.fillStyle = color;
  ctx.fill(p);
  ctx.strokeStyle = "rgba(90,30,20,0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, H * 0.98);
  ctx.lineTo(cx, H * 0.2);
  ctx.stroke();
}

// ---------- 拍立得照片（里面画一个小场景或人像） ----------
export function drawPhoto(ctx, W, H, paintInside) {
  const p = new Path2D();
  p.rect(W * 0.04, H * 0.04, W * 0.92, H * 0.92);
  dieCut(ctx, p, 5);
  ctx.fillStyle = "#f6f1e6";
  ctx.fill(p);
  ctx.save();
  ctx.beginPath();
  ctx.rect(W * 0.12, H * 0.1, W * 0.76, H * 0.62);
  ctx.clip();
  paintInside(ctx, W * 0.12, H * 0.1, W * 0.76, H * 0.62);
  ctx.restore();
  ctx.fillStyle = "#b8473f";
  ctx.fillRect(W * 0.44, 0, W * 0.12, H * 0.06); // 胶带
}

// ---------- 对话气泡（省略号） ----------
export function drawBubble(ctx, W, H) {
  const p = new Path2D();
  p.ellipse(W / 2, H * 0.42, W * 0.44, H * 0.36, 0, 0, Math.PI * 2);
  p.moveTo(W * 0.3, H * 0.7);
  p.lineTo(W * 0.18, H * 0.96);
  p.lineTo(W * 0.46, H * 0.74);
  dieCut(ctx, p, 8);
  ctx.fillStyle = "#f3eee2";
  ctx.fill(p);
  ctx.fillStyle = "#5a4a3c";
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(W / 2 + i * W * 0.16, H * 0.42, W * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
}
