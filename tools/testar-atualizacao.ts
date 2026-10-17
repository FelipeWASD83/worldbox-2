/**
 * Testes do botão de atualizar, sem abrir janela nem falar com o GitHub.
 *
 *   npm run testar-atualizacao
 *
 * Um servidor local faz o papel da API do GitHub (release mais nova, pacote e
 * `.sha256`), e uma pasta temporária faz o papel da instalação. O que se
 * confere: que a versão nova é achada, baixada, conferida e posta no lugar pelo
 * inicializador; que a anterior volta quando a nova falha; e que pacote
 * adulterado, pacote de outro Electron, caminho malicioso no zip e a pasta do
 * projeto são recusados sem mexer em nada.
 *
 * O teste com a janela de verdade (o Electron abrindo, atualizando e voltando
 * atrás) é o `npm run testar-atualizacao -- --electron`, mais lento porque
 * instala uma cópia de verdade numa pasta temporária.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { caminhoSeguro, criarZip, lerZip } from '../electron/zip.js';
import { criarAtualizador, maisNova } from '../electron/atualizador.js';
import { aplicarPendente, confirmar, lerEstado, reverter } from '../instalador/inicio/troca.js';
import { montarPacote } from './empacotar.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let falhas = 0;
const ok = (nome: string, cond: boolean, extra = ''): void => {
  console.log(`${cond ? 'ok   ' : 'FALHA'} ${nome}${extra ? ' — ' + extra : ''}`);
  if (!cond) falhas++;
};
const sha = (b: Buffer): string => crypto.createHash('sha256').update(b).digest('hex');

/** O pacote atual, com a versão (e o que mais se queira) trocado no package.json. */
function pacoteVariante(base: Buffer, mexer: (pkg: Record<string, unknown>) => void, extra?: (arqs: { nome: string; dados: Buffer }[]) => void): Buffer {
  const arquivos = lerZip(base);
  const p = arquivos.find((a) => a.nome === 'package.json')!;
  const pkg = JSON.parse(p.dados.toString('utf8'));
  mexer(pkg);
  p.dados = Buffer.from(JSON.stringify(pkg, null, 2));
  extra?.(arquivos);
  return criarZip(arquivos);
}

/** Um GitHub de mentira: uma release, com o pacote e o .sha256 que se mandar. */
async function servidor(release: { versao: string; zip: Buffer; shaDeclarado?: string; digest?: boolean }) {
  const nome = `worldbox-2-${release.versao}.zip`;
  const srv = http.createServer((req, res) => {
    const url = req.url ?? '';
    const base = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
    if (url.endsWith('/releases/latest')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        tag_name: `v${release.versao}`,
        body: '**Novo**\n\n- coisa nova',
        html_url: `${base}/release`,
        assets: [
          { name: nome, browser_download_url: `${base}/baixar/${nome}`, digest: release.digest ? `sha256:${release.shaDeclarado ?? sha(release.zip)}` : null },
          { name: `${nome}.sha256`, browser_download_url: `${base}/baixar/${nome}.sha256` },
        ],
      }));
    } else if (url.endsWith('.sha256')) {
      res.end(`${release.shaDeclarado ?? sha(release.zip)}  ${nome}\n`);
    } else if (url.endsWith('.zip')) {
      res.end(release.zip);
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  process.env.WB2_API_ATUALIZACAO = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  return srv;
}

/** Uma instalação de mentira com o pacote atual extraído em app/. */
function instalacao(pacote: Buffer): string {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wb2-att-'));
  for (const { nome, dados } of lerZip(pacote)) {
    const alvo = path.join(base, 'app', ...nome.split('/'));
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.writeFileSync(alvo, dados);
  }
  return base;
}

const versaoDe = (pasta: string): string =>
  JSON.parse(fs.readFileSync(path.join(pasta, 'package.json'), 'utf8')).version;

async function testesSemJanela(): Promise<void> {
  // ------------------------------------------------------------- o zip
  const arquivos = [
    { nome: 'a.txt', dados: Buffer.from('olá') },
    { nome: 'pasta/b.bin', dados: crypto.randomBytes(5000) },
  ];
  const volta = lerZip(criarZip(arquivos));
  ok('o zip volta igual ao que entrou', volta.length === 2 && volta.every((v, k) => v.dados.equals(arquivos[k].dados)));
  ok('caminho com .. , absoluto ou com unidade é recusado',
     !caminhoSeguro('../x') && !caminhoSeguro('a/../../x') && !caminhoSeguro('/x') && !caminhoSeguro('C:/x') && !caminhoSeguro('a\\b') && caminhoSeguro('dist/index.html'));
  // zip com caminho malicioso, montado à mão (o criarZip se recusa a fazer um)
  const bom = criarZip([{ nome: 'xx/evil.txt', dados: Buffer.from('mal') }]);
  const mau = Buffer.from(bom.toString('latin1').split('xx/evil.txt').join('../evil.txt'), 'latin1');
  let recusou = false;
  try { lerZip(mau); } catch { recusou = true; }
  ok('zip com ../ no caminho é recusado antes de gravar qualquer coisa', recusou);
  const corrompido = Buffer.from(criarZip([{ nome: 'a.txt', dados: Buffer.from('abcdefgh'.repeat(50)) }]));
  corrompido[40] ^= 0xff;
  recusou = false;
  try { lerZip(corrompido); } catch { recusou = true; }
  ok('arquivo corrompido dentro do zip é recusado', recusou);
  ok('a comparação de versão sabe que 2.10.0 é mais nova que 2.9.9', maisNova('2.10.0', '2.9.9') && !maisNova('2.0.0', '2.0.0') && maisNova('v3.0.0', '2.9.9'));

  // ------------------------------------------------------------- o caminho feliz
  const { zip: arqZip } = montarPacote();
  const atual = fs.readFileSync(arqZip);
  const versaoAtual = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).version;
  const nova = pacoteVariante(atual, (pkg) => { pkg.version = '9.9.9'; });

  let srv = await servidor({ versao: '9.9.9', zip: nova, digest: false });
  let base = instalacao(atual);
  const att = criarAtualizador({ raiz: path.join(base, 'app'), base, versaoElectron: '33.4.11' });
  const achou = await att.checar();
  ok('acha a versão nova na release', achou.nova && achou.ultima === '9.9.9' && achou.atual === versaoAtual && achou.notas.includes('coisa nova'),
     `${achou.atual} → ${achou.ultima}`);
  await att.baixar();
  ok('baixa, confere pelo .sha256 e deixa pronta em nova/', fs.existsSync(path.join(base, 'nova', 'PRONTA.json')) && versaoDe(path.join(base, 'nova')) === '9.9.9');
  ok('a versão em uso não foi tocada antes de reabrir', versaoDe(path.join(base, 'app')) === versaoAtual);
  ok('o inicializador põe a nova no lugar', aplicarPendente(base) === '9.9.9' && versaoDe(path.join(base, 'app')) === '9.9.9' && versaoDe(path.join(base, 'anterior')) === versaoAtual);
  ok('e ela fica em teste até abrir', lerEstado(base).emTeste === true);
  ok('se ela não abrir, a anterior volta', reverter(base, 'teste') && versaoDe(path.join(base, 'app')) === versaoAtual && fs.existsSync(path.join(base, 'recusada')));
  const estadoVolta = lerEstado(base);
  ok('e o jogo fica sabendo que voltou', !estadoVolta.emTeste && estadoVolta.revertida?.de === '9.9.9');
  // e de novo, agora confirmando
  await att.baixar();
  aplicarPendente(base);
  confirmar(base);
  ok('versão que abriu deixa de estar em teste', lerEstado(base).emTeste === false && versaoDe(path.join(base, 'app')) === '9.9.9');
  ok('download pela metade nunca vira versão em uso', (() => {
    fs.mkdirSync(path.join(base, 'nova', 'electron'), { recursive: true });
    const r = aplicarPendente(base);
    return r === null && !fs.existsSync(path.join(base, 'nova')) && versaoDe(path.join(base, 'app')) === '9.9.9';
  })());
  srv.close();

  // ------------------------------------------------------------- pelo digest do GitHub
  srv = await servidor({ versao: '9.9.9', zip: nova, digest: true });
  base = instalacao(atual);
  await criarAtualizador({ raiz: path.join(base, 'app'), base }).baixar();
  ok('também confere pelo SHA-256 que o GitHub informa do arquivo', fs.existsSync(path.join(base, 'nova', 'PRONTA.json')));
  srv.close();

  // ------------------------------------------------------------- recusas
  const recusa = async (nome: string, release: Parameters<typeof servidor>[0], opcoes: { base?: boolean } = {}) => {
    const s = await servidor(release);
    const b = instalacao(atual);
    let erro = '';
    try {
      await criarAtualizador({ raiz: path.join(b, 'app'), base: opcoes.base === false ? null : b, versaoElectron: '33.4.11' }).baixar();
    } catch (e) {
      erro = String((e as Error).message);
    }
    s.close();
    const intacto = versaoDe(path.join(b, 'app')) === versaoAtual && !fs.existsSync(path.join(b, 'nova'));
    ok(nome, erro !== '' && intacto, erro);
  };
  await recusa('pacote adulterado (SHA-256 não confere) é recusado', { versao: '9.9.9', zip: nova, shaDeclarado: '0'.repeat(64) });
  await recusa('pacote que diz outra versão é recusado', { versao: '9.9.8', zip: nova });
  await recusa('pacote para outro Electron é recusado (pede o instalador)',
    { versao: '9.9.9', zip: pacoteVariante(atual, (pkg) => { pkg.version = '9.9.9'; pkg.versaoElectron = '99.0.0'; }) });
  await recusa('pacote sem o jogo dentro é recusado',
    { versao: '9.9.9', zip: pacoteVariante(atual, (pkg) => { pkg.version = '9.9.9'; }, (arqs) => {
      const k = arqs.findIndex((a) => a.nome === 'dist/index.html');
      arqs.splice(k, 1);
    }) });
  await recusa('na pasta do projeto o botão manda usar git pull', { versao: '9.9.9', zip: nova }, { base: false });
  await recusa('sem versão nova, não baixa nada', { versao: versaoAtual, zip: atual });
}

/**
 * A janela de verdade: instala numa pasta temporária pelo instalador, abre o
 * Electron pelo inicializador, deixa o jogo atualizar sozinho para uma versão
 * boa e depois para uma quebrada, e confere o que aconteceu pelo registro que
 * o jogo escreve (`WB2_ROTEIRO_ATUALIZACAO`).
 */
async function testeComJanela(): Promise<void> {
  const { zip: arqZip } = montarPacote();
  const atual = fs.readFileSync(arqZip);
  const versaoAtual = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).version;
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'wb2-instalado-'));
  const inst = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(RAIZ, 'instalador', 'instalar.ps1'), '-Pasta', pasta, '-Pacote', arqZip, '-SemAtalho'], { encoding: 'utf8' });
  ok('o instalador instala numa pasta nova', inst.status === 0 && fs.existsSync(path.join(pasta, 'electron', 'electron.exe')),
     inst.status === 0 ? '' : (inst.stderr || inst.stdout).slice(-300));
  if (inst.status !== 0) return;

  const rodar = async (release: Parameters<typeof servidor>[0], alvo: string) => {
    const srv = await servidor(release);
    const log = path.join(pasta, `roteiro-${release.versao}.log`);
    fs.rmSync(log, { force: true });
    // Assíncrono de propósito: o GitHub de mentira roda neste mesmo processo,
    // e uma espera bloqueante (spawnSync) o deixava sem responder ao jogo.
    spawn(path.join(pasta, 'electron', 'electron.exe'), [path.join(pasta, 'inicio')], {
      env: { ...process.env, WB2_ROTEIRO_ATUALIZACAO: log, WB2_ROTEIRO_ALVO: alvo },
      stdio: 'ignore',
      detached: false,
    });
    // o jogo reaberto pelo relaunch é outro processo: espera-se pelo registro
    const limite = Date.now() + 240000;
    while (Date.now() < limite) {
      const linhas = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : [];
      if (linhas.some((l) => l.includes('"fim"'))) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    srv.close();
    return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  };

  const boa = pacoteVariante(atual, (pkg) => { pkg.version = '9.9.9'; });
  const r1 = await rodar({ versao: '9.9.9', zip: boa }, '9.9.9');
  ok('na janela: abre, baixa, reabre e a versão nova abre', r1.some((l) => l.versao === versaoAtual && l.baixou === '9.9.9') && r1.some((l) => l.versao === '9.9.9' && l.fim),
     JSON.stringify(r1));
  ok('e a nova fica confirmada', lerEstado(pasta).emTeste === false);

  const quebrada = pacoteVariante(boa, (pkg) => { pkg.version = '9.9.10'; }, (arqs) => {
    const m = arqs.find((a) => a.nome === 'electron/main.js')!;
    m.dados = Buffer.from(`throw new Error('versão quebrada de propósito');\n${m.dados.toString('utf8')}`);
  });
  const r2 = await rodar({ versao: '9.9.10', zip: quebrada }, '9.9.10');
  const estado = lerEstado(pasta);
  ok('na janela: versão que não abre é desfeita e a anterior volta sozinha',
     versaoDe(path.join(pasta, 'app')) === '9.9.9' && estado.revertida?.de === '9.9.10' && r2.some((l) => l.versao === '9.9.9' && l.fim),
     `${JSON.stringify(r2)} · ${JSON.stringify(estado)}`);
  fs.rmSync(pasta, { recursive: true, force: true });
}

await testesSemJanela();
if (process.argv.includes('--electron')) await testeComJanela();
console.log('');
console.log(falhas === 0 ? 'TUDO OK' : `${falhas} FALHAS`);
process.exit(falhas === 0 ? 0 : 1);
