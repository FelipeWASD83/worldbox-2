/**
 * Roda a simulação sem janela nenhuma e conta o que aconteceu.
 *
 * É como se confere que o mundo não morre, não explode e não fica lento sem
 * precisar abrir o jogo e ficar olhando:
 *
 *   npm run sim -- --ticks 20000 --semente teste --tamanho medio
 */
import { Mundo, TAMANHOS } from '../src/core/mundo.js';
import { montarPipeline } from '../src/sim/index.js';
import { gerarTerreno, povoar } from '../src/sim/geracao.js';
import { especies, ESP_INTELIGENTE } from '../src/dados/especies.js';
import { TOTAL_TRACOS, tracos as tracosReg } from '../src/dados/tracos.js';
import { empacotar, desempacotar } from '../src/core/save.js';
import { BAL } from '../src/sim/balanco.js';
import { MATERIAIS } from '../src/dados/materiais.js';
import { equipamentos } from '../src/dados/equipamentos.js';
import { edificios } from '../src/dados/edificios.js';
import { MARCA_SOLDADO } from '../src/core/criaturas.js';

interface Opcoes {
  ticks: number;
  semente: string;
  tamanho: string;
  civs: number;
  animais: number;
  relatorios: number;
  testarSave: boolean;
}

function lerArgumentos(): Opcoes {
  const a = process.argv.slice(2);
  const pegar = (nome: string, padrao: string): string => {
    const i = a.indexOf(`--${nome}`);
    return i >= 0 && a[i + 1] ? a[i + 1] : padrao;
  };
  return {
    ticks: Number(pegar('ticks', '12000')),
    semente: pegar('semente', 'teste'),
    tamanho: pegar('tamanho', 'medio'),
    civs: Number(pegar('civs', '4')),
    animais: Number(pegar('animais', '1')),
    relatorios: Number(pegar('relatorios', '6')),
    testarSave: !a.includes('--sem-save'),
  };
}

function main(): void {
  const op = lerArgumentos();
  const tamanho = TAMANHOS.find((t) => t.id === op.tamanho) ?? TAMANHOS[1];

  console.log(`mundo: ${tamanho.nome} ${tamanho.largura}x${tamanho.altura} · semente "${op.semente}"`);

  const t0 = performance.now();
  const mundo = new Mundo(tamanho, op.semente);
  montarPipeline(mundo);
  gerarTerreno(mundo);
  povoar(mundo, { civilizacoes: op.civs, densidadeAnimais: op.animais });
  mundo.recalcularEstatisticas();
  const msGeracao = performance.now() - t0;

  console.log(`geração: ${msGeracao.toFixed(0)} ms · ${mundo.criaturas.quantidade} criaturas · ${mundo.aldeias.length} aldeias\n`);

  const intervalo = Math.max(1, Math.floor(op.ticks / op.relatorios));
  const t1 = performance.now();
  let picoPopulacao = 0;
  let tickExtincao = -1;

  cabecalho();
  for (let t = 1; t <= op.ticks; t++) {
    mundo.avancar();
    picoPopulacao = Math.max(picoPopulacao, mundo.criaturas.quantidade);
    if (tickExtincao < 0 && mundo.criaturas.quantidade === 0) tickExtincao = t;
    if (t % intervalo === 0 || t === op.ticks) {
      mundo.recalcularEstatisticas();
      linha(mundo);
    }
  }
  const msTotal = performance.now() - t1;

  console.log('');
  console.log(`${op.ticks} ticks em ${(msTotal / 1000).toFixed(1)} s`);
  console.log(`média: ${(msTotal / op.ticks).toFixed(3)} ms por tick · ${(op.ticks / (msTotal / 1000)).toFixed(0)} ticks/s`);
  console.log(`orçamento de 60 fps (16,6 ms): ${(msTotal / op.ticks) < 16.6 ? 'cabe' : 'ESTOUROU'}`);
  console.log(`pico de população: ${picoPopulacao}`);

  console.log('\ncusto por sistema (último tick medido):');
  const custos = [...mundo.pipeline.custo.entries()].sort((a, b) => b[1] - a[1]);
  for (const [id, ms] of custos) {
    console.log(`  ${id.padEnd(14)} ${ms.toFixed(3)} ms`);
  }

  console.log('\nespécies vivas:');
  const s = mundo.estatisticas;
  const vivas: Array<[string, number]> = [];
  for (let i = 0; i < s.porEspecie.length; i++) {
    if (s.porEspecie[i] > 0) vivas.push([especies.porIndice(i).plural, s.porEspecie[i]]);
  }
  vivas.sort((a, b) => b[1] - a[1]);
  for (const [nome, n] of vivas) console.log(`  ${nome.padEnd(18)} ${n}`);
  const semNinguem = especies.todos().filter((e) => s.porEspecie[especies.indice(e.id)] === 0);
  const extintas = semNinguem.filter((e) => e.frequencia > 0);
  const nuncaNasceram = semNinguem.filter((e) => e.frequencia === 0);
  if (extintas.length > 0) {
    console.log(`  EXTINTAS: ${extintas.map((e) => e.plural).join(', ')}`);
  }
  if (nuncaNasceram.length > 0) {
    console.log(`  (só surgem pela mão do jogador: ${nuncaNasceram.map((e) => e.plural).join(', ')})`);
  }

  console.log('\nreinos:');
  for (const r of mundo.reinos) {
    if (!r.ativo) continue;
    console.log(
      `  ${r.nome.padEnd(28)} pop ${String(r.populacao).padStart(4)} · ${r.aldeias.length} aldeias · era ${r.era} · ${r.guerras.size} guerras · ${r.aliancas.size} aliados`,
    );
  }
  if (!mundo.reinos.some((r) => r.ativo)) console.log('  nenhum (as civilizações se apagaram)');

  // ------------------------------------------------------------- economia
  const ativas = mundo.aldeias.filter((a) => a.ativa);
  if (ativas.length > 0) {
    console.log('');
    console.log('estoque das aldeias (média · maior):');
    for (const m of MATERIAIS) {
      const valores = ativas.map((a) => a.estoque[m]);
      const media = valores.reduce((x, y) => x + y, 0) / valores.length;
      console.log(`  ${m.padEnd(10)} ${media.toFixed(1).padStart(8)} · ${Math.max(...valores).toFixed(0).padStart(6)}`);
    }
    const g = mundo.grid;
    let recursosNoMapa = 0;
    for (let i = 0; i < g.total; i++) if (g.recurso[i] !== 0) recursosNoMapa++;
    console.log(`  tiles com recurso no mapa: ${recursosNoMapa}`);
  }

  {
    const predios = new Map<string, number>();
    for (const a of mundo.aldeias) {
      if (!a.ativa) continue;
      for (let e = 0; e < a.predios.length; e++) {
        if (a.predios[e] > 0) {
          const nome = edificios.porIndice(e).nome;
          predios.set(nome, (predios.get(nome) ?? 0) + a.predios[e]);
        }
      }
    }
    if (predios.size > 0) {
      console.log('');
      console.log('construções no mundo:');
      for (const [nome, n] of [...predios.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${nome.padEnd(18)} ${n}`);
      }
    }
    console.log('');
    console.log(`negócios fechados: ${mundo.eventos.contagem.get('comercio:feito') ?? 0}`);
    console.log(`alianças firmadas: ${mundo.eventos.contagem.get('reino:alianca') ?? 0}`);
    // A política em três números. São eles que dizem se a névoa está grossa
    // demais (poucos contatos), se o casus belli está solto demais (muitas
    // guerras) e se as guerras terminam (pazes perto do número de guerras).
    console.log(`primeiros contatos: ${mundo.eventos.contagem.get('reino:conheceu') ?? 0}`);
    console.log(`guerras declaradas: ${mundo.eventos.contagem.get('reino:guerra') ?? 0}`);
    console.log(`pazes assinadas: ${mundo.eventos.contagem.get('reino:paz') ?? 0}`);
    console.log(`rebeliões: ${mundo.eventos.contagem.get('reino:rebeliao') ?? 0}`);
    console.log(`clãs no mundo: ${mundo.clas.length}`);
    console.log(`mestiços nascidos: ${mundo.eventos.contagem.get('criatura:mesticou') ?? 0}`);

    // A distribuição de traços é o termômetro da genética: se ela ficar plana,
    // a seleção não está acontecendo; se um traço sumir, o mundo perdeu
    // variedade e a mutação está fraca demais.
    {
      const c = mundo.criaturas;
      const conta = new Int32Array(TOTAL_TRACOS);
      let comTraco = 0;
      let civis = 0;
      for (let i = 0; i < c.limite; i++) {
        if (!c.vivo[i] || ESP_INTELIGENTE[c.especie[i]] === 0) continue;
        civis++;
        if (c.tracos[i] === 0) continue;
        comTraco++;
        for (let t = 0; t < TOTAL_TRACOS; t++) if (c.tracos[i] & (1 << t)) conta[t]++;
      }
      if (civis > 0) {
        console.log(`
traços: ${comTraco} de ${civis} inteligentes têm algum`);
        const linhas = [...conta]
          .map((n, t) => [tracosReg.porIndice(t).nome, n] as const)
          .filter(([, n]) => n > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([nome, n]) => `${nome} ${n}`);
        console.log(`  ${linhas.join(' · ')}`);
      }
    }
  }

  // ------------------------------------------------------------ equipamento
  {
    const c = mundo.criaturas;
    const contagem = new Map<string, number>();
    let armados = 0;
    let soldados = 0;
    for (let i = 0; i < c.limite; i++) {
      if (!c.vivo[i]) continue;
      if ((c.marcas[i] & MARCA_SOLDADO) !== 0) soldados++;
      if (c.arma[i] === 0) continue;
      armados++;
      const nome = equipamentos.porIndice(c.arma[i] - 1).nome;
      contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
    }
    console.log('');
    console.log(`equipamento: ${armados} armados, ${soldados} soldados`);
    for (const [nome, n] of [...contagem.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${nome.padEnd(20)} ${n}`);
    }
  }

  // ------------------------------------------------------------- problemas
  const problemas = conferir(mundo, tickExtincao);
  console.log('');
  if (problemas.length === 0) {
    console.log('nenhum problema encontrado.');
  } else {
    console.log('PROBLEMAS:');
    for (const p of problemas) console.log(`  - ${p}`);
  }

  if (op.testarSave) {
    const texto = empacotar(mundo);
    const volta = desempacotar(texto);
    const igual =
      volta.criaturas.quantidade === mundo.criaturas.quantidade &&
      volta.tick === mundo.tick &&
      volta.aldeias.filter((a) => a.ativa).length === mundo.aldeias.filter((a) => a.ativa).length;
    console.log(
      `\nsave: ${(texto.length / 1024 / 1024).toFixed(2)} MB · ida e volta ${igual ? 'ok' : 'DIVERGIU'}`,
    );
    if (!igual) {
      console.log(`  criaturas ${mundo.criaturas.quantidade} → ${volta.criaturas.quantidade}`);
      console.log(`  tick ${mundo.tick} → ${volta.tick}`);
      process.exitCode = 1;
    }
  }

  if (problemas.length > 0) process.exitCode = 1;
}

function conferir(mundo: Mundo, tickExtincao: number): string[] {
  const problemas: string[] = [];
  const c = mundo.criaturas;

  // impasse de progressão: teto de moradores menor que o exigido para promover
  for (let n = 1; n < BAL.populacaoParaSubirNivel.length; n++) {
    const teto = BAL.tetoPorNivel[n - 1];
    const exigido = BAL.populacaoParaSubirNivel[n];
    if (teto > 0 && exigido > teto) {
      problemas.push(
        `aldeia de nível ${n - 1} cabe ${teto} moradores mas precisa de ${exigido} para promover: nunca sobe de nível`,
      );
    }
  }

  if (tickExtincao >= 0) {
    problemas.push(`toda a vida acabou no tick ${tickExtincao}`);
  }
  if (c.quantidade === 0) problemas.push('o mundo terminou sem nenhuma criatura viva');

  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i]) continue;
    if (!Number.isFinite(c.x[i]) || !Number.isFinite(c.y[i])) {
      problemas.push(`criatura ${i} com posição inválida`);
      break;
    }
    if (c.x[i] < 0 || c.y[i] < 0 || c.x[i] >= mundo.grid.largura || c.y[i] >= mundo.grid.altura) {
      problemas.push(`criatura ${i} fora do mapa (${c.x[i].toFixed(1)}, ${c.y[i].toFixed(1)})`);
      break;
    }
    if (!Number.isFinite(c.vida[i]) || c.vida[i] <= 0) {
      problemas.push(`criatura ${i} viva com vida ${c.vida[i]}`);
      break;
    }
  }

  for (const a of mundo.aldeias) {
    if (!a.ativa) continue;
    if (a.populacao < 0) problemas.push(`aldeia ${a.nome} com população negativa`);
    if (!Number.isFinite(a.estoque.comida)) problemas.push(`aldeia ${a.nome} com comida inválida`);
  }

  for (const r of mundo.reinos) {
    if (!r.ativo) continue;
    for (const idA of r.aldeias) {
      if (!mundo.aldeias[idA]?.ativa) {
        problemas.push(`reino ${r.nome} aponta para a aldeia ${idA}, que não existe mais`);
        break;
      }
    }
    for (const inimigo of r.guerras) {
      if (!mundo.reinos[inimigo]?.ativo) {
        problemas.push(`reino ${r.nome} em guerra com um reino extinto`);
        break;
      }
    }
  }

  return problemas;
}

function cabecalho(): void {
  console.log('  tick   população  aldeias  reinos  guerras  fogo');
}

function linha(mundo: Mundo): void {
  const s = mundo.estatisticas;
  console.log(
    `${String(mundo.tick).padStart(6)}  ${String(s.populacao).padStart(9)}  ${String(s.aldeias).padStart(7)}  ${String(s.reinos).padStart(6)}  ${String(s.guerras).padStart(7)}  ${String(s.incendios).padStart(4)}`,
  );
}

main();
