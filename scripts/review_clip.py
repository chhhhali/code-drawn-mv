"""改片确认小样：每段前面放一张 1.2 秒的标题卡（时间点 + 改了什么），段落换回原曲音轨，拼成一条 720p、手机能收的短片。
用户按时间点提意见 → 修 → 只渲受影响的片段 → 用这个拼成一条发给用户确认 → 用户说"重渲整片"再出整片。

用法（在项目根目录）：
  .venv/bin/python -I review_clip.py <out.mp4> [--song assets/song.wav] [--tmp renders/_review] \\
      <片段.mp4> <片段在整片里的开始秒> <标题> <副标题> [<片段.mp4> <开始秒> <标题> <副标题> ...]
例：
  npx -y hyperframes@0.9.41 render --start=62.5 --end=70.5 --fps=30 --max-bitrate=16M --quiet -o renders/_fix/seg-b.mp4
  .venv/bin/python -I review_clip.py "renders/修改確認-1.mp4" renders/_fix/seg-b.mp4 62.5 "1:05–1:06" "动作接上上一镜"
（zsh 里不要用 set -- $seg 拆参数，它不会按空格拆；直接写 --start=… --end=…）
"""
import glob, pathlib, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1280, 720, 30


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


def card(path, title, sub):
    im = Image.new("RGB", (W, H), (23, 24, 63))
    d = ImageDraw.Draw(im)
    for text, f, y, fill in ((title, font(76), 300, (242, 208, 106)), (sub, font(40), 410, (247, 242, 234))):
        w = d.textlength(text, font=f)
        d.text(((W - w) / 2, y), text, font=f, fill=fill, stroke_width=4, stroke_fill=(35, 33, 70))
    im.save(path)


def run(*a):
    r = subprocess.run(a, capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[-1500:])


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    out = args.pop(0)
    song, tmpdir = "assets/song.wav", "renders/_review"
    while args and args[0].startswith("--"):
        k = args.pop(0)
        if k == "--song":
            song = args.pop(0)
        elif k == "--tmp":
            tmpdir = args.pop(0)
    if not args or len(args) % 4:
        sys.exit("片段参数要四个一组：<片段.mp4> <开始秒> <标题> <副标题>")
    pathlib.Path(tmpdir).mkdir(parents=True, exist_ok=True)
    tmp = pathlib.Path(tempfile.mkdtemp(dir=tmpdir))
    parts = []
    for i in range(0, len(args), 4):
        seg, start, title, sub = args[i], float(args[i + 1]), args[i + 2], args[i + 3]
        png = tmp / f"card{i}.png"
        card(png, title, sub)
        c = tmp / f"card{i}.mp4"
        run("ffmpeg", "-y", "-loop", "1", "-t", "1.2", "-i", str(png), "-f", "lavfi", "-t", "1.2", "-i", "anullsrc=r=48000:cl=stereo",
            "-vf", f"fps={FPS},format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "128k", "-shortest", str(c))
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", seg], capture_output=True, text=True).stdout)
        v = tmp / f"seg{i}.mp4"
        run("ffmpeg", "-y", "-i", seg, "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", song, "-map", "0:v", "-map", "1:a",
            "-vf", f"scale={W}:{H},fps={FPS},format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-b:v", "2400k", "-maxrate", "3000k", "-bufsize", "4800k",
            "-af", "aresample=48000", "-ac", "2", "-c:a", "aac", "-b:a", "128k", "-shortest", str(v))
        parts += [c, v]
    lst = tmp / "list.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in parts))
    run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c:v", "libx264", "-preset", "medium", "-b:v", "2400k", "-maxrate", "3000k", "-bufsize", "4800k",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out)
    size = pathlib.Path(out).stat().st_size / 1e6
    print(f"{out}  {size:.1f} MB" + ("（超过 30 MB，手机收不到：少放几段或缩短片段）" if size > 30 else ""))


if __name__ == "__main__":
    main()
