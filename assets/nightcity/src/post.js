// 后期：轻调色 → 柔光晕（只作用在亮处）→ 暗角 → 过曝提亮 → 字幕 → 闪白 → 纸纹和颗粒 →（片尾）淡到暗。
import { W, H, canvas, noiseCanvas, paperCanvas } from "./gfx.js";
import { mulberry32 } from "./util.js";

export function createPost() {
  const buf = canvas(W, H);
  const g = buf.getContext("2d");
  const b1 = canvas(480, 270);
  const g1 = b1.getContext("2d");
  const b2 = canvas(240, 135);
  const g2 = b2.getContext("2d");

  const vig = canvas(W, H);
  {
    const v = vig.getContext("2d");
    const grd = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.6, "#ebe8f2");
    grd.addColorStop(1, "#a49cb6");
    v.fillStyle = grd;
    v.fillRect(0, 0, W, H);
  }
  const grain = noiseCanvas(256, 77, 120);
  const paper = paperCanvas(512, 13);

  /**
   * out：屏幕上的 ctx。o = { frame, white(0–1 闪白), expose(0–1 过曝提亮), lyrics(ctx => void), bloom, fade(0–1 淡到暗) }
   */
  function finish(out, o) {
    const { frame = 0, white = 0, expose = 0, lyrics = null, bloom = 0.55, fade = 0 } = o;
    out.save();
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.globalAlpha = 1;
    out.globalCompositeOperation = "source-over";
    out.filter = "contrast(1.04) saturate(1.06)";
    out.drawImage(buf, 0, 0);
    out.filter = "none";

    // 柔光晕：缩小、压暗部（近似阈值）、模糊，再用 screen 叠回来
    g1.globalCompositeOperation = "copy";
    g1.filter = "brightness(0.8) contrast(2.3) blur(4px)";
    g1.drawImage(buf, 0, 0, 480, 270);
    g1.filter = "none";
    g2.globalCompositeOperation = "copy";
    g2.filter = "blur(5px)";
    g2.drawImage(b1, 0, 0, 240, 135);
    g2.filter = "none";
    out.globalCompositeOperation = "screen";
    out.globalAlpha = bloom;
    out.drawImage(b1, 0, 0, W, H);
    out.globalAlpha = bloom * 0.7;
    out.drawImage(b2, 0, 0, W, H);

    out.globalAlpha = 1;
    out.globalCompositeOperation = "multiply";
    out.drawImage(vig, 0, 0);
    out.globalCompositeOperation = "source-over";

    if (expose > 0) {
      out.globalCompositeOperation = "screen";
      out.globalAlpha = Math.min(1, expose);
      out.fillStyle = "#fffaf2";
      out.fillRect(0, 0, W, H);
      out.globalCompositeOperation = "source-over";
      out.globalAlpha = 1;
    }

    if (lyrics) lyrics(out);

    if (white > 0) {
      out.globalAlpha = Math.min(1, white);
      out.fillStyle = "#f7f5fb";
      out.fillRect(0, 0, W, H);
      out.globalAlpha = 1;
    }

    out.globalCompositeOperation = "soft-light";
    out.globalAlpha = 0.35;
    out.fillStyle = out.createPattern(paper, "repeat");
    out.fillRect(0, 0, W, H);

    const r = mulberry32(1000 + frame * 7919);
    out.globalCompositeOperation = "overlay";
    out.globalAlpha = 0.06;
    const pg = out.createPattern(grain, "repeat");
    pg.setTransform(new DOMMatrix([1, 0, 0, 1, Math.floor(r() * 256), Math.floor(r() * 256)]));
    out.fillStyle = pg;
    out.fillRect(0, 0, W, H);

    if (fade > 0) {
      out.globalCompositeOperation = "source-over";
      out.globalAlpha = Math.min(1, fade);
      out.fillStyle = "#05060c";
      out.fillRect(0, 0, W, H);
    }
    out.restore();
  }

  return { buf, g, finish };
}
