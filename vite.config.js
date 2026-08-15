import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 说明：
// - 默认 `npm run build` 产出「多文件」构建（JS/CSS 拆到 dist/assets/），
//   适合网站托管（CloudStudio / GitHub Pages / EdgeOne），对网关兼容性最好。
// - 离线单文件交付物（力量训练方案设计师.html）由 `npm run build:single` 生成：
//   先跑多文件构建，再用 scripts/inline-html.cjs 把资源内联进 index.html。
//   （早期用的 vite-plugin-singlefile 在本环境会触发 esbuild 崩溃，已弃用。）
export default defineConfig({
    base: './',
    plugins: [react()],
    // 只把 index.html 当作依赖扫描/构建入口，避免根目录下的离线单文件
    //（力量训练方案设计师.html，内含 2.8MB 压缩 JS）被 Vite 误当入口解析而崩溃。
    optimizeDeps: {
        entries: ['index.html'],
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        allowedHosts: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    },
    css: {
        preprocessorOptions: {
            less: {
                javascriptEnabled: true
            }
        }
    }
});
