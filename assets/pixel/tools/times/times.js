// 时段对比四格：同一时刻、同一个镜头，换钟点和天气各画一格。时间就是 snapshot 的 --at；改 PRESETS 换时段。
import { Pix, canvas } from "./src/px.js";
import { createPost } from "./src/post.js";
import { shotAt } from "./src/shots.js";
import { drawFrame } from "./src/frame.js";

export const PRESETS = [
  { label: "清晨薄雾 6:24", env: { hour: 6.4, weather: "clear", sunX: 0.36 } },
  { label: "正午 12:30", env: { hour: 12.5, weather: "clear", sunX: 0.62 } },
  { label: "黄昏逆光 17:36", env: { hour: 17.6, weather: "clear", sunX: 0.6 } },
  { label: "夜雨 21:00", env: { hour: 21, weather: "rain" } },
];

const out = document.getElementById("stage").getContext("2d");
const post = createPost();
const F = { bg: new Pix(), fg: new Pix(), emis: new Pix() };
const full = canvas(1920, 1080);

function renderAt(t) {
  const shot = shotAt(t);
  PRESETS.forEach((p, i) => {
    const o = drawFrame(shot, t, F, p.env);
    const g = full.getContext("2d");
    post.finish(g, F.bg, F.fg, F.emis, { ...o, frame: Math.floor(t * 30) });
    const x = (i % 2) * 960;
    const y = Math.floor(i / 2) * 540;
    out.imageSmoothingEnabled = true;
    out.drawImage(full, x, y, 960, 540);
    out.fillStyle = "rgba(10,8,18,0.66)";
    out.fillRect(x, y + 494, 960, 46);
    out.fillStyle = "#f4f0ff";
    out.font = '600 24px "PingFang SC", sans-serif';
    out.textBaseline = "middle";
    out.fillText(p.label, x + 18, y + 517);
  });
}

window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady["times"] = document.fonts.ready.then(() => renderAt(0));
window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
