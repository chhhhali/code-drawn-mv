// 字幕：宋体粗体，底部，逐字出现。不跟镜头动。
// 每个字先是放大、模糊、偏淡紫的虚影，约 5 帧（0.17 秒）收成实字，同时右上角闪一颗四芒星。
// 印章字：红色方印从 2.6 倍砸下。金色字：同样的出现方式，换成金色。
import { canvas, star } from "./gfx.js";
import { clamp01, ease } from "./util.js";
import { drawStamp } from "./fx.js";

const SIZE = 72;
const FONT = `700 ${SIZE}px "MVSong", "Songti TC", serif`;
const ADV = 80; // 字距
const STAMP_W = 104;
const MID_Y = 945; // 字的中线
const SP = 160; // 单字贴图边长

const cache = new Map();

function glyph(ch, kind) {
  const key = `${ch}|${kind}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(SP, SP);
  const g = c.getContext("2d");
  g.font = FONT;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const x = SP / 2;
  const y = SP / 2 + 4;
  if (kind === "ghost") {
    g.shadowColor = "rgba(190,175,255,0.9)";
    g.shadowBlur = 14;
    g.fillStyle = "#d6cff3";
    g.fillText(ch, x, y);
  } else {
    const fill = kind === "gold" ? ["#ffe9a8", "#e9b75a"] : ["#fffaf0", "#eadfca"];
    // 深色晕影（画两遍更厚），保证亮背景上也看得清
    g.shadowColor = "rgba(16,12,28,0.9)";
    g.shadowBlur = 16;
    g.shadowOffsetY = 3;
    g.fillStyle = "rgba(16,12,28,0.85)";
    g.fillText(ch, x, y);
    g.fillText(ch, x, y);
    // 淡金外发光
    g.shadowOffsetY = 0;
    g.shadowColor = "rgba(255,212,150,0.55)";
    g.shadowBlur = 22;
    const grd = g.createLinearGradient(0, y - 36, 0, y + 36);
    grd.addColorStop(0, fill[0]);
    grd.addColorStop(1, fill[1]);
    g.fillStyle = grd;
    g.fillText(ch, x, y);
    g.shadowColor = "transparent";
    g.fillText(ch, x, y);
  }
  cache.set(key, c);
  return c;
}

/** 字体加载完以后调用一次，把所有字的贴图先做好。 */
export function prepareCaptions(lines) {
  for (const L of lines)
    for (const ch of L.text) {
      glyph(ch, "white");
      glyph(ch, "ghost");
      glyph(ch, "gold");
    }
}

export function drawChar(ctx, ch, cx, cy, age, out, kind) {
  const p = clamp01(age / 0.17);
  const e = ease.out(p);
  if (p < 1) {
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.9 * out;
    const sc = 1 + 0.3 * (1 - e);
    ctx.translate(cx + 10 * (1 - e), cy - 8 * (1 - e));
    ctx.scale(sc, sc);
    ctx.filter = `blur(${(6 * (1 - e) + 0.5).toFixed(2)}px)`;
    ctx.drawImage(glyph(ch, "ghost"), -SP / 2, -SP / 2);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = e * out;
  ctx.drawImage(glyph(ch, kind), cx - SP / 2, cy - SP / 2);
  ctx.restore();
  const q = age / 0.32;
  if (q < 1) {
    const k = Math.sin(Math.PI * Math.min(1, q * 1.3));
    star(ctx, cx + 30, cy - 30, 30 * k + 4, "#fff3d8", 0.95 * out * k, { rot: 0.3 * q });
  }
}

export function drawCaptions(ctx, lines, t) {
  for (const L of lines) {
    if (t < L.times[0] - 0.05 || t >= L.fadeOut[1]) continue;
    const out = 1 - clamp01((t - L.fadeOut[0]) / (L.fadeOut[1] - L.fadeOut[0]));
    const chars = [...L.text];
    const ws = chars.map((_, i) => (L.stamp.includes(i) ? STAMP_W : ADV));
    let x = 960 - ws.reduce((a, b) => a + b, 0) / 2;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    chars.forEach((ch, i) => {
      const cx = x + ws[i] / 2;
      x += ws[i];
      const age = t - L.times[i];
      if (age < 0) return;
      if (L.stamp.includes(i)) drawStamp(ctx, ch, cx, MID_Y + 4, 100, age, -0.12, out);
      else drawChar(ctx, ch, cx, MID_Y, age, out, L.gold.includes(i) ? "gold" : "white");
    });
    ctx.restore();
  }
}
