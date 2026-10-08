---
name: short-film-maker
description: This skill should be used when a user wants to turn a story, historical event, or cultural-tourism topic into a looping Three.js short film delivered as a single-file HTML, then exported to MP4 with a timed narration script. It covers a staged workflow: confirm the story theme, choose a visual style (three built-in presets — shadow puppetry, vintage film, documentary — or a custom style), pick a duration (60/90/120s), generate a design-proposal markdown, build the HTML after approval, and export MP4 plus a narration markdown after HTML approval, then clean up intermediate frames. Trigger phrases include "做个短片", "故事做成视频", "生成水墨/复古/皮影短片", "把XX做成动画", "导出 MP4 和配音稿".
agent_created: true
---

# Short Film Maker — 故事 → 单文件短片 → MP4 + 配音稿

把任意故事/历史/文旅主题，落地为一支**可双击运行、可逐帧录制、可无缝循环**的 Three.js 单文件 HTML 短片，再导出 MP4 与带时间轴的配音稿。

## 何时使用

- 用户说"把 XX 故事做成短片/视频/动画"。
- 用户想以**皮影戏 / 复古电影 / 纪实片**等风格，或自定义风格，产出一支 60/90/120 秒的循环短片。
- 用户要的是"能在浏览器里看的 HTML" + "可分享的 MP4" + "能拿去配音的文稿"，而不是一个需要搭环境的工程。

## 核心原则（务必遵守）

1. **逐阶段 + 审阅后生效**：每产出一个阶段物（设计方案 md → HTML → MP4+配音稿），都**先交付给用户确认，再进入下一阶段**。不要在用户没确认时就跳做 MP4。
2. **单文件 HTML**：所有 CSS/JS/图标内联，不依赖外部资源；Three.js 走多 CDN 兜底（见 `assets/template.html`），字体可走 Google Fonts CDN 但需有 serif 回退。
3. **可录制优先**：HTML 必须暴露 `window.__seek(t)` 与 `?t=`/`?duration=` 参数（见 `references/html-framework.md`），否则 `scripts/capture-frames.mjs` 截不了帧。
4. **无缝循环**：用 `t = ((tRaw % DURATION) + DURATION) % DURATION` 实现循环；片尾末镜末尾回淡入首镜，消除空窗。
5. **关键坑 — 色彩管理**：three r160 默认开启 `ColorManagement`，但后处理是裸 `ShaderMaterial` 直接写 `gl_FragColor`（无 sRGB 输出编码），会导致所有强调色被当线性色渲染、发暗发灰。**必须在加载 Three.js 后立刻 `THREE.ColorManagement.enabled = false`**（见 `references/html-framework.md` 与 `scripts/verify-headless.mjs`）。

## 工作流（7 步）

### 步骤 1 · 确认故事主题
向用户确认主题（如"哥伦布发现新大陆"）。这是自由文本，不必限定。若用户已给出，直接采用；否则用 `AskUserQuestion` 或追问澄清。

### 步骤 2 · 确认视觉风格
默认提供三种内置风格，也可由用户自定义：
- **皮影戏（shadow puppetry）** — 镂空剪影 + 暖光投影 + 关节可动。
- **复古电影（vintage film）** — 做旧 sepia 老新闻片 + 颗粒/划痕/跳片 + 字幕卡。
- **纪实片（documentary）** — 羊皮海图 + 航线生长 + 克制旁白感。

用 `AskUserQuestion` 让用户三选一或"自定义"。自定义时，先和用户对齐美术方向（基底色、强调色、母题、转场、结尾），再继续。
三种风格的详细美术方向、Three.js 技术要点、镜头骨架、母题与结尾约定，见 `references/style-presets.md`。

### 步骤 3 · 确认时长
默认提供 **60s / 90s / 120s** 三档（通过 `AskUserQuestion`）。选定后据此设计镜头骨架（见 `references/style-presets.md` 的"镜头骨架"段，按时长等比压缩/扩展）。注意镜头起止必须与 `DURATION` 严格对齐，相邻镜头强调色不重复。

### 步骤 4 · 生成设计方案 md（待用户确认）
按选定风格，产出一份 `*-style-<style>.md` 设计方案文档，结构见 `references/style-presets.md` 的"设计方案 md 结构"。包含：风格定位 → 美术方向 → Three.js 技术要点 → 叙事主线 → N 镜详细分镜表（入点/时长/画面/配方/文案/强调色/转场）→ 母题与结尾 → 自检。
**交付此 md 后停下，等用户确认。**

### 步骤 5 · 生成 HTML（待用户确认）
用户确认设计方案后，基于 `assets/template.html` 骨架（复制并重命名，如 `columbus-vintage.html`）填充分镜：替换 `SHOTS` 数组与各 `buildShotN()` 内容，保留后处理/循环/`__seek`/DOM 文字层。
完成后做无头验证（见步骤 6 的验证手段），再交给用户**在浏览器里确认**。
**交付 HTML 后停下，等用户确认"无误"。**

### 步骤 6 · 生成 MP4 + 配音稿 md
用户确认 HTML 后：
1. **截帧**：`node scripts/capture-frames.mjs <framesDir> <fps=30> <secs> <htmlName>` → 产出 `secs×fps` 张 JPEG 到 `framesDir/`。
2. **编码**：`bash scripts/export-video.sh <fps=30> <secs> <mp4Path> <framesDir>` → 用 ffmpeg 编码 H.264 / yuv420p / faststart 的 MP4。
3. **配音稿**：按 `references/narration-guide.md` 写 `<主题>-narration.md`，逐镜分配起读时刻（语速 4.5 字/秒，每镜首尾留 0.6s 静默避开 1.4s 叠化）。
4. **验证 MP4**：`ffprobe` 确认时长精确等于 `DURATION`、分辨率 1920×1080、帧数 = `secs×fps`、零报错。
5. **像素级自检（强烈建议）**：用 `node scripts/verify-headless.mjs <htmlName> <secs>` 跑 11 个时间点截图 + 解码统计，确认：①零 `pageerror`；②逐帧签名不同（非静止）；③强调色经后处理仍存活（尤其靛蓝，易因色彩管理 bug 被洗灰）。这一步曾抓出"全帧检测不到蓝"的严重 bug。

### 步骤 7 · 删除中间帧
MP4 与配音稿交付后，**删除 `framesDir/`（中间帧，通常 2–3GB）**。删除前向用户说明体量并确认（属项目目录、非个人敏感目录，可直接 `rm -rf`，但先告知）。若用户想保留以便重编码，则跳过。

## 打包与复用

- 本 Skill 的 `scripts/`、`references/`、`assets/` 均为可复用资产；换主题时只改 `SHOTS` 与 `buildShotN`，框架不动。
- 截帧/编码/验证三脚本已参数化，直接传参即可，无需重写。
- 新增视觉风格：在 `references/style-presets.md` 追加一节，并在步骤 2 的 `AskUserQuestion` 选项里加入。

## 常见故障速查

| 现象 | 根因 | 解决 |
|---|---|---|
| 浏览器打开是静止画面 | `fillShape` 返回 `{mesh,reg}` 却写 `.r(g)` / 单镜被 build 两次 / 顶层脚本抛错中断 | 加 `r` 别名；单镜只 build 一次；每镜 try-catch；全局 error 覆盖层；多 CDN 兜底 |
| 强调色发灰、靛蓝变灰棕 | three `ColorManagement` 开启但后处理无 sRGB 编码 | `THREE.ColorManagement.enabled=false` |
| 片尾露黑角 | 旋转整个 group（含全屏背景） | 仅旋转内容子组，背景留在 group 外 |
| sepia 把朱砂/金全洗成灰 | 固定 0.9 混合 sepia | 按像素饱和度降混合：`mix(col, sep, 0.90*(1.0 - sat*0.82))` |
| 截帧全黑 | `Page.captureScreenshot` 在 swiftshader 下需 `captureBeyondViewport:false` 且等 3 帧 RAF | 用 `scripts/capture-frames.mjs` 既定写法 |
