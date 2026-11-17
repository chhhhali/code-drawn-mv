// 色板分两套：PAL_NIGHT（夜里：深紫、靛蓝打底，暖橙的路灯和窗，少量冷色点缀）和 PAL_DAY（白天：同一批东西在日光下的颜色）。
// 零件只读 PAL：env.js 的 applyEnv() 每帧按钟点把两套混好写进 PAL（黄昏偏暖、阴天偏灰、下雨地面变深），天空单独算。
// 发光的东西（灯、车灯、信号灯、霓虹、窗光）白天黑夜同一个颜色，只是亮不亮由 ENV 决定。
// 换片子时先改这里；人物的材质（每种四档：最暗、暗面、本色、亮面）在 MATS，不随时间变，明暗交给打光。
import { hex } from "./px.js";

const H = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.map(hex) : hex(v)]));

export const PAL_NIGHT = H({
  sky: ["#0a0716", "#100b22", "#18112f", "#22173d", "#2e1d4b", "#3d2457", "#4f2b60"], // 顶 → 地平线
  cloud: "#2a1d47",
  cloudHi: "#3b2a5c",
  bldFar: ["#130e26", "#17112d", "#1c1534"],
  bldMid: ["#1a1430", "#221a3a", "#2a2045"],
  bldEdge: "#33285a",
  winWarm: ["#f6c763", "#ffd98a", "#e89a45", "#f2b25a"],
  winCool: ["#a8d8ff", "#c9a8ff"],
  winHalo: "#5a3f4a",
  asphalt: "#120f1b",
  asphalt2: "#191522",
  lane: "#6b5a3a",
  curb: "#35304a",
  curbTop: "#4a4364",
  walk: "#231e31",
  walk2: "#2b2539",
  walk3: "#342d45",
  seam: "#1a1626",
  puddle: "#2a2042",
  puddleRim: "#5a4f80",
  pole: "#262236",
  poleHi: "#4d4566",
  lamp: "#ffb45a",
  lampCore: "#fff0c8",
  head: "#fff2d0",
  tail: "#ff3b4a",
  red: "#ff4650",
  green: "#3ff0a0",
  store: "#a9d6e2",
  storeDim: "#4f7385",
  neon: "#ff5fa8",
  rain: "#8f88bd",
  rainHi: "#e6e2ff",
  outline: "#120c1c",
  glass: "#c8d6ff",
  glassRim: "#e4ebff",
});

/** 白天的颜色（只列会变的；没列的白天黑夜一样）。数组的档数要和 PAL_NIGHT 一致。 */
export const PAL_DAY = H({
  cloud: "#eef2fa",
  cloudHi: "#ffffff",
  bldFar: ["#8ea3c0", "#98adc8", "#a3b6cf"],
  bldMid: ["#4c586c", "#c4b2a0", "#a9978a"], // 0 窗洞、1 墙面、2 楼层线和便利店门头
  bldEdge: "#ecdcc8",
  asphalt: "#5b5f70",
  asphalt2: "#646879",
  lane: "#e2d7a4",
  curb: "#8f919e",
  curbTop: "#c3c5cf",
  walk: "#a29fab",
  walk2: "#aba8b4",
  walk3: "#b6b3bf",
  seam: "#8b8894",
  puddle: "#8eb2d6",
  puddleRim: "#cfdff0",
  pole: "#4a4e5e",
  poleHi: "#9aa0b6",
  rain: "#c3cde2",
  rainHi: "#ffffff",
  outline: "#1d1a2c",
  glass: "#e2ecff",
  glassRim: "#f6f9ff",
});

/** 零件读的那一份：applyEnv() 每帧改写；没调 applyEnv 时就是夜里的颜色 */
export const PAL = Object.fromEntries(Object.entries(PAL_NIGHT).map(([k, v]) => [k, v]));

// 人物材质：编号 → 四档颜色（ramp）或者不受光的单色（flat）
export const MAT = {
  skin: 1, hairB: 2, hoodie: 3, jeans: 4, sneaker: 5, hairG: 6, coat: 7, tights: 8, boots: 9,
  eye: 10, eyeHi: 11, mouth: 12, blush: 13, brow: 14, handle: 15, string: 16, scarf: 17,
};
export const MATS = [
  null,
  { ramp: ["#4a2c3c", "#a86e6a", "#e3ae94", "#f6d3bd"].map(hex) }, // 皮肤
  { ramp: ["#0b0912", "#171221", "#251e33", "#3a3150"].map(hex) }, // 男孩头发
  { ramp: ["#0c2229", "#173d47", "#245a64", "#3f7f84"].map(hex) }, // 卫衣（灰青）
  { ramp: ["#11172a", "#202a46", "#314066", "#475b88"].map(hex) }, // 牛仔裤
  { ramp: ["#34343f", "#8a8a9e", "#d4d4e2", "#ffffff"].map(hex) }, // 白球鞋
  { ramp: ["#1c0f16", "#3a1f26", "#5a3335", "#7f4d48"].map(hex) }, // 女孩头发（栗色）
  { ramp: ["#3a280e", "#6e4a1c", "#a3742c", "#d29f4c"].map(hex) }, // 雨衣（芥末黄）
  { ramp: ["#0d0a18", "#1a152c", "#2a2242", "#3e3460"].map(hex) }, // 深色袜裤
  { ramp: ["#280b11", "#561620", "#8a2832", "#bd444a"].map(hex) }, // 红雨靴
  { flat: hex("#1a1020") }, // 眼睛
  { flat: hex("#fff6ff") }, // 眼睛高光
  { flat: hex("#7a2f3e") }, // 嘴
  { flat: hex("#e57a8c") }, // 腮红
  { flat: hex("#1d1424") }, // 眉毛
  { ramp: ["#141018", "#2a2430", "#4a4252", "#7a7088"].map(hex) }, // 伞柄
  { flat: hex("#cfe3e2") }, // 卫衣抽绳
  { ramp: ["#3a0c16", "#6e1a28", "#a8303c", "#d85a5a"].map(hex) }, // 围巾
];
