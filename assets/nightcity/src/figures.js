// 低机位镜头里走路的人：只画到腰，上半身出画。人物是平涂剪影，效果靠轮廓光（见 lowangle.js 的 person()）。
// 走路用两段腿：大腿、小腿按相位摆动；落地那只脚基本踩住，髋部匀速前进。
// 衣服造型是内容：下面的 SILHOUETTE / LONG_COAT 只是中性的示例，新片按自己的人物改颜色、加细节。
import { clamp01 } from "./util.js";

const L1 = 270; // 大腿
const L2 = 262; // 小腿
const AMP = 0.32; // 大腿前后摆幅（弧度）
const ANKLE = 34; // 脚踝到鞋底

/** 深色短外套 + 长裤：最中性的剪影 */
export const SILHOUETTE = {
  leg: "#232a40",
  legFar: "#1a2034",
  shoe: "#2b3046",
  shoeFar: "#22263a",
  jacket: "#262d48",
  jacketHem: "#1d2338",
};

/** 深色长外套：下摆在膝盖附近。belt / buckle 给颜色就画腰带和扣子，给 null 就不画 */
export const LONG_COAT = {
  leg: "#20263a",
  legFar: "#181d2e",
  shoe: "#2a2c3c",
  shoeFar: "#202230",
  coat: "#262c46",
  coatTop: "#30385a",
  coatFold: "rgba(10,14,30,0.5)",
  belt: null,
  buckle: null,
};

function legPose(p) {
  const a = AMP * Math.sin(p); // 大腿相对竖直的角度，向前为正
  const b = 0.08 + 0.78 * Math.pow(Math.max(0, Math.cos(p)), 1.6); // 膝盖弯曲，迈步时最大
  return { a, b };
}

/**
 * 某个人在时刻 t 的骨架。
 * F = { strike(第 0 条腿落地的时刻), hip(那一刻髋部的 x), dir(1 向右 / -1 向左), s(缩放), ground(地面 y), period(一个步态周期秒数) }
 */
export function rig(F, t) {
  const w = (Math.PI * 2) / F.period;
  const p0 = Math.PI / 2 + w * (t - F.strike);
  const s = F.s;
  const speed = (L1 + L2) * AMP * w * (2 / Math.PI) * s;
  const hx = F.hip + F.dir * speed * (t - F.strike);
  const legs = [p0, p0 + Math.PI].map((p) => {
    const { a, b } = legPose(p);
    const kx = F.dir * Math.sin(a) * L1 * s;
    const ky = Math.cos(a) * L1 * s;
    const sa = a - b;
    return { p, a, b, kx, ky, ax: kx + F.dir * Math.sin(sa) * L2 * s, ay: ky + Math.cos(sa) * L2 * s };
  });
  const lowest = Math.max(legs[0].ay, legs[1].ay);
  const hy = F.ground - ANKLE * s - lowest;
  for (const l of legs) {
    l.hx = hx;
    l.hy = hy;
    l.kx += hx;
    l.ky += hy;
    l.ax += hx;
    l.ay += hy;
    l.lift = F.ground - ANKLE * s - l.ay;
  }
  return { hx, hy, legs, s, dir: F.dir, p0 };
}

/** 脚尖着地点（水波、光柱从这里起） */
export function footPoint(R, i = 0) {
  const l = R.legs[i];
  return { x: l.ax + R.dir * 34 * R.s, y: l.ay + ANKLE * R.s };
}

function limb(g, x1, y1, x2, y2, w1, w2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  g.beginPath();
  g.moveTo(x1 + (nx * w1) / 2, y1 + (ny * w1) / 2);
  g.lineTo(x2 + (nx * w2) / 2, y2 + (ny * w2) / 2);
  g.lineTo(x2 - (nx * w2) / 2, y2 - (ny * w2) / 2);
  g.lineTo(x1 - (nx * w1) / 2, y1 - (ny * w1) / 2);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(x1, y1, w1 / 2, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(x2, y2, w2 / 2, 0, Math.PI * 2);
  g.fill();
}

function shoe(g, ax, ay, s, dir, rot, color, sole) {
  g.save();
  g.translate(ax, ay);
  g.rotate(rot);
  g.scale(dir * s, s);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-22, -8);
  g.lineTo(16, -12);
  g.quadraticCurveTo(66, 0, 90, 18);
  g.quadraticCurveTo(98, 30, 84, 34);
  g.lineTo(-24, 34);
  g.quadraticCurveTo(-34, 30, -30, 10);
  g.closePath();
  g.fill();
  if (sole) {
    g.fillStyle = sole;
    g.fillRect(-27, 27, 117, 7);
  }
  g.restore();
}

function coat(g, R, st) {
  const { hx, hy, s, dir } = R;
  const sw = 16 * s * Math.sin(R.p0);
  const top = hy - 430 * s;
  const hem = hy + 168 * s;
  g.save();
  g.translate(hx, 0);
  g.scale(dir, 1);
  const grd = g.createLinearGradient(0, top, 0, hem);
  grd.addColorStop(0, st.coatTop);
  grd.addColorStop(1, st.coat);
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(-104 * s, top);
  g.lineTo(100 * s, top);
  g.bezierCurveTo(96 * s, hy - 230 * s, 150 * s + sw, hy + 30 * s, 160 * s + sw, hem - 8 * s);
  g.quadraticCurveTo(10 * s + sw * 0.8, hem + 18 * s, -152 * s + sw * 0.4, hem);
  g.bezierCurveTo(-140 * s, hy + 30 * s, -100 * s, hy - 230 * s, -104 * s, top);
  g.closePath();
  g.fill();
  // 背面暗部、腰带、扣子、褶线：都裁在外套轮廓里
  g.save();
  g.clip();
  const side = g.createLinearGradient(-160 * s, 0, 40 * s, 0);
  side.addColorStop(0, "rgba(8,14,30,0.45)");
  side.addColorStop(1, "rgba(8,14,30,0)");
  g.fillStyle = side;
  g.fillRect(-170 * s, top, 220 * s, hem - top + 30 * s);
  if (st.belt) {
    g.fillStyle = st.belt;
    g.fillRect(-180 * s, hy - 170 * s, 360 * s, 26 * s);
  }
  if (st.buckle) {
    g.fillStyle = st.buckle;
    g.fillRect(36 * s, hy - 168 * s, 16 * s, 22 * s);
  }
  g.strokeStyle = st.coatFold;
  g.lineWidth = 5 * s;
  g.beginPath();
  g.moveTo(-20 * s, hy - 60 * s);
  g.lineTo(46 * s, hy - 74 * s);
  g.stroke();
  g.restore();
  g.strokeStyle = st.coatFold;
  g.lineWidth = 6 * s;
  g.beginPath();
  g.moveTo(58 * s, top);
  g.quadraticCurveTo(70 * s + sw * 0.3, hy, 86 * s + sw * 0.7, hem + 4 * s);
  g.stroke();
  g.restore();
}

function jacket(g, R, st) {
  const { hx, hy, s, dir } = R;
  const top = hy - 460 * s;
  const hem = hy + 30 * s;
  g.save();
  g.translate(hx, 0);
  g.scale(dir, 1);
  const grd = g.createLinearGradient(-140 * s, 0, 140 * s, 0);
  grd.addColorStop(0, st.jacketHem);
  grd.addColorStop(0.6, st.jacket);
  grd.addColorStop(1, st.jacketLight || "#33406a");
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(-108 * s, top);
  g.lineTo(106 * s, top);
  g.quadraticCurveTo(124 * s, hy - 200 * s, 134 * s, hem - 8 * s);
  g.quadraticCurveTo(0, hem + 14 * s, -134 * s, hem);
  g.quadraticCurveTo(-122 * s, hy - 200 * s, -108 * s, top);
  g.closePath();
  g.fill();
  g.save();
  g.clip();
  g.strokeStyle = "rgba(10,14,30,0.55)";
  g.lineWidth = 18 * s;
  g.beginPath();
  g.moveTo(-140 * s, hem - 10 * s);
  g.quadraticCurveTo(0, hem + 4 * s, 140 * s, hem - 16 * s);
  g.stroke();
  g.strokeStyle = "rgba(10,14,30,0.5)";
  g.lineWidth = 5 * s;
  g.beginPath();
  g.moveTo(26 * s, hy - 130 * s);
  g.lineTo(80 * s, hy - 46 * s);
  g.moveTo(-6 * s, top);
  g.lineTo(-2 * s, hem);
  g.stroke();
  g.restore();
  g.restore();
}

/** 画一个人（腿、鞋、下摆）。st 里有 coat 就画长外套，有 jacket 就画短外套。 */
export function drawFigure(g, R, st) {
  const { s, dir } = R;
  [R.legs[1], R.legs[0]].forEach((l, i) => {
    const far = i === 0;
    g.fillStyle = far ? st.legFar : st.leg;
    limb(g, l.hx, l.hy, l.kx, l.ky, 98 * s, 66 * s);
    limb(g, l.kx, l.ky, l.ax, l.ay, 64 * s, 40 * s);
    const rot = dir * 0.32 * Math.max(0, Math.cos(l.p)) * clamp01(l.lift / (24 * s));
    shoe(g, l.ax, l.ay, s, dir, rot, far ? st.shoeFar : st.shoe, st.sole);
  });
  if (st.coat) coat(g, R, st);
  else if (st.jacket) jacket(g, R, st);
}

/** 人身上几个点，化成闪点时从这里冒 */
export function bodyPoints(R) {
  const pts = [];
  for (const l of R.legs) {
    pts.push({ x: l.hx, y: l.hy }, { x: l.kx, y: l.ky }, { x: l.ax, y: l.ay });
    pts.push({ x: (l.hx + l.kx) / 2, y: (l.hy + l.ky) / 2 }, { x: (l.kx + l.ax) / 2, y: (l.ky + l.ay) / 2 });
  }
  pts.push({ x: R.hx, y: R.hy - 200 * R.s }, { x: R.hx + 60 * R.dir * R.s, y: R.hy + 100 * R.s });
  return pts;
}
