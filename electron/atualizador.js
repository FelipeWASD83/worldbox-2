import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { lerZip } from './zip.js';

/**
 * Procurar e instalar atualização pelas releases do GitHub.
 *
 * O jogo pergunta ao GitHub qual é a release mais nova do repositório, compara
 * com a própria versão (`package.json`) e mostra o que mudou (as notas da
 * release, que são a seção do CHANGELOG). Ao atualizar:
 *
 * 1. baixa o pacote `worldbox-2-<versão>.zip` da release;
 * 2. confere o SHA-256 contra o que o GitHub informa do arquivo (ou, na falta
 *    dele, contra o `.sha256` publicado junto) — sem conferência, não instala;
 * 3. lê o zip na memória, recusa caminho estranho, confere que é mesmo o
 *    WorldBox 2 daquela versão e grava em `nova/` dentro da instalação;
 * 4. reabre o jogo, e quem põe a versão nova no lugar é o inicializador
 *    (`instalador/inicio/`), que também volta atrás se ela não abrir.
 *
 * Só código entra no pacote. Os mundos salvos ficam na pasta de dados do
 * usuário e nunca são tocados.
 *
 * Isto só instala na **cópia instalada** (a do atalho, criada pelo
 * `ferramentas/instalar.ps1`). Rodando da pasta do projeto, que é uma cópia com
 * git, o botão procura e mostra a versão nova, mas manda atualizar com `git
 * pull`: trocar arquivos de um repositório por baixo do git deixaria a pasta
 * suja de mudanças que ninguém fez.
 */

export const REPOSITORIO = 'FelipeWASD83/worldbox-2';

/** De onde vem a resposta do GitHub. Os testes apontam para um servidor local. */
function api() {
  return (process.env.WB2_API_ATUALIZACAO || 'https://api.github.com').replace(/\/$/, '');
}

export function versaoTupla(v) {
  const partes = String(v || '0').replace(/^[vV]/, '').split('.').map((p) => parseInt(p, 10) || 0);
  while (partes.length < 3) partes.push(0);
  return partes.slice(0, 3);
}

export function maisNova(a, b) {
  const x = versaoTupla(a);
  const y = versaoTupla(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

export function nomeDoPacote(versao) {
  return `worldbox-2-${versao}.zip`;
}

/** Arquivos que todo pacote tem de ter para ser o jogo. */
const OBRIGATORIOS = ['package.json', 'electron/main.js', 'electron/preload.cjs', 'dist/index.html'];

async function pedirJson(url) {
  const r = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'WorldBox-2',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (r.status === 404) {
    throw new Error('O repositório ainda não tem nenhuma versão publicada.');
  }
  if (!r.ok) throw new Error(`O GitHub respondeu ${r.status}.`);
  return r.json();
}

async function baixarBuffer(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'WorldBox-2', Accept: 'application/octet-stream' } });
  if (!r.ok) throw new Error(`O download falhou (${r.status}).`);
  return Buffer.from(await r.arrayBuffer());
}

/**
 * O estado do atualizador neste processo.
 *
 * `raiz` é a pasta do jogo que está rodando (onde mora o `package.json`);
 * `base` é a pasta da instalação, ou null quando o jogo roda da pasta do
 * projeto.
 */
export function criarAtualizador({ raiz, base, versaoElectron }) {
  let ultima = null;

  async function versaoAtual() {
    const pkg = JSON.parse(await fs.readFile(path.join(raiz, 'package.json'), 'utf8'));
    return pkg.version;
  }

  async function estado() {
    let revertida = null;
    let acabouDeAtualizar = process.env.WB2_ACABOU_DE_ATUALIZAR || null;
    if (base) {
      try {
        const e = JSON.parse(await fs.readFile(path.join(base, 'estado.json'), 'utf8'));
        if (e.revertida && Date.now() - (e.revertida.em ?? 0) < 10 * 60 * 1000) revertida = e.revertida;
      } catch {
        // instalação recém-feita, sem estado ainda
      }
    }
    return {
      versao: await versaoAtual(),
      instalado: Boolean(base),
      repositorio: REPOSITORIO,
      revertida,
      acabouDeAtualizar,
    };
  }

  async function checar() {
    const atual = await versaoAtual();
    const rel = await pedirJson(`${api()}/repos/${REPOSITORIO}/releases/latest`);
    const versao = String(rel.tag_name || '').replace(/^[vV]/, '');
    const nome = nomeDoPacote(versao);
    const pacote = (rel.assets || []).find((a) => a.name === nome) || null;
    const conferencia = (rel.assets || []).find((a) => a.name === `${nome}.sha256`) || null;
    ultima = { versao, pacote, conferencia };
    return {
      atual,
      ultima: versao,
      nova: maisNova(versao, atual),
      notas: rel.body || '',
      pagina: rel.html_url || '',
      publicadaEm: rel.published_at || '',
      temPacote: Boolean(pacote),
    };
  }

  /** O SHA-256 que o pacote tem de ter, pelo GitHub ou pelo arquivo `.sha256`. */
  async function hashEsperado(pacote, conferencia) {
    const digest = String(pacote.digest || '');
    if (digest.startsWith('sha256:')) return digest.slice(7).toLowerCase();
    if (conferencia) {
      const texto = (await baixarBuffer(conferencia.browser_download_url)).toString('utf8');
      const m = /\b([0-9a-fA-F]{64})\b/.exec(texto);
      if (m) return m[1].toLowerCase();
    }
    return null;
  }

  /** Baixa, confere e deixa a versão nova em `nova/`, pronta para o próximo início. */
  async function baixar() {
    if (!base) {
      throw new Error('Esta é a pasta do projeto (cópia com git): atualize com git pull. O atalho instalado se atualiza por aqui.');
    }
    const info = await checar();
    if (!info.nova) throw new Error('Você já está na versão mais nova.');
    const { pacote, conferencia } = ultima;
    if (!pacote) throw new Error(`A release ${info.ultima} não tem o pacote ${nomeDoPacote(info.ultima)}.`);

    const esperado = await hashEsperado(pacote, conferencia);
    if (!esperado) throw new Error('A release não diz o SHA-256 do pacote: sem conferir, não instalo.');
    const dados = await baixarBuffer(pacote.browser_download_url);
    const obtido = crypto.createHash('sha256').update(dados).digest('hex');
    if (obtido !== esperado) {
      throw new Error('O pacote baixado não confere com o SHA-256 da release. Nada foi trocado.');
    }

    const arquivos = lerZip(dados);
    const nomes = new Set(arquivos.map((a) => a.nome));
    for (const obrigatorio of OBRIGATORIOS) {
      if (!nomes.has(obrigatorio)) throw new Error(`O pacote está incompleto (falta ${obrigatorio}).`);
    }
    const pkg = JSON.parse(arquivos.find((a) => a.nome === 'package.json').dados.toString('utf8'));
    if (pkg.name !== 'worldbox-2') throw new Error('O pacote não é do WorldBox 2.');
    if (versaoTupla(pkg.version).join('.') !== versaoTupla(info.ultima).join('.')) {
      throw new Error(`O pacote diz versão ${pkg.version}, mas a release é ${info.ultima}.`);
    }
    // O Electron é do instalador, não do pacote. Versão que pede outro
    // Electron precisa do instalador de novo, e trocar só o jogo por cima
    // abriria um jogo feito para outro Electron.
    if (pkg.versaoElectron && versaoElectron && pkg.versaoElectron !== versaoElectron) {
      throw new Error(`A versão ${info.ultima} pede o Electron ${pkg.versaoElectron}; rode o instalador de novo para atualizar.`);
    }

    const temp = path.join(base, 'nova-baixando');
    const nova = path.join(base, 'nova');
    await fs.rm(temp, { recursive: true, force: true });
    await fs.rm(nova, { recursive: true, force: true });
    for (const { nome, dados: conteudo } of arquivos) {
      const alvo = path.join(temp, ...nome.split('/'));
      if (!alvo.startsWith(temp + path.sep)) throw new Error(`caminho inválido no pacote: ${nome}`);
      await fs.mkdir(path.dirname(alvo), { recursive: true });
      await fs.writeFile(alvo, conteudo);
    }
    // a marca vai por último: sem ela, o inicializador trata a pasta como
    // download pela metade e a apaga
    await fs.writeFile(path.join(temp, 'PRONTA.json'), JSON.stringify({ versao: info.ultima }), 'utf8');
    await fs.rename(temp, nova);
    return { versao: info.ultima };
  }

  return { estado, checar, baixar };
}
