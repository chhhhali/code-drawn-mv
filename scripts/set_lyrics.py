"""把用户给的歌词写进 data/timing.json，并生成 src/data/timing.js 和 lyrics.srt。

歌词只从用户给的文件读。不要自己转写或背诵歌词，也不要在聊天里大段复述；这个脚本只打印数量和时间，不打印歌词原文。

支持三种输入：
  1) .srt  每条字幕 = 一个乐句（带起止时间）。
  2) .lrc  [mm:ss.xx]歌词；结束时间 = 下一句开始前 0.15 秒（最后一句 +3 秒）。
  3) .txt / .tsv  每行「行号<TAB>乐句」或「行号<TAB>开始秒<TAB>结束秒<TAB>乐句」。
     只有文字、没有时间时，按顺序套用 timing.json 里已有乐句的时间（数量要一样）。
「行号」= 第几行歌词（一行可以有一两个乐句，画面上上下两排）。SRT / LRC 里在文字前写「3|」就归到第 3 行；
不写的话每条单独算一行。

用法（在项目根目录）：
  python3 set_lyrics.py lyrics.srt [--timing data/timing.json] [--script traditional|simplified] [--offset 0]
  --offset：歌词时间整体平移（秒）。歌曲剪过开头时，用负数把原曲时间换成片段内时间。
"""
import argparse, json, pathlib, re, sys

LINE_MARK = re.compile(r"^\s*(\d+)\s*\|\s*(.*)$")


def ts(t):
    ms = int(round(max(0.0, t) * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def parse_srt_time(s):
    h, m, rest = s.strip().replace(".", ",").split(":")
    sec, ms = rest.split(",")
    return int(h) * 3600 + int(m) * 60 + int(sec) + int(ms) / 1000


def split_line(text, fallback):
    m = LINE_MARK.match(text)
    return (int(m.group(1)), m.group(2).strip()) if m else (fallback, text.strip())


def read_srt(p):
    items = []
    for block in re.split(r"\n\s*\n", p.read_text(encoding="utf-8-sig").strip()):
        rows = [r for r in block.splitlines() if r.strip()]
        tl = next((i for i, r in enumerate(rows) if "-->" in r), None)
        if tl is None:
            continue
        a, b = rows[tl].split("-->")
        text = " ".join(rows[tl + 1:]).strip()
        if text:
            items.append([parse_srt_time(a), parse_srt_time(b.split()[0]), text])
    return items


def read_lrc(p):
    rows = []
    for raw in p.read_text(encoding="utf-8-sig").splitlines():
        stamps = re.findall(r"\[(\d+):(\d+(?:\.\d+)?)\]", raw)
        text = re.sub(r"\[[^\]]*\]", "", raw).strip()
        if not stamps or not text:
            continue
        for mm, ss in stamps:
            rows.append([int(mm) * 60 + float(ss), None, text])
    rows.sort(key=lambda r: r[0])
    for i, r in enumerate(rows):
        r[1] = rows[i + 1][0] - 0.15 if i + 1 < len(rows) else r[0] + 3.0
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lyrics")
    ap.add_argument("--timing", default="data/timing.json")
    ap.add_argument("--js", default="src/data/timing.js")
    ap.add_argument("--srt", default="lyrics.srt")
    ap.add_argument("--script", choices=["traditional", "simplified"], default=None)
    ap.add_argument("--offset", type=float, default=0.0)
    a = ap.parse_args()

    src = pathlib.Path(a.lyrics)
    tj = pathlib.Path(a.timing)
    t = json.loads(tj.read_text()) if tj.exists() else {}
    old = [] if t.get("demo") else t.get("phrases", [])
    ext = src.suffix.lower()

    phrases = []
    if ext in (".srt", ".lrc"):
        rows = read_srt(src) if ext == ".srt" else read_lrc(src)
        for i, (start, end, text) in enumerate(rows):
            line, text = split_line(text, i + 1)
            phrases.append({"line": line, "start": start + a.offset, "end": end + a.offset, "text": text})
    else:
        rows = [r for r in src.read_text(encoding="utf-8-sig").splitlines() if r.strip()]
        timed = all(len(r.split("\t")) >= 4 for r in rows)
        if not timed and len(rows) != len(old):
            sys.exit(f"歌词有 {len(rows)} 个乐句，timing.json 里已有 {len(old)} 个：数量不一样，没法套用时间。给带时间的 SRT/LRC/TSV。")
        for i, r in enumerate(rows):
            cols = r.split("\t")
            if timed:
                phrases.append({"line": int(cols[0]), "start": float(cols[1]) + a.offset, "end": float(cols[2]) + a.offset, "text": cols[3].strip()})
            else:
                line = int(cols[0]) if len(cols) > 1 else old[i]["line"]
                phrases.append({"line": line, "start": old[i]["start"], "end": old[i]["end"], "text": cols[-1].strip()})

    phrases.sort(key=lambda p: p["start"])
    for i, p in enumerate(phrases, 1):
        p["phrase"] = i
        p["start"] = round(p["start"], 3)
        p["end"] = round(p["end"], 3)
    phrases = [{k: p[k] for k in ("phrase", "line", "start", "end", "text")} for p in phrases]

    t["phrases"] = phrases
    t.pop("demo", None)
    if a.script:
        t["script"] = a.script
    tj.parent.mkdir(parents=True, exist_ok=True)
    tj.write_text(json.dumps(t, ensure_ascii=False, indent=1))
    js = pathlib.Path(a.js)
    js.parent.mkdir(parents=True, exist_ok=True)
    js.write_text("// 由 data/timing.json 生成：拍点、小节线、乐句时间（秒，从歌曲开头算）\nexport default " + json.dumps(t, ensure_ascii=False) + ";\n")
    pathlib.Path(a.srt).write_text("\n".join(f"{p['phrase']}\n{ts(p['start'])} --> {ts(p['end'])}\n{p['text']}\n" for p in phrases), encoding="utf-8")

    lines = sorted({p["line"] for p in phrases})
    print(f"写入 {len(phrases)} 个乐句、{len(lines)} 行 → {tj}、{js}、{a.srt}")
    for n in lines:
        ps = [p for p in phrases if p["line"] == n]
        print(f"  第 {n:>2} 行：{len(ps)} 个乐句，" + "；".join(f"{p['start']:.2f}–{p['end']:.2f} s（{len(p['text'])} 字）" for p in ps))
    dur = t.get("duration")
    late = [p["phrase"] for p in phrases if dur and p["end"] > dur]
    if late:
        print(f"注意：第 {late} 个乐句结束时间超过了歌曲长度 {dur} s，检查 --offset。")


if __name__ == "__main__":
    main()
