/**
 * Conta por que as criaturas morrem e quantas nascem, por espécie.
 *
 * O `simular.ts` diz que a população caiu; este diz de quê. Serve para
 * balancear sem chutar:
 *
 *   npm run diag -- --ticks 12000 --civs 0
 */
import { Mundo, TAMANHOS } from '../src/core/mundo.js';
import { montarPipeline } from '../src/sim/index.js';
import { gerarTerreno, povoar } from '../src/sim/geracao.js';
import { especies, TOTAL_ESPECIES } from '../src/dados/especies.js';
import type { Causa } from '../src/core/eventos.js';

const CAUSAS: Causa[] = ['fome', 'velhice', 'combate', 'predado', 'fogo', 'afogado', 'praga', 'jogador', 'desastre'];

function main(): void {
  const a = process.argv.slice(2);
  const pegar = (nome: string, padrao: string): string => {
    const i = a.indexOf(`--${nome}`);
    return i >= 0 && a[i + 1] ? a[i + 1] : padrao;
  };
  const ticks = Number(pegar('ticks', '12000'));
  const civs = Number(pegar('civs', '4'));
  const tamanho = TAMANHOS.find((t) => t.id === pegar('tamanho', 'medio')) ?? TAMANHOS[1];

  const mundo = new Mundo(tamanho, pegar('semente', 'teste'));
  montarPipeline(mundo);
  gerarTerreno(mundo);
  mundo.migracao = !a.includes('--sem-migracao');
  povoar(mundo, { civilizacoes: civs });

  // [espécie][causa]
  const mortes: number[][] = Array.from({ length: TOTAL_ESPECIES }, () => CAUSAS.map(() => 0));
  const nascimentos = new Array<number>(TOTAL_ESPECIES).fill(0);

  /** [vítima][matador] = quantas vezes. */
  const matadores: number[][] = Array.from({ length: TOTAL_ESPECIES }, () =>
    new Array<number>(TOTAL_ESPECIES).fill(0),
  );
  mundo.eventos.on('criatura:morreu', (d) => {
    mortes[d.especie][CAUSAS.indexOf(d.causa)]++;
    if (d.porEspecie >= 0) matadores[d.especie][d.porEspecie]++;
  });
  mundo.eventos.on('criatura:nasceu', (d) => {
    nascimentos[d.especie]++;
  });

  const inicial = new Int32Array(TOTAL_ESPECIES);
  mundo.criaturas.contarPorEspecie(inicial);

  for (let t = 0; t < ticks; t++) mundo.avancar();
  mundo.recalcularEstatisticas();

  // vegetação: o recurso do qual todo herbívoro depende
  const g = mundo.grid;
  let vegTotal = 0;
  let vegTeto = 0;
  let tilesTerra = 0;
  let tilesComPasto = 0;
  for (let i = 0; i < g.total; i++) {
    if (g.ehAgua(i)) continue;
    tilesTerra++;
    vegTotal += g.vegetacao[i];
    vegTeto += 255;
    if (g.vegetacao[i] > 40) tilesComPasto++;
  }

  console.log(`${ticks} ticks · civilizações: ${civs}\n`);
  console.log('vegetação do mapa:');
  console.log(`  ${((vegTotal / vegTeto) * 100).toFixed(1)}% do máximo`);
  console.log(`  ${((tilesComPasto / tilesTerra) * 100).toFixed(1)}% dos tiles de terra têm pasto aproveitável\n`);

  const cabecalho = ['espécie', 'início', 'fim', 'nasc.', ...CAUSAS];
  console.log(cabecalho.map((c, i) => (i === 0 ? c.padEnd(16) : c.padStart(8))).join(''));

  const final = mundo.estatisticas.porEspecie;
  for (let e = 0; e < TOTAL_ESPECIES; e++) {
    if (inicial[e] === 0 && nascimentos[e] === 0) continue;
    const def = especies.porIndice(e);
    const cols = [
      def.plural.padEnd(16),
      String(inicial[e]).padStart(8),
      String(final[e]).padStart(8),
      String(nascimentos[e]).padStart(8),
      ...mortes[e].map((n) => String(n).padStart(8)),
    ];
    console.log(cols.join(''));
  }

  console.log('');
  console.log('quem matou quem (vítima <- matador):');
  for (let v = 0; v < TOTAL_ESPECIES; v++) {
    const linha = matadores[v]
      .map((n, m) => [especies.porIndice(m).plural, n] as const)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
    if (linha.length === 0) continue;
    console.log(
      `  ${especies.porIndice(v).plural.padEnd(16)} <- ${linha.map(([n, q]) => `${n} ${q}`).join(', ')}`,
    );
  }
}

main();
