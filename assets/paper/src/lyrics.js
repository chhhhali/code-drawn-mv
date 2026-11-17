// 歌词排版：印在书页上，逐字出现（跟着演唱），关键词放大。
import { clamp01, ease } from "./util.js";
import { PAL } from "./art.js";

const FONT = '"MVSong", "Songti TC", "Songti SC", serif';

/**
 * lines: [{ phrase: {start,end,text}, x, y, size, emph: [charIndex...] }]
 * 返回一个字符串 key：同一 key 表示画面不变，可以跳过重绘。
 */
export function lyricState(lines, t) {
  return lines
    .map((l) => {
      const n = [...l.phrase.text].length;
      const step = charStep(l.phrase, n);
      let s = "";
      for (let i = 0; i < n; i++) s += Math.round(clamp01((t - (l.phrase.start + i * step)) / 0.16) * 20);
      if (l.until) s += ":" + Math.round(clamp01((t - l.until) / 0.25) * 20);
      return s;
    })
    .join("|");
}

function charStep(phrase, n) {
  return Math.min(0.3, ((phrase.end - phrase.start) * 0.72) / Math.max(1, n));
}

export function drawLyrics(ctx, lines, t, ink = "light") {
  ctx.save();
  ctx.textBaseline = "alphabetic";
  const dark = ink === "dark";
  ctx.fillStyle = dark ? "#3d2a20" : PAL.ink;
  ctx.shadowColor = dark ? "rgba(255,242,220,0.7)" : "rgba(8,12,24,0.55)";
  ctx.shadowBlur = dark ? 12 : 8;
  ctx.shadowOffsetY = dark ? 0 : 3;
  for (const l of lines) {
    const fade = l.until ? 1 - clamp01((t - l.until) / 0.25) : 1; // until：这一行在某时刻淡出（给下一行让位）
    if (fade <= 0) continue;
    const chars = [...l.phrase.text];
    const step = charStep(l.phrase, chars.length);
    let x = l.x;
    chars.forEach((ch, i) => {
      const big = l.emph.includes(i);
      const size = big ? l.size * 1.45 : l.size;
      ctx.font = `700 ${size}px ${FONT}`;
      const adv = ch === " " ? l.size * 0.5 : ctx.measureText(ch).width + l.size * 0.04;
      const a = clamp01((t - (l.phrase.start + i * step)) / 0.16);
      if (a > 0 && ch !== " ") {
        ctx.globalAlpha = ease.out(a) * fade;
        const dy = (1 - ease.out(a)) * 10;
        ctx.fillText(ch, x, l.y + dy);
      }
      x += adv;
    });
  }
  ctx.restore();
}
