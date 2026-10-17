import { app, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { aplicarPendente, confirmar, lerEstado, reverter } from './troca.js';

/**
 * O inicializador da cópia instalada do WorldBox 2.
 *
 * O atalho abre o Electron apontando para esta pasta, e não para o jogo: daqui
 * se põe no lugar a versão que o botão de atualizar baixou, carrega-se o jogo de
 * `app/`, e, se a versão nova não abrir, volta a de antes. Este arquivo nunca é
 * trocado pelo atualizador (ver `troca.js`).
 *
 * O jogo avisa que abriu emitindo `wb2:abriu` no processo, e avisa que quebrou
 * com `wb2:falhou`. Versão nova que não diz nada em `ESPERA_MS` também conta
 * como quebrada.
 */

const ESPERA_MS = 45000;
const BASE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

let trocou = null;
try {
  trocou = aplicarPendente(BASE);
} catch (e) {
  // A troca falhou, mas a versão de antes ficou no lugar: abre com ela.
  console.error('não deu para trocar de versão:', e);
}

const estado = lerEstado(BASE);
process.env.WB2_INSTALADO = BASE;
// O jogo reaberto herda o ambiente deste processo: sem apagar, um aviso de
// "acabou de atualizar" sobreviveria a todos os inícios seguintes.
if (trocou) process.env.WB2_ACABOU_DE_ATUALIZAR = trocou;
else delete process.env.WB2_ACABOU_DE_ATUALIZAR;

function desistir(motivo) {
  if (reverter(BASE, motivo)) {
    app.relaunch();
    app.exit(0);
  } else {
    app.exit(1);
  }
}

if (estado.emTeste) {
  const relogio = setTimeout(() => desistir('não abriu a tempo'), ESPERA_MS);
  process.once('wb2:abriu', () => {
    clearTimeout(relogio);
    confirmar(BASE);
  });
  process.once('wb2:falhou', (motivo) => {
    clearTimeout(relogio);
    desistir(motivo);
  });
}

try {
  await import(pathToFileURL(path.join(BASE, 'app', 'electron', 'main.js')).href);
} catch (e) {
  if (estado.emTeste) {
    desistir(`não carregou: ${e?.message ?? e}`);
  } else {
    await app.whenReady();
    dialog.showErrorBox('WorldBox 2 não abriu', String(e?.stack ?? e));
    app.exit(1);
  }
}
