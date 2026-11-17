// 示例页（内容只是示意，照着这个写法写新片的每一页）：夜·街角。
// a 从左边走进来，在路灯下停住，抬头看月亮；月亮从楼后慢慢升起。冷色页（mood: "cool"）。
// 演示纸艺版一页的写法：
//   - s.backdrop：立着的背景纸（天空 / 墙），歌词每帧印在它上面
//   - s.floor：铺地的纸
//   - s.layer：一层层立在地面上的剪纸（px = 贴图像素，size = 世界单位宽高，pos = [x, y, z]，rise = 相对 tIn 的起立时间）
//   - person()：人物剪纸，只在姿势变化时重画；obj.position 让人在地面上走
//   - flatCut()：贴在背景纸前面的东西（月亮）
//   - s.animate(t, lt)：每帧更新；s.cam(lt)：这一页的镜头偏移（每页只做一种慢动作）
import { PaperScene, backPx, lyricLines, phrasesOf, person, flatCut, SCENE } from "../kit.js";
import { drawFullMoon } from "../art-sky.js";
import { drawStreetSky, drawStreetHouses, drawStreetLamp, drawStreetFloor } from "../art-street.js";
import { drawBench } from "../art.js";
import { keyed, ramp, ease } from "../util.js";

/** line = 这一页对应第几行歌词 */
export function nightStreet(world, timing, { tIn, tOut, index, line = 1 }) {
  const s = new PaperScene(world, { id: "night-street", tIn, tOut, index, mood: "cool", ink: "light" });
  s.backdrop((c, w, h) => drawStreetSky(c, w, h, 21, backPx(-2.2, 3.7)));
  s.floor((c, w, h) => drawStreetFloor(c, w, h, 18, SCENE.D));
  s.layer({ px: [3584, 870], size: [14, 3.4], pos: [0, 0, 0.3], rise: [0, 0.6], draw: (c, w, h) => drawStreetHouses(c, w, h, 63) });
  s.layer({ px: [384, 1536], size: [1.05, 4.2], pos: [-2.2, 0, 1.6], rise: [0.1, 0.72], draw: drawStreetLamp });
  s.layer({ px: [768, 432], size: [1.9, 1.07], pos: [2.4, 0, 2.2], rise: [0.2, 0.8], draw: drawBench });
  const a = person(s, "a", { pos: [-3.3, 0, 2.75], rise: [0.25, 0.85] });
  const moon = flatCut(s, (c, w, h) => drawFullMoon(c, w, h), [512, 512], [1.1, 1.1], [2.5, 1.6, 0.16], { shadow: false });

  // 歌词：第 line 行；第二个参数是每个乐句里要放大的字的下标（关键词）
  s.lyrics(lyricLines(phrasesOf(timing, line), [[], []]));

  s.animate = (t, lt) => {
    const walkK = ease.out(ramp(lt, 0.9, 3.2));
    a.obj.position.x = -3.3 + 2.7 * walkK;
    const walking = lt > 0.9 && lt < 3.1;
    const look = lt > 3.4;
    a.pose({ walk: walking ? (lt - 0.9) * 1.7 : null, mood: look ? "smile" : "neutral", tilt: look ? -0.22 : 0, gaze: look ? -0.6 : 0, blink: lt > 4.4 && lt < 4.55 ? 1 : 0 });
    moon.position.y = keyed([[0, 1.6], [6, 3.9]], lt);
    moon.visible = s.closeK < 0.9; // 这一页翻走时先藏起来
  };
  s.cam = (lt) => {
    const k = ease.sine(Math.min(1, Math.max(0, lt / 5.6)));
    return { dx: -0.2 * k, dz: -0.6 * k, ly: 0.15 * k };
  };
  return s;
}
