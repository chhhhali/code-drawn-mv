// 像素光影版 MV —— 入口：按时间 t 画每一帧（HyperFrames 的 hf-seek 驱动，帧可能乱序渲染）。
// 每帧：按镜头的 env（钟点、天气）设好光 → 清空三张 480×270 的画面（背景 bg、主体 fg、发光 emis）→ 镜头往里画
//   → 太阳光晕只加到看得见的天空上（skyLight）→ 够亮的像素也加进发光层（brightPass）→ post.finish 合成到 1920×1080 → 像素字幕。
// 分镜表 SHOTS 在 src/shots.js；镜头写在 src/scenes/*.js，返回这一帧的后期参数（dof 背景虚化、bloom、haze、tint）。
import timing from "./data/timing.js";
import { Pix } from "./px.js";
import { createPost } from "./post.js";
import { drawFrame } from "./frame.js";
import { drawSubs, linesFromTiming } from "./subs.js";
import { ramp } from "./util.js";
import { END, shotAt } from "./shots.js";

const LINES = linesFromTiming(timing); // 用户的歌词（set_lyrics.py 写入）；没有就不显示字幕
const FPS = 30;
const out = document.getElementById("stage").getContext("2d");
const post = createPost();
const bg = new Pix();
const fg = new Pix();
const emis = new Pix();
let ready = false;

async function build() {
  await document.fonts.ready;
  ready = true;
}

function renderAt(t) {
  if (!ready) return;
  const shot = shotAt(t);
  const o = drawFrame(shot, t, { bg, fg, emis });
  post.finish(out, bg, fg, emis, { ...o, frame: Math.floor(t * FPS + 1e-4), fade: ramp(t, 0, 0.8) * (1 - ramp(t, END - 1.2, END - 0.02)) });
  drawSubs(out, t, LINES);
}

window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady["mv-stage"] = build().then(() => renderAt(0));
window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
