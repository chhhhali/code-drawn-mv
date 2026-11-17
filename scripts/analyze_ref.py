"""学风格第一步：把参考视频拆开来看（只学做法，不搬内容）。

用法（在项目根目录）：
  .venv/bin/python -I analyze_ref.py <参考视频.mp4> [--out ref] [--step 0.5]

产出：
  ref/reference.mp4            参考片副本
  ref/ref-audio.wav            参考片音轨
  ref/sheets/sheet_NN.jpg      每 0.5 秒一帧的接触表（4×4，每格标时间）——逐张用 Read 看，这是"看视频"的主要方法
  ref/full/t_<秒>.jpg          每秒一张原尺寸帧（取色、看笔触细节用；配合 palette.py）
  data/ref-analysis.json       BPM（起始值 70/90/120 各测一次）、拍点、每 0.5 秒响度、最强的起音点、切点
看完写 style.md：一句话风格、配色 HEX、角色和背景的画法、切镜头频率和镜头内运镜、转场、画面文字（字体/颜色/出现时机）、后期。
"""
import argparse, glob, json, pathlib, shutil, subprocess
import numpy as np
import librosa
from PIL import Image, ImageDraw, ImageFont


def font(size):
    for path in glob.glob("/System/Library/AssetsV2/com_apple_MobileAsset_Font*/*/AssetData/Yuanti.ttc"):
        for i in range(12):
            try:
                f = ImageFont.truetype(path, size, index=i)
            except OSError:
                break
            if "Bold" in " ".join(f.getname()):
                return f
    for p in ("/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/Hiragino Sans GB.ttc", "/System/Library/Fonts/STHeiti Medium.ttc"):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            pass
    return ImageFont.load_default()


def grab(src, t, w=None):
    vf = ["-vf", f"scale={w}:-2"] if w else []
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", src, "-frames:v", "1", *vf, "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True).stdout
    from io import BytesIO
    return Image.open(BytesIO(raw)).convert("RGB") if raw else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--out", default="ref")
    ap.add_argument("--step", type=float, default=0.5)
    a = ap.parse_args()
    out = pathlib.Path(a.out)
    (out / "sheets").mkdir(parents=True, exist_ok=True)
    (out / "full").mkdir(parents=True, exist_ok=True)
    ref = out / "reference.mp4"
    if pathlib.Path(a.video).resolve() != ref.resolve():
        shutil.copy2(a.video, ref)
    probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", str(ref)], capture_output=True, text=True).stdout)
    dur = float(probe["format"]["duration"])
    vs = next(s for s in probe["streams"] if s["codec_type"] == "video")
    print(f"参考片：{dur:.2f} s，{vs['width']}×{vs['height']}，{vs['r_frame_rate']} fps")

    # 接触表：每 step 秒一帧，16 格一张
    ts = list(np.arange(0, dur - 0.05, a.step))
    W = 480
    f = font(22)
    for k in range(0, len(ts), 16):
        chunk = ts[k:k + 16]
        tiles = [grab(str(ref), t, W) for t in chunk]
        tiles = [t for t in tiles if t]
        if not tiles:
            continue
        h = tiles[0].height
        pitch = h + 36  # 每一排：30 px 时间标签 + 画面 + 6 px 间隔
        sheet = Image.new("RGB", (4 * W + 5 * 6, ((len(tiles) + 3) // 4) * pitch + 6), (24, 22, 30))
        d = ImageDraw.Draw(sheet)
        for i, (t, im) in enumerate(zip(chunk, tiles)):
            x, y = 6 + (i % 4) * (W + 6), 6 + (i // 4) * pitch
            sheet.paste(im, (x, y + 30))
            d.text((x + 4, y + 2), f"{t:.1f}s", fill=(240, 232, 200), font=f)
        sheet.save(out / "sheets" / f"sheet_{k // 16 + 1:02d}.jpg", quality=86)
    for t in range(int(dur)):
        im = grab(str(ref), t + 0.5)
        if im:
            im.save(out / "full" / f"t_{t + 0.5:.1f}.jpg", quality=92)
    print(f"接触表：{out / 'sheets'}（{(len(ts) + 15) // 16} 张）；原尺寸帧：{out / 'full'}")

    # 音频分析
    wav = out / "ref-audio.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(ref), "-vn", "-ac", "2", "-ar", "44100", str(wav)], check=True)
    y, sr = librosa.load(str(wav), sr=22050)
    oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=256)
    res = {"duration": round(dur, 3)}
    for sb in (70, 90, 120):
        tempo, bf = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=256, start_bpm=sb, tightness=400)
        bt = librosa.frames_to_time(bf, sr=sr, hop_length=256)
        res[f"tempo_start{sb}"] = round(float(60 / np.median(np.diff(bt))) if len(bt) > 2 else float(np.atleast_1d(tempo)[0]), 2)
        res[f"beats_start{sb}"] = [round(float(b), 3) for b in bt]
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    tr = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=512)
    res["rms_db_per_half_sec"] = [round(float(20 * np.log10(rms[(tr >= s) & (tr < s + 0.5)].mean() + 1e-9)), 1) for s in np.arange(0, dur - 0.25, 0.5)]
    on = librosa.onset.onset_detect(onset_envelope=oenv, sr=sr, hop_length=256, units="time")
    if len(on):
        st = oenv[librosa.time_to_frames(on, sr=sr, hop_length=256)]
        res["top_onsets"] = sorted(round(float(on[i]), 3) for i in np.argsort(st)[::-1][:16])
    # 切点：ffmpeg 场景检测（阈值低一点，蜡笔/手绘画面切换时颜色变化不一定大）
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(ref), "-vf", "select='gt(scene,0.12)',showinfo", "-an", "-f", "null", "-"], capture_output=True, text=True)
    cuts = [round(float(s.split("pts_time:")[1].split()[0]), 3) for s in r.stderr.splitlines() if "pts_time:" in s]
    # 快切、速度线、闪光会在 0.3 秒内连报好几个"切点"，合并成一个
    merged = []
    for c in cuts:
        if not merged or c - merged[-1] > 0.3:
            merged.append(c)
    res["cuts_raw"] = cuts
    res["cuts"] = merged
    pathlib.Path("data").mkdir(exist_ok=True)
    pathlib.Path("data/ref-analysis.json").write_text(json.dumps(res, ensure_ascii=False, indent=1))
    print("BPM（起始 70/90/120）：", res["tempo_start70"], res["tempo_start90"], res["tempo_start120"], "——慢歌常被测成两倍，和接触表里的动作节奏对一下")
    if len(merged) > 1:
        gaps = np.diff([0] + merged + [dur])
        print(f"切点 {len(merged)} 个（原始检测 {len(cuts)} 个，0.3 s 内的已合并），镜头平均 {gaps.mean():.2f} s（最短 {gaps.min():.2f}，最长 {gaps.max():.2f}）：{merged}")
    else:
        print("切点：", merged or "没检测到（可能是一镜到底，或者转场很柔，逐张看接触表确认）")
    print("已写入 data/ref-analysis.json")


if __name__ == "__main__":
    main()
