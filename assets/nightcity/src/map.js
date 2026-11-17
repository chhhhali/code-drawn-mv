// 俯视城市地图：矢量，每帧按镜头重画，推到 5 倍以上也清楚。
// 世界坐标单位是像素（镜头缩放 s=1 时一比一）。方格街道（一格 CELL）+ 四条过主路口 P 的大道。
// 光轨路线用 route() 按格点写；buildMap(seed, keep) 会保留路线走过的小街，其余小街随机断掉约两成。
import { mulberry32, lerp } from "./util.js";
import { W, H, canvas } from "./gfx.js";
import { makePath } from "./fx.js";

export const CELL = 240;
const OX = 40;
const OY = 20;
export const gx = (i) => OX + i * CELL;
export const gy = (j) => OY + j * CELL;
const rad = (d) => (d * Math.PI) / 180;

export const P = { x: gx(9), y: gy(6) }; // 主路口：四条大道都从这里过（星芒、印章、同心圆常放在这里）
export const Q = { x: gx(7) + CELL / 2, y: gy(7) + CELL / 2 }; // 广场（彩纸常从这里炸开）
export const D1 = { x: Math.cos(rad(-32)), y: Math.sin(rad(-32)) }; // 斜向大道，往右上
export const D2 = { x: Math.cos(rad(36)), y: Math.sin(rad(36)) }; // 斜向大道，往右下

/** 从点 p 沿方向 d 走 len 像素 */
export const along = (p, d, len) => [p.x + d.x * len, p.y + d.y * len];

/**
 * 光轨路线。
 * grid：格点 [[i, j], …]，相邻两点要在同一条横线或竖线上（沿小街走）。
 * tail：接在后面的世界坐标点 [[x, y], …]，比如用 along(P, D2, 800) 沿斜向大道出去。
 * 返回 { path, keys }：path 交给 trail()，keys 交给 buildMap() 保留这些路段。
 */
export function route(grid, tail = []) {
  const keys = [];
  for (let k = 1; k < grid.length; k++) {
    const [i0, j0] = grid[k - 1];
    const [i1, j1] = grid[k];
    if (i0 === i1) for (let j = Math.min(j0, j1); j < Math.max(j0, j1); j++) keys.push(`v${i0},${j}`);
    else if (j0 === j1) for (let i = Math.min(i0, i1); i < Math.max(i0, i1); i++) keys.push(`h${i},${j0}`);
  }
  const pts = grid.map(([i, j]) => [gx(i), gy(j)]).concat(tail);
  return { path: makePath(pts), keys };
}

const RIVER = [
  [2380, 2900],
  [2900, 2560],
  [3400, 2330],
  [3950, 2180],
];

function distToRiver(x, y) {
  let best = Infinity;
  for (let i = 1; i < RIVER.length; i++) {
    const [ax, ay] = RIVER[i - 1];
    const [bx, by] = RIVER[i];
    const dx = bx - ax;
    const dy = by - ay;
    const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - dx * k, y - ay - dy * k));
  }
  return best;
}

function cloudSprite(r) {
  const c = canvas(620, 300);
  const g = c.getContext("2d");
  g.filter = "blur(16px)";
  g.fillStyle = "#e3e5f1";
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.arc(130 + r() * 360, 150 + (r() - 0.5) * 70, 46 + r() * 64, 0, Math.PI * 2);
    g.fill();
  }
  g.filter = "none";
  return c;
}

/** 生成地图数据（只做一次）。keep：一定要保留的小街路段，把各条 route() 的 keys 合起来传进来。 */
export function buildMap(seed = 5, keep = []) {
  const r = mulberry32(seed);
  const blocks = [];
  const dots = [];
  for (let i = -2; i < 17; i++)
    for (let j = -2; j < 13; j++) {
      const cx = gx(i) + CELL / 2;
      const cy = gy(j) + CELL / 2;
      if (i === 7 && j === 7) continue; // 广场
      if (distToRiver(cx, cy) < 230) continue;
      const bx = gx(i) + 20;
      const by = gy(j) + 20;
      const bw = CELL - 40;
      const bh = CELL - 40;
      const n = 1 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        const w = 46 + r() * (bw - 56);
        const h = 46 + r() * (bh - 56);
        const x = bx + r() * (bw - w);
        const y = by + r() * (bh - h);
        blocks.push({ x, y, w, h, col: ["#23243e", "#292b48", "#1e2036", "#2d2f4f", "#26284a"][Math.floor(r() * 5)] });
        const m = Math.floor(r() * 8);
        for (let q = 0; q < m; q++) dots.push({ x: x + 6 + r() * (w - 12), y: y + 6 + r() * (h - 12), c: r() < 0.6 ? "#dcc98f" : "#d8eadd", a: 0.45 + r() * 0.55 });
      }
    }
  // 小路按格子分段，随机去掉约两成，拼出大小不一的街区；光轨走过的路段、主路口所在的行和列一定保留
  const must = new Set(keep);
  const sr = mulberry32(seed + 3);
  const streets = [];
  for (let i = -2; i < 18; i++)
    for (let j = -2; j < 13; j++) {
      const keepV = must.has(`v${i},${j}`) || i === 9 || sr() > 0.22;
      const keepH = must.has(`h${i},${j}`) || j === 6 || sr() > 0.22;
      if (keepV) streets.push([gx(i), gy(j), gx(i), gy(j + 1)]);
      if (keepH) streets.push([gx(i), gy(j), gx(i + 1), gy(j)]);
    }
  const cr = mulberry32(seed + 9);
  const clouds = [
    [2950, 1060, 1.3],
    [3420, 1280, 1.0],
    [1330, 1240, 1.1],
    [2520, 880, 0.9],
    [1120, 2120, 1.2],
  ].map(([x, y, sc]) => ({ img: cloudSprite(cr), x, y, sc, vx: 26 + cr() * 30 }));
  const roads = canvas(W, H);
  return { blocks, dots, streets, clouds, roads, rg: roads.getContext("2d") };
}

// ---------- 镜头 ----------
// cam = { cx, cy(镜头对准的世界点), s(缩放), rot(弧度), ox, oy(震屏偏移) }
export function applyCam(g, cam) {
  g.translate(960 + (cam.ox || 0), 540 + (cam.oy || 0));
  g.rotate(cam.rot);
  g.scale(cam.s, cam.s);
  g.translate(-cam.cx, -cam.cy);
}

export function toScreen(cam, p) {
  const dx = (p.x - cam.cx) * cam.s;
  const dy = (p.y - cam.cy) * cam.s;
  const c = Math.cos(cam.rot);
  const s = Math.sin(cam.rot);
  return { x: 960 + (cam.ox || 0) + dx * c - dy * s, y: 540 + (cam.oy || 0) + dx * s + dy * c };
}

function toWorld(cam, x, y) {
  const dx = x - 960 - (cam.ox || 0);
  const dy = y - 540 - (cam.oy || 0);
  const c = Math.cos(-cam.rot);
  const s = Math.sin(-cam.rot);
  return { x: cam.cx + (dx * c - dy * s) / cam.s, y: cam.cy + (dx * s + dy * c) / cam.s };
}

function avenue(g, p, d, w) {
  const L = 5000;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(p.x - d.x * L, p.y - d.y * L);
  g.lineTo(p.x + d.x * L, p.y + d.y * L);
  g.stroke();
}

function plaza(g, x, y) {
  g.fillStyle = "#1c1f35";
  g.fillRect(x - 100, y - 100, 200, 200);
  g.strokeStyle = "#3a3e66";
  g.lineWidth = 4;
  for (const s of [92, 70, 48, 26]) g.strokeRect(x - s, y - s, s * 2, s * 2);
  g.fillStyle = "#dcc98f";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.fillRect(x + Math.cos(a) * 81 - 2, y + Math.sin(a) * 81 - 2, 4, 4);
  }
}

/** 画地图：地块、河、楼顶、道路（左暖右冷）、云。 */
export function drawMap(g, M, cam, t) {
  const cs = [toWorld(cam, 0, 0), toWorld(cam, W, 0), toWorld(cam, 0, H), toWorld(cam, W, H)];
  const x0 = Math.min(...cs.map((c) => c.x)) - 80;
  const x1 = Math.max(...cs.map((c) => c.x)) + 80;
  const y0 = Math.min(...cs.map((c) => c.y)) - 80;
  const y1 = Math.max(...cs.map((c) => c.y)) + 80;

  g.save();
  g.fillStyle = "#151727";
  g.fillRect(0, 0, W, H);
  applyCam(g, cam);
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const [col, w] of [
    ["#2c3f72", 250],
    ["#22335f", 214],
  ]) {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(RIVER[0][0], RIVER[0][1]);
    for (const p of RIVER.slice(1)) g.lineTo(p[0], p[1]);
    g.stroke();
  }
  for (const b of M.blocks) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    g.fillStyle = "rgba(6,7,16,0.5)";
    g.fillRect(b.x + 9, b.y + 11, b.w, b.h);
    g.fillStyle = b.col;
    g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle = "rgba(130,130,185,0.16)";
    g.fillRect(b.x, b.y, b.w, 3);
    g.fillRect(b.x, b.y, 3, b.h);
  }
  for (const d of M.dots) {
    if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1) continue;
    g.globalAlpha = d.a;
    g.fillStyle = d.c;
    g.fillRect(d.x, d.y, 3, 3);
  }
  g.globalAlpha = 1;
  plaza(g, Q.x, Q.y);
  g.restore();

  // 道路单独一层：先画灰色路网，再按世界坐标左暖右冷上色（source-atop 只染路面）
  const rg = M.rg;
  rg.setTransform(1, 0, 0, 1, 0, 0);
  rg.globalCompositeOperation = "source-over";
  rg.globalAlpha = 1;
  rg.clearRect(0, 0, W, H);
  rg.save();
  applyCam(rg, cam);
  rg.lineCap = "square";
  rg.strokeStyle = "#4d4a68";
  rg.lineWidth = 22;
  rg.beginPath();
  for (const [ax, ay, bx, by] of M.streets) {
    if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1 || Math.max(ay, by) < y0 || Math.min(ay, by) > y1) continue;
    rg.moveTo(ax, ay);
    rg.lineTo(bx, by);
  }
  rg.stroke();
  rg.lineCap = "butt";
  rg.strokeStyle = "#6c6886";
  avenue(rg, P, { x: 1, y: 0 }, 72);
  avenue(rg, P, { x: 0, y: 1 }, 46);
  avenue(rg, P, D1, 64);
  avenue(rg, P, D2, 40);
  rg.fillStyle = "#6c6886";
  rg.beginPath();
  rg.arc(P.x, P.y, 76, 0, Math.PI * 2);
  rg.fill();
  rg.strokeStyle = "rgba(200,196,228,0.22)";
  rg.lineWidth = 3;
  avenue(rg, P, { x: 1, y: 0 }, 3);
  avenue(rg, P, D1, 3);
  rg.globalCompositeOperation = "source-atop";
  const tint = rg.createLinearGradient(gx(3), 0, gx(15), 0);
  tint.addColorStop(0, "rgba(182,128,70,0.78)");
  tint.addColorStop(0.38, "rgba(182,128,70,0.42)");
  tint.addColorStop(0.5, "rgba(150,140,180,0.04)");
  tint.addColorStop(0.72, "rgba(72,98,176,0.35)");
  tint.addColorStop(1, "rgba(72,98,176,0.62)");
  rg.fillStyle = tint;
  rg.fillRect(x0 - 100, y0 - 100, x1 - x0 + 200, y1 - y0 + 200);
  rg.restore();
  g.drawImage(M.roads, 0, 0);

  // 云影
  g.save();
  applyCam(g, cam);
  g.globalAlpha = 0.3;
  for (const c of M.clouds) {
    const w = 620 * c.sc;
    const h = 300 * c.sc;
    g.drawImage(c.img, c.x + c.vx * t - w / 2, c.y - h / 2, w, h);
  }
  g.restore();
}

export { lerp };
