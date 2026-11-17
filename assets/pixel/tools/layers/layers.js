// 分层拆解的四格。时间就是 snapshot 的 --at。
import { Pix, canvas } from "./src/px.js";
import { createPost } from "./src/post.js";
import { shotAt } from "./src/shots.js";
import { drawFrame } from "./src/frame.js";

const out = document.getElementById("stage").getContext("2d");
const post = createPost();
const bg = new Pix();
const fg = new Pix();
const emis = new Pix();
const none = new Pix();
const full = canvas(1920, 1080);
const low = canvas(480, 270);
const LABELS = ["① 背景层（像素，没有后期）", "② 加上主体：亮层、暗层、轮廓光、描边是按光源算出来的", "③ 发光层（灯 + 够亮的像素）：缩小、模糊、放大，三级叠加", "④ 成片：泛光 + 光柱 + 雾气 + 背景虚化 + 暗角 + 颗粒"];

function panel(i, draw) {
  const g = full.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.fillStyle = "#000";
  g.fillRect(0, 0, 1920, 1080);
  draw(g);
  const x = (i % 2) * 960;
  const y = Math.floor(i / 2) * 540;
  out.imageSmoothingEnabled = true;
  out.drawImage(full, x, y, 960, 540);
  out.fillStyle = "rgba(10,8,18,0.72)";
  out.fillRect(x, y + 494, 960, 46);
  out.fillStyle = "#f4f0ff";
  out.font = '600 24px "PingFang SC", sans-serif';
  out.textBaseline = "middle";
  out.fillText(LABELS[i], x + 18, y + 517);
}

function nearest(g, pix) {
  pix.toCanvas(low.getContext("2d"));
  g.imageSmoothingEnabled = false;
  g.drawImage(low, 0, 0, 1920, 1080);
}

function renderAt(t) {
  const shot = shotAt(t);
  const o = drawFrame(shot, t, { bg, fg, emis });
  panel(0, (g) => nearest(g, bg));
  panel(1, (g) => (nearest(g, bg), nearest(g, fg)));
  panel(2, (g) => post.finish(g, none, none, emis, { ...o, dof: 0, haze: 0, rays: null, frame: 0 }));
  panel(3, (g) => post.finish(g, bg, fg, emis, { ...o, frame: Math.floor(t * 30) }));
}

window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady["layers"] = document.fonts.ready.then(() => renderAt(0));
window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
