// 示例镜头（内容只是示意，照着这个写法写新片的镜头）：
//   nightHill ——夜·草坡（冷色，warm = 0）：月亮慢慢升，一颗流星划过，角色 a 抬头、伸手去指
//   duskMeet  ——黄昏·城边（暖色，warm = 1）：a、b 从两边走过来停下，b 挥手，冒出一颗心，心炸成蜡笔碎片
// 演示了蜡笔版的基本写法：
//   - 布景预先画在大画布上（makeLayer），用 useSet 缓存，同一套布景的镜头共用
//   - 2.5D 视差：drawLayer / withCam 的 depth，1 = 主体平面，越小越远（移动、放大都越少），> 1 是前景
//   - 每个镜头只做一种慢动作（这里是慢推），用 ease.sine 走完整个镜头
//   - 角色动作用 keyed([[秒, 值], ...], lt) 打关键帧；lt = 镜头内时间，T = 整片时间
//   - 情绪爆点：makeShards / drawShards，一个东西炸成一把彩色蜡笔碎片
import { makeLayer, drawLayer, blurLayer, withCam, mote } from "../crayon.js";
import { nightSky, sunsetSky, cloud, sun, godRays, moon, heart, gull, starList, drawStars } from "../art.js";
import { hillLayer, meadow, tree, cityLayers, pavement, foregroundGrass } from "../sets.js";
import { drawPerson } from "../character.js";
import { shootingStar, makeShards, drawShards } from "../fx.js";
import { shot, useSet, ease, ramp, keyed, lerp, mulberry32 } from "../shot.js";

// ---------- 镜头 1：夜·草坡 ----------
const nightSet = () =>
  useSet("night-hill", () => {
    const r = mulberry32(12);
    return {
      sky: makeLayer(-260, -180, 2440, 1220, (g) => nightSky(g, -260, -180, 2440, 1220, 21, 820)),
      stars: starList(5, 70, -200, 2120, -140, 520),
      hills: makeLayer(-260, 420, 2440, 700, (g) => hillLayer(g, { y: 760, mood: "night" })),
      trees: makeLayer(-260, 280, 2440, 760, (g) => {
        tree(g, 230, 860, 120, { mood: "night", seed: 2 });
        tree(g, 1630, 840, 150, { mood: "night", seed: 4 });
        tree(g, 1860, 870, 105, { mood: "night", seed: 6 });
      }),
      hill: makeLayer(-260, 640, 2440, 720, (g) => meadow(g, { y: 820, mood: "night", bottom: 1360 })),
      fg: blurLayer(makeLayer(-260, 760, 2440, 600, (g) => foregroundGrass(g, { mood: "night", y: 1120 })), 9),
      motes: Array.from({ length: 16 }, () => ({ x: 80 + r() * 1760, y: 560 + r() * 380, s: 1.6 + r() * 2.2, v: 6 + r() * 12, ph: r() * 6.28 })),
    };
  });

export function nightHill({ tIn, tOut }) {
  return shot({
    id: "night-hill",
    tIn,
    tOut,
    warm: 0, // 0 = 冷，1 = 暖；也可以写成 lt => 数字，镜头里慢慢变
    draw(g, lt, T) {
      const S = nightSet();
      const k = ease.sine(Math.min(1, lt / (tOut - tIn)));
      const cam = { x: 960 + 30 * k, y: 540 - 20 * k, z: 1 + 0.06 * k }; // 整个镜头只做一种慢动作：慢推
      drawLayer(g, cam, 0.06, S.sky);
      withCam(g, cam, 0.08, (c) => drawStars(c, S.stars, T));
      const s = ramp(lt, 1.6, 2.4);
      if (s > 0 && lt < 2.6) withCam(g, cam, 0.1, (c) => shootingStar(c, lerp(1250, 1750, s), lerp(90, 330, s), 0.45, 220, 1 - ramp(lt, 2.2, 2.55)));
      withCam(g, cam, 0.15, (c) => moon(c, 1380, keyed([[0, 430], [6.5, 300]], lt, ease.inOut), 96));
      drawLayer(g, cam, 0.3, S.hills);
      drawLayer(g, cam, 0.6, S.trees);
      drawLayer(g, cam, 0.92, S.hill);
      withCam(g, cam, 0.95, (c) => {
        for (const m of S.motes) mote(c, m.x + Math.sin(T * 0.8 + m.ph) * 10, m.y - lt * m.v, m.s, "#e8f0a0", 0.35 + 0.35 * Math.sin(T * 2.4 + m.ph));
      });
      withCam(g, cam, 1, (c) => {
        const reach = keyed([[2.2, 0], [2.9, 1], [4.6, 1], [5.6, 0.3]], lt);
        const mood = lt < 1.9 ? "neutral" : lt < 2.9 ? "surprise" : "smile";
        drawPerson(c, "a", 820, 990, 460, { mood, reach, reachAng: -62, gaze: [0.8, -1.4], tilt: -0.6, blink: lt > 1.15 && lt < 1.3 ? 1 : 0, bob: Math.sin(T * 1.6) * 4 });
      });
      drawLayer(g, cam, 1.25, S.fg); // depth > 1：比主体还近，移动得更多
    },
  });
}

// ---------- 镜头 2：黄昏·城边 ----------
const SUN = { x: 1460, y: 610, r: 88 };
const duskSet = () =>
  useSet("dusk-city", () => {
    const sky = makeLayer(-260, -180, 2440, 1000, (g) => {
      sunsetSky(g, -260, -180, 2440, 1000, 8, 700);
      cloud(g, 330, 150, 120, "#e6a495", 3);
      cloud(g, 1600, 120, 96, "#e9a99a", 5);
      cloud(g, 1010, 270, 62, "#ebb1a2", 7);
    });
    const r = mulberry32(8);
    return {
      sky,
      city: cityLayers({ dusk: true }),
      ground: makeLayer(-260, 900, 2440, 460, (g) => pavement(g, { y: 940 })),
      gulls: Array.from({ length: 4 }, () => ({ x: 400 + r() * 900, y: 220 + r() * 160, s: 14 + r() * 10, ph: r() * 6.28, v: 10 + r() * 14 })),
      shards: makeShards(31, 46, (rr) => ({ x: 965 + (rr() - 0.5) * 80, y: 520 + (rr() - 0.5) * 70 }), {
        colors: ["#ec8a9a", "#f2c14e", "#e0704a", "#fbe3a0", "#9cc5b0"],
        speed: [220, 620],
        dir: -Math.PI / 2,
        spread: 2.8,
      }),
    };
  });

export function duskMeet({ tIn, tOut }) {
  const BURST = 5.0; // 心炸开的时刻（镜头内秒数）
  return shot({
    id: "dusk-meet",
    tIn,
    tOut,
    warm: 1,
    draw(g, lt, T) {
      const D = duskSet();
      const k = ease.sine(Math.min(1, lt / 7));
      const cam = { x: 960, y: 560 + 20 * k, z: 1 + 0.06 * k };
      drawLayer(g, cam, 0.06, D.sky);
      withCam(g, cam, 0.08, (c) => {
        godRays(c, SUN.x, SUN.y, [[-2.6, 0.05, 1400], [-2.1, 0.035, 1300], [-1.5, 0.045, 1100], [-0.95, 0.04, 1200], [-0.45, 0.03, 1100]], 0.2);
        sun(c, SUN.x, SUN.y, SUN.r, T);
        for (const s of D.gulls) gull(c, s.x + lt * s.v, s.y + Math.sin(T * 1.3 + s.ph) * 6, s.s, Math.sin(T * 7 + s.ph));
      });
      drawLayer(g, cam, 0.3, D.city.far);
      drawLayer(g, cam, 0.5, D.city.near);
      drawLayer(g, cam, 0.9, D.ground);
      withCam(g, cam, 1, (c) => {
        const walkK = ease.out(ramp(lt, 0, 2.4));
        const moving = lt < 2.3;
        const ax = lerp(420, 780, walkK);
        const bx = lerp(1540, 1150, walkK);
        const wave = keyed([[2.8, 0], [3.3, 0.8], [3.8, 0.55], [4.3, 0.8], [4.8, 0]], lt);
        drawPerson(c, "a", ax, 1010, 480, { mood: lt < 2.6 ? "neutral" : lt < BURST ? "shy" : "surprise", walk: moving ? lt * 1.6 : null, gaze: [0.6, 0] });
        drawPerson(c, "b", bx, 1010, 465, { mood: lt < 2.6 ? "smile" : lt < BURST ? "happy" : "surprise", walk: moving ? lt * 1.6 + 0.5 : null, reach: wave, reachAng: -80, flip: true });
        const hs = ramp(lt, 3.2, 3.6, ease.outBack);
        if (hs > 0 && lt < BURST) heart(c, 965, 540 + Math.sin(T * 2) * 8 - (lt - 3.2) * 6, 56 * hs);
        if (lt >= BURST) drawShards(c, D.shards, lt - BURST, { life: 2.6 });
      });
    },
  });
}
