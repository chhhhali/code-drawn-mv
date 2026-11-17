// 角色（纸艺立体书版）：两个示例角色 a、b。造型和配色只是占位，新片按自己的故事重新定。
// Q 版大头纸片人：深色描边 + 白色模切边。两种体型：build "shirt"（短发、衬衫、长裤）、build "dress"（长发、上衣、裙子、袜子）。
// 设计稿坐标 600×900，绘制时缩放到任意画布。默认朝右（3/4 侧面）；朝左用 flip（镜像）。长发角色不画背影，转身一律镜像。
// 所有镜头都从这里取角色，保证造型前后一致。加角色就在 PALETTES 里加一条。
import { PAPER_WHITE } from "./paper.js";

export const PALETTES = {
  // 示例角色 a：短发、衬衫、长裤（占位配色）
  a: {
    build: "shirt",
    outline: "#3a2d29", skin: "#f3d5c0", blush: "rgba(226,132,120,0.28)",
    hair: "#3a2b25", hairHi: "#5a463e",
    top: "#e8c56f", topShade: "#cfa955", bottom: "#5a6788", shoe: "#5a3e30",
  },
  // 示例角色 b：长发、上衣、裙子、袜子；accent 是发箍和领结的颜色
  b: {
    build: "dress",
    outline: "#3a2d29", skin: "#f6dccb", blush: "rgba(232,128,122,0.38)",
    hair: "#2d221f", hairHi: "#4e3d38",
    top: "#a9cbb8", topShade: "#8fb39f", bottom: "#e39478", bottomShade: "#c47660",
    sock: "#fbf8f1", shoe: "#6b3a2e", accent: "#f2c14e",
  },
};
const look = (who) => PALETTES[who] || PALETTES.a;

const OL = 6; // 描边宽度（设计稿像素）
const mix = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

// ---------- 骨架 ----------
function rig(who, pose) {
  const { reach = 0, lift = 0, tilt = 0, sit = 0, walk = null } = pose;
  const dress = look(who).build === "dress";
  const bob = walk === null ? 0 : -Math.abs(Math.sin(walk * Math.PI * 2)) * 8;
  const by = -lift * 26 + sit * 84 + bob;
  const footY = 868;
  const hip = 704 + by;
  const head = { x: 292, y: 318 + by, r: 150 };
  const neck = { x: 300, y: 474 + by };
  const sR = { x: dress ? 356 : 366, y: 548 + by };
  const sL = { x: dress ? 246 : 240, y: 552 + by };

  // 近侧手（画面右边那只）：可以伸向右上
  const a = Math.PI / 2 + (-0.78 - Math.PI / 2) * reach;
  const bend = 0.2 * Math.sin(Math.PI * Math.min(1, Math.max(0, reach)));
  let eR = { x: sR.x + Math.cos(a - bend) * 66, y: sR.y + Math.sin(a - bend) * 66 };
  let hR = { x: eR.x + Math.cos(a + bend * 0.6) * 64, y: eR.y + Math.sin(a + bend * 0.6) * 64 };
  const reachDir = a + bend * 0.6;
  let eL = { x: sL.x - 14, y: sL.y + 64 };
  let hL = { x: sL.x - 16, y: sL.y + 128 };

  // 坐：大腿朝前，小腿垂下，双手搭膝
  const kx = 96 * sit;
  const kneeL = { x: 268 + kx, y: hip + 4 };
  const kneeR = { x: 334 + kx, y: hip + 4 };
  if (sit > 0) {
    hL = mix(hL, { x: sL.x + 48, y: hip - 22 }, sit);
    eL = mix(eL, { x: (sL.x + hL.x) / 2 - 18, y: (sL.y + hL.y) / 2 + 4 }, sit);
    hR = mix(hR, { x: sR.x + 36, y: hip - 26 }, sit);
    eR = mix(eR, { x: (sR.x + hR.x) / 2 + 16, y: (sR.y + hR.y) / 2 + 6 }, sit);
  }

  // 腿：站 / 坐 / 走
  let legL = [{ x: 268, y: hip }, { x: 266, y: footY - 16 }];
  let legR = [{ x: 334, y: hip }, { x: 338, y: footY - 16 }];
  let footL = { x: 262, y: footY - 4 };
  let footR = { x: 350, y: footY - 4 };
  if (sit > 0) {
    legL = [{ x: 268, y: hip }, kneeL, { x: kneeL.x, y: footY - 16 }];
    legR = [{ x: 334, y: hip }, kneeR, { x: kneeR.x, y: footY - 16 }];
    footL = { x: 262 + kx + 6, y: footY - 4 };
    footR = { x: 350 + kx + 6, y: footY - 4 };
  } else if (walk !== null) {
    const s = Math.sin(walk * Math.PI * 2) * 0.38;
    const leg = (hx, ang) => {
      const len = footY - 16 - hip;
      return { x: hx + Math.sin(ang) * len, y: hip + Math.cos(ang) * len };
    };
    const fl = leg(268, s);
    const fr = leg(334, -s);
    legL = [{ x: 268, y: hip }, fl];
    legR = [{ x: 334, y: hip }, fr];
    footL = { x: fl.x - 4, y: fl.y + 12 };
    footR = { x: fr.x + 12, y: fr.y + 12 };
    // 走路时手臂前后摆
    hL = { x: sL.x - 16 - s * 48, y: sL.y + 124 };
    eL = { x: sL.x - 14 - s * 24, y: sL.y + 62 };
    hR = { x: sR.x + 6 + s * 48, y: sR.y + 124 };
    eR = { x: sR.x + 4 + s * 24, y: sR.y + 62 };
  }

  return { by, footY, hip, head, neck, sR, sL, eR, hR, eL, hL, tilt, reach, reachDir, legL, legR, footL, footR };
}

// ---------- 小工具 ----------
const circle = (c, r) => {
  const p = new Path2D();
  p.arc(c.x, c.y, r, 0, Math.PI * 2);
  return p;
};
const ellipse = (c, rx, ry, rot = 0) => {
  const p = new Path2D();
  p.ellipse(c.x, c.y, rx, ry, rot, 0, Math.PI * 2);
  return p;
};
// 三点（肩-肘-手）→ 经过手肘的二次曲线：控制点 = 2·肘 − (肩+手)/2
const arc3 = ([a, e, b]) => {
  const p = new Path2D();
  p.moveTo(a.x, a.y);
  p.quadraticCurveTo(2 * e.x - (a.x + b.x) / 2, 2 * e.y - (a.y + b.y) / 2, b.x, b.y);
  return p;
};
const polyline = (pts) => {
  const p = new Path2D();
  p.moveTo(pts[0].x, pts[0].y);
  for (const q of pts.slice(1)) p.lineTo(q.x, q.y);
  return p;
};

// ---------- 头发 ----------
function shortHair(h) {
  const { x, y, r } = h;
  const p = new Path2D();
  p.moveTo(x - r * 1.0, y + r * 0.3);
  p.bezierCurveTo(x - r * 1.14, y - r * 0.62, x - r * 0.52, y - r * 1.16, x + r * 0.08, y - r * 1.07);
  p.bezierCurveTo(x + r * 0.66, y - r * 1.0, x + r * 1.04, y - r * 0.6, x + r * 1.0, y - r * 0.14);
  p.bezierCurveTo(x + r * 0.8, y - r * 0.4, x + r * 0.5, y - r * 0.5, x + r * 0.22, y - r * 0.36);
  p.bezierCurveTo(x + r * 0.0, y - r * 0.56, x - r * 0.3, y - r * 0.42, x - r * 0.44, y - r * 0.02);
  p.bezierCurveTo(x - r * 0.56, y + r * 0.2, x - r * 0.76, y + r * 0.4, x - r * 1.0, y + r * 0.3);
  p.closePath();
  return p;
}
function longHairBack(h) {
  // 披到背中间的长直发（画在身体后面）
  const { x, y, r } = h;
  const p = new Path2D();
  p.moveTo(x - r * 0.9, y - r * 0.5);
  p.bezierCurveTo(x - r * 1.2, y + r * 0.4, x - r * 1.12, y + r * 1.4, x - r * 1.0, y + r * 2.2);
  p.quadraticCurveTo(x - r * 0.78, y + r * 2.34, x - r * 0.5, y + r * 2.24);
  p.quadraticCurveTo(x - r * 0.15, y + r * 2.34, x + r * 0.35, y + r * 2.12);
  p.bezierCurveTo(x + r * 0.5, y + r * 1.4, x + r * 0.95, y + r * 0.9, x + r * 0.96, y + r * 0.2);
  p.bezierCurveTo(x + r * 1.0, y - r * 0.8, x - r * 0.2, y - r * 1.25, x - r * 0.9, y - r * 0.5);
  p.closePath();
  return p;
}
function longHairFront(h) {
  // 头顶 + 齐刘海 + 盖住耳朵垂到肩前的一缕
  const { x, y, r } = h;
  const p = new Path2D();
  p.moveTo(x - r * 1.04, y + r * 0.9);
  p.bezierCurveTo(x - r * 1.16, y - r * 0.4, x - r * 0.62, y - r * 1.14, x + r * 0.1, y - r * 1.08);
  p.bezierCurveTo(x + r * 0.7, y - r * 1.02, x + r * 1.06, y - r * 0.56, x + r * 1.02, y - r * 0.06);
  // 齐刘海：平顺的一刀切，带两个小缺口
  p.lineTo(x + r * 0.94, y - r * 0.2);
  p.quadraticCurveTo(x + r * 0.62, y - r * 0.15, x + r * 0.32, y - r * 0.19);
  p.lineTo(x + r * 0.27, y - r * 0.11);
  p.lineTo(x + r * 0.2, y - r * 0.2);
  p.quadraticCurveTo(x - r * 0.05, y - r * 0.22, x - r * 0.22, y - r * 0.18);
  p.lineTo(x - r * 0.27, y - r * 0.1);
  p.lineTo(x - r * 0.34, y - r * 0.19);
  p.quadraticCurveTo(x - r * 0.46, y - r * 0.2, x - r * 0.52, y - r * 0.14);
  // 盖住耳朵的那缕
  p.bezierCurveTo(x - r * 0.6, y + r * 0.3, x - r * 0.62, y + r * 0.8, x - r * 0.72, y + r * 1.15);
  p.closePath();
  return p;
}
function backHair(dress, h) {
  const { x, y, r } = h;
  const p = new Path2D();
  if (dress) {
    p.moveTo(x - r * 1.0, y - r * 0.1);
    p.bezierCurveTo(x - r * 1.02, y - r * 1.16, x + r * 1.02, y - r * 1.16, x + r * 1.0, y - r * 0.1);
    p.bezierCurveTo(x + r * 1.1, y + r * 0.9, x + r * 0.98, y + r * 1.7, x + r * 0.86, y + r * 2.18);
    p.quadraticCurveTo(x + r * 0.5, y + r * 2.32, x + r * 0.2, y + r * 2.2);
    p.quadraticCurveTo(x - r * 0.15, y + r * 2.34, x - r * 0.45, y + r * 2.2);
    p.quadraticCurveTo(x - r * 0.7, y + r * 2.3, x - r * 0.86, y + r * 2.18);
    p.bezierCurveTo(x - r * 0.98, y + r * 1.7, x - r * 1.1, y + r * 0.9, x - r * 1.0, y - r * 0.1);
    p.closePath();
  } else {
    p.arc(x, y, r * 1.02, Math.PI * 0.92, Math.PI * 2.08);
    p.bezierCurveTo(x + r * 0.9, y + r * 0.6, x - r * 0.9, y + r * 0.6, x - r * 1.0, y + r * 0.25);
    p.closePath();
  }
  return p;
}

// ---------- 脸（朝右的 3/4 侧脸） ----------
function face(ctx, who, h, pose) {
  const P = look(who);
  const mood = pose.mood || "neutral";
  const gy = (pose.gaze || 0) * h.r * 0.14;
  const eyes = [
    { x: h.x + h.r * 0.32, y: h.y - h.r * 0.02 + gy, s: 1 },
    { x: h.x + h.r * 0.72, y: h.y - h.r * 0.08 + gy, s: 0.86 },
  ];
  const blink = pose.blink || 0;
  ctx.lineCap = "round";
  // 腮红
  ctx.fillStyle = P.blush;
  const blushK = mood === "shy" ? 1.7 : mood === "smile" ? 1.25 : 1;
  ctx.beginPath();
  ctx.ellipse(h.x + h.r * 0.3, h.y + h.r * 0.36, 26 * blushK, 14 * blushK, 0, 0, Math.PI * 2);
  ctx.fill();
  if (mood === "shy") {
    ctx.beginPath();
    ctx.ellipse(h.x + h.r * 0.78, h.y + h.r * 0.3, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 眼睛
  ctx.fillStyle = P.outline;
  ctx.strokeStyle = P.outline;
  for (const e of eyes) {
    if (mood === "smile" || mood === "shy") {
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y + 6 * e.s, 10 * e.s, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      continue;
    }
    const big = mood === "surprise" ? 1.3 : 1;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, 9.5 * e.s * big, Math.max(2, 15 * e.s * big * (1 - blink)), 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink < 0.5) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(e.x + 3.5 * e.s, e.y - 7 * e.s, 3.2 * e.s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = P.outline;
    }
    if (P.build === "dress" && blink < 0.5) {
      // 睫毛
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(e.x + 8 * e.s, e.y - 12 * e.s);
      ctx.lineTo(e.x + 16 * e.s, e.y - 18 * e.s);
      ctx.stroke();
    }
  }
  // 眼泪
  if (mood === "cry") {
    ctx.fillStyle = "rgba(150,196,232,0.95)";
    for (const e of eyes) {
      ctx.beginPath();
      ctx.moveTo(e.x - 2, e.y + 16);
      ctx.quadraticCurveTo(e.x - 9, e.y + 32, e.x - 2, e.y + 38);
      ctx.quadraticCurveTo(e.x + 6, e.y + 32, e.x - 2, e.y + 16);
      ctx.fill();
    }
  }
  // 眉毛
  ctx.lineWidth = 5;
  const [e1, e2] = eyes;
  ctx.beginPath();
  if (mood === "sad" || mood === "cry") {
    ctx.moveTo(e1.x - 20, e1.y - 26);
    ctx.lineTo(e1.x + 14, e1.y - 36);
    ctx.moveTo(e2.x - 12, e2.y - 36);
    ctx.lineTo(e2.x + 16, e2.y - 27);
  } else if (mood === "surprise") {
    ctx.arc(e1.x, e1.y - 30, 14, Math.PI * 1.15, Math.PI * 1.85);
    ctx.moveTo(e2.x - 12, e2.y - 34);
    ctx.arc(e2.x, e2.y - 28, 12, Math.PI * 1.15, Math.PI * 1.85);
  } else {
    ctx.moveTo(e1.x - 16, e1.y - 30);
    ctx.quadraticCurveTo(e1.x, e1.y - 36, e1.x + 14, e1.y - 31);
    ctx.moveTo(e2.x - 10, e2.y - 33);
    ctx.quadraticCurveTo(e2.x + 2, e2.y - 38, e2.x + 14, e2.y - 33);
  }
  ctx.stroke();
  // 嘴
  const mx = h.x + h.r * 0.52;
  const my = h.y + h.r * 0.45;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  if (mood === "smile") {
    ctx.moveTo(mx - 13, my - 3);
    ctx.quadraticCurveTo(mx, my + 10, mx + 13, my - 3);
  } else if (mood === "shy") {
    ctx.moveTo(mx - 6, my);
    ctx.quadraticCurveTo(mx, my + 4, mx + 6, my);
  } else if (mood === "surprise") {
    ctx.ellipse(mx, my + 2, 6, 8, 0, 0, Math.PI * 2);
  } else if (mood === "sad" || mood === "cry") {
    ctx.moveTo(mx - 10, my + 2);
    ctx.quadraticCurveTo(mx, my - 4, mx + 10, my + 2);
  } else {
    ctx.moveTo(mx - 9, my);
    ctx.lineTo(mx + 9, my);
  }
  ctx.stroke();
}

// ---------- 画（两遍：先白色模切边，再上色） ----------
function parts(ctx, who, R, pose, border) {
  const P = look(who);
  const isBorder = border > 0;
  const dress = P.build === "dress";
  const back = pose.view === "back" && !dress; // 长发不画背影
  const paint = (path, fill) => {
    ctx.lineJoin = "round";
    if (isBorder) {
      ctx.fillStyle = PAPER_WHITE;
      ctx.strokeStyle = PAPER_WHITE;
      ctx.lineWidth = border * 2 + OL;
      ctx.fill(path);
      ctx.stroke(path);
    } else {
      ctx.fillStyle = fill;
      ctx.fill(path);
      ctx.lineWidth = OL;
      ctx.strokeStyle = P.outline;
      ctx.stroke(path);
    }
  };
  const limb = (pts, w, color) => {
    const p = pts.length === 3 ? arc3(pts) : polyline(pts);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (isBorder) {
      ctx.strokeStyle = PAPER_WHITE;
      ctx.lineWidth = w + OL * 2 + border * 2;
      ctx.stroke(p);
      return;
    }
    ctx.strokeStyle = P.outline;
    ctx.lineWidth = w + OL * 2;
    ctx.stroke(p);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke(p);
  };
  const withHead = (fn) => {
    ctx.save();
    ctx.translate(R.neck.x, R.neck.y);
    ctx.rotate(R.tilt);
    ctx.translate(-R.neck.x, -R.neck.y);
    fn();
    ctx.restore();
  };

  // 长发画在身体后面
  if (dress && !back) withHead(() => paint(longHairBack(R.head), P.hair));

  // 远侧手
  limb([R.sL, R.eL, R.hL], 44, P.top);
  paint(circle(R.hL, 23), P.skin);

  // 腿、袜子、鞋
  if (dress) {
    limb(R.legL, 40, P.skin);
    limb(R.legR, 40, P.skin);
    if (!isBorder) {
      for (const leg of [R.legL, R.legR]) {
        const end = leg[leg.length - 1];
        const prev = leg[leg.length - 2];
        limb([mix(prev, end, 0.55), end], 40, P.sock);
      }
    }
  } else {
    limb(R.legL, 52, P.bottom);
    limb(R.legR, 52, P.bottom);
  }
  paint(ellipse(R.footL, dress ? 34 : 40, dress ? 17 : 19), P.shoe);
  paint(ellipse(R.footR, dress ? 34 : 40, dress ? 17 : 19), P.shoe);

  // 身体
  const torso = new Path2D();
  if (dress) torso.roundRect(232, 504 + R.by, 138, 150, [46, 46, 18, 18]);
  else torso.roundRect(222, 504 + R.by, 156, 214, [48, 48, 24, 24]);
  paint(torso, P.top);
  if (!isBorder) {
    ctx.save();
    ctx.clip(torso);
    ctx.fillStyle = P.topShade;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(222, 504 + R.by, 36, 220);
    ctx.restore();
  }
  if (dress) {
    // A 字裙
    const skirt = new Path2D();
    if (pose.sit > 0.5) {
      // 坐着：裙子沿大腿铺到膝盖
      const kx = R.legR[1].x;
      const ky = R.legR[1].y;
      skirt.moveTo(236, 636 + R.by);
      skirt.lineTo(366, 636 + R.by);
      skirt.quadraticCurveTo(kx + 20, ky - 40, kx + 44, ky + 26);
      skirt.quadraticCurveTo(kx - 60, ky + 48, 230, ky + 30);
      skirt.quadraticCurveTo(214, 700 + R.by, 236, 636 + R.by);
    } else {
      skirt.moveTo(236, 636 + R.by);
      skirt.lineTo(366, 636 + R.by);
      skirt.quadraticCurveTo(384, 720 + R.by, 398, 806 + R.by);
      skirt.quadraticCurveTo(300, 824 + R.by, 202, 806 + R.by);
      skirt.quadraticCurveTo(216, 720 + R.by, 236, 636 + R.by);
    }
    skirt.closePath();
    paint(skirt, P.bottom);
    if (!isBorder) {
      ctx.save();
      ctx.clip(skirt);
      ctx.fillStyle = P.bottomShade;
      ctx.fillRect(196, 788 + R.by, 210, 30);
      ctx.globalAlpha = 0.5;
      for (const sx of [262, 300, 338]) ctx.fillRect(sx, 660 + R.by, 4, 150);
      ctx.restore();
    }
  }
  if (!isBorder && !back) {
    if (dress) {
      // 圆领 + 小蝴蝶结（accent 颜色）
      ctx.fillStyle = P.top;
      ctx.strokeStyle = P.outline;
      ctx.lineWidth = 4;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(300 + s * 24, 516 + R.by, 26, 15, s * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = P.accent;
      ctx.beginPath();
      ctx.moveTo(300, 528 + R.by);
      ctx.lineTo(282, 518 + R.by);
      ctx.lineTo(282, 540 + R.by);
      ctx.closePath();
      ctx.moveTo(300, 528 + R.by);
      ctx.lineTo(318, 518 + R.by);
      ctx.lineTo(318, 540 + R.by);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = P.top;
      ctx.strokeStyle = P.outline;
      ctx.lineWidth = 4;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(300, 520 + R.by);
        ctx.lineTo(300 + s * 40, 506 + R.by);
        ctx.lineTo(300 + s * 30, 548 + R.by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = P.outline;
      for (const yy of [578, 622, 666]) {
        ctx.beginPath();
        ctx.arc(301, yy + R.by, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 近侧手（伸手时张开手指）
  limb([R.sR, R.eR, R.hR], 44, P.top);
  if (R.reach > 0.5) {
    const open = Math.min(1, (R.reach - 0.5) / 0.4);
    for (const da of [-0.55, -0.18, 0.2, 0.6]) {
      const fa = R.reachDir + da;
      const len = 18 * open;
      limb([R.hR, { x: R.hR.x + Math.cos(fa) * len, y: R.hR.y + Math.sin(fa) * len }], 11, P.skin);
    }
  }
  paint(circle(R.hR, 23), P.skin);

  // 头
  withHead(() => {
    const h = R.head;
    if (back) {
      paint(circle(h, h.r), P.skin);
      if (!dress && !isBorder) {
        for (const s of [-1, 1]) paint(circle({ x: h.x + s * h.r * 0.98, y: h.y + h.r * 0.12 }, h.r * 0.15), P.skin);
      }
      paint(backHair(dress, h), P.hair);
      if (dress && !isBorder) {
        ctx.strokeStyle = P.hairHi;
        ctx.lineWidth = 4;
        for (const dx of [-0.5, -0.15, 0.2, 0.55]) {
          ctx.beginPath();
          ctx.moveTo(h.x + dx * h.r, h.y - h.r * 0.2);
          ctx.lineTo(h.x + dx * h.r * 1.1, h.y + h.r * 2.0);
          ctx.stroke();
        }
        ctx.fillStyle = P.accent;
        ctx.fillRect(h.x + h.r * 0.35, h.y - h.r * 0.72, 34, 16);
      }
      return;
    }
    paint(circle(h, h.r), P.skin);
    if (!isBorder) {
      if (!dress) paint(circle({ x: h.x - h.r * 0.44, y: h.y + h.r * 0.14 }, h.r * 0.15), P.skin);
      face(ctx, who, h, pose);
    }
    if (dress) {
      paint(longHairFront(h), P.hair);
      if (!isBorder) {
        // 发箍（accent 颜色）
        ctx.fillStyle = P.accent;
        ctx.save();
        ctx.translate(h.x + h.r * 0.42, h.y - h.r * 0.62);
        ctx.rotate(-0.4);
        ctx.fillRect(-18, -8, 36, 16);
        ctx.restore();
      }
    } else {
      paint(shortHair(h), P.hair);
    }
    if (!isBorder) {
      ctx.strokeStyle = P.hairHi;
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(h.x - h.r * 0.15, h.y - h.r * 0.2, h.r * 0.72, Math.PI * 1.18, Math.PI * 1.42);
      ctx.stroke();
    }
  });
}

/**
 * who: PALETTES 里的角色名（示例是 "a"、"b"）
 * pose: { mood: neutral|sad|smile|cry|shy|surprise, view: "3q"|"back",
 *         reach 0..1, lift 0..1 (踮脚), sit 0..1, walk 0..1 (走路相位，null=站),
 *         tilt rad (负数=仰头，正数=低头),
 *         gaze -1..1 (正数=往下看), blink 0..1, flip (朝左), border px }
 */
export function drawPerson(ctx, W, H, who, pose = {}) {
  const R = rig(who, pose);
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  if (pose.flip) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  ctx.scale(W / 600, H / 900);
  parts(ctx, who, R, pose, pose.border ?? 18);
  parts(ctx, who, R, pose, 0);
  ctx.restore();
}
