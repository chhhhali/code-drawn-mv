"""成片自查（第 6 步，给用户看之前先自己查一遍）：
  1. 静止段：每 0.5 秒抽一帧，相邻帧差太小、连续 2 秒以上 → 列出来（"像幻灯片"）
  2. 切点：ffmpeg 场景检测的切点，和分镜表的切点对一下（颜色相近的两镜可能漏报，要逐帧看）
  3. 歌词：每个乐句开唱后 0.3 秒截歌词那一块，拼成一张图，人工看字有没有出现、有没有开始刷色
  4. --pairs：逐帧比较，数"和上一帧一模一样"的帧（30 fps 逐帧连续时，只有切点后一两帧会这样）

用法（在项目根目录）：
  .venv/bin/python -I check_render.py renders/_master.mp4 [--timing data/timing.json] [--boxes data/lyric_boxes.json] [--out renders/_check] [--pairs]
--boxes：每行歌词在画面上的范围 {"1": [x, y, w, h], "2": [...]}（1920×1080 坐标）。不给就截整个画面上半部分。
"""
import argparse, json, pathlib, subprocess
import numpy as np
from PIL import Image, ImageDraw


def probe(src):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate:format=duration", "-of", "json", src], capture_output=True, text=True).stdout
    d = json.loads(out)
    s = d["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return float(d["format"]["duration"]), int(s["width"]), int(s["height"]), float(num) / float(den)


def frame_at(src, t, w=None):
    vf = ["-vf", f"scale={w}:-2"] if w else []
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", src, "-frames:v", "1", *vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    return raw


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--timing", default="data/timing.json")
    ap.add_argument("--boxes", default=None)
    ap.add_argument("--out", default="renders/_check")
    ap.add_argument("--pairs", action="store_true")
    a = ap.parse_args()
    src = a.video
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    dur, VW, VH, fps = probe(src)
    print(f"{src}: {dur:.2f} s, {VW}×{VH}, {fps:.2f} fps")

    # 1) 静止段
    w = 480
    ts = np.arange(0.25, dur - 0.3, 0.5)
    frames = []
    for t in ts:
        raw = frame_at(src, t, w)
        h = len(raw) // (w * 3)
        frames.append(np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(np.int16))
    diffs = [float(np.abs(frames[i + 1] - frames[i]).mean()) for i in range(len(frames) - 1)]
    still, run = [], []
    for t, d in zip(ts[1:], diffs):
        if d < 1.2:
            run.append(t)
        else:
            if len(run) >= 4:
                still.append((round(run[0] - 0.5, 2), round(run[-1], 2)))
            run = []
    if len(run) >= 4:
        still.append((round(run[0] - 0.5, 2), round(run[-1], 2)))
    print("静止段（相邻 0.5 s 帧差 < 1.2，持续 ≥ 2 s）：", still or "无")

    # 2) 切点
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-vf", "select='gt(scene,0.25)',showinfo", "-an", "-f", "null", "-"], capture_output=True, text=True)
    cuts = [round(float(s.split("pts_time:")[1].split()[0]), 2) for s in r.stderr.splitlines() if "pts_time:" in s]
    print("检测到的切点：", cuts)

    # 3) 歌词截图
    tj = pathlib.Path(a.timing)
    if tj.exists():
        timing = json.loads(tj.read_text())
        boxes = json.loads(pathlib.Path(a.boxes).read_text()) if a.boxes else {}
        tiles = []
        for i, p in enumerate(timing.get("phrases", [])):
            t = p["start"] + 0.3
            if t >= dur:
                continue
            raw = frame_at(src, t)
            im = Image.frombytes("RGB", (VW, VH), raw)
            bx = boxes.get(str(p["line"]))
            crop = im.crop((bx[0], bx[1], bx[0] + bx[2], bx[1] + bx[3])) if bx else im.crop((0, 0, VW, VH // 2))
            crop.thumbnail((640, 160))
            tile = Image.new("RGB", (760, 170), (30, 28, 40))
            tile.paste(crop, (112, 5))
            ImageDraw.Draw(tile).text((6, 70), f"#{i + 1} L{p['line']}\n{p['start']:.1f}s", fill=(240, 230, 200))
            tiles.append(tile)
        if tiles:
            cols = 2
            rows = (len(tiles) + cols - 1) // cols
            sheet = Image.new("RGB", (760 * cols, 170 * rows), (20, 18, 30))
            for i, tl in enumerate(tiles):
                sheet.paste(tl, ((i % cols) * 760, (i // cols) * 170))
            sheet.save(out / "lyrics-at-phrase-start.jpg", quality=88)
            print("歌词截图（每句开唱后 0.3 s）：", out / "lyrics-at-phrase-start.jpg", f"{len(tiles)} 句")
    else:
        print(f"没有 {tj}，跳过歌词检查")

    # 4) 逐帧：和上一帧一模一样的帧
    if a.pairs:
        sw, sh = 160, 90
        proc = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-vf", f"scale={sw}:{sh}", "-f", "rawvideo", "-pix_fmt", "gray", "-"], stdout=subprocess.PIPE)
        prev, n, same = None, 0, []
        while True:
            buf = proc.stdout.read(sw * sh)
            if len(buf) < sw * sh:
                break
            cur = np.frombuffer(buf, np.uint8).astype(np.int16)
            if prev is not None and np.abs(cur - prev).max() == 0:
                same.append(round(n / fps, 3))
            prev, n = cur, n + 1
        proc.wait()
        print(f"逐帧：共 {n} 帧；和上一帧完全一样的 {len(same)} 帧", (same[:30] if same else ""))


if __name__ == "__main__":
    main()
