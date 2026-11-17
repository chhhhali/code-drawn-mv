// 蜡笔绘本版 MV —— 入口：按时间 t 画每一帧（HyperFrames 的 hf-seek 驱动，帧可能乱序渲染）。
// 这里放三样东西：分镜表 SHOTS、每行歌词的位置和颜色 LY、整片的淡入淡出。镜头本身写在 src/scenes/*.js。
// 时间轴来自 src/data/timing.js（由 data/timing.json 生成：乐句 phrases、拍点 beats、小节线 downbeats）。
import timing from "./data/timing.js";
import { W, H, textures, onTwos } from "./crayon.js";
import { createPost } from "./post.js";
import { drawLyrics } from "./lyrics.js";
import { ramp } from "./util.js";
import { nightHill, duskMeet } from "./scenes/example.js";

const phrasesOf = (line) => timing.phrases.filter((p) => p.line === line);
const L = (line) => phrasesOf(line)[0].start; // 第 line 行开唱的时间
const END = timing.duration;

// 分镜表：切点 = 某行开唱的时间，或者 timing.beats 里的某个拍点。最后一个镜头的 tOut 留到 END 之后。
export const SHOTS = [
  nightHill({ tIn: 0, tOut: L(2) }),
  duskMeet({ tIn: L(2), tOut: END + 1 }),
];

// 每行歌词：[x, y, 颜色, 字号]。夜景用 "yellow"（黄字深蓝边），黄昏、暖色段落用 "white"（白字深紫边）。
// 位置跟着构图走（放在画面空的地方），同一行在快切里不要挪位置。
const LY = {
  1: [150, 150, "yellow"],
  2: [150, 150, "white"],
};
const LINES = Object.keys(LY).map(Number);
const LYRICS = LINES.map((n, i) => {
  const [x, y, ink, size] = LY[n];
  const ph = phrasesOf(n);
  const next = i + 1 < LINES.length ? L(LINES[i + 1]) : END - 1.2;
  // until：下一行开唱前 0.55 秒先淡完，两行不会叠在一起
  return { from: ph[0].start - 0.3, spec: { phrases: ph, x, y, ink, size: size || 82, until: next - 0.55, lead: 0.25 } };
});

// true = 每一帧都按真实时间画（30 fps 逐帧连续）；false = "一拍二"（每秒只换 12 张画，有手工顿挫感，但动作会显得卡）
const SMOOTH = true;
const FPS = 30;

const out = document.getElementById("stage").getContext("2d");
const post = createPost();
let ready = false;

async function build() {
  await document.fonts.load('700 80px "MVRound"'); // 字体没加载完就画，第一帧会是后备字体
  textures(); // 蜡笔纹理只生成一次
  ready = true;
}

function renderAt(t) {
  if (!ready) return;
  const T = SMOOTH ? t : onTwos(t);
  const shot = SHOTS.find((s) => t >= s.tIn && t < s.tOut) || SHOTS[SHOTS.length - 1];
  const lt = Math.max(0, T - shot.tIn);
  const g = post.g;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.filter = "none";
  g.fillStyle = "#0d0c1a";
  g.fillRect(0, 0, W, H);
  shot.draw(g, lt, T);
  post.finish(out, {
    frame: Math.floor(t * (SMOOTH ? FPS : 12) + 1e-4),
    warm: shot.warmAt(lt),
    fade: ramp(t, 0, 1.2) * (1 - ramp(t, END - 1.5, END - 0.02)),
    lyrics: (c) => {
      for (const ly of LYRICS) if (t >= ly.from && t < ly.spec.until + 0.35) drawLyrics(c, ly.spec, t);
    },
  });
}

window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady["mv-stage"] = build().then(() => renderAt(0));
window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
