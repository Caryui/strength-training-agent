// 启动开发服务器前，释放被占用的端口（5173 前端 / 3000 后端），
// 避免上一次异常退出的 vite/tsx 进程残留，导致新 dev 被挤到别的端口、
// 而你一直访问到旧的坏实例（表现为 localhost:5173 打不开）。
// 仅用于本地开发（npm run dev），CI 走 npm run build，不受影响。
const { execSync } = require('child_process');

const PORTS = [5173, 3000];

function killPort(port) {
  let out = '';
  try {
    out = execSync(`netstat -ano 2>nul`, { encoding: 'utf-8' });
  } catch {
    return;
  }
  const pids = new Set();
  for (const line of out.split('\n')) {
    const cols = line.trim().split(/\s+/);
    const local = cols[1]; // 形如 0.0.0.0:5173 或 [::]:5173
    if (local && local.endsWith(':' + port)) {
      const pid = cols[cols.length - 1];
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      console.log(`  ✓ 释放端口 ${port}（已结束残留进程 ${pid}）`);
    } catch {
      /* 忽略个别进程无权限等情况 */
    }
  }
}

for (const p of PORTS) killPort(p);
console.log('✓ 端口清理完成，正在启动开发服务器…');
