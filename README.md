# code-drawn-mv

## 像素光影 · 效果展示

<table>
<tr>
<td width="50%">
<img src="references/style-pixel/04_%E6%A0%B7%E5%9B%BE_%E9%BB%84%E6%98%8F%E5%A4%AA%E9%98%B3%E9%9B%A8.jpg" alt="黄昏太阳雨中景样图：逆光、透明伞、牵手，身后是亮着窗的公交车" width="100%">
<br><sub>黄昏太阳雨 · 中景</sub>
</td>
<td width="50%">
<img src="references/style-pixel/05_%E6%A0%B7%E5%9B%BE_%E5%A4%9C%E9%9B%A8.jpg" alt="夜雨中景样图：路灯轮廓光、窗的泛光、伞下是干的" width="100%">
<br><sub>夜雨 · 中景</sub>
</td>
</tr>
<tr><td colspan="2">

**中景样图。** 要看清表情就推到人物身高 ≥ 180 像素（大腿以上的中景）。黄昏太阳雨靠低角度的太阳做逆光：正面落进暗面，只有边亮，靠近太阳一侧的雨丝会发光。夜雨则由路灯给出暖橙轮廓光，窗和车灯四周一圈淡淡的泛光；伞下是干的，雨和水花都会跳过。

</td></tr>
<tr>
<td width="50%">
<img src="references/style-pixel/06_%E5%85%A8%E6%99%AF_%E5%A4%9C%E9%9B%A8.jpg" alt="夜雨全景：路灯下的人行道、城市天际线和湿地上的倒影" width="100%">
<br><sub>夜雨 · 全景</sub>
</td>
<td width="50%">
<img src="references/style-pixel/01_%E5%9B%9B%E4%B8%AA%E6%97%B6%E6%AE%B5.jpg" alt="四个时段对比：清晨薄雾、正午、黄昏逆光、夜里雨" width="100%">
<br><sub>四个时段：清晨 · 正午 · 黄昏 · 夜里</sub>
</td>
</tr>
<tr><td colspan="2">

**全景。** 先用全景交代地点和光，再推到双人中景。一个镜头只做一种慢动作。

</td></tr>
</table>


**用代码一帧帧画出整支音乐 MV，再用 HyperFrames 渲染成 MP4。**

A Claude Code skill for making lyric and music videos whose every frame is drawn in JavaScript (Canvas 2D or Three.js) and rendered with [HyperFrames](https://github.com/heygen-com/hyperframes). Four starter styles are included. The one to look at first is **像素光影** — sharp pixel art whose light, shadow, rim light and bloom are computed from real light sources, at any time of day and in any weather.

<p align="center">
  <img src="docs/showcase.jpg" alt="四种画风预览：像素光影、蜡笔绘本、纸艺立体书、夜城流光" width="100%">
</p>

<p align="center"><sub>参考图都是用起步代码现画的示意图，不是成片截图。角色、地点和画面上的字只是占位。</sub></p>

## 它做什么

画面不用生图模型。每一帧都由 JavaScript 按时间 `t` 画出来：蜡笔版、夜城流光版和像素光影版用 Canvas 2D，纸艺版用 Three.js 加 Canvas 贴图。HyperFrames 用无头 Chrome 一帧帧定位、截图，再合成 MP4。音乐和歌词都由用户提供。

和 [lyric-scene-mv](https://github.com/chhhhali/lyric-scene-mv) 分工：那边管「画什么、动作落在哪个字、两镜之间靠什么接」；这边把确认过的分镜写成镜头代码，并渲染成片。

方法来自 Winhao 的教程《AI 音乐像素 MV 保姆级教程》（Opus 5.5 + HyperFrames，六步做一支 MV），在实际做片中跑通过。每种画风的文档只记风格；人物、地点、画面上的字和故事，都由新片自己定。

## 四种画风

四套起步代码都在 `assets/` 里，模板渲染验证过。用 `scripts/new_project.py --style crayon|paper|nightcity|pixel` 建项目。

| | 蜡笔绘本 `crayon` | 纸艺立体书 `paper` | 夜城流光 `nightcity` | 像素光影 `pixel` |
|---|---|---|---|---|
| 看起来 | 像小朋友用蜡笔、彩铅画的绘本：平涂色块，内侧描一圈同色系的深边，加排线和纸纹；2.5D 分层，镜头慢推 | 深夜书桌上的一本立体书：剪纸带白边，台灯打出软阴影，纸片一层层立起来；开头推进书里，结尾合上书 | 雨夜城市的扁平插画，像纸片搭的 2.5D 舞台；一金一蓝两道流光在街上、俯视地图上穿行、交汇，交汇时冒星芒、砸红印章、扩散同心圆 | 高级像素风：480×270 逐像素画、×4 放大，像素永远锐利；人物按光源有亮层、暗层和轮廓光；窗、灯、太阳和够亮的像素四周一圈淡淡的泛光；钟点一个旋钮（清晨、正午、黄昏、夜里），天气一个开关（晴、阴、雨、太阳雨） |
| 技术 | 只用 Canvas 2D；布景预先画在大画布上，镜头靠视差 | Three.js 3D 舞台（剪纸、灯光、阴影、胶片后期），纸面图案用 Canvas 画 | 只用 Canvas 2D：街道是极简 3D 投影的纸盒楼，地图是矢量、每帧按镜头重画；光效用 `lighter` 叠加，后期泛光 | 只用 Canvas 2D，逐像素算：背景、主体、发光三层；材质图按光源打光；后期三级泛光、亮部提取、光柱、眩光、背景虚化 |
| 换镜头 | 卡在拍点上硬切，靠视线或动作衔接；情绪爆点让人物散成蜡笔碎片 | 立体书翻页：这一页的剪纸倒下，地面那页翻起来，背面就是下一幕的背景 | 连招：光柱 → 竖向甩镜 → 闪白 → 新镜头对焦；猛推加震屏；过曝切出；镜头下沉加模糊后硬切 | 镜头推近按新缩放重画（不放大像素）：全景交代地点和光，推到双人中景看表情；同一个镜头里转钟点，窗灯一盏盏亮起来 |
| 歌词 | 圆体粗体（圓體-繁），卡拉 OK 逐字刷色 | 宋体（宋體-繁）印在背景纸左上角，逐字出现，关键词放大 | 宋体粗体（宋體-繁）底部居中，每个字从淡紫虚影收成实字；关键字金色，最关键的字盖红印章 | 像素字：当前句白字带深色投影，下一句灰字，笔画二值化后 ×2 放大 |
| 起步代码 | `assets/crayon/` | `assets/paper/` | `assets/nightcity/` | `assets/pixel/` |
| 渲染速度（Apple M4 实测） | 2 分钟整片，30 fps，2–11 分钟 | 2 分钟整片约 3 分钟 | 整片还没测；6.4 秒的模板演示 17 秒 | 6 秒样片约 40 秒；4 分钟整片约半小时 |

用户要别的画风时：先用 `scripts/analyze_ref.py` 拆参考片，写出 `style.md`。工具链和流程照旧用，美术部分重写。教程里演示过的低配像素风（320×180、限 16–32 色、角色逐帧换画）也用 `pixel` 模板做，改法见下面的像素光影一节。

---

## 像素光影

这是本仓库着重要介绍的画风。一句话：**像素永远是锐利的小方块，「高级」来自光。**

按光源算出来的亮层和暗层、发光体和够亮的像素四周那圈淡淡的泛光、空气里的雾和光柱、湿地上的倒影，加上近景的背景虚化。任何时间都是这样：夜里光来自灯，白天光来自太阳和亮的表面，黄昏两样都有。

用户说「像素风」「高级像素」「像素光影」「HD-2D」「亮层暗层」「窗户有光晕」「逆光」「太阳雨」，或「像给我一首歌的时间那样」，就会走到这套模板。

### 画出来是什么样

起步代码画在 480×270 上（`px.js` 的 `LW × LH`），再 ×4 最近邻放大到 1920×1080。镜头推近时不放大像素，而是按新的缩放重新画，近景的脸像素更多、表情更清楚。

参考了两支片子的做法，但不搬它们的角色、情节和构图：

- **「给我一首歌的时间」MV**：光照（迎着路灯一侧有轮廓光，窗、灯四周叠一圈很淡的柔光，近景背景虚化，雨和湿地上的倒影）。
- **「圣诞星」MV**：像素大小全片统一，颜色块干净；镜头推近时重画，而不是把像素拉大。

下面这些参考图都是用 `assets/pixel/` 的起步代码现画的。

**四个时段。** 同一构图换四个默认关键时刻：清晨 6.4（薄雾）、正午 12.5、黄昏 17.6（逆光）、夜里 21（夜雨）。上排全景，下排中景。定画风时用 `tools/times` 一次截出，让用户挑钟点。

<img src="references/style-pixel/01_%E5%9B%9B%E4%B8%AA%E6%97%B6%E6%AE%B5.jpg" alt="四个时段对比：清晨薄雾、正午、黄昏逆光、夜里雨" width="100%">

**分层拆解。** 每一帧分三层画：背景、主体、发光。主体上的亮层、暗层和轮廓光是按光源算出来的，不是手涂的。发光层里是窗、灯，以及够亮的像素；缩到三档分辨率模糊后再叠回去，像素本体不糊，只有外面那圈光是软的。

黄昏太阳雨：

<img src="references/style-pixel/02_%E5%88%86%E5%B1%82%E6%8B%86%E8%A7%A3_%E9%BB%84%E6%98%8F%E5%A4%AA%E9%98%B3%E9%9B%A8.jpg" alt="黄昏太阳雨分层拆解：背景层、加上主体、发光层、成片" width="100%">

夜雨：

<img src="references/style-pixel/03_%E5%88%86%E5%B1%82%E6%8B%86%E8%A7%A3_%E5%A4%9C%E9%9B%A8.jpg" alt="夜雨分层拆解：背景层、加上主体、发光层、成片" width="100%">

**中景样图和全景：** 见页首的像素光影展示。

**分镜总览。** 每个镜头截一张动作最清楚的关键帧，用 `scripts/storyboard_sheet.py` 拼成总览，用户确认后再渲整片。下面这张是夜雨样片的九格总览：全景里她撑伞、他淋着雨低头，唱到「牵」时两只手正好牵上，伞往他那边歪过去。

<img src="references/style-pixel/07_%E5%88%86%E9%95%9C%E6%80%BB%E8%A7%88_%E5%A4%9C%E9%9B%A8.jpg" alt="夜雨分镜总览：从全景到中景牵手，动作落在歌词上" width="100%">

### 时间和天气

每帧画之前先定环境：`applyEnv(makeEnv({ hour, weather, sunX }))`。`hour` 是 0–24 的钟点，由它算出太阳高度，再算出天空、主光、窗、路灯和影子。`weather` 是四个开关，下雨不再等于晚上：

| 值 | 天气 |
|---|---|
| `"clear"` | 晴 |
| `"cloudy"` | 阴 |
| `"rain"` | 雨（阴天下雨） |
| `"sunrain"` | 太阳雨（有太阳也下雨） |

`sunX` 是太阳在画面里的左右位置（0–1），决定逆光从哪边来、影子往哪边倒。要看得见太阳，就把它放在楼和楼之间的空当里。

默认关键时刻：清晨 **6.4**、正午 **12.5**、黄昏 **17.6**、夜里 **21**。

| 跟着钟点变的 | 夜里 | 清晨 / 黄昏 | 白天 |
|---|---|---|---|
| 天空 | 7 档深紫 | 清晨淡紫到浅杏，黄昏蓝紫到橙 | 蓝到浅蓝 |
| 主光 | 路灯（暖橙） | 低低的太阳，逆光 | 高处的太阳，影子短 |
| 窗 | 约四成亮着暖灯 | 一盏盏亮起来 | 玻璃映着天，几扇反射太阳闪一下 |
| 路灯、车灯 | 开 | 渐渐开 | 关（尾灯还微微亮） |
| 楼 | 暗靛 | 背光压暗偏冷，远楼成剪影，受光边是亮的 | 白天的颜色，远处靠近天色 |
| 地面 | 暗、湿 | 黄昏接住斜阳偏暖，清晨被雾冲淡 | 浅灰，下雨时映着天色 |
| 影子 | 无 | 很长，朝镜头这边倒 | 短，在脚下 |
| 空气 | 无 | 清晨有雾，远处蒙一层天色 | 远处淡淡蒙一层 |
| 后期 | 原样 | 眩光、光柱、轻微暖色（清晨偏粉） | 亮部泛光、暗角变淡 |

最出效果的是逆光：太阳在人物身后、低，楼和人的正面都在背光里，只有边亮。黄昏、清晨的「高级感」主要靠它。时间流逝不用切镜头：同一个镜头里把 `hour` 随时间推进，窗灯会一盏盏亮起来。

夜里和只有夜景时的旧版本逐像素一致：

```js
makeEnv({ hour: 21, weather: "rain" })
```

给某个镜头换钟点，或改 `shots.js` 里全片默认的 `ENV_DEFAULT`：

```js
{ ...streetTwo({ tIn, tOut }), env: { hour: 6.4, weather: "clear", sunX: 0.36 } }
```

雨后初晴（晴天但还留着水洼和倒影）：

```js
makeEnv({ weather: "clear", wet: 0.6 })
```

### 相关命令

建一个像素光影项目：

```bash
python3 ~/.claude/skills/code-drawn-mv/scripts/new_project.py ./我的MV --style pixel --song song.wav --title "片名"
cd ./我的MV
npx -y hyperframes@0.9.41 check
npx -y hyperframes@0.9.41 telemetry disable   # 关掉使用数据上报
```

模板自带两张工具页。定画风、检查光影时用它们截图，比一张张改钟点快：

```bash
# 分层拆解：背景、加主体、发光层、成片
npx -y hyperframes@0.9.41 snapshot tools/layers --at 27.7 --no-end -o renders/_layers --timeout 170000

# 时段对比：同一刻换四个钟点和天气（预设写在 tools/times/times.js 的 PRESETS）
npx -y hyperframes@0.9.41 snapshot tools/times --at 23.2,27.7 --no-end -o renders/_times --timeout 170000
```

渲一段样片或整片（30 fps；带颗粒和泛光的画面码率很高，加 `--max-bitrate=16M`）：

```bash
npx -y hyperframes@0.9.41 render --start=23 --end=29 --fps=30 --max-bitrate=16M --quiet -o renders/_sample.mp4
npx -y hyperframes@0.9.41 render --fps=30 --max-bitrate=16M --quiet -o renders/_master.mp4
```

在 Apple M4 上，6 秒样片（180 帧）约 40 秒渲完，4 分钟整片约半小时，建议放后台跑。每帧都用 JS 逐像素算（背景约 13 万像素，加打光、雨、倒影、亮部提取、光柱）。

教程里演示过的低配像素风（320×180、限 16–32 色、角色逐帧换画）也用这套模板：把 `px.js` 的 `LW`、`LH` 改小，色板减色，后期的 `bloom`、`haze` 设成 0。

完整的画法规则、代码结构和踩过的坑，见 [`references/style-pixel.md`](references/style-pixel.md)。

### 怎样触发这一路

把歌曲和歌词交给 Claude Code，并说明要像素光影，例如：

```text
用像素光影给这首歌做一支 MV。歌和带时间的歌词在这个文件夹里。
```

```text
按高级像素 / HD-2D 来做，人物要有亮层、暗层和轮廓光，窗户要有光晕。
```

```text
像给我一首歌的时间那样，雨夜河边，逆光，近景把背景虚化。
```

```text
同一条街，先黄昏太阳雨，再在同一个镜头里天色慢慢变成夜里。
```

---

## 另外三种画风

规则、配色、接口和踩过的坑，分别写在对应的 `references/style-*.md` 里。参考图都在各画风的文件夹中。

### 蜡笔绘本 `crayon`

像小朋友用蜡笔和彩铅画的绘本，做成 2.5D 动画。平涂色块，内侧描一圈同色系的深边，叠上彩铅排线和纸纹。适合温柔、怀旧、童真的歌。情绪爆点可以把一个东西炸成一把彩色蜡笔碎片。

<img src="references/style-crayon/02_%E7%94%BB%E6%B3%95.jpg" alt="蜡笔画法拆解：平涂、内侧深描边、排线、纸纹" width="100%">

<img src="references/style-crayon/03_%E8%A7%92%E8%89%B2.jpg" alt="蜡笔版角色设定图：姿势、表情和特写" width="100%">

### 纸艺立体书 `paper`

深夜的书桌上摊着一本立体书。台灯的暖光照在纸做的世界上，纸片人和布景从书页里一层层立起来；每句歌词翻一页。开场从书桌推进书里，结尾拉远、剪纸倒下、合上书。翻一页约 0.6 秒，不适合一拍一刀的快切。

<img src="references/style-paper/02_%E7%AB%8B%E4%BD%93%E4%B9%A6%E8%88%9E%E5%8F%B0.jpg" alt="立体书舞台：从书桌上合着的书推进到全屏的一页" width="100%">

<img src="references/style-paper/04_%E7%BF%BB%E9%A1%B5%E8%BD%AC%E5%9C%BA.jpg" alt="翻页转场：这一页的剪纸倒下，地面那页翻起来，背面就是下一幕" width="100%">

### 夜城流光 `nightcity`

雨夜城市的扁平插画。深蓝紫的底色上点着暖白窗灯。一金一蓝两道流光代表两条线索，在街上、俯视地图上穿行、交汇。交汇时冒星芒、砸红印章、扩散同心圆。适合节奏明快的歌，以及相遇、错过、追赶这类两条路线的故事。颜色和光效都是为夜里设计的，不适合白天或田园题材。

<img src="references/style-nightcity/04_%E8%A1%97%E9%81%93.jpg" alt="夜城街道：纸盒楼、霓虹招牌、雨和两道流光" width="100%">

<img src="references/style-nightcity/05_%E4%BD%8E%E6%9C%BA%E4%BD%8D.jpg" alt="低机位：轮廓光、湿地倒影、落脚处的光柱" width="100%">

## 六步流程

每一步做完都停下来给用户看。教程作者的第一支 MV 做了 7 个多小时、改了 9 版；草图阶段多改几轮，最省时间。细节和每一步的提示词卡见 [`references/workflow.md`](references/workflow.md)。

| 步 | 做什么 | 给用户看什么 |
|---|---|---|
| 0 准备 | 问清楚：音频、歌词（文本、LRC 或 SRT）、参考视频、做多长、横屏还是竖屏、角色是谁。然后建项目 | 剪好的试听片段 |
| 1 理解音乐 | `beats.py` 测 BPM、拍点、小节线；`set_lyrics.py` 写入用户给的歌词；查歌曲背景和乐评；写 `song.md` | `song.md` 的要点和时间轴 |
| 2 定画风 | 有参考片就用 `analyze_ref.py` 拆片、`palette.py` 取色，写 `style.md`。出 1 张样图和约 6 秒带音乐的样片，再和参考片同一段落拼对比图。像素光影也可用 `tools/times` 一次出四个时段 | 样图、样片、对比图 |
| 3 画角色 | `src/character.js`（像素版是 `people.js`）是角色的唯一来源。蜡笔版和纸艺版用 `tools/sheet` 出设定图；像素版模板带的是 `tools/layers` 和 `tools/times` | 设定图 |
| 4 剧本和分镜 | 按 [lyric-scene-mv](https://github.com/chhhhali/lyric-scene-mv) 写 `story.md` 和 `分镜表.md`，用它的 `song_timing.py` 出 `逐字时间.json`。用户确认后，`words_to_js.py` 转成 `src/data/words.js`，镜头里用 `cues.js` 的 `makeCues(words)` 取每个字的时间 | 分镜表 |
| 5 先草图，再整片 | 把所有镜头写成代码，每个镜头截一张关键帧，用 `storyboard_sheet.py` 拼成总览，用户确认后再渲整片。渲完跑 `check_render.py`，最后用 `deliver.sh` 交付 | 先给分镜总览，确认后给成片 |
| 6 改片 | 用户报时间点和问题。先自己逐帧找到真正的错（往往不止一处），修好后只渲受影响的片段，用 `review_clip.py` 拼成确认小样。用户说「重渲整片」再出整片 | 确认小样，然后成片 |

建项目、检查、截关键帧、渲整片：

```bash
python3 ~/.claude/skills/code-drawn-mv/scripts/new_project.py ./我的MV --style pixel --song song.wav --title "片名"
cd ./我的MV
npx -y hyperframes@0.9.41 check          # errorCount 必须是 0
npx -y hyperframes@0.9.41 snapshot --at 5.0,12.6 --no-end -o renders/_sb --timeout 170000
npx -y hyperframes@0.9.41 render --fps=30 --max-bitrate=16M --quiet -o renders/_master.mp4
.venv/bin/python -I ~/.claude/skills/code-drawn-mv/scripts/check_render.py renders/_master.mp4 --boxes data/lyric_boxes.json --pairs
bash ~/.claude/skills/code-drawn-mv/scripts/deliver.sh renders/_master.mp4 assets/song.wav "成片.mp4" "預覽-720p.mp4"
```

改片和交付的细则见 [`references/review-and-delivery.md`](references/review-and-delivery.md)，命令速查见 [`references/tools.md`](references/tools.md)。

### 几条技术约定

- **每一帧只由时间 `t` 决定。** HyperFrames 会乱序、并行地定位到任意一帧来渲染。随机数一律用带种子的 `mulberry32`，不用 `Math.random`、`requestAnimationFrame`、计时器或 `Date.now`。
- **30 fps，逐帧连续。** 代码画的帧可以直接算出中间帧，不要用插帧。
- **歌词由用户提供，代码读文件。** 不要自己转写或背诵歌词。
- **字体用本机的**（宋体、圆体；繁体歌词用 TC，简体用 SC）。check 会报 `font_face_local_only` 警告，本机渲染可以忽略；换机器或上云渲染，要把字体文件放进 `assets/fonts/`。像素版歌词是代码画的像素字，不依赖这两款字体。
- **声音。** 渲染器导出的音轨比原曲低约 0.6 LU，交付时用 `deliver.sh` 换回原曲。
- **参考片只学做法**（画法、配色、节奏、转场、字幕规则），不搬它的角色、情节和构图。

## 环境要求

`new_project.py` 本身只依赖 Python 标准库，但需要下面这些工具在 `PATH` 里：

- **Node.js / npm / npx**：运行 HyperFrames；建项目时用 npm 把 GSAP（以及纸艺版的 Three.js）装到 `lib/`
- **HyperFrames CLI**：一律用锁定版本 `npx -y hyperframes@0.9.41 …`（`new_project.py` 会写进项目的 `package.json`）。建议执行一次 `npx -y hyperframes@0.9.41 telemetry disable`，关掉使用数据上报
- **Google Chrome**：HyperFrames 自己启动无头 Chrome，一帧帧打开页面并截图。用的是单独的临时配置，不碰用户的标签页和登录
- **ffmpeg / ffprobe**：剪音频、量响度、抽帧、换回原曲音轨、压 720p 预览
- **uv** 和 **Python 3.12**：`new_project.py` 会在项目里建 `.venv`，并安装 librosa、numpy、pillow（测拍、取色、拼接触表、成片自查）
- **本机字体**（蜡笔 / 纸艺 / 夜城）：宋體-繁（Songti TC Bold）、圓體-繁（Yuanti TC Bold）。这是作者在 macOS 上用的字体；换机器时把对应文件放进 `assets/fonts/`

建议同时安装 [lyric-scene-mv](https://github.com/chhhhali/lyric-scene-mv)，以及 HyperFrames 自己的 skill（`hyperframes`、`hyperframes-cli`），以便遵循渲染约定。

Python 脚本在项目根目录用 `.venv/bin/python -I` 运行（`-I` 表示不从当前目录加载同名模块）。`set_lyrics.py` 和 `words_to_js.py` 只用标准库，可以直接 `python3`。

## 安装

把本仓库放到 Claude Code 的 skill 目录：

```bash
git clone https://github.com/chhhhali/code-drawn-mv.git ~/.claude/skills/code-drawn-mv
```

或者把整个文件夹复制到 `~/.claude/skills/code-drawn-mv/`。文件夹名要和 skill 名一致，这样 Claude Code 才能找到它。

分镜那一步还需要它的同伴 skill：

```bash
git clone https://github.com/chhhhali/lyric-scene-mv.git ~/.claude/skills/lyric-scene-mv
```

## 用法

在 Claude Code 里打开一首歌的工作目录，把音频和歌词（最好是带时间轴的 LRC 或 SRT）放进去，用自然语言说明要做一支代码绘制的 MV。例如：

```text
给这首歌做一支代码画的 MV。歌和歌词在这个文件夹里，用像素光影，横屏，先做前两分钟。
```

```text
按这个参考视频的风格做，蜡笔绘本风。
```

```text
用纸艺立体书来做，每句歌词翻一页。
```

```text
夜城流光，两条路线在雨夜里交汇。
```

```text
1:05–1:06 过程有错，你自己看看，改完给我一段确认小样。
```

触发词还包括：绘本、剪纸、流光、雨夜城市、光轨、印章、高级像素、HD-2D、亮层暗层、窗户有光晕、逆光、太阳雨，「像给我一首歌的时间那样」。即使用户没提 HyperFrames，只要是「用代码一帧帧画出整支 MV」，也应先读这个 skill。

每句歌词配什么画面、动作落在哪个字，是分镜的事，会转到 [lyric-scene-mv](https://github.com/chhhhali/lyric-scene-mv)。

## 仓库结构

```
code-drawn-mv/
├── SKILL.md                          # skill 入口：流程、约定、文件一览
├── LICENSE
├── README.md
├── docs/
│   └── showcase.jpg                  # 四种画风预览
├── assets/                           # 四套起步模板
│   ├── crayon/                       # 蜡笔绘本：画法、角色、布景、歌词、后期、设定图页
│   ├── paper/                        # 纸艺立体书：Three.js 舞台、翻页、设定图页
│   ├── nightcity/                    # 夜城流光：街道、地图、流光、字幕印章
│   └── pixel/                        # 像素光影：逐像素打光、env、分层拆解页、时段对比页
├── references/
│   ├── workflow.md                   # 六步流程详解和提示词卡
│   ├── tools.md                      # 工具和常用命令
│   ├── review-and-delivery.md        # 改片循环和交付
│   ├── style-crayon.md               # 蜡笔：画法、配色、接口、坑
│   ├── style-crayon/                 # 7 张参考图
│   ├── style-paper.md
│   ├── style-paper/                  # 6 张参考图
│   ├── style-nightcity.md
│   ├── style-nightcity/              # 8 张参考图
│   ├── style-pixel.md                # 像素光影：八条规矩、时间和天气、工具页
│   ├── style-pixel/                  # 7 张参考图（四个时段、分层拆解、样图、全景、分镜总览）
│   └── examples/cues-crayon/         # 踩字示例（蜡笔）
└── scripts/
    ├── new_project.py                # 从模板建项目，锁定 hyperframes@0.9.41，建 .venv
    ├── beats.py                      # 测 BPM、拍点、小节线
    ├── set_lyrics.py                 # 把用户给的歌词写进时间轴
    ├── words_to_js.py                # 逐字时间表 → src/data/words.js
    ├── analyze_ref.py                # 拆参考片
    ├── palette.py                    # k-means 取色
    ├── contact.py                    # 按时间抽帧，拼接触表
    ├── compare.py                    # 2×2 对比图
    ├── storyboard_sheet.py           # 关键帧拼成分镜总览
    ├── check_render.py               # 成片自查：静止段、切点、歌词、重复帧
    ├── review_clip.py                # 改片确认小样（720p，带标题卡）
    └── deliver.sh                    # 换回原曲音轨、量响度、可选压 720p 预览
```

## 和 lyric-scene-mv 的关系

两套 skill 是配套的，但职责分开：

- **[lyric-scene-mv](https://github.com/chhhhali/lyric-scene-mv)** 只管内容。它交出 `story.md`、`分镜表.md`、`逐字时间.json`：每句歌词配什么画面、动作落在哪个字、两镜之间靠什么接。不管画风，也不管用代码画、AI 生成、素材剪辑还是实拍。
- **code-drawn-mv** 只管把确认过的分镜变成镜头代码，并按选定的画风渲染成 MP4。第 4 步会读 lyric-scene-mv；用户确认分镜之前，不渲整片。

建议两个仓库都安装到 `~/.claude/skills/` 下。

## 致谢

- 渲染基于 HeyGen 开源的 [HyperFrames](https://github.com/heygen-com/hyperframes)。
- 六步流程的骨架来自 Winhao 的教程《AI 音乐像素 MV 保姆级教程》。

## 许可

[MIT](LICENSE) © 2026 chhhhali
