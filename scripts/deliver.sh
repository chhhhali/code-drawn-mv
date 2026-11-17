#!/bin/bash
# 交付：把渲染出来的 master 换回原曲音轨（渲染器导出的音轨响度会低约 0.6 LU），量两边的响度；可选再压一个 720p 手机预览（< 30 MB）。
#
# 用法（在项目根目录）：
#   deliver.sh <master.mp4> <song.wav> <成片.mp4> [<预览-720p.mp4>]
# 例：
#   npx -y hyperframes@0.9.41 render --fps=30 --max-bitrate=16M --quiet -o renders/_master.mp4
#   bash deliver.sh renders/_master.mp4 assets/song.wav "renders/片名_v1.mp4"                       # 只出 1080p
#   bash deliver.sh renders/_master.mp4 assets/song.wav "renders/片名_v1.mp4" "renders/片名-預覽-720p.mp4"
# 成片：H.264 10 Mbps（峰值 14）、AAC 256k、faststart；2 分钟约 150 MB，手机端发不了，只能在电脑上看。
# 预览：码率按片长自动算，压到 28 MB 左右。
set -euo pipefail
if [ $# -lt 3 ]; then sed -n '2,12p' "$0"; exit 1; fi
master="$1"; song="$2"; out="$3"; preview="${4:-}"

loud() { ffmpeg -nostats -hide_banner -i "$1" -af ebur128 -f null - 2>&1 | grep -A1 "Integrated loudness" | tail -1 | sed 's/^ *//'; }

ffmpeg -v error -y -i "$master" -i "$song" -map 0:v -map 1:a \
  -c:v libx264 -preset slow -b:v 10M -maxrate 14M -bufsize 20M -pix_fmt yuv420p \
  -c:a aac -b:a 256k -shortest -movflags +faststart "$out"

if [ -n "$preview" ]; then
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out")
  # 28 MB 预算：视频码率 = 28*8000/时长 - 128（kbps），最多 2400
  vb=$(python3 -c "print(max(400, min(2400, int(28*8000/float('$dur')) - 128)))")
  ffmpeg -v error -y -i "$out" -vf scale=1280:-2 -c:v libx264 -preset slow -b:v ${vb}k -maxrate $((vb * 12 / 10))k -bufsize $((vb * 2))k \
    -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "$preview"
fi

echo "原曲    $(loud "$song")"
echo "master  $(loud "$master")   ← 渲染器自带的音轨"
for f in "$out" ${preview:+"$preview"}; do
  info=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate:format=duration -of csv=p=0 "$f" | tr '\n' ' ')
  size=$(python3 -c "import os; print(f'{os.path.getsize(\"$f\")/1e6:.1f} MB')")
  echo "$f  [$info] $size  $(loud "$f")"
done
