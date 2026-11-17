// 纸艺立体书版 MV —— 入口：按时间 t 画每一帧（HyperFrames 的 hf-seek 驱动，帧可能乱序渲染）。
// 整支片发生在一本立体书里：开头镜头从书桌推进书页（前奏）；中间每句歌词一页（全屏）；结尾拉远回到书桌、合上书。
// 这里放：分镜表 SHOTS、开场/结尾的时间、镜头混合、冷暖。每一页写在 src/scenes/*.js（PaperScene）。
import timing from "./data/timing.js";
import { createStage, buildLights } from "./stage.js";
import { buildBookWorld } from "./book.js";
import { TRANS } from "./kit.js";
import { nightStreet } from "./scenes/nightStreet.js";
import { duskRiverside } from "./scenes/duskRiverside.js";
import { ramp, ease, lerp } from "./util.js";

const COVER = { title: "片名", subtitle: "" }; // 封面上的书名（改成歌名）
const { scene, camera, composer, film } = createStage(document.getElementById("stage"));
const LINE = (n) => timing.phrases.find((p) => p.line === n).start;
const END = timing.duration;

// 开场（书桌 → 翻开书 → 镜头推进书页）和结尾（拉远 → 剪纸倒下 → 合书 → 淡出），都按片长自动算
const INTRO = { fadeIn: [0, 2.2], open: [1.0, 4.2], dive: [4.6, 8.4] };
const OUTRO = { start: END - 8.97, pull: [END - 8.97, END - 4.87], fold: [END - 5.67, END - 4.67], close: [END - 4.67, END - 2.17], frame: [END - 4.87, END - 1.07], fadeOut: [END - 1.57, END - 0.02] };

// 分镜表：tIn = 这一页开始，tOut = 下一页开始（换页在 tOut 前后 0.5 秒内完成，对齐下一句开唱）
// 第一页在书翻开时就立起来；最后一页的 tOut 写 1e9
const SHOTS = [
  { make: (w, t, o) => nightStreet(w, t, { ...o, line: 1 }), tIn: INTRO.open[1] - 0.8, tOut: LINE(2) },
  { make: (w, t, o) => duskRiverside(w, t, { ...o, line: 2 }), tIn: LINE(2), tOut: 1e9 },
];

const CLOSED = (Math.PI / 2) * 0.997;
const BASE = { pos: [0.2, 3.05, 13.6], look: [0.1, 2.35, 0.5] }; // 全屏一页时的基准机位
const DESK = { pos: [2.4, 15.5, 41.5], look: [0, 0.4, 3.4] }; // 合上的书平躺在桌上
const OPEN = { pos: [2.0, 11.5, 35.5], look: [0, 2.2, 2.0] }; // 翻开的书
const WARM = { cool: 0.12, warm: 0.92, book: 0.55 }; // 后期冷暖：冷色页 / 暖色页 / 书桌

let scenes = [];
let book = null;

async function build() {
  await document.fonts.load('700 76px "MVSong"');
  buildLights(scene, "fullscreen");
  book = buildBookWorld(scene, COVER);
  scenes = SHOTS.map((s, i) => s.make(scene, timing, { tIn: s.tIn, tOut: s.tOut, index: i }));
  // 每页地面的背面，印着下一幕的背景（翻页时露出来）
  scenes.forEach((s, i) => scenes[i + 1] && s.setUnder(scenes[i + 1].back.tex));
}

function camOf(s, t) {
  const o = s.cam ? s.cam(t - s.tIn) : {};
  return { dx: o.dx || 0, dy: o.dy || 0, dz: o.dz || 0, lx: o.lx || 0, ly: o.ly || 0 };
}
const blendO = (a, b, k) => Object.fromEntries(Object.keys(a).map((key) => [key, a[key] + (b[key] - a[key]) * k]));
const P = (base, o) => ({ pos: [base.pos[0] + o.dx, base.pos[1] + o.dy, base.pos[2] + o.dz], look: [base.look[0] + o.lx, base.look[1] + o.ly, base.look[2]] });
const mixCam = (a, b, k) => ({ pos: a.pos.map((v, i) => lerp(v, b.pos[i], k)), look: a.look.map((v, i) => lerp(v, b.look[i], k)) });

/** 当前页（含换页时的过渡）的镜头偏移和冷暖：换页那 0.6 秒里两页的镜头和色调平滑过渡 */
function sceneState(t) {
  let i = scenes.findIndex((s) => t < s.tOut);
  if (i < 0) i = scenes.length - 1;
  const cur = scenes[i];
  let o = camOf(cur, Math.min(t, cur.tOut));
  let warm = WARM[cur.mood];
  const prev = scenes[i - 1];
  if (prev) {
    const T = prev.tOut;
    const k = ramp(t, T + TRANS.lift[0], T + TRANS.lift[1], ease.inOut);
    if (k < 1) {
      o = blendO(camOf(prev, T + TRANS.lift[0]), camOf(cur, T), k);
      warm = lerp(WARM[prev.mood], WARM[cur.mood], k);
    }
  }
  const next = scenes[i + 1];
  if (next && t > cur.tOut + TRANS.lift[0]) {
    const T = cur.tOut;
    const k = ramp(t, T + TRANS.lift[0], T + TRANS.lift[1], ease.inOut);
    o = blendO(camOf(cur, T + TRANS.lift[0]), camOf(next, T), k);
    warm = lerp(WARM[cur.mood], WARM[next.mood], k);
  }
  return { cam: P(BASE, o), warm };
}

function renderAt(t) {
  if (!scenes.length) return;
  const first = scenes[0];
  const last = scenes[scenes.length - 1];
  // 书：前奏里翻开，结尾合上；第一页 / 最后一页的背景纸跟着封面一起转
  const opening = 1 - ease.inOut(ramp(t, INTRO.open[0], INTRO.open[1]));
  const closing = ease.inOut(ramp(t, OUTRO.close[0], OUTRO.close[1]));
  const angle = CLOSED * Math.max(opening, closing);
  book.back.rotation.x = angle;
  // （如果某一页要把背景纸撕开、露出后面的夜空，那几秒要把 book.back 藏起来，否则露出的是书的页块）
  first.page.rotation.x = t < INTRO.dive[1] ? angle : 0;
  last.page.rotation.x = t > OUTRO.start ? angle : 0;
  last.outroFold = ramp(t, OUTRO.fold[0], OUTRO.fold[1], ease.inOut);
  first.layersHidden = t < INTRO.dive[1] && angle > 0.35; // 书没翻开到 70° 以前剪纸先藏起来，免得伸出书外
  last.layersHidden = t > OUTRO.start && closing > 0.45;

  scenes.forEach((s, i) => s.update(t, { first: i === 0, last: i === scenes.length - 1 }));

  // 镜头与冷暖
  const st = sceneState(t);
  let cam = st.cam;
  let warm = st.warm;
  if (t < INTRO.dive[1]) {
    const pre = mixCam(DESK, OPEN, ease.inOut(ramp(t, 0, INTRO.dive[0])));
    const k = ease.inOut(ramp(t, INTRO.dive[0], INTRO.dive[1]));
    cam = mixCam(pre, cam, k);
    warm = lerp(WARM.book, warm, ramp(t, INTRO.dive[1] - 4.0, INTRO.dive[1]));
  }
  if (t > OUTRO.start) {
    const k = ease.inOut(ramp(t, OUTRO.pull[0], OUTRO.pull[1]));
    const wide = mixCam(OPEN, DESK, ease.inOut(ramp(t, OUTRO.frame[0], OUTRO.frame[1])));
    cam = mixCam(cam, wide, k);
    warm = lerp(warm, WARM.book, ramp(t, OUTRO.start, OUTRO.start + 3));
  }
  camera.position.set(...cam.pos);
  camera.lookAt(...cam.look);

  film.uniforms.uWarm.value = warm;
  film.uniforms.uFade.value = ramp(t, INTRO.fadeIn[0], INTRO.fadeIn[1]) * (1 - ramp(t, OUTRO.fadeOut[0], OUTRO.fadeOut[1]));
  film.uniforms.uFrame.value = Math.floor(t * 30); // 颗粒每帧不同，但同一帧每次一样
  composer.render();
}

window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady["mv-stage"] = build().then(() => renderAt(0));
window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
