// 后期：轻微去饱和、冷暖调色、暗角、胶片颗粒、灰尘白点和偶尔一道细划痕、淡入淡出。
// 颗粒和灰尘也是"一拍二"（每秒 12 次），跟画面一起跳。
import { W, H, canvas } from "./crayon.js";
import { mulberry32 } from "./util.js";

export function createPost() {
  const buf = canvas(W, H);
  const g = buf.getContext("2d");

  // 暗角：中心透明，四角压暗约 20–25%（multiply）
  const vig = canvas(W, H);
  {
    const v = vig.getContext("2d");
    const grd = v.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 1.02);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.55, "rgba(236,230,240,1)");
    grd.addColorStop(1, "rgba(150,138,160,1)");
    v.fillStyle = grd;
    v.fillRect(0, 0, W, H);
  }
  // 颗粒：灰色噪点（overlay）
  const grain = canvas(256, 256);
  {
    const gg = grain.getContext("2d");
    const im = gg.createImageData(256, 256);
    const r = mulberry32(77);
    for (let i = 0; i < 256 * 256; i++) {
      const v = Math.round(128 + (r() - 0.5) * 120);
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
      im.data[i * 4 + 3] = 255;
    }
    gg.putImageData(im, 0, 0);
  }

  /**
   * out: 屏幕上的 ctx；o = { frame(一拍二的帧号), warm(0 冷 – 1 暖), fade(1 = 全亮), lyrics(ctx => void) }
   */
  function finish(out, o) {
    const { frame = 0, warm = 0, fade = 1, lyrics = null } = o;
    out.save();
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.globalAlpha = 1;
    out.globalCompositeOperation = "source-over";
    out.filter = "saturate(0.92) contrast(1.03)";
    out.drawImage(buf, 0, 0);
    out.filter = "none";

    // 冷暖：soft-light 叠一层颜色
    out.globalCompositeOperation = "soft-light";
    if (warm < 1) {
      out.globalAlpha = 0.14 * (1 - warm);
      out.fillStyle = "#5a68c0";
      out.fillRect(0, 0, W, H);
    }
    if (warm > 0) {
      out.globalAlpha = 0.14 * warm;
      out.fillStyle = "#ffae62";
      out.fillRect(0, 0, W, H);
    }
    out.globalAlpha = 1;

    // 暗角
    out.globalCompositeOperation = "multiply";
    out.drawImage(vig, 0, 0);
    out.globalCompositeOperation = "source-over";

    if (lyrics) lyrics(out);

    // 颗粒（每张画换一次位置）
    const r = mulberry32(1000 + frame * 7919);
    out.globalCompositeOperation = "overlay";
    out.globalAlpha = 0.07;
    const pg = out.createPattern(grain, "repeat");
    pg.setTransform(new DOMMatrix([1, 0, 0, 1, Math.floor(r() * 256), Math.floor(r() * 256)]));
    out.fillStyle = pg;
    out.fillRect(0, 0, W, H);

    // 灰尘白点、偶尔一道细划痕
    out.globalCompositeOperation = "screen";
    const n = 4 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      out.globalAlpha = 0.18 + r() * 0.35;
      out.fillStyle = "#fffaf0";
      const s = 1.5 + r() * 2.5;
      out.fillRect(r() * W, r() * H, s, s * (0.6 + r() * 0.8));
    }
    if (r() < 0.14) {
      out.globalAlpha = 0.12 + r() * 0.12;
      out.strokeStyle = "#fffaf0";
      out.lineWidth = 1 + r();
      const x = r() * W;
      const y = r() * H * 0.7;
      const len = 80 + r() * 260;
      out.beginPath();
      out.moveTo(x, y);
      out.lineTo(x + (r() - 0.5) * 30, y + len);
      out.stroke();
    }
    out.globalAlpha = 1;
    out.globalCompositeOperation = "source-over";

    if (fade < 1) {
      out.globalAlpha = 1 - fade;
      out.fillStyle = "#07060d";
      out.fillRect(0, 0, W, H);
    }
    out.restore();
  }

  return { buf, g, finish };
}
