"""第 5 步「先出草图」：把每个镜头的关键帧拼成一张分镜总览 storyboard.png，用户确认后再渲整片。

先截关键帧（每个镜头至少一张，取动作最清楚的时刻）：
  npx -y hyperframes@0.9.41 snapshot --at 5.0,12.6,20.5,... --no-end -o renders/_sb --timeout 170000
再拼图：
  .venv/bin/python -I storyboard_sheet.py renders/_sb renders/storyboard.png --captions storyboard-captions.txt --title "《片名》分鏡總覽"
captions.txt：每行一条说明，顺序和关键帧一致，例如「1a 0:25 a 抬头看月亮」。蓝标 = 现在，红标 = 回忆/幻想：
在说明前面写「[回憶]」或「[幻想]」就画红标。关键帧按文件名里的序号排（snapshot 输出 frame-<序号>-at-<秒>s.png）。
"""
import argparse, glob, pathlib, re
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
    for p in ("/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/Hiragino Sans GB.ttc"):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            pass
    return ImageFont.load_default()


def order(p):
    m = re.search(r"frame-(\d+)", p.name)
    return (int(m.group(1)) if m else 10**9, p.name)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("frames_dir")
    ap.add_argument("out")
    ap.add_argument("--captions")
    ap.add_argument("--title", default="分鏡總覽")
    ap.add_argument("--cols", type=int, default=4)
    a = ap.parse_args()
    files = sorted([p for p in pathlib.Path(a.frames_dir).iterdir() if p.suffix.lower() in (".png", ".jpg") and p.name.startswith("frame-")], key=order)
    if not files:
        raise SystemExit("文件夹里没有 frame-*.png")
    caps = [c.strip() for c in pathlib.Path(a.captions).read_text(encoding="utf-8").splitlines() if c.strip()] if a.captions else []
    TW, TH, CH, PAD, COLS = 450, 253, 46, 16, a.cols
    rows = (len(files) + COLS - 1) // COLS
    W = COLS * TW + (COLS + 1) * PAD
    H = 110 + rows * (TH + CH + PAD) + PAD
    sheet = Image.new("RGB", (W, H), (240, 232, 214))
    d = ImageDraw.Draw(sheet)
    d.text((PAD + 8, 30), a.title, font=font(44), fill=(58, 45, 41))
    f = font(24)
    for i, p in enumerate(files):
        x = PAD + (i % COLS) * (TW + PAD)
        y = 110 + (i // COLS) * (TH + CH + PAD)
        sheet.paste(Image.open(p).convert("RGB").resize((TW, TH), Image.LANCZOS), (x, y))
        cap = caps[i] if i < len(caps) else p.stem
        memory = cap.startswith("[回憶]") or cap.startswith("[回忆]") or cap.startswith("[幻想]")
        cap = re.sub(r"^\[(回憶|回忆|幻想)\]\s*", "", cap)
        d.rectangle((x, y + TH + 8, x + 8, y + TH + 36), fill=(196, 74, 63) if memory else (58, 84, 150))
        d.text((x + 16, y + TH + 10), cap, font=f, fill=(58, 45, 41))
    sheet.save(a.out)
    print("saved", a.out, sheet.size, len(files), "frames")


if __name__ == "__main__":
    main()
