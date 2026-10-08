#!/usr/bin/env bash
# 一键把单文件短片 HTML 的帧序列编码为 MP4（需先跑 capture-frames.mjs）
# 用法: bash export-video.sh [帧率=30] [时长秒=120] [输出mp4路径=film.mp4] [帧目录=frames]
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
FPS="${1:-30}"
SECS="${2:-120}"
OUT="${3:-film.mp4}"
FRAMES="${4:-frames}"

# ffmpeg 真实路径兜底（WorkBuddy 默认 PATH 常不含 homebrew）
FFMPEG="$(command -v ffmpeg || echo /opt/homebrew/bin/ffmpeg)"

echo "==> FFmpeg 编码 H.264: ${FRAMES}/frame_%05d.jpg -> ${OUT}"
"$FFMPEG" -y -r "$FPS" -i "$FRAMES/frame_%05d.jpg" \
  -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p \
  -movflags +faststart "$OUT"

echo "==> 校验:"
"$FFMPEG" -version >/dev/null 2>&1 || true
if command -v ffprobe >/dev/null 2>&1; then
  ffprobe -v error -show_entries format=duration,size:stream=width,height,codec_name,r_frame_rate,nb_frames -of default=noprint_wrappers=1 "$OUT"
else
  echo "(ffprobe 缺失，跳过时长校验)"
fi
echo "==> 完成: $OUT"
