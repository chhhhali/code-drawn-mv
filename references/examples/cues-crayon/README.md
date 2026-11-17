# 踩字示例（蜡笔）：远处的烟囱 → 卡片

一段约 6 秒的示例，演示三件事：动作顶点落在字上（`cues.js`）、人物挂点（`onHead` / `onBody` / `out`）、游戏界面贴纸（`gameui.js`）。
它对的是一首具体的歌（31.2–37.3 秒，两句加一段和声回声），时间写死在 `PH` 和 `fix` 里，只有每句的起止和字数，没有歌词文本。

在蜡笔项目里跑起来：

```bash
python3 ~/.claude/skills/code-drawn-mv/scripts/new_project.py 踩字示例 --style crayon --song <歌曲>
cp ~/.claude/skills/code-drawn-mv/references/examples/cues-crayon/chimney-card.js 踩字示例/src/scenes/
```

然后改 `src/main.js` 三处：

```js
import { farChimney, cardHop, CUT_1 } from "./scenes/chimney-card.js";   // 换掉 example.js 的 import
export const SHOTS = [farChimney({ tIn: 30.9, tOut: CUT_1 }), cardHop({ tIn: CUT_1, tOut: END + 1 })];
const LY = {};                                                            // 没有歌词文件就不显示字幕
```

```bash
npx -y hyperframes@0.9.41 check
npx -y hyperframes@0.9.41 snapshot --at 32.7,34.4,34.95,36.8 --no-end -o renders/_kf --timeout 170000
```

## 换成自己的歌

把 `PH`、`fix` 换成逐字时间表：分镜阶段用 lyric-scene-mv 的 `song_timing.py` 出 `逐字时间.json`，再

```bash
python3 ~/.claude/skills/code-drawn-mv/scripts/words_to_js.py 分镜/逐字时间.json     # 写 src/data/words.js
```

```js
import words from "../data/words.js";
const C = makeCues(words);          // C.at(行号, 字序)：那个字开唱的整片时间
```

## 看代码时注意

- 烟、雪、白气、星星都只由整片时间 `T` 决定（带种子的随机数），所以两个镜头之间是连着的。
- 卡片太大，放进角色画布会被切掉，所以用 `out.hand` 拿到手在画布上的坐标，在角色外面画，再补一个拇指压在卡片边上。
- "获得 · 卡片 ×1" 画在屏幕坐标里，用 `getTransform().transformPoint()` 从卡片的位置换算过去。镜头推近时它不会跟着放大。
