const { spawn } = require('child_process');

const args = process.argv.slice(2);
let rootId = args.find(a => !a.startsWith('--')) || '';
if (rootId.startsWith('-')) rootId = rootId.slice(1); // Strips the '-' if you use `npm run dev -I412076094635`

if (!rootId) {
  console.warn('\n⚠️  WARNING: No Root ID provided!');
  console.warn('To load a specific realm, pass it as an argument: npm run dev I412076094635\n');
}

process.env.ROOT_ID = rootId;

const vite = spawn('npx', ['vite'], { stdio: 'inherit', shell: true });
const server = spawn('node', ['server.js', rootId], { stdio: 'inherit', shell: true, cwd: 'server-node' });

const cleanup = () => {
  vite.kill();
  server.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);