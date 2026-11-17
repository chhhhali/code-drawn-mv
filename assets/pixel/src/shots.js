// 分镜表：切点 = 某行开唱的时间或拍点。最后一个镜头的 tOut 留到 END 之后。
// main.js（成片）和 tools/ 下的工具页都从这里取镜头。
// ENV_DEFAULT 是全片默认的钟点和天气；某个镜头要换时段，在镜头对象上加 env（例如 { ...streetTwo(…), env: { hour: 6.5 } }）。
//   hour 0–24；weather "clear" 晴 | "cloudy" 阴 | "rain" 雨 | "sunrain" 太阳雨；sunX 太阳在画面里的左右位置 0–1。
import timing from "./data/timing.js";
import { streetWide, streetTwo, CUT } from "./scenes/rain-hands.js";

export const ENV_DEFAULT = { hour: 17.6, weather: "sunrain", sunX: 0.6 }; // 黄昏太阳雨；夜雨改成 { hour: 21, weather: "rain" }
export const END = timing.duration;
export const SHOTS = [streetWide({ tIn: 0, tOut: CUT }), streetTwo({ tIn: CUT, tOut: END + 1 })];
export const shotAt = (t) => SHOTS.find((s) => t >= s.tIn && t < s.tOut) || SHOTS[SHOTS.length - 1];
