// 示例页（内容只是示意）：黄昏·河边。a、b 从两边走过来，在中间停下；b 挥手，两人中间立起一颗纸心。暖色页（mood: "warm"）。
// 演示：两个人物剪纸同时移动；b 用 flip 朝左走（长发角色转身一律镜像，不画背影）；
//       亮背景上的歌词用深棕字（ink: "dark"）；悬空的剪纸（纸心）也用 s.layer，靠 rise 时间"啪"地立起来。
import { PaperScene, lyricLines, phrasesOf, person } from "../kit.js";
import { drawSkyBase, drawHeart } from "../art-sky.js";
import { drawTileFloor } from "../art.js";
import { drawSeaRail, drawGull } from "../art-misc.js";
import { keyed, ramp, ease } from "../util.js";

export function duskRiverside(world, timing, { tIn, tOut, index, line = 2 }) {
  const s = new PaperScene(world, { id: "dusk-riverside", tIn, tOut, index, mood: "warm", ink: "dark" });
  s.backdrop((c, w, h) =>
    drawSkyBase(c, w, h, 52, { kind: "dusk", stars: 20, center: { x: w * 0.68, y: h * 0.66 }, sun: { x: w * 0.68, y: h * 0.8, r: h * 0.08 }, city: 0.2 }),
  );
  s.floor((c, w, h) => drawTileFloor(c, w, h, 5));
  s.layer({ px: [3584, 512], size: [14, 1.6], pos: [0, 0, 0.9], rise: [0, 0.6], draw: (c, w, h) => drawSeaRail(c, w, h) });
  const gull = s.layer({ px: [384, 256], size: [0.6, 0.4], pos: [3.2, 3.3, 0.6], rise: [0.3, 0.8], draw: (c, w, h) => drawGull(c, w, h) });
  const a = person(s, "a", { pos: [-3.4, 0, 2.75], rise: [0.2, 0.8] });
  const b = person(s, "b", { pos: [3.4, 0, 2.75], rise: [0.24, 0.84], flip: true });
  s.layer({ px: [384, 384], size: [0.62, 0.62], pos: [0, 1.75, 2.9], rise: [3.4, 3.9], draw: (c, w, h) => drawHeart(c, w, h) });

  s.lyrics(lyricLines(phrasesOf(timing, line), [[], []]));

  s.animate = (t, lt) => {
    const k = ease.out(ramp(lt, 0.3, 2.6));
    a.obj.position.x = -3.4 + 2.5 * k;
    b.obj.position.x = 3.4 - 2.5 * k;
    const walking = lt > 0.3 && lt < 2.5;
    a.pose({ walk: walking ? lt * 1.7 : null, mood: lt < 2.8 ? "neutral" : "shy" });
    b.pose({ walk: walking ? lt * 1.7 + 0.5 : null, mood: "smile", reach: keyed([[2.8, 0], [3.3, 0.9], [4.2, 0.9], [4.8, 0]], lt) });
    gull.obj.position.x = 3.2 - lt * 0.35; // 海鸥慢慢往左飞
  };
  s.cam = (lt) => {
    const k = ease.sine(Math.min(1, Math.max(0, lt / 6)));
    return { dz: -0.5 * k, dy: -0.05 * k };
  };
  return s;
}
