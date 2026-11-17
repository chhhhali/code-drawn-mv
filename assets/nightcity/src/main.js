// 夜城流光 MV —— 入口：按时间 t 画每一帧（HyperFrames 的 hf-seek 驱动，帧可能乱序渲染）。
// 这里放三样东西：分镜表 SHOTS、字幕（从乐句生成，MARKS 标金色字和印章字）、片尾淡出。镜头本身写在 src/scenes/*.js。
// 时间轴来自 src/data/timing.js（由 data/timing.json 生成：乐句 phrases、拍点 beats、小节线 downbeats）。
import timing from "./data/timing.js";
import { W, H } from "./gfx.js";
import { clamp01 } from "./util.js";
import { createPost } from "./post.js";
import { drawCaptions, prepareCaptions } from "./captions.js";
import { mapShot, streetShot, lowShot } from "./scenes/example.js";

const END = timing.duration;

/** 第 n 拍的时间（从 0 数；n 可以带小数，13.5 = 第 13 拍后面半拍） */
function beat(n) {
  const b = timing.beats;
  const i = Math.floor(n);
  const base = i < b.length ? b[i] : b[b.length - 1] + (i - b.length + 1) * timing.beat_period;
  return base + (n - i) * timing.beat_period;
}

// 字幕：一个乐句一行，字在乐句里平均分配出现时间。
// MARKS[乐句编号] = { gold: [字的序号], stamp: [字的序号] }，序号从 0 数。每句最多一个印章字。
const MARKS = {
  1: { stamp: [6] },
  2: { gold: [2] },
};
const HOLD = 0.6; // 唱完以后字幕再留多久（秒）；下一句开唱前 0.25 秒一定淡完
export const CAPTIONS = timing.phrases.map((p, i, all) => {
  const n = [...p.text].length;
  const times = [...p.text].map((_, k) => +(p.start + ((p.end - p.start) * k) / n).toFixed(3));
  const next = all[i + 1];
  const f1 = Math.min(next ? next.start - 0.25 : Infinity, p.end + HOLD, END - 0.15);
  const m = MARKS[p.phrase] || {};
  return { text: p.text, times, stamp: m.stamp || [], gold: m.gold || [], fadeOut: [f1 - 0.2, f1] };
});

/** 某个乐句的印章字（画面里也盖同一枚） */
function stampChar(phrase) {
  const c = CAPTIONS[phrase - 1];
  return c && c.stamp.length ? [...c.text][c.stamp[0]] : "印";
}

// 分镜表：切点卡在拍点上。示例：俯视地图（连招 C）→ 白场接街道前推 → 下沉硬切到低机位（连招 A + B），以闪白收尾。
// 用闪白换场时，下一镜的 tIn 用上一镜的 flashTime（lowShot 返回）。
export const SHOTS = [
  mapShot({ tIn: 0, tOut: beat(6), stampAt: beat(4), stampChar: stampChar(1) }),
  streetShot({ tIn: beat(6), tOut: beat(11) }),
  lowShot({ tIn: beat(11), tOut: END + 1, footA: beat(12), footB: beat(13.5), endWhite: true }),
];

const out = document.getElementById("stage").getContext("2d");
const post = createPost();
let ready = false;

async function build() {
  await document.fonts.load('700 72px "MVSong"'); // 字体没加载完就画，第一帧会是后备字体
  for (const s of SHOTS) if (s.build) s.build();
  prepareCaptions(CAPTIONS);
  ready = true;
}

function renderAt(t) {
  if (!ready) return;
  const shot = SHOTS.find((s) => t >= s.tIn && t < s.tOut) || SHOTS[SHOTS.length - 1];
  const lt = Math.max(0, t - shot.tIn);
  const g = post.g;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.filter = "none";
  g.fillStyle = "#0e1220";
  g.fillRect(0, 0, W, H);
  shot.draw(g, lt, t);
  const fo = timing.fade_out; // 有歌曲时 new_project.py 会写进片尾淡出 [开始, 结束]
  post.finish(out, {
    frame: Math.floor(t * 30 + 1e-4),
    white: shot.whiteAt ? shot.whiteAt(lt) : 0,
    expose: shot.exposeAt ? shot.exposeAt(lt) : 0,
    lyrics: (c) => drawCaptions(c, CAPTIONS, t),
    fade: fo ? clamp01((t - fo[0]) / (fo[1] - fo[0])) : 0,
  });
}

window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady["mv-stage"] = build().then(() => renderAt(0));
window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
