// 画布与绘图小工具：颜色、柔光点、四芒星、噪点纹理。
import { mulberry32 } from "./util.js";

export const W = 1920;
export const H = 1080;

export function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** "#rrggbb" → rgba() */
export function rgba(hex, a = 1) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

/** 两个颜色按 t 混合 */
export function mix(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16);
  const b = parseInt(h2.slice(1), 16);
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

/** 柔光点：中心实、边缘透明。发光物配合 "lighter" 用。 */
export function glowDot(g, x, y, r, hex, a = 1) {
  if (a <= 0 || r <= 0) return;
  const grd = g.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, rgba(hex, a));
  grd.addColorStop(0.3, rgba(hex, a * 0.5));
  grd.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grd;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function spike(g, len, th, hex, a) {
  const grd = g.createLinearGradient(-len, 0, len, 0);
  grd.addColorStop(0, rgba(hex, 0));
  grd.addColorStop(0.5, rgba(hex, a));
  grd.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(-len, 0);
  g.lineTo(0, -th);
  g.lineTo(len, 0);
  g.lineTo(0, th);
  g.closePath();
  g.fill();
}

/** 四芒星（星芒、闪光）：横竖两道细光 + 中心光点。vRatio 是竖光相对横光的长度。 */
export function star(g, x, y, len, hex, a = 1, { rot = 0, vRatio = 1, th = 0.045, core = 0.32 } = {}) {
  if (a <= 0 || len <= 0) return;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.globalCompositeOperation = "lighter";
  spike(g, len, Math.max(1, len * th), hex, a);
  spike(g, len * 0.55, Math.max(0.6, len * th * 0.5), "#ffffff", a);
  g.rotate(Math.PI / 2);
  spike(g, len * vRatio, Math.max(1, len * vRatio * th), hex, a);
  spike(g, len * vRatio * 0.55, Math.max(0.6, len * vRatio * th * 0.5), "#ffffff", a);
  glowDot(g, 0, 0, len * core, hex, a * 0.8);
  glowDot(g, 0, 0, len * core * 0.3, "#ffffff", a);
  g.restore();
}

/** 灰色噪点（颗粒用），amp 是起伏幅度 0–255 */
export function noiseCanvas(size, seed, amp = 120) {
  const c = canvas(size, size);
  const g = c.getContext("2d");
  const im = g.createImageData(size, size);
  const r = mulberry32(seed);
  for (let i = 0; i < size * size; i++) {
    const v = Math.round(128 + (r() - 0.5) * amp);
    im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
    im.data[i * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

/** 纸纹：低频斑块 + 细纤维，平铺用 */
export function paperCanvas(size, seed) {
  const c = canvas(size, size);
  const g = c.getContext("2d");
  const r = mulberry32(seed);
  g.fillStyle = "#808080";
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 420; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 6 + r() * 40;
    const v = r() < 0.5 ? 255 : 0;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(${v},${v},${v},${0.05 + r() * 0.06})`);
    grd.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const v = r() < 0.5 ? 255 : 0;
    g.strokeStyle = `rgba(${v},${v},${v},${0.04 + r() * 0.05})`;
    const x = r() * size;
    const y = r() * size;
    const a = r() * Math.PI;
    const l = 8 + r() * 30;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return c;
}
