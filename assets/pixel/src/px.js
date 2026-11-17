// 像素引擎：480×270 低分辨率画布上整像素地画，最后 ×4 放大到 1920×1080。
//   Pix  —— 一层 RGBA 像素（背景层 bg、主体层 fg、发光层 emis 各一张）
//   Mat  —— 角色、伞、路灯这类"要打光的东西"先画成材质图（每个像素记材质编号 + 部件编号），
//           再由 shade() 按光源算出：亮面 / 本色 / 暗面 / 最暗、迎光一侧的轮廓光、背光一侧的深色描边。
//   亮层、暗层不是手画的，是按光源位置算出来的：光源一动（车开过去），轮廓光就跟着扫过去。
// 所有东西只由时间 t 决定（HyperFrames 乱序逐帧渲染）。
export const LW = 480;
export const LH = 270;
export const SCALE = 4;

const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** 4×4 有序抖动阈值 0–1：渐变、明暗交界、半透明都用它，整像素地"混"两种颜色 */
export const bayer = (x, y) => (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

export function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export const scalec = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

export class Pix {
  constructor(w = LW, h = LH) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  clear() {
    this.d.fill(0);
  }
  /** 盖一个像素；a < 1 时和底下按透明度混合（底下可以是透明的） */
  put(x, y, c, a = 1) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const d = this.d;
    const i = (y * this.w + x) * 4;
    if (a >= 1) {
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
      return;
    }
    const da = d[i + 3] / 255;
    const oa = a + da * (1 - a);
    for (let k = 0; k < 3; k++) d[i + k] = (c[k] * a + d[i + k] * da * (1 - a)) / oa;
    d[i + 3] = oa * 255;
  }
  /** 加亮（发光层、光锥、反光）：颜色 × k 叠加上去 */
  add(x, y, c, k = 1) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || k <= 0) return;
    const d = this.d;
    const i = (y * this.w + x) * 4;
    d[i] += c[0] * k;
    d[i + 1] += c[1] * k;
    d[i + 2] += c[2] * k;
    d[i + 3] = 255;
  }
  get(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
  }
  rect(x, y, w, h, c, a = 1) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.put(xx, yy, c, a);
  }
  /** 抖动的半透明矩形：a 按 4×4 阈值变成"有或没有"，保持像素感 */
  ditherRect(x, y, w, h, c, a) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) if (bayer(xx, yy) < a) this.put(xx, yy, c);
  }
  addRect(x, y, w, h, c, k) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.add(xx, yy, c, k);
  }
  /** 通用填充：test(像素中心 x, y) 为真就上色 */
  fill(test, x0, y0, x1, y1, c, a = 1) {
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(this.w - 1, Math.ceil(x1)); x++) if (test(x + 0.5, y + 0.5)) this.put(x, y, c, a);
  }
  line(x0, y0, x1, y1, c, a = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (let n = 0; n < 2000; n++) {
      this.put(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) (e += dy), (x0 += sx);
      if (e2 <= dx) (e += dx), (y0 += sy);
    }
  }
  toCanvas(ctx) {
    ctx.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
  }
}

// ---------- 形状测试（像素中心落在里面就填） ----------
export const inEllipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
export function inCapsule(x0, y0, x1, y1, r) {
  const vx = x1 - x0;
  const vy = y1 - y0;
  const L2 = vx * vx + vy * vy || 1e-6;
  return (x, y) => {
    const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / L2));
    const dx = x - (x0 + vx * t);
    const dy = y - (y0 + vy * t);
    return dx * dx + dy * dy <= r * r;
  };
}
export function inPoly(pts) {
  return (x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
}
const bboxOf = (pts) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y));
  return [x0, y0, x1, y1];
};

// ---------- 材质图 ----------
export class Mat {
  /** 一块屏幕区域（x0, y0 起，w × h）的材质图 */
  constructor(x0, y0, w, h) {
    this.x0 = Math.floor(x0);
    this.y0 = Math.floor(y0);
    this.w = Math.ceil(w);
    this.h = Math.ceil(h);
    this.m = new Uint8Array(this.w * this.h);
    this.p = new Uint8Array(this.w * this.h);
    this.parts = [null];
  }
  /** 开一个部件（头、躯干、左前臂……）：明暗按部件自己的中心算，像一节节圆柱 */
  part() {
    this.parts.push({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
    return this.parts.length - 1;
  }
  fill(test, bx0, by0, bx1, by1, mat, part = 0) {
    const P = this.parts[part];
    for (let y = Math.max(this.y0, Math.floor(by0)); y <= Math.min(this.y0 + this.h - 1, Math.ceil(by1)); y++)
      for (let x = Math.max(this.x0, Math.floor(bx0)); x <= Math.min(this.x0 + this.w - 1, Math.ceil(bx1)); x++) {
        if (!test(x + 0.5, y + 0.5)) continue;
        const i = (y - this.y0) * this.w + (x - this.x0);
        this.m[i] = mat;
        this.p[i] = part;
        if (P) (P.x0 = Math.min(P.x0, x)), (P.y0 = Math.min(P.y0, y)), (P.x1 = Math.max(P.x1, x)), (P.y1 = Math.max(P.y1, y));
      }
  }
  ellipse(cx, cy, rx, ry, mat, part = 0) {
    this.fill(inEllipse(cx, cy, rx, ry), cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, mat, part);
  }
  capsule(x0, y0, x1, y1, r, mat, part = 0) {
    this.fill(inCapsule(x0, y0, x1, y1, r), Math.min(x0, x1) - r - 1, Math.min(y0, y1) - r - 1, Math.max(x0, x1) + r + 1, Math.max(y0, y1) + r + 1, mat, part);
  }
  poly(pts, mat, part = 0) {
    const [x0, y0, x1, y1] = bboxOf(pts);
    this.fill(inPoly(pts), x0 - 1, y0 - 1, x1 + 1, y1 + 1, mat, part);
  }
  /** 单个像素（五官、高光） */
  dot(x, y, mat, part = 0) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < this.x0 || y < this.y0 || x >= this.x0 + this.w || y >= this.y0 + this.h) return;
    const i = (y - this.y0) * this.w + (x - this.x0);
    this.m[i] = mat;
    this.p[i] = part;
  }
  at(x, y) {
    if (x < this.x0 || y < this.y0 || x >= this.x0 + this.w || y >= this.y0 + this.h) return 0;
    return this.m[(y - this.y0) * this.w + (x - this.x0)];
  }
}

/**
 * 给材质图打光，画进 out（一般是 fg）。
 * MATS[id] = { ramp: [最暗, 暗面, 本色, 亮面]（rgb） } 或 { flat: rgb }（五官这类不受光的）。
 * lights = [{ x, y, c: rgb, k: 0–1 }, …]：屏幕坐标。第 1 个是主光（决定明暗交界和主轮廓光），第 2 个是副光（另一侧的冷色轮廓光）。
 * o.outline：描边颜色；o.emis：发光层（轮廓光会往里加一点，泛光时边缘微微发亮）。
 * o.back：逆光程度 0–1（太阳在人物身后）：正面更多落进暗面，亮面更少，轮廓光往发光层加得更多。
 * o.grade：{ lit, shade } 两个乘法系数：亮面往光的颜色偏、暗面往天光的颜色偏（白天、黄昏用；夜里不传）。
 */
export function shade(M, MATS, lights, out, o = {}) {
  const outline = o.outline || [18, 12, 28];
  const L = lights.filter((l) => l && l.k > 0.02).slice(0, 2);
  const steps = L.map((l) => {
    const cx = M.x0 + M.w / 2;
    const cy = M.y0 + M.h / 2;
    const dx = l.x - cx;
    const dy = l.y - cy;
    const n = Math.hypot(dx, dy) || 1;
    return { ux: dx / n, uy: dy / n, sx: Math.round((dx / n) * 1.45), sy: Math.round((dy / n) * 1.45) };
  });
  const rim = new Uint8Array(M.w * M.h);
  const key = L[0];
  const ks = steps[0];
  const bk = o.back || 0;
  for (let j = 0; j < M.h; j++)
    for (let i = 0; i < M.w; i++) {
      const id = j * M.w + i;
      const m = M.m[id];
      if (!m) continue;
      const X = M.x0 + i;
      const Y = M.y0 + j;
      const mat = MATS[m];
      if (mat.flat) {
        out.put(X, Y, mat.flat);
        continue;
      }
      let level = 2;
      let col = null;
      if (key) {
        const P = M.parts[M.p[id]];
        if (P) {
          const pcx = (P.x0 + P.x1) / 2;
          const pcy = (P.y0 + P.y1) / 2;
          const size = Math.max(3, Math.max(P.x1 - P.x0, P.y1 - P.y0) / 2);
          const s = ((X - pcx) * ks.ux + (Y - pcy) * ks.uy) / size;
          const b = bayer(X, Y);
          if (s < -0.02 - 0.16 * b + 0.38 * bk) level = 1;
          else if (s > 0.5 + 0.2 * b + 0.3 * bk && key.k > 0.35) level = 3;
        }
        if (!M.at(X - ks.sx, Y - ks.sy)) level = Math.max(0, level - 1);
        for (let n = 0; n < L.length; n++) {
          const st = steps[n];
          if (!M.at(X + st.sx, Y + st.sy) || (L[n].k > 0.7 && !M.at(X + 2 * st.sx, Y + 2 * st.sy) && bayer(X, Y) < 0.5)) {
            col = mixc(mat.ramp[3], L[n].c, Math.min(1, 0.35 + 0.5 * L[n].k + (n === 0 ? 0.25 * bk : 0)));
            rim[id] = 1;
            if (o.emis) o.emis.add(X, Y, L[n].c, (0.22 + (n === 0 ? 0.45 * bk : 0)) * L[n].k);
            break;
          }
        }
      }
      let c = col || mat.ramp[level];
      if (bk > 0 && !col && level >= 2) c = mixc(c, mat.ramp[1], 0.38 * bk); // 逆光：正面整体落在背光里，只有边亮
      if (o.grade && !col) {
        const g = level >= 2 ? o.grade.lit : o.grade.shade;
        c = [c[0] * g[0], c[1] * g[1], c[2] * g[2]];
      }
      out.put(X, Y, c);
    }
  // 描边：外面一圈深色，但迎光的轮廓光旁边不描（不然把亮边压掉）
  for (let j = -1; j <= M.h; j++)
    for (let i = -1; i <= M.w; i++) {
      const X = M.x0 + i;
      const Y = M.y0 + j;
      if (M.at(X, Y)) continue;
      let hit = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = X + dx;
        const ny = Y + dy;
        if (!M.at(nx, ny)) continue;
        if (rim[(ny - M.y0) * M.w + (nx - M.x0)]) continue;
        hit = true;
      }
      if (hit) out.put(X, Y, outline, 0.92);
    }
}

/** 低分辨率画布（离屏） */
export function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
