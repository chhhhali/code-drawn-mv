// 示例镜头（样片 · 街口牵手，整片时间 22.3–28.3 秒；新片照这个写法重写）
//   镜头 1 全景：路灯下两个人；下雨时她撑透明伞、他淋着雨低着头；一辆车从左往右开过
//   镜头 2 双人中景（背景虚化）：唱到"牵"，她伸手牵住他；唱到"手"，伞往他那边歪过去；
//     下一句开唱，行人灯由红转绿；一辆公交车从他们身后开过；他脸红、笑了
// 同一套镜头换钟点和天气（shots.js 的 ENV_DEFAULT 或镜头的 env）就是另一个时段：
//   夜雨 { hour: 21, weather: "rain" }、黄昏太阳雨 { hour: 17.6, weather: "sunrain" }、正午晴 { hour: 12.5, weather: "clear" }……
//   不下雨时不打伞（她的手放下来），地上没有水洼；有太阳时人和杆子有影子，阳光里有浮尘。
// 演示了：分层（bg / fg / emis）、按光源自动打光、空气透视、两节手臂反向求解（两只手正好牵上）、透明伞的干区、动作踩字（cues.js）
import { camera, sky, skyline, apartment, store, road, sidewalk, reflect, streak, lamp, walkSignal, rain, splashes, motes, snap, aerial, PUDDLES } from "../world.js";
import { LOOKS, drawPerson, shadePerson, umbrella, reachTo, castShadow } from "../people.js";
import { ENV, envLights } from "../env.js";
import { makeCues, hit, settle } from "../cues.js";
import { ease, ramp, keyed, lerp } from "../util.js";
import { LH } from "../px.js";
import { PAL } from "../palette.js";

// 两句的时间（字幕切换 + 人声起音）；没有歌词文本，只给字数。"牵""手"两个字对过起音。
const PH = [
  { line: 1, start: 22.45, end: 26.0, n: 12 },
  { line: 2, start: 26.13, end: 30.3, n: 10 },
];
const C = makeCues(PH, { "1:10": 24.55, "1:11": 24.78 });
const T_QIAN = C.at(1, 10);
const T_SHOU = C.at(1, 11);
const T_L2 = C.start(2);
export const CUT = 24.0;

// 世界坐标（全景时的像素）
const BOY = { x: 228, y: 236, H: 66 };
const GIRL = { x: 258, y: 236, H: 62 };
const MEET = [243, 204]; // 两只手牵上的地方

const CARS_1 = [{ x0: -70, v: 150, t0: 22.3, lane: 168, color: [52, 40, 70] }];
const CARS_2 = [
  { x0: 430, v: -46, t0: 24.0, lane: 168, len: 130, bus: true, color: [36, 50, 72] },
  { x0: 520, v: -170, t0: 26.0, lane: 183, color: [70, 40, 52] },
];

/** 整个街景（两个镜头共用），cam 不同而已。返回光源列表和人行道在屏幕上的顶边。 */
function street(F, cam, T, cars, signal) {
  const { bg, emis } = F;
  const E = ENV;
  sky(bg, emis, T);
  // 远处的层画完各蒙一层天色（空气透视，白天、清晨的雾里明显；夜里没有）
  let before = snap(bg);
  skyline(bg, emis, cam.L(0.15), T);
  aerial(bg, before, 1);
  const lights = [];
  before = snap(bg);
  lights.push(apartment(bg, emis, cam.L(0.5), T));
  lights.push(...store(bg, emis, cam.L(0.5), T, { rect: [330, 66, 160, 90] }));
  aerial(bg, before, 0.55);
  before = snap(bg);
  lights.push(...road(bg, emis, cam.L(0.75), T, { cars }));
  aerial(bg, before, 0.25 + 1.4 * E.mist); // 清晨的雾连近处的马路也蒙上
  const L1 = cam.L(1);
  const wetK = E.wet;
  before = snap(bg);
  const wet = sidewalk(bg, L1, { puddles: wetK > 0.3 ? [...PUDDLES, [300, 221, 30, 4], [186, 225, 24, 3.5]] : [] }); // 中景里看得见的两个水洼
  aerial(bg, before, 0.8 * E.mist);
  const [, curb] = L1.s(0, 188);
  const [, roadTop] = cam.L(0.75).s(0, 152);
  const key = lamp(bg, emis, L1, T);
  lights.push(key);
  lights.push(walkSignal(bg, emis, L1, T, { x: 300, state: signal })); // 中景里看不到灯箱，但它在湿地上的倒影在画面右边，红转绿看得见
  const sig = lights[lights.length - 1];
  if (wetK > 0) {
    // 倒影：马路上反楼和店（轴在马路远边），人行道上反车灯、路灯、信号灯（轴在路沿）
    reflect(bg, emis, T, { axis: roadTop, y0: roadTop, y1: curb, k: 0.45, wet: () => 0.5, gain: 0.7 * wetK });
    reflect(bg, emis, T, { axis: curb - 2, y0: curb, y1: LH, k: 0.38, wet, gain: 1 * wetK });
    // 高处的灯在湿地上拉出的竖光带（路灯关了就没有）
    if (key.k > 0.02) streak(bg, emis, T, { x: key.x, y0: curb, y1: LH, c: key.c, k: 1 * key.k * wetK, w: Math.max(3, 3 * L1.z), wet, seed: 1 });
    streak(bg, emis, T, { x: sig.x, y0: curb, y1: LH, c: sig.c, k: 1.5 * (sig.k / 0.45) * wetK, w: Math.max(2, 2.4 * L1.z), wet, seed: 2 });
    for (const [sx, n] of [[350, 3], [400, 4], [450, 5]]) {
      const [px] = cam.L(0.5).s(sx, 0);
      streak(bg, emis, T, { x: px, y0: curb, y1: LH, c: PAL.store, k: 0.45 * (1 - 0.6 * E.world) * wetK, w: Math.max(2, 2 * L1.z), wet, seed: n });
    }
    // 太阳在湿路面上拉出的一条宽光带
    if (E.sun && E.sunPos[1] < 190) {
      const wide = (x, y) => Math.max(0.55, wet(x, y)); // 马路上也算湿
      streak(bg, emis, T, { x: E.sunPos[0], y0: roadTop, y1: LH, c: E.sunC, k: 1.6 * E.sunK * wetK, w: Math.max(12, 8 * L1.z), wet: wide, seed: 7 });
      streak(bg, emis, T, { x: E.sunPos[0], y0: roadTop, y1: LH, c: [255, 246, 226], k: 0.9 * E.sunK * wetK, w: Math.max(4, 3 * L1.z), wet: wide, seed: 8 });
    }
  }
  // 主光放第一个：有太阳时是太阳，夜里是路灯（决定人物的明暗交界和主轮廓光）
  return { lights: [...envLights(), key, ...lights.filter((l) => l && l !== key)], curb };
}

/** 两个人 + 伞。pose 由时间算；返回伞底下的干区。 */
function couple(F, cam, T, lights, { close }) {
  const { fg, emis } = F;
  const L1 = cam.L(1);
  const [bx, by] = L1.s(BOY.x, BOY.y);
  const [gx, gy] = L1.s(GIRL.x, GIRL.y);
  const bH = BOY.H * L1.z;
  const gH = GIRL.H * L1.z;
  const meet = L1.s(...MEET);

  // 手：伸手（"牵"之前 0.45 秒起势）→ 牵住
  const reach = settle(T, T_QIAN, { pre: 0.45 });
  const lerpArm = (rest, tgt, k) => [lerp(rest[0], tgt[0], k), lerp(rest[1], tgt[1], k)];
  const gArmN = lerpArm([0.12, 0.18], reachTo(LOOKS.girl, gx, gy, gH, -1, "n", meet), reach);
  const bArmN = lerpArm([0.06, 0.1], reachTo(LOOKS.boy, bx, by, bH, 1, "n", meet), settle(T, T_QIAN, { pre: 0.3 }));
  // 伞："手"字开始往他那边歪
  const tilt = lerp(0.06, -0.24, ease.inOut(ramp(T, T_SHOU - 0.05, T_SHOU + 0.6)));
  const covered = tilt < -0.2;
  const umb = ENV.rain; // 不下雨就不打伞
  // 表情
  const surprised = T > T_QIAN + 0.05 && T < T_QIAN + 0.6;
  const boyPose = {
    f: 1,
    armN: bArmN,
    armF: [0.04, 0.1],
    nod: T < T_QIAN ? 1.2 * L1.z : 0,
    eyes: T < T_QIAN ? "half" : surprised ? "wide" : T > T_L2 + 0.35 ? "happy" : "open",
    brows: T < T_QIAN ? "sad" : surprised ? "up" : "flat",
    mouth: surprised ? "o" : T > T_L2 + 0.35 ? "smile" : "line",
    blush: settle(T, T_SHOU + 0.6, { pre: 0.8 }),
    bob: Math.round(Math.sin(T * 2.1) * 0.6),
  };
  const girlPose = {
    f: -1,
    armN: gArmN,
    armF: umb ? [-0.2, 3.25] : [0.05, 0.14], // 举伞的手在肩后面，伞柄从头后面伸出去
    eyes: T > T_SHOU + 0.35 ? "happy" : "open",
    brows: "flat",
    mouth: T > T_QIAN ? "smile" : "line",
    blush: 0.35 + 0.65 * settle(T, T_SHOU + 0.3, { pre: 0.5 }),
  };
  const boy = drawPerson(LOOKS.boy, bx, by, bH, boyPose);
  const girl = drawPerson(LOOKS.girl, gx, gy, gH, girlPose);
  // 有太阳时先在地上投影子（画在背景层，人盖在上面）
  castShadow(F.bg, girl, gy);
  castShadow(F.bg, boy, by);
  // 伞柄在人后面，伞面在最前面
  if (umb) umbrella(fg, emis, T, girl.hands.f, gH, tilt, null, { ground: gy, len: 0.74, part: "shaft" });
  shadePerson(girl, lights, fg, emis);
  shadePerson(boy, lights, fg, emis);
  if (!umb) return { dry: [], ground: Math.max(by, gy) };
  const dry = umbrella(fg, emis, T, girl.hands.f, gH, tilt, lights[0], { ground: gy, len: 0.74, rx: 0.4, part: "canopy" });
  // 没被伞盖住时，雨点打在他头上、肩上
  if (!covered) {
    const h = boy.head;
    splashes(fg, T, { x0: h.x - h.rx * 1.2, x1: h.x + h.rx * 1.2, y0: boy.top, y1: boy.top + 2, n: close ? 8 : 3, period: 0.33 });
  }
  return { dry: [dry], ground: Math.max(by, gy) };
}

// ---------- 镜头 1：全景 ----------
export function streetWide({ tIn, tOut }) {
  return {
    id: "street-wide",
    tIn,
    tOut,
    draw(F) {
      const { T, lt } = F;
      const k = ease.sine(Math.min(1, lt / 2.2));
      const cam = camera(lerp(240, 243, k), lerp(135, 146, k), 1 + 0.07 * k);
      const { lights, curb } = street(F, cam, T, CARS_1, "red");
      const { dry } = couple(F, cam, T, lights, { close: false });
      if (ENV.rain) {
        rain(F.bg, F.fg, T, lights, { dry });
        splashes(F.fg, T, { y0: curb + 2, y1: LH - 2, n: 54, dry });
      } else motes(F.fg, F.emis, T, { x0: 150, x1: 350, y0: 120, y1: 230, n: 36 });
      return { dof: 0, bloom: 1, haze: 0.14 };
    },
  };
}

// ---------- 镜头 2：双人中景 ----------
export function streetTwo({ tIn, tOut }) {
  return {
    id: "street-two",
    tIn,
    tOut,
    draw(F) {
      const { T, lt } = F;
      const k = ease.sine(Math.min(1, lt / 4.4));
      const cam = camera(243, lerp(193, 190, k), lerp(3.3, 3.5, k));
      const signal = T >= T_L2 ? "green" : "red";
      const { lights, curb } = street(F, cam, T, CARS_2, signal);
      const { dry } = couple(F, cam, T, lights, { close: true });
      if (ENV.rain) {
        rain(F.bg, F.fg, T, lights, { dry });
        splashes(F.fg, T, { y0: curb + 2, y1: LH - 2, n: 40, dry });
      } else motes(F.fg, F.emis, T, { x0: 60, x1: 420, y0: 10, y1: 200, n: 70 });
      return { dof: 4, bloom: 1.05, haze: 0.15 };
    },
  };
}
