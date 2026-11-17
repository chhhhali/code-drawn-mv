// 低机位：虚化的街景背景、光斑、湿地面（倒影、往消失点收拢的斑马线、雨点小水波），
// 以及人物剪影的画法（倒影、亮色阶段、轮廓光）。
import { W, H, canvas, paperCanvas, rgba } from "./gfx.js";
import { mulberry32 } from "./util.js";
import { drawStreet } from "./street.js";
import { bokeh } from "./fx.js";
import { rig, drawFigure } from "./figures.js";
import { scratch } from "./kit.js";

export const G0 = 706; // 湿地面的远端（屏幕 y）；下面 35% 是地面

let zebraImg = null;
let zebraPat = null;

function zebraTexture() {
  const c = canvas(256, 256);
  const zg = c.getContext("2d");
  zg.fillStyle = "#7f7e88";
  zg.fillRect(0, 0, 256, 256);
  zg.globalCompositeOperation = "soft-light";
  zg.drawImage(paperCanvas(256, 17), 0, 0);
  zg.drawImage(paperCanvas(256, 18), 0, 0);
  zg.globalCompositeOperation = "source-over";
  const r = mulberry32(19);
  for (let i = 0; i < 160; i++) {
    zg.fillStyle = `rgba(60,60,70,${0.08 + r() * 0.12})`;
    zg.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 2);
  }
  return c;
}

/** 湿地面。bg：这一帧的背景画布（画倒影用）；lt：时间（雨点小水波用） */
export function wetGround(g, bg, lt) {
  const grd = g.createLinearGradient(0, G0 - 60, 0, H);
  grd.addColorStop(0, "rgba(22,25,38,0)");
  grd.addColorStop(0.14, "rgba(22,25,38,0.96)");
  grd.addColorStop(1, "#0b0e18");
  g.fillStyle = grd;
  g.fillRect(0, G0 - 60, W, H - G0 + 60);
  // 背景在湿地上的倒影
  g.save();
  g.beginPath();
  g.rect(0, G0, W, H - G0);
  g.clip();
  g.globalCompositeOperation = "screen";
  g.globalAlpha = 0.22;
  g.filter = "blur(10px)";
  g.translate(0, G0);
  g.scale(1, -0.62);
  g.translate(0, -G0);
  g.drawImage(bg, 0, 0);
  g.restore();
  // 斑马线：向消失点收拢的纸灰色梯形
  if (!zebraImg) zebraImg = zebraTexture();
  if (!zebraPat) zebraPat = g.createPattern(zebraImg, "repeat");
  const vx = 960;
  const vy = 470;
  const yf = G0 + 6;
  const yn = H + 60;
  const kf = (yf - vy) / (yn - vy);
  g.save();
  g.globalAlpha = 0.92;
  g.fillStyle = zebraPat;
  for (let i = -2; i <= 2; i++) {
    const c = 960 + i * 570 - 40;
    const xn0 = c - 190;
    const xn1 = c + 190;
    g.beginPath();
    g.moveTo(vx + (xn0 - vx) * kf, yf);
    g.lineTo(vx + (xn1 - vx) * kf, yf);
    g.lineTo(xn1, yn);
    g.lineTo(xn0, yn);
    g.closePath();
    g.fill();
  }
  g.restore();
  // 远端边缘融进夜色，不要一条硬线
  const soft = g.createLinearGradient(0, G0 - 4, 0, G0 + 110);
  soft.addColorStop(0, "rgba(18,20,32,0.9)");
  soft.addColorStop(1, "rgba(18,20,32,0)");
  g.fillStyle = soft;
  g.fillRect(0, G0 - 4, W, 114);
  // 雨点小水波
  const r = mulberry32(77);
  g.save();
  g.globalCompositeOperation = "lighter";
  g.lineWidth = 1.4;
  for (let i = 0; i < 46; i++) {
    const x = r() * W;
    const y = G0 + 20 + r() * (H - G0 - 20);
    const per = 0.45 + r() * 0.5;
    const ph = r() * per;
    const q = ((((lt + ph) % per) + per) % per) / per;
    const R0 = 5 + 46 * q * (0.6 + (y - G0) / 600);
    g.strokeStyle = rgba("#dfe8ff", 0.32 * (1 - q));
    g.beginPath();
    g.ellipse(x, y, R0, R0 * 0.26, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

/**
 * 低机位背景：同一条街用低镜头画一遍，压暗、虚化，叠光斑，再铺湿地面。
 * S：makeStreet() 的结果；u：镜头内时间（镜头慢慢前移、横移）。
 */
export function lowBackground(g, S, u) {
  const bg = scratch("low-bg");
  drawStreet(bg, S, { x: -0.7 + 0.45 * u, y: 0.62, z: 19.6 + 1.3 * u, f: 1260, cx: 960, cy: 512 });
  g.save();
  g.filter = "blur(12px) brightness(0.68) saturate(1.15)";
  g.drawImage(bg.canvas, 0, 0);
  g.restore();
  bokeh(g, u, { vp: [960, 470], seed: 4 });
  wetGround(g, bg.canvas, u);
}

/** 轮廓光：剪影错开 w 像素抠掉，剩下的一条边填色，叠两遍（清晰一遍、5 px 模糊一遍） */
export function rimLight(g, fig, dir, hex, w, alpha) {
  const rg = scratch("low-rim");
  rg.globalCompositeOperation = "copy";
  rg.drawImage(fig, 0, 0);
  rg.globalCompositeOperation = "destination-out";
  rg.drawImage(fig, -dir * w, w * 0.35);
  rg.globalCompositeOperation = "source-in";
  rg.fillStyle = hex;
  rg.fillRect(0, 0, W, H);
  rg.globalCompositeOperation = "source-over";
  g.save();
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = alpha;
  g.drawImage(rg.canvas, 0, 0);
  g.filter = "blur(5px)";
  g.globalAlpha = 0.8 * alpha;
  g.drawImage(rg.canvas, 0, 0);
  g.restore();
}

/**
 * 画一个人：湿地倒影 → 剪影 → 亮色阶段（整个剪影染成 lightHex，再加一层模糊辉光）→ 轮廓光。
 * F：rig() 的参数；st：衣服配色（figures.js）；o = { alpha, light(0–1), rim(轮廓光颜色), lightHex }
 * 出场时 light 从 1 降到 0（亮奶油色变实色）；退场时 light 升到 1、lightHex 换成线索色，同时 alpha 淡掉。
 */
export function person(g, F, st, t, { alpha = 1, light = 0, rim = "#ffd58a", lightHex = "#ffe9c6" } = {}) {
  const R = rig(F, t);
  const fg = scratch("low-fig");
  drawFigure(fg, R, st);
  if (light > 0) {
    fg.globalCompositeOperation = "source-atop";
    fg.globalAlpha = light;
    fg.fillStyle = lightHex;
    fg.fillRect(0, 0, W, H);
    fg.globalAlpha = 1;
    fg.globalCompositeOperation = "source-over";
  }
  const fig = fg.canvas;
  g.save();
  g.beginPath();
  g.rect(0, F.ground, W, H - F.ground);
  g.clip();
  g.globalAlpha = 0.26 * alpha;
  g.filter = "blur(4px)";
  g.translate(0, F.ground * 2);
  g.scale(1, -1);
  g.drawImage(fig, 0, 0);
  g.restore();
  g.save();
  g.globalAlpha = alpha;
  g.drawImage(fig, 0, 0);
  g.restore();
  if (light > 0) {
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.55 * light * alpha;
    g.filter = "blur(16px)";
    g.drawImage(fig, 0, 0);
    g.restore();
  }
  rimLight(g, fig, F.dir, rim, 7, alpha);
  return R;
}
