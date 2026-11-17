// 角色（蜡笔绘本版）：两个示例角色 a、b。造型和配色只是占位，新片按自己的故事重新定。
// 画法：圆头 + 豆子形身体 + 短手短脚；平涂色块 + 内侧同色系深描边 + 彩铅排线 + 白色斜划痕。
// 两种体型：build "shirt"（短发、衬衫、长裤）和 build "dress"（长发、上衣、裙子、袜子）。加角色就在 LOOK 里加一条。
// 设计坐标：脚底中点 (0, 0)，向上为负，身高约 1000。默认 3/4 侧面朝右；flip = 朝左（镜像）。
// 长发角色不画背影（头发会把整个身子盖住，像鬼），转身一律 flip。所有镜头都从这里取角色，造型才前后一致。
import { crayon, darker, lighter, rgba, canvas, pat } from "./crayon.js";

export const LOOK = {
  // 示例角色 a：短发、衬衫、长裤（占位配色）
  a: {
    build: "shirt",
    skin: "#efd3ba", skinLine: "#a87b5c", blush: "#eca49e",
    hair: "#3b2b24", hairHi: "#5c473d",
    top: "#e9c46a", topLine: "#b08a3e",
    bottom: "#56628a", bottomLine: "#363f5e", shoe: "#6b4a36",
  },
  // 示例角色 b：长发、上衣、裙子、袜子；accent 是发箍和领结的颜色（不要可以删掉）
  b: {
    build: "dress",
    skin: "#f2d7c2", skinLine: "#a97d63", blush: "#eea0a0",
    hair: "#2f2522", hairHi: "#514039",
    top: "#9cc5b0", topLine: "#5f8c78",
    bottom: "#e0896b", bottomLine: "#a85b45",
    sock: "#fbf7ef", sockLine: "#bdb3a2", shoe: "#6c3b2f", accent: "#f2c14e",
  },
};

const OL = 8; // 描边宽度（设计单位）

// ---------- 小工具 ----------
const P = () => new Path2D();
function circle(x, y, r) {
  const p = P();
  p.arc(x, y, r, 0, Math.PI * 2);
  return p;
}
function ellipse(x, y, rx, ry, rot = 0) {
  const p = P();
  p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  return p;
}
function rrect(x, y, w, h, r) {
  const p = P();
  p.roundRect(x, y, w, h, r);
  return p;
}
/** 沿二次曲线（起点 a、控制点 c、终点 b）的圆头"管子"：手臂、腿都用它，手肘不会折成硬角 */
export function tube(a, c, b, hw, hw2 = hw) {
  const N = 14;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x;
    const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y;
    pts.push({ x, y, w: hw + (hw2 - hw) * t });
  }
  const nrm = pts.map((p, i) => {
    const q = pts[Math.min(N, i + 1)];
    const o = pts[Math.max(0, i - 1)];
    const dx = q.x - o.x;
    const dy = q.y - o.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: -dy / l, y: dx / l };
  });
  const p = P();
  pts.forEach((q, i) => (i ? p.lineTo : p.moveTo).call(p, q.x + nrm[i].x * q.w, q.y + nrm[i].y * q.w));
  const ne = nrm[N];
  const ae = Math.atan2(ne.y, ne.x);
  p.arc(pts[N].x, pts[N].y, pts[N].w, ae, ae - Math.PI, true);
  for (let i = N; i >= 0; i--) p.lineTo(pts[i].x - nrm[i].x * pts[i].w, pts[i].y - nrm[i].y * pts[i].w);
  const n0 = nrm[0];
  const a0 = Math.atan2(n0.y, n0.x);
  p.arc(pts[0].x, pts[0].y, pts[0].w, a0 + Math.PI, a0, true);
  p.closePath();
  return p;
}
/** 一条胳膊：肩 → 手，手肘处轻轻外弯（控制点 = 中点 + 法线 × bend） */
function arm(s, h, bend) {
  const mx = (s.x + h.x) / 2;
  const my = (s.y + h.y) / 2;
  const dx = h.x - s.x;
  const dy = h.y - s.y;
  const l = Math.hypot(dx, dy) || 1;
  return { s, c: { x: mx - (dy / l) * bend, y: my + (dx / l) * bend }, h };
}
const lerp = (a, b, k) => a + (b - a) * k;
const D2R = Math.PI / 180;
const fromAngle = (o, deg, len) => ({ x: o.x + Math.cos(deg * D2R) * len, y: o.y + Math.sin(deg * D2R) * len });

// ---------- 骨架 ----------
function rig(who, pose) {
  const dress = (LOOK[who] || LOOK.a).build === "dress";
  const { reach = 0, lift = 0, walk = null, promise = 0, wipe = 0, sit = 0, bob = 0 } = pose;
  const step = walk === null ? 0 : Math.sin(walk * Math.PI * 2);
  const hop = walk === null ? 0 : -Math.abs(Math.sin(walk * Math.PI * 2)) * 16;
  const up = -lift * 38 + hop + bob + sit * 170;
  const R = dress ? 198 : 204;
  const head = { x: 10, y: -748 + up, r: R };
  const shN = { x: 104, y: -528 + up };
  const shF = { x: -110, y: -528 + up };
  const L = 214; // 手臂长（短手）

  // 近侧手（画面右边）：垂下 → 伸手够东西 / 勾手指 / 擦眼泪
  let aN = 84 - step * 14;
  aN = lerp(aN, pose.reachAng ?? -56, reach);
  aN = lerp(aN, 6, promise);
  let hN = fromAngle(shN, aN, L);
  const eyeN = { x: head.x + R * 0.5, y: head.y + R * 0.2 };
  if (wipe > 0) hN = { x: lerp(hN.x, eyeN.x + 22, wipe), y: lerp(hN.y, eyeN.y + 26, wipe) };
  // 远侧手（画面左边）
  let hF = fromAngle(shF, 98 + step * 14, L);
  if (sit > 0) {
    hN = { x: lerp(hN.x, 168, sit), y: lerp(hN.y, -330 + up, sit) };
    hF = { x: lerp(hF.x, -40, sit), y: lerp(hF.y, -320 + up, sit) };
  }
  // 直接指定手的位置（设计坐标，会跟着身体上下）：趴在窗台上、扶着东西之类
  if (pose.handN) hN = { x: pose.handN[0], y: pose.handN[1] + up };
  if (pose.handF) hF = { x: pose.handF[0], y: pose.handF[1] + up };
  const armN = arm(shN, hN, wipe > 0 ? -60 : reach > 0.3 ? -26 : 20);
  const armF = arm(shF, hF, -20);

  // 腿：站 / 走 / 踮脚 / 坐
  const hipY = -214 + up;
  const footY = -36;
  const leg = (hx, ang) => {
    const len = footY - hipY;
    return { x: hx + Math.sin(ang) * len, y: hipY + Math.cos(ang) * len };
  };
  let fL = leg(-50, step * 0.3);
  let fR = leg(54, -step * 0.3);
  if (lift > 0 && walk === null) {
    fL = { x: -50, y: footY };
    fR = { x: 54, y: footY };
  }
  if (sit > 0) {
    fL = { x: lerp(fL.x, 40, sit), y: lerp(fL.y, hipY + 6, sit) };
    fR = { x: lerp(fR.x, 118, sit), y: lerp(fR.y, hipY + 6, sit) };
  }
  if (pose.perch) {
    // 坐在床沿：大腿朝前，小腿垂下
    fL = { x: 96, y: hipY + 178 };
    fR = { x: 168, y: hipY + 182 };
  }
  return { dress, R, head, up, shN, shF, armN, armF, hipY, footY, fL, fR, step, lift, sit, perch: !!pose.perch };
}

// ---------- 身体部件 ----------
const tex = (k) => ({ k, fleck: 0.18, hl: 0.12, shade: 0.16 });

function drawLegs(g, r, c, k) {
  const { dress, hipY, fL, fR, lift, sit } = r;
  for (const [hx, f, far] of [[-50, fL, true], [54, fR, false]]) {
    const a = { x: hx, y: hipY };
    const ctl = r.perch ? { x: f.x + 10, y: a.y - 10 } : { x: (a.x + f.x) / 2 + (sit > 0 ? -30 : 0), y: (a.y + f.y) / 2 + (sit > 0 ? 30 : 0) };
    const legPath = tube(a, ctl, f, dress ? 28 : 38, dress ? 26 : 36);
    if (dress) {
      crayon(g, legPath, { fill: c.skin, line: c.skinLine, lw: OL * 0.8, ...tex(k) });
      // 白袜子：腿的下半截
      g.save();
      g.clip(legPath);
      const sock = P();
      sock.rect(f.x - 60, Math.min(a.y, f.y) + Math.abs(f.y - a.y) * 0.55, 120, 400);
      crayon(g, sock, { fill: c.sock, line: c.sockLine, lw: 0, ...tex(k), shade: 0.1 });
      g.restore();
    } else {
      crayon(g, legPath, { fill: far ? darker(c.bottom, 0.12) : c.bottom, line: c.bottomLine, lw: OL, ...tex(k) });
    }
    // 鞋：椭圆，脚尖朝前（右）；踮脚时后跟抬起
    const tip = lift > 0 && sit === 0 ? -16 * D2R * lift : 0;
    const shoe = ellipse(f.x + 18, f.y + 6, 68, 34, tip);
    crayon(g, shoe, { fill: far ? darker(c.shoe, 0.12) : c.shoe, lw: OL, ...tex(k), hl: 0.2 });
  }
}

function drawArm(g, r, c, a, k, front) {
  const sleeve = c.top;
  const sleeveLine = c.topLine;
  // 袖子（上半截）；dress 体型是短袖，下半截露出手臂
  const path = tube(a.s, a.c, a.h, 30, 26);
  crayon(g, path, { fill: front ? sleeve : darker(sleeve, 0.08), line: sleeveLine, lw: OL, ...tex(k) });
  if (r.dress) {
    // 短袖：前半截露出手臂
    g.save();
    g.clip(path);
    const t = 0.45;
    const sx = (1 - t) * (1 - t) * a.s.x + 2 * (1 - t) * t * a.c.x + t * t * a.h.x;
    const sy = (1 - t) * (1 - t) * a.s.y + 2 * (1 - t) * t * a.c.y + t * t * a.h.y;
    const skin = tube({ x: sx, y: sy }, { x: (sx + a.h.x) / 2, y: (sy + a.h.y) / 2 }, a.h, 26, 24);
    crayon(g, skin, { fill: c.skin, line: c.skinLine, lw: OL * 0.8, ...tex(k) });
    g.restore();
  }
  // 手：小圆球
  crayon(g, circle(a.h.x, a.h.y, 40), { fill: c.skin, line: c.skinLine, lw: OL, ...tex(k) });
}

function drawBodyShirt(g, r, c, k, back) {
  const { up } = r;
  // 裤腰一截
  crayon(g, rrect(-122, -318 + up, 244, 114, 46), { fill: c.bottom, line: c.bottomLine, lw: OL, ...tex(k) });
  // 衬衫：豆子形
  const shirt = rrect(-142, -584 + up, 284, 290, [100, 100, 66, 66]);
  crayon(g, shirt, { fill: c.top, line: c.topLine, lw: OL, ...tex(k), shade: 0.14 });
  if (back) return;
  // 领子：两片小三角
  for (const s of [-1, 1]) {
    const p = P();
    p.moveTo(14, -560 + up);
    p.lineTo(14 + s * 74, -590 + up);
    p.quadraticCurveTo(14 + s * 66, -530 + up, 14 + s * 10, -500 + up);
    p.closePath();
    crayon(g, p, { fill: lighter(c.top, 0.3), line: c.topLine, lw: OL * 0.8, ...tex(k), shade: 0.08 });
  }
  // 纽扣
  g.save();
  g.fillStyle = c.topLine;
  for (const y of [-470, -415, -360]) {
    g.beginPath();
    g.arc(16, y + up, 7, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function drawBodyDress(g, r, c, k) {
  const { up } = r;
  // A 字裙
  const skirt = P();
  skirt.moveTo(-104, -420 + up);
  skirt.lineTo(110, -420 + up);
  skirt.quadraticCurveTo(170, -330 + up, 186, -238 + up);
  skirt.quadraticCurveTo(10, -210 + up, -172, -238 + up);
  skirt.quadraticCurveTo(-160, -330 + up, -104, -420 + up);
  skirt.closePath();
  crayon(g, skirt, { fill: c.bottom, line: c.bottomLine, lw: OL, ...tex(k) });
  // 裙褶：几道深色竖线
  g.save();
  g.clip(skirt);
  g.strokeStyle = rgba(c.bottomLine, 0.55);
  g.lineWidth = 6;
  g.lineCap = "round";
  for (const x of [-70, 0, 70]) {
    g.beginPath();
    g.moveTo(x * 0.7 + 5, -400 + up);
    g.lineTo(x * 1.25 + 5, -236 + up);
    g.stroke();
  }
  g.restore();
  // 上衣：圆肩
  const top = rrect(-120, -584 + up, 240, 186, [90, 90, 30, 30]);
  crayon(g, top, { fill: c.top, line: c.topLine, lw: OL, ...tex(k), shade: 0.12 });
  // 圆领：两片圆角领 + 小领结（accent 颜色）
  for (const s of [-1, 1]) {
    const p = P();
    p.moveTo(14, -566 + up);
    p.quadraticCurveTo(14 + s * 84, -586 + up, 14 + s * 70, -528 + up);
    p.quadraticCurveTo(14 + s * 40, -506 + up, 14, -540 + up);
    p.closePath();
    crayon(g, p, { fill: lighter(c.top, 0.35), line: c.topLine, lw: OL * 0.7, ...tex(k), shade: 0.06 });
  }
  const bow = P();
  bow.moveTo(14, -545 + up);
  bow.lineTo(-14, -562 + up);
  bow.lineTo(-14, -530 + up);
  bow.closePath();
  bow.moveTo(14, -545 + up);
  bow.lineTo(42, -562 + up);
  bow.lineTo(42, -530 + up);
  bow.closePath();
  if (c.accent) crayon(g, bow, { fill: c.accent, lw: OL * 0.5, ...tex(k), shade: 0.1 });
}

// ---------- 头 ----------
function shortHairPath(h) {
  const { x, y, r } = h;
  const p = P();
  p.moveTo(x - r * 0.9, y + r * 0.34);
  p.arc(x, y - r * 0.02, r * 1.07, Math.PI * 0.93, Math.PI * 2.03);
  // 右边一片刘海：从鬓角往上扫到发缝
  p.bezierCurveTo(x + r * 0.92, y - r * 0.1, x + r * 0.64, y - r * 0.2, x + r * 0.44, y - r * 0.38);
  p.quadraticCurveTo(x + r * 0.32, y - r * 0.5, x + r * 0.22, y - r * 0.72);
  // 中分：发缝在这里，左边一片刘海往左下扫
  p.quadraticCurveTo(x + r * 0.05, y - r * 0.46, x - r * 0.3, y - r * 0.32);
  p.bezierCurveTo(x - r * 0.55, y - r * 0.22, x - r * 0.68, y - r * 0.08, x - r * 0.76, y + r * 0.06);
  p.lineTo(x - r * 0.8, y + r * 0.34);
  p.closePath();
  return p;
}
/** 发缝：从刘海分开处往头顶的一道浅线 */
function partLine(g, h) {
  const { x, y, r } = h;
  g.save();
  g.strokeStyle = "rgba(120,100,92,0.55)";
  g.lineWidth = r * 0.03;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x + r * 0.22, y - r * 0.74);
  g.quadraticCurveTo(x + r * 0.16, y - r * 0.92, x + r * 0.06, y - r * 1.04);
  g.stroke();
  g.restore();
}
function longHairBackPath(h) {
  const { x, y, r } = h;
  const p = P();
  p.moveTo(x - r * 1.1, y - r * 0.1);
  p.bezierCurveTo(x - r * 1.18, y + r * 0.8, x - r * 1.16, y + r * 1.5, x - r * 1.08, y + r * 2.0);
  p.quadraticCurveTo(x - r * 0.1, y + r * 2.12, x + r * 0.92, y + r * 1.86);
  p.bezierCurveTo(x + r * 1.08, y + r * 1.2, x + r * 1.12, y + r * 0.6, x + r * 1.06, y - r * 0.1);
  p.arc(x, y - r * 0.04, r * 1.07, Math.PI * 2 - 0.05, Math.PI + 0.05, true);
  p.closePath();
  return p;
}
function longHairFrontPath(h) {
  const { x, y, r } = h;
  const p = P();
  p.moveTo(x - r * 1.08, y + r * 0.2);
  p.arc(x, y - r * 0.04, r * 1.09, Math.PI * 0.94, Math.PI * 2.03);
  // 近侧（右）细细一缕，贴着脸颊垂下
  p.quadraticCurveTo(x + r * 1.08, y + r * 0.5, x + r * 0.98, y + r * 0.92);
  p.quadraticCurveTo(x + r * 0.86, y + r * 0.5, x + r * 0.82, y - r * 0.2);
  // 齐刘海：一条平平的边，带三个浅浅的弧
  const bx = [x + r * 0.82, x + r * 0.36, x - r * 0.08, x - r * 0.52];
  for (let i = 0; i < 3; i++) p.quadraticCurveTo((bx[i] + bx[i + 1]) / 2, y - r * 0.12, bx[i + 1], y - r * 0.22);
  // 远侧（左）长长一缕，把那半边脸框住
  p.quadraticCurveTo(x - r * 0.74, y + r * 0.3, x - r * 0.84, y + r * 1.0);
  p.quadraticCurveTo(x - r * 1.04, y + r * 0.7, x - r * 1.08, y + r * 0.2);
  p.closePath();
  return p;
}

const FACES = {
  neutral: { brow: 0, mouth: "flat" },
  sad: { brow: 1, mouth: "frown" },
  worry: { brow: 1, mouth: "wavy" },
  cry: { brow: 1.2, mouth: "wavy" },
  smile: { brow: -0.4, mouth: "smile" },
  happy: { brow: -0.5, mouth: "open", eyes: "happy" },
  shy: { brow: 0.3, mouth: "small", blush: 1.7 },
  surprise: { brow: -1, mouth: "o" },
  sing: { brow: -0.2, mouth: "o" },
};

function drawFace(g, r, c, pose, k) {
  const { head } = r;
  const { x, y, r: R } = head;
  const f = FACES[pose.mood || "neutral"] || FACES.neutral;
  const gx = (pose.gaze?.[0] || 0) * R * 0.05;
  const gy = (pose.gaze?.[1] || 0) * R * 0.05;
  const eyes = [
    { x: x + R * 0.02, y: y + R * 0.16, s: 0.88 }, // 远侧眼（画面左）
    { x: x + R * 0.5, y: y + R * 0.16, s: 1 }, // 近侧眼
  ];
  const ink = "#2a211e";
  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";

  // 腮红
  const blushK = f.blush || 1;
  g.fillStyle = rgba(c.blush, Math.min(1, 0.62 * blushK));
  g.beginPath();
  g.ellipse(x + R * 0.8, y + R * 0.42, R * 0.15 * Math.min(1.4, blushK), R * 0.09 * Math.min(1.4, blushK), 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = rgba(c.blush, Math.min(1, 0.4 * blushK));
  g.beginPath();
  g.ellipse(x - R * 0.28, y + R * 0.42, R * 0.1, R * 0.07, 0, 0, Math.PI * 2);
  g.fill();

  // 眼睛
  const blink = pose.blink || 0;
  for (const e of eyes) {
    const ex = e.x + gx;
    const ey = e.y + gy;
    const rx = R * 0.085 * e.s;
    const ry = R * 0.115;
    if (f.eyes === "happy" || blink > 0.5) {
      g.strokeStyle = ink;
      g.lineWidth = R * 0.045;
      g.beginPath();
      if (f.eyes === "happy") g.arc(ex, ey + ry * 0.4, rx * 1.2, 1.15 * Math.PI, 1.85 * Math.PI);
      else g.arc(ex, ey - ry * 0.2, rx * 1.15, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
    } else {
      g.fillStyle = ink;
      g.beginPath();
      g.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      const lid = pose.lid || 0;
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(ex + rx * 0.32, ey - ry * 0.38, rx * 0.42, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(ex - rx * 0.36, ey + ry * 0.38, rx * 0.2, 0, Math.PI * 2);
      g.fill();
      if (lid > 0) {
        // 眼皮往下盖（困、没精神）
        g.fillStyle = c.skin;
        g.fillRect(ex - rx * 1.4, ey - ry * 1.3, rx * 2.8, ry * (0.3 + 1.6 * lid));
        g.strokeStyle = ink;
        g.lineWidth = R * 0.03;
        g.beginPath();
        g.moveTo(ex - rx * 1.15, ey - ry * 1.0 + ry * 1.6 * lid);
        g.lineTo(ex + rx * 1.15, ey - ry * 1.0 + ry * 1.6 * lid);
        g.stroke();
      }
      if (r.dress) {
        // 睫毛：眼角两根
        g.strokeStyle = ink;
        g.lineWidth = R * 0.025;
        for (const d of [0, 1]) {
          g.beginPath();
          g.moveTo(ex + rx * 0.7, ey - ry * 0.7 + d * ry * 0.3);
          g.lineTo(ex + rx * 1.45, ey - ry * 1.05 + d * ry * 0.35);
          g.stroke();
        }
      }
    }
  }

  // 眉毛：粗短；发愁时里端（靠近脸中线那头）往上，旁边一道浅色重影
  const b = f.brow;
  const browLen = R * 0.21;
  eyes.forEach((e, i) => {
    const bx = e.x;
    const by = e.y - R * 0.25 - (b < 0 ? -b * R * 0.06 : 0);
    const inner = i === 0 ? 1 : -1; // 里端方向
    const lift = b > 0 ? b * R * 0.07 : 0;
    const x0 = bx - (browLen / 2) * inner;
    const x1 = bx + (browLen / 2) * inner;
    if (b > 0.5) {
      g.strokeStyle = rgba(c.skinLine, 0.7);
      g.lineWidth = R * 0.035;
      g.beginPath();
      g.moveTo(x0, by + R * 0.07);
      g.lineTo(x1, by + R * 0.07 - lift * 0.8);
      g.stroke();
    }
    g.strokeStyle = ink;
    g.lineWidth = R * 0.055;
    g.beginPath();
    g.moveTo(x0, by + lift * 0.3);
    g.quadraticCurveTo((x0 + x1) / 2, by - R * 0.03, x1, by - lift);
    g.stroke();
  });

  // 嘴
  const mx = x + R * 0.27;
  const my = y + R * 0.5;
  g.strokeStyle = "#7a3e33";
  g.lineWidth = R * 0.04;
  g.beginPath();
  switch (f.mouth) {
    case "smile":
      g.arc(mx, my - R * 0.06, R * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
      break;
    case "small":
      g.arc(mx, my - R * 0.04, R * 0.06, 0.2 * Math.PI, 0.8 * Math.PI);
      g.stroke();
      break;
    case "open": {
      g.fillStyle = "#8b3f37";
      g.moveTo(mx - R * 0.1, my - R * 0.03);
      g.quadraticCurveTo(mx, my + R * 0.16, mx + R * 0.1, my - R * 0.03);
      g.closePath();
      g.fill();
      break;
    }
    case "frown":
      g.arc(mx, my + R * 0.07, R * 0.08, 1.2 * Math.PI, 1.8 * Math.PI);
      g.stroke();
      break;
    case "wavy": {
      const w = R * 0.2;
      g.moveTo(mx - w / 2, my);
      for (let i = 1; i <= 4; i++) g.quadraticCurveTo(mx - w / 2 + (i - 0.5) * (w / 4), my + (i % 2 ? -1 : 1) * R * 0.04, mx - w / 2 + i * (w / 4), my);
      g.stroke();
      break;
    }
    case "o":
      g.fillStyle = "#8b3f37";
      g.ellipse(mx, my, R * 0.045, R * 0.06, 0, 0, Math.PI * 2);
      g.fill();
      break;
    default:
      g.moveTo(mx - R * 0.07, my);
      g.lineTo(mx + R * 0.07, my);
      g.stroke();
  }

  // 眼泪：一颗淡蓝色的大泪珠慢慢变大（tear 0–1），fall 时顺着脸颊滑下
  const tear = pose.tear || 0;
  if (tear > 0) {
    const e = eyes[1];
    const fall = pose.tearFall || 0;
    const tr = R * (0.03 + 0.085 * tear);
    const tx = e.x + R * 0.04;
    const ty = e.y + R * 0.14 + tr * 0.6 + fall * R * 0.5;
    g.globalAlpha = 1 - fall * 0.6;
    g.fillStyle = rgba("#97bbd9", 0.92);
    g.strokeStyle = "#6f94b8";
    g.lineWidth = R * 0.018;
    g.beginPath();
    g.moveTo(tx, ty - tr * 1.6);
    g.bezierCurveTo(tx + tr * 0.9, ty - tr * 0.6, tx + tr, ty + tr * 0.9, tx, ty + tr);
    g.bezierCurveTo(tx - tr, ty + tr * 0.9, tx - tr * 0.9, ty - tr * 0.6, tx, ty - tr * 1.6);
    g.fill();
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.beginPath();
    g.arc(tx - tr * 0.3, ty, tr * 0.28, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    if (pose.cheekTears) {
      // 两道泪痕
      g.strokeStyle = rgba("#a9c8e2", 0.8);
      g.lineWidth = R * 0.03;
      for (const ee of eyes) {
        g.beginPath();
        g.moveTo(ee.x + R * 0.02, ee.y + R * 0.13);
        g.quadraticCurveTo(ee.x + R * 0.05, ee.y + R * 0.3, ee.x + R * 0.0, ee.y + R * 0.46);
        g.stroke();
      }
    }
  }
  g.restore();
}

function drawHead(g, r, c, pose, k, back) {
  const { head } = r;
  const { x, y, r: R } = head;
  const tilt = (pose.tilt || 0) * 0.35;
  g.save();
  g.translate(x, y + R * 0.9);
  g.rotate(tilt);
  g.translate(-x, -(y + R * 0.9));
  if (r.dress) {
    // 长发：脸 → 五官 → 前发（刘海、两缕）→ 发箍
    crayon(g, circle(x, y, R), { fill: c.skin, line: c.skinLine, lw: OL, ...tex(k), shade: 0.1 });
    drawFace(g, r, c, pose, k);
    crayon(g, longHairFrontPath(head), { fill: c.hair, line: c.hairHi, lw: OL * 0.6, ...tex(k), shade: 0.1, hl: 0.12 });
    hairShine(g, head, k);
    if (c.accent) {
      const band = rrect(x + R * 0.42, y - R * 0.5, R * 0.3, R * 0.11, R * 0.05);
      g.save();
      g.translate(x + R * 0.57, y - R * 0.45);
      g.rotate(-0.35);
      g.translate(-(x + R * 0.57), -(y + -R * 0.45));
      crayon(g, band, { fill: c.accent, lw: OL * 0.5, ...tex(k), shade: 0.1 });
      g.restore();
    }
  } else if (back) {
    // 短发角色的背影：两只耳朵 + 整个后脑勺都是头发
    for (const s of [-1, 1]) crayon(g, circle(x + s * R * 0.94, y + R * 0.15, R * 0.16), { fill: c.skin, line: c.skinLine, lw: OL * 0.8, ...tex(k) });
    crayon(g, circle(x, y, R), { fill: c.skin, line: c.skinLine, lw: OL, ...tex(k) });
    const cap = P();
    cap.arc(x, y - R * 0.02, R * 1.07, Math.PI * 0.86, Math.PI * 2.14);
    cap.quadraticCurveTo(x, y + R * 0.92, x - R * 1.0, y + R * 0.38);
    cap.closePath();
    crayon(g, cap, { fill: c.hair, line: c.hairHi, lw: OL * 0.6, ...tex(k), shade: 0.1, hl: 0.12 });
    hairShine(g, head, k);
  } else {
    // 短发：耳朵 → 脸 → 五官 → 中分短发
    crayon(g, circle(x - R * 0.86, y + R * 0.14, R * 0.17), { fill: c.skin, line: c.skinLine, lw: OL * 0.8, ...tex(k) });
    crayon(g, circle(x, y, R), { fill: c.skin, line: c.skinLine, lw: OL, ...tex(k), shade: 0.1 });
    drawFace(g, r, c, pose, k);
    crayon(g, shortHairPath(head), { fill: c.hair, line: c.hairHi, lw: OL * 0.6, ...tex(k), shade: 0.1, hl: 0.12 });
    hairShine(g, head, k);
    partLine(g, head);
  }
  if (pose.onHead) pose.onHead(g, head, k, back); // 挂点：帽子、发饰（跟着头歪）
  g.restore();
}

/** 头发上一道浅色反光弧 */
function hairShine(g, head, k) {
  const { x, y, r: R } = head;
  g.save();
  g.strokeStyle = "rgba(255,240,225,0.22)";
  g.lineWidth = R * 0.06;
  g.lineCap = "round";
  g.beginPath();
  g.arc(x, y - R * 0.05, R * 0.82, Math.PI * 1.18, Math.PI * 1.42);
  g.stroke();
  g.restore();
}

// ---------- 对外接口 ----------
let LAYER = null;
// 角色先画在一张离屏画布上，BOX 是这张画布的范围（设计坐标），要包住所有姿势：
// 坐着（sit + perch）时身体下沉 170、小腿垂下来，鞋底到 y ≈ 190，y1 太小会把小腿和鞋切掉。
const BOX = { x0: -470, x1: 600, y0: -1130, y1: 220 };

/**
 * 在 ctx 上画一个角色。x, y = 脚底中点；h = 身高（像素，设计稿 1000 → h）。
 * pose: { mood, gaze:[x,y], blink, lid(眼皮), tilt(头歪), lean(上身前倾), reach, reachAng, lift, walk(相位), promise, wipe, sit, bob,
 *         handN/handF:[x,y], hold, tear, tearFall, cheekTears, flip, view:"back", shadow, scratch }
 * who：LOOK 里的角色名（示例是 "a"、"b"）。hold：(ctx, x, y) => 在近侧手的位置画道具（设计坐标，跟着角色缩放、镜像）。
 * view:"back" 只对短发（shirt）体型有效。
 */
export function drawPerson(ctx, who, x, y, h, pose = {}) {
  const c = LOOK[who] || LOOK.a;
  const s = h / 1000;
  const k = 1 / s;
  const lw = Math.ceil((BOX.x1 - BOX.x0) * s) + 4;
  const lh = Math.ceil((BOX.y1 - BOX.y0) * s) + 4;
  if (!LAYER || LAYER.width < lw || LAYER.height < lh) LAYER = canvas(Math.max(lw, LAYER?.width || 0), Math.max(lh, LAYER?.height || 0));
  const g = LAYER.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.clearRect(0, 0, lw + 2, lh + 2);
  const flip = !!pose.flip;
  g.setTransform(flip ? -s : s, 0, 0, s, flip ? BOX.x1 * s + 2 : -BOX.x0 * s + 2, -BOX.y0 * s + 2);

  const r = rig(who, pose);
  if (pose.out) {
    // 把近侧手、头的位置换算到画布坐标，交给镜头去画大道具（道具太大放进角色画布会被 BOX 切掉）
    const sx = flip ? -s : s;
    pose.out.hand = { x: x + sx * r.armN.h.x, y: y + s * r.armN.h.y };
    pose.out.head = { x: x + sx * r.head.x, y: y + s * r.head.y, r: s * r.head.r };
  }
  const back = pose.view === "back" && !r.dress;

  drawLegs(g, r, c, k);
  // 上半身可以整体前倾（lean，弧度，正数 = 往面朝的方向倾）
  g.save();
  g.translate(0, r.hipY);
  g.rotate(pose.lean || 0);
  g.translate(0, -r.hipY);
  if (r.dress) crayon(g, longHairBackPath(r.head), { fill: c.hair, line: c.hairHi, lw: OL * 0.6, ...tex(k), shade: 0.12, hl: 0.1 });
  if (!back) drawArm(g, r, c, r.armF, k, false);
  if (r.dress) drawBodyDress(g, r, c, k);
  else drawBodyShirt(g, r, c, k, back);
  if (pose.onBody) pose.onBody(g, r, k, back); // 挂点：围巾、背包（画在头和近侧手臂下面）
  if (back) drawArm(g, r, c, r.armF, k, true);
  drawHead(g, r, c, pose, k, back);
  drawArm(g, r, c, r.armN, k, true);
  if (pose.hold) pose.hold(g, r.armN.h.x, r.armN.h.y);
  g.restore();

  // 整个角色再叠一层：白色斜划痕 + 纸纹亮点（只落在角色身上）
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.globalAlpha = pose.scratch ?? 0.3;
  g.fillStyle = pat(g, "scratch");
  g.fillRect(0, 0, lw, lh);
  g.globalAlpha = 0.1;
  g.fillStyle = pat(g, "tooth");
  g.fillRect(0, 0, lw, lh);
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;

  // 地上的软影子
  if (pose.shadow !== false) {
    ctx.save();
    const sh = ctx.createRadialGradient(x, y, 0, x, y, h * 0.26);
    sh.addColorStop(0, "rgba(22,16,40,0.32)");
    sh.addColorStop(1, "rgba(22,16,40,0)");
    ctx.fillStyle = sh;
    ctx.translate(x, y);
    ctx.scale(1, 0.16);
    ctx.translate(-x, -y);
    ctx.fillRect(x - h * 0.3, y - h * 0.3, h * 0.6, h * 0.6);
    ctx.restore();
  }
  const dx = flip ? x - BOX.x1 * s - 2 : x + BOX.x0 * s - 2;
  const dy = y + BOX.y0 * s - 2;
  ctx.drawImage(LAYER, 0, 0, lw, lh, dx, dy, lw, lh);
}
