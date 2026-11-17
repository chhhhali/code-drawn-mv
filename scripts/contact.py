"""接触表：从视频里按时间抽帧，拼成一张带时间标签的图——自己"看"视频、找用户说的问题，主要靠它。

用法：
  .venv/bin/python -I contact.py <视频> <开始秒> <结束秒> <间隔秒> <out.jpg> [列数=6] [每格宽=420] [fps=30]
例：用户说"1:05–1:06 过程有错" → 先粗看，再细看：
  .venv/bin/python -I contact.py renders/_master.mp4 63 68 0.25 renders/_notes/a.jpg
  .venv/bin/python -I contact.py renders/_master.mp4 65 66 0.0333 renders/_notes/b.jpg 6 420 30   # 逐帧
标签写成「1:05.03（65.03）」，和用户报的时间点对得上。取每帧的中间时刻，避免落在两帧交界上。
"""
import glob, subprocess, sys
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


def frame(src, t, w):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", f"{t:.4f}", "-i", src, "-frames:v", "1", "-vf", f"scale={w}:-2", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True,
    ).stdout
    h = len(raw) // (w * 3)
    return Image.frombytes("RGB", (w, h), raw) if h else None


def main():
    if len(sys.argv) < 6:
        sys.exit(__doc__)
    src, a, b, step, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
    cols = int(sys.argv[6]) if len(sys.argv) > 6 else 6
    w = int(sys.argv[7]) if len(sys.argv) > 7 else 420
    fps = float(sys.argv[8]) if len(sys.argv) > 8 else 30
    ts, t = [], a
    while t <= b + 1e-6:
        ts.append(round(round(t * fps) / fps + 0.5 / fps, 4))
        t += step
    pairs = [(t, im) for t in ts if (im := frame(src, t, w))]
    if not pairs:
        sys.exit("一帧都没抽到：检查时间范围和视频路径")
    h = pairs[0][1].height
    lab = 34
    rows = (len(pairs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w + (cols + 1) * 6, rows * (h + lab) + (rows + 1) * 6), (24, 22, 30))
    d = ImageDraw.Draw(sheet)
    f = font(22)
    for i, (t, im) in enumerate(pairs):
        x = 6 + (i % cols) * (w + 6)
        y = 6 + (i // cols) * (h + lab + 6)
        sheet.paste(im, (x, y + lab))
        tt = t - 0.5 / fps
        d.text((x + 4, y + 4), f"{int(tt // 60)}:{tt % 60:05.2f}（{tt:.2f}）", fill=(240, 232, 200), font=f)
    sheet.save(out, quality=88)
    print(out, len(pairs), "frames")


if __name__ == "__main__":
    main()
