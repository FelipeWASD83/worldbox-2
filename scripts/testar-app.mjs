// Abre o aplicativo em modo de autoteste e repassa o resultado.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const electron = createRequire(import.meta.url)('electron');
const proc = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, WB2_TESTE: '1' },
});
proc.on('close', (codigo) => process.exit(codigo ?? 1));
