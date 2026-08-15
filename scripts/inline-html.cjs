// 将多文件构建产物 dist/ 中的 JS/CSS 内联进 index.html，
// 生成可双击打开、零外部依赖的离线单文件 HTML。
// 用法：node scripts/inline-html.cjs
const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');
const htmlPath = path.join(distDir, 'index.html');
// 输出到 offline/ 子目录，而非项目根：避免巨型离线 HTML 被 Vite 依赖扫描器
// 误当入口解析导致 dev server 崩溃（localhost:5173 打不开）。双击 offliné/ 下的
// 文件同样可用，且不再污染 Vite 根。
const outDir = path.resolve(__dirname, '..', 'offline');
const outPath = path.join(outDir, '力量训练方案设计师.html');

if (!fs.existsSync(htmlPath)) {
  console.error('找不到 dist/index.html，请先运行 npm run build');
  process.exit(1);
}

let html = fs.readFileSync(htmlPath, 'utf-8');

// 内联 JS module 脚本：<script type="module" ... src="./assets/x.js"></script>
html = html.replace(
  /<script\s+type="module"[^>]*\ssrc="(\.\/assets\/[^"]+\.js)"[^>]*><\/script>/g,
  (_m, src) => {
    const jsPath = path.join(distDir, src.replace(/^\.\//, ''));
    let js = fs.readFileSync(jsPath, 'utf-8');
    // 防止 JS 中的 </script> 提前闭合标签
    js = js.replace(/<\/script>/gi, '<\\/script>');
    return `<script type="module">${js}</script>`;
  },
);

// 内联 CSS：<link rel="stylesheet" ... href="./assets/x.css">
html = html.replace(
  /<link\s+rel="stylesheet"[^>]*\shref="(\.\/assets\/[^"]+\.css)"[^>]*>/g,
  (_m, href) => {
    const cssPath = path.join(distDir, href.replace(/^\.\//, ''));
    const css = fs.readFileSync(cssPath, 'utf-8');
    return `<style>${css}</style>`;
  },
);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, html, 'utf-8');

const sizeKB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
const hasExternal = /src="\.\/assets|href="\.\/assets/.test(html);
console.log(`✓ 已生成离线单文件: ${outPath}`);
console.log(`  体积: ${sizeKB} MB`);
console.log(hasExternal ? '  ⚠ 仍有外部资源引用' : '  ✓ 无外部资源引用（可双击 file:// 打开）');
