// 镜头外壳 + 布景缓存。
// 布景（预先画好的大画布）按需要才建，最多同时留 6 套，旧的释放掉，免得整支片几十张大画布一起占内存。
import { ease, ramp, keyed, lerp, clamp01, mulberry32 } from "./util.js";

const CACHE = new Map();
let clock = 0;
const MAX_SETS = 6;

function free(v) {
  if (!v) return;
  if (v.c && v.c.width !== undefined) {
    v.c.width = 0;
    v.c.height = 0;
  } else if (typeof v === "object" && !Array.isArray(v)) for (const x of Object.values(v)) if (x && x.c) free(x);
}

/** 取一套布景（没有就现在建）。key 相同的镜头共用。 */
export function useSet(key, build) {
  clock++;
  let e = CACHE.get(key);
  if (!e) {
    e = { v: build(), used: clock };
    CACHE.set(key, e);
    while (CACHE.size > MAX_SETS) {
      let oldK = null;
      let oldU = Infinity;
      for (const [k, x] of CACHE) if (x.used < oldU && k !== key) [oldK, oldU] = [k, x.used];
      if (oldK === null) break;
      for (const x of Object.values(CACHE.get(oldK).v)) free(x);
      CACHE.delete(oldK);
    }
  }
  e.used = clock;
  return e.v;
}

/** 一个镜头：{ id, tIn, tOut, warm(数字或 lt=>数字), draw(g, lt, T) } */
export function shot(o) {
  return {
    warm: 0,
    ...o,
    warmAt(lt) {
      return typeof this.warm === "function" ? this.warm(lt) : this.warm;
    },
  };
}

export { ease, ramp, keyed, lerp, clamp01, mulberry32 };
