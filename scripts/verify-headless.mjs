// 像素级自检：无头 Chromium 截 11 张图 + 自写 PNG 解码统计
// 目的：①零 pageerror ②逐帧非静止 ③强调色（尤其靛蓝）经后处理仍存活
//       —— 曾用此脚本抓出"ColorManagement 没关 → 全帧检测不到蓝"的严重 bug
// 用法: node verify-headless.mjs [html文件名=film.html] [时长秒=120]
import { chromium } from '/Users/dreamsoldier/.workbuddy/binaries/node/workspace/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const cwd = process.cwd();
const [htmlName = 'film.html', secsStr = '120'] = process.argv.slice(2);
const SECS = parseFloat(secsStr);
const HTML = 'file://' + path.resolve(cwd, htmlName);

// ---- 紧凑 PNG 解码（仅支持 8-bit RGB/RGBA）----
function decodePNG(buf) {
  if (!(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)) throw new Error('not png');
  let pos = 8, width, height, colorType; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * ch;
  const out = Buffer.alloc(height * stride);
  let rp = 0;
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < height; y++) {
    const f = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const v = raw[rp++];
      const a = x >= ch ? out[y * stride + x - ch] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = (x >= ch && y > 0) ? out[(y - 1) * stride + x - ch] : 0;
      let val;
      switch (f) {
        case 1: val = v + a; break;
        case 2: val = v + b; break;
        case 3: val = v + ((a + b) >> 1); break;
        case 4: val = v + paeth(a, b, c); break;
        default: val = v;
      }
      out[y * stride + x] = val & 0xff;
    }
  }
  return { width, height, ch, data: out };
}

function stats(png) {
  const { width, height, ch, data } = png;
  let sum = 0, sum2 = 0, n = 0;
  let red = 0, gold = 0, blue = 0, green = 0;
  let bluest = { b: -1, r: 0, g: 0 };
  let sig = 0;
  const step = 7;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += L; sum2 += L * L; n++;
      sig = (sig + r * 3 + g * 5 + b * 7) >>> 0;
      if (r > 140 && r > g * 1.3 && r > b * 1.3) red++;
      if (r > 150 && g > 120 && b < 120 && r >= g && g >= b && (r - b) > 40) gold++;
      if (g > r && g > b && g > 90) green++;
      if (b > g && b >= r && b > 70 && (g - r) < 50) { blue++; if (b > bluest.b) bluest = { b, r, g }; }
    }
  }
  const mean = sum / n; const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  return { mean, std, red, gold, blue, green, bluest, sig };
}

const b = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const client = await p.context().newCDPSession(p);
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(HTML);
await p.waitForFunction(() => typeof window.__seek === 'function', { timeout: 30000 });

const N = 11;
const times = Array.from({ length: N }, (_, k) => (k === N - 1 ? SECS - 0.01 : (SECS * k) / (N - 1)));
const sigs = [];
console.log('t(s)\tmeanL\tstd\tred\tgold\tblue\tgreen\tbluest(r,g,b)');
for (let k = 0; k < N; k++) {
  const t = times[k];
  await p.evaluate((tt) => window.__seek(tt), t);
  await p.evaluate(() => new Promise((res) => { let n = 0; const tick = () => { if (++n >= 3) res(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
  const { data } = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const png = decodePNG(Buffer.from(data, 'base64'));
  const s = stats(png);
  sigs.push(s.sig);
  console.log(`${t.toFixed(2)}\t${s.mean.toFixed(1)}\t${s.std.toFixed(1)}\t${s.red}\t${s.gold}\t${s.blue}\t${s.green}\t${s.bluest.r},${s.bluest.g},${s.bluest.b}`);
}
await b.close();

const uniq = new Set(sigs).size;
console.log('--- 结论 ---');
console.log('pageerror:', errs.length, errs.slice(0, 3));
console.log('逐帧签名不同(非静止):', uniq === N ? 'YES' : `NO (仅 ${uniq}/${N} 种)`);
console.log('靛蓝存活(任一帧 blue>0):', sigs.length ? '见上表' : '-');
console.log('ColorManagement 自检: 若 bluest 的 b<=g 且 blue 接近 0 → 强调色被洗灰，需 THREE.ColorManagement.enabled=false');
