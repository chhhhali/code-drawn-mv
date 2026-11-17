// 雨夜街道：极简 3D 投影。世界坐标 x 向右、y 向上、z 向远处；路面 y=0，路宽 x∈[-6, 6]。
// 楼是“纸片盒子”：朝路的侧面偏暗，朝镜头的正面偏亮；窗灯按种子随机亮。
// 招牌字是内容：模板里是占位字，新片用 makeStreet(seed, words) 换成自己的字（港乐用繁体）。
import { mulberry32 } from "./util.js";
import { W, H, canvas, rgba, mix } from "./gfx.js";

export const STREET = {
  skyTop: "#14142c",
  skyMid: "#262440",
  skyLow: "#4a3b50",
  front: ["#4f4955", "#586280", "#4a4b66", "#5b5670"],
  side: ["#37364b", "#2c2d45", "#33344d", "#2a2b40"],
  winOff: "#272941",
  winOn: [
    ["#efe2b2", 0.36],
    ["#e2f7f8", 0.24],
    ["#f3cf73", 0.18],
    ["#bfe3f2", 0.12],
    ["#e88aa5", 0.1],
  ],
  road: "#121624",
  walk: "#1b1e2d",
};

// 占位招牌：[字, 霓虹色]。真正的招牌字由新片的内容决定
export const SIGN_WORDS = [
  ["店名", "#ff6f9a"],
  ["招牌", "#57e3ff"],
  ["店名", "#ffc35a"],
  ["招牌", "#ff7fb0"],
  ["店名", "#5fe0ff"],
  ["招牌", "#ffcf6a"],
  ["店名", "#ff6f9a"],
  ["招牌", "#6fe9ff"],
];

function pick(r, list) {
  let x = r();
  for (const [c, p] of list) if ((x -= p) <= 0) return c;
  return list[0][0];
}

/** 生成一条街（只做一次）。words：招牌 [[字, 霓虹色], …]，按顺序轮流挂在近处的楼上。 */
export function makeStreet(seed = 11, words = SIGN_WORDS) {
  const r = mulberry32(seed);
  const buildings = [];
  let signIdx = 0;
  for (const side of [-1, 1]) {
    let z = 2 + r() * 3;
    while (z < 128) {
      const len = 7 + r() * 9;
      const x = 8.3 + r() * 1.8;
      const h = 15 + r() * 24 + (z > 60 ? 8 : 0);
      const depth = 8 + r() * 6;
      const b = {
        side,
        z0: z,
        z1: z + len,
        x,
        depth,
        h,
        front: STREET.front[Math.floor(r() * STREET.front.length)],
        sideC: STREET.side[Math.floor(r() * STREET.side.length)],
        wins: [],
        shops: [],
        signs: [],
      };
      for (let wz = z + 0.9; wz + 1.6 < z + len - 0.5; wz += 2.9)
        for (let wy = 4.8; wy + 2.2 < h - 0.8; wy += 3.5) {
          const on = r() < 0.6;
          b.wins.push({ f: 0, a: wz, b: wz + 1.6, y0: wy, y1: wy + 2.2, c: on ? pick(r, STREET.winOn) : STREET.winOff, bar: r() < 0.55 });
        }
      for (let wx = x + 1.0; wx + 1.8 < x + depth - 0.5; wx += 3.1)
        for (let wy = 4.8; wy + 2.2 < h - 0.8; wy += 3.5) {
          const on = r() < 0.6;
          b.wins.push({ f: 1, a: wx, b: wx + 1.8, y0: wy, y1: wy + 2.2, c: on ? pick(r, STREET.winOn) : STREET.winOff, bar: r() < 0.55 });
        }
      if (r() < 0.8) b.shops.push({ f: 0, a: z + 0.7, b: z + len - 0.7, y0: 0.4, y1: 3.5, c: r() < 0.55 ? "#efe2b2" : "#e2f7f8" });
      if (r() < 0.6) b.shops.push({ f: 1, a: x + 0.7, b: x + depth - 0.8, y0: 0.4, y1: 3.5, c: r() < 0.5 ? "#efe2b2" : "#e2f7f8" });
      if (z < 75 && r() < 0.75) {
        const [word, col] = words[signIdx++ % words.length];
        const y0 = 5.2 + r() * 7;
        b.signs.push({ z: z + 0.3 + r() * 0.6, y0, y1: y0 + 1.15 * word.length + 0.7, x0: x - 1.5, x1: x - 0.12, word, col });
      }
      buildings.push(b);
      z += len + 0.5 + r() * 2.2;
    }
  }
  // 远处天际线：预先画好，按深度缩放
  const sky = canvas(1400, 420);
  {
    const g = sky.getContext("2d");
    const rr = mulberry32(seed + 5);
    let x = 0;
    while (x < 1400) {
      const w = 26 + rr() * 60;
      const h = 60 + rr() * 300;
      g.fillStyle = rr() < 0.5 ? "#2c2a46" : "#26263d";
      g.fillRect(x, 420 - h, w, h);
      for (let i = 0; i < h / 14; i++) {
        if (rr() < 0.45) continue;
        const k = rr();
        g.fillStyle = k < 0.6 ? "#e9d9a6" : k < 0.85 ? "#cfe9f2" : "#e88aa5";
        g.globalAlpha = 0.45 + rr() * 0.55;
        g.fillRect(x + 4 + rr() * Math.max(1, w - 10), 420 - h + 8 + i * 14, 3, 3);
      }
      g.globalAlpha = 1;
      x += w + rr() * 6;
    }
  }
  return { buildings, sky };
}

function fillQuad(g, a, b, c, d, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.lineTo(c[0], c[1]);
  g.lineTo(d[0], d[1]);
  g.closePath();
  g.fill();
}

function line(g, a, b, color, w) {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.stroke();
}

function drawSign(g, x, y, w, h, sg) {
  if (w < 3 || h < 6) return;
  const lw = Math.max(1.2, w * 0.07);
  g.save();
  g.fillStyle = "#1a1530";
  g.fillRect(x, y, w, h);
  g.globalCompositeOperation = "lighter";
  g.strokeStyle = rgba(sg.col, 0.3);
  g.lineWidth = lw * 3.4;
  g.strokeRect(x + lw, y + lw, w - lw * 2, h - lw * 2);
  g.strokeStyle = rgba(sg.col, 0.95);
  g.lineWidth = lw;
  g.strokeRect(x + lw, y + lw, w - lw * 2, h - lw * 2);
  const chars = [...sg.word];
  const step = (h - lw * 4) / chars.length;
  const fs = Math.min(w * 0.6, step * 0.82);
  if (fs >= 4) {
    g.font = `700 ${fs.toFixed(1)}px "MVSong", serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    chars.forEach((ch, i) => {
      const cy = y + lw * 2 + step * (i + 0.5);
      g.globalCompositeOperation = "lighter";
      g.fillStyle = rgba(sg.col, 0.5);
      g.fillText(ch, x + w / 2, cy);
      g.globalCompositeOperation = "source-over";
      g.fillStyle = mix(sg.col, "#ffffff", 0.7);
      g.fillText(ch, x + w / 2, cy);
    });
  }
  g.restore();
}

/**
 * 画一帧街道。cam = { x, y, z, f, cx, cy }：镜头位置、焦距（像素）、地平线在屏幕上的位置。
 */
export function drawStreet(g, S, cam) {
  const { cx, cy, f } = cam;
  const near = cam.z + 0.35;
  const P = (X, Y, Z) => {
    const d = Math.max(0.05, Z - cam.z);
    return [cx + (f * (X - cam.x)) / d, cy - (f * (Y - cam.y)) / d];
  };

  // 天空 + 地平线微暖
  const sky = g.createLinearGradient(0, 0, 0, cy + 80);
  sky.addColorStop(0, STREET.skyTop);
  sky.addColorStop(0.62, STREET.skyMid);
  sky.addColorStop(1, STREET.skyLow);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const hg = g.createRadialGradient(cx, cy, 10, cx, cy, 560);
  hg.addColorStop(0, "rgba(150,100,118,0.5)");
  hg.addColorStop(1, "rgba(150,100,118,0)");
  g.fillStyle = hg;
  g.fillRect(0, 0, W, H);

  // 远处天际线
  const zf = 150;
  const [lx, by] = P(-90, 0, zf);
  const [rx, ty] = P(90, 54, zf);
  g.drawImage(S.sky, lx, ty, rx - lx, by - ty);

  // 地面：人行道铺底，再画路面和标线
  const zFar = 165;
  fillQuad(g, P(-60, 0, near), P(60, 0, near), P(60, 0, zFar), P(-60, 0, zFar), STREET.walk);
  fillQuad(g, P(-6, 0, near), P(6, 0, near), P(6, 0, zFar), P(-6, 0, zFar), STREET.road);
  for (let k = Math.floor(near / 6); k * 6 < zFar; k++) {
    const z0 = Math.max(near, k * 6);
    const z1 = k * 6 + 3;
    if (z1 <= near) continue;
    fillQuad(g, P(-0.12, 0, z0), P(0.12, 0, z0), P(0.12, 0, z1), P(-0.12, 0, z1), "rgba(165,168,180,0.7)");
  }
  for (const sx of [-5.7, 5.7])
    fillQuad(g, P(sx - 0.07, 0, near), P(sx + 0.07, 0, near), P(sx + 0.07, 0, zFar), P(sx - 0.07, 0, zFar), "rgba(150,152,166,0.45)");
  const zz0 = 27;
  const zz1 = 30.2;
  if (zz1 > near)
    for (let i = 0; i < 8; i++) {
      const x0 = -5.3 + i * 1.38;
      const x1 = x0 + 0.86;
      const za = Math.max(near, zz0);
      fillQuad(g, P(x0, 0, za), P(x1, 0, za), P(x1, 0, zz1), P(x0, 0, zz1), "rgba(196,195,202,0.9)");
    }

  // 楼：由远到近
  const list = S.buildings.filter((b) => b.z1 > near).sort((a, b) => b.z0 - a.z0);
  for (const b of list) drawBuilding(g, b, P, near);
}

function drawBuilding(g, b, P, near) {
  const s = b.side;
  const X = s * b.x;
  const XO = s * (b.x + b.depth);
  const z0 = Math.max(near, b.z0);
  const frontVis = b.z0 >= near;

  // 店面在湿地上的倒影（先画，楼面会盖住该盖的部分）
  g.save();
  g.globalCompositeOperation = "lighter";
  for (const sh of b.shops) {
    if (sh.f !== 0 || sh.a < near) continue;
    const p1 = P(X, sh.y0, sh.a);
    const p2 = P(X, sh.y0, sh.b);
    const p4 = P(X, sh.y1, sh.a);
    const hh = Math.max(4, (p1[1] - p4[1]) * 0.9);
    const grd = g.createLinearGradient(0, p1[1], 0, p1[1] + hh);
    grd.addColorStop(0, rgba(sh.c, 0.22));
    grd.addColorStop(1, rgba(sh.c, 0));
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(p1[0], p1[1]);
    g.lineTo(p2[0], p2[1]);
    g.lineTo(p2[0] - s * (p1[1] - p2[1]) * 0.1, p2[1] + hh * 0.5);
    g.lineTo(p1[0] - s * hh * 0.25, p1[1] + hh);
    g.closePath();
    g.fill();
  }
  g.restore();

  // 侧面（朝路）
  fillQuad(g, P(X, 0, z0), P(X, 0, b.z1), P(X, b.h, b.z1), P(X, b.h, z0), b.sideC);
  // 正面（朝镜头）
  if (frontVis) {
    fillQuad(g, P(X, 0, b.z0), P(XO, 0, b.z0), P(XO, b.h, b.z0), P(X, b.h, b.z0), b.front);
    line(g, P(X, b.h, b.z0), P(XO, b.h, b.z0), "rgba(160,160,196,0.35)", 2);
    line(g, P(X, 0, b.z0), P(X, b.h, b.z0), "rgba(150,150,190,0.22)", 1.5);
  }
  // 窗
  for (const w of b.wins) {
    let p1, p2, p3, p4, m1, m2;
    if (w.f === 0) {
      if (w.a < near) continue;
      p1 = P(X, w.y0, w.a);
      p2 = P(X, w.y0, w.b);
      p3 = P(X, w.y1, w.b);
      p4 = P(X, w.y1, w.a);
      if (w.bar) {
        m1 = P(X, w.y0, (w.a + w.b) / 2);
        m2 = P(X, w.y1, (w.a + w.b) / 2);
      }
    } else {
      if (!frontVis) continue;
      p1 = P(s * w.a, w.y0, b.z0);
      p2 = P(s * w.b, w.y0, b.z0);
      p3 = P(s * w.b, w.y1, b.z0);
      p4 = P(s * w.a, w.y1, b.z0);
      if (w.bar) {
        m1 = P((s * (w.a + w.b)) / 2, w.y0, b.z0);
        m2 = P((s * (w.a + w.b)) / 2, w.y1, b.z0);
      }
    }
    const hpx = Math.abs(p1[1] - p4[1]);
    if (hpx < 0.8) continue;
    fillQuad(g, p1, p2, p3, p4, w.c);
    if (m1 && hpx > 14) line(g, m1, m2, "rgba(28,28,48,0.5)", Math.max(1, hpx * 0.05));
  }
  // 店面（一楼）：亮窗 + 竖向窗格 + 上方一条深色招牌带
  for (const sh of b.shops) {
    const a = sh.f === 0 ? Math.max(near + 0.05, sh.a) : sh.a;
    if (sh.f === 0 && sh.b <= near + 0.1) continue;
    if (sh.f === 1 && !frontVis) continue;
    const at = sh.f === 0 ? (y, u) => P(X, y, u) : (y, u) => P(s * u, y, b.z0);
    const p1 = at(sh.y0, a);
    const p2 = at(sh.y0, sh.b);
    const p3 = at(sh.y1, sh.b);
    const p4 = at(sh.y1, a);
    fillQuad(g, p1, p2, p3, p4, sh.c);
    fillQuad(g, at(sh.y1, a), at(sh.y1, sh.b), at(sh.y1 + 0.7, sh.b), at(sh.y1 + 0.7, a), "#2a2a42");
    const hpx = Math.abs(p1[1] - p4[1]);
    const lw = Math.max(1.2, hpx * 0.05);
    for (let u = sh.a + 2.3; u < sh.b - 0.4; u += 2.3) {
      if (u < a) continue;
      line(g, at(sh.y0, u), at(sh.y1, u), "rgba(42,42,66,0.75)", lw);
    }
    line(g, at(sh.y0 + (sh.y1 - sh.y0) * 0.72, a), at(sh.y0 + (sh.y1 - sh.y0) * 0.72, sh.b), "rgba(42,42,66,0.45)", lw * 0.7);
  }
  // 招牌（挂在楼头，朝镜头）
  for (const sg of b.signs) {
    if (sg.z < near + 0.4) continue;
    const xa = s * sg.x0;
    const xb = s * sg.x1;
    const tl = P(Math.min(xa, xb), sg.y1, sg.z);
    const br = P(Math.max(xa, xb), sg.y0, sg.z);
    drawSign(g, tl[0], tl[1], br[0] - tl[0], br[1] - tl[1], sg);
  }
}
