// 后期：三层低分辨率画面 → 1920×1080。
//   1. 背景层 bg：×4 最近邻放大（像素锐利）；近景镜头可以虚化（dof，单位是 1080p 像素）
//   2. 主体层 fg（人物、伞、近处的雨）：永远锐利，盖在背景上
//   3. 发光层 emis（窗、灯、车灯、霓虹、轮廓光）：缩小 → 模糊 → 放大，三级叠加，就是窗户四周那圈朦胧的光
//   4. 光柱（白天、黄昏）：从太阳往外放射的丁达尔光，被楼挡住的地方就断开
//   5. 雾气：整张画面缩小模糊后轻轻 screen 一层，空气感
//   6. 暗角、胶片颗粒
// 像素本身永远是锐利的方块，"朦胧"全部来自叠在上面的发光层、光柱和雾气。
// 白天画面里没有几盏灯，所以另有 brightPass()：把够亮的像素（太阳周围的天、亮边、白衣服、反光）也加进发光层，
// 任何时间都能看到像素向外散的那圈淡光。
import { LW, LH, SCALE, canvas, hex } from "./px.js";
import { mulberry32 } from "./util.js";

const W = LW * SCALE;
const H = LH * SCALE;

/** 亮部提取：bg 和 fg 合起来看，亮度超过 th 的像素按超出的多少加进发光层（k 是强度）。每帧调一次。 */
export function brightPass(bg, fg, emis, th = 0.8, k = 0.75) {
  const B = bg.d;
  const F = fg.d;
  const E = emis.d;
  for (let i = 0; i < B.length; i += 4) {
    const a = F[i + 3] / 255;
    const r = F[i] * a + B[i] * (1 - a);
    const g = F[i + 1] * a + B[i + 1] * (1 - a);
    const b = F[i + 2] * a + B[i + 2] * (1 - a);
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (l <= th) continue;
    const w = Math.pow((l - th) / (1 - th), 1.5) * k;
    E[i] += r * w;
    E[i + 1] += g * w;
    E[i + 2] += b * w;
    E[i + 3] = 255;
  }
}

export function createPost() {
  const bgC = canvas(LW, LH);
  const fgC = canvas(LW, LH);
  const emC = canvas(LW, LH);
  const b1 = canvas(240, 135);
  const b2 = canvas(120, 68);
  const b3 = canvas(60, 34);
  const hz = canvas(160, 90);
  const RW = 120;
  const RH = 68;
  const rc = canvas(RW, RH);
  const rimg = rc.getContext("2d").createImageData(RW, RH);
  /** 光柱：每个点朝太阳方向往回采样，累加看得见的太阳光（src 是 480×270 的亮度 0–1），越远越弱 */
  const rays = (out, { src, x, y, c, k }) => {
    const sx = x / 4;
    const sy = y / 4;
    const N = 28;
    const d = rimg.data;
    for (let j = 0; j < RH; j++)
      for (let i = 0; i < RW; i++) {
        let px = i + 0.5;
        let py = j + 0.5;
        const dx = ((px - sx) * 0.92) / N;
        const dy = ((py - sy) * 0.92) / N;
        let acc = 0;
        let w = 1;
        for (let n = 0; n < N; n++) {
          px -= dx;
          py -= dy;
          const X = Math.floor(px * 4);
          const Y = Math.floor(py * 4);
          if (X >= 0 && Y >= 0 && X < LW && Y < LH) acc += src[Y * LW + X] * w;
          w *= 0.955;
        }
        const v = Math.min(1, (acc / N) * k * 2.2);
        const q = (j * RW + i) * 4;
        d[q] = c[0] * v;
        d[q + 1] = c[1] * v;
        d[q + 2] = c[2] * v;
        d[q + 3] = 255;
      }
    rc.getContext("2d").putImageData(rimg, 0, 0);
    out.globalCompositeOperation = "lighter";
    out.imageSmoothingEnabled = true;
    out.globalAlpha = 1;
    out.drawImage(rc, 0, 0, W, H);
  };
  const vig = canvas(W, H);
  {
    const g = vig.getContext("2d");
    const r = g.createRadialGradient(W / 2, H * 0.48, H * 0.25, W / 2, H * 0.5, H * 0.95);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(1, "rgba(120,100,150,1)");
    g.fillStyle = r;
    g.fillRect(0, 0, W, H);
  }
  const grain = canvas(256, 256);
  {
    const g = grain.getContext("2d");
    const im = g.createImageData(256, 256);
    const rnd = mulberry32(99);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = 128 + (rnd() - 0.5) * 120;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }
  const blurInto = (dst, src, px) => {
    const g = dst.getContext("2d");
    g.clearRect(0, 0, dst.width, dst.height);
    g.imageSmoothingEnabled = true;
    g.filter = `blur(${px}px)`;
    g.drawImage(src, 0, 0, dst.width, dst.height);
    g.filter = "none";
  };

  return {
    /**
     * o = { dof: 背景虚化（0 = 不虚，2–4 适合近景），bloom: 泛光强度（默认 1），haze: 雾气（默认 0.14），hazeMul: 雾气倍数，
     *       rays: 光柱 { src, x, y, c, k }，glare: 太阳眩光 { x, y, c, k, r }（低分辨率坐标），vig: 暗角强度（默认 1），
     *       tint: 整体调色 "#rrggbb"（可选），tintA: 调色强度，frame: 帧号（颗粒用），fade: 0–1 黑场 }
     * 时间和天气给的那几项（rays、hazeMul、vig、tint）由 main.js 从 ENV.post 合进来，镜头自己给的优先。
     */
    finish(out, bg, fg, emis, o = {}) {
      const bloom = o.bloom ?? 1;
      bg.toCanvas(bgC.getContext("2d"));
      fg.toCanvas(fgC.getContext("2d"));
      emis.toCanvas(emC.getContext("2d"));
      out.save();
      out.setTransform(1, 0, 0, 1, 0, 0);
      out.globalCompositeOperation = "source-over";
      out.globalAlpha = 1;
      out.fillStyle = "#07050d";
      out.fillRect(0, 0, W, H);
      if (o.dof > 0) {
        out.imageSmoothingEnabled = true;
        out.filter = `blur(${o.dof}px)`;
        out.drawImage(bgC, -12, -12, W + 24, H + 24);
        out.filter = "none";
      } else {
        out.imageSmoothingEnabled = false;
        out.drawImage(bgC, 0, 0, W, H);
      }
      out.imageSmoothingEnabled = false;
      out.drawImage(fgC, 0, 0, W, H);

      // 泛光：紧贴的一圈 + 三级越来越大的光晕
      if (bloom > 0) {
        blurInto(b1, emC, 1);
        blurInto(b2, emC, 1.5);
        blurInto(b3, emC, 1.5);
        out.globalCompositeOperation = "lighter";
        out.imageSmoothingEnabled = true;
        out.globalAlpha = 0.35 * bloom;
        out.drawImage(emC, 0, 0, W, H);
        out.globalAlpha = 0.75 * bloom;
        out.drawImage(b1, 0, 0, W, H);
        out.globalAlpha = 0.7 * bloom;
        out.drawImage(b2, 0, 0, W, H);
        out.globalAlpha = 0.55 * bloom;
        out.drawImage(b3, 0, 0, W, H);
      }
      if (o.rays && o.rays.src && o.rays.k > 0.01) rays(out, o.rays);
      // 逆光的眩光：太阳附近一大片柔和的暖光（太阳被挡住也有）
      if (o.glare && o.glare.k > 0.01) {
        const { x, y, c, k, r } = o.glare;
        const gr = out.createRadialGradient(x * SCALE, y * SCALE, 0, x * SCALE, y * SCALE, r * SCALE);
        gr.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${k})`);
        gr.addColorStop(0.35, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${k * 0.35})`);
        gr.addColorStop(1, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0)`);
        out.globalCompositeOperation = "screen";
        out.globalAlpha = 1;
        out.fillStyle = gr;
        out.fillRect(0, 0, W, H);
      }
      // 雾气：整张画面的软光
      const haze = (o.haze ?? 0.14) * (o.hazeMul ?? 1);
      if (haze > 0) {
        const g = hz.getContext("2d");
        g.clearRect(0, 0, hz.width, hz.height);
        g.imageSmoothingEnabled = true;
        g.filter = "blur(2px)";
        g.drawImage(bgC, 0, 0, hz.width, hz.height);
        g.drawImage(fgC, 0, 0, hz.width, hz.height);
        g.filter = "none";
        out.globalCompositeOperation = "screen";
        out.globalAlpha = haze;
        out.drawImage(hz, 0, 0, W, H);
      }
      if (o.tint) {
        out.globalCompositeOperation = "soft-light";
        out.globalAlpha = o.tintA ?? 0.25;
        out.fillStyle = o.tint;
        out.fillRect(0, 0, W, H);
      }
      out.globalCompositeOperation = "multiply";
      out.globalAlpha = o.vig ?? 1;
      out.drawImage(vig, 0, 0);
      // 颗粒：每帧换一个偏移（由帧号决定）
      out.globalCompositeOperation = "overlay";
      out.globalAlpha = 0.07;
      const f = o.frame || 0;
      const ox = -((f * 73) % 256);
      const oy = -((f * 151) % 256);
      for (let y = oy; y < H; y += 256) for (let x = ox; x < W; x += 256) out.drawImage(grain, x, y);
      if (o.fade !== undefined && o.fade < 1) {
        out.globalCompositeOperation = "source-over";
        out.globalAlpha = 1 - o.fade;
        out.fillStyle = "#000";
        out.fillRect(0, 0, W, H);
      }
      out.restore();
    },
  };
}

export { hex };
