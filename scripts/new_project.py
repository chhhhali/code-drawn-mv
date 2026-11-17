#!/usr/bin/env python3
"""从模板建一个新的 MV 项目（蜡笔绘本版 / 纸艺立体书版 / 夜城流光版 / 像素光影版）。

用法：
  python3 new_project.py <项目文件夹> --style crayon|paper|nightcity|pixel [--song 歌曲文件] [--title 片名] [--no-venv] [--no-libs]

做的事：
  1. 复制 assets/<style>/ 的模板（index.html、src/、data/，有的话还有 tools/ 下的工具页：角色设定图、分层拆解、时段对比）
  2. 写 package.json（锁定 hyperframes@0.9.41）、hyperframes.json、meta.json
  3. 用 npm 临时装 gsap@3.15.0（纸艺版再加 three@0.187.0），把浏览器要用的文件复制进 lib/（渲染时不联网）
  4. 给了 --song：用 ffmpeg 转成 assets/song.wav（44.1 kHz 立体声 16 bit），按歌曲长度改 index.html 的 data-duration
  5. 建 .venv（uv，Python 3.12）并装 librosa / numpy / pillow：测节拍和所有检查脚本都用它
只依赖 Python 标准库；需要 node/npm、ffmpeg/ffprobe、uv 在 PATH 里。
"""
import argparse, json, pathlib, re, shutil, subprocess, sys, tempfile, datetime

SKILL = pathlib.Path(__file__).resolve().parent.parent
HF = "hyperframes@0.9.41"
LIBS = {"crayon": ["gsap@3.15.0"], "paper": ["gsap@3.15.0", "three@0.187.0"], "nightcity": ["gsap@3.15.0"], "pixel": ["gsap@3.15.0"]}

HYPERFRAMES_JSON = {
    "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
    "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
    "paths": {"blocks": "compositions", "components": "compositions/components", "assets": "assets"},
    "media": {"autoProxy": True},
    "authoringSkill": "hyperframes",
}


def run(*cmd, cwd=None):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"命令失败：{' '.join(map(str, cmd))}\n{r.stderr[-2000:]}")
    return r.stdout


def slug(name):
    s = re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")
    return s or "mv"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dir", help="新项目文件夹（不存在会新建；已存在且非空会停下）")
    ap.add_argument("--style", choices=sorted(LIBS), required=True)
    ap.add_argument("--song", help="歌曲文件（mp3/m4a/flac/wav…），会转成 assets/song.wav")
    ap.add_argument("--title", default="", help="片名（纸艺版印在书的封面上）")
    ap.add_argument("--no-venv", action="store_true", help="不建 Python 环境")
    ap.add_argument("--no-libs", action="store_true", help="不装 gsap/three（之后自己放进 lib/）")
    a = ap.parse_args()

    dst = pathlib.Path(a.dir).expanduser().resolve()
    if dst.exists() and any(dst.iterdir()):
        sys.exit(f"{dst} 已经存在而且不是空的；换一个文件夹，或者先确认里面的东西可以覆盖。")
    src = SKILL / "assets" / a.style
    shutil.copytree(src, dst, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".DS_Store"))
    for d in ("assets", "renders", "lib"):
        (dst / d).mkdir(exist_ok=True)

    name = slug(dst.name if dst.name.isascii() else f"{a.style}-mv")
    deps = {p.split("@")[0]: p.split("@")[1] for p in LIBS[a.style]}
    (dst / "package.json").write_text(json.dumps({
        "name": name, "private": True, "type": "module",
        "scripts": {"dev": f"npx --yes {HF} preview", "check": f"npx --yes {HF} check", "render": f"npx --yes {HF} render"},
        "dependencies": deps,
    }, indent=2) + "\n")
    (dst / "hyperframes.json").write_text(json.dumps(HYPERFRAMES_JSON, indent=2) + "\n")
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    (dst / "meta.json").write_text(json.dumps({"id": name, "name": name, "createdAt": now}, indent=2) + "\n")

    # 工具页（tools/sheet 角色设定图、tools/layers 分层拆解、tools/times 时段对比）：各是一个小合成，通过符号链接共用 src/ 和 lib/
    tools = dst / "tools"
    for page in sorted(tools.iterdir()) if tools.exists() else []:
        if not (page / "index.html").exists():
            continue
        (page / "hyperframes.json").write_text(json.dumps(HYPERFRAMES_JSON, indent=2) + "\n")
        (page / "meta.json").write_text(json.dumps({"id": f"{name}-{page.name}", "name": f"{name}-{page.name}", "createdAt": now}, indent=2) + "\n")
        for link in ("src", "lib"):
            p = page / link
            if not p.exists():
                p.symlink_to(f"../../{link}")

    # 浏览器用的库：装在临时目录，只把要用的文件复制进 lib/
    if not a.no_libs:
        with tempfile.TemporaryDirectory() as tmp:
            run("npm", "install", "--no-audit", "--no-fund", "--prefix", tmp, *LIBS[a.style])
            nm = pathlib.Path(tmp) / "node_modules"
            (dst / "lib/gsap").mkdir(parents=True, exist_ok=True)
            shutil.copy2(nm / "gsap/dist/gsap.min.js", dst / "lib/gsap/gsap.min.js")
            if a.style == "paper":
                t3 = dst / "lib/three"
                t3.mkdir(parents=True, exist_ok=True)
                for f in ("three.module.js", "three.core.js"):
                    shutil.copy2(nm / "three/build" / f, t3 / f)
                shutil.copytree(nm / "three/examples/jsm", t3 / "addons", dirs_exist_ok=True)

    # 歌曲
    if a.song:
        song = pathlib.Path(a.song).expanduser().resolve()
        out = dst / "assets/song.wav"
        run("ffmpeg", "-y", "-v", "error", "-i", str(song), "-vn", "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le", str(out))
        dur = float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)).strip())
        dur = round(dur, 2)
        html = (dst / "index.html").read_text()
        html = re.sub(r'data-duration="[0-9.]+"', f'data-duration="{dur}"', html)
        (dst / "index.html").write_text(html)
        tj = dst / "data/timing.json"
        t = json.loads(tj.read_text())
        t["duration"] = dur
        t["fade_out"] = [round(dur - 1.5, 2), dur]
        tj.write_text(json.dumps(t, ensure_ascii=False, indent=1))
        (dst / "src/data/timing.js").write_text("// 由 data/timing.json 生成：拍点、小节线、乐句时间（秒）\nexport default " + json.dumps(t, ensure_ascii=False) + ";\n")
        print(f"歌曲：assets/song.wav，{dur} 秒（示例时间轴还是占位的，跑完 beats.py 和 set_lyrics.py 才是真的）")

    if a.title and a.style == "paper":
        m = dst / "src/main.js"
        m.write_text(m.read_text().replace('const COVER = { title: "片名", subtitle: "" };', f'const COVER = {{ title: {json.dumps(a.title, ensure_ascii=False)}, subtitle: "" }};'))

    if not a.no_venv:
        run("uv", "venv", "--python", "3.12", str(dst / ".venv"))
        run("uv", "pip", "install", "--python", str(dst / ".venv/bin/python"), "librosa", "numpy", "pillow")

    print(f"项目建好了：{dst}（{a.style}）")
    print("下一步：")
    print(f"  cd {dst}")
    print(f"  npx --yes {HF} check            # 0 个 error 才往下走（font_face_local_only 警告本机渲染可以忽略）")
    print(f"  npx --yes {HF} snapshot --at 3,10 --no-end -o renders/_kf --timeout 170000")
    print(f"  .venv/bin/python -I {SKILL}/scripts/beats.py assets/song.wav --start-bpm 80   # 测节拍，写 data/timing.json")


if __name__ == "__main__":
    main()
