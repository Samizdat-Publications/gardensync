// Build, then deploy dist/ to Cloudflare Pages.
//
//   npm run deploy:preview      branch preview at https://v8.gardensync-e4e.pages.dev
//   npm run deploy:production   the live app at https://gardensync-e4e.pages.dev (release only)
//
// wrangler runs from inside dist/ so Pages never picks up the landing page's function in
// ../functions (it looks for functions/ in the working directory).
import { spawnSync } from 'node:child_process';

const target = process.argv[2] ?? 'preview';
const branches = { preview: 'v8', production: 'master' };
if (!(target in branches)) {
  console.error('Usage: node scripts/deploy.mjs preview|production');
  process.exit(1);
}
const shell = process.platform === 'win32';
const step = (cmd, args, cwd) => {
  const r = shell
    ? spawnSync([cmd, ...args].join(' '), { stdio: 'inherit', shell, cwd })
    : spawnSync(cmd, args, { stdio: 'inherit', cwd });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

step('npx', ['vite', 'build']);
step('npx', ['wrangler', 'pages', 'deploy', '.', '--project-name=gardensync', `--branch=${branches[target]}`, '--commit-dirty=true'], 'dist');
console.log(target === 'production' ? '\nLive: https://gardensync-e4e.pages.dev' : '\nPreview: https://v8.gardensync-e4e.pages.dev');
