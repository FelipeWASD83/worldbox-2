import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');
const URL_DEV = process.env.WB2_DEV_URL || '';

/** Pasta onde ficam os saves do jogador (fora do projeto, no perfil do usuário). */
function pastaSaves() {
  return path.join(app.getPath('userData'), 'mundos');
}

async function garantirPastaSaves() {
  const p = pastaSaves();
  await fs.mkdir(p, { recursive: true });
  return p;
}

/**
 * Política de segurança de conteúdo.
 *
 * O jogo é inteiramente local: não busca script, fonte nem imagem de lugar
 * nenhum. Declarar isso fecha a porta para execução de código de fora, e é o
 * que o próprio Electron avisa em desenvolvimento quando falta.
 *
 * Em desenvolvimento a regra não é aplicada porque o Vite precisa de `eval`
 * para a recarga automática.
 */
function aplicarPolitica() {
  if (URL_DEV) return;
  session.defaultSession.webRequest.onHeadersReceived((detalhes, responder) => {
    responder({
      responseHeaders: {
        ...detalhes.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; " +
          "object-src 'none'; base-uri 'none'; form-action 'none'",
        ],
      },
    });
  });
}

function criarJanela() {
  const janela = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0a0b0d',
    autoHideMenuBar: true,
    show: false,
    title: 'WorldBox 2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // o jogo é um canvas em loop: sem isso o Chromium reduz o ritmo
      // quando a janela sai da frente, e a simulação atrasa.
      backgroundThrottling: false,
    },
  });

  janela.once('ready-to-show', () => janela.show());

  if (URL_DEV) {
    janela.loadURL(URL_DEV);
  } else {
    janela.loadFile(path.join(RAIZ, 'dist', 'index.html'));
  }

  return janela;
}

// ---------------------------------------------------------------- IPC de saves

ipcMain.handle('save:listar', async () => {
  const dir = await garantirPastaSaves();
  const arquivos = await fs.readdir(dir);
  const saves = [];
  for (const arq of arquivos) {
    if (!arq.endsWith('.wb2')) continue;
    const info = await fs.stat(path.join(dir, arq));
    saves.push({ nome: arq.slice(0, -4), bytes: info.size, modificado: info.mtimeMs });
  }
  saves.sort((a, b) => b.modificado - a.modificado);
  return saves;
});

ipcMain.handle('save:gravar', async (_e, nome, texto) => {
  const dir = await garantirPastaSaves();
  const seguro = String(nome).replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'mundo';
  await fs.writeFile(path.join(dir, `${seguro}.wb2`), texto, 'utf8');
  return seguro;
});

ipcMain.handle('save:ler', async (_e, nome) => {
  const dir = await garantirPastaSaves();
  const seguro = String(nome).replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  try {
    return await fs.readFile(path.join(dir, `${seguro}.wb2`), 'utf8');
  } catch {
    return null;
  }
});

ipcMain.handle('save:apagar', async (_e, nome) => {
  const dir = await garantirPastaSaves();
  const seguro = String(nome).replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  try {
    await fs.unlink(path.join(dir, `${seguro}.wb2`));
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('app:pastaSaves', async () => garantirPastaSaves());

ipcMain.handle('app:erroFatal', async (_e, mensagem) => {
  dialog.showErrorBox('WorldBox 2 quebrou', String(mensagem));
});

// ------------------------------------------------------------------ ciclo de vida

/**
 * Autoteste: sobe o aplicativo, deixa o jogo rodar alguns segundos, pergunta ao
 * próprio jogo como ele está e fecha. É o que prova que o app abre de verdade —
 * o processo do Electron subir não garante que a janela desenhou coisa alguma.
 *
 *   npm run testar-app
 */
async function autoteste(janela) {
  const erros = [];
  janela.webContents.on('console-message', (_e, nivel, mensagem) => {
    // o aviso de CSP do Electron só aparece em desenvolvimento; não é falha do jogo
    if (nivel >= 2 && !String(mensagem).includes('Electron Security Warning')) {
      erros.push(mensagem);
    }
  });
  janela.webContents.on('render-process-gone', (_e, detalhes) => {
    erros.push(`renderer morreu: ${detalhes.reason}`);
  });

  await new Promise((r) => janela.webContents.once('did-finish-load', r));
  await new Promise((r) => setTimeout(r, 6000));

  const relatorio = await janela.webContents.executeJavaScript(`
    (() => {
      const tela = document.getElementById('tela');
      const painel = document.getElementById('desempenho').innerText;
      const pixels = tela.getContext('2d').getImageData(
        (tela.width / 2) | 0, (tela.height / 2) | 0, 1, 1,
      ).data;
      return {
        temCanvas: !!tela && tela.width > 0,
        pixelCentral: [pixels[0], pixels[1], pixels[2]],
        populacao: document.getElementById('pop-topo').textContent,
        ano: document.getElementById('ano').textContent,
        cronica: document.getElementById('log').childElementCount,
        ferramentas: document.querySelectorAll('.poder').length,
        desempenho: painel.replace(/\\n/g, ' | '),
      };
    })()
  `);

  // Adianta o relógio antes de medir: um mundo no ano zero não tem construção
  // nenhuma, e o caso caro é justamente a vila cheia de casas e árvores.
  await janela.webContents.executeJavaScript(`
    (() => {
      const jogo = window.__wb2jogo;
      if (!jogo) return false;
      for (let i = 0; i < 8000; i++) jogo.mundo.avancar();
      jogo.mundo.recalcularEstatisticas();
      jogo.mundo.grid.marcarTudoSujo();
      const a = jogo.mundo.aldeias.find((v) => v.ativa);
      if (a) {
        jogo.renderizador.camera.x = a.x;
        jogo.renderizador.camera.y = a.y;
      }
      return true;
    })()
  `);

  // Mede o desenho com o mapa aproximado, que é quando o chão detalhado entra.
  // É o caso mais caro do jogo e o que precisa ser vigiado.
  const perto = await janela.webContents.executeJavaScript(`
    (async () => {
      const espera = (ms) => new Promise((r) => setTimeout(r, ms));
      const tela = document.getElementById('tela');
      const r = tela.getBoundingClientRect();
      for (let i = 0; i < 16; i++) {
        tela.dispatchEvent(new WheelEvent('wheel', {
          deltaY: -100, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
          bubbles: true, cancelable: true,
        }));
      }
      await espera(3500);
      return document.getElementById('desempenho').innerText.split(String.fromCharCode(10)).join(' | ');
    })()
  `);
  console.log('--- desenho com o mapa aproximado ---');
  console.log(perto);
  const fpsPerto = Number(/fps\s+(\d+)/.exec(perto)?.[1] ?? 0);
  if (fpsPerto < 30) erros.push(`fps baixo com zoom: ${fpsPerto}`);


  // O painel de ordens é o controle do jogador sobre as civilizações: precisa
  // abrir ao clicar numa aldeia e reagir de fato ao botão.
  const ordens = await janela.webContents.executeJavaScript(`
    (async () => {
      const espera = (ms) => new Promise((r) => setTimeout(r, ms));
      const r = {};
      const jogo = window.__wb2jogo;
      if (!jogo) return { erro: 'jogo nao exposto' };

      const aldeia = jogo.mundo.aldeias.find((a) => a.ativa);
      if (!aldeia) return { erro: 'nenhuma aldeia' };

      window.__wb2selecionarAldeia(aldeia.id);
      await espera(400);

      r.painelAberto = !document.getElementById('bloco-comando').hidden;
      r.botoes = document.querySelectorAll('#comando .btn-comando').length;
      r.focoAntes = aldeia.foco;

      // manda a aldeia focar no exercito (o terceiro botao de foco)
      const focos = document.querySelectorAll('#comando .botoes-comando .btn-comando');
      if (focos[2]) focos[2].click();
      await espera(300);
      r.focoDepois = jogo.mundo.aldeias[aldeia.id].foco;
      r.mensagem = (document.querySelector('.aviso-comando') || {}).textContent || '';
      r.linhasDiplomacia = document.querySelectorAll('#comando .linha-diplomacia').length;
      return r;
    })()
  `);
  console.log('--- painel de ordens ---');
  console.log(JSON.stringify(ordens, null, 2));
  const ordensOk =
    ordens.painelAberto === true &&
    ordens.botoes >= 5 &&
    ordens.focoDepois === 2 &&
    ordens.focoDepois !== ordens.focoAntes;
  if (!ordensOk) erros.push('o painel de ordens nao respondeu como devia');

  // Exercita as janelas de salvar e carregar. Elas mexem em disco e em
  // formulário, que é onde os defeitos se escondem — e é a parte que não dá
  // para conferir pelo navegador, porque lá o armazenamento é outro.
  const dialogos = await janela.webContents.executeJavaScript(`
    (async () => {
      const espera = (ms) => new Promise((r) => setTimeout(r, ms));
      const $ = (id) => document.getElementById(id);
      const r = {};

      r.temCaixaMigracao = !!$('in-migracao');

      $('btn-salvar').click();
      await espera(300);
      r.modoSalvar_campoNomeVisivel = getComputedStyle($('campo-nome-save')).display !== 'none';
      $('in-nome-save').value = 'autoteste';
      $('btn-confirmar-save').click();
      await espera(1500);

      $('btn-carregar').click();
      await espera(800);
      r.modoCarregar_campoNomeEscondido = getComputedStyle($('campo-nome-save')).display === 'none';
      r.saves = [...document.querySelectorAll('#lista-saves .save-item span:first-child')]
        .map((e) => e.textContent);
      r.ondeFicam = ($('onde-ficam').textContent || '').length > 0;

      const apagar = document.querySelector('#lista-saves .save-item button');
      r.tipoBotaoApagar = apagar ? apagar.type : 'nenhum';
      if (apagar) {
        apagar.click();
        await espera(900);
        r.aoApagar_dialogoSegueAberto = $('dlg-saves').open;
        r.aoApagar_itensRestantes = document.querySelectorAll('#lista-saves .save-item').length;
      }
      $('dlg-saves').close('cancelar');
      return r;
    })()
  `);

  console.log('--- autoteste do aplicativo ---');
  console.log(JSON.stringify(relatorio, null, 2));
  console.log('--- janelas de salvar e carregar ---');
  console.log(JSON.stringify(dialogos, null, 2));

  const dialogosOk =
    dialogos.temCaixaMigracao &&
    dialogos.modoSalvar_campoNomeVisivel &&
    dialogos.modoCarregar_campoNomeEscondido &&
    dialogos.saves.length === 1 &&
    dialogos.saves[0] === 'autoteste' &&
    dialogos.ondeFicam &&
    dialogos.tipoBotaoApagar === 'button' &&
    dialogos.aoApagar_dialogoSegueAberto === true &&
    dialogos.aoApagar_itensRestantes === 0;
  if (!dialogosOk) erros.push('janelas de salvar/carregar se comportaram de forma inesperada');
  console.log(erros.length === 0 ? 'sem erros de console' : `ERROS: ${erros.join(' / ')}`);

  const pintou = relatorio.pixelCentral.some((v) => v > 8);
  const vivo = Number(relatorio.populacao) > 0;
  const ok = relatorio.temCanvas && pintou && vivo && erros.length === 0;
  console.log(ok ? 'RESULTADO: ok' : 'RESULTADO: FALHOU');
  app.exit(ok ? 0 : 1);
}

app.whenReady().then(() => {
  aplicarPolitica();
  const janela = criarJanela();
  if (process.env.WB2_TESTE) autoteste(janela);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
