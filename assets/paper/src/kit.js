// 全屏纸艺场景的通用骨架（舞台方式 B）。
// 每个场景 = 一张立着的背景纸（印着天空/墙和歌词）+ 一张铺地的纸 + 一层层立起来的剪纸。
// 换场（真立体书的翻法）：这一页的剪纸倒下，地面那页向上翻起、盖到背景纸上——
// 它的背面就印着下一幕的背景；翻起来的同时，压在下面的下一幕地面露出来，剪纸跟着立起。
import * as THREE from "three";
import { makeCanvas, toTexture, cutout, paperBack } from "./paper.js";
import { drawLyrics, lyricState } from "./lyrics.js";
import { drawPerson } from "./character.js";
import { ramp, ease } from "./util.js";

export const SCENE = { W: 13.6, H: 6.4, D: 6.4 }; // 比画面略宽（镜头平移不露边）；地面和背景纸一样高，像真书的两页
export const BACK_PX = { w: 2764, h: 1300 }; // 背景纸贴图尺寸（约 203 px / 单位）
const PX = BACK_PX.w / SCENE.W;

/** 背景纸上的世界坐标 → 画布像素 */
export const backPx = (x, y) => ({ x: (x + SCENE.W / 2) * PX, y: (SCENE.H - y) * PX });

// 转场节奏（相对下一句开始的时间 T，单位秒）
export const TRANS = {
  fold: [-0.6, -0.32], // 这一页的剪纸倒下
  lift: [-0.5, 0.12], // 地面那页翻起，成为下一幕的背景
  riseShift: -0.15, // 下一幕的剪纸在翻页快立直时开始立起（太早会被翻起的页挡住）
};

const paperWhite = new THREE.MeshStandardMaterial({ color: "#ebe4d5", roughness: 0.95, side: THREE.BackSide });

export class PaperScene {
  /**
   * @param {THREE.Scene} world
   * @param {{id:string, tIn:number, tOut:number, index:number}} opts  tIn/tOut：这一页的起止（下一页从 tOut 开始）
   */
  constructor(world, { id, tIn, tOut, index = 0, mood = "cool", ink = "light" }) {
    this.id = id;
    this.mood = mood;
    this.ink = ink; // light = 浅色字（夜景）；dark = 深棕字（黄昏/晚霞等亮背景）
    this.tIn = tIn;
    this.tOut = tOut;
    this.root = new THREE.Group();
    this.root.name = id;
    world.add(this.root);
    this.page = new THREE.Group(); // 背景纸及贴在它前面的东西
    this.root.add(this.page);
    this.floorPivot = new THREE.Group(); // 地面那页，合页在背景纸底边
    this.floorPivot.position.y = -0.004 * (index % 2); // 相邻两页上下错开一点，避免重叠闪烁
    this.root.add(this.floorPivot);
    this.layers = [];
    this.lines = [];
    this.lastLyric = "";
    this.closeK = 0;
    this.outroFold = 0; // 结尾合书前，所有剪纸倒下（main 设置）
    this.layersHidden = false; // 书合着/正在翻开时，剪纸先藏起来（main 设置）
    this.decorate = null; // (ctx, t) => 在歌词之后往背景纸上画东西（裂缝等）
    this.decorKey = () => "";
    this.animate = () => {};
  }

  /** 背景纸：paint(ctx, w, h) 画一次；歌词每帧叠加在上面 */
  backdrop(paint) {
    const base = makeCanvas(BACK_PX.w, BACK_PX.h);
    paint(base.getContext("2d"), BACK_PX.w, BACK_PX.h);
    const live = makeCanvas(BACK_PX.w, BACK_PX.h);
    live.getContext("2d").drawImage(base, 0, 0);
    const tex = toTexture(live);
    const geo = new THREE.PlaneGeometry(SCENE.W, SCENE.H);
    geo.translate(0, SCENE.H / 2, 0);
    this.backMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    this.backMesh.receiveShadow = true;
    this.page.add(this.backMesh, new THREE.Mesh(geo, paperWhite));
    this.back = { base, live, tex };
    return this;
  }

  /** 地面纸：paint(ctx, w, h)，贴图的上边缘贴着背景纸；背面先是白纸，之后印上下一幕的背景 */
  floor(paint, pxW = 2048) {
    const pxH = Math.round((pxW * SCENE.D) / SCENE.W);
    const c = makeCanvas(pxW, pxH);
    paint(c.getContext("2d"), pxW, pxH);
    const geo = new THREE.PlaneGeometry(SCENE.W, SCENE.D);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, SCENE.D / 2);
    const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: toTexture(c), roughness: 0.95 }));
    front.receiveShadow = true;
    // 背面：朝下（-y）；翻起来以后朝向镜头，图像正立
    const ugeo = new THREE.PlaneGeometry(SCENE.W, SCENE.D);
    ugeo.rotateX(Math.PI / 2);
    ugeo.translate(0, -0.002, SCENE.D / 2);
    this.under = new THREE.Mesh(ugeo, new THREE.MeshStandardMaterial({ color: "#ebe4d5", roughness: 0.95 }));
    this.floorPivot.add(front, this.under);
    return this;
  }

  /** 把下一幕的背景贴到地面那页的背面 */
  setUnder(tex) {
    if (!this.under) return;
    // 翻起途中背面朝下照不到灯：用自发光补一点，立直时降到 0，和真正的背景纸无缝衔接
    this.under.material = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: "#ffffff", emissiveIntensity: 0, roughness: 0.95 });
  }

  /**
   * 立在地面上的剪纸。draw(ctx,w,h) 画一次；或传入 {canvas} 自己每帧重画。
   * rise：相对 tIn 的 [开始, 结束] 秒，剪纸从平躺立起来。
   */
  layer({ draw, canvas, px = [1024, 1024], size, pos, rise = [0, 0.6], back = true }) {
    const c = canvas || makeCanvas(px[0], px[1]);
    if (draw) draw(c.getContext("2d"), c.width, c.height);
    const tex = toTexture(c);
    const backC = back ? paperBack(c) : null;
    const obj = cutout(tex, size[0], size[1], { back: backC });
    obj.position.set(pos[0], pos[1] ?? 0, pos[2]);
    this.floorPivot.add(obj);
    const L = { obj, rise, tex, canvas: c, backC, baseY: pos[1] ?? 0, order: this.layers.length };
    this.layers.push(L);
    return L;
  }

  /** 贴在背景纸前面的东西（月亮等） */
  flat(obj) {
    this.page.add(obj);
    return obj;
  }

  /** 歌词排版：[{ phrase, x, y, size, emph }]（画布像素） */
  lyrics(lines) {
    this.lines = lines;
    return this;
  }

  /** 重新上传某个剪纸的贴图（每帧重画的人物等） */
  refresh(L) {
    L.tex.needsUpdate = true;
    if (L.backC) {
      paperBack(L.canvas, L.backC);
      L.obj.userData.backTex.needsUpdate = true;
    }
  }

  update(t, { first = false, last = false } = {}) {
    const from = first ? -Infinity : this.tIn + TRANS.lift[0];
    const to = last ? Infinity : this.tOut + TRANS.lift[1];
    const vis = t >= from && t <= to;
    this.root.visible = vis;
    if (!vis) return;
    const local = t - this.tIn;
    // 进场时背景纸还盖在上一页的地面背面上：等上一页翻完再显示自己的
    const backVis = first || t >= this.tIn + TRANS.lift[1] - 0.001;
    this.page.visible = backVis;
    if (this.backMesh) this.backMesh.visible = backVis && !this.hideBackMesh; // hideBackMesh：场景自己换成别的背景（如撕开的两半）

    // 进场：剪纸依次立起（跟着上一页翻起的动作）
    const shift = first ? 0 : TRANS.riseShift;
    for (const L of this.layers) {
      const k = ramp(local, L.rise[0] + shift, L.rise[1] + shift, (x) => ease.outBack(x, 1.5));
      L.foldIn = 1 - k;
    }
    // 退场：剪纸倒下，地面那页翻起
    const T = this.tOut;
    const fold = last ? 0 : ramp(t, T + TRANS.fold[0], T + TRANS.fold[1], ease.inOut);
    const lift = last ? 0 : ramp(t, T + TRANS.lift[0], T + TRANS.lift[1], ease.inOut);
    for (const L of this.layers) {
      const f = Math.max(L.foldIn, fold, this.outroFold);
      L.obj.rotation.x = f * (Math.PI / 2);
      // 平躺时稍微抬高一点（每层错开），不和地面纸、彼此抢同一个平面——否则会闪
      L.obj.position.y = L.baseY + (f > 0.02 ? 0.008 + 0.004 * L.order : 0);
      // 合上后夹在两页之间看不见；悬空的剪纸（窗里的人等）平躺时会浮在半空，先藏起来
      L.obj.visible = lift < 0.6 && !this.layersHidden && !(L.baseY > 0.05 && f > 0.45);
    }
    this.floorPivot.rotation.x = -lift * (Math.PI / 2) * 0.992;
    this.closeK = lift;
    if (this.under && this.under.material.emissiveMap) this.under.material.emissiveIntensity = 0.6 * Math.pow(1 - lift, 1.4);

    this.animate(t, local);

    if (this.back && (this.lines.length || this.decorate)) {
      const s = lyricState(this.lines, t) + "|" + this.decorKey(t);
      if (s !== this.lastLyric) {
        const ctx = this.back.live.getContext("2d");
        ctx.drawImage(this.back.base, 0, 0);
        drawLyrics(ctx, this.lines, t, this.ink);
        if (this.decorate) this.decorate(ctx, t);
        this.back.tex.needsUpdate = true;
        this.lastLyric = s;
      }
    }
  }
}

/** 每页的歌词排版（全屏版统一位置：左上） */
export function lyricLines(phrases, emph = [[], []], sizes = [76, 62]) {
  return phrases.map((p, i) => ({ phrase: p, x: 392, y: 330 + i * 112, size: sizes[i] ?? sizes[sizes.length - 1], emph: emph[i] || [] }));
}

export const phrasesOf = (timing, line) => timing.phrases.filter((p) => p.line === line);

const r3 = (v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v);

/** 人物剪纸：pose() 只在姿势变化时重画 */
export function person(s, who, { pos, rise = [0.2, 0.8], size = [1.7, 2.55], flip = false }) {
  const c = makeCanvas(600, 900);
  const L = s.layer({ canvas: c, size, pos, rise });
  let last = "";
  return {
    L,
    obj: L.obj,
    pose(p = {}) {
      const q = { flip, ...p };
      const key = JSON.stringify(q, (k, v) => r3(v));
      if (key === last) return;
      drawPerson(c.getContext("2d"), 600, 900, who, q);
      s.refresh(L);
      last = key;
    },
  };
}

/** 贴在背景纸前面的剪纸（月亮、云、气泡等），中心为轴 */
export function flatCut(s, draw, px, size, pos, { shadow = true } = {}) {
  const c = makeCanvas(px[0], px[1]);
  draw(c.getContext("2d"), px[0], px[1]);
  const o = cutout(toTexture(c), size[0], size[1], { hinge: "center" });
  if (!shadow) o.traverse((m) => (m.castShadow = false));
  o.position.set(pos[0], pos[1], pos[2]);
  s.flat(o);
  return o;
}

/** 放在地面上、不参与立起动画的剪纸（落下的信、纸团等），底边为轴 */
export function floorCut(s, draw, px, size, pos) {
  const c = makeCanvas(px[0], px[1]);
  draw(c.getContext("2d"), px[0], px[1]);
  const o = cutout(toTexture(c), size[0], size[1], { hinge: "bottom", back: paperBack(c) });
  o.position.set(pos[0], pos[1], pos[2]);
  s.floorPivot.add(o);
  return o;
}
