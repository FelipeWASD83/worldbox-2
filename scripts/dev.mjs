// Sobe o Vite e abre o Electron apontando para ele.
// Evita depender de "concurrently": o Vite é usado pela API dele mesmo.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const servidor = await createServer({ configFile: 'vite.config.ts' });
await servidor.listen();
const { port } = servidor.config.server;
const url = `http://localhost:${port}/`;
console.log(`[wb2] vite em ${url}`);

let electron;
try {
  electron = require('electron');
} catch {
  console.error('[wb2] Electron não instalado. Rode:  npm install');
  process.exit(1);
}

const proc = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, WB2_DEV_URL: url },
});

proc.on('close', async (codigo) => {
  await servidor.close();
  process.exit(codigo ?? 0);
});
