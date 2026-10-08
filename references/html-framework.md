# HTML 框架要点（html-framework）

单文件 HTML 是整个流程的核心。它必须**可双击运行、可逐帧录制、可无缝循环**。本文件记录架构与必踩的坑。完整可直接改的骨架见 `assets/template.html`。

## 1. 顶层级（务必顺序正确）

```html
<!doctype html><html><head><meta charset="utf-8">
<style>/* 全内联：body{margin:0;overflow:hidden;background:#000} canvas{display:block} 文字层绝对定位 */</style>
</head><body>
<div id="title">…</div><div id="subtitle">…</div><div id="logcover">…</div>
<div id="logfolio"><span id="logfolioNum"></span></div><div id="flash"></div><div id="burn"></div>
<script type="module">
// ① 多 CDN 兜底加载 THREE（esm.sh → unpkg → jsdelivr）
// ② 加载成功后立刻：THREE.ColorManagement.enabled = false;   // ★ 关键
// ③ 建场景 / 正交相机 / 后处理
// ④ 定义 helper / SHOTS / 导演循环
// ⑤ window.__seek 挂上、requestAnimationFrame 启动
</script>
</body></html>
```

## 2. Three.js 多 CDN 兜底（防止白屏）

```js
async function loadTHREE(){
  const urls=['https://esm.sh/three@0.160.0','https://unpkg.com/three@0.160.0/build/three.module.js','https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'];
  for(const u of urls){ try{ const m=await import(u); if(m&&m.WebGLRenderer) return m; }catch(e){} }
  return null;
}
const THREE = await loadTHREE();
if(!THREE){ /* 全局 error 覆盖层提示 */ throw new Error('Three.js unavailable'); }
THREE.ColorManagement.enabled = false;   // ★ 必须在建任何材质前
```

## 3. 正交相机 + 后处理 sepia

- 正交相机覆盖画面 `W×H`（如 1920×1080，或按视口缩放）：`new THREE.OrthographicCamera(-W/2,W/2,H/2,-H/2,0.1,100)`，`position.z=10`。
- 主场景渲染到 `WebGLRenderTarget(W,H)`；再用一个 `postScene` + 全屏 `PlaneGeometry` 的 `ShaderMaterial`（读 rt 纹理）渲染到屏幕。
- sepia fragment 要点（保住强调色）：

```glsl
float mx=max(col.r,max(col.g,col.b));
float mn=min(col.r,min(col.g,col.b));
float sat=clamp((mx-mn-0.10)*4.5,0.0,1.0);
vec3 sep; sep.r=dot(col,vec3(0.393,0.769,0.189));
sep.g=dot(col,vec3(0.349,0.686,0.168)); sep.b=dot(col,vec3(0.272,0.534,0.131));
sep=clamp(sep*1.06,0.0,1.0);
col=mix(col,sep,0.90*(1.0-sat*0.82));   // 越饱和越不洗
// + 颗粒(hash) + 划痕 + 暗角 + 跳片(y-jitter, 每~2s)
```

## 4. 关键 helper（统一返回结构，避免 `.r(g)` 事故）

```js
// fillShape 返回 {mesh, reg, r}：mesh 是网格，reg(group,idx,mesh,order) 登记，r(group) 把 mesh 加到 group
function fillShape(pts, z, color, idx, order){
  const sh=new THREE.Shape(pts); const g=new THREE.ShapeGeometry(sh);
  const m=new THREE.MeshBasicMaterial({color, transparent:true, opacity:1});
  const mesh=new THREE.Mesh(g,m); mesh.position.z=z;
  const api={ mesh, reg:(group,i,mm,o)=>{ mm.renderOrder=o; group.add(mm); }, r:(group)=>{ mesh.renderOrder=order; group.add(mesh); } };
  return api;
}
// 粗线用 ribbonFromPts（LineBasicMaterial.linewidth 无效！），细线用 lineFromPts
function lineFromPts(pts,color,w,idx,order){ /* LineBasicMaterial + Line */ }
function ribbonFromPts(pts,w,z,color,idx,order,opacity){ /* 多边形带状填充，可参与叠化 */ }
```

> ⚠️ `ShaderMaterial` 自定义 fragment 不会自动消费 `material.opacity`，必须在 shader 里乘 `uOpacity`。芦苇/航线等动态透明元素曾因此无法参与叠化。

## 5. 循环 + 导演层（无缝）

```js
let DURATION = parseFloat(params.get('duration')) || 120;
const TRANS = 1.4;
function smooth(x){ x=Math.max(0,Math.min(1,x)); return x*x*(3-2*x); }
// 每帧：t = ((clock.elapsedTime + seekOffset) % DURATION + DURATION) % DURATION
// 找 primary 镜：满足 s.start <= t < s.start+s.dur 的最后一个；其余镜按叠化 alpha 显隐
// 入：a_in = (s.start===0)?1:smooth((t-s.start)/TRANS)
// 出：a_out = smooth((t-(s.start+s.dur-TRANS))/TRANS)
// shotAlpha = a_in * a_out；setGroupAlpha 用 baseOpacity * shotAlpha（乘法，别覆盖）
// 末镜末尾：首镜回淡入，消除空窗
```

`window.__seek` 与 URL 参数（截帧用）：

```js
window.__seek = (t)=>{ seekOffset = t - clock.elapsedTime; };
// 支持 ?t=12.3 直接定位、?duration=90 改时长
```

## 6. DOM 文字层（不进 WebGL，便于清晰排版）

- `#title` 标题块（片头/闪回）、`#subtitle` 底部逐字打字机字幕、#logcover Intertitle 卡、#logfolio 折角页码、#flash 白闪、#burn 烧焦边。
- 字幕动画用 JS 按 `lt = t - s.start` 控制显隐与逐字。
- 字幕文字色要带描边（纸色/墨色），保证任意底色可读。

## 7. 全局 error 覆盖层

任何顶层异常都在页面中央显示红字，而非静默白屏——便于用户/你即时发现渲染失败。

## 8. 录制就绪清单（截帧前自查）

- [ ] `window.__seek` 已挂、`?t=`/`?duration=` 可用
- [ ] `THREE.ColorManagement.enabled=false`（强调色不灰）
- [ ] 单镜只 build 一次，每镜 try-catch
- [ ] 片尾旋转只动内容子组、背景留在 group 外（不露黑角）
- [ ] `DURATION` 与镜头起止严格对齐
