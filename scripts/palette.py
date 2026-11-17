"""从参考帧里给指定区域取色（k-means），结果写进 style.md 的配色表。

用法：
  .venv/bin/python -I palette.py <图片> "名字:x0,y0,x1,y1[:k]" ["名字:x0,y0,x1,y1[:k]" ...]
例：
  .venv/bin/python -I palette.py ref/full/t_5.5.jpg "夕阳天空:0,0,1920,480:6" "草地:900,620,1920,1000:5" "皮肤:380,560,560,760:4"
每个区域按占比从大到小打印 HEX。区域坐标先在接触表 / 原尺寸帧上目测好；k 默认 5。
"""
import sys
import numpy as np
from PIL import Image


def kmeans(px, k, it=25, seed=1):
    rng = np.random.default_rng(seed)
    c = px[rng.choice(len(px), k, replace=False)].astype(float)
    for _ in range(it):
        lab = ((px[:, None, :] - c[None]) ** 2).sum(-1).argmin(1)
        for j in range(k):
            m = lab == j
            if m.any():
                c[j] = px[m].mean(0)
    cnt = np.bincount(lab, minlength=k)
    return [(c[j], cnt[j] / len(px)) for j in np.argsort(cnt)[::-1]]


def hexc(c):
    return "#%02x%02x%02x" % tuple(int(round(v)) for v in c)


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    im = Image.open(sys.argv[1]).convert("RGB")
    for spec in sys.argv[2:]:
        parts = spec.split(":")
        name, box = parts[0], tuple(int(v) for v in parts[1].split(","))
        k = int(parts[2]) if len(parts) > 2 else 5
        px = np.asarray(im.crop(box)).reshape(-1, 3).astype(float)
        if len(px) > 20000:
            px = px[np.random.default_rng(0).choice(len(px), 20000, replace=False)]
        pal = kmeans(px, min(k, len(px)))
        print(f"{name:<12}", "  ".join(f"{hexc(c)} {w * 100:4.1f}%" for c, w in pal))


if __name__ == "__main__":
    main()
