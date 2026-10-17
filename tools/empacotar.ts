/**
 * Monta o pacote de uma versão: `release/worldbox-2-<versão>.zip` e o
 * `.sha256` dele.
 *
 *   npm run pacote
 *
 * É o que a release do GitHub carrega e o que o botão de atualizar baixa. Leva
 * só o que o jogo precisa para rodar (o build em `dist/`, o processo do
 * Electron, o inicializador, o instalador e os textos), nunca dado de quem
 * joga: os mundos salvos moram fora daqui.
 *
 * Roda depois do `vite build` (o script do npm já encadeia os dois).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { criarZip } from '../electron/zip.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** O que entra no pacote: arquivos soltos e pastas inteiras. */
const ARQUIVOS = ['package.json', 'CHANGELOG.md', 'LICENSE', 'README.md'];
const PASTAS = ['dist', 'instalador'];
const DO_ELECTRON = ['main.js', 'preload.cjs', 'atualizador.js', 'zip.js'];

function listarPasta(rel: string): string[] {
  const saida: string[] = [];
  const abs = path.join(RAIZ, rel);
  for (const item of fs.readdirSync(abs, { withFileTypes: true })) {
    const filho = `${rel}/${item.name}`;
    if (item.isDirectory()) saida.push(...listarPasta(filho));
    else saida.push(filho);
  }
  return saida;
}

export function montarPacote(): { zip: string; sha: string; versao: string; hash: string } {
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  const versao: string = pkg.version;
  const electronInstalado = JSON.parse(
    fs.readFileSync(path.join(RAIZ, 'node_modules', 'electron', 'package.json'), 'utf8'),
  ).version;
  if (pkg.versaoElectron !== electronInstalado) {
    throw new Error(
      `package.json diz versaoElectron ${pkg.versaoElectron}, mas o Electron instalado é ${electronInstalado}. ` +
      'O instalador baixa a versão do package.json: as duas têm de bater.',
    );
  }
  if (!fs.existsSync(path.join(RAIZ, 'dist', 'index.html'))) {
    throw new Error('Falta o build (dist/index.html). Rode npm run pacote, que faz o build antes.');
  }

  const nomes = [
    ...ARQUIVOS,
    ...DO_ELECTRON.map((n) => `electron/${n}`),
    ...PASTAS.flatMap((p) => listarPasta(p)),
  ].sort();
  const arquivos = nomes.map((nome) => ({ nome, dados: fs.readFileSync(path.join(RAIZ, ...nome.split('/'))) }));
  const zip = criarZip(arquivos);
  const hash = crypto.createHash('sha256').update(zip).digest('hex');

  const pasta = path.join(RAIZ, 'release');
  fs.mkdirSync(pasta, { recursive: true });
  const arqZip = path.join(pasta, `worldbox-2-${versao}.zip`);
  const arqSha = `${arqZip}.sha256`;
  fs.writeFileSync(arqZip, zip);
  fs.writeFileSync(arqSha, `${hash}  worldbox-2-${versao}.zip\n`, 'utf8');
  return { zip: arqZip, sha: arqSha, versao, hash };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/empacotar.ts')) {
  const r = montarPacote();
  console.log(`pacote: ${path.relative(RAIZ, r.zip)} (${(fs.statSync(r.zip).size / 1024).toFixed(0)} KB)`);
  console.log(`sha256: ${r.hash}`);
}
