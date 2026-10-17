import fs from 'node:fs';
import path from 'node:path';

/**
 * A troca de versão da cópia instalada, e a volta atrás.
 *
 * Mora no inicializador (`instalador/inicio/`), que **nunca é atualizado**: o
 * instalador o copia uma vez para fora da pasta `app/`, e o atualizador só
 * mexe em `app/`. É o que permite voltar atrás quando a versão nova não abre —
 * se quem desfaz a troca morasse dentro da versão nova, uma versão quebrada não
 * conseguiria se desfazer.
 *
 * A pasta da instalação fica assim:
 *
 *   electron/   o Electron oficial (só o instalador troca)
 *   inicio/     este código (só o instalador troca)
 *   app/        a versão em uso
 *   nova/       a versão baixada, esperando o próximo início (com PRONTA.json)
 *   anterior/   a versão de antes da última troca, para voltar atrás
 *   estado.json { versao, emTeste, revertida? }
 *
 * Os mundos salvos não moram aqui: ficam na pasta de dados do usuário, onde o
 * Electron guarda tudo do app, e nada daqui encosta neles.
 */

export function lerEstado(base) {
  try {
    return JSON.parse(fs.readFileSync(path.join(base, 'estado.json'), 'utf8'));
  } catch {
    return { emTeste: false };
  }
}

export function gravarEstado(base, estado) {
  fs.writeFileSync(path.join(base, 'estado.json'), JSON.stringify(estado, null, 1), 'utf8');
}

function apagar(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

/**
 * Se há versão baixada esperando, põe ela no lugar da atual e guarda a atual
 * em `anterior/`. Devolve a versão nova, ou null se não havia nada.
 */
export function aplicarPendente(base) {
  const nova = path.join(base, 'nova');
  const pronta = path.join(nova, 'PRONTA.json');
  if (!fs.existsSync(pronta)) {
    // download pela metade: nunca vira versão em uso
    if (fs.existsSync(nova)) apagar(nova);
    return null;
  }
  const info = JSON.parse(fs.readFileSync(pronta, 'utf8'));
  fs.rmSync(pronta);
  const app = path.join(base, 'app');
  const anterior = path.join(base, 'anterior');
  apagar(anterior);
  if (fs.existsSync(app)) fs.renameSync(app, anterior);
  try {
    fs.renameSync(nova, app);
  } catch (e) {
    // não deu para pôr a nova no lugar: a de antes volta, e a troca fica para outro dia
    if (fs.existsSync(anterior) && !fs.existsSync(app)) fs.renameSync(anterior, app);
    throw e;
  }
  gravarEstado(base, { versao: info.versao, emTeste: true, desde: Date.now() });
  return info.versao;
}

/**
 * A versão nova não abriu: a anterior volta para `app/`. Devolve se voltou.
 * A versão que falhou vai para `recusada/`, para dar para olhar depois.
 */
export function reverter(base, motivo) {
  const app = path.join(base, 'app');
  const anterior = path.join(base, 'anterior');
  if (!fs.existsSync(anterior)) return false;
  const estado = lerEstado(base);
  const recusada = path.join(base, 'recusada');
  apagar(recusada);
  if (fs.existsSync(app)) fs.renameSync(app, recusada);
  fs.renameSync(anterior, app);
  let versaoVolta = '';
  try {
    versaoVolta = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).version;
  } catch {
    // sem package.json legível: o estado fica sem número, e o jogo lê o dele ao abrir
  }
  gravarEstado(base, {
    versao: versaoVolta,
    emTeste: false,
    revertida: { de: estado.versao ?? '', motivo: String(motivo ?? ''), em: Date.now() },
  });
  return true;
}

/** A versão nova abriu e o jogo rodou: deixa de estar em teste. */
export function confirmar(base) {
  const estado = lerEstado(base);
  if (!estado.emTeste) return;
  gravarEstado(base, { ...estado, emTeste: false });
}
