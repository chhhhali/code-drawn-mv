// 时间和天气：给一个钟点（0–24）和天气，算出这一帧的光。
//   夜里光来自灯（窗、路灯、车灯），白天光来自太阳和够亮的表面，黄昏两样都有。
//   太阳的位置和颜色、天空、环境光、空气里的雾、影子的长短方向、哪些灯亮着、泛光从哪些亮部提出来，都由它决定。
// 用法：每帧画之前 applyEnv(makeEnv({ hour, weather, sunX }))。零件从 ENV 读，调色板 PAL 也跟着换。
//   weather："clear" 晴 | "cloudy" 阴 | "rain" 雨（阴天下雨）| "sunrain" 太阳雨（有太阳也下雨）
//   sunX：太阳在画面里的左右位置（0 左 – 1 右），决定逆光从哪边来、影子往哪边倒。
// 夜里（太阳在地平线下很远）的结果和原来的夜雨版完全一样：调色板、天空、灯都不变。
import { hex, mixc } from "./px.js";
import { PAL, PAL_NIGHT, PAL_DAY } from "./palette.js";

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const H = (a) => a.map(hex);
const mixArr = (A, B, k) => A.map((c, i) => mixc(c, B[i], k));
const mul = (c, m) => [c[0] * m[0], c[1] * m[1], c[2] * m[2]];
/** 颜色 → 乘法系数（亮度归一，只留色相）：拿来给亮面、暗面调冷暖 */
const tintOf = (c) => {
  const l = (c[0] + c[1] + c[2]) / 3 || 1;
  return [c[0] / l, c[1] / l, c[2] / l];
};
/** 分段关键帧：[[x, rgb], …] */
function keys(K, x) {
  if (x <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (x <= K[i][0]) return mixc(K[i - 1][1], K[i][1], smooth(K[i - 1][0], K[i][0], x));
  return K[K.length - 1][1];
}

// 天空 7 档（顶 → 地平线）
const SKY = {
  blue: H(["#141a3d", "#1d2350", "#2a2c62", "#3b3572", "#563f7c", "#7a4b80", "#a4587c"]),
  dawn: H(["#46578f", "#5f6ea8", "#8086bb", "#a89dc6", "#cfb5cc", "#efc8c8", "#fbe0c8"]),
  golden: H(["#2f3f7a", "#4a5590", "#6e6aa0", "#9a7aa3", "#cf8c8e", "#f5a070", "#ffc070"]),
  day: H(["#2a6fd0", "#3a80d8", "#4f92de", "#68a6e4", "#86bbea", "#a7cfee", "#c8e2f2"]),
  grey: H(["#5d6878", "#6a7585", "#778292", "#848f9e", "#929caa", "#a0a9b6", "#aeb6c2"]),
};
const SUN = [[0, hex("#ff7a3c")], [0.08, hex("#ffa45e")], [0.2, hex("#ffd08a")], [0.5, hex("#fff4e0")]];
const AMB = [[-0.3, hex("#463778")], [-0.1, hex("#5a5faa")], [0.08, hex("#8273c8")], [0.4, hex("#96b9f0")]];

export let ENV = null;

export function makeEnv({ hour = 21, weather = "rain", sunX = 0.6, wet } = {}) {
  const elev = Math.sin(((hour - 6) / 12) * Math.PI); // 太阳高度：-1 午夜 … 0 日出日落 … 1 正午
  const morning = hour < 12;
  const rain = weather === "rain" || weather === "sunrain";
  const overcast = weather === "cloudy" || weather === "rain" ? 1 : 0;
  const world = smooth(-0.15, 0.25, elev); // 世界的颜色有多"白天"
  const day = smooth(0, 0.3, elev);
  const golden = Math.max(0, 1 - Math.abs(elev - 0.09) / 0.16) * (1 - 0.7 * overcast);

  // 天空
  let sky;
  if (elev <= -0.25) sky = PAL_NIGHT.sky;
  else if (elev <= -0.1) sky = mixArr(PAL_NIGHT.sky, SKY.blue, smooth(-0.25, -0.1, elev));
  else if (elev <= 0.08) sky = mixArr(SKY.blue, morning ? SKY.dawn : SKY.golden, smooth(-0.1, 0.08, elev));
  else sky = mixArr(morning ? SKY.dawn : SKY.golden, SKY.day, smooth(0.08, 0.45, elev));
  const greyK = (overcast ? 0.75 : weather === "sunrain" ? 0.2 : 0) * smooth(-0.2, 0.2, elev);
  if (greyK > 0) sky = mixArr(sky, SKY.grey.map((c) => mixc(c, sky[6], 0.2)), greyK);

  // 太阳：天上的位置（天空层的屏幕坐标）、颜色、强度
  const sunC = morning ? mixc(keys(SUN, elev), [255, 222, 196], 0.45) : keys(SUN, elev); // 早上的太阳淡一些、偏粉
  const sunK = smooth(-0.04, 0.06, elev) * (weather === "clear" ? 1 : weather === "sunrain" ? 0.85 : 0.22);
  const sunPos = [sunX * 480, 150 - 430 * Math.max(elev, -0.05)];
  // 主光方向：从画面中间指向太阳（远处的一个点，平行光）
  const ux = (sunX - 0.5) * 1.2;
  const uy = -(0.12 + Math.max(0, elev));
  const n = Math.hypot(ux, uy);
  const dir = [ux / n, uy / n];
  const amb = keys(AMB, elev);
  const ambK = 0.32 * smooth(-0.1, 0.3, elev);
  const sun = sunK > 0.02 ? { x: 240 + dir[0] * 1e4, y: 135 + dir[1] * 1e4, c: sunC, k: sunK, r: 1e6, dir: true, sx: sunPos[0], sy: sunPos[1] } : null;
  const fill = ambK > 0.02 ? { x: 240 - dir[0] * 1e4, y: 135 - 1e4, c: amb, k: ambK, r: 1e6, dir: true, sx: 240, sy: -1e3 } : null;

  // 影子：一个高 h 的点，影子落在 (h·sx, h·sy)。太阳越低影子越长，往太阳的反方向、朝镜头这边倒
  const along = Math.min(3, 0.3 / Math.max(0.1, Math.tan(Math.asin(Math.max(0.02, elev)))));
  const shadow = {
    sx: -(sunX - 0.5) * 1.6 * along * 0.5,
    sy: 0.3 * along,
    a: 0.55 * sunK * smooth(0, 0.06, elev),
    c: mixc([24, 22, 44], amb, 0.3),
  };

  // 空气：越远越靠近天色（清晨有雾，阴雨天更重）
  const mist = morning ? (1 - smooth(0.05, 0.35, elev)) * 0.42 : 0;
  const veilK = (0.12 + mist + 0.14 * overcast + 0.06 * (rain ? 1 : 0)) * smooth(-0.15, 0.05, elev);
  const veilC = mixc(mixc(sky[6], amb, 0.25), [246, 240, 244], mist);

  return {
    hour, weather, morning, elev, world, day, golden, rain, overcast,
    wet: wet ?? (rain ? 1 : 0),
    sky,
    sun, fill, sunC, sunK, sunPos, amb,
    lampsOn: 1 - smooth(0.05, 0.2, elev),
    winLit: 1 - smooth(-0.05, 0.18, elev),
    carLights: Math.max(1 - smooth(0, 0.25, elev), 0.5 * overcast * rain),
    shadow,
    veil: { c: veilC, k: veilK },
    // 打光：亮面往太阳色偏、暗面往天光色偏；逆光时正面压暗、亮边更亮
    grade: world > 0 ? { lit: mixc([1, 1, 1], tintOf(sunC), 0.22 * sunK * world), shade: mixc([1, 1, 1], tintOf(amb), 0.3 * world) } : null,
    back: 0.85 * golden * sunK,
    mist,
    motes: rain ? 0 : sunK * (0.8 * golden + 0.25 * day),
    post: {
      bright: world > 0 ? { th: 0.77 - 0.05 * golden, k: 0.9 * world } : null,
      // 太阳附近的一大片暖光（被楼挡住也有：空气在散射），逆光的感觉主要靠它
      glare: sun && elev < 0.35 ? { x: sunPos[0], y: sunPos[1], c: sunC, k: (morning ? 0.32 : 0.42) * sunK * (1 - smooth(0.15, 0.35, elev)), r: morning ? 260 : 200 } : null,
      rays: sun && elev < 0.45 ? { x: sunPos[0], y: sunPos[1], c: sunC, k: 0.85 * sunK * (1 - smooth(0.2, 0.45, elev)) * (1 - 0.6 * overcast) } : null,
      hazeMul: 1 - 0.25 * world,
      vig: 1 - 0.45 * world,
      tint: golden > 0.05 ? (morning ? "#ffc4d2" : "#ff9a50") : null,
      tintA: (morning ? 0.1 : 0.12) * golden,
    },
  };
}

/** 每帧画之前调用：记下当前环境，按时间换调色板（PAL 是同一个对象，零件不用改）。 */
export function applyEnv(E) {
  ENV = E;
  const k = E.world;
  const warm = tintOf(E.sunC);
  for (const key of Object.keys(PAL_NIGHT)) {
    const night = PAL_NIGHT[key];
    const dayV = PAL_DAY[key];
    if (key === "sky") {
      PAL.sky = E.sky;
      continue;
    }
    if (!dayV || k <= 0) {
      PAL[key] = night;
      continue;
    }
    const grade = (c) => {
      let o = mixc(c, mul(c, warm), 0.4 * E.golden);
      if (E.overcast) o = mixc(o, [o[0] * 0.82, o[1] * 0.84, o[2] * 0.9], E.overcast);
      if (E.wet > 0 && ["asphalt", "asphalt2", "walk", "walk2", "walk3", "seam", "curb", "curbTop"].includes(key)) o = mixc(o, [o[0] * 0.62, o[1] * 0.64, o[2] * 0.72], E.wet);
      return o;
    };
    PAL[key] = Array.isArray(night[0]) ? night.map((c, i) => mixc(c, grade(dayV[i] || dayV[dayV.length - 1]), k)) : mixc(night, grade(dayV), k);
  }
  // 远处的楼按空气透视靠近天色
  if (k > 0) {
    PAL.bldFar = PAL.bldFar.map((c) => mixc(c, E.sky[6], 0.5 * k));
    PAL.bldMid = PAL.bldMid.map((c) => mixc(c, E.sky[6], 0.12 * k));
  }
  // 逆光（太阳低、在楼后面）：朝镜头的墙面都在背光里，压暗、偏天光色，远处的楼成了剪影；
  // 楼的受光边、路面这类朝上的面接住一点斜阳。这是黄昏、清晨"高级"的来源：亮的天，暗的楼，亮边。
  const bl = Math.min(1, E.back / 0.75);
  if (bl > 0) {
    const cool = tintOf(E.amb);
    const shadeOf = (c, f) => [c[0] * cool[0] * f, c[1] * cool[1] * f, c[2] * cool[2] * f];
    PAL.bldMid = PAL.bldMid.map((c, i) => mixc(c, shadeOf(c, i === 0 ? 0.45 : 0.5), 0.8 * bl));
    PAL.bldFar = PAL.bldFar.map((c, i) => mixc(c, mixc(E.sky[3 + i], [46, 36, 82], 0.45), 0.7 * bl));
    PAL.bldEdge = mixc(PAL.bldEdge, mixc(E.sunC, [255, 250, 236], 0.3), bl);
    // 地面朝上，接住斜阳：黄昏偏暖；清晨被雾冲淡、偏冷
    const glance = E.morning ? mixc([226, 222, 236], E.sunC, 0.2) : mixc(E.sunC, [255, 190, 150], 0.3);
    for (const key of ["walk", "walk2", "walk3", "seam", "curb", "asphalt", "asphalt2"]) {
      const c = mixc(PAL[key], shadeOf(PAL[key], 0.8), 0.5 * bl);
      PAL[key] = mixc(c, mul(c, tintOf(glance)), (E.morning ? 0.25 : 0.45) * bl);
    }
  }
  // 白天下雨：湿地面映着天色，水洼就是一小块天
  if (k > 0 && E.wet > 0) {
    const refl = mixc(E.sky[4], E.sky[5], 0.5);
    for (const key of ["walk", "walk2", "walk3", "seam", "asphalt", "asphalt2"]) PAL[key] = mixc(PAL[key], mixc(PAL[key], refl, 0.5), 0.45 * E.wet * k);
    PAL.puddle = mixc(PAL.puddle, mixc(E.sky[5], E.sky[3], 0.35), k);
    PAL.puddleRim = mixc(PAL.puddleRim, mixc(E.sky[6], [255, 255, 255], 0.3), k);
  }
  return E;
}

/** 当前环境下的光源（太阳、天光），放进镜头的 lights 里给人物打光、给雨上色 */
export const envLights = () => (ENV ? [ENV.sun, ENV.fill].filter(Boolean) : []);
