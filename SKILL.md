---
name: code-drawn-mv
description: 用代码一帧帧画出整支音乐 MV（歌词 MV、动画 MV、绘本风 MV），再用 HyperFrames 渲染成 MP4。这里沉淀了一整套做法：六步流程（理解音乐 → 定画风 → 画角色 → 分镜 → 先草图后整片 → 按用户给的时间点改片），四种画风（蜡笔/彩铅绘本、纸艺立体书、夜城流光、像素光影）和它们的起步代码，用到的工具和命令，以及检查和交付。像素光影是高级像素风：逐像素画、像素永远锐利，按光源算出亮层暗层和轮廓光，发光体和够亮的像素四周有一圈淡淡的泛光，清晨、正午、黄昏、夜里、晴、阴、雨、太阳雨都能画。只要用户想给一首歌做 MV 或动画、给了歌曲加歌词加参考视频、说「按这个视频的风格做」「蜡笔风」「绘本」「纸艺」「立体书」「剪纸」「夜城流光」「流光」「雨夜城市」「光轨」「印章」「像素风」「高级像素」「像素光影」「HD-2D」「亮层暗层」「窗户有光晕」「逆光」「太阳雨」「像给我一首歌的时间那样」，或者要改一支已经做好的 MV 的某个时间点，都先读这个 skill，即使用户没提 HyperFrames。每句歌词配什么画面、动作落在哪个字，是分镜的事，读 lyric-scene-mv。Use it to make or revise a music or lyric video whose every frame is drawn in code (Canvas 2D or Three.js) and rendered with HyperFrames. Crayon picture-book, pop-up paper-book, night-city light-trail and pixel-art light-and-shadow (any time of day, any weather) starter kits are included.
---

# 用代码画音乐 MV

画面不用生图模型。每一帧都由 JavaScript 按时间 t 画出来：蜡笔版、夜城流光版和像素光影版用 Canvas 2D，纸艺版用 Three.js 加 Canvas 贴图。HyperFrames 用无头 Chrome 一帧帧定位、截图，再合成 MP4。音乐和歌词都由用户提供。

方法来自 Winhao 的教程《AI 音乐像素 MV 保姆级教程》（Opus 5.5 + HyperFrames，六步做一支 MV），在实际做片中跑通过。每种画风的文档只记风格；人物、地点、画面上的字和故事，都由新片自己定。

## 开工前先读

1. **`hyperframes` skill**：渲染约定（每一帧只由时间决定）和 check、snapshot、render 的用法。本 skill 是建在它上面的一整套"做一支歌词 MV"的流程。
2. **`references/workflow.md`**：六步里每一步做什么、交出什么、在哪里停下来等用户；还有每一步的提示词卡。
3. **选定画风后**，读 `references/style-crayon.md`、`references/style-paper.md`、`references/style-nightcity.md` 或 `references/style-pixel.md`。里面有画法规则、配色、代码结构、接口说明，以及这种画风踩过的坑。每种画风都配了参考图（`references/style-crayon/`、`style-paper/`、`style-nightcity/`、`style-pixel/`），都是用起步代码现画的示意图。
4. **写剧本和分镜时**读 `lyric-scene-mv` skill：画什么、动作落在哪个字、两镜之间靠什么接，都归它管。它交回 `story.md`、`分镜表.md`、`逐字时间.json`，这里只管把它们变成镜头代码。
5. **改片、交付**时读 `references/review-and-delivery.md`。**查命令**读 `references/tools.md`。

## 四种画风（都有起步代码，模板渲染验证过）

| | 蜡笔绘本版 `crayon` | 纸艺立体书版 `paper` | 夜城流光版 `nightcity` | 像素光影版 `pixel` |
|---|---|---|---|---|
| 看起来 | 像小朋友用蜡笔、彩铅画的绘本：平涂色块，内侧描一圈同色系的深边，加排线和纸纹；2.5D 分层，镜头慢推 | 深夜书桌上的一本立体书：剪纸带白边，台灯打出软阴影，纸片一层层立起来；开头推进书里，结尾合上书 | 雨夜城市的扁平插画，像纸片搭的 2.5D 舞台；一金一蓝两道流光在街上、俯视地图上穿行、交汇，交汇时冒星芒、砸红印章、扩散同心圆 | 高级像素风：480×270 逐像素画、×4 放大，像素永远锐利；人物按光源有亮层、暗层和轮廓光；窗、灯、太阳和够亮的像素四周一圈淡淡的泛光；钟点一个旋钮（清晨、正午、黄昏、夜里），天气一个开关（晴、阴、雨、太阳雨） |
| 技术 | 只用 Canvas 2D；布景预先画在大画布上，镜头靠视差 | Three.js 3D 舞台（剪纸、灯光、阴影、胶片后期），纸面图案用 Canvas 画 | 只用 Canvas 2D：街道是极简 3D 投影的纸盒楼，地图是矢量、每帧按镜头重画；光效用 `lighter` 叠加，后期泛光 | 只用 Canvas 2D，逐像素算：背景、主体、发光三层；材质图按光源打光；后期三级泛光、亮部提取、光柱、眩光、背景虚化 |
| 换镜头 | 卡在拍点上硬切，靠视线或动作衔接；情绪爆点让人物散成蜡笔碎片 | 立体书翻页：这一页的剪纸倒下，地面那页翻起来，背面就是下一幕的背景 | 连招：光柱 → 竖向甩镜 → 闪白 → 新镜头对焦；猛推加震屏；过曝切出；镜头下沉加模糊后硬切 | 镜头推近按新缩放重画（不放大像素）：全景交代地点和光，推到双人中景看表情；同一个镜头里转钟点，窗灯一盏盏亮起来 |
| 歌词 | 圆体粗体（圓體-繁），卡拉 OK 逐字刷色，位置跟着构图走 | 宋体（宋體-繁）印在背景纸左上角，逐字出现，关键词放大 | 宋体粗体（宋體-繁）底部居中，每个字从淡紫虚影收成实字、闪一颗四芒星；关键字金色，最关键的字盖红印章 | 像素字：当前句白字带深色投影，下一句灰字，笔画二值化后 ×2 放大 |
| 起步代码 | `assets/crayon/` | `assets/paper/` | `assets/nightcity/` | `assets/pixel/` |
| 渲染速度（M4） | 2 分钟整片，30 fps，实测 2–11 分钟 | 2 分钟整片约 3 分钟 | 整片还没测；6.4 秒的模板演示 17 秒 | 6 秒样片约 40 秒；4 分钟整片约半小时 |

用户要别的画风时：先用 `scripts/analyze_ref.py` 拆参考片，写出 `style.md`。工具链、流程，以及 util、post、lyrics、镜头的写法照旧用，美术部分重写。教程里演示过的低配像素风（320×180、限 16–32 色、角色逐帧换画）也用 `pixel` 模板做，改法见 style-pixel.md 第 3 节末尾。

## 六步流程（每一步做完都停下来给用户看）

| 步 | 做什么 | 给用户看什么 |
|---|---|---|
| 0 准备 | 问清楚：音频文件、歌词（文本、LRC 或 SRT）、参考视频、做多长、横屏还是竖屏、角色是谁。然后建项目：`python3 scripts/new_project.py <文件夹> --style crayon\|paper\|nightcity\|pixel --song <音频> --title <片名>` | 剪好的试听片段 |
| 1 理解音乐 | `beats.py` 测 BPM、拍点、小节线；`set_lyrics.py` 写入用户给的歌词；上网查歌曲背景和乐评；写 `song.md`（段落、情绪走向、对歌词的几种理解） | `song.md` 的要点和时间轴 |
| 2 定画风 | 有参考片：`analyze_ref.py` 拆片，逐张看接触表，`palette.py` 取色，写 `style.md`。然后出 1 张样图和 1 段约 6 秒带音乐的样片，再和参考片同一段落拼一张对比图 | 样图、样片、对比图 |
| 3 画角色 | `src/character.js` 是角色的唯一来源（表情、姿势、转身）。用 `tools/sheet` 出设定图 | 设定图 |
| 4 剧本和分镜 | 按 lyric-scene-mv 写 `story.md` 和 `分镜表.md`，用它的 `song_timing.py` 出 `逐字时间.json`。用户确认后，`scripts/words_to_js.py` 把逐字时间表转成 `src/data/words.js`，镜头里用 `src/cues.js` 的 `makeCues(words)` 取每个字的时间 | 分镜表 |
| 5 先草图，再整片 | 把所有镜头写成代码，每个镜头截一张关键帧，用 `storyboard_sheet.py` 拼成总览，用户确认后再渲整片。渲完跑 `check_render.py`，最后用 `deliver.sh` 交付 | 先给分镜总览，确认后给成片 |
| 6 改片 | 用户报时间点和问题。先自己逐帧找到真正的错（往往不止一处），修好后只渲受影响的片段，用 `review_clip.py` 拼成一条确认小样发给用户。用户说"重渲整片"再出整片 | 确认小样，然后成片 |

教程作者的第一支 MV 做了 7 个多小时、改了 9 版。草图阶段多改几轮，最省时间。

## 技术约定，以及为什么

- **每一帧只由时间 t 决定。** HyperFrames 会乱序、并行地定位到任意一帧来渲染。所以随机数一律用带种子的 `mulberry32`，不用 `Math.random`、`requestAnimationFrame`、计时器或 `Date.now`。动画写成关键帧插值，例如 `keyed([[秒, 值], …], lt)`。
- **项目结构。** `index.html` 是根合成：一张 1920×1080 的 canvas 加一条 `<audio id="song">`，根上注册一条空的、暂停的 GSAP 时间轴（HyperFrames 要求有）。`src/main.js` 在 `hf-seek` 事件里画当前帧，用 `window.__hf.buildReady["mv-stage"]` 先等字体加载、布景预先画好。分镜表 `SHOTS` 写在 main.js，每个镜头一个函数，放在 `src/scenes/*.js`。这和 hyperframes skill 推荐的"每个场景一个子合成"不一样：画面全靠代码画，HyperFrames 桌面 app 没法逐个元素编辑，换来的是想怎么画就怎么画。
- **30 fps，逐帧连续。** "一拍二"（每秒只换 12 张画）有手工的顿挫感，但动作看起来卡。也不要用插帧：代码画的帧可以直接算出中间帧，插帧反而会有果冻效应。蜡笔版代码里留着开关 `SMOOTH`。
- **歌词由用户提供，代码读文件。** 不要自己转写或背诵歌词，也不要在聊天里大段复述。本机的 faster-whisper 识别唱歌基本认不出字。歌词视频的字幕只用来取时间点。
- **字体用本机的**（宋体、圆体；繁体歌词用 TC，简体用 SC）。check 会报 `font_face_local_only` 警告，本机渲染可以忽略；换机器或上云渲染，要把字体文件放进 `assets/fonts/`。
- **声音。** 渲染器导出的音轨比原曲低约 0.6 LU，交付时用 `deliver.sh` 换回原曲。渲染时加 `--max-bitrate=16M`，带颗粒的画面码率很高。
- **参考片只学做法**（画法、配色、节奏、转场、字幕规则），不搬它的角色、情节和构图。

## 文件

| 路径 | 用途 |
|---|---|
| `assets/crayon/`、`assets/paper/`、`assets/nightcity/`、`assets/pixel/` | 四套起步模板：`index.html`、`src/`（画法工具、角色、布景、歌词、后期、示例镜头、动作踩字 `cues.js`）、示例时间轴；蜡笔版和纸艺版有角色设定图页面，蜡笔版有游戏界面贴纸 `gameui.js`，像素版有分层拆解和时段对比页面 |
| `references/style-crayon/` | 蜡笔版的 7 张参考图：色板、画法拆解、角色、布景分层、字幕、情绪爆点、后期前后 |
| `references/style-paper/` | 纸艺版的 6 张参考图：色板、立体书舞台、角色、翻页转场、字幕、开场和结尾 |
| `references/style-nightcity/` | 夜城流光版的 8 张参考图：色板、动效样本、字幕、街道、低机位、俯视地图、转场、后期前后 |
| `references/style-pixel/` | 像素光影版的 7 张参考图：四个时段对比、分层拆解（黄昏太阳雨、夜雨）、两个样图、夜雨全景、分镜总览 |
| `references/examples/cues-crayon/` | 踩字示例（蜡笔）：动作顶点落在字上、人物挂点、游戏界面贴纸，附复现步骤 |
| `scripts/new_project.py` | 从模板建项目，装 gsap/three 到 `lib/`，转换歌曲，建 `.venv`（librosa、numpy、pillow） |
| `scripts/beats.py` | 测 BPM、拍点、小节线，按小节打印响度（找主歌、副歌） → `data/timing.json` |
| `scripts/set_lyrics.py` | 把用户给的歌词（SRT、LRC 或 TSV）写进时间轴，生成 `src/data/timing.js` 和 `lyrics.srt` |
| `scripts/words_to_js.py` | 把逐字时间表（lyric-scene-mv 的 `逐字时间.json`）转成 `src/data/words.js`，给 `cues.js` 用 |
| `scripts/analyze_ref.py` | 拆参考片：每 0.5 秒一帧的接触表、原尺寸帧、BPM、响度、切点 |
| `scripts/palette.py` | 给参考帧的指定区域取色（k-means 聚类，输出 HEX） |
| `scripts/contact.py` | 从视频按时间抽帧，拼成带时间标签的接触表。自己"看"视频、找改片意见里说的问题，主要靠它 |
| `scripts/compare.py` | 2×2 对比图（方案 A/B、新旧版、和参考片对比） |
| `scripts/storyboard_sheet.py` | 关键帧拼成分镜总览 |
| `scripts/check_render.py` | 成片自查：静止段、切点、每句开唱时的歌词截图、逐帧重复 |
| `scripts/review_clip.py` | 改片确认小样：标题卡加改过的片段，配原曲，720p |
| `scripts/deliver.sh` | 换回原曲音轨、量响度、可选再压 720p 预览 |

Python 脚本用项目里的 `.venv/bin/python -I` 运行（`set_lyrics.py`、`words_to_js.py` 只用标准库）。都在项目根目录跑。

## 各种画风都会遇到的坑

- **画布的边会把东西切掉。** 先画在离屏画布或预画图层上的东西，超出画布范围就被切平：比如树冠只剩半截，人坐下时脚没了。所以图层要留足边距，角色画布（`BOX`）要包住所有姿势。
- **镜头一动就露出底色或黑边。** 背景层要比画面大一圈（上下左右各留约 260 px），最底下先铺一层底色。
- **人物突然出现。** 比如上一镜只拍天空，下一镜两个人突然冒出来。要么用一个连贯的镜头拍完，要么让人物在上一镜就已经在画面里。
- **画面和歌词的时间对不上。** 夜里的歌词配了一个像白天的画面。回忆可以用暖色，但白天还是夜里要和歌词一致。
- **两行歌词交接时叠在一起。** 上一行要在下一行开唱前约 0.55 秒淡完。
- **改片意见是"这里过程有错"。** 用 `contact.py` 逐帧看那一段，把真正的错一条条列清楚（常常有两三处），再动手改。
- **zsh 不会把 `$var` 按空格拆开。** 渲染命令直接写 `--start=… --end=…`。
- **Chrome 的 canvas 里，`filter = blur()` 加 `destination-in` 不可靠。** 先把遮罩模糊到一张单独的画布上，再用 `drawImage` 加 `destination-in` 合成。
- **临时目录（scratchpad）会被清空。** 分析脚本和数据要放在项目里。
