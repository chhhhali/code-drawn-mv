#!/usr/bin/env python3
"""把逐字时间表（lyric-scene-mv 的 song_timing.py 出的 逐字时间.json）转成 src/data/words.js，镜头代码里这样用：

  import words from "./data/words.js";
  import { makeCues, hit, settle } from "./cues.js";
  const C = makeCues(words);        // C.at(行号, 字序) 就是那个字开唱的整片时间

用法（项目根目录）：
  python3 words_to_js.py 逐字时间.json [--out src/data/words.js] [--offset 0]
--offset：项目音频是从整首歌中间截的一段时，减掉截取的起点（和 data/timing.json 的 clip_offset_in_song 一致）。
歌词文本不写进 words.js，只留时间和字数；只用标准库。
"""
import argparse, json, pathlib, sys


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sheet")
    ap.add_argument("--out", default="src/data/words.js")
    ap.add_argument("--offset", type=float, default=0.0)
    a = ap.parse_args()
    d = json.loads(pathlib.Path(a.sheet).read_text(encoding="utf-8"))
    if not isinstance(d.get("lines"), list):
        sys.exit(f"{a.sheet} 不像逐字时间表（没有 lines）")
    o = a.offset
    lines = [{
        "line": L["line"], "start": round(L["start"] - o, 3), "end": round(L["end"] - o, 3), "cut": round(L.get("cut", L["start"]) - o, 3),
        "echo_of": L.get("echo_of"), "chars": [{"i": c["i"], "t": round(c["t"] - o, 3)} for c in L["chars"]],
    } for L in d["lines"]]
    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("// 由 逐字时间.json 生成（scripts/words_to_js.py）：每行的起止、建议切点、每个字开唱的时间（秒）\nexport default "
                   + json.dumps({"format": d.get("format"), "lines": lines}, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"写好了 {out}：{len(lines)} 行，{sum(len(L['chars']) for L in lines)} 个字")


if __name__ == "__main__":
    main()
