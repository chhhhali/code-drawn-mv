// 像素字幕：底部居中两行。上面一行是正在唱的（白字 + 1 像素深色投影），下面一行是下一句预告（灰字、小一号）。
// 字先画在 960×540 的小画布上，再把半透明的边缘二值化（不要抗锯齿），×2 最近邻放大，笔画就是一格一格的像素。
// 歌词由用户提供：set_lyrics.py 写进 timing.phrases，这里只读，不在代码里写歌词。
import { canvas } from "./px.js";

const SW = 960;
const SH = 540;
const sub = canvas(SW, SH);
sub.getContext("2d", { willReadFrequently: true });
export const SUB_FONT = '"PingFang SC", "Hiragino Sans GB", "STHeiti", sans-serif';

function crisp(g, y0, y1) {
  const im = g.getImageData(0, y0, SW, y1 - y0);
  const d = im.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
  g.putImageData(im, 0, y0);
}

/**
 * lines：[{ start, end, text }]（按开唱时间排好，一行一个；timing.phrases 按 line 合并后传进来）
 * o = { y: 第一行的中线（540 画布上，默认 452），size: 字号（默认 24），gap: 两行间距 }
 */
export function drawSubs(out, t, lines, o = {}) {
  if (!lines || !lines.length) return;
  let i = -1;
  for (let k = 0; k < lines.length; k++) if (t >= lines[k].start - 0.15) i = k;
  if (i < 0 || t > lines[i].end + 1.2) return;
  const cur = lines[i];
  const nxt = lines[i + 1];
  const size = o.size || 24;
  const y = o.y || 452;
  const gap = o.gap || size * 1.45;
  const g = sub.getContext("2d");
  g.clearRect(0, 0, SW, SH);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `600 ${size}px ${SUB_FONT}`;
  g.fillStyle = "#120c1c";
  g.fillText(cur.text, SW / 2 + 1, y + 1);
  g.fillStyle = "#f4f0ff";
  g.fillText(cur.text, SW / 2, y);
  if (nxt && nxt.start - t < 6) {
    g.font = `600 ${Math.round(size * 0.86)}px ${SUB_FONT}`;
    g.fillStyle = "#120c1c";
    g.fillText(nxt.text, SW / 2 + 1, y + gap + 1);
    g.fillStyle = "#8f87a8";
    g.fillText(nxt.text, SW / 2, y + gap);
  }
  crisp(g, Math.max(0, y - size), Math.min(SH, y + gap + size));
  out.save();
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.imageSmoothingEnabled = false;
  out.globalAlpha = Math.min(1, (t - (cur.start - 0.15)) / 0.12);
  out.drawImage(sub, 0, 0, SW * 2, SH * 2);
  out.restore();
}

/** timing.phrases → 一行一个 { start, end, text } */
export function linesFromTiming(timing) {
  const m = new Map();
  for (const p of timing.phrases || []) {
    const L = m.get(p.line) || { line: p.line, start: p.start, end: p.end, text: "" };
    L.start = Math.min(L.start, p.start);
    L.end = Math.max(L.end, p.end);
    L.text = L.text ? `${L.text} ${p.text}` : p.text;
    m.set(p.line, L);
  }
  return [...m.values()].sort((a, b) => a.start - b.start);
}
