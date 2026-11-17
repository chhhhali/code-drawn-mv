// 纸张与剪纸：画布贴图、纸纹、立在书页上的剪纸片。
import * as THREE from "three";
import { mulberry32 } from "./util.js";

export const PAPER_WHITE = "#fbf7ee";

export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

/** Paper tooth: per-pixel noise plus faint fibres, only where the canvas is painted. */
export function paperGrain(ctx, w, h, seed, amount = 10, fibres = 0) {
  const rand = mulberry32(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const n = (rand() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  if (!fibres) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  for (let i = 0; i < fibres; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.03 + rand() * 0.05})`;
    ctx.lineWidth = 0.6 + rand() * 0.8;
    const x = rand() * w;
    const y = rand() * h;
    const a = rand() * Math.PI;
    const l = 6 + rand() * 18;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.4) * l * 0.5, y + Math.sin(a + 0.4) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.restore();
}

/** 剪纸背面：同一轮廓的素白纸（写进 dst 或新画布）。 */
export function paperBack(src, dst = null) {
  const c = dst || makeCanvas(src.width, src.height);
  const x = c.getContext("2d");
  x.clearRect(0, 0, c.width, c.height);
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = "#ebe4d5";
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = "source-over";
  return c;
}

/**
 * A die-cut paper piece standing on its bottom edge (the fold line).
 * Front shows the print; the back (if `back` canvas given) is plain paper, like real card.
 * Alpha-tested so its shadow follows the cut outline. Returns a Group.
 */
export function cutout(texture, width, height, { hinge = "bottom", back = null } = {}) {
  const geo = new THREE.PlaneGeometry(width, height);
  if (hinge === "bottom") geo.translate(0, height / 2, 0);
  if (hinge === "top") geo.translate(0, -height / 2, 0);
  const front = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: texture,
      alphaTest: 0.5,
      side: back ? THREE.FrontSide : THREE.DoubleSide,
      roughness: 0.92,
      metalness: 0,
    }),
  );
  front.castShadow = true;
  front.receiveShadow = true;
  front.customDepthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: texture,
    alphaTest: 0.5,
  });
  const group = new THREE.Group();
  group.add(front);
  if (back) {
    const backTex = toTexture(back);
    const rear = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: backTex, alphaTest: 0.5, side: THREE.BackSide, roughness: 0.95 }));
    rear.receiveShadow = true;
    group.add(rear);
    group.userData.backTex = backTex;
  }
  return group;
}

/** Draws `path` as white die-cut margin (pass 1) — call before painting the colours. */
export function dieCut(ctx, path, border, lineWidthExtra = 0, color = PAPER_WHITE) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = border * 2 + lineWidthExtra;
  ctx.fill(path);
  ctx.stroke(path);
  ctx.restore();
}

/** White margin for a stroked line (antenna rods, railings...). */
export function dieCutLine(ctx, path, width, border, color = PAPER_WHITE) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = width + border * 2;
  ctx.stroke(path);
  ctx.restore();
}
