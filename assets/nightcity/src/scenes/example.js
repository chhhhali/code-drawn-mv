// 示例镜头：三种已验证的镜头类型，各自演示一套连招。新片照着写自己的镜头，路线、人物、招牌字都换成自己的内容。
//   mapShot    俯视地图（连招 C）：进场对焦 + 彩纸炸开 → 两条光轨沿街道走 → 猛推 → 星芒 → 印章 + 震屏 → 同心圆 → 加速推近、过曝切出
//   streetShot 雨夜街道前推：两道流光、漂浮彩纸、雨 → 最后 4 帧下沉、整帧模糊，硬切下一镜
//   lowShot    低机位（连招 A + B）：流光描出人物、落脚起水波 → 化成闪点 → 光柱 → 竖向甩镜 → 闪白
// 每个镜头返回 { id, tIn, tOut, build, draw(g, lt, T), whiteAt(lt), exposeAt(lt) }，lt 是镜头内时间（秒）。
// 关键时刻都由参数给（卡在拍点上），其余时间按连招的帧数往前、往后推。
import { star } from "../gfx.js";
import { clamp01, lerp, ease } from "../util.js";
import { track, blurPass, whip, flashAt } from "../kit.js";
import { makeStreet, drawStreet } from "../street.js";
import { buildMap, drawMap, applyCam, toScreen, route, along, P, Q, D2 } from "../map.js";
import { rig, footPoint, bodyPoints, SILHOUETTE, LONG_COAT } from "../figures.js";
import { lowBackground, person } from "../lowangle.js";
import { comet, trail, rain, floatConfetti, burst, ripple, footGlow, splash, pillar, rings, drawStamp, sparkles } from "../fx.js";

const deg = (d) => (d * Math.PI) / 180;

// 示例路线（按格点写，见 map.js 的 route）：
// 金色从右下走阶梯折线到主路口 P，再沿竖向大道往上；蓝色从左上拐进横向大道，到 P 以后沿斜向大道往右下。
const GOLD = route([[11, 9], [11, 8], [10, 8], [10, 7], [9, 7], [9, 6], [9, 3]]);
const BLUE = route([[5, 4], [7, 4], [7, 6], [9, 6]], [along(P, D2, 800)]);
const GOLD_TO_P = GOLD.path.cum[5]; // 金光轨走到 P 的长度（第 5 个点就是 P）
const BLUE_TO_P = BLUE.path.cum[3];

// 一条街、一张地图，几个镜头共用（第一次用到时才生成）
let S = null;
let M = null;
const useStreet = () => S || (S = makeStreet(23));
const useMap = () => M || (M = buildMap(8, [...GOLD.keys, ...BLUE.keys]));

/**
 * 俯视地图（连招 C）。
 * stampAt：印章砸下的时刻（整片时间，卡在拍点上），要比 tIn 晚 1.1 秒以上；stampChar：印章字，和字幕里的印章字一致。
 * flashIn：上一镜用闪白切进来时为 true（进场 4 帧从模糊里对焦，同时炸彩纸）。
 */
export function mapShot({ tIn, tOut, stampAt, stampChar = "印", flashIn = true }) {
  const e = {};
  e.stamp = stampAt - tIn;
  e.flare = e.stamp - 0.25; // 金光轨经过路口：星芒
  e.punchEnd = e.flare - 0.18;
  e.punch = e.punchEnd - 0.14; // 猛推 4 帧
  e.rings = e.stamp + 0.1;
  e.expose = e.stamp + 0.4; // 开始提亮
  e.white = e.stamp + 0.55; // 开始叠白，0.15 秒到全白
  const blue0 = 0.2; // 蓝光轨先出发，金的晚 2 帧
  const gold0 = 0.26;
  const vGold = GOLD_TO_P / (e.flare - gold0); // 金光轨在星芒那一刻经过 P
  const vBlue = BLUE_TO_P / (e.stamp - blue0); // 蓝光轨在印章那一刻到达 P
  const sGold = (lt) => Math.max(0, Math.min(GOLD.path.total, vGold * (lt - gold0)));
  const sBlue = (lt) => Math.max(0, Math.min(BLUE.path.total, vBlue * (lt - blue0)));

  // 镜头对准的点：从彩纸炸开的广场滑向主路口
  const C = [Q, { x: P.x, y: P.y + 60 }, { x: P.x + 60, y: P.y + 30 }, { x: P.x + 100, y: P.y + 30 }, { x: P.x + 40, y: P.y + 20 }, P];
  const along6 = (k, lt) =>
    track(
      [
        [0, C[0][k]],
        [0.46, C[1][k], ease.out],
        [e.punch, C[2][k], ease.linear],
        [e.punchEnd, C[3][k], ease.inOut],
        [e.rings, C[4][k], ease.linear],
        [e.stamp + 0.62, C[5][k], ease.in],
      ],
      lt,
    );
  function cam(lt) {
    const c = {
      s: track(
        [
          [0, 1.6],
          [0.46, 0.78, ease.out], // 先拉远看全局
          [e.punch, 0.84, ease.linear],
          [e.punchEnd, 2.05, ease.inOut], // 猛推、转正
          [e.rings, 2.22, ease.linear],
          [e.stamp + 0.62, 4.6, ease.in], // 加速推近
          [e.stamp + 0.8, 5.8, ease.linear],
        ],
        lt,
      ),
      rot: deg(
        track(
          [
            [0, -22],
            [0.46, -12, ease.out],
            [e.punch, -9, ease.linear],
            [e.punchEnd, 0, ease.inOut],
            [e.rings, 0, ease.linear],
            [e.stamp + 0.8, 3, ease.in],
          ],
          lt,
        ),
      ),
      cx: along6("x", lt),
      cy: along6("y", lt),
      ox: 0,
      oy: 0,
    };
    // 震屏：印章落下 0.25 秒内
    const ds = lt - e.stamp;
    if (ds > 0 && ds < 0.25) {
      const k = Math.exp(-ds * 18);
      c.ox = 13 * k * Math.sin(ds * Math.PI * 2 * 27);
      c.oy = 9 * k * Math.cos(ds * Math.PI * 2 * 21);
    }
    return c;
  }

  function draw(g, lt) {
    const c = cam(lt);
    drawMap(g, M, c, lt);
    g.save();
    applyCam(g, c);
    if (flashIn) burst(g, lt, { x: Q.x, y: Q.y, scale: 1.1 });
    trail(g, BLUE.path, sBlue(lt), "#7fbfff", "#eef8ff", { width: 1, fadeLen: 1100 });
    trail(g, GOLD.path, sGold(lt), "#f2b85e", "#fff4da", { width: 1 });
    drawStamp(g, stampChar, P.x + 80, P.y - 105, 118, lt - e.stamp, -0.16);
    g.restore();
    const p = toScreen(c, P);
    const fa = lt - e.flare;
    if (fa > -0.04 && fa < 0.32) {
      const env = fa < 0 ? (fa + 0.04) / 0.04 : Math.exp(-fa * 9);
      star(g, p.x, p.y, 340 * env + 40, "#ffe7b0", env, { vRatio: 0.55, th: 0.035, core: 0.25 });
    }
    rings(g, p.x, p.y, lt - e.rings);
    if (flashIn) blurPass(g, 9 * (1 - clamp01(lt / 0.14)));
  }

  const whiteAt = (lt) => Math.max(flashIn ? flashAt(lt, 0) : 0, lt >= e.white ? ease.in(clamp01((lt - e.white) / 0.15)) : 0);
  const exposeAt = (lt) => (lt >= e.expose ? 0.55 * ease.in(clamp01((lt - e.expose) / 0.25)) : 0);
  return { id: "map", tIn, tOut, build: useMap, draw, whiteAt, exposeAt };
}

/** 雨夜街道前推。最后 4 帧（0.14 秒）镜头下沉、整帧模糊，然后硬切下一镜。whiteIn：从上一镜的白场接进来。 */
export function streetShot({ tIn, tOut, whiteIn = true }) {
  const dive0 = tOut - tIn - 0.14;
  // 两道流光：屏幕坐标的三次贝塞尔，一前一后往左上甩
  const GOLD_C = [[1700, 1100], [1300, 860], [900, 520], [380, -140]];
  const BLUE_C = [[2100, 860], [1600, 700], [1150, 380], [700, -160]];

  function draw(g, lt) {
    const k = clamp01(lt / Math.max(0.5, dive0));
    const dive = ease.in(clamp01((lt - dive0) / 0.14));
    const cam = {
      x: 0.3 * Math.sin(lt * 1.3),
      y: lerp(4.4, 3.5, ease.inOut(k)) - 2.7 * dive,
      z: 5 + 9.6 * lt + 2.4 * lt * lt + 8 * dive, // 越推越快
      f: 1100,
      cx: 960,
      cy: 498 + 24 * ease.inOut(k) + 36 * dive,
    };
    drawStreet(g, S, cam);
    floatConfetti(g, lt, { vp: [cam.cx, cam.cy], expand: 0.8 });
    const fade = 1 - dive;
    comet(g, BLUE_C, Math.min(1, 0.05 + 0.6 * lt), Math.max(0, 0.6 * lt - 0.42), "#8cc6ff", "#f2faff", 1.7, fade);
    comet(g, GOLD_C, Math.min(1, 0.2 + 0.55 * lt), Math.max(0, 0.2 + 0.55 * lt - 0.5), "#f3c06c", "#fff6dc", 1.7, fade);
    rain(g, lt, { n: 240, seed: 3 });
    if (dive > 0) blurPass(g, dive * 12);
  }

  const whiteAt = (lt) => (whiteIn ? 1 - ease.out(clamp01(lt / 0.25)) : 0);
  return { id: "street", tIn, tOut, build: useStreet, draw, whiteAt, exposeAt: () => 0 };
}

/**
 * 低机位（连招 A + B）。footA、footB：两个人落脚的时刻（整片时间，卡在拍点上）。
 * 金色线索的人先被流光描出来、落脚、化成闪点；蓝色线索的人接着落脚；
 * 然后两个落脚点冲起光柱 → 竖向甩镜 3 帧 → 闪白。返回值里的 flashTime 就是下一镜的 tIn。
 * endWhite：闪白以后一直白（片尾用）；否则闪白在下一镜里退掉。
 */
export function lowShot({ tIn, tOut, footA, footB, endWhite = false }) {
  const e = {};
  e.footA = footA - tIn;
  e.traceA = e.footA - 0.21; // 流光约 6 帧描到脚尖
  e.fadeA = e.footA + 0.21; // 落脚后约 6 帧开始化成闪点
  e.footB = footB - tIn;
  e.enterB = e.footB - 0.33;
  e.traceB = e.footB - 0.29;
  e.pillars = e.footB + 0.04; // 光柱 2 帧冲到顶
  e.whip = e.pillars + 0.08;
  e.flash = e.whip + 0.11; // 甩镜 3 帧后闪白
  const FA = { dir: 1, s: 0.95, ground: 905, period: 1.1, strike: e.footA, hip: 520 };
  const FB = { dir: -1, s: 1.02, ground: 940, period: 1.1, strike: e.footB, hip: 1440 };
  let fa, fb, traceA, traceB;

  function build() {
    useStreet();
    fa = footPoint(rig(FA, e.footA), 0);
    fb = footPoint(rig(FB, e.footB), 0);
    traceA = [[110, -80], [300, 220], [fa.x + 130, fa.y - 340], [fa.x + 18, fa.y - 10]];
    traceB = [[1830, -80], [1640, 220], [fb.x - 130, fb.y - 340], [fb.x - 18, fb.y - 10]];
  }

  function draw(g, lt) {
    lowBackground(g, S, lt);
    // 金色线索：被流光描出来，剪影从亮奶油色变成实色，落脚，再化成金色闪点
    if (lt >= e.traceA && lt < e.fadeA + 0.22) {
      const alpha = clamp01((lt - e.traceA) / 0.05) * (1 - clamp01((lt - e.fadeA - 0.06) / 0.14));
      const fading = lt >= e.fadeA;
      const light = fading ? ease.in(clamp01((lt - e.fadeA) / 0.12)) : 1 - ease.inOut(clamp01((lt - e.traceA - 0.04) / 0.2));
      const R = person(g, FA, LONG_COAT, lt, { alpha, light, rim: "#ffd58a", lightHex: fading ? "#ffd27a" : "#ffe9c6" });
      if (fading) sparkles(g, lt - e.fadeA, bodyPoints(R), { seed: 51, n: 54, hex: "#ffd98a", span: 0.2, life: 0.45, rise: 170 });
    }
    // 蓝色线索：深色剪影入画，亮色阶段只用 0.55
    if (lt >= e.enterB - 0.04) {
      const alpha = clamp01((lt - e.enterB + 0.04) / 0.06);
      const light = 0.55 * (1 - ease.inOut(clamp01((lt - e.enterB - 0.02) / 0.2)));
      person(g, FB, SILHOUETTE, lt, { alpha, light, rim: "#8fd3ff", lightHex: "#cfe8ff" });
    }
    // 落脚：地上一小片光、水波、溅光点
    footGlow(g, fa.x, fa.y, lt - e.footA, "#ffcf70", 1 - clamp01((lt - e.pillars) / 0.1));
    ripple(g, fa.x, fa.y, lt - e.footA, { hex: "#ffe2a8", a: 0.9, rx: 260 });
    splash(g, fa.x, fa.y - 6, lt - e.footA, { hex: "#ffd27a", seed: 41 });
    footGlow(g, fb.x, fb.y, lt - e.footB, "#8fd3ff", 1 - clamp01((lt - e.pillars) / 0.1));
    ripple(g, fb.x, fb.y, lt - e.footB, { hex: "#c4e8ff", a: 0.9, rx: 290 });
    splash(g, fb.x, fb.y - 6, lt - e.footB, { hex: "#9fd8ff", seed: 42 });
    // 描轮廓的流光
    comet(g, traceA, ease.in(clamp01((lt - e.traceA) / (e.footA - e.traceA))), clamp01((lt - e.traceA - 0.08) / 0.26), "#f3c06c", "#fff6dc", 1.5, 1);
    comet(g, traceB, ease.in(clamp01((lt - e.traceB) / (e.footB - e.traceB))), clamp01((lt - e.traceB - 0.12) / 0.3), "#8cc6ff", "#f2faff", 1.5, 1);
    // 两道光柱，蓝的晚 1 帧
    pillar(g, fa.x, fa.y, lt - e.pillars, "#ffcf70");
    pillar(g, fb.x, fb.y, lt - e.pillars - 0.02, "#8ccfff");
    rain(g, lt, { n: 90, seed: 8, slope: 0.05, speed: 1500, len: [18, 42], alpha: [0.18, 0.42] });
    if (lt >= e.whip && lt < e.flash) whip(g, clamp01((lt - e.whip) / (e.flash - e.whip)));
  }

  const whiteAt = (lt) => {
    if (lt < e.flash) return 0;
    if (endWhite) return lt - e.flash < 0.034 ? 0.93 : Math.min(1, 0.93 + (lt - e.flash) * 0.7);
    return flashAt(lt, e.flash);
  };
  const exposeAt = (lt) => {
    let x = 0;
    if (lt >= e.whip && lt < e.flash) x = 0.45 * ease.in(clamp01((lt - e.whip) / (e.flash - e.whip)));
    const f = lt - e.footA;
    if (f >= 0 && f < 0.12) x = Math.max(x, 0.1 * (1 - f / 0.12));
    return x;
  };
  return { id: "low", tIn, tOut, build, draw, whiteAt, exposeAt, flashTime: tIn + e.flash };
}
