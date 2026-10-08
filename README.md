# short-film-maker · WorkBuddy Skill

把任意**故事 / 历史事件 / 文旅主题**，落地为一支**可双击运行、可逐帧录制、可无缝循环**的 Three.js 单文件 HTML 短片，再导出 **MP4** 与**带时间轴的配音稿**。

> 已在实战项目中跑通：「哥伦布发现新大陆」复古电影风 120s 短片 —— HTML 逐像素验证通过、MP4 精确 120.000s、配音稿 317 字 / 10 镜。

## 工作流（7 步，逐步审阅后生效）

| 步骤 | 产出 | 说明 |
|---|---|---|
| 1 | — | 确认**故事主题**（如"哥伦布发现新大陆"） |
| 2 | — | 确认**视觉风格**：皮影戏 / 复古电影 / 纪实片（默认三选一，也可自定义） |
| 3 | — | 确认**时长**：60s / 90s / 120s |
| 4 | `*-style-<style>.md` | 生成**设计方案 md**（风格定位/美术方向/技术要点/分镜表/母题结尾）→ **待确认** |
| 5 | `<主题>.html` | 生成**单文件 HTML 短片** → **待确认** |
| 6 | `<主题>.mp4` + `<主题>-narration.md` | 导出 **MP4** 与 **配音稿** |
| 7 | — | **删除中间帧**（2–3GB） |

每步产出都先交付给用户确认，再进入下一步。

## 目录结构

```
short-film-maker/
├── SKILL.md                      # 主流程 + 核心原则 + 故障速查
├── references/
│   ├── style-presets.md          # 三套风格美术方向 / 镜头骨架 / 设计方案 md 结构
│   ├── html-framework.md         # Three.js 骨架、helper、后处理、导演层
│   ├── export-pipeline.md        # 截帧 → ffmpeg → ffprobe → 像素级自检
│   └── narration-guide.md        # 配音稿格式 + 字数/时长速算
├── scripts/
│   ├── capture-frames.mjs        # 无头 Chromium 逐帧截 JPEG（参数化）
│   ├── export-video.sh           # ffmpeg 编码 MP4（参数化）
│   └── verify-headless.mjs       # 11 点截图 + 自写 PNG 解码统计（抓渲染 bug）
└── assets/
    └── template.html             # 可运行骨架，复制即改
```

## 使用

```bash
# 1) 复制骨架（换主题时只改 SHOTS 与各 buildShotN）
cp assets/template.html my-story.html

# 2) 像素级自检：确认非静止、零报错、强调色存活
node scripts/verify-headless.mjs my-story.html 120

# 3) 截帧 + 编码
node scripts/capture-frames.mjs frames 30 120 my-story.html
bash scripts/export-video.sh 30 120 my-story.mp4 frames

# 4) 清理中间帧
rm -rf frames
```

## 环境依赖

- **Playwright（含 Chromium）**：`~/.workbuddy/binaries/node/workspace/node_modules`，以 `--use-gl=swiftshader` 软件渲染。
- **ffmpeg**：macOS 常见真实路径 `/opt/homebrew/bin/ffmpeg`（`export-video.sh` 已兜底）。
- **Node**：运行时需设 `NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules`。

## 两个必知坑（已写进文档）

1. **必须 `THREE.ColorManagement.enabled = false`** —— three r160 默认开启色彩管理，但后处理是裸 `ShaderMaterial` 直接写 `gl_FragColor`（无 sRGB 输出编码），会导致强调色被当线性色渲染、发暗发灰（实测靛蓝直接"全帧检测不到蓝"，蓝≤绿）。
2. **导演层 alpha 是 `a_in * (1 - a_out)`** —— 写成 `a_in * a_out` 会让镜头显隐反转、首帧全黑。

此外：大面积半透明的强调色会被 sepia 洗成棕，真实分镜应使用**小面积全饱和强调色**。

## 安装

放到 WorkBuddy 用户级技能目录即可生效：

```
~/.workbuddy/skills/short-film-maker/
```
