// 像素人物：按身高 H（低分辨率像素）现画成材质图，再用 shade() 打光。
//   近景（H ≥ 110）：2×3 的眼睛带高光、眉毛、3–4 像素的嘴、腮红 —— 表情看得清
//   中景（70–110）：1×2 的眼睛、2 像素的嘴
//   远景（< 70）：1 像素的眼睛，只看剪影和动作
// 比例接近 6 头身（不是 Q 版），动作靠手臂两个角度、腿的相位、头的点头。
// 新片换人：改 LOOKS（材质见 palette.js 的 MAT/MATS）和发型函数。
import { Mat, shade, bayer, mixc, LW, LH } from "./px.js";
import { MAT, MATS, PAL } from "./palette.js";
import { ENV } from "./env.js";
import { hash2 } from "./util.js";

export const LOOKS = {
  boy: { hair: MAT.hairB, top: MAT.hoodie, sleeve: MAT.hoodie, legs: MAT.jeans, shoe: MAT.sneaker, style: "short", outfit: "hoodie", legR: 0.032 },
  girl: { hair: MAT.hairG, top: MAT.coat, sleeve: MAT.coat, legs: MAT.tights, shoe: MAT.boots, style: "bob", outfit: "coat", legR: 0.024, scarf: true },
};

/**
 * 画一个人到材质图上（屏幕坐标），返回 { M, hands: { n, f }, head: { x, y, rx, ry }, top }。
 * x, y：脚底中点；H：身高（像素）。
 * pose = { f: 1 朝右 / -1 朝左, armN: [a, b], armF: [a, b]（a 肩角：0 = 垂下，正 = 往前抬；b 肘弯）,
 *          walk: null 或相位（秒 × 步频）, bob: 整个人下沉像素, nod: 头往下点的像素,
 *          eyes: "open" | "half" | "closed" | "happy" | "wide", mouth: "line" | "smile" | "open" | "o",
 *          blush: 0–1, brows: "flat" | "sad" | "up" }
 */
export function drawPerson(look, x, y, H, pose = {}) {
  const f = pose.f || 1;
  const yb = y + (pose.bob || 0);
  const M = new Mat(x - 0.62 * H, yb - 1.22 * H, 1.24 * H, 1.3 * H);
  const P = (u, v) => [x + f * u * H, yb + v * H];
  const girl = look.outfit === "coat";
  const sh = girl ? -0.765 : -0.775;
  const hip = -0.47;
  const headV = (girl ? -0.9 : -0.905) + (pose.nod || 0) / H;
  const rx = Math.max(2.5, 0.068 * H);
  const ry = Math.max(3, 0.078 * H);
  const [hx, hy] = P(0.012, headV);

  // ---- 手臂（远侧先画，在身体后面）----
  const arm = (side, [a, b], r) => {
    const s = side === "n" ? P(0.068, sh + 0.016) : P(-0.052, sh + 0.016);
    const L1 = 0.165 * H;
    const L2 = 0.15 * H;
    const e = [s[0] + f * L1 * Math.sin(a), s[1] + L1 * Math.cos(a)];
    const h = [e[0] + f * L2 * Math.sin(a + b), e[1] + L2 * Math.cos(a + b)];
    const p1 = M.part();
    M.capsule(s[0], s[1], e[0], e[1], r, look.sleeve, p1);
    const p2 = M.part();
    M.capsule(e[0], e[1], h[0], h[1], r * 0.92, look.sleeve, p2);
    const p3 = M.part();
    M.ellipse(h[0], h[1], Math.max(1, 0.024 * H), Math.max(1, 0.026 * H), MAT.skin, p3);
    return h;
  };
  const armF = pose.armF || [0.06, 0.12];
  const armN = pose.armN || [0.1, 0.15];
  const handF = arm("f", armF, 0.024 * H);

  // ---- 后面的头发（波波头盖到脖子）----
  if (look.style === "bob") {
    const p = M.part();
    const cy = hy + 0.12 * ry;
    M.fill((px, py) => ((px - (hx - f * 0.1 * rx)) / (1.3 * rx)) ** 2 + ((py - cy) / (1.14 * ry)) ** 2 <= 1 && py < hy + 1.05 * ry, hx - 2 * rx, hy - 2 * ry, hx + 2 * rx, hy + 2 * ry, look.hair, p);
  }

  // ---- 腿、鞋 ----
  const sw = pose.walk == null ? 0 : Math.sin(pose.walk * Math.PI * 2) * 0.08;
  const lift = pose.walk == null ? 0 : Math.max(0, Math.cos(pose.walk * Math.PI * 2)) * 0.03;
  for (const [u0, fu, up] of [[-0.03, -0.035 - sw, 0], [0.034, 0.05 + sw, lift]]) {
    const pl = M.part();
    const [ax, ay] = P(u0, hip + 0.02);
    const [kx, ky] = P((u0 + fu) / 2 + 0.008, -0.25 - up / 2);
    const [fx, fy] = P(fu, -0.025 - up);
    M.capsule(ax, ay, kx, ky, look.legR * H, look.legs, pl);
    M.capsule(kx, ky, fx, fy, look.legR * H * 0.92, look.legs, pl);
    if (girl) {
      const pb = M.part();
      const [bx, by] = P(fu, -0.13 - up);
      M.capsule(bx, by, fx, fy, 0.031 * H, look.shoe, pb);
    }
    const ps = M.part();
    const [sx, sy] = P(fu + 0.022, -0.013 - up);
    M.ellipse(sx, sy, 0.046 * H, 0.022 * H, look.shoe, ps);
  }

  // ---- 身体 ----
  const pt = M.part();
  if (girl) {
    M.poly([P(-0.08, sh), P(0.085, sh), P(0.118, -0.2), P(-0.112, -0.2)], look.top, pt);
  } else {
    const [hdx, hdy] = P(-0.055, sh - 0.012);
    M.ellipse(hdx, hdy, 0.062 * H, 0.033 * H, look.top, pt); // 卫衣帽子
    M.poly([P(-0.085, sh - 0.004), P(0.09, sh - 0.004), P(0.086, hip + 0.03), P(-0.08, hip + 0.03)], look.top, pt);
  }
  for (const u of [-0.07, 0.075]) {
    const [ex, ey] = P(u, sh + 0.012);
    M.ellipse(ex, ey, 0.032 * H, 0.03 * H, look.top, pt);
  }
  // 脖子
  const pn = M.part();
  {
    const [ax, ay] = P(0.006, sh + 0.01);
    M.capsule(ax, ay, hx, hy + 0.7 * ry, 0.026 * H, MAT.skin, pn);
  }
  if (look.scarf) {
    const ps = M.part();
    const [sx, sy] = P(0.004, sh - 0.002);
    M.ellipse(sx, sy, 0.064 * H, 0.026 * H, MAT.scarf, ps);
    const [ta, tb] = P(0.04, sh + 0.01);
    const [tc, td] = P(0.05, sh + 0.12);
    M.capsule(ta, tb, tc, td, 0.017 * H, MAT.scarf, ps);
  }
  if (!girl && H >= 100) {
    // 卫衣抽绳
    for (const u of [0.018, 0.05]) {
      const [a, b] = P(u, sh + 0.012);
      for (let k = 0; k < 0.07 * H; k++) M.dot(a, b + k, MAT.string);
    }
  }

  // ---- 头 ----
  const ph = M.part();
  M.ellipse(hx, hy, rx, ry, MAT.skin, ph);
  // 耳朵（远景省略）
  if (H >= 70) {
    const [ex, ey] = [hx - f * 0.62 * rx, hy + 0.12 * ry];
    M.ellipse(ex, ey, Math.max(1, 0.2 * rx), Math.max(1, 0.24 * ry), MAT.skin, ph);
  }

  // ---- 前面的头发 ----
  const L = (u, v) => [hx + f * u * rx, hy + v * ry];
  const hp = M.part();
  if (look.style === "short") {
    M.fill((px, py) => {
      const inCap = ((px - (hx - f * 0.08 * rx)) / (1.12 * rx)) ** 2 + ((py - (hy - 0.3 * ry)) / (0.86 * ry)) ** 2 <= 1;
      return inCap && (py < hy - 0.3 * ry || (px - hx) * f < -0.34 * rx);
    }, hx - 2 * rx, hy - 2 * ry, hx + 2 * rx, hy + ry, look.hair, hp);
    M.poly([L(-0.5, -0.86), L(1.02, -0.7), L(1.02, -0.34), L(0.74, -0.52), L(0.52, -0.2), L(0.32, -0.5), L(0.08, -0.16), L(-0.14, -0.52), L(-0.5, -0.4)], look.hair, hp);
    const [ca, cb] = L(-0.1, -1.05);
    const [cc, cd] = L(0.22, -1.38);
    M.capsule(ca, cb, cc, cd, Math.max(0.6, 0.012 * H), look.hair, hp); // 呆毛
  } else {
    M.fill((px, py) => {
      const inCap = ((px - hx) / (1.13 * rx)) ** 2 + ((py - (hy - 0.26 * ry)) / (0.86 * ry)) ** 2 <= 1;
      return inCap && (py < hy - 0.2 * ry || (px - hx) * f < -0.32 * rx);
    }, hx - 2 * rx, hy - 2 * ry, hx + 2 * rx, hy + ry, look.hair, hp);
    M.poly([L(-0.62, -0.82), L(1.06, -0.62), L(1.02, -0.14), L(0.62, -0.26), L(0.22, -0.2), L(-0.2, -0.32), L(-0.62, -0.36)], look.hair, hp);
    const [sa, sb] = L(0.94, -0.3);
    const [sc, sd] = L(0.88, 0.98);
    M.capsule(sa, sb, sc, sd, 0.2 * rx, look.hair, hp); // 脸旁一缕
  }

  // ---- 五官（不受光的单色像素）----
  face(M, hx, hy, rx, ry, f, H, pose);

  // ---- 近侧手臂（在最前面）----
  const handN = arm("n", armN, 0.026 * H);
  return { M, hands: { n: handN, f: handF }, head: { x: hx, y: hy, rx, ry }, top: hy - ry * 1.2 };
}

function face(M, hx, hy, rx, ry, f, H, pose) {
  const eyes = pose.eyes || "open";
  const ey = Math.round(hy + 0.12 * ry);
  const exs = [Math.round(hx + f * 0.42 * rx), Math.round(hx - f * 0.16 * rx)];
  const big = H >= 110;
  const mid = H >= 70;
  const ew = H >= 180 ? 3 : 2; // 眼睛宽
  const eh = H >= 180 ? 4 : 3; // 眼睛高
  for (const [n, ex] of exs.entries()) {
    if (big) {
      const x0 = ex - ew + 1;
      const y0 = ey - (eh >> 1);
      if (eyes === "open" || eyes === "wide") {
        const h = eyes === "wide" ? eh + 1 : eh;
        for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < ew; dx++) M.dot(x0 + dx, y0 + dy - (eyes === "wide" ? 1 : 0), MAT.eye);
        M.dot(f > 0 ? x0 + ew - 1 : x0, y0 - (eyes === "wide" ? 1 : 0), MAT.eyeHi);
        if (ew === 3) M.dot(f > 0 ? x0 : x0 + 2, y0 + eh - 1, MAT.eyeHi);
      } else if (eyes === "half") {
        for (let dy = (eh >> 1); dy < eh; dy++) for (let dx = 0; dx < ew; dx++) M.dot(x0 + dx, y0 + dy, MAT.eye);
      } else if (eyes === "closed") {
        for (let dx = 0; dx < ew; dx++) M.dot(x0 + dx, y0 + eh - 1, MAT.eye);
      } else {
        for (let dx = -1; dx <= ew; dx++) M.dot(x0 + dx, y0 + (dx === -1 || dx === ew ? eh - 1 : eh - 2), MAT.eye);
      }
      // 眉毛
      const by = y0 - Math.max(2, Math.round(0.28 * ry)) - (pose.brows === "up" ? 1 : 0);
      for (let dx = -1; dx <= ew - 1; dx++) {
        const inner = n === 0 ? -f : f;
        const lift = pose.brows === "sad" && Math.sign(dx) === Math.sign(inner) ? 1 : 0;
        M.dot(ex + dx, by - lift, MAT.brow);
      }
    } else if (mid) {
      if (eyes === "closed" || eyes === "happy") M.dot(ex, ey, MAT.eye), M.dot(ex - 1, ey, MAT.eye);
      else M.dot(ex, ey - 1, MAT.eye), M.dot(ex, ey, MAT.eye);
    } else {
      M.dot(ex, ey, MAT.eye);
    }
    // 腮红（抖动：0–1）
    if (mid && pose.blush > 0) {
      const k = pose.blush;
      for (let dx = -1; dx <= (big ? ew - 1 : 0); dx++) if (bayer(ex + dx, ey + 2) < k) M.dot(ex + dx - (n === 0 ? 0 : f), ey + (big ? eh : 2), MAT.blush);
    }
  }
  // 嘴
  const mx = Math.round(hx + f * 0.3 * rx);
  const my = Math.round(hy + 0.6 * ry);
  const mouth = pose.mouth || "line";
  if (big) {
    if (mouth === "smile") (H >= 180 ? [[-2, -1], [-1, 0], [0, 0], [1, 0], [2, -1]] : [[-1, -1], [0, 0], [1, 0], [2, -1]]).forEach(([dx, dy]) => M.dot(mx + f * dx, my + dy, MAT.mouth));
    else if (mouth === "open") [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([dx, dy]) => M.dot(mx + f * dx, my + dy, MAT.mouth));
    else if (mouth === "o") M.dot(mx, my, MAT.mouth), M.dot(mx, my + 1, MAT.mouth);
    else M.dot(mx, my, MAT.mouth), M.dot(mx + f, my, MAT.mouth);
  } else if (mid) {
    M.dot(mx, my, MAT.mouth);
    if (mouth === "smile" || mouth === "open") M.dot(mx + f, my, MAT.mouth);
  }
}

/**
 * 给一个人打光（主光 + 一个副光），画进 fg。lights 按对这个人的影响排序后取前两个。
 * 白天、黄昏时（ENV）：亮面偏太阳色、暗面偏天光色；主光是太阳且太阳低时按逆光处理（正面压暗、亮边更亮）。
 */
export function shadePerson(R, lights, fg, emis) {
  const cx = R.M.x0 + R.M.w / 2;
  const cy = R.M.y0 + R.M.h / 2;
  const ranked = lights
    .filter(Boolean)
    .map((l) => ({ ...l, k: l.k * Math.max(0, 1 - Math.hypot(l.x - cx, l.y - cy) / l.r) }))
    .filter((l) => l.k > 0.02)
    .sort((a, b) => b.k - a.k);
  const back = ENV && ranked[0] && ranked[0].dir && !ranked[0].fill ? ENV.back : 0;
  shade(R.M, MATS, ranked.slice(0, 2), fg, { emis, outline: PAL.outline, back, grade: ENV ? ENV.grade : null });
  return ranked;
}

/**
 * 人在地上的影子（白天、黄昏有太阳时）：把材质图里每个像素按高度投到地面 ground（屏幕 y）上，画进 bg。
 * 太阳越低影子越长；方向和深浅由 ENV.shadow 给。要在画人（fg）之前、背景画完之后调用。
 */
export function castShadow(bg, R, ground) {
  if (!ENV || ENV.shadow.a < 0.03) return;
  const { sx, sy, a, c } = ENV.shadow;
  const M = R.M;
  const hit = new Uint8Array(LW * LH);
  for (let j = 0; j < M.h; j++)
    for (let i = 0; i < M.w; i++) {
      if (!M.m[j * M.w + i]) continue;
      const X = M.x0 + i;
      const h = ground - (M.y0 + j);
      if (h < 0) continue;
      const x1 = X + h * sx;
      const y1 = ground + h * sy;
      const x2 = X + (h + 1) * sx;
      const y2 = ground + (h + 1) * sy;
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));
      for (let q = 0; q <= n; q++) {
        const px = Math.floor(x1 + ((x2 - x1) * q) / n);
        const py = Math.floor(y1 + ((y2 - y1) * q) / n);
        if (px >= 0 && py >= 0 && px < LW && py < LH) hit[py * LW + px] = 1;
      }
    }
  for (let i = 0; i < hit.length; i++) if (hit[i]) bg.put(i % LW, (i / LW) | 0, c, a);
}

/**
 * 透明雨伞：伞柄从手里往上，伞面是半透明的玻璃色（看得见后面的光），伞骨、伞沿亮边、伞面上的水珠、
 * 迎着主光的一点高光，伞沿每根伞骨的尖上往下滴水。theta = 伞往哪边歪（弧度，0 = 竖直，负 = 往左）。
 * 返回伞底下的"干区" { x0, x1, y0, y1 }（交给 rain/splashes 的 dry）。
 */
export function umbrella(fg, emis, T, hand, H, theta, key, { ground, len = 0.5, rx = 0.36, ry = 0.15, seed = 5, part = "all" } = {}) {
  const Ls = len * H;
  const ux = Math.sin(theta);
  const uy = -Math.cos(theta);
  const ax = hand[0] + ux * Ls;
  const ay = hand[1] + uy * Ls;
  // 伞柄（含手下面一小截弯钩）。part = "shaft" 只画伞柄（在人后面先画），"canopy" 只画伞面（在人前面后画）
  if (part !== "canopy") {
    fg.line(hand[0] - ux * 0.06 * H, hand[1] - uy * 0.06 * H, ax, ay, MATS[MAT.handle].ramp[2]);
    if (H > 120) fg.line(hand[0] - ux * 0.06 * H + 1, hand[1] - uy * 0.06 * H, ax + 1, ay, MATS[MAT.handle].ramp[3]);
  }
  if (part === "shaft") return null;
  const RX = rx * H;
  const RY = ry * H;
  const cs = Math.cos(theta);
  const sn = Math.sin(theta);
  const toLocal = (x, y) => [(x - ax) * cs + (y - ay) * sn, -(x - ax) * sn + (y - ay) * cs];
  const toWorld = (lx, ly) => [ax + lx * cs - ly * sn, ay + lx * sn + ly * cs];
  const edge = (lx) => RY - 0.13 * RY * Math.abs(Math.sin((lx / RX) * Math.PI * 3));
  const R = Math.ceil(RX + 2);
  const kc = key ? key.c : PAL.glassRim;
  for (let y = Math.floor(ay - R); y <= ay + R; y++)
    for (let x = Math.floor(ax - R); x <= ax + R; x++) {
      const [lx, ly] = toLocal(x + 0.5, y + 0.5);
      if (ly < -0.5 || (lx / RX) ** 2 + ((ly - RY) / RY) ** 2 > 1 || ly > edge(lx)) continue;
      let c = mixc(PAL.glass, kc, 0.18);
      let a = 0.14 + 0.14 * (1 - ly / RY);
      if (ly > edge(lx) - 1.3) (c = PAL.glassRim), (a = 0.85);
      for (const k of [-1, -0.5, 0, 0.5, 1]) if (Math.abs(lx - k * RX * Math.sqrt(Math.max(0, ly) / RY)) < 0.55) (c = PAL.glassRim), (a = Math.max(a, 0.42));
      fg.put(x, y, c, a);
      if (key && key.dir) emis.add(x, y, key.c, (a > 0.4 ? 0.22 : 0.05) * key.k); // 逆光里整把伞透着光
    }
  // 水珠
  for (let i = 0; i < 26; i++) {
    const u = hash2(i, seed) * 2 - 1;
    const v = 0.15 + hash2(i, seed + 1) * 0.8;
    const lx = u * RX * Math.sqrt(1 - (1 - v) ** 2) * 0.95;
    const ly = RY * v;
    if (ly > edge(lx) - 1.5) continue;
    const [x, y] = toWorld(lx, ly);
    fg.put(x, y, PAL.rainHi, 0.75);
  }
  // 迎光高光
  if (key) {
    const dx = key.x - ax;
    const dy = key.y - (ay + RY * 0.5);
    const n = Math.hypot(dx, dy) || 1;
    const [gx, gy] = toWorld(((dx / n) * cs + (dy / n) * sn) * RX * 0.62, RY * 0.38);
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) {
      fg.put(gx + ox, gy + oy, PAL.lampCore, 0.8 * key.k);
      emis.add(gx + ox, gy + oy, key.c, 0.5 * key.k);
    }
  }
  // 伞骨尖上滴水
  const tips = [-1, -0.5, 0, 0.5, 1].map((k) => toWorld(k * RX * 0.98, edge(k * RX * 0.98)));
  tips.forEach(([tx, ty], i) => {
    const p = 0.5 + hash2(i, seed + 2) * 0.3;
    const a = (T + hash2(i, seed + 3) * p) % p;
    const yy = ty + a * 220;
    if (ground && yy > ground) return;
    fg.put(tx, yy, PAL.rainHi, 0.9);
    fg.put(tx, yy + 1, PAL.rainHi, 0.6);
  });
  const xs = tips.map((t) => t[0]);
  return { x0: Math.min(...xs) + 2, x1: Math.max(...xs) - 2, y0: Math.min(...tips.map((t) => t[1])), y1: ground ?? 999 };
}

/**
 * 两节手臂的反向求解：让 side（"n" 近侧 / "f" 远侧）这只手够到 target（屏幕坐标），返回 [a, b] 交给 pose.armN / armF。
 * 够不着就伸直指向它。用来让两个人的手正好牵在一起、手正好碰到某个东西。
 */
export function reachTo(look, x, y, H, f, side, target, bob = 0) {
  const sh = look.outfit === "coat" ? -0.765 : -0.775;
  const S = [x + f * (side === "n" ? 0.068 : -0.052) * H, y + bob + (sh + 0.016) * H];
  const L1 = 0.165 * H;
  const L2 = 0.15 * H;
  const dx = (target[0] - S[0]) * f;
  const dy = target[1] - S[1];
  const d = Math.min(L1 + L2 - 0.01, Math.max(Math.abs(L1 - L2) + 0.01, Math.hypot(dx, dy)));
  const phi = Math.atan2(dx, dy);
  const alpha = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
  const gamma = Math.acos((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2));
  return [phi - alpha, Math.PI - gamma];
}
