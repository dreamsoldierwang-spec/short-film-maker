// 逐帧捕获：用无头 Chromium 把单文件短片 HTML 渲染成 JPEG 帧序列
// 用法: node capture-frames.mjs <输出目录> [帧率=30] [时长秒=120] [html文件名=film.html]
//   例: node capture-frames.mjs frames-columbus 30 120 columbus-vintage.html
// 注意: 在"项目目录"下运行，html 文件名相对于当前工作目录解析。
import { chromium } from '/Users/dreamsoldier/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
const [,, framesDirArg, fpsStr, secsStr, htmlName = 'film.html'] = process.argv;
const FPS = parseInt(fpsStr || '30', 10);
const SECS = parseFloat(secsStr || '120');
const HTML = 'file://' + path.resolve(cwd, htmlName);
const framesDir = path.resolve(cwd, framesDirArg || 'frames');

fs.mkdirSync(framesDir, { recursive: true });

const b = await chromium.launch({
  args: [
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const client = await p.context().newCDPSession(p);
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(HTML);
await p.waitForFunction(() => typeof window.__seek === 'function', { timeout: 30000 });

const total = Math.round(SECS * FPS);
const t0 = Date.now();
for (let i = 0; i < total; i++) {
  const t = i / FPS;
  await p.evaluate((tt) => window.__seek(tt), t);
  await p.evaluate(() => new Promise((res) => {
    let n = 0;
    const tick = () => { if (++n >= 3) res(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
  const { data } = await client.send('Page.captureScreenshot', {
    format: 'jpeg', quality: 94, captureBeyondViewport: false,
  });
  fs.writeFileSync(`${framesDir}/frame_${String(i).padStart(5, '0')}.jpg`, Buffer.from(data, 'base64'));
  if (i % FPS === 0) console.log(`frame ${i}  t=${t.toFixed(2)}s  已用=${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await b.close();
console.log('DONE', total, 'frames in', ((Date.now() - t0) / 1000).toFixed(1), 's');
if (errs.length) console.log('PAGE_ERRORS:', errs.length, errs.slice(0, 5));
else console.log('PAGE_ERRORS: 0');
