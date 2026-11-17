// 样片 · 逐句配画（蜡笔绘本版），两句歌词、约 6 秒（整片时间 31.2–37.3 秒）
//   第 1 句唱远处冒烟的烟囱 → 远景小山上一座小屋。唱到"烟"字烟囱开始冒烟，唱到"冒"字冒一大口；
//                              孩子背对镜头看着它，同时呵出一口白气（烟和白气押韵）
//   第 2 句唱"我的卡片"      → 同一片雪地，镜头推近。孩子已经转过身来，回头看一眼小屋，从大衣里掏出卡片，
//                              唱到"卡"字举着卡片跳起来
//   和声再唱一遍"卡片"        → 镜头推到卡片上：卡片上画的正是远处那座小屋，画里的小烟囱也冒起烟；
//                              弹出"获得 · 卡片 ×1"（可选的游戏界面手法，这一段只用这一处）
// 用到的手法：词眼直给（烟囱）、动作踩字（冒、卡）、物件押韵（卡片上的画 = 上一句的远景）、物件接力的起点（卡片下一句要交给圣诞老人）
import { makeLayer, drawLayer, withCam, crayon, scribble, glow, mote, star } from "../crayon.js";
import { nightSky, moon, starList, drawStars, circle, rrect, heart } from "../art.js";
import { drawPerson, LOOK } from "../character.js";
import { shot, useSet, ease, ramp, keyed, lerp, mulberry32 } from "../shot.js";
import { makeCues, hit, settle } from "../cues.js";
import { itemTag } from "../gameui.js";

// ---------- 时间：原片字幕切换 + 人声起音估的。没有歌词文本，只给每句字数 n ----------
const PH = [
  { line: 1, start: 31.35, end: 33.35, n: 8 },
  { line: 2, start: 33.45, end: 35.4, n: 8 },
  { line: 3, start: 35.5, end: 37.1, n: 4 },
];
const C = makeCues(PH, { "1:5": 32.55, "2:6": 34.8, "3:2": 36.42 });
const T_SMOKE = C.at(1, 3) - 0.1; // "烟"
const T_PUFF = C.at(1, 5); // "冒"
const T_CARD = C.at(2, 6); // "卡"
const T_ECHO = C.start(3);
const T_ECHO_CARD = C.at(3, 2); // 回声里的"卡"
export const CUT_1 = C.start(2) - 0.02;

// ---------- 角色：冬天的孩子（在示例角色 a 上换衣服；帽子、围巾用 character.js 的挂点画） ----------
LOOK.kid = { ...LOOK.a, top: "#46689a", topLine: "#2c4466", bottom: "#5b4c6e", bottomLine: "#3b3050", shoe: "#5a3d30" };
const HAT = "#e9b949";
const HAT_LINE = "#b9862c";
const SCARF = "#d65a50";
const SCARF_LINE = "#9c3a33";

function beanie(g, head, k) {
  const { x, y, r: R } = head;
  const dome = new Path2D();
  dome.moveTo(x - R * 1.05, y - R * 0.3);
  dome.bezierCurveTo(x - R * 1.02, y - R * 1.32, x + R * 1.02, y - R * 1.32, x + R * 1.05, y - R * 0.3);
  dome.closePath();
  crayon(g, dome, { fill: HAT, line: HAT_LINE, lw: 8, shade: 0.18, hl: 0.12, k });
  crayon(g, rrect(x - R * 1.12, y - R * 0.5, R * 2.24, R * 0.32, R * 0.14), { fill: "#d9a23a", line: HAT_LINE, lw: 7, shade: 0.22, k, dir: "v" });
  crayon(g, circle(x + R * 0.06, y - R * 1.16, R * 0.25), { fill: "#f6e7c8", line: "#c9b48e", lw: 6, shade: 0.12, k });
}

function scarf(g, r, k, back) {
  const { x, y, r: R } = r.head;
  const ny = y + R * 0.9;
  crayon(g, rrect(x - R * 0.66, ny - R * 0.14, R * 1.32, R * 0.36, R * 0.17), { fill: SCARF, line: SCARF_LINE, lw: 7, shade: 0.2, hl: 0.12, k, dir: "h" });
  const tx = back ? x - R * 0.36 : x + R * 0.16;
  const tail = new Path2D();
  tail.moveTo(tx, ny + R * 0.1);
  tail.lineTo(tx + R * 0.3, ny + R * 0.1);
  tail.lineTo(tx + R * 0.38, ny + R * 0.9);
  tail.lineTo(tx + R * 0.03, ny + R * 0.86);
  tail.closePath();
  crayon(g, tail, { fill: SCARF, line: SCARF_LINE, lw: 7, shade: 0.2, k, dir: "v" });
}

// ---------- 雪地布景 ----------
const ridge = (x, base, bumps) => bumps.reduce((y, [cx, w, a]) => y - a * Math.exp(-(((x - cx) / w) ** 2)), base);
function land(x0, x1, base, bumps, bottom, seed, rough = 3) {
  const r = mulberry32(seed);
  const p = new Path2D();
  p.moveTo(x0, bottom);
  for (let x = x0; x <= x1; x += 16) p.lineTo(x, ridge(x, base, bumps) + (r() - 0.5) * rough);
  p.lineTo(x1, bottom);
  p.closePath();
  return p;
}

function pine(g, x, y, h) {
  crayon(g, rrect(x - h * 0.05, y - h * 0.16, h * 0.1, h * 0.18, 2), { fill: "#5a4034", line: "#3a2a22", lw: 3, shade: 0.2 });
  for (let i = 0; i < 3; i++) {
    const ty = y - h * (0.12 + i * 0.26);
    const tw = h * (0.44 - i * 0.1);
    const th = h * 0.42;
    const p = new Path2D();
    p.moveTo(x - tw, ty);
    p.lineTo(x, ty - th);
    p.lineTo(x + tw, ty);
    p.closePath();
    crayon(g, p, { fill: "#2e4d5c", line: "#1c3340", lw: 4, shade: 0.25, hl: 0.08 });
    const s = new Path2D();
    s.moveTo(x - tw * 0.52, ty - th * 0.4);
    s.lineTo(x, ty - th);
    s.lineTo(x + tw * 0.52, ty - th * 0.4);
    s.quadraticCurveTo(x + tw * 0.2, ty - th * 0.26, x, ty - th * 0.36);
    s.quadraticCurveTo(x - tw * 0.2, ty - th * 0.26, x - tw * 0.52, ty - th * 0.4);
    s.closePath();
    crayon(g, s, { fill: "#e8eef8", line: "#a9b6cf", lw: 3, shade: 0.08, hl: 0.15 });
  }
}

const CAB = { x: 760, y: 574 }; // 远景小屋的地面中点
const CHIM = { x: 800, y: 455 }; // 烟囱口（冒烟的起点）
function cabin(g) {
  const { x, y } = CAB;
  crayon(g, rrect(CHIM.x - 11, CHIM.y + 6, 22, 56, 2), { fill: "#7a4a3a", line: "#4f2e24", lw: 3, shade: 0.2 });
  crayon(g, rrect(CHIM.x - 14, CHIM.y - 1, 28, 11, 5), { fill: "#eef2fa", line: "#a9b5cf", lw: 3 });
  crayon(g, rrect(x - 64, y - 62, 128, 64, 3), { fill: "#9b5f45", line: "#6a3c2c", lw: 4, shade: 0.22, hl: 0.08, dir: "h" });
  const roof = new Path2D();
  roof.moveTo(x - 84, y - 54);
  roof.lineTo(x, y - 112);
  roof.lineTo(x + 84, y - 54);
  roof.closePath();
  crayon(g, roof, { fill: "#eef2fa", line: "#9fadc8", lw: 4, shade: 0.1, hl: 0.15 });
  crayon(g, rrect(x - 34, y - 46, 32, 27, 2), { fill: "#f4c56a", line: "#b9862c", lw: 3, shade: 0.05 });
  g.strokeStyle = "#8a5a2c";
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(x - 18, y - 46);
  g.lineTo(x - 18, y - 19);
  g.moveTo(x - 34, y - 33);
  g.lineTo(x - 2, y - 33);
  g.stroke();
  crayon(g, rrect(x + 16, y - 40, 24, 40, 3), { fill: "#5e3a2c", line: "#3e2519", lw: 3 });
}

const snowSet = () =>
  useSet("snow-field", () => {
    const hill1 = [[760, 330, 126], [1550, 380, 60]];
    const mid = [[300, 520, 40], [1300, 600, 26]];
    return {
      sky: makeLayer(-260, -180, 2440, 1220, (g) => nightSky(g, -260, -180, 2440, 1220, 7, 760)),
      stars: starList(9, 60, -200, 2120, -140, 460),
      far: makeLayer(-260, 380, 2440, 820, (g) => {
        crayon(g, land(-260, 2180, 640, [[200, 360, 90], [1500, 420, 112], [2050, 260, 70]], 1200, 2, 2), { fill: "#8f9dbf", line: "#6c7aa0", lw: 4, shade: 0.22, hl: 0.12 });
        crayon(g, land(-260, 2180, 700, hill1, 1200, 3, 2), { fill: "#a7b4d0", line: "#7f8db0", lw: 4, shade: 0.2, hl: 0.16 });
        for (const [px, h] of [[540, 70], [610, 56], [990, 64], [1290, 84], [1350, 66]]) pine(g, px, ridge(px, 700, hill1) + 6, h);
        cabin(g);
      }),
      mid: makeLayer(-260, 560, 2440, 800, (g) => {
        crayon(g, land(-260, 2180, 770, mid, 1360, 4, 3), { fill: "#c3cee3", line: "#94a3c2", lw: 5, shade: 0.2, hl: 0.18 });
        for (let px = 110; px <= 930; px += 92) {
          const py = ridge(px, 770, mid) + 4;
          crayon(g, rrect(px - 6, py - 50, 12, 52, 3), { fill: "#6b4f3f", line: "#45312a", lw: 3, shade: 0.2 });
          crayon(g, rrect(px - 9, py - 56, 18, 9, 4), { fill: "#eef2fa", line: "#a9b5cf", lw: 2 });
        }
        scribble(g, [[104, ridge(104, 770, mid) - 34], [936, ridge(936, 770, mid) - 30]], { color: "#6b4f3f", width: 6, seed: 3 });
        scribble(g, [[104, ridge(104, 770, mid) - 16], [936, ridge(936, 770, mid) - 12]], { color: "#6b4f3f", width: 5, seed: 4 });
        pine(g, 1180, ridge(1180, 770, mid) + 6, 140);
        pine(g, 1760, ridge(1760, 770, mid) + 10, 180);
        pine(g, 40, ridge(40, 770, mid) + 10, 150);
      }),
      fg: makeLayer(-260, 880, 2440, 520, (g) => {
        crayon(g, land(-260, 2180, 1018, [[1400, 420, 16], [200, 300, -8]], 1400, 9, 2), { fill: "#e1e8f4", line: "#aab8d2", lw: 6, shade: 0.16, hl: 0.22 });
      }),
    };
  });

// ---------- 会动的东西：烟、雪、白气、火花 ----------
const PUFFS = (() => {
  const r = mulberry32(77);
  const list = [];
  for (let i = 0; i < 26; i++) list.push({ b: T_SMOKE + i * 0.24 + r() * 0.06, ph: r() * 6.28, big: 1 });
  list.push({ b: T_PUFF - 0.05, ph: 1.3, big: 2.3 });
  list.push({ b: T_PUFF + 0.12, ph: 2.1, big: 1.45 });
  return list.sort((a, b) => a.b - b.b);
})();

function blob(x, y, r) {
  const p = new Path2D();
  p.addPath(circle(x, y, r));
  p.addPath(circle(x + r * 0.72, y + r * 0.18, r * 0.7));
  p.addPath(circle(x - r * 0.62, y + r * 0.22, r * 0.62));
  return p;
}

function smoke(g, T, ox, oy, sc = 1) {
  for (const p of PUFFS) {
    const a = T - p.b;
    if (a < 0 || a > 4.6) continue;
    const rise = (92 * (1 - Math.exp(-0.9 * a)) + 18 * a) * sc;
    const x = ox + (26 * a + 8 * Math.sin(a * 1.8 + p.ph)) * sc;
    const rad = (6 + 10 * a) * p.big * sc;
    g.save();
    g.globalAlpha = Math.min(1, a / 0.16) * Math.exp(-0.62 * a) * 0.9;
    crayon(g, blob(x, oy - rise, rad), { fill: "#e2e7f1", line: "#b4bed3", lw: 2, shade: 0.08, hl: 0.12, fleck: 0.1 });
    g.restore();
  }
}

const FLAKES = (() => {
  const r = mulberry32(5);
  return Array.from({ length: 120 }, (_, i) => ({ x: r() * 2500 - 290, y: r() * 1400, v: 38 + r() * 46, s: 1.5 + r() * 2.4, ph: r() * 6.28, front: i < 24 }));
})();
function snowfall(g, T, front) {
  for (const f of FLAKES) {
    if (f.front !== front) continue;
    const k = front ? 2.2 : 1;
    const y = ((f.y + T * f.v * k) % 1400) - 170;
    const x = f.x + Math.sin(T * 0.9 + f.ph) * 18 * k + T * 6;
    mote(g, x, y, f.s * k, "#f4f7ff", front ? 0.7 : 0.55);
  }
}

function breath(g, head, T, t0, toLeft) {
  const a = T - t0;
  if (a < 0 || a > 1.3) return;
  const dir = toLeft ? -1 : 1;
  const x = head.x + dir * head.r * (1.15 + a * 0.5);
  const y = head.y + head.r * (0.35 - a * 0.25);
  g.save();
  g.globalAlpha = Math.min(1, a / 0.12) * (1 - a / 1.3) * 0.8;
  crayon(g, blob(x, y, head.r * (0.16 + a * 0.22)), { fill: "#f1f4fa", line: "#c3cbe0", lw: 2, shade: 0.05, hl: 0.1 });
  g.restore();
}

// ---------- 卡片：孩子画的小屋（和远景那座一样） ----------
function drawCard(g, cx, cy, w, rot, T, smokeK, twinkle) {
  const h = w * 1.25;
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  crayon(g, rrect(-w / 2, -h / 2, w, h, w * 0.05), { fill: "#f7f0dd", line: "#c9b48e", lw: w * 0.02, shade: 0.08, hl: 0.1, fleck: 0.12 });
  const i = w * 0.07;
  scribble(g, [[-w / 2 + i, -h / 2 + i], [w / 2 - i, -h / 2 + i], [w / 2 - i, h / 2 - i], [-w / 2 + i, h / 2 - i], [-w / 2 + i, -h / 2 + i]], { color: "#d65a50", width: w * 0.022, seed: 21, jitter: 1.1 });
  // 雪地
  scribble(g, [[-w * 0.36, h * 0.27], [-w * 0.1, h * 0.24], [w * 0.14, h * 0.27], [w * 0.36, h * 0.25]], { color: "#8fa3c8", width: w * 0.02, seed: 22 });
  // 小屋 + 烟囱 + 窗
  const hx = -w * 0.04;
  const hy = h * 0.25;
  crayon(g, rrect(w * 0.1, hy - w * 0.45, w * 0.07, w * 0.2, 2), { fill: "#7a4a3a", line: "#4f2e24", lw: w * 0.012, shade: 0.1 });
  crayon(g, rrect(hx - w * 0.2, hy - w * 0.26, w * 0.4, w * 0.26, 3), { fill: "#c27455", line: "#7a3f2c", lw: w * 0.014, shade: 0.12, hl: 0.1 });
  const roof = new Path2D();
  roof.moveTo(hx - w * 0.27, hy - w * 0.24);
  roof.lineTo(hx, hy - w * 0.47);
  roof.lineTo(hx + w * 0.27, hy - w * 0.24);
  roof.closePath();
  crayon(g, roof, { fill: "#8d4a3c", line: "#5c2c24", lw: w * 0.014, shade: 0.12 });
  crayon(g, rrect(hx - w * 0.12, hy - w * 0.19, w * 0.1, w * 0.09, 2), { fill: "#f4c56a", line: "#b9862c", lw: w * 0.01 });
  glow(g, hx - w * 0.07, hy - w * 0.145, w * 0.16, "#f6c86b", 0.25 + 0.35 * twinkle);
  // 画里的小烟：回声那个字到了才一团团冒出来（和远景的烟同一种画法）
  for (let j = 0; j < 3; j++) {
    const kj = Math.max(0, Math.min(1, smokeK * 3 - j));
    if (kj <= 0) continue;
    const sx = w * (0.14 + j * 0.05) + Math.sin(T * 2.2 + j * 1.7) * w * 0.012;
    const sy = hy - w * (0.5 + j * 0.1);
    g.save();
    g.globalAlpha = kj;
    crayon(g, blob(sx, sy, w * (0.028 + j * 0.012) * (0.5 + 0.5 * kj)), { fill: "#dfe4ee", line: "#9aa6be", lw: w * 0.008, shade: 0.06 });
    g.restore();
  }
  heart(g, -w * 0.3, -h * 0.33, w * 0.06, "#ec8a9a");
  star(g, w * 0.3, -h * 0.34, w * 0.045, 0.4 + 0.6 * twinkle, "#f2c14e");
  g.restore();
}

// ---------- 镜头 1：远处的小屋冒烟 ----------
export function farChimney({ tIn, tOut }) {
  return shot({
    id: "far-chimney",
    tIn,
    tOut,
    warm: 0,
    draw(g, lt, T) {
      const S = snowSet();
      const k = ease.sine(Math.min(1, lt / 2.7));
      const cam = { x: 960 - 36 * k, y: 540 - 12 * k, z: 1 + 0.07 * k };
      drawLayer(g, cam, 0.06, S.sky);
      withCam(g, cam, 0.08, (c) => drawStars(c, S.stars, T));
      withCam(g, cam, 0.1, (c) => moon(c, 330, 228, 66));
      drawLayer(g, cam, 0.22, S.far);
      withCam(g, cam, 0.22, (c) => {
        const pulse = hit(T, T_PUFF, { pre: 0.15, post: 0.9 });
        glow(c, CAB.x - 18, CAB.y - 33, 80 + 30 * pulse, "#f6c86b", 0.5 + 0.25 * pulse);
        smoke(c, T, CHIM.x, CHIM.y, 1.35);
      });
      withCam(g, cam, 0.7, (c) => snowfall(c, T, false));
      drawLayer(g, cam, 0.6, S.mid);
      drawLayer(g, cam, 1, S.fg);
      withCam(g, cam, 1, (c) => {
        const o = {};
        drawPerson(c, "kid", 1450, 1016, 470, { view: "back", tilt: -0.35, bob: Math.sin(T * 1.7) * 3, onHead: beanie, onBody: scarf, out: o });
        breath(c, o.head, T, T_PUFF + 0.04, true);
      });
      withCam(g, cam, 1.2, (c) => snowfall(c, T, true));
    },
  });
}

// ---------- 镜头 2：掏出卡片、跳起来，回声推到卡片上 ----------
const HAND = {
  // 近侧手的位置（角色设计坐标，脚底为原点，身高 1000）
  rest: [95, -330],
  pocket: [35, -520],
  chest: [255, -430],
  up: [300, -860],
};
export function cardHop({ tIn, tOut }) {
  return shot({
    id: "card-hop",
    tIn,
    tOut,
    warm: (lt) => 0.25 * ramp(tIn + lt, T_ECHO, T_ECHO + 1.2),
    draw(g, lt, T) {
      const S = snowSet();
      const push = ramp(T, T_ECHO - 0.05, T_ECHO + 0.95, ease.inOut);
      const drift = ease.sine(Math.min(1, lt / 4));
      const lift = settle(T, T_CARD, { pre: 0.3 });
      const cam = {
        x: lerp(1370 + 20 * drift, 1405, push),
        y: lerp(700 - 10 * drift - 80 * lift, 590, push),
        z: lerp(1.45 + 0.03 * drift, 1.92, push),
      };
      drawLayer(g, cam, 0.06, S.sky);
      withCam(g, cam, 0.08, (c) => drawStars(c, S.stars, T));
      withCam(g, cam, 0.1, (c) => moon(c, 330, 228, 66));
      drawLayer(g, cam, 0.22, S.far);
      withCam(g, cam, 0.22, (c) => {
        glow(c, CAB.x - 18, CAB.y - 33, 80, "#f6c86b", 0.5);
        smoke(c, T, CHIM.x, CHIM.y, 1);
      });
      withCam(g, cam, 0.7, (c) => snowfall(c, T, false));
      drawLayer(g, cam, 0.6, S.mid);
      drawLayer(g, cam, 1, S.fg);

      // 角色的动作，全部挂在字上
      const tPocket = T_CARD - 1.0;
      const tTakeOut = T_CARD - 0.62;
      const lerp2 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
      let hand = HAND.rest;
      hand = lerp2(hand, HAND.pocket, settle(T, tPocket, { pre: 0.3 }));
      hand = lerp2(hand, HAND.chest, settle(T, tTakeOut, { pre: 0.22 }));
      hand = lerp2(hand, HAND.up, settle(T, T_CARD, { pre: 0.26 }));
      const hasCard = T >= tTakeOut - 0.08;
      const jump = hit(T, T_CARD + 0.1, { pre: 0.28, post: 0.5 });
      const crouch = hit(T, T_CARD - 0.3, { pre: 0.18, post: 0.16 });
      const gaze = T < tPocket - 0.15 ? [-1.3, -0.5] : T < T_CARD - 0.3 ? [0.9, 0.8] : [0.7, -1.1];
      const mood = T < tTakeOut ? "neutral" : T < T_CARD - 0.3 ? "smile" : "happy";
      const o = {};
      let cardScreen = null;
      withCam(g, cam, 1, (c) => {
        const px = 1350;
        const py = 1016 - 62 * jump;
        drawPerson(c, "kid", px, py, 470, {
          mood,
          gaze,
          tilt: T < tPocket - 0.15 ? -0.3 : 0.15,
          lift: jump * 0.8,
          bob: 16 * crouch + Math.sin(T * 1.7) * 2,
          handN: [hand[0], hand[1]],
          handF: hasCard ? [hand[0] - 70, hand[1] + 26] : undefined,
          blink: Math.abs(T - (T_CARD + 1.6)) < 0.07 ? 1 : 0,
          onHead: beanie,
          onBody: scarf,
          out: o,
        });
        if (hasCard) {
          const appear = settle(T, tTakeOut + 0.06, { pre: 0.16 });
          const up = settle(T, T_CARD, { pre: 0.26 });
          const w = lerp(150, 190, up) * (0.6 + 0.4 * appear);
          const rot = lerp(-0.1, 0.06 + 0.03 * Math.sin(T * 2.1), up);
          const cx = o.hand.x + lerp(0.32, 0.04, up) * w;
          const cy = o.hand.y - lerp(0.18, 0.42, up) * w * 1.25;
          const smokeK = settle(T, T_ECHO_CARD + 0.1, { pre: 0.75 });
          const tw = hit(T, T_ECHO_CARD, { pre: 0.12, post: 0.9 }) + 0.6 * jump;
          c.save();
          c.globalAlpha = appear;
          drawCard(c, cx, cy, w, rot, T, smokeK, Math.min(1, tw));
          // 拇指压在卡片边上：卡片是"拿在手里"，不是贴在手上
          crayon(c, circle(o.hand.x + 4, o.hand.y - 6, 13), { fill: LOOK.kid.skin, line: LOOK.kid.skinLine, lw: 3, shade: 0.08 });
          c.restore();
          // 跳起来那一下：卡片周围迸出小星星
          const a = T - T_CARD;
          if (a > -0.05 && a < 0.75) {
            for (let i = 0; i < 7; i++) {
              const ang = -Math.PI / 2 + (i - 3) * 0.42;
              const d = 40 + 120 * ease.out(Math.min(1, (a + 0.05) / 0.6));
              star(c, cx + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.9, 9 + (i % 2) * 5, 1 - Math.max(0, a) / 0.75, "#f6d77a");
            }
          }
          const p = c.getTransform().transformPoint(new DOMPoint(cx, cy));
          cardScreen = { x: p.x, y: p.y, w: w * c.getTransform().a };
        }
      });
      withCam(g, cam, 1.2, (c) => snowfall(c, T, true));

      // 可选的游戏界面：回声里的"卡"字弹出"获得 · 卡片 ×1"（屏幕坐标，不跟镜头缩放）
      const tagK = settle(T, T_ECHO_CARD + 0.08, { pre: 0.22 });
      if (cardScreen && tagK > 0) {
        itemTag(g, cardScreen.x + cardScreen.w * 0.5 + 250, cardScreen.y - cardScreen.w * 0.42, "获得 · 卡片 ×1", tagK, {
          size: 46,
          icon: (c, x, y, s) => {
            crayon(c, rrect(x - s * 0.36, y - s * 0.46, s * 0.72, s * 0.92, 4), { fill: "#f7f0dd", line: "#d65a50", lw: 3, shade: 0.06 });
            heart(c, x, y, s * 0.18, "#ec8a9a");
          },
        });
      }
    },
  });
}
