// 街景的零件。世界坐标 = 全景镜头时的低分辨率像素（480×270）。镜头用 camera(x, y, z)，每一层按深度 d 视差：
//   d = 0 天空不动；0.15 远处楼群；0.5 公寓、便利店；0.75 马路和车；1 人行道、路灯、人物（主体平面）
// 每个零件都画进 bg（背景层）和 emis（发光层），会发光的零件返回光源 { x, y, c, k, r }（屏幕坐标），给人物打光、给雨上色。
// 什么时间、什么天气由 env.js 的 ENV 决定：窗灯亮几盏、路灯和车灯开没开、白天的窗反射天空、太阳和云、杆子的影子。
// 夜里（ENV.world = 0）每个零件画出来都和原来的夜雨版一样。
import { LW, LH, bayer, mixc, inEllipse } from "./px.js";
import { PAL } from "./palette.js";
import { ENV } from "./env.js";
import { mulberry32, hash2, clamp01 } from "./util.js";

const WK = () => (ENV ? ENV.world : 0);
const scaleC = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

export function camera(x, y, z) {
  return {
    x,
    y,
    z,
    L(d) {
      const zd = 1 + (z - 1) * d;
      const lx = LW / 2 + (x - LW / 2) * d;
      const ly = LH / 2 + (y - LH / 2) * d;
      return { z: zd, d, s: (wx, wy) => [(wx - lx) * zd + LW / 2, (wy - ly) * zd + LH / 2] };
    },
  };
}

/** 世界坐标的矩形 → 屏幕上整像素的矩形（至少 1 像素） */
function srect(L, wx, wy, ww, wh) {
  const [x0, y0] = L.s(wx, wy);
  const [x1, y1] = L.s(wx + ww, wy + wh);
  const X0 = Math.round(x0);
  const Y0 = Math.round(y0);
  return [X0, Y0, Math.max(1, Math.round(x1) - X0), Math.max(1, Math.round(y1) - Y0)];
}

// ---------- 天空 ----------
let SKYSTATE = null;
/**
 * 天空：渐变（夜里 7 档紫，白天蓝，黄昏橙粉）+ 细云。白天再加几朵积云（迎着太阳那一侧亮）和太阳：
 * 日盘是锐利的像素圆，周围一圈抖动的暖色光晕。光晕要等前面的楼都画完，只加到还看得见的天空上（main.js 调 skyLight）。
 */
export function sky(bg, emis, T, { horizon = 168, clouds = 7, seed = 3 } = {}) {
  const S = PAL.sky;
  for (let y = 0; y < LH; y++) {
    const f = clamp01(y / horizon) * (S.length - 1);
    const i = Math.floor(f);
    const fr = f - i;
    for (let x = 0; x < LW; x++) bg.put(x, y, fr > bayer(x, y) && i + 1 < S.length ? S[i + 1] : S[i]);
  }
  const r = mulberry32(seed);
  for (let k = 0; k < clouds; k++) {
    const y = Math.round(18 + r() * 90);
    const len = 40 + r() * 150;
    const x = ((r() * 700 + T * (2 + r() * 3)) % 700) - 110;
    for (let i = 0; i < len; i++) {
      const edge = Math.min(i, len - i) / 14;
      if (bayer(x + i, y) < edge) bg.put(x + i, y, PAL.cloud);
      if (r() < 0.004) continue;
      if (i > 8 && i < len - 8 && bayer(x + i, y - 1) < edge * 0.5) bg.put(x + i, y - 1, PAL.cloudHi);
    }
  }
  SKYSTATE = null;
  const E = ENV;
  if (!E || E.world <= 0.01) return; // 夜里到这里为止
  puffs(bg, T, E, seed);
  const glow = new Float32Array(LW * LH);
  if (E.sun && E.sunPos[1] < horizon + 8) {
    const [sx, sy] = E.sunPos;
    const R = 72;
    for (let y = Math.max(0, Math.floor(sy - R)); y < Math.min(LH, sy + R); y++)
      for (let x = Math.max(0, Math.floor(sx - R)); x < Math.min(LW, sx + R); x++) {
        const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / R;
        if (d >= 1) continue;
        const g = (1 - d) ** 2.2 * E.sunK;
        glow[y * LW + x] = g;
        if (bayer(x, y) < g * 1.5) {
          const o = bg.get(x, y);
          bg.put(x, y, mixc(o, E.sunC, Math.min(1, 0.3 + g)));
        }
      }
    const r0 = 5.5;
    bg.fill(inEllipse(sx, sy, r0, r0), sx - r0 - 1, sy - r0 - 1, sx + r0 + 1, sy + r0 + 1, mixc(E.sunC, [255, 250, 232], 0.7));
    bg.fill(inEllipse(sx, sy, r0 - 1.6, r0 - 1.6), sx - r0, sy - r0, sx + r0, sy + r0, [255, 254, 246]);
  }
  SKYSTATE = { snap: bg.d.slice(), glow };
}

/** 白天的积云：几个椭圆拼成一朵，平底；朝太阳那一侧 2 像素是亮边，底下一截是暗面 */
function puffs(bg, T, E, seed) {
  const r = mulberry32(seed + 101);
  const [sx, sy] = E.sunPos;
  const lit = mixc([255, 255, 255], E.sunC, 0.3 + 0.45 * E.golden);
  const base = mixc(PAL.cloud, E.sky[3], 0.22 + 0.3 * E.golden);
  const dark = mixc(mixc(E.sky[2], E.amb, 0.4), [200, 200, 215], 0.25 * E.overcast);
  const n = E.overcast ? 9 : 4;
  for (let k = 0; k < n; k++) {
    const cx = ((r() * 680 + T * (1.2 + r() * 1.8)) % 680) - 100;
    const cy = 26 + r() * 64;
    const w = 44 + r() * 70;
    const h = 9 + r() * 9;
    const blobs = Array.from({ length: 5 }, (_, i) => [cx + (i - 2) * w * 0.17 + (r() - 0.5) * 6, cy - Math.sin((i / 4) * Math.PI) * h * 0.55 + (r() - 0.5) * 3, w * (0.17 + r() * 0.08), h * (0.5 + r() * 0.3)]);
    const inside = (x, y) => y <= cy + h * 0.32 && blobs.some(([bx, by, rx, ry]) => ((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 <= 1);
    for (let y = Math.floor(cy - h * 1.6); y <= cy + h * 0.4; y++)
      for (let x = Math.floor(cx - w * 0.75); x <= cx + w * 0.75; x++) {
        if (x < 0 || y < 0 || x >= LW || y >= LH || !inside(x + 0.5, y + 0.5)) continue;
        const dx = sx - x;
        const dy = sy - y;
        const dn = Math.hypot(dx, dy) || 1;
        const edge = !inside(x + 0.5 + (dx / dn) * 2.2, y + 0.5 + (dy / dn) * 2.2);
        const low = (y - (cy - h * 0.2)) / (h * 0.5);
        let c = base;
        if (edge) c = lit;
        else if (low > bayer(x, y)) c = dark;
        bg.put(x, y, c);
      }
  }
}

/**
 * 在所有图层画完之后调用（main.js 里）：太阳的光晕只加到没被楼、人挡住的天空上，写进发光层。
 * 返回"看得见的太阳光"（480×270 的 0–1），后期拿它做光柱；没有太阳就返回 null。
 */
export function skyLight(bg, fg, emis) {
  if (!SKYSTATE || !ENV || !ENV.sun) return null;
  const { snap, glow } = SKYSTATE;
  const B = bg.d;
  const F = fg.d;
  const src = new Float32Array(LW * LH);
  const c = ENV.sunC;
  let any = false;
  for (let i = 0; i < glow.length; i++) {
    const g = glow[i];
    if (g < 0.004) continue;
    const q = i * 4;
    if (F[q + 3] > 0 || B[q] !== snap[q] || B[q + 1] !== snap[q + 1] || B[q + 2] !== snap[q + 2]) continue;
    src[i] = g;
    any = true;
    emis.add(i % LW, (i / LW) | 0, c, 0.9 * g);
  }
  // 地平线附近很亮的天也算光源：楼挡住它的地方，光柱就断开
  for (let i = 0; i < glow.length; i++) {
    const q = i * 4;
    if (F[q + 3] > 0 || B[q] !== snap[q] || B[q + 1] !== snap[q + 1] || B[q + 2] !== snap[q + 2]) continue;
    const l = (0.299 * B[q] + 0.587 * B[q + 1] + 0.114 * B[q + 2]) / 255;
    if (l > 0.62) (src[i] += 0.45 * (l - 0.62) / 0.38), (any = true);
  }
  return any ? src : null;
}

/** 空气透视：before 是画这一层之前 bg 的快照（snap(bg)），只给这一层新画上的像素蒙一层天色；amount 越大越"远" */
export const snap = (bg) => (ENV && ENV.veil.k > 0.002 ? bg.d.slice() : null);
export function aerial(bg, before, amount = 1) {
  if (!before || !ENV) return;
  const a = Math.min(0.9, ENV.veil.k * amount);
  const c = ENV.veil.c;
  const D = bg.d;
  for (let i = 0; i < D.length; i += 4) {
    if (D[i] === before[i] && D[i + 1] === before[i + 1] && D[i + 2] === before[i + 2]) continue;
    D[i] += (c[0] - D[i]) * a;
    D[i + 1] += (c[1] - D[i + 1]) * a;
    D[i + 2] += (c[2] - D[i + 2]) * a;
  }
}

/** 杆子在地上的影子（白天）：从杆脚往太阳反方向拉一条，宽 w 像素 */
function poleShadow(bg, L, x, base, h, w = 1) {
  if (!ENV || ENV.shadow.a < 0.03) return;
  const { sx, sy, a, c } = ENV.shadow;
  const [px, py] = L.s(x, base);
  const ex = px + h * L.z * sx;
  const ey = py + h * L.z * sy;
  const n = Math.ceil(Math.hypot(ex - px, ey - py)) + 1;
  const seen = new Set();
  for (let i = 0; i <= n; i++)
    for (let k = 0; k < w; k++) {
      const X = Math.floor(px + ((ex - px) * i) / n) + k;
      const Y = Math.floor(py + ((ey - py) * i) / n);
      if (X < 0 || Y < 0 || X >= LW || Y >= LH || seen.has(Y * LW + X)) continue;
      seen.add(Y * LW + X);
      bg.put(X, Y, c, a);
    }
}

// ---------- 楼和窗 ----------
/** 远处楼群：一排剪影，窗户是 1–2 像素的灯点，偶尔有一盏换亮灭；楼顶天线闪红灯 */
export function skyline(bg, emis, L, T, { seed = 11, x0 = -120, x1 = 620, base = 156, hMin = 34, hMax = 104 } = {}) {
  const r = mulberry32(seed);
  let x = x0;
  let id = 0;
  while (x < x1) {
    const w = 16 + Math.floor(r() * 34);
    const h = hMin + Math.floor(r() * (hMax - hMin));
    const col = PAL.bldFar[Math.floor(r() * 3)];
    const [X, Y, Wd, Hd] = srect(L, x, base - h, w, h);
    bg.rect(X, Y, Wd, Hd, col);
    for (let wy = base - h + 4; wy < base - 3; wy += 4)
      for (let wx = x + 2; wx < x + w - 2; wx += 3) {
        id++;
        const lit = hash2(id, seed) < 0.26 * (ENV ? ENV.winLit : 1) && hash2(id, Math.floor(T * 0.4 + hash2(id, 7) * 9)) > 0.04;
        if (!lit) continue;
        const [sx, sy, sw, sh] = srect(L, wx, wy, 1.2, 1.6);
        const c = hash2(id, 3) < 0.82 ? PAL.winWarm[Math.floor(hash2(id, 4) * 4)] : PAL.winCool[Math.floor(hash2(id, 5) * 2)];
        bg.rect(sx, sy, sw, sh, c);
        emis.addRect(sx, sy, sw, sh, c, 0.35 + 0.4 * hash2(id, 6));
      }
    if (h > 80 && r() < 0.6) {
      const ax = x + Math.floor(w / 2);
      const [sx, sy] = L.s(ax, base - h);
      const [, sy2] = L.s(ax, base - h - 9);
      for (let yy = Math.round(sy2); yy < Math.round(sy); yy++) bg.put(sx, yy, PAL.bldEdge);
      if ((T + r() * 2) % 1.6 < 0.8) {
        bg.put(sx, sy2, PAL.tail);
        emis.add(sx, sy2, PAL.tail, 0.9);
      }
    }
    x += w + Math.floor(r() * 3);
  }
}

/**
 * 公寓楼：大窗户，亮着的窗在放大的镜头里多一圈暗暖色的光边（像素里的"朦胧"），发光层再给一圈泛光。
 * rect = [x, y, w, h]（世界坐标，h 到地面）。返回最亮的一扇窗作为光源。
 */
export function apartment(bg, emis, L, T, { rect = [-60, 24, 206, 132], seed = 21, lit = 0.42 } = {}) {
  const [x, y, w, h] = rect;
  const [X, Y, Wd, Hd] = srect(L, x, y, w, h);
  bg.rect(X, Y, Wd, Hd, PAL.bldMid[1]);
  bg.rect(X + Wd - 1, Y, 1, Hd, PAL.bldEdge);
  for (let fy = y + 10; fy < y + h - 6; fy += 13) {
    const [, by] = L.s(x, fy + 9);
    bg.rect(X, Math.round(by), Wd, 1, PAL.bldMid[2]);
  }
  let best = null;
  let id = 0;
  for (let fy = y + 6; fy < y + h - 14; fy += 13)
    for (let fx = x + 6; fx < x + w - 8; fx += 12) {
      id++;
      const on = hash2(id, seed) < lit * (ENV ? ENV.winLit : 1);
      const [sx, sy, sw, sh] = srect(L, fx, fy, 6, 7);
      if (!on) {
        const wk = WK();
        if (wk <= 0) {
          bg.rect(sx, sy, sw, sh, PAL.bldMid[0]);
          continue;
        }
        // 白天不亮的窗：玻璃映着天，上半截更亮，中间一根窗框；有几扇正好把太阳反射过来，闪一点
        // 逆光时窗映的是身后（东边）偏冷的天，不是太阳那边
        const bl = Math.min(1, ENV.back / 0.6);
        const glass = mixc(PAL.bldMid[0], mixc(PAL.sky[3], ENV.amb, 0.5 * bl), 0.62 * wk);
        bg.rect(sx, sy, sw, sh, glass);
        bg.rect(sx, sy, sw, Math.max(1, Math.round(sh * 0.35)), mixc(glass, mixc(PAL.sky[5], ENV.amb, 0.6 * bl), 0.55 * wk));
        if (sw >= 4) bg.rect(sx + Math.floor(sw / 2), sy, 1, sh, mixc(glass, PAL.bldMid[1], 0.6));
        if (ENV.sunK > 0.3 && hash2(id, seed + 9) < 0.14) {
          const gx = sx + Math.floor(sw * 0.25);
          for (let q = 0; q < (L.z > 1.5 ? 2 : 1); q++) {
            bg.put(gx + q, sy + 1, [255, 250, 236]);
            emis.add(gx + q, sy + 1, ENV.sunC, (1.4 - 0.4 * q) * ENV.sunK);
          }
        }
        continue;
      }
      const c = hash2(id, seed + 1) < 0.85 ? PAL.winWarm[Math.floor(hash2(id, seed + 2) * 4)] : PAL.winCool[0];
      if (L.z > 1.25) bg.rect(sx - 1, sy - 1, sw + 2, sh + 2, mixc(PAL.bldMid[1], c, 0.28));
      bg.rect(sx, sy, sw, sh, c);
      // 窗帘：一半窗户上半截拉着（暗一点）
      if (hash2(id, seed + 3) < 0.45) bg.rect(sx, sy, sw, Math.max(1, Math.floor(sh * 0.45)), mixc(c, PAL.bldMid[1], 0.45));
      emis.addRect(sx, sy, sw, sh, c, 0.55);
      if (!best || hash2(id, seed + 4) > 0.9) best = { x: sx + sw / 2, y: sy + sh / 2, c, k: 0.25, r: 90 * L.z };
    }
  return best;
}

/** 便利店：一整条冷白色的橱窗（很亮，泛光大），橱窗里货架剪影，门头上一个粉色霓虹小杯子（闪） */
export function store(bg, emis, L, T, { rect = [330, 66, 160, 90] } = {}) {
  const [x, y, w, h] = rect;
  const [X, Y, Wd, Hd] = srect(L, x, y, w, h);
  bg.rect(X, Y, Wd, Hd, PAL.bldMid[2]);
  const winY = y + h - 34;
  const [wx, wy, ww, wh] = srect(L, x + 6, winY, w - 12, 30);
  bg.rect(wx, wy, ww, wh, PAL.store);
  const dim = 1 - 0.55 * WK(); // 白天店里的灯显得没那么亮
  emis.addRect(wx, wy, ww, wh, PAL.store, 0.32 * dim);
  for (let fx = x + 6; fx < x + w - 6; fx += 26) {
    const [a, b, c, d] = srect(L, fx, winY, 1.5, 30);
    bg.rect(a, b, c, d, PAL.bldMid[0]);
  }
  {
    const [a, b, c, d] = srect(L, x + 6, winY + 9, w - 12, 1);
    bg.rect(a, b, c, d, PAL.storeDim);
  }
  for (let sx = x + 12; sx < x + w - 14; sx += 9) {
    const [a, b, c, d] = srect(L, sx, winY + 9, 5, 21);
    bg.rect(a, b, c, d, PAL.storeDim);
  }
  const [px] = L.s(x + w * 0.62 + Math.sin(T * 0.3) * 4, 0);
  const [, py0] = L.s(0, winY + 8);
  const [, py1] = L.s(0, winY + 30);
  bg.rect(Math.round(px), Math.round(py0), Math.max(2, Math.round(3 * L.z)), Math.round(py1 - py0), mixc(PAL.storeDim, PAL.outline, 0.5));
  // 霓虹杯子（9×8 世界像素的小图标）
  const on = !(T % 3.1 > 2.85 && T % 3.1 < 2.95);
  const cup = ["  # # #  ", " # # #   ", "         ", "#######  ", "#     ###", "#     # #", "#     ###", " #####   "];
  const ox = x + 14;
  const oy = y + 12;
  cup.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch !== "#") return;
      const [a, b, c, d] = srect(L, ox + i, oy + j, 1, 1);
      bg.rect(a, b, c, d, on ? PAL.neon : mixc(PAL.neon, PAL.bldMid[2], 0.7));
      if (on) emis.addRect(a, b, c, d, PAL.neon, 0.9 * (1 - 0.5 * WK()));
    }),
  );
  const [cx, cy] = L.s(x + w / 2, winY + 15);
  return [
    { x: cx, y: cy, c: PAL.store, k: 0.55 * (1 - 0.6 * WK()), r: 170 * L.z },
    on ? { ...{ c: PAL.neon }, x: L.s(ox + 4, oy)[0], y: L.s(ox + 4, oy + 4)[1], k: 0.3 * (1 - 0.5 * WK()), r: 80 * L.z } : null,
  ];
}

// ---------- 马路和车 ----------
/** 马路：沥青 + 车道虚线；cars = [{ x0, v, t0, lane: 车底的 y, color, len }]，v > 0 向右开。返回车灯光源。 */
export function road(bg, emis, L, T, { top = 152, bottom = 187, cars = [] } = {}) {
  const [, y0] = L.s(0, top);
  const [, y1] = L.s(0, bottom);
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(LH, Math.round(y1)); y++)
    for (let x = 0; x < LW; x++) bg.put(x, y, bayer(x * 3, y * 7) < 0.12 ? PAL.asphalt2 : PAL.asphalt);
  for (let wx = -400; wx < 900; wx += 26) {
    const [a, b, c] = srect(L, wx, 170, 12, 1);
    bg.rect(a, b, c, 1, PAL.lane);
  }
  const lights = [];
  for (const car of cars) {
    const dir = Math.sign(car.v) || 1;
    const len = car.len || 46;
    const cx = car.x0 + car.v * (T - (car.t0 || 0));
    const yb = car.lane;
    const wk = WK();
    const hl = ENV ? ENV.carLights : 1;
    const body0 = car.color || [42, 36, 56];
    const body = wk > 0 ? mixc(body0, scaleC(body0, 2.3), wk) : body0; // 白天车身亮一些
    const back = cx - dir * len / 2;
    if (car.bus) {
      // 公交车：高车身、一排亮着的暖色车窗（有乘客剪影）、车头上方的橙色线路牌
      const [a, b, c, d] = srect(L, cx - len / 2, yb - 26, len, 24);
      bg.rect(a, b, c, d, body);
      bg.rect(a, b, c, 1, mixc(body, wk > 0 ? ENV.sunC : PAL.lamp, 0.4 + 0.2 * wk));
      let id = 0;
      for (let wx = cx - len / 2 + 6; wx < cx + len / 2 - 12; wx += 10) {
        id++;
        const [p, q, r, s2] = srect(L, wx, yb - 22, 8, 9);
        const wc = PAL.winWarm[id % 4];
        bg.rect(p, q, r, s2, mixc(mixc(wc, body, 0.25), PAL.sky[4], 0.55 * wk)); // 白天车窗映着天
        emis.addRect(p, q, r, s2, wc, 0.3 * (1 - 0.65 * wk));
        if (hash2(id, 77) < 0.25) {
          const [u, v2, ww, hh] = srect(L, wx + 2 + hash2(id, 78) * 3, yb - 19, 3, 6);
          bg.rect(u, v2, ww, hh, mixc(body, PAL.outline, 0.5));
        }
      }
      const [sx, sy, sw, sh] = srect(L, cx + dir * (len / 2 - 14) - 5, yb - 25, 10, 3);
      bg.rect(sx, sy, sw, sh, PAL.lamp);
      emis.addRect(sx, sy, sw, sh, PAL.lamp, 0.8 * (1 - 0.4 * wk));
      for (const wx of [-len * 0.32, len * 0.3]) {
        const [p, q, r, s2] = srect(L, cx + wx - 4, yb - 4, 8, 4);
        bg.rect(p, q, r, s2, [10, 8, 14]);
      }
      const [mx, my] = L.s(cx, yb - 18);
      lights.push({ x: mx, y: my, c: PAL.winWarm[0], k: 0.5 * (1 - 0.6 * wk), r: 120 * L.z });
    } else {
    // 车身：下半截车体 + 上半截车厢（车窗带反光点）+ 轮子
    for (const [ox, oy, w, h, col] of [
      [-len / 2, -9, len, 6, body],
      [-len * 0.3, -14, len * 0.55, 5, mixc(body, [10, 8, 16], 0.3)],
    ]) {
      const [a, b, c, d] = srect(L, cx + (dir > 0 ? ox : -ox - w), yb + oy, w, h);
      bg.rect(a, b, c, d, col);
    }
    const [ra, rb, rc] = srect(L, cx - len * 0.28, yb - 9, len * 0.56, 1);
    bg.rect(ra, rb, rc, 1, mixc(body, wk > 0 ? ENV.sunC : PAL.lamp, 0.35 + 0.3 * wk));
    if (wk > 0 && ENV.sunK > 0.3) emis.addRect(ra + rc * 0.4, rb, Math.max(1, rc * 0.2), 1, ENV.sunC, 0.9 * ENV.sunK); // 车顶反光
    for (const wx of [-len * 0.3, len * 0.3]) {
      const [a, b, c, d] = srect(L, cx + wx - 3, yb - 3, 6, 3);
      bg.rect(a, b, c, d, [10, 8, 14]);
    }
    }
    const [hx, hy] = L.s(cx + dir * len / 2, yb - 6);
    const [tx, ty] = L.s(back, yb - 6);
    // 车灯 + 拖影（越快越长）+ 前方光锥
    const smear = Math.min(40, Math.abs(car.v) * 0.06) * L.z * hl;
    const tl = Math.max(hl, 0.35); // 尾灯白天也微微亮
    for (let i = 0; i < smear; i++) {
      const k = 1 - i / smear;
      emis.add(hx - dir * i, hy, PAL.head, 0.5 * k * k);
      emis.add(tx - dir * i, ty, PAL.tail, 0.45 * k * k);
    }
    bg.rect(hx - 1, hy - 1, 2, 2, hl >= 1 ? PAL.head : mixc([196, 196, 188], PAL.head, hl));
    emis.addRect(hx - 1, hy - 1, 2, 2, PAL.head, 1.2 * hl);
    bg.rect(tx - 1, ty - 1, 2, 2, tl >= 1 ? PAL.tail : mixc([120, 40, 50], PAL.tail, tl));
    emis.addRect(tx - 1, ty - 1, 2, 2, PAL.tail, 0.9 * tl);
    const beam = hl > 0.05 ? 70 * L.z : 0;
    for (let i = 2; i < beam; i++) {
      const spread = 1 + i * 0.18;
      for (let j = -spread; j <= spread; j++) {
        const k = (1 - i / beam) * (1 - Math.abs(j) / (spread + 1));
        if (bayer(hx + dir * i, hy + j) < k * 0.5 * hl) emis.add(hx + dir * i, hy + j, PAL.head, 0.06 * k);
      }
    }
    lights.push({ x: hx, y: hy, c: PAL.head, k: 0.95 * hl, r: 150 * L.z }, { x: tx, y: ty, c: PAL.tail, k: 0.45 * tl, r: 70 * L.z });
  }
  return lights;
}

// ---------- 人行道 ----------
export const PUDDLES = [[150, 252, 36, 6], [304, 263, 48, 7], [418, 244, 30, 5], [86, 232, 22, 4], [236, 286, 60, 9]];
/** 路沿 + 湿的人行道（砖缝、抖动纹理）+ 水洼。返回"湿度"函数：水洼里 1，其它地方 0.35，给倒影用。 */
export function sidewalk(bg, L, { top = 188, puddles = PUDDLES } = {}) {
  const [, cy] = L.s(0, top);
  const Y0 = Math.round(cy);
  const curbH = Math.max(1, Math.round(3 * L.z));
  bg.rect(0, Y0 - curbH, LW, curbH, PAL.curb);
  bg.rect(0, Y0 - curbH, LW, 1, PAL.curbTop);
  const pz = puddles.map(([x, y, rx, ry]) => {
    const [sx, sy] = L.s(x, y);
    return inEllipse(sx, sy, rx * L.z, ry * L.z);
  });
  const seamX = 24 * L.z;
  const [ox] = L.s(0, 0);
  for (let y = Math.max(0, Y0); y < LH; y++)
    for (let x = 0; x < LW; x++) {
      const pf = pz.find((f) => f(x + 0.5, y + 0.5));
      if (pf) {
        bg.put(x, y, pf(x + 0.5, y - 0.5) ? PAL.puddle : PAL.puddleRim);
        continue;
      }
      const b = bayer(x, y);
      const bz = bayer(Math.floor((x - ox) / Math.max(1, Math.round(L.z))), Math.floor(y / Math.max(1, Math.round(L.z))));
      let c = bz < 0.12 ? PAL.walk2 : PAL.walk;
      if (bz > 0.96) c = PAL.walk3;
      if (Math.abs(((x - ox) % seamX + seamX) % seamX) < 1 || (y - Y0) % Math.max(4, Math.round(10 * L.z)) === 0) c = PAL.seam;
      bg.put(x, y, c);
    }
  return (x, y) => (y < Y0 ? (y > Y0 - 40 * L.z ? 0.3 : 0) : pz.some((f) => f(x + 0.5, y + 0.5)) ? 1 : 0.35);
}

/**
 * 倒影：把发光层里横线 axis 以上的东西，竖着拉长、左右晃，加到下面湿的地方（bg 和 emis 都加一点）。
 * 路灯、车灯、窗、信号灯都会自己在水里拉出一条条晃动的光。k < 1 = 拉长；wet(x, y) = 0–1 湿度。
 */
export function reflect(bg, emis, T, { axis, y0, y1, k = 0.5, wet = () => 0.4, gain = 0.9 } = {}) {
  const src = emis.d.slice();
  const W = emis.w;
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(LH, Math.round(y1)); y++) {
    const sy = Math.round(axis - (y - axis) * k);
    if (sy < 0 || sy >= LH) continue;
    if (hash2(y, Math.floor(T * 9)) < 0.22) continue; // 断开的水纹
    const fade = Math.pow(1 - (y - y0) / (y1 - y0 + 1), 0.8);
    const dx = Math.round(Math.sin(y * 0.9 + T * 4.5) * 1.3);
    for (let x = 0; x < LW; x++) {
      const sx = x + dx;
      if (sx < 0 || sx >= W) continue;
      const i = (sy * W + sx) * 4;
      const v = src[i] + src[i + 1] + src[i + 2];
      if (v < 30) continue;
      const w = wet(x, y) * fade * gain;
      if (w <= 0 || bayer(x, y) > w + 0.15) continue;
      const c = [src[i], src[i + 1], src[i + 2]];
      bg.add(x, y, c, 0.55 * w);
      emis.add(x, y, c, 0.22 * w);
    }
  }
}

// ---------- 路灯、信号灯 ----------
/** 路灯：杆 + 弯臂 + 灯头 + 往下的光锥（抖动的半透明三角）+ 地上一圈暖光。返回光源。 */
export function lamp(bg, emis, L, T, { x = 196, base = 192, h = 118, reach = 13, ground = 236 } = {}) {
  const [px, py0] = L.s(x, base);
  const [, py1] = L.s(x, base - h);
  const pw = Math.max(1, Math.round(2 * L.z));
  const on = ENV ? ENV.lampsOn : 1; // 天亮了就关
  poleShadow(bg, L, x, base, h, pw);
  bg.rect(px - pw / 2, py1, pw, py0 - py1, PAL.pole);
  bg.rect(px - pw / 2, py1, 1, py0 - py1, PAL.poleHi);
  const [hx, hy] = L.s(x + reach, base - h + 3);
  bg.line(px, py1, hx, py1, PAL.pole);
  bg.line(hx, py1, hx, hy, PAL.pole);
  const hw = Math.max(2, Math.round(4 * L.z));
  bg.rect(hx - hw / 2, hy, hw, Math.max(1, Math.round(1.5 * L.z)), on >= 1 ? PAL.lampCore : mixc([170, 170, 164], PAL.lampCore, on));
  emis.addRect(hx - hw / 2 - 1, hy - 1, hw + 2, Math.max(2, Math.round(2 * L.z)) + 1, PAL.lamp, 1.4 * on);
  const [, gy] = L.s(0, ground);
  const flick = 0.92 + 0.08 * Math.sin(T * 23) * Math.sin(T * 7);
  for (let y = Math.round(hy) + 1; y < Math.min(LH, gy); y++) {
    const f = (y - hy) / (gy - hy);
    const half = 3 + f * 30 * L.z;
    for (let x = Math.round(hx - half); x <= hx + half; x++) {
      const edge = 1 - Math.abs(x - hx) / half;
      const a = edge * (1 - f * 0.55) * 0.42 * flick * on;
      if (bayer(x, y) < a) emis.add(x, y, PAL.lamp, 0.12);
      if (bayer(x, y) < a * 0.7) bg.add(x, y, PAL.lamp, 0.08);
    }
  }
  for (let y = Math.round(gy - 10 * L.z); y < Math.min(LH, gy + 26 * L.z); y++)
    for (let x = Math.round(hx - 50 * L.z); x < hx + 50 * L.z; x++) {
      const e = 1 - Math.hypot((x - hx) / (50 * L.z), (y - gy) / (18 * L.z));
      if (e > 0 && bayer(x, y) < e * 0.7) bg.add(x, y, PAL.lamp, 0.07 * flick * on);
    }
  return { x: hx, y: hy, c: PAL.lamp, k: 1 * on, r: 260 * L.z };
}

/** 行人信号灯：杆 + 灯箱，上红下绿，亮的那格画一个小人（红色站着、绿色走路）。state: "red" | "green" */
export function walkSignal(bg, emis, L, T, { x = 318, base = 192, h = 46, state = "red" } = {}) {
  const [px, py0] = L.s(x, base);
  const [, py1] = L.s(x, base - h);
  const pw = Math.max(1, Math.round(1.5 * L.z));
  poleShadow(bg, L, x, base, h + 16, pw);
  bg.rect(px - pw / 2, py1, pw, py0 - py1, PAL.pole);
  const [bx, by, bw, bh] = srect(L, x - 4, base - h - 16, 8, 16);
  bg.rect(bx, by, bw, bh, [16, 13, 22]);
  const man = state === "red" ? ["  #  ", " ### ", "# # #", "  #  ", " # # ", " # # "] : ["  #  ", " ### ", "# #  ", "  ## ", " #  #", "#    "];
  const c = state === "red" ? PAL.red : PAL.green;
  const cellY = state === "red" ? base - h - 15 : base - h - 7.5;
  man.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch !== "#") return;
      const [a, b, w, hh] = srect(L, x - 2.5 + i, cellY + j * 1.1, 1, 1.1);
      bg.rect(a, b, w, hh, c);
      emis.addRect(a, b, w, hh, c, 1 - 0.45 * WK());
    }),
  );
  const [lx, ly] = L.s(x, cellY + 3);
  return { x: lx, y: ly, c, k: 0.45 * (1 - 0.45 * WK()), r: 130 * L.z };
}

// ---------- 雨 ----------
const DROPS = (() => {
  const r = mulberry32(42);
  return Array.from({ length: 520 }, (_, i) => ({ x: r() * (LW + 80) - 40, y: r() * (LH + 60), v: r(), layer: i < 260 ? 0 : i < 420 ? 1 : 2 }));
})();
/**
 * 雨：三层深度（远：1×2 暗淡、慢；中：1×4；近：1×7 亮、快，画在 fg 上，挡在人前面）。
 * 离光源近的雨丝被照亮、带上光的颜色。dry = [{ x0, x1, y0, y1 }]：伞底下这些区域不下中、近两层的雨。
 */
export function rain(bg, fg, T, lights, { dry = [], slant = 0.14, density = 1 } = {}) {
  const spec = [
    { len: 2, speed: 150, a: 0.45 },
    { len: 4, speed: 250, a: 0.6 },
    { len: 7, speed: 390, a: 0.85 },
  ];
  const N = Math.floor(DROPS.length * Math.min(1, density));
  for (let n = 0; n < N; n++) {
    const d = DROPS[n];
    const s = spec[d.layer];
    const span = LH + 60;
    const y = ((d.y + T * s.speed * (0.85 + 0.3 * d.v)) % span) - 30;
    const x = d.x - (y + 30) * slant;
    if (d.layer > 0 && dry.some((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)) continue;
    let c = PAL.rain;
    let a = s.a;
    for (const l of lights) {
      if (!l || l.fill) continue;
      let k;
      if (l.dir) {
        // 太阳：离太阳那一侧越近的雨丝越亮（逆光里的雨会发光）
        k = l.k * 0.34 * Math.max(0, 1 - Math.abs(x - l.sx) / 230);
        if (k <= 0.01) continue;
      } else {
        const dist = Math.hypot(x - l.x, y - l.y);
        if (dist > l.r) continue;
        k = l.k * (1 - dist / l.r) ** 2;
      }
      c = mixc(c, mixc(PAL.rainHi, l.c, 0.55), clamp01(k * 1.6));
      a = Math.min(1, a + k);
    }
    const out = d.layer === 2 ? fg : bg;
    for (let i = 0; i < s.len; i++) out.put(x + i * slant, y + i, c, a * (0.55 + 0.45 * (i / s.len)));
  }
}

/** 地上溅起的水花：小"∧"，一闪就没（每个位置 0.4 秒一轮，位置每轮换） */
export function splashes(fg, T, { x0 = 0, x1 = LW, y0, y1, n = 46, period = 0.42, dry = [], color = PAL.rainHi } = {}) {
  for (let i = 0; i < n; i++) {
    const ph = hash2(i, 1) * period;
    const j = Math.floor((T + ph) / period);
    const a = (T + ph) % period;
    if (a > 0.13) continue;
    const x = Math.round(x0 + hash2(i, j * 2 + 3) * (x1 - x0));
    const y = Math.round(y0 + hash2(i, j * 2 + 4) * (y1 - y0));
    if (dry.some((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1)) continue;
    const al = a < 0.06 ? 0.9 : 0.5;
    fg.put(x - 1, y, color, al);
    fg.put(x + 1, y, color, al);
    if (a < 0.07) fg.put(x, y - 1, color, al);
  }
}

/**
 * 光在湿地上的倒影：一条竖着往下拉长、左右晃、断断续续的光带（参考片里路灯下面那条黄色的晃动光）。
 * x：光源正下方的屏幕 x；y0–y1：从地面到画面底；w：宽（像素）；wet(x, y)：湿度，水洼里更亮。
 */
export function streak(bg, emis, T, { x, y0, y1, c, k = 1, w = 3, wet = () => 0.5, seed = 0 } = {}) {
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(LH, Math.round(y1)); y++) {
    if (hash2(y + seed * 977, Math.floor(T * 7)) < 0.28) continue;
    const fade = Math.pow(1 - (y - y0) / (y1 - y0 + 1), 0.6);
    const dx = Math.round(Math.sin(y * 0.6 + T * 4 + seed) * 1.6);
    const half = (w * (0.6 + 0.4 * fade)) / 2;
    for (let xx = Math.round(x - half); xx <= x + half; xx++) {
      const a = k * fade * wet(xx, y) * (1 - Math.abs(xx - x) / (half + 1));
      if (bayer(xx + dx, y) > a + 0.1) continue;
      bg.add(xx + dx, y, c, 0.7 * a);
      emis.add(xx + dx, y, c, 0.3 * a);
    }
  }
}

/**
 * 浮尘：阳光里飘的小亮点，慢慢漂、一闪一闪（白天、黄昏，不下雨时）。画在 fg 上，同时往发光层加一点。
 * 区域给在逆光的地方（人物身后、窗前光柱里）效果最好。
 */
export function motes(fg, emis, T, { x0 = 0, x1 = LW, y0 = 0, y1 = LH, n = 60, seed = 9 } = {}) {
  if (!ENV || ENV.motes < 0.03) return;
  const c = mixc(ENV.sunC, [255, 255, 255], 0.35);
  const W = x1 - x0;
  const Hh = y1 - y0;
  for (let i = 0; i < n; i++) {
    const x = x0 + hash2(i, seed) * W + Math.sin(T * 0.6 + i) * 5 + T * 2.5 * (hash2(i, seed + 2) - 0.3);
    const y = y0 + hash2(i, seed + 1) * Hh + Math.sin(T * 0.9 + i * 1.7) * 3 - T * 1.2 * hash2(i, seed + 3);
    const X = x0 + ((((x - x0) % W) + W) % W);
    const Y = y0 + ((((y - y0) % Hh) + Hh) % Hh);
    const tw = 0.5 + 0.5 * Math.sin(T * (2 + 3 * hash2(i, seed + 4)) + i * 3.1);
    const a = ENV.motes * tw * (0.35 + 0.65 * hash2(i, seed + 5));
    if (a < 0.08) continue;
    fg.put(X, Y, c, Math.min(1, a));
    emis.add(X, Y, ENV.sunC, 0.8 * a);
  }
}
