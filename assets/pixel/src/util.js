// 通用小工具：可复现的随机数、缓动、关键帧插值。
// 所有画面都只由时间 t 决定（HyperFrames 逐帧乱序渲染）。

export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;

export const ease = {
  linear: (x) => x,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x) => 1 - Math.pow(1 - x, 3),
  in: (x) => x * x * x,
  outBack: (x, s = 1.4) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  sine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
};

/** 0→1 between t0 and t1 with easing. */
export function ramp(t, t0, t1, fn = ease.linear) {
  if (t1 <= t0) return t >= t1 ? 1 : 0;
  return fn(clamp01((t - t0) / (t1 - t0)));
}

/** Keyed values [[t, v], ...]; eases between neighbouring keys. */
export function keyed(keys, t, fn = ease.inOut) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return lerp(v0, v1, fn(clamp01((t - t0) / (t1 - t0))));
    }
  }
  return keys[keys.length - 1][1];
}

/** Seeded value noise in [-1, 1] for gentle, repeatable wobble. */
export function wobble(t, seed = 1, speed = 1) {
  const x = t * speed + seed * 17.123;
  const i = Math.floor(x);
  const f = x - i;
  const h = (n) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

/** 整数对 (i, j) → [0, 1) 的固定随机数：同一个 i、同一个时间槽 j 永远得到同一个值（雨点溅起的位置、闪烁） */
export function hash2(i, j = 0) {
  let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
