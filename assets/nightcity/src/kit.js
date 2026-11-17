// 镜头里常用的小工具：分段关键帧、整屏临时画布、整帧模糊、竖向甩镜、压暗。
import { W, H, canvas } from "./gfx.js";
import { clamp01, lerp, ease } from "./util.js";

/**
 * 分段关键帧：[[时间, 值, 这一段的缓动], …]。每一段可以用不同的缓动：
 * 猛推用 ease.inOut，拉远用 ease.out，加速推近用 ease.in，匀速漂移用 ease.linear。
 */
export function track(keys, x) {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [x1, v1, fn = ease.inOut] = keys[i];
    if (x <= x1) {
      const [x0, v0] = keys[i - 1];
      return lerp(v0, v1, fn(clamp01((x - x0) / (x1 - x0))));
    }
  }
  return keys[keys.length - 1][1];
}

const BUF = {};

/** 取一张整屏临时画布（按名字复用），清空并重置状态，返回它的 ctx。画布本身是 ctx.canvas。 */
export function scratch(name) {
  if (!BUF[name]) BUF[name] = canvas(W, H).getContext("2d");
  const g = BUF[name];
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.filter = "none";
  g.clearRect(0, 0, W, H);
  return g;
}

function copyOf(g) {
  const t = scratch("kit-copy");
  t.drawImage(g.canvas, 0, 0);
  return t.canvas;
}

/** 整帧模糊 px 像素（下沉、进场对焦用） */
export function blurPass(g, px) {
  if (px < 0.3) return;
  const c = copyOf(g);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.filter = `blur(${px.toFixed(1)}px)`;
  g.drawImage(c, 0, 0);
  g.restore();
}

/** 竖向甩镜：q 从 0 到 1（一般 3 帧）。同一帧上下错开 14 次取平均，同时竖向拉长 */
export function whip(g, q) {
  const c = copyOf(g);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  const N = 14;
  const step = 18 + 70 * q * q;
  const stretch = 1 + 0.9 * q;
  for (let k = 0; k < N; k++) {
    g.globalAlpha = k === 0 ? 1 : 1 / (k + 1);
    g.drawImage(c, 0, H - H * stretch - k * step, W, H * stretch);
  }
  g.restore();
}

/** 整屏压暗 */
export function dim(g, a, hex = "8,10,20") {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.fillStyle = `rgba(${hex},${a})`;
  g.fillRect(0, 0, W, H);
  g.restore();
}

/** 闪白：at 那一帧 0.93，之后 0.24 秒退掉 */
export function flashAt(lt, at) {
  const f = lt - at;
  if (f < 0 || f >= 0.3) return 0;
  return f < 0.034 ? 0.93 : 0.93 * (1 - ease.out(clamp01((f - 0.034) / 0.24)));
}
