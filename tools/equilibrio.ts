/**
 * Mede o equilíbrio entre os povos em várias sementes de uma vez.
 *
 *   npm run equilibrio
 *   npm run equilibrio -- --ticks 30000 --sementes 8 --tamanho medio
 *
 * Uma semente só não diz nada sobre equilíbrio: o mesmo ajuste que salva os
 * anões num mapa os afoga no seguinte. Aqui cada semente roda num processo
 * próprio (quatro de cada vez), e o relatório soma tudo: a fatia de cada povo
 * na população civilizada do fim, quantas vezes cada um foi varrido do mapa,
 * quão dominante foi o maior, e quanto do crescimento veio de dentro das casas.
 *
 * O que olhar primeiro é a linha "dominância média" e a coluna "sumiu": um
 * mundo equilibrado tem o maior povo com bem menos da metade da gente e nenhum
 * povo sumindo em mais de uma ou duas sementes.
 *
 * Para experimentar um número sem mexer no arquivo, `--bal chave=valor` (pode
 * repetir; lista com `|`, como `--bal estacaoLavoura=1|1|1|1`). O valor vale só
 * para aquela rodada.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Mundo, TAMANHOS } from '../src/core/mundo.js';
import { montarPipeline } from '../src/sim/index.js';
import { gerarTerreno, povoar } from '../src/sim/geracao.js';
import { ESP_INTELIGENTE, especies } from '../src/dados/especies.js';
import { BAL } from '../src/sim/balanco.js';

interface Resultado {
  semente: string;
  /** População final de cada povo civilizado, pelo id de texto. */
  povos: Record<string, number>;
  /** Em quantos ticks medidos cada povo esteve com zero gente. */
  ausente: Record<string, number>;
  /** Fatia do maior povo, média ao longo da partida. */
  dominancia: number;
  emCasa: number;
  deFora: number;
  mesticos: number;
  negocios: number;
  guerras: number;
  reinosNoFim: number;
  msPorTick: number;
}

const POVOS = ['humano', 'elfo', 'anao', 'orc'];

function argumento(nome: string, padrao: string): string {
  const a = process.argv.slice(2);
  const i = a.indexOf(`--${nome}`);
  return i >= 0 && a[i + 1] ? a[i + 1] : padrao;
}

/** Os `--bal chave=valor` da linha de comando, aplicados sobre o balanço. */
function ajustesDaLinha(): string[] {
  const a = process.argv.slice(2);
  const saida: string[] = [];
  for (let k = 0; k < a.length; k++) if (a[k] === '--bal' && a[k + 1]) saida.push(a[++k]);
  return saida;
}

function aplicarAjustes(ajustes: string[]): void {
  const bal = BAL as unknown as Record<string, unknown>;
  for (const aj of ajustes) {
    const [chave, valor] = aj.split('=');
    if (!(chave in bal)) throw new Error(`BAL.${chave} não existe`);
    bal[chave] = valor.includes('|') ? valor.split('|').map(Number) : Number(valor);
  }
}

function rodarUma(semente: string, ticks: number, tamanho: string): Resultado {
  aplicarAjustes(ajustesDaLinha());
  const t = TAMANHOS.find((x) => x.id === tamanho) ?? TAMANHOS[1];
  const m = new Mundo(t, semente);
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 4 });
  let emCasa = 0;
  let deFora = 0;
  m.eventos.on('criatura:nasceu', (d) => {
    if (ESP_INTELIGENTE[d.especie] !== 1) return;
    if (d.origem === 'casa') emCasa++;
    else if (d.origem === 'imigracao') deFora++;
  });
  const ausente: Record<string, number> = {};
  for (const p of POVOS) ausente[p] = 0;
  let somaDominancia = 0;
  let amostras = 0;
  const indice = Object.fromEntries(POVOS.map((p) => [p, especies.indice(p)]));
  const t0 = performance.now();
  for (let k = 0; k < ticks; k++) {
    m.avancar();
    if (k % 1000 === 999) {
      m.recalcularEstatisticas();
      const pe = m.estatisticas.porEspecie;
      let total = 0;
      let maior = 0;
      for (const p of POVOS) {
        const n = pe[indice[p]];
        total += n;
        maior = Math.max(maior, n);
        if (n === 0) ausente[p]++;
      }
      if (total > 0) {
        somaDominancia += maior / total;
        amostras++;
      }
    }
  }
  const ms = (performance.now() - t0) / ticks;
  m.recalcularEstatisticas();
  const povos: Record<string, number> = {};
  for (const p of POVOS) povos[p] = m.estatisticas.porEspecie[indice[p]];
  return {
    semente,
    povos,
    ausente,
    dominancia: amostras > 0 ? somaDominancia / amostras : 1,
    emCasa,
    deFora,
    mesticos: m.eventos.contagem.get('criatura:mesticou') ?? 0,
    negocios: m.eventos.contagem.get('comercio:feito') ?? 0,
    guerras: m.eventos.contagem.get('reino:guerra') ?? 0,
    reinosNoFim: m.reinos.filter((r) => r.ativo).length,
    msPorTick: ms,
  };
}

/**
 * Roda uma semente num processo próprio, tentando de novo se ele cair.
 *
 * A simulação é determinística por semente, então repetir dá o mesmo número.
 * O que derruba o filho é a máquina sem memória livre para o compilador do V8
 * ("Zone Allocation failed"), não o jogo: aconteceu com outras sessões rodando
 * ao lado, e uma semente perdida abortava a medição inteira.
 */
async function rodarFilho(semente: string, ticks: number, tamanho: string): Promise<Resultado> {
  let erro: unknown = null;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      return await rodarFilhoUmaVez(semente, ticks, tamanho);
    } catch (e) {
      erro = e;
      console.error(`  (semente ${semente} caiu, tentando de novo)`);
    }
  }
  throw erro;
}

function rodarFilhoUmaVez(semente: string, ticks: number, tamanho: string): Promise<Resultado> {
  return new Promise((resolve, reject) => {
    const eu = fileURLToPath(import.meta.url);
    const p = spawn(
      process.execPath,
      [
        '--import', 'tsx', eu, '--uma', semente, '--ticks', String(ticks), '--tamanho', tamanho,
        ...ajustesDaLinha().flatMap((aj) => ['--bal', aj]),
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    let saida = '';
    p.stdout.on('data', (d) => { saida += String(d); });
    p.on('close', (codigo) => {
      if (codigo !== 0) return reject(new Error(`semente ${semente} falhou (${codigo})`));
      const linha = saida.trim().split('\n').pop() ?? '';
      resolve(JSON.parse(linha) as Resultado);
    });
  });
}

async function main(): Promise<void> {
  const ticks = Number(argumento('ticks', '30000'));
  const tamanho = argumento('tamanho', 'medio');
  const uma = argumento('uma', '');
  if (uma) {
    console.log(JSON.stringify(rodarUma(uma, ticks, tamanho)));
    return;
  }
  const quantas = Number(argumento('sementes', '8'));
  const prefixo = argumento('prefixo', 'eq');
  const sementes = Array.from({ length: quantas }, (_, k) => `${prefixo}-${k + 1}`);
  const paralelo = Number(argumento('paralelo', '4'));

  const ajustes = ajustesDaLinha();
  console.log(`${quantas} sementes · ${ticks} ticks · mapa ${tamanho}` +
    (ajustes.length ? ` · ajustes: ${ajustes.join(' ')}` : '') + '\n');
  const resultados: Resultado[] = [];
  let proxima = 0;
  const trabalhar = async (): Promise<void> => {
    while (proxima < sementes.length) {
      const s = sementes[proxima++];
      resultados.push(await rodarFilho(s, ticks, tamanho));
    }
  };
  await Promise.all(Array.from({ length: Math.min(paralelo, quantas) }, trabalhar));
  resultados.sort((a, b) => a.semente.localeCompare(b.semente));

  const col = (t: string | number, n: number): string => String(t).padStart(n);
  console.log('semente    ' + POVOS.map((p) => col(p, 7)).join('') + col('domin.', 8) + col('casa', 6) + col('fora', 6) + col('mest', 6) + col('negóc', 7) + col('guerra', 7) + col('reinos', 7));
  for (const r of resultados) {
    console.log(
      r.semente.padEnd(11) + POVOS.map((p) => col(r.povos[p], 7)).join('') +
      col(`${Math.round(r.dominancia * 100)}%`, 8) + col(r.emCasa, 6) + col(r.deFora, 6) +
      col(r.mesticos, 6) + col(r.negocios, 7) + col(r.guerras, 7) + col(r.reinosNoFim, 7),
    );
  }

  console.log('');
  const media = (f: (r: Resultado) => number): number =>
    resultados.reduce((s, r) => s + f(r), 0) / resultados.length;
  for (const p of POVOS) {
    const fatia = media((r) => {
      const total = POVOS.reduce((s, q) => s + r.povos[q], 0);
      return total > 0 ? r.povos[p] / total : 0;
    });
    const sumiuNoFim = resultados.filter((r) => r.povos[p] === 0).length;
    const tempoSumido = media((r) => r.ausente[p]) / (ticks / 1000);
    console.log(
      `${p.padEnd(7)} fatia média ${col(Math.round(fatia * 100) + '%', 4)} · ` +
      `sumido no fim em ${sumiuNoFim} de ${resultados.length} · ` +
      `fora do mapa ${Math.round(tempoSumido * 100)}% do tempo`,
    );
  }
  console.log(`\ndominância média: ${Math.round(media((r) => r.dominancia) * 100)}% (fatia do maior povo)`);
  console.log(`nascidos em casa: ${Math.round(media((r) => r.emCasa))} · chegados de fora: ${Math.round(media((r) => r.deFora))}`);
  console.log(`mestiços: ${media((r) => r.mesticos).toFixed(1)} · negócios: ${media((r) => r.negocios).toFixed(1)} · guerras: ${media((r) => r.guerras).toFixed(1)}`);
  console.log(`custo: ${media((r) => r.msPorTick).toFixed(3)} ms por tick`);
}

void main();
