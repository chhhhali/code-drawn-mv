# 工具和常用命令

目录：工具一览 · HyperFrames · ffmpeg · librosa 和 Python 环境 · 看视频的方法 · 发给手机

## 工具一览

| 工具 | 版本 / 位置 | 在 MV 里做什么 |
|---|---|---|
| HyperFrames CLI | `npx -y hyperframes@0.9.41 …`（package.json 锁定版本） | HeyGen 开源的"用 HTML 写视频"工具：检查项目、截关键帧、渲染 MP4。在本机命令行跑，不需要连接器，也不用登录（遥测已经用 `telemetry disable` 关掉） |
| HyperFrames skills | `~/.claude/skills/hyperframes*`（6 个） | `hyperframes`：渲染约定和工作流程；`hyperframes-cli`：命令用法 |
| Google Chrome（无头） | 系统自带的 Chrome，HyperFrames 自己启动 | 在后台一帧帧打开页面、截图。用的是单独的临时配置，不碰用户的标签页和登录 |
| Node.js / npm / npx | Node v24 | 运行 HyperFrames；`new_project.py` 用 npm 下载 gsap/three |
| GSAP | 3.15，复制在 `lib/gsap/` | HyperFrames 要求根合成注册一条时间轴；画面本身不靠它 |
| Three.js | 0.187，复制在 `lib/three/`（只有纸艺版用） | 3D 立体书舞台：剪纸、台灯阴影、翻页、胶片后期 |
| Canvas 2D | 浏览器自带 | 所有图案：天空、楼、人物、蜡笔笔触、歌词 |
| ffmpeg / ffprobe | ffmpeg 9 | 剪音频、量响度、抽帧、拼接触表、换回原曲音轨、压 720p 预览、拼确认小样、场景检测找切点 |
| librosa | 1.0.1，装在项目的 `.venv`（uv，Python 3.12） | 测 BPM、拍点、小节线、响度包络 |
| NumPy / Pillow | 在同一个 `.venv` 里 | 帧差（找静止段、重复帧）、k-means 取色、拼图、标题卡 |
| uv | Homebrew | 建项目自己的 Python 环境 |
| faster-whisper（base） | Hermes 的 venv 里 | 试过转写歌词，唱歌基本认不出字。别用它取歌词 |
| 字体 | 宋體-繁（Songti TC Bold）、圓體-繁（Yuanti TC Bold） | 纸艺版和夜城流光版用宋体，蜡笔版用圆体；PIL 脚本的标签也用圆体 |
| WebSearch / WebFetch | Claude Code 自带 | 查歌曲背景、乐评、听众的理解，写进 song.md |
| SendUserFile（Remote Control） | Claude 桌面 app | 把样图、小样、预览发到用户手机（每个文件不能超过 30 MB） |
| ditto | macOS 自带 | 复制整个项目文件夹（保留属性和符号链接） |

本机：Apple M4，16 GB。2 分钟整片：纸艺版约 3 分钟渲完；蜡笔版 30 fps 实测 2–11 分钟（布景缓存最多同时留 6 套，内存才够）。一小段（比如 4 秒）也要 1–2 分钟，因为启动 Chrome 有固定开销。

## HyperFrames

```bash
npx -y hyperframes@0.9.41 check --json        # 语法检查 + 运行时 + 版面 + 动态；看 errorCount，必须 0
#   报告存在 .hyperframes/artifacts/checks/*.json（--json 时终端里混着进度行，读那个文件）
#   正常的警告：font_face_local_only（本机字体）、canvas_content_at_edge（全屏画面本来就画到边）
npx -y hyperframes@0.9.41 validate            # 无头 Chrome 跑一遍，查 JS 报错

# 截关键帧（--no-end 不额外截最后一帧；输出 frame-<序号>-at-<秒>s.png 和 contact-sheet.jpg）
npx -y hyperframes@0.9.41 snapshot --at 3.0,16,27.6 --no-end -o renders/_kf --timeout 170000
# 截另一个页面（角色设定图）：子文件夹里要有自己的 hyperframes.json、meta.json，src/ 和 lib/ 用符号链接
npx -y hyperframes@0.9.41 snapshot tools/sheet --at 0.5 --no-end -o renders/_sheet --timeout 120000
# 两个页面同一时刻对比
npx -y hyperframes@0.9.41 compare a.html b.html --at 5.4 --labels "A,B" --cols 2 --out renders/compare.png

# 渲染（zsh 里参数写成 --opt=value；不要用 set -- $var 拆参数）
npx -y hyperframes@0.9.41 render --fps=30 --max-bitrate=16M --quiet -o renders/_master.mp4        # 整片，放后台跑
npx -y hyperframes@0.9.41 render --start=74.5 --end=82.5 --fps=30 --max-bitrate=16M --quiet -o renders/_fix/seg-b.mp4   # 只渲一段

npx -y hyperframes@0.9.41 preview             # 本地预览页（Studio）
npx -y hyperframes@0.9.41 audio assets/song.wav --only sections,onsets,moments --json   # 自带的音乐分析，可以和 librosa 对照
npx -y hyperframes@0.9.41 telemetry disable   # 关掉使用数据上报
```

数一下渲出来的帧数和帧率：

```bash
ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames,r_frame_rate:format=duration -of csv=p=0 renders/_master.mp4
```

## ffmpeg

```bash
# 从视频里无损取出音轨；剪一段，加淡入淡出，转成 44.1k 16bit wav
ffmpeg -i src.mp4 -vn -c:a copy song-full.m4a
ffmpeg -i song-full.m4a -af "atrim=start=0:end=120,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.05,afade=t=out:st=114:d=6" -ar 44100 -ac 2 -c:a pcm_s16le assets/song.wav

# 量响度（Integrated loudness，LUFS）
ffmpeg -nostats -i x.mp4 -af ebur128 -f null - 2>&1 | grep -A1 "Integrated loudness" | tail -1

# 每 N 秒一帧拼成网格（快速总览）
ffmpeg -i ref.mp4 -vf "fps=1/2,scale=533:-2,tile=3x3:padding=4:color=white" -q:v 3 sheets/s_%02d.jpg
# 连续帧（查闪烁）：第 24–35 帧，裁一块放大
ffmpeg -i part.mp4 -vf "select='between(n\,24\,35)',crop=900:420:560:440,scale=450:-2,tile=4x3" -frames:v 1 strip.jpg
# 逐帧亮度差（查"每 2 帧才换一张画"、查重复帧）
ffmpeg -i part.mp4 -vf "signalstats,metadata=print:key=lavfi.signalstats.YDIF:file=-" -an -f null - | grep YDIF

# 找切点（蜡笔、手绘画面颜色变化小，阈值用 0.12–0.25）
ffmpeg -i x.mp4 -vf "select='gt(scene,0.25)',showinfo" -an -f null - 2>&1 | grep pts_time

# 交付（deliver.sh 里就是这两条）：换回原曲；压 720p
ffmpeg -i _master.mp4 -i assets/song.wav -map 0:v -map 1:a -c:v libx264 -preset slow -b:v 10M -maxrate 14M -bufsize 20M -pix_fmt yuv420p -c:a aac -b:a 256k -shortest -movflags +faststart 成片.mp4
ffmpeg -i 成片.mp4 -vf scale=1280:-2 -c:v libx264 -preset slow -b:v 1650k -maxrate 2000k -bufsize 3300k -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart 預覽-720p.mp4
```

## librosa 和 Python 环境

```bash
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python librosa numpy pillow   # new_project.py 会做
.venv/bin/python -I script.py   # -I：不从当前目录加载同名模块
```

```python
import librosa
y, sr = librosa.load("assets/song.wav", sr=22050)
oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=256)
tempo, bf = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=256, start_bpm=80, tightness=400)
beats = librosa.frames_to_time(bf, sr=sr, hop_length=256)
# 小节线：4 个相位里，选和乐句开头平均距离最近的一个 → downbeats = beats[phase::4]
```

`data/timing.json` 的结构（`src/data/timing.js` 是它的 JS 版，代码 import 这个）：

```json
{ "source": "assets/song.wav", "duration": 120.0, "fade_out": [114.0, 120.0], "bpm": 82.0, "beat_period": 0.732,
  "beats": [0.21, 0.94, …], "downbeats": [0.94, 3.87, …],
  "phrases": [{ "phrase": 1, "line": 1, "start": 24.0, "end": 26.8, "text": "（用户给的歌词）" }, …],
  "script": "traditional" }
```

## 看视频的方法

Claude 没法直接看视频，靠的是"抽帧拼成接触表，再用 Read 看图"：

- 总览：`analyze_ref.py`（每 0.5 秒一帧）、snapshot 的 `contact-sheet.jpg`。
- 细看一段：`contact.py <视频> 75 80 0.25 out.jpg`；逐帧：间隔写 `0.0333`（30 fps）。
- 数字检查：`check_render.py`（静止段、切点、歌词、重复帧）。
- 声音没法"听"，只能量（响度、对齐）。歌词和演唱是否对得上，要请用户看片时留意。

## 发给手机

- 用 SendUserFile 发。超过 30 MB 发不过去：1080p 成片 2 分钟约 150 MB，只能在电脑上看。
- 确认小样（`review_clip.py`）和 720p 预览（`deliver.sh` 的第 4 个参数）都控制在 30 MB 以内。
- 只要 1080p 时，就不压预览，告诉用户文件在哪里（手机上收不到）。
