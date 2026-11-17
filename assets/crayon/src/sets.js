// 可以反复用的通用布景：城市天际线、远山、草坡、树、海、地面、楼外墙和一扇主窗、前景草叶。
// 每个函数都画在一层大画布上（世界坐标；画面是 1920×1080，四周再留边，镜头移动时不露底）。
// 内容都是示意，新片按自己的故事换；画法（平涂 + 同色系深描边 + 排线方向 + 纸纹）保持不变。
import { makeLayer, crayon, strokes, scribble, grass, glow, darker, lighter, rgba, pick } from "./crayon.js";
import { buildings, pottedPlant, rect, rrect } from "./art.js";
import { mulberry32 } from "./util.js";

// ---------- 城市天际线（远、近两层楼） ----------
const NIGHT_FAR = ["#30356a", "#353a72", "#2c3163", "#393e78"];
const NIGHT_NEAR = ["#262b58", "#2b305f", "#23274f"];
const DUSK_FAR = ["#b57a74", "#c0857a", "#a96f6f", "#c99080"];
const DUSK_NEAR = ["#8f5a62", "#9a6268", "#83505a"];

/** 返回 { far, near, farWins, nearWins }。dusk = 黄昏版（楼被夕阳照成暖色）；allDark = 窗先全画暗，窗灯另外用 drawWindowLights 动态画 */
export function cityLayers({ dy = 0, dusk = false, allDark = false, seedFar = 41, seedNear = 77, farTop = [520, 650], nearTop = [600, 770] } = {}) {
  const farWins = [];
  const nearWins = [];
  const far = makeLayer(-260, 380 + dy, 2440, 600, (g) => {
    buildings(g, { x0: -260, x1: 2180, base: 960 + dy, top: farTop.map((v) => v + dy), colors: dusk ? DUSK_FAR : NIGHT_FAR, line: dusk ? "#6e3f4c" : "#23264f", lit: 0.12, seed: seedFar, win: [11, 14], windows: farWins, allDark, litColor: "#f2c56b" });
    // 楼脚一层雾色，远处的楼才"退"得下去
    const grd = g.createLinearGradient(0, 560 + dy, 0, 960 + dy);
    grd.addColorStop(0, dusk ? "rgba(240,170,120,0)" : "rgba(72,88,164,0)");
    grd.addColorStop(1, dusk ? "rgba(240,170,120,0.38)" : "rgba(72,88,164,0.4)");
    g.fillStyle = grd;
    g.fillRect(-260, 380 + dy, 2440, 600);
  });
  const near = makeLayer(-260, 420 + dy, 2440, 560, (g) => {
    buildings(g, { x0: -260, x1: 2180, base: 960 + dy, top: nearTop.map((v) => v + dy), colors: dusk ? DUSK_NEAR : NIGHT_NEAR, line: dusk ? "#55303c" : "#171a3c", lit: 0.17, seed: seedNear, win: [16, 20], windows: nearWins, allDark });
  });
  return { far, near, farWins, nearWins };
}

// ---------- 远山 ----------
const HILLS = {
  day: ["#5f8f62", "#557f58"],
  dusk: ["#a88a9e", "#9b7f95"],
  night: ["#38605c", "#2f5450"],
};
/** 起伏的远山：两排，比草地暗一档，斜排线。y = 山脚（地平线）；mood = "day" | "dusk" | "night" */
export function hillLayer(g, { y = 720, mood = "day", seed = 3, x0 = -260, x1 = 2180 } = {}) {
  const r = mulberry32(seed);
  HILLS[mood].forEach((c, k) => {
    const base = y + k * 46;
    const pts = [];
    for (let x = x0 - 200; x <= x1 + 400; x += 220 + r() * 260) pts.push([x, base - (k ? 40 : 70) - r() * (k ? 90 : 150)]);
    const p = new Path2D();
    p.moveTo(x0 - 200, base + 400);
    p.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      p.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); // 经过中点的二次曲线：圆滚滚的山包，没有尖角
    }
    p.lineTo(x1 + 400, base + 400);
    p.closePath();
    crayon(g, p, { fill: c, line: darker(c, 0.15), lw: 0, shade: 0.34, hl: 0.14 });
  });
}

// ---------- 草坡 ----------
const MEADOW = {
  day: { base: "#68ad5b", blades: [["#7eb563", 3], ["#9acc74", 2], ["#b9df80", 1], ["#528b4d", 2]] },
  dusk: { base: "#7d9a55", blades: [["#98ad5e", 3], ["#b8b86a", 2], ["#d9c47a", 1], ["#5e7a46", 2]] },
  night: { base: "#4d8c50", blades: [["#68965c", 3], ["#83af6d", 2], ["#3a6741", 2], ["#457949", 2]] },
};
/** 近处的草坡：一道缓坡 + 成千上万根短竖线（远处短细、近处长粗）。y = 坡顶；bottom 要比画面底边再低一截 */
export function meadow(g, { y = 800, mood = "day", seed = 5, x0 = -260, x1 = 2180, bottom = 1340, density = 0.011 } = {}) {
  const p = new Path2D();
  p.moveTo(x0, y + 80);
  p.bezierCurveTo(x0 + 700, y - 40, x1 - 900, y - 30, x1, y + 70);
  p.lineTo(x1, bottom);
  p.lineTo(x0, bottom);
  p.closePath();
  const m = MEADOW[mood];
  grass(g, p, { base: m.base, blades: m.blades, x0, x1, y0: y - 40, y1: bottom, density, seed });
}

// ---------- 树 ----------
/** 一棵树：几团圆拼成的树冠（斜排线）+ 树干。x, y = 树干底部；s = 树冠大小 */
export function tree(g, x, y, s, { mood = "day", seed = 1 } = {}) {
  const r = mulberry32(seed);
  const trunk = mood === "night" ? "#4a3a33" : "#5e4232";
  crayon(g, rrect(x - s * 0.12, y - s * 1.6, s * 0.24, s * 1.6, s * 0.06), { fill: trunk, line: darker(trunk, 0.25), lw: s * 0.035, shade: 0.24, hl: 0.08, dir: "v" });
  const fill = { day: "#529257", dusk: "#6f8a4e", night: "#3f7449" }[mood];
  const crown = new Path2D();
  for (const [bx, by, br] of [[0, -2.05, 0.8], [-0.66, -1.66, 0.6], [0.66, -1.7, 0.62], [-0.32, -2.5, 0.55], [0.38, -2.46, 0.52]]) {
    const rr = br * s * (0.92 + r() * 0.16);
    crown.moveTo(x + bx * s + rr, y + by * s);
    crown.arc(x + bx * s, y + by * s, rr, 0, Math.PI * 2);
  }
  // 先把所有圆一起描一圈外轮廓，再无描边地填色：树冠里不会露出一圈圈的线
  g.save();
  g.lineJoin = "round";
  g.lineWidth = s * 0.07;
  g.strokeStyle = darker(fill, 0.32);
  g.stroke(crown);
  g.restore();
  crayon(g, crown, { fill, lw: 0, shade: 0.3, hl: 0.16, fleck: 0.16 });
}

// ---------- 海 ----------
/** 海面 + 两侧远山：横排线 + 横向蜡笔笔触 + 太阳 / 月亮的碎光倒影。night = 夜里；sunX = 倒影的位置 */
export function seaLayer(g, { night = false, sunX = 1430 } = {}) {
  const hillA = night ? "#4c4a78" : "#b08fa6";
  const hillB = night ? "#55527f" : "#b897ab";
  const hills = new Path2D();
  hills.moveTo(-260, 640);
  hills.bezierCurveTo(-60, 560, 120, 548, 260, 590);
  hills.bezierCurveTo(360, 560, 470, 540, 600, 586);
  hills.bezierCurveTo(700, 600, 760, 612, 840, 626);
  hills.lineTo(840, 640);
  hills.closePath();
  crayon(g, hills, { fill: hillA, line: darker(hillA, 0.15), lw: 0, shade: 0.34, hl: 0.16 });
  const hills2 = new Path2D();
  hills2.moveTo(1640, 632);
  hills2.bezierCurveTo(1760, 590, 1900, 580, 2200, 600);
  hills2.lineTo(2200, 640);
  hills2.closePath();
  crayon(g, hills2, { fill: hillB, line: darker(hillB, 0.15), lw: 0, shade: 0.3, hl: 0.16 });
  crayon(g, rect(-260, 624, 2460, 340), { fill: night ? "#2f3a78" : "#8091c6", lw: 0, shade: 0.2, hl: 0.12, dir: "h" });
  const r = mulberry32(61);
  const list = [];
  const cols = night ? ["#3a4689", "#283166", "#46539a", "#323d7c", "#4a4a86"] : ["#93a3d4", "#6d7db9", "#a8b5df", "#7484c0", "#b9a6c8"];
  for (let i = 0; i < 46; i++) {
    const y = 630 + r() * 280;
    const len = 240 + r() * 900;
    const x0 = -260 + r() * 2400;
    list.push({ x0, x1: x0 + len, y, th: 8 + r() * 18 * (0.6 + (y - 630) / 260), amp: 2 + r() * 3, freq: 0.006, color: pick(r, cols), alpha: 0.75 });
  }
  strokes(g, list, { streak: 0.45, seed: 61 });
  const refl = [];
  const rc = night ? ["#d8d4a8", "#f3eabd", "#b9b8a0"] : ["#f6c46a", "#fbe3a0", "#f2a868", "#f8d78a"];
  for (let i = 0; i < 26; i++) {
    const y = 632 + r() * 240;
    const spread = 40 + (y - 630) * 0.9;
    const cx = sunX + (r() - 0.5) * spread;
    const len = 50 + r() * (90 + (y - 630) * 0.8);
    refl.push({ x0: cx - len / 2, x1: cx + len / 2, y, th: 6 + r() * 10, amp: 1, freq: 0.01, color: pick(r, rc), alpha: night ? 0.55 : 0.9 });
  }
  strokes(g, refl, { streak: 0.3, seed: 62, bristles: false });
}

// ---------- 地面（街道、广场、堤岸都可以用） ----------
/** 一条横向的地面：底色 + 横排线 + 一些横向蜡笔笔触 + 几道透视线。y = 地面最远处（和楼脚、海面接上） */
export function pavement(g, { y = 900, night = false, seed = 52, x0 = -260, x1 = 2180, bottom = 1340 } = {}) {
  crayon(g, rect(x0, y, x1 - x0, bottom - y), { fill: night ? "#6c6a8e" : "#d6b199", lw: 0, shade: 0.2, hl: 0.12, dir: "h" });
  const fr = mulberry32(seed);
  const cols = night ? ["#757398", "#615f84", "#7e7ca0", "#5c5a7e"] : ["#dcbaa2", "#cfa48f", "#e3c4ab", "#c9a092"];
  strokes(
    g,
    Array.from({ length: 20 }, () => {
      const yy = y + 10 + fr() * (bottom - y - 40);
      const xs = x0 + fr() * (x1 - x0 - 300);
      return { x0: xs, x1: xs + 260 + fr() * 900, y: yy, th: 10 + fr() * 24, amp: 2, freq: 0.004, color: pick(fr, cols), alpha: 0.75 };
    }),
    { streak: 0.5, seed },
  );
  g.save();
  g.strokeStyle = night ? "rgba(60,56,96,0.45)" : "rgba(150,104,92,0.38)";
  g.lineWidth = 3;
  for (const k of [0.06, 0.16, 0.32, 0.56]) {
    const yy = y + (bottom - y) * k;
    g.beginPath();
    g.moveTo(x0, yy);
    g.lineTo(x1, yy);
    g.stroke();
  }
  for (let x = -700; x < 2700; x += 230) {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(960 + (x - 960) * 2.1, bottom);
    g.stroke();
  }
  g.restore();
}

// ---------- 前景草叶（画好后用 blurLayer 虚化，放在 depth > 1） ----------
export function foregroundGrass(g, { mood = "day", seed = 8, y = 1080, x0 = -260, x1 = 2180 } = {}) {
  const r = mulberry32(seed);
  const cols = { day: ["#3f7a45", "#4f8a4a", "#2f6038"], dusk: ["#55673c", "#647a45", "#43522f"], night: ["#24453a", "#2c5243", "#1d3a31"] }[mood];
  for (let x = x0; x < x1; x += 34 + r() * 40) {
    if (r() < 0.35) continue; // 留空隙，前景不能糊成一整条
    const h = 120 + r() * 240;
    const lean = (r() - 0.5) * 0.6;
    const w = 16 + r() * 22;
    const p = new Path2D();
    p.moveTo(x - w / 2, y + 40);
    p.quadraticCurveTo(x + lean * h * 0.3, y - h * 0.5, x + lean * h, y - h);
    p.quadraticCurveTo(x + lean * h * 0.3 + w * 0.3, y - h * 0.5, x + w / 2, y + 40);
    p.closePath();
    const c = pick(r, cols);
    crayon(g, p, { fill: c, line: darker(c, 0.2), lw: 2, shade: 0.2, hl: 0.1, dir: "v" });
  }
}

// ---------- 楼外墙 + 一扇主窗 ----------
/**
 * 一面大墙：蜡笔竖排线 + 一格格小窗（少数亮灯）+ 窗台盆栽。hole = 主窗的位置（这一格跳过，由 heroWindow 画）
 */
export function facade(g, { x0, y0, x1, y1, color, line, seed = 1, hole = null, lit = 0.15, litColor = "#f2c56b", warm = false }) {
  crayon(g, rect(x0, y0, x1 - x0, y1 - y0), { fill: color, line, lw: 5, shade: 0.28, hl: 0.08, dir: "v" });
  const r = mulberry32(seed);
  // 楼层分隔的横线
  g.save();
  g.strokeStyle = rgba(darker(color, 0.3), 0.45);
  g.lineWidth = 4;
  for (let y = y0 + 150; y < y1; y += 230) {
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1, y + 2);
    g.stroke();
  }
  g.restore();
  for (let y = y0 + 40; y < y1 - 120; y += 230)
    for (let x = x0 + 50; x < x1 - 140; x += 250) {
      const w = 130;
      const h = 150;
      if (hole && x + w > hole.x - 40 && x < hole.x + hole.w + 40 && y + h > hole.y - 40 && y < hole.y + hole.h + 40) continue;
      const on = r() < lit;
      crayon(g, rect(x - 10, y - 10, w + 20, h + 20), { fill: lighter(color, 0.12), line: darker(color, 0.3), lw: 4, shade: 0.2, hl: 0.08 });
      if (on) glow(g, x + w / 2, y + h / 2, w * 1.3, litColor, 0.3);
      crayon(g, rect(x, y, w, h), { fill: on ? litColor : darker(color, warm ? 0.35 : 0.42), line: darker(color, 0.5), lw: 3, shade: 0.18, hl: on ? 0.2 : 0.05, fleck: 0.1 });
      // 窗框十字
      scribble(g, [[x + w / 2, y], [x + w / 2, y + h]], { color: darker(color, 0.45), width: 5, seed: x + y, jitter: 0.6 });
      scribble(g, [[x, y + h * 0.4], [x + w, y + h * 0.4]], { color: darker(color, 0.45), width: 5, seed: x * 3 + y, jitter: 0.6 });
      crayon(g, rect(x - 16, y + h + 6, w + 32, 16), { fill: lighter(color, 0.2), line: darker(color, 0.3), lw: 3, shade: 0.12, hl: 0.1 });
      if (r() < 0.35) pottedPlant(g, x + 26 + r() * 70, y + h + 8, 46, Math.floor(r() * 99));
    }
}

/** 主窗：窗框；inside(g) 画屋里（人物也在这里画）。窗台以下的墙由 windowSill 再画一次，盖住人的下半身 */
export function heroWindow(g, { x, y, w, h, color, frame = "#5f4a3a", inside }) {
  crayon(g, rect(x - 22, y - 22, w + 44, h + 44), { fill: lighter(color, 0.1), line: darker(color, 0.35), lw: 5, shade: 0.2, hl: 0.08 });
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  inside(g);
  g.restore();
  scribble(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], { color: frame, width: 12, seed: x + 1, jitter: 0.8 });
}
export function windowSill(g, { x, y, w, h, color, wallTo = 1400 }) {
  // 窗台以下的墙（盖住人的下半身）+ 窗台板
  crayon(g, rect(x - 22, y + h, w + 44, wallTo - (y + h)), { fill: color, line: darker(color, 0.3), lw: 0, shade: 0.28, hl: 0.08, dir: "v" });
  crayon(g, rrect(x - 40, y + h - 6, w + 80, 30, 6), { fill: lighter(color, 0.25), line: darker(color, 0.35), lw: 4, shade: 0.14, hl: 0.12 });
}
