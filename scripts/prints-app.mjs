// Abre o aplicativo, salva prints de conferência numa pasta e fecha.
//
//   npm run prints -- <pasta>
//
// Ver `tirarPrints` em electron/main.js.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const pasta = path.resolve(process.argv[2] ?? 'prints');
const electron = createRequire(import.meta.url)('electron');
const proc = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, WB2_PRINTS: pasta },
});
proc.on('close', (codigo) => process.exit(codigo ?? 1));
