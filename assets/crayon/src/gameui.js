// 可选手法：用"游戏界面"配歌词（蜡笔皮肤）。
// 只在这句歌词本来就像一个游戏动作时用（拿到东西、做选择、数值在掉、任务提示、换章节），一支片子几处就够，别盖过画面。
// 全部画在屏幕坐标里（镜头外面）：字和框不跟着镜头缩放，一直清楚。k 是出现进度 0→1，用 cues.js 的 settle / hit 算。
// 用了模板里的 crayon.js、art.js、util.js。哪些歌词配什么界面、多久出现一次，是分镜的事（lyric-scene-mv 的 shells.md）；
// 别的画风照着这几个函数的版式换一套皮肤，镜头代码就不用改。
import { crayon, star } from "./crayon.js";
import { rrect, heart } from "./art.js";
import { ease, clamp01 } from "./util.js";

export const UI_FONT = '"MVRound", "Yuanti SC", "Yuanti TC", sans-serif';
export const UI_INK = { paper: "#fff6dc", line: "#c9944a", text: "#6b3f22", accent: "#e0704a", good: "#7fb069", cold: "#7fa7d9", dim: "#b9a98c" };

const pop = (k) => 0.6 + 0.4 * ease.outBack(clamp01(k));

function paper(g, w, h, r, o = {}) {
  crayon(g, rrect(-w / 2, -h / 2, w, h, r), { fill: o.fill || UI_INK.paper, line: o.line || UI_INK.line, lw: 4, shade: 0.1, hl: 0.12, fleck: 0.15 });
}

function text(g, s, x, y, size, color = UI_INK.text, align = "left") {
  g.font = `700 ${size}px ${UI_FONT}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = "middle";
  g.fillText(s, x, y + size * 0.04);
}

/** 拿到东西：itemTag(g, x, y, "获得 · 卡片 ×1", k, { icon: (g, cx, cy, s) => … }) */
export function itemTag(g, x, y, label, k, { icon = null, size = 38, rot = -0.04 } = {}) {
  if (k <= 0) return;
  g.save();
  g.font = `700 ${size}px ${UI_FONT}`;
  const tw = g.measureText(label).width;
  const iw = icon ? size * 1.3 : 0;
  const w = tw + iw + size * 1.3;
  const h = size * 1.8;
  g.translate(x, y);
  g.rotate(rot);
  g.scale(pop(k), pop(k));
  g.globalAlpha = clamp01(k * 2.5);
  paper(g, w, h, h * 0.45);
  if (icon) icon(g, -w / 2 + size * 0.65 + iw * 0.4, 0, size * 0.95);
  text(g, label, -w / 2 + size * 0.65 + iw, 0, size);
  g.restore();
}

/** 任务提示 / 喊一句：questBanner(g, 960, 200, "接住它！", k)。两头各一颗星。 */
export function questBanner(g, x, y, label, k, { size = 56, color = UI_INK.accent, T = 0 } = {}) {
  if (k <= 0) return;
  g.save();
  g.font = `700 ${size}px ${UI_FONT}`;
  const w = g.measureText(label).width + size * 2.6;
  const h = size * 1.7;
  g.translate(x, y);
  g.rotate(Math.sin(T * 3) * 0.015);
  g.scale(pop(k), pop(k));
  g.globalAlpha = clamp01(k * 2.5);
  paper(g, w, h, h * 0.3, { fill: "#fffaf0", line: color });
  text(g, label, 0, 0, size, color, "center");
  for (const s of [-1, 1]) star(g, s * (w / 2 - size * 0.7), 0, size * 0.3, 0.6 + 0.4 * Math.sin(T * 5 + s), "#f2c14e");
  g.restore();
}

/** 数值条（体温、想念、进度）：meter(g, x, y, 420, "温暖", 0.35, k, { color }) —— value 用 keyed 随歌词涨落 */
export function meter(g, x, y, w, label, value, k, { size = 30, color = UI_INK.accent, icon = null } = {}) {
  if (k <= 0) return;
  const h = size * 2.4;
  g.save();
  g.translate(x, y);
  g.scale(pop(k), pop(k));
  g.globalAlpha = clamp01(k * 2.5);
  paper(g, w, h, size * 0.5);
  const lx = -w / 2 + size * 0.7;
  if (icon) icon(g, lx + size * 0.4, 0, size * 0.9);
  text(g, label, lx + (icon ? size * 1.1 : 0), 0, size);
  g.font = `700 ${size}px ${UI_FONT}`;
  const bx = lx + (icon ? size * 1.1 : 0) + g.measureText(label).width + size * 0.6;
  const bw = w / 2 - size * 0.7 - bx;
  const bh = size * 0.8;
  crayon(g, rrect(bx, -bh / 2, bw, bh, bh / 2), { fill: "#f3e7cf", line: UI_INK.dim, lw: 3, shade: 0.12 });
  const v = clamp01(value);
  if (v > 0.01) crayon(g, rrect(bx + 3, -bh / 2 + 3, Math.max(bh - 6, (bw - 6) * v), bh - 6, (bh - 6) / 2), { fill: color, lw: 2.5, shade: 0.18, hl: 0.15 });
  g.restore();
}

/** 选择题：choice(g, 960, 860, "要拆开吗？", ["拆开", "不拆"], 1, k, T) —— 选中项前面一个会跳的小手指 ▶ */
export function choice(g, x, y, question, options, selected, k, T = 0, { size = 40 } = {}) {
  if (k <= 0) return;
  g.save();
  g.font = `700 ${size}px ${UI_FONT}`;
  const ow = options.map((o) => g.measureText(o).width + size * 1.6);
  const w = Math.max(g.measureText(question).width, ow.reduce((a, b) => a + b, 0)) + size * 2;
  const h = size * 3.6;
  g.translate(x, y);
  g.scale(pop(k), pop(k));
  g.globalAlpha = clamp01(k * 2.5);
  paper(g, w, h, size * 0.5);
  text(g, question, 0, -size * 0.75, size, UI_INK.text, "center");
  let ox = -ow.reduce((a, b) => a + b, 0) / 2;
  options.forEach((o, i) => {
    const on = i === selected;
    text(g, o, ox + size * 1.1, size * 0.85, size, on ? UI_INK.accent : UI_INK.dim);
    if (on) text(g, "▶", ox + size * 0.1 + Math.sin(T * 8) * size * 0.08, size * 0.85, size * 0.8, UI_INK.accent);
    ox += ow[i];
  });
  g.restore();
}

/** 章节卡：chapterCard(g, "第二章", "她的冬天", k) —— 换视角、换季节、换人时用；k 从 0 到 1 再回 0 */
export function chapterCard(g, title, sub, k, { W = 1920, H = 1080 } = {}) {
  if (k <= 0) return;
  g.save();
  g.globalAlpha = clamp01(k) * 0.55;
  g.fillStyle = "#1c1733";
  g.fillRect(0, 0, W, H);
  g.globalAlpha = clamp01(k);
  g.translate(W / 2, H / 2);
  paper(g, 760, 230, 26);
  text(g, title, 0, -38, 64, UI_INK.text, "center");
  text(g, sub, 0, 46, 44, UI_INK.accent, "center");
  heart(g, -300, -40, 22, "#ec8a9a");
  heart(g, 300, -40, 22, "#ec8a9a");
  g.restore();
}

/** 存档点：在回忆、合照、承诺这类歌词上用（"把这一刻存下来"） */
export function savePrompt(g, x, y, k, T = 0, { label = "存档中…", size = 34 } = {}) {
  if (k <= 0) return;
  g.save();
  g.translate(x, y);
  g.scale(pop(k), pop(k));
  g.globalAlpha = clamp01(k * 2.5);
  paper(g, size * 9, size * 1.9, size * 0.5);
  text(g, label, -size * 3.6, 0, size);
  const dots = Math.floor(T * 4) % 4;
  for (let i = 0; i < 3; i++) {
    g.globalAlpha = clamp01(k * 2.5) * (i < dots ? 1 : 0.25);
    crayon(g, rrect(size * 1.4 + i * size * 0.9, -size * 0.3, size * 0.6, size * 0.6, size * 0.2), { fill: UI_INK.good, lw: 2, shade: 0.1 });
  }
  g.restore();
}
