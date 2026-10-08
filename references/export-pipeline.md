# 导出管线（export-pipeline）

把 `assets/template.html` 改好的成片（已用户确认）导出为 MP4 + 配音稿。三脚本均已参数化，直接传参。

## 0. 前置依赖

- **Playwright（含 Chromium）**：位于 `~/.workbuddy/binaries/node/workspace/node_modules`，用 `--use-gl=swiftshader` 软件渲染。
- **ffmpeg**：真实路径通常是 `/opt/homebrew/bin/ffmpeg`（WorkBuddy 默认 PATH 不含），脚本内用 `command -v ffmpeg || /opt/homebrew/bin/ffmpeg` 兜底。
- **Node**：用托管版 `/Users/dreamsoldier/.workbuddy/binaries/node/versions/22.22.2-6/bin/node`；运行脚本时设 `NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules`。

## 1. 截帧 `scripts/capture-frames.mjs`

```
node scripts/capture-frames.mjs <framesDir> <fps=30> <secs> <htmlName>
```
- 无头 Chromium 逐帧调 `window.__seek(i/fps)`，等 3 帧 RAF 后用 `Page.captureScreenshot({format:'jpeg', quality:94, captureBeyondViewport:false})` 写 `framesDir/frame_%05d.jpg`。
- 产出 `secs×fps` 张（120s@30fps = 3600 张）。实测软件渲染约 0.26s/帧，全量 ~15 分钟。
- 关键：swiftshader 下必须 `captureBeyondViewport:false` 且等足 RAF，否则截到黑/未渲染帧。

## 2. 编码 `scripts/export-video.sh`

```
bash scripts/export-video.sh <fps=30> <secs> <mp4Path> <framesDir>
```
内部执行：
```
ffmpeg -y -r $FPS -i $FRAMES/frame_%05d.jpg \
  -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -movflags +faststart $OUT
```
- `yuv420p` 保证全平台/微信可播；`faststart` 利于流式；`crf17` 高画质（体积大，约 1GB/120s）。分享用可降 `crf20~23`（~200–400MB）。
- 帧率/时长需与截帧一致。

## 3. 像素级自检 `scripts/verify-headless.mjs`（强烈建议，曾抓出严重 bug）

```
node scripts/verify-headless.mjs <htmlName> <secs>
```
- 无头加载 HTML，在 11 个时间点（均匀 + 首尾）`__seek` 后截图并存 PNG。
- 自写 PNG 解码统计：①零 `pageerror`；②逐帧签名不同（确认非静止）；③强调色存活（尤其**靛蓝**——若 `ColorManagement` 没关，全帧检测不到蓝、蓝≤绿）。
- 这是 CI 式的"渲染正确性"保险，跑一次可避免交付灰片。

## 4. 校验 MP4（交付前）

```
ffprobe -v error -show_entries format=duration,size:stream=width,height,codec_name,r_frame_rate,nb_frames -of default=noprint_wrappers=1 <mp4Path>
```
确认：`duration ≈ DURATION`（精确到 120.000s）、`width=1920 height=1080`、`nb_frames = secs×fps`、无报错。

## 5. 配音稿 `references/narration-guide.md`

MP4 同时写 `<主题>-narration.md`，逐镜起读时刻 + 字数（4.5 字/秒）。

## 6. 清理（步骤 7）

MP4+配音稿交付后 `rm -rf <framesDir>`（2–3GB），删前告知用户体量并确认。
