// 画一帧的公共步骤（成片 main.js 和 tools/ 下的工具页共用）：
//   按镜头的 env 设好光 → 清空三张图层 → 镜头往里画 → 太阳光晕只加到看得见的天空上 → 够亮的像素加进发光层。
// 返回合好的后期参数：env 给的（光柱、暗角、雾气倍数、调色）+ 镜头给的（dof、bloom、haze……），镜头优先。
import { brightPass } from "./post.js";
import { makeEnv, applyEnv } from "./env.js";
import { skyLight } from "./world.js";
import { ENV_DEFAULT } from "./shots.js";

/** 画一帧到三张图层上，返回合好的后期参数（env 给的 + 镜头给的，镜头优先）。tools/ 下的工具页也用它。 */
export function drawFrame(shot, t, F, envOverride = null) {
  const own = typeof shot.env === "function" ? shot.env(t) : shot.env; // env 可以随时间变：(T) => ({ hour: … })
  const E = applyEnv(makeEnv({ ...ENV_DEFAULT, ...(own || {}), ...(envOverride || {}) }));
  F.bg.clear();
  F.fg.clear();
  F.emis.clear();
  const o = shot.draw({ ...F, T: t, lt: t - shot.tIn }) || {};
  const src = skyLight(F.bg, F.fg, F.emis);
  if (E.post.bright) brightPass(F.bg, F.fg, F.emis, E.post.bright.th, E.post.bright.k);
  return { ...E.post, rays: E.post.rays && src ? { ...E.post.rays, src } : null, ...o };
}

