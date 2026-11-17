"""第 1 步「理解音乐」：测 BPM、拍点、小节线，写进 data/timing.json，并生成 src/data/timing.js。

用法（在项目根目录）：
  .venv/bin/python -I beats.py assets/song.wav [--start-bpm 80] [--timing data/timing.json] [--fade-out 114.3]

- 慢歌一定要给一个大概的 --start-bpm：librosa 默认常把八分音符当成拍，测出两倍（实际 80 BPM 左右的慢歌，默认可能测出 150 多）。
- 小节线（downbeats）：在 4 个相位里挑一个。timing.json 里已有真实乐句时，挑和乐句开头平均距离最近的；
  没有乐句时，挑拍点上起音最强的。很多乐句是弱起，打印出来以后要人工核对一下。
- 已有的 phrases 会保留；模板自带的示例乐句（demo）会清掉，等 set_lyrics.py 写入真歌词。
- 最后按小节打印响度，用来判断主歌 / 副歌 / 间奏在哪（副歌一般会明显变响），写进 song.md。
  也可以用 HyperFrames 自带的分析对照：npx hyperframes audio assets/song.wav --only sections,onsets,moments --json
"""
import argparse, json, pathlib
import numpy as np
import librosa


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("song")
    ap.add_argument("--start-bpm", type=float, default=90)
    ap.add_argument("--timing", default="data/timing.json")
    ap.add_argument("--js", default="src/data/timing.js")
    ap.add_argument("--fade-out", type=float, default=None, help="淡出开始的秒数（剪过的片段才有）")
    a = ap.parse_args()

    y, sr = librosa.load(a.song, sr=22050)
    dur = round(len(y) / sr, 3)
    hop = 256
    oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    tempo, bf = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=hop, start_bpm=a.start_bpm, tightness=400)
    beats = librosa.frames_to_time(bf, sr=sr, hop_length=hop)
    period = float(np.median(np.diff(beats)))
    bpm = 60 / period

    tj = pathlib.Path(a.timing)
    t = json.loads(tj.read_text()) if tj.exists() else {}
    if t.get("demo"):
        t["phrases"] = []
        t.pop("demo", None)
    phrases = t.get("phrases", [])

    if phrases:
        starts = np.array([p["start"] for p in phrases])
        score = [np.mean([np.min(np.abs(beats[ph::4] - s)) for s in starts]) for ph in range(4)]
        phase = int(np.argmin(score))
        how = "和乐句开头最近"
    else:
        score = [float(np.mean(oenv[bf[ph::4]])) for ph in range(4)]
        phase = int(np.argmax(score))
        how = "拍点上起音最强"
    downbeats = beats[phase::4]

    t.update({
        "source": a.song,
        "clip_offset_in_song": t.get("clip_offset_in_song", 0.0),
        "duration": dur,
        "bpm": round(bpm, 2),
        "beat_period": round(period, 3),
        "beats": [round(float(b), 3) for b in beats],
        "downbeats": [round(float(b), 3) for b in downbeats],
        "phrases": phrases,
    })
    if a.fade_out is not None:
        t["fade_out"] = [a.fade_out, dur]
    tj.parent.mkdir(parents=True, exist_ok=True)
    tj.write_text(json.dumps(t, ensure_ascii=False, indent=1))
    js = pathlib.Path(a.js)
    js.parent.mkdir(parents=True, exist_ok=True)
    js.write_text("// 由 data/timing.json 生成：拍点、小节线、乐句时间（秒，从歌曲开头算）\nexport default " + json.dumps(t, ensure_ascii=False) + ";\n")

    print(f"时长 {dur} s；{bpm:.1f} BPM（一拍 {period:.3f} s，一小节约 {period * 4:.2f} s）；{len(beats)} 个拍点")
    print(f"小节线相位 {phase}（{how}）；前几个小节线：{[round(float(b), 2) for b in downbeats[:8]]}")
    if bpm > 125 or bpm < 55:
        print("注意：BPM 看起来可能是两倍或一半，换一个 --start-bpm 再测一次，和你听到的拍子对一下。")
    # 每小节响度：找段落
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    tr = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=512)
    edges = list(downbeats) + [dur]
    print("\n小节  起点(s)  响度(dB)")
    for i in range(len(edges) - 1):
        m = (tr >= edges[i]) & (tr < edges[i + 1])
        if m.any():
            db = 20 * np.log10(rms[m].mean() + 1e-9)
            print(f"{i + 1:>4}  {edges[i]:>7.2f}  {db:>7.1f}  " + "#" * max(0, int((db + 40) / 1.5)))
    print(f"\n已写入 {tj} 和 {js}")


if __name__ == "__main__":
    main()
