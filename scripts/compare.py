"""对比图：最多 4 张图拼成 2×2，每张左上角加标签。给用户看 A/B 方案、新旧版本、和参考片同一段落的对比。
（只用文字解释方案用户看不懂；渲出对比图一看就明白，比如"舞台方式 A/B"、"旧版 / 新版 / 参考片同一段落"。）

用法：
  .venv/bin/python -I compare.py <out.jpg> <图1> <标签1> [<图2> <标签2> ...]
HyperFrames 也能直接对比两个页面的同一时刻：npx hyperframes compare a.html b.html --at 5.4 --labels "A,B" --cols 2 --out renders/compare.png
"""
import glob, sys
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


def main():
    if len(sys.argv) < 4 or len(sys.argv) % 2:
        sys.exit(__doc__)
    out, *rest = sys.argv[1:]
    pairs = list(zip(rest[0::2], rest[1::2]))[:4]
    W, H = 960, 540
    cols = 1 if len(pairs) == 1 else 2
    rows = (len(pairs) + 1) // 2
    sheet = Image.new("RGB", (W * cols + 12 * (cols - 1), H * rows + 12 * (rows - 1)), (20, 18, 30))
    f = font(36)
    for k, (img, label) in enumerate(pairs):
        im = Image.open(img).convert("RGB").resize((W, H), Image.LANCZOS)
        d = ImageDraw.Draw(im, "RGBA")
        tw = d.textlength(label, font=f)
        d.rounded_rectangle((14, 14, 14 + tw + 32, 70), radius=12, fill=(20, 16, 36, 170))
        d.text((30, 20), label, font=f, fill=(250, 244, 230))
        sheet.paste(im, ((k % 2) * (W + 12), (k // 2) * (H + 12)))
    sheet.save(out, quality=92)
    print("saved", out)


if __name__ == "__main__":
    main()
