// 歌词：圆体（繁），粗描边 + 投影，字里有蜡笔斜纹。
// 卡拉 OK 刷色：整句先以半透明灰蓝出现，唱到哪个字，哪个字被"刷"成实色。
// 一行歌词的两个乐句上下叠放；位置由每个镜头指定（放在画面空的地方），不随镜头运动。
import { canvas, pat } from "./crayon.js";
import { clamp01, ease } from "./util.js";

const FONT = '"MVRound", "Yuanti TC", "PingFang TC", sans-serif';

export const INKS = {
  // 夜景：黄字 + 深蓝描边
  yellow: { fill: "#f2d06a", line: "#232146", dim: "#7b83a9", dimLine: "#2a2a52", shadow: "rgba(8,8,30,0.55)" },
  // 黄昏、暖色段落：白字 + 深紫灰描边
  white: { fill: "#f7f2ea", line: "#332e51", dim: "#b5aec0", dimLine: "#4a4566", shadow: "rgba(40,22,30,0.45)" },
};

const CACHE = new Map();

function sprite(text, size, inkName) {
  const key = `${text}|${size}|${inkName}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const ink = INKS[inkName];
  const meas = canvas(8, 8).getContext("2d");
  meas.font = `700 ${size}px ${FONT}`;
  const chars = [...text];
  const adv = chars.map((ch) => (ch === " " ? size * 0.42 : meas.measureText(ch).width + size * 0.05));
  const width = adv.reduce((a, b) => a + b, 0);
  const pad = Math.ceil(size * 0.4);
  const w = Math.ceil(width + pad * 2);
  const h = Math.ceil(size * 1.45 + pad * 2);
  const base = pad + size * 1.05; // 基线
  const make = (fill, line, dim) => {
    const c = canvas(w, h);
    const g = c.getContext("2d");
    g.font = `700 ${size}px ${FONT}`;
    g.textBaseline = "alphabetic";
    g.lineJoin = "round";
    g.lineCap = "round";
    // 描边 + 投影
    g.save();
    g.shadowColor = ink.shadow;
    g.shadowBlur = size * 0.14;
    g.shadowOffsetY = size * 0.06;
    g.strokeStyle = line;
    g.lineWidth = size * 0.2;
    let x = pad;
    chars.forEach((ch, i) => {
      if (ch !== " ") g.strokeText(ch, x, base);
      x += adv[i];
    });
    g.restore();
    // 字面：实色 + 蜡笔斜纹
    const f = canvas(w, h);
    const fg = f.getContext("2d");
    fg.font = g.font;
    fg.textBaseline = "alphabetic";
    fg.fillStyle = fill;
    x = pad;
    chars.forEach((ch, i) => {
      if (ch !== " ") fg.fillText(ch, x, base);
      x += adv[i];
    });
    fg.globalCompositeOperation = "source-atop";
    fg.globalAlpha = dim ? 0.12 : 0.38;
    fg.fillStyle = pat(fg, "hatchW", 0.6);
    fg.fillRect(0, 0, w, h);
    fg.globalAlpha = dim ? 0.08 : 0.16;
    fg.fillStyle = pat(fg, "hatchK", 0.6);
    fg.fillRect(0, 0, w, h);
    g.drawImage(f, 0, 0);
    return c;
  };
  const s = {
    w, h, pad, adv, width, chars,
    sung: make(ink.fill, ink.line, false),
    dim: make(ink.dim, ink.dimLine, true),
  };
  CACHE.set(key, s);
  return s;
}

/** 唱到第几个字（可以带小数）。最后一个字拖长音时，刷色也跟着慢慢走完 */
function progress(ph, n, t) {
  if (t <= ph.start) return 0;
  const dur = ph.end - ph.start;
  const step = Math.min(0.36, (dur * 0.8) / n);
  const lastStart = ph.start + (n - 1) * step;
  if (t < lastStart) return (t - ph.start) / step;
  const lastEnd = Math.max(lastStart + step, ph.end - 0.25);
  return n - 1 + clamp01((t - lastStart) / (lastEnd - lastStart));
}

/**
 * spec: { phrases:[{start,end,text}], x, y, size, ink:"yellow"|"white", align:"left"|"center", gap, until, lead }
 * 一行里的几个乐句上下叠放；until 之后整体淡出。
 */
export function drawLyrics(ctx, spec, t) {
  const { phrases, x, y, size = 80, ink = "yellow", align = "left", gap = 1.3, until = 1e9, lead = 0.5 } = spec;
  const out = 1 - clamp01((t - until) / 0.3);
  if (out <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  phrases.forEach((ph, i) => {
    const appear = ph.start - lead;
    const a = ease.out(clamp01((t - appear) / 0.28));
    if (a <= 0) return;
    const sp = sprite(ph.text, size, ink);
    const px = align === "center" ? x - sp.width / 2 - sp.pad : x - sp.pad;
    const py = y + i * size * gap - sp.pad - (1 - a) * -12;
    ctx.globalAlpha = a * out;
    ctx.drawImage(sp.dim, px, py);
    // 刷色：到第几个字（含半个字）
    const n = sp.chars.length;
    const p = progress(ph, n, t);
    if (p > 0) {
      const whole = Math.floor(p);
      let wx = sp.pad;
      for (let j = 0; j < Math.min(whole, n); j++) wx += sp.adv[j];
      if (whole < n) wx += sp.adv[whole] * (p - whole);
      else wx = sp.w;
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, wx, sp.h);
      ctx.clip();
      ctx.drawImage(sp.sung, px, py);
      ctx.restore();
    }
  });
  ctx.restore();
}
