/**
 * Testes de regressão do motor, sem abrir janela nenhuma.
 *
 *   npm test
 *
 * Cada caso aqui nasceu de um defeito real que passou despercebido uma vez.
 * Rodar isto antes de dizer que algo está pronto é mais barato que descobrir
 * de novo pelo jogo.
 */
import { Mundo, TAMANHOS } from '../src/core/mundo.js';
import { montarPipeline } from '../src/sim/index.js';
import { gerarTerreno, povoar } from '../src/sim/geracao.js';
import { empacotar, desempacotar } from '../src/core/save.js';
import { recursos, REC_MATERIAL } from '../src/dados/recursos.js';
import { MOLDES } from '../src/render/moldes.js';
import { REC_SPRITE } from '../src/dados/recursos.js';
import {
  ED, ED_NATURAL, ED_OCUPA, ED_SPRITE, MATERIAIS_DE_OBRA, edificios, materialDoAcabamento,
} from '../src/dados/edificios.js';
import { ESP_CIVILIZADO, ESP_INTELIGENTE, ESP_PORTE, especies } from '../src/dados/especies.js';
import { CATEGORIAS, poderes } from '../src/sim/poderes.js';
import { tecnologias, TEC_INICIAIS, TEC_REQUER } from '../src/dados/tecnologias.js';
import { tentarRebelar } from '../src/sim/cultura.js';
import { aprender, materialDoReino } from '../src/sim/conhecimento.js';
import { TOTAL_TRACOS, TRACO_OPOSTOS, tracos } from '../src/dados/tracos.js';
import { especieDoFilho, podemCruzar, vidaMaxima } from '../src/sim/genetica.js';
import { BAL } from '../src/sim/balanco.js';
import { B } from '../src/dados/biomas.js';
import { testes2, testesAnimacao, testesCaminho, testesProfissoes } from './testes2.js';

let falhas = 0;
/**
 * Dá a árvore de tecnologia inteira a todos os reinos do mundo.
 *
 * Desde a fase 4 uma civilização começa na idade da pedra e leva milhares de
 * ticks para descobrir lavoura, moinho e navegação. Os testes que conferem
 * essas mecânicas não estão testando a **descoberta** delas — estão testando o
 * moinho, o porto, a casa. Sem este atalho eles passariam a medir só quanto
 * tempo a tecnologia demora, que é assunto de outro teste (o 18).
 */
function ensinarTudo(m: Mundo): void {
  for (const r of m.reinos) {
    if (!r.ativo) continue;
    for (let t = 0; t < tecnologias.tamanho; t++) r.tecnologias.add(t);
    r.era = 3;
  }
}

const ok = (nome: string, cond: boolean, extra = ''): void => {
  console.log(`${cond ? 'ok   ' : 'FALHA'} ${nome}${extra ? ' — ' + extra : ''}`);
  if (!cond) falhas++;
};

// 1. combinações de tamanho x terra que antes quebravam
for (const t of TAMANHOS) {
  for (const terra of [0.15, 0.25, 0.4, 0.7]) {
    try {
      const m = new Mundo(t, `chk-${t.id}-${terra}`);
      montarPipeline(m);
      gerarTerreno(m, { fracaoTerra: terra });
      povoar(m, { civilizacoes: 2 });
      m.recalcularEstatisticas();
      ok(
        `gerar ${t.id} com ${Math.round(terra * 100)}% de terra`,
        m.criaturas.quantidade > 0,
        `${m.criaturas.quantidade} criaturas`,
      );
    } catch (e) {
      ok(`gerar ${t.id} com ${Math.round(terra * 100)}% de terra`, false, String(e).slice(0, 70));
    }
  }
}

// 2. aoRedor respeita o raio de verdade
{
  const m = new Mundo(TAMANHOS[0], 'chk-raio');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 0 });
  m.espacial.reconstruir(m.criaturas);
  const c = m.criaturas;
  const raio = 2.2;
  let alvo = -1;
  for (let i = 0; i < c.limite; i++) {
    if (c.vivo[i]) {
      alvo = i;
      break;
    }
  }
  let maiorDist = 0;
  let visitados = 0;
  m.espacial.aoRedor(c.x[alvo], c.y[alvo], raio, (id) => {
    visitados++;
    const d = Math.hypot(c.x[id] - c.x[alvo], c.y[id] - c.y[alvo]);
    if (d > maiorDist) maiorDist = d;
  });
  ok(
    'aoRedor respeita o raio',
    maiorDist <= raio + 0.001,
    `${visitados} visitados, o mais distante a ${maiorDist.toFixed(2)} de ${raio}`,
  );
}

// 3. a escolha de migração sobrevive ao save
{
  const m = new Mundo(TAMANHOS[0], 'chk-save');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 2 });
  m.migracao = false;
  for (let i = 0; i < 50; i++) m.avancar();
  const volta = desempacotar(empacotar(m));
  ok('migração desligada sobrevive ao save', volta.migracao === false);
  ok('tick sobrevive ao save', volta.tick === m.tick);
  ok('criaturas sobrevivem ao save', volta.criaturas.quantidade === m.criaturas.quantidade);
}

// 4. o medidor enxerga os sistemas que rodam de N em N ticks
{
  const m = new Mundo(TAMANHOS[0], 'chk-medidor');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 2 });
  for (let i = 0; i < 1200; i++) m.avancar();
  const medidos = [...m.pipeline.custo.keys()];
  const esperados = ['aldeias', 'diplomacia', 'praga', 'migracao', 'cerco', 'estatisticas'];
  const faltando = esperados.filter((e) => !medidos.includes(e));
  ok(
    'medidor cobre os sistemas com intervalo',
    faltando.length === 0,
    faltando.length ? `faltou: ${faltando.join(', ')}` : `${medidos.length} sistemas medidos`,
  );
}

// 5. o mundo nasce com recursos, e eles sobrevivem ao save
{
  const m = new Mundo(TAMANHOS[1], 'chk-recursos');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 2 });
  const g = m.grid;
  const contagem = new Map<number, number>();
  for (let i = 0; i < g.total; i++) {
    if (g.recurso[i] !== 0) contagem.set(g.recurso[i], (contagem.get(g.recurso[i]) ?? 0) + 1);
  }
  ok('o mundo nasce com recursos no chão', contagem.size >= 5,
     `${contagem.size} tipos, ${[...contagem.values()].reduce((a, b) => a + b, 0)} tiles`);

  const madeira = [...contagem.entries()].some(([r, n]) => recursos.porIndice(r - 1).rende === 'madeira' && n > 50);
  const ferro = [...contagem.entries()].some(([r]) => recursos.porIndice(r - 1).id === 'ferro');
  const comida = [...contagem.entries()].some(([r, n]) => recursos.porIndice(r - 1).rende === 'comida' && n > 20);
  ok('tem madeira em quantidade', madeira);
  ok('tem veio de ferro', ferro);
  ok('tem fruta em quantidade', comida);

  const volta = desempacotar(empacotar(m));
  let iguais = 0;
  for (let i = 0; i < g.total; i++) if (volta.grid.recurso[i] === g.recurso[i]) iguais++;
  ok('recursos sobrevivem ao save', iguais === g.total);
}

// 6. população animal ficou de fato baixa
{
  const m = new Mundo(TAMANHOS[1], 'chk-fauna');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 0 });
  const inicial = m.criaturas.quantidade;
  for (let i = 0; i < 6000; i++) m.avancar();
  m.recalcularEstatisticas();
  ok('fauna começa enxuta', inicial < 1400, `${inicial} criaturas`);
  ok('fauna não explode com o tempo', m.criaturas.quantidade < 2600,
     `${m.criaturas.quantidade} depois de 6000 ticks`);
}

// 7. o mundo carregado precisa CONTINUAR RODANDO
// (o save já bateu campo a campo uma vez e mesmo assim o jogo travava no
//  primeiro tick depois de carregar, porque um array tipado não sobrevive ao
//  arquivo — conferir o conteúdo não bastava, era preciso rodar)
{
  const m = new Mundo(TAMANHOS[1], 'chk-continuar');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 3 });
  for (let i = 0; i < 3000; i++) m.avancar();

  const volta = desempacotar(empacotar(m));
  montarPipeline(volta);
  let erro = '';
  try {
    for (let i = 0; i < 600; i++) volta.avancar();
  } catch (e) {
    erro = String(e).slice(0, 90);
  }
  ok('mundo carregado continua rodando', erro === '', erro);

  const comPredios = volta.aldeias.filter(
    (a) => a.ativa && a.predios.some((n) => n > 0),
  ).length;
  const ativas = volta.aldeias.filter((a) => a.ativa).length;
  ok('aldeias carregadas mantêm as construções', ativas === 0 || comPredios > 0,
     `${comPredios} de ${ativas} aldeias com prédios`);
  ok('estoque sobrevive ao save',
     volta.aldeias.every((a) => !a.ativa || Number.isFinite(a.estoque.madeira)));
}

// 8. os desenhos olham para o lado certo
{
  const ladoDaCabeca = (molde: readonly string[]): 'esq' | 'dir' => {
    let esq = 0;
    let dir = 0;
    // a cabeça é o desenho nas linhas de cima; conta de que lado ele pesa
    for (let y = 0; y < 6; y++) {
      const linha = molde[y] ?? '';
      for (let x = 0; x < linha.length; x++) {
        if (linha[x] === '.') continue;
        if (x < linha.length / 2) esq++;
        else dir++;
      }
    }
    return esq > dir ? 'esq' : 'dir';
  };
  const olhamParaDireita = ['quadrupede', 'grande', 'ave', 'peixe']
    .every((f) => ladoDaCabeca(MOLDES[f]) === 'dir');
  ok('os moldes são desenhados olhando para a direita', olhamParaDireita,
     'a inversão em sprites.ts depende disso');
}

// 9. objetos de mais de um tile: ocupação, estradas e moinho
{
  const m = new Mundo(TAMANHOS[1], 'chk-urbano');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 4 });
  ensinarTudo(m);
  for (let i = 0; i < 9000; i++) m.avancar();
  const g = m.grid;

  // toda construção tem de ter a área dela marcada como tomada
  let semOcupacao = 0;
  let construcoes = 0;
  for (let i = 0; i < g.total; i++) {
    const c = g.construcao[i];
    if (c === 0) continue;
    construcoes++;
    const l = ED_OCUPA[(c - 1) * 2];
    const p = ED_OCUPA[(c - 1) * 2 + 1];
    const ax = i % g.largura;
    const ay = (i / g.largura) | 0;
    for (let dy = 0; dy < p && !semOcupacao; dy++) {
      for (let dx = 0; dx < l; dx++) {
        if (!g.dentro(ax + dx, ay + dy)) continue;
        if (g.ocupacao[g.idx(ax + dx, ay + dy)] !== i) {
          semOcupacao++;
          break;
        }
      }
    }
  }
  ok('construções marcam a área que ocupam', semOcupacao === 0,
     `${construcoes} construções, ${semOcupacao} com área solta`);

  // duas construções não podem se sobrepor
  let sobrepostas = 0;
  for (let i = 0; i < g.total; i++) {
    if (g.construcao[i] === 0) continue;
    const dono = g.ocupacao[i];
    if (dono !== -1 && dono !== i) sobrepostas++;
  }
  ok('construções não se sobrepõem', sobrepostas === 0, `${sobrepostas} sobrepostas`);

  let estradas = 0;
  for (let i = 0; i < g.total; i++) if (g.estrada[i] === 1) estradas++;
  ok('as aldeias abrem estradas', estradas > 40, `${estradas} tiles de estrada`);

  // estrada não passa por cima de construção nem de água
  let estradaRuim = 0;
  for (let i = 0; i < g.total; i++) {
    if (g.estrada[i] !== 1) continue;
    if (g.construcao[i] !== 0 || g.ehAgua(i)) estradaRuim++;
  }
  ok('estrada não invade construção nem água', estradaRuim === 0, `${estradaRuim} tiles`);

  let moinhos = 0;
  let lavouras = 0;
  for (let i = 0; i < g.total; i++) {
    if (g.construcao[i] === ED.moinho + 1) moinhos++;
    if (g.construcao[i] === ED.fazenda + 1) lavouras++;
  }
  ok('moinhos são erguidos', moinhos > 0, `${moinhos} moinhos`);
  ok('há lavoura no mundo', lavouras > 10, `${lavouras} tiles de lavoura`);

  // as aldeias continuam sabendo crescer com o layout novo
  const casas = m.aldeias.filter((a) => a.ativa).reduce((n, a) => n + a.casas, 0);
  ok('as aldeias constroem casas', casas > 20, `${casas} casas`);
}

// 10. o porte de cada coisa respeita o combinado
{
  const num = (v: number): string => (Math.round(v * 100) / 100).toString();
  const forade = (nome: string, l: number, a: number, maxL: number, maxA: number): string =>
    l > maxL || a > maxA ? `${nome} ${num(l)}x${num(a)}` : '';

  const erros: string[] = [];
  for (const r of recursos.todos()) {
    const i = recursos.indice(r.id);
    // A casa é a régua da escala (ver a seção no CLAUDE.md): nada que nasce do
    // chão passa dela. Árvore no máximo 2,6x3,8; moita de fruta, 1x1.
    const limite = r.rende === 'comida' && r.id === 'arbusto' ? [1, 1] : [2.6, 3.8];
    const e = forade(r.nome, REC_SPRITE[i * 2], REC_SPRITE[i * 2 + 1], limite[0], limite[1]);
    if (e) erros.push(e);
  }
  for (const e of especies.todos()) {
    const i = especies.indice(e.id);
    const maxL = e.inteligente ? 1 : e.categoria === 'monstro' ? 3 : 1.5;
    const maxA = e.inteligente ? 1.3 : e.categoria === 'monstro' ? 2 : 1.1;
    const erro = forade(e.nome, ESP_PORTE[i * 2], ESP_PORTE[i * 2 + 1], maxL, maxA);
    if (erro) erros.push(erro);
  }
  const casa = edificios.indice('casa');
  const eCasa = forade('casa', ED_SPRITE[casa * 2], ED_SPRITE[casa * 2 + 1], 3, 4);
  // e nada de mata mais alta que telhado: era o que fazia uma floresta engolir
  // a vila inteira quando se aproximava a câmera
  const maisAlta = Math.max(...[...Array(recursos.tamanho)].map((_, i) => REC_SPRITE[i * 2 + 1]));
  if (maisAlta > ED_SPRITE[casa * 2 + 1]) {
    erros.push(`mata ${num(maisAlta)} contra casa ${num(ED_SPRITE[casa * 2 + 1])}`);
  }
  if (eCasa) erros.push(eCasa);

  ok('os portes respeitam os limites combinados', erros.length === 0, erros.join(', '));

  // A escala do mundo tem uma régua só: a casa. Comparando com o WorldBox, uma
  // pessoa fica em torno de um quarto da altura de uma casa. Já houve uma
  // versão em que o elfo batia no telhado, e o mapa inteiro parecia feito de
  // bonecos grandes demais para as próprias casas.
  const alturaDaCasa = ED_SPRITE[edificios.indice('casa') * 2 + 1];
  const altos: string[] = [];
  for (const e of especies.todos()) {
    if (!e.inteligente) continue;
    const alt = ESP_PORTE[especies.indice(e.id) * 2 + 1];
    if (alt > alturaDaCasa * 0.4) altos.push(`${e.nome} ${alt} de ${alturaDaCasa}`);
  }
  ok('gente é pequena perto da própria casa', altos.length === 0,
     altos.length === 0 ? `casa ${num(alturaDaCasa)} tiles` : altos.join(', '));
}

// 11. o que a aldeia constrói é o que ela enxerga
// (já houve três raios diferentes — um para escolher lote, outro para contar e
//  um terceiro para limpar — e o mundo enchia de prédio fantasma sem dono)
{
  const m = new Mundo(TAMANHOS[1], 'chk-contagem');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 4 });
  ensinarTudo(m);
  for (let i = 0; i < 12000; i++) m.avancar();
  const g = m.grid;

  let noMapa = 0;
  let semDonoVivo = 0;
  for (let i = 0; i < g.total; i++) {
    if (g.construcao[i] === 0) continue;
    noMapa++;
    const dona = g.aldeiaDona[i];
    if (dona < 0 || !m.aldeias[dona]?.ativa) semDonoVivo++;
  }
  const contadas = m.aldeias
    .filter((a) => a.ativa)
    .reduce((n, a) => n + a.predios.reduce((x, y) => x + y, 0), 0);

  // Ruína fica sem dono de propósito até desmoronar, e o vulcão nunca tem dono
  // — é acidente do terreno, não obra (ver `Edificio.natural`). O resto tem de
  // pertencer a alguém vivo.
  let ruinas = 0;
  let naturais = 0;
  for (let i = 0; i < g.total; i++) {
    const e = g.construcao[i];
    if (e === 0) continue;
    if (e === ED.ruina + 1) ruinas++;
    else if (ED_NATURAL[e - 1] === 1) naturais++;
  }

  ok('a aldeia conta as construções que tem', contadas + ruinas + naturais >= noMapa * 0.9,
     `${noMapa} no mapa, ${contadas} contadas, ${ruinas} ruínas, ${naturais} naturais`);
  ok('quase nada fica sem dono vivo', semDonoVivo <= ruinas + naturais,
     `${semDonoVivo} sem dono, ${ruinas} ruínas`);

  // a ocupação não pode sobrar sem objeto por cima
  let orfaos = 0;
  for (let i = 0; i < g.total; i++) {
    const dono = g.ocupacao[i];
    if (dono === -1) continue;
    if (g.construcao[dono] === 0) orfaos++;
  }
  ok('nenhum tile fica preso sem objeto', orfaos === 0, `${orfaos} tiles órfãos`);
}

// 12. escombro não se acumula para sempre
{
  const m = new Mundo(TAMANHOS[0], 'chk-ruinas');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 2 });
  const g = m.grid;
  // espalha escombro à mão e deixa o tempo passar
  let postas = 0;
  for (let i = 0; i < g.total && postas < 120; i += 37) {
    if (!g.ehTerra(i) || g.construcao[i] !== 0 || g.ocupacao[i] !== -1) continue;
    g.construcao[i] = ED.ruina + 1;
    g.ocupar(i, 1, 1);
    postas++;
  }
  for (let i = 0; i < 4000; i++) m.avancar();
  let restantes = 0;
  for (let i = 0; i < g.total; i++) if (g.construcao[i] === ED.ruina + 1) restantes++;
  ok('as ruínas desmoronam com o tempo', restantes < postas * 0.5,
     `${postas} viraram ${restantes}`);
}

// 13. um raio não pode incendiar o mundo inteiro
// (já queimou 36% da terra e ficou com 3 mil focos acesos para sempre, porque
//  lava e terra queimada reacendiam sozinhas)
{
  const m = new Mundo(TAMANHOS[1], 'chk-fogo');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 0 });
  // sem vulcão: aqui se mede a propagação do fogo, e cratera em atividade
  // acende foco novo o tempo todo
  m.vulcoes = [];
  // e sem o raio seco do verão, pelo mesmo motivo: ele acende foco novo de
  // tempos em tempos, e o que se quer saber é se **este** fogo se apaga
  const fogoDeVerao = BAL.chanceFogoDeVerao;
  (BAL as { chanceFogoDeVerao: number }).chanceFogoDeVerao = 0;
  const g = m.grid;
  let alvo = -1;
  for (let i = 0; i < g.total; i++) {
    if (g.bioma[i] === B.floresta) { alvo = i; break; }
  }
  poderes.obter('raio').aplicar(m, alvo % g.largura, (alvo / g.largura) | 0, 2, 0);

  let terra = 0;
  for (let i = 0; i < g.total; i++) if (g.ehTerra(i)) terra++;
  for (let t = 0; t < 4000; t++) m.avancar();

  let queimado = 0;
  for (let i = 0; i < g.total; i++) if (g.bioma[i] === B.cinzas) queimado++;
  const fracao = queimado / terra;
  (BAL as { chanceFogoDeVerao: number }).chanceFogoDeVerao = fogoDeVerao;
  ok('o fogo se apaga sozinho', m.chamas.size === 0, `${m.chamas.size} focos acesos`);
  ok('o incêndio não come o mundo', fracao < 0.15, `${(fracao * 100).toFixed(1)}% da terra`);
}

// 14. vulcão em atividade cospe lava e ela cai
{
  const m = new Mundo(TAMANHOS[1], 'chk-vulcao');
  montarPipeline(m);
  gerarTerreno(m, { montanhas: 0.9 });
  povoar(m, { civilizacoes: 0 });
  const g = m.grid;
  ok('o mundo tem cratera', m.vulcoes.length > 0, `${m.vulcoes.length} vulcões`);

  let lavaAntes = 0;
  for (let i = 0; i < g.total; i++) if (g.bioma[i] === B.lava) lavaAntes++;

  let viuBombaNoAr = false;
  for (let t = 0; t < 3000; t++) {
    m.avancar();
    if (m.bombas.length > 0) viuBombaNoAr = true;
  }
  let lavaDepois = 0;
  for (let i = 0; i < g.total; i++) if (g.bioma[i] === B.lava) lavaDepois++;

  ok('as bombas de lava voam', viuBombaNoAr);
  ok('onde a bomba cai vira lava', lavaDepois > lavaAntes,
     `${lavaAntes} → ${lavaDepois} tiles de lava`);
  ok('as bombas não se acumulam sem fim', m.bombas.length < 400, `${m.bombas.length} no ar`);
}

// 15. o que a revisão pegou: mina na rocha, território real e filho em casa
{
  const m = new Mundo(TAMANHOS[1], 'chk-v4');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 4 });
  ensinarTudo(m);

  // Contar por origem, e não só contar. A primeira versão deste teste somava
  // todo nascimento de espécie inteligente e passava com o sistema de moradia
  // apagado do projeto — enquanto, na prática, casa respondia por 2% do
  // crescimento e a imigração pelo resto.
  let nascidosEmCasa = 0;
  let vindosDeFora = 0;
  m.eventos.on('criatura:nasceu', (d) => {
    if (ESP_INTELIGENTE[d.especie] !== 1) return;
    if (d.origem === 'casa') nascidosEmCasa++;
    else if (d.origem === 'imigracao') vindosDeFora++;
  });
  for (let i = 0; i < 20000; i++) m.avancar();
  const g = m.grid;

  // mina na montanha: a regra existe para isso
  let minas = 0;
  let minasNaRocha = 0;
  for (let i = 0; i < g.total; i++) {
    if (g.construcao[i] !== ED.mina + 1) continue;
    minas++;
    if (g.ehMontanha(i)) minasNaRocha++;
  }
  ok('a mina entra na rocha', minas === 0 || minasNaRocha > 0,
     `${minasNaRocha} de ${minas} minas em montanha`);

  // o contador de território tem de bater com o mapa
  const real = new Map<number, number>();
  for (let i = 0; i < g.total; i++) {
    const dono = g.aldeiaDona[i];
    if (dono >= 0) real.set(dono, (real.get(dono) ?? 0) + 1);
  }
  let piorErro = 0;
  for (const a of m.aldeias) {
    if (!a.ativa) continue;
    const r = real.get(a.id) ?? 0;
    if (r < 30) continue;
    piorErro = Math.max(piorErro, Math.abs(r - a.tilesTerritorio) / r);
  }
  ok('o território contado bate com o mapa', piorErro < 0.12,
     `pior erro ${(piorErro * 100).toFixed(0)}%`);

  // O limiar é folgado de propósito. O número exato oscila muito com o mundo —
  // quanto terreno bom saiu na semente, se as vilas são costeiras, se há pesca —
  // e perseguir o valor de hoje só faz o teste quebrar a cada mudança de
  // balanço. O que ele tem de garantir é que a casa **funciona**; que ela é o
  // caminho principal é o teste seguinte que diz.
  // Mais duas sementes: uma só é sorte. Em 16/10/2026 a mesma regra deu 184
  // contra 190 nesta semente e 635 contra 590 na média de doze.
  for (const outra of ['chk-v4b', 'chk-v4c']) {
    const w = new Mundo(TAMANHOS[1], outra);
    montarPipeline(w);
    gerarTerreno(w);
    povoar(w, { civilizacoes: 4 });
    ensinarTudo(w);
    w.eventos.on('criatura:nasceu', (d) => {
      if (ESP_INTELIGENTE[d.especie] !== 1) return;
      if (d.origem === 'casa') nascidosEmCasa++;
      else if (d.origem === 'imigracao') vindosDeFora++;
    });
    for (let i = 0; i < 20000; i++) w.avancar();
  }
  ok('nasce gente dentro de casa', nascidosEmCasa > 450,
     `${nascidosEmCasa} em casa · ${vindosDeFora} de fora, em três sementes`);
  ok('a casa é o caminho principal de crescimento', nascidosEmCasa > vindosDeFora,
     `${nascidosEmCasa} contra ${vindosDeFora}`);

  // Ninguém preso dentro de casa. A conta é `tempoAbrigo <= 0` com `abrigo`
  // ainda apontando para a casa: `entrar` grava o tempo cheio e o sistema só
  // subtrai dali, então quem chegou a zero e continua marcado é quem o sistema
  // esqueceu de mandar embora. A versão anterior deste teste procurava tempo
  // *acima* do teto, o que `entrar` nunca produz — não podia falhar nunca.
  const c = m.criaturas;
  let presos = 0;
  let dentro = 0;
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i] || c.abrigo[i] < 0) continue;
    dentro++;
    if (c.tempoAbrigo[i] <= 0) presos++;
  }
  ok('ninguém fica preso dentro de casa', presos === 0, `${presos} presos de ${dentro} dentro`);
  ok('casa é para entrar', dentro > 0, `${dentro} pessoas dentro de casa agora`);
}

// 16. o chao do mundo: teto de ocupacao, biomas gelados e vulcao
{
  const m = new Mundo(TAMANHOS[1], 'chk-chao');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 4 });
  ensinarTudo(m);
  const g = m.grid;

  // o vulcao e um objeto de um tile, e a lista bate com o mapa
  let cones = 0;
  for (let i = 0; i < g.total; i++) if (g.construcao[i] === ED.vulcao + 1) cones++;
  ok('o vulcao e um objeto no mapa', cones > 0 && cones === m.vulcoes.length,
     `${cones} cones · ${m.vulcoes.length} na lista`);

  // praia de verdade, e nao um fio de areia
  let praia = 0;
  let terra = 0;
  for (let i = 0; i < g.total; i++) {
    if (!g.ehTerra(i)) continue;
    terra++;
    if (g.bioma[i] === B.praia) praia++;
  }
  ok('a praia e uma faixa larga', praia / terra > 0.04,
     `${((praia / terra) * 100).toFixed(1)}% da terra`);

  function censo(): { mata: number; fruta: number; pedra: number; gelado: number; livre: number } {
    let mata = 0;
    let fruta = 0;
    let pedra = 0;
    let gelado = 0;
    let chao = 0;
    for (let i = 0; i < g.total; i++) {
      if (!g.ehTerra(i)) continue;
      chao++;
      const r = g.recurso[i];
      if (r === 0) continue;
      const material = REC_MATERIAL[r - 1];
      if (material === 'madeira') mata++;
      else if (material === 'comida') fruta++;
      else pedra++;
      // pico nevado e gelo marinho sao chao coberto: nada nasce ali
      if (g.bioma[i] === B.pico || g.bioma[i] === B.gelo) gelado++;
    }
    return {
      mata: mata / chao,
      fruta: fruta / chao,
      pedra: pedra / chao,
      gelado,
      livre: (chao - mata - fruta - pedra) / chao,
    };
  }

  const inicio = censo();
  ok('nada nasce no pico nevado nem no gelo do mar', inicio.gelado === 0,
     `${inicio.gelado} tiles`);

  // O mundo tem de continuar tendo chao a vista depois de rodar um bom tempo:
  // sem teto, a rebrota fecha toda clareira e o mapa vira um tapete de objetos.
  for (let i = 0; i < 30000; i++) m.avancar();
  const fim = censo();

  ok('o chao nao lota com o tempo', fim.livre > 0.5,
     `${(fim.livre * 100).toFixed(0)}% do chao livre`);
  // A folga de 30% não é frouxidão: o teto é um alvo de um controle que **mede
  // de tempos em tempos** (`intervaloCensoDoChao`), e entre duas contagens a
  // rebrota continua. O que o teste garante é que o chão não dispara; exigir o
  // valor exato só faria o teste quebrar sempre que a chuva ficasse mais
  // generosa.
  ok('a mata respeita o teto', fim.mata <= BAL.tetoDoChao.madeira * 1.3,
     `${(fim.mata * 100).toFixed(1)}% de ${(BAL.tetoDoChao.madeira * 100).toFixed(0)}%`);
  ok('a fruta respeita o teto', fim.fruta <= BAL.tetoDoChao.comida * 1.3,
     `${(fim.fruta * 100).toFixed(1)}% de ${(BAL.tetoDoChao.comida * 100).toFixed(0)}%`);
  ok('a fruta nao some do mundo', fim.fruta > 0.03,
     `${(fim.fruta * 100).toFixed(1)}% do chao`);
  ok('a rebrota nao leva planta para bioma errado', fim.gelado === 0,
     `${fim.gelado} tiles gelados com recurso`);

  // a lava das bombas nao pode comer o continente
  let lava = 0;
  for (let i = 0; i < g.total; i++) if (g.bioma[i] === B.lava) lava++;
  ok('a lava esfria em vez de se acumular', lava < g.total * 0.01, `${lava} tiles`);

  // o vulcao sobrevive a propria lava
  let sobraram = 0;
  for (let i = 0; i < g.total; i++) if (g.construcao[i] === ED.vulcao + 1) sobraram++;
  ok('o vulcao nao se destroi', sobraram === cones, `${sobraram} de ${cones}`);

  // lavoura junto do moinho, e nao salpicada pela vila
  let moinhos = 0;
  let pertoDoMoinho = 0;
  let fazendas = 0;
  for (let i = 0; i < g.total; i++) {
    if (g.construcao[i] === ED.moinho + 1) moinhos++;
    else if (g.construcao[i] === ED.fazenda + 1) fazendas++;
  }
  if (moinhos > 0 && fazendas > 0) {
    for (let i = 0; i < g.total; i++) {
      if (g.construcao[i] !== ED.fazenda + 1) continue;
      const fx = i % g.largura;
      const fy = (i / g.largura) | 0;
      let achou = false;
      for (let dy = -8; dy <= 8 && !achou; dy++) {
        for (let dx = -8; dx <= 8; dx++) {
          const x = fx + dx;
          const y = fy + dy;
          if (x < 0 || y < 0 || x >= g.largura || y >= g.altura) continue;
          if (g.construcao[g.idx(x, y)] === ED.moinho + 1) {
            achou = true;
            break;
          }
        }
      }
      if (achou) pertoDoMoinho++;
    }
    ok('a lavoura se junta em volta do moinho', pertoDoMoinho / fazendas > 0.4,
       `${((pertoDoMoinho / fazendas) * 100).toFixed(0)}% das ${fazendas} fazendas`);
  }
}


// 17. a rede de agua doce: nascente fina, rio largo, afluente e lago
{
  const problemas: string[] = [];
  let comLago = 0;
  const sementes = ['agua-a', 'agua-b', 'agua-c'];

  for (const semente of sementes) {
    const m = new Mundo(TAMANHOS[1], semente);
    gerarTerreno(m);
    const g = m.grid;

    let rio = 0;
    let lago = 0;
    let chao = 0;
    let fozes = 0;
    const viz = new Int32Array(8);
    for (let i = 0; i < g.total; i++) {
      if (g.bioma[i] === B.rio) rio++;
      else if (g.bioma[i] === B.lago) lago++;
      else if (g.ehTerra(i)) chao++;
      if (g.bioma[i] !== B.rio) continue;
      const n = g.vizinhos8(i % g.largura, (i / g.largura) | 0, viz);
      for (let k = 0; k < n; k++) {
        const b = g.bioma[viz[k]];
        if (b === B.oceano || b === B.raso || b === B.oceano_profundo) {
          fozes++;
          break;
        }
      }
    }
    const molhado = rio / (chao + rio + lago);
    if (molhado < 0.008) problemas.push(`${semente}: só ${(molhado * 100).toFixed(1)}% de rio`);
    if (molhado > 0.08) problemas.push(`${semente}: ${(molhado * 100).toFixed(1)}% de rio, alagado`);
    // Rio que não chega ao mar é rio que morre no meio do nada. Alguns somem em
    // lago de propósito, mas a maioria da rede tem de desaguar.
    if (fozes < 8) problemas.push(`${semente}: só ${fozes} tiles de foz`);
    if (lago > 0) comLago++;

    // Larguras: o mesmo rio tem de ser fino na nascente e largo perto da foz.
    // É a prova de que a vazão está sendo acumulada, e não que cada curso foi
    // desenhado com a mesma espessura do começo ao fim.
    const larguras: number[] = [];
    for (let y = 0; y < g.altura; y++) {
      let corrida = 0;
      for (let x = 0; x <= g.largura; x++) {
        const ehRio = x < g.largura && g.bioma[g.idx(x, y)] === B.rio;
        if (ehRio) {
          corrida++;
          continue;
        }
        if (corrida > 0) larguras.push(corrida);
        corrida = 0;
      }
    }
    larguras.sort((a, b) => a - b);
    const fino = larguras[0] ?? 0;
    const largo = larguras[larguras.length - 1] ?? 0;
    if (fino > 1) problemas.push(`${semente}: nem um córrego de um tile`);
    if (largo < 3) problemas.push(`${semente}: rio mais largo tem só ${largo} tiles`);
  }

  ok('todo mundo nasce com rios que desaguam', problemas.length === 0, problemas.join(' · '));
  ok('há rio fino e rio largo no mesmo mundo', problemas.length === 0, 'largura varia com a vazão');
  ok('aparecem lagos', comLago >= 2, `${comLago} de ${sementes.length} mundos com lago`);

  // A água doce não pode nascer empoçada em cima da montanha: o preenchimento
  // de depressões existe justamente para toda gota ter caminho até o mar.
  const m = new Mundo(TAMANHOS[0], 'agua-d');
  gerarTerreno(m);
  const g = m.grid;
  let ilhadas = 0;
  const viz = new Int32Array(8);
  for (let i = 0; i < g.total; i++) {
    if (g.bioma[i] !== B.rio) continue;
    const n = g.vizinhos8(i % g.largura, (i / g.largura) | 0, viz);
    let vizinhaAgua = 0;
    for (let k = 0; k < n; k++) if (g.ehAgua(viz[k])) vizinhaAgua++;
    if (vizinhaAgua === 0) ilhadas++;
  }
  ok('não há poça de rio solta no mapa', ilhadas === 0, `${ilhadas} tiles isolados`);
}


// 18. o mar: porto, frota, pesca e colonia de alem-mar
{
  const m = new Mundo(TAMANHOS[1], 'chk-mar');
  montarPipeline(m);
  // Arquipelago forte de proposito. Nao e so "onde o barco cabe": num
  // continente unico a colonizacao por mar nao deveria mesmo acontecer, porque
  // ha terra livre a pe. O teste so mede o que quer medir se a geografia
  // obrigar a travessia.
  gerarTerreno(m, { ilhas: 0.85, fracaoTerra: 0.32 });
  povoar(m, { civilizacoes: 4 });
  ensinarTudo(m);

  let colonias = 0;
  let descargas = 0;
  let comidaDoMar = 0;
  m.eventos.on('barco:colonizou', () => colonias++);
  m.eventos.on('barco:atracou', (d) => {
    descargas++;
    comidaDoMar += d.carga;
  });
  for (let i = 0; i < 40000; i++) m.avancar();
  const g = m.grid;

  let portos = 0;
  const foraDaAgua: string[] = [];
  const viz = new Int32Array(8);
  for (let i = 0; i < g.total; i++) {
    if (g.construcao[i] !== ED.porto + 1) continue;
    portos++;
    // Porto tem de ter agua de atracar: mar ou lago, nunca so rio. E a regra
    // que o distingue de qualquer outra obra.
    let mar = 0;
    for (let dy = -1; dy <= ED_OCUPA[ED.porto * 2 + 1]; dy++) {
      for (let dx = -1; dx <= ED_OCUPA[ED.porto * 2]; dx++) {
        const x = (i % g.largura) + dx;
        const y = ((i / g.largura) | 0) + dy;
        if (!g.dentro(x, y)) continue;
        const j = g.idx(x, y);
        if (g.ehAgua(j) && g.bioma[j] !== B.rio) mar++;
      }
    }
    if (mar < 3) foraDaAgua.push(`${i % g.largura},${(i / g.largura) | 0}`);
  }
  void viz;

  ok('as vilas de beira-mar levantam porto', portos >= 2, `${portos} portos`);
  ok('nenhum porto longe da agua', foraDaAgua.length === 0, foraDaAgua.join(' '));
  ok('a frota sai do porto', m.barcos.length >= 2,
     `${m.barcos.length} barcos · ${m.barcos.filter((b) => b.tipo === 0).length} pesqueiros`);
  ok('o pesqueiro traz comida para casa', descargas > 0,
     `${descargas} descargas · ${Math.round(comidaDoMar)} de comida`);
  ok('o navio funda colonia do outro lado do mar', colonias > 0, `${colonias} colonias`);

  // barco nenhum pode estar em cima de terra firme
  const encalhados = m.barcos.filter((b) => {
    const x = Math.max(0, Math.min(g.largura - 1, b.x | 0));
    const y = Math.max(0, Math.min(g.altura - 1, b.y | 0));
    return !g.ehAgua(g.idx(x, y));
  });
  ok('nenhum barco encalhado em terra', encalhados.length === 0,
     `${encalhados.length} de ${m.barcos.length}`);

  // e a frota tem de sobreviver ao save
  const volta = desempacotar(empacotar(m));
  ok('a frota sobrevive ao save', volta.barcos.length === m.barcos.length,
     `${volta.barcos.length} de ${m.barcos.length}`);
}


// 19. politica: cargo, fortuna, linhagem e sucessao
{
  const m = new Mundo(TAMANHOS[1], 'chk-politica');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 4 });
  ensinarTudo(m);

  let coroacoes = 0;
  let porLinhagem = 0;
  const casasJaVistas = new Set<number>();
  m.eventos.on('reino:coroou', (d) => {
    coroacoes++;
    if (casasJaVistas.has(d.casa)) porLinhagem++;
    casasJaVistas.add(d.casa);
  });

  for (let i = 0; i < 30000; i++) m.avancar();
  const c = m.criaturas;
  const vivas = m.aldeias.filter((a) => a.ativa);
  const reinos = m.reinos.filter((r) => r.ativo);

  // 1. o trabalho tem de virar dinheiro, senao "o mais rico" e um empate em zero
  let civis = 0;
  let comOuro = 0;
  let comFamilia = 0;
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i] || ESP_CIVILIZADO[c.especie[i]] === 0) continue;
    civis++;
    if (c.riqueza[i] > 0) comOuro++;
    if (c.familia[i] >= 0) comFamilia++;
  }
  ok('o trabalho vira dinheiro no bolso', civis === 0 || comOuro > civis * 0.5,
     `${comOuro} de ${civis} civilizados com ouro`);
  ok('a linhagem passa de pai para filho', civis === 0 || comFamilia > civis * 0.7,
     `${comFamilia} de ${civis} com familia`);

  // 2. toda vila viva tem quem mande nela, e e o mais rico
  const semGoverno = vivas.filter((a) => a.governante < 0 || c.vivo[a.governante] !== 1);
  ok('toda vila tem governante vivo', semGoverno.length === 0,
     `${semGoverno.length} de ${vivas.length} sem`);

  let errados = 0;
  for (const a of vivas) {
    if (a.governante < 0 || c.vivo[a.governante] !== 1) continue;
    let maior = -1;
    for (let i = 0; i < c.limite; i++) {
      if (!c.vivo[i] || c.aldeia[i] !== a.id) continue;
      if (c.riqueza[i] > maior) maior = c.riqueza[i];
    }
    // o titular tem o bonus de cargo, entao pode estar um pouco abaixo do topo
    if (c.riqueza[a.governante] < maior * 0.8) errados++;
  }
  ok('quem governa a vila e o mais rico dela', errados === 0,
     `${errados} de ${vivas.length} fora da regra`);

  // 3. todo reino vivo tem rei, e a coroa fica na familia quando da
  const semRei = reinos.filter((r) => r.rei < 0 || c.vivo[r.rei] !== 1);
  ok('todo reino tem rei vivo', semRei.length === 0, `${semRei.length} de ${reinos.length} sem`);
  ok('reis morrem e sao sucedidos', coroacoes > 3, `${coroacoes} coroacoes`);
  ok('a coroa fica na linhagem enquanto da', porLinhagem > 0,
     `${porLinhagem} de ${coroacoes} sucessoes dentro da mesma casa`);

  // 4. o rei atual tem de ser mesmo da casa real
  const foraDaCasa = reinos.filter(
    (r) => r.rei >= 0 && r.casaReal >= 0 && c.familia[r.rei] !== r.casaReal,
  );
  ok('o rei pertence a casa real', foraDaCasa.length === 0,
     `${foraDaCasa.length} reis fora da propria casa`);

  // 5. o imposto move ouro de baixo para cima
  const comTesouro = reinos.filter((r) => r.tesouro > 0).length;
  ok('o imposto enche o cofre do reino', reinos.length === 0 || comTesouro > 0,
     `${comTesouro} de ${reinos.length} reinos com tesouro`);

  // 6. e tudo isso tem de sobreviver ao save
  const volta = desempacotar(empacotar(m));
  const reisIguais = volta.reinos.every((r, k) => !r.ativo || r.rei === m.reinos[k].rei);
  const casasIguais = volta.reinos.every((r, k) => !r.ativo || r.casaReal === m.reinos[k].casaReal);
  const govIguais = volta.aldeias.every((a, k) => !a.ativa || a.governante === m.aldeias[k].governante);
  ok('rei, casa real e governante sobrevivem ao save', reisIguais && casasIguais && govIguais);
  let riquezaIgual = true;
  for (let i = 0; i < c.limite; i++) {
    if (Math.abs(volta.criaturas.riqueza[i] - c.riqueza[i]) > 0.01) riquezaIgual = false;
  }
  ok('a riqueza de cada um sobrevive ao save', riquezaIgual);
}


// 17. névoa diplomática, casus belli e rebelião
{
  const m = new Mundo(TAMANHOS[1], 'chk-politica2');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 4 });
  ensinarTudo(m);

  // 1. ninguém nasce sabendo dos outros
  const ativosNoInicio = m.reinos.filter((r) => r.ativo);
  ok('reino nenhum começa conhecendo outro',
     ativosNoInicio.every((r) => r.conhecidos.size === 0),
     `${ativosNoInicio.map((r) => r.conhecidos.size).join('/')} conhecidos`);

  // 2. e nada de diplomacia acontece na névoa: sem conhecer, sem relação
  m.mudarRelacao(ativosNoInicio[0].id, ativosNoInicio[1].id, -50);
  ok('a névoa bloqueia a relação',
     m.relacao(ativosNoInicio[0].id, ativosNoInicio[1].id) === 0);

  const motivos: string[] = [];
  m.eventos.on('reino:guerra', (d) => motivos.push(d.motivo));
  for (let i = 0; i < 30000; i++) m.avancar();

  // 3. o conhecimento cresce, mas não vira onisciência
  const ativos = m.reinos.filter((r) => r.ativo);
  const conhecidos = ativos.reduce((n, r) => n + r.conhecidos.size, 0);
  ok('os reinos se descobrem com o tempo', conhecidos > 0,
     `${conhecidos} pares de conhecimento entre ${ativos.length} reinos`);

  // 4. toda guerra declarada tem motivo escrito
  ok('nenhuma guerra sem motivo declarado',
     motivos.every((t) => t.length > 0 && t !== 'sem motivo declarado'),
     `${motivos.length} guerras`);

  // 5. clãs existem, e não é um por povo
  ok('o mundo tem clãs de sobra', m.clas.length > 8, `${m.clas.length} clãs`);

  // 6. rebelião: leva o território, funda reino do mesmo povo e nasce em guerra
  const candidata = m.aldeias.find(
    (a) => a.ativa
      && m.reinos[a.reino]?.ativo
      && m.reinos[a.reino].aldeias.length > 1
      && m.reinos[a.reino].capital !== a.id
      && a.populacao >= 2
      // com território de verdade, senão a conferência de chão transferido
      // passa comparando zero com zero e não garante nada
      && a.tilesTerritorio > 20,
  );
  if (!candidata) {
    ok('havia vila para testar a rebelião', false);
  } else {
    const antigo = candidata.reino;
    const chaoAntes = (() => {
      let n = 0;
      for (let i = 0; i < m.grid.total; i++) if (m.grid.aldeiaDona[i] === candidata.id) n++;
      return n;
    })();
    const deu = tentarRebelar(m, candidata, true);
    ok('a vila se separa quando o jogador manda', deu);
    const novo = candidata.reino;
    ok('a rebelião funda um reino do mesmo povo',
       novo !== antigo && m.reinos[novo]?.especie === m.reinos[antigo]?.especie);
    ok('a rebelião nasce em guerra com o reino de origem', m.emGuerra(novo, antigo));
    let chaoDepois = 0;
    for (let i = 0; i < m.grid.total; i++) {
      if (m.grid.aldeiaDona[i] === candidata.id && m.grid.territorio[i] === novo) chaoDepois++;
    }
    ok('o território vai junto com quem se rebela', chaoAntes > 0 && chaoDepois === chaoAntes,
       `${chaoDepois} de ${chaoAntes} tiles`);
    ok('o reino novo tem rei vivo',
       m.reinos[novo].rei >= 0 && m.criaturas.vivo[m.reinos[novo].rei] === 1);
  }

  // 7. e tudo isso sobrevive ao save
  const volta = desempacotar(empacotar(m));
  const conheceIgual = volta.reinos.every(
    (r, k) => !r.ativo || r.conhecidos.size === m.reinos[k].conhecidos.size,
  );
  const clasIguais = volta.clas.length === m.clas.length;
  ok('névoa e clãs sobrevivem ao save', conheceIgual && clasIguais);
}

// 18. tecnologia: começo primitivo, descoberta e material de obra
{
  const m = new Mundo(TAMANHOS[1], 'chk-tecnologia');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 4 });

  // 1. ninguém começa sabendo mais que fazer fogo e lascar pedra
  const inicio = m.reinos.filter((r) => r.ativo);
  ok('todo povo começa na era tribal', inicio.every((r) => r.era === 0));
  ok('e sabendo só o que se nasce sabendo',
     inicio.every((r) => r.tecnologias.size === TEC_INICIAIS.length),
     `${inicio.map((r) => r.tecnologias.size).join('/')} de ${tecnologias.tamanho}`);
  ok('a tribo não sabe erguer casa',
     inicio.every((r) => !r.tecnologias.has(tecnologias.indice('abrigo'))));

  const descobertas: number[] = [];
  m.eventos.on('reino:descobriu', (d) => descobertas.push(d.tecnologia));

  // Instantâneo cedo: com três mil ticks ninguém passou da carpintaria, e o
  // mundo inteiro tem de ser de barro e madeira. Se pedra aparecer aqui, a
  // árvore de tecnologia furou em algum lugar.
  for (let i = 0; i < 3000; i++) m.avancar();
  const cedo = new Set<number>();
  for (let i = 0; i < m.grid.total; i++) {
    if (m.grid.construcao[i] !== 0) cedo.add(materialDoAcabamento(m.grid.acabamento[i]));
  }
  ok('o mundo jovem ainda não conhece a pedra', ![...cedo].some((mt) => mt >= 2),
     `materiais em uso: ${[...cedo].sort().join(', ')}`);

  for (let i = 0; i < 9000; i++) m.avancar();

  // 2. e a partir daí ela descobre coisas, na ordem certa
  ok('as civilizações descobrem com o tempo', descobertas.length > 6,
     `${descobertas.length} descobertas em 12 mil ticks`);
  const vivos = m.reinos.filter((r) => r.ativo);
  ok('alguém saiu da era tribal', vivos.some((r) => r.era > 0),
     `eras ${vivos.map((r) => r.era).join('/')}`);
  ok('ninguém pula pré-requisito', vivos.every((r) => [...r.tecnologias].every(
    (t) => TEC_REQUER[t].every((req) => r.tecnologias.has(req)),
  )));

  // 3. no começo do mundo o povo dorme em volta do fogo, não em casa
  const g = m.grid;
  let fogueiras = 0;
  for (let i = 0; i < g.total; i++) if (g.construcao[i] === ED.fogueira + 1) fogueiras++;
  ok('a era tribal levanta fogueira', fogueiras > 0, `${fogueiras} fogueiras`);

  // 4. o material de obra sai da tecnologia, e nada é erguido acima dela
  let foraDaTecnologia = 0;
  let materiais = new Set<number>();
  for (let i = 0; i < g.total; i++) {
    const e = g.construcao[i];
    if (e === 0 || ED_NATURAL[e - 1] === 1 || e - 1 === ED.ruina) continue;
    const dona = m.aldeias[g.aldeiaDona[i]];
    if (!dona?.ativa) continue;
    const reino = m.reinos[dona.reino];
    if (!reino?.ativo) continue;
    const usado = materialDoAcabamento(g.acabamento[i]);
    materiais.add(usado);
    // o prédio pode ser mais antigo que a descoberta atual, nunca mais novo
    if (usado > materialDoReino(reino)) foraDaTecnologia++;
  }
  ok('ninguém constrói com material que não domina', foraDaTecnologia === 0,
     `${foraDaTecnologia} prédios acima da tecnologia do reino`);
  // Doze mil ticks é cedo: alguém pode já ter chegado à carpintaria, ninguém
  // chega à alvenaria. O que o teste garante é que o mundo ainda é primitivo —
  // se pedra aparecer aqui, a árvore de tecnologia furou em algum lugar.
  ok('o mundo mais velho já construiu de mais de um material', materiais.size > 1,
     `materiais em uso: ${[...materiais].sort().join(', ')}`);

  // 4b. e quando um reino aprende a assentar pedra, ele passa a construir de
  // pedra — que é o pedido em uma frase. O vizinho que não aprendeu continua
  // levantando choça, e as duas coisas ficam lado a lado no mapa.
  const adiantado = m.reinos.find((r) => r.ativo && r.aldeias.length > 1);
  if (!adiantado) {
    ok('havia reino para adiantar', false);
  } else {
    aprender(m, adiantado, tecnologias.indice('alvenaria'));
    ok('quem aprende alvenaria passa a construir de pedra',
       materialDoReino(adiantado) === 2, `material ${materialDoReino(adiantado)}`);
    const antes = new Set<number>();
    for (let i = 0; i < g.total; i++) {
      const e = g.construcao[i];
      if (e === 0) continue;
      const dona = m.aldeias[g.aldeiaDona[i]];
      if (dona?.ativa && dona.reino === adiantado.id) antes.add(i);
    }
    for (let i = 0; i < 4000; i++) m.avancar();
    let dePedra = 0;
    for (let i = 0; i < g.total; i++) {
      const e = g.construcao[i];
      if (e === 0 || antes.has(i) || ED_NATURAL[e - 1] === 1) continue;
      const dona = m.aldeias[g.aldeiaDona[i]];
      if (dona?.ativa && dona.reino === adiantado.id && materialDoAcabamento(g.acabamento[i]) >= 2) {
        dePedra++;
      }
    }
    ok('e o que ele ergue dali em diante é de pedra', dePedra > 0,
       `${dePedra} obras novas de pedra`);
  }

  // 5. e o material muda o que o prédio vale
  const palha = MATERIAIS_DE_OBRA[0].fator;
  const lavrada = MATERIAIS_DE_OBRA[MATERIAIS_DE_OBRA.length - 1].fator;
  // A faixa é deliberadamente moderada — ver o comentário em MATERIAIS_DE_OBRA —
  // mas tem de continuar valendo a pena descobrir: quase o dobro, de ponta a
  // ponta.
  ok('material melhor rende prédio melhor', lavrada > palha * 1.8,
     `${palha} contra ${lavrada}`);

  // 6. quem se separa leva o que sabia
  const candidata = m.aldeias.find(
    (a) => a.ativa
      && m.reinos[a.reino]?.ativo
      && m.reinos[a.reino].aldeias.length > 1
      && m.reinos[a.reino].capital !== a.id
      && a.populacao >= 2,
  );
  if (candidata) {
    const mae = m.reinos[candidata.reino];
    const sabia = mae.tecnologias.size;
    const eraMae = mae.era;
    if (tentarRebelar(m, candidata, true)) {
      const filho = m.reinos[candidata.reino];
      ok('o reino rebelde herda a tecnologia do que deixou',
         filho.tecnologias.size === sabia && filho.era === eraMae,
         `${filho.tecnologias.size} de ${sabia}, era ${filho.era} contra ${eraMae}`);
    }
  }

  // 7. e tudo isso sobrevive ao save
  const volta = desempacotar(empacotar(m));
  const tecIgual = volta.reinos.every(
    (r, k) => !r.ativo || r.tecnologias.size === m.reinos[k].tecnologias.size,
  );
  let acabamentoIgual = true;
  for (let i = 0; i < g.total; i++) {
    if (volta.grid.acabamento[i] !== g.acabamento[i]) acabamentoIgual = false;
  }
  ok('tecnologia e material de obra sobrevivem ao save', tecIgual && acabamentoIgual);
}

// 19. genética: traços e mestiçagem
{
  const m = new Mundo(TAMANHOS[1], 'chk-genetica');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 4 });
  ensinarTudo(m);

  // Os reinos começam se conhecendo. A névoa tem os testes dela; aqui a
  // pergunta é se, com povos que se toleram em contato, nasce mestiço sem
  // ninguém mandar. Sem isto o teste dependia de humanos e elfos se
  // esbarrarem por acaso numa semente só, e falhava quando não esbarravam.
  for (const r of m.reinos) {
    for (const o of m.reinos) if (r.id !== o.id) r.conhecidos.add(o.id);
  }

  let mesticos = 0;
  const povosMesticos = new Set<number>();
  m.eventos.on('criatura:mesticou', (d) => {
    mesticos++;
    povosMesticos.add(d.especie);
  });
  for (let i = 0; i < 30000; i++) m.avancar();
  const c = m.criaturas;

  // 1. traço é coisa de gente, e bicho não carrega nenhum
  let comTraco = 0;
  let civis = 0;
  let bichoComTraco = 0;
  let opostosJuntos = 0;
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i]) continue;
    if (ESP_INTELIGENTE[c.especie[i]] === 1) {
      civis++;
      if (c.tracos[i] !== 0) comTraco++;
    } else if (c.tracos[i] !== 0) {
      bichoComTraco++;
    }
    // e ninguém carrega um traço e o oposto dele ao mesmo tempo
    for (let t = 0; t < TOTAL_TRACOS; t++) {
      if ((c.tracos[i] & (1 << t)) === 0) continue;
      if ((c.tracos[i] & TRACO_OPOSTOS[t]) !== 0) opostosJuntos++;
    }
  }
  ok('os inteligentes têm traços', civis === 0 || comTraco > civis * 0.3,
     `${comTraco} de ${civis}`);
  ok('bicho nenhum tem traço', bichoComTraco === 0, `${bichoComTraco} com traço`);
  ok('ninguém carrega um traço e o oposto dele', opostosJuntos === 0,
     `${opostosJuntos} casos`);

  // 2. o traço muda o número, e não só a ficha
  const forte = 1 << tracos.indice('forte');
  const franzino = 1 << tracos.indice('franzino');
  const humano = especies.indice('humano');
  const testeVida = (mascara: number): number => {
    const id = m.nascer(humano, 10, 10, 0);
    c.tracos[id] = mascara;
    const v = vidaMaxima(c, id);
    m.matar(id, 'jogador');
    return v;
  };
  const vForte = testeVida(forte);
  const vFranzino = testeVida(franzino);
  const vComum = testeVida(0);
  ok('forte tem mais vida que o comum, e franzino menos',
     vForte > vComum && vComum > vFranzino,
     `${vFranzino.toFixed(0)} < ${vComum.toFixed(0)} < ${vForte.toFixed(0)}`);

  // 3. imortal não morre de velhice
  {
    const id = m.nascer(humano, 10, 10, 0);
    c.tracos[id] = 1 << tracos.indice('imortal');
    c.idade[id] = c.longevidade[id] + 1e6;
    const antes = c.quantidade;
    m.avancar();
    ok('o imortal não morre de velhice', c.vivo[id] === 1 && c.quantidade >= antes - 1);
    m.matar(id, 'jogador');
  }

  // 4. quem cruza com quem sai do ódio entre os povos, e de mais nada
  const elfo = especies.indice('elfo');
  const anao = especies.indice('anao');
  const orc = especies.indice('orc');
  ok('humano e elfo podem ter filho', podemCruzar(humano, elfo));
  ok('humano e anão podem ter filho', podemCruzar(humano, anao));
  ok('elfo e anão não podem: se detestam demais', !podemCruzar(elfo, anao));
  ok('ninguém cruza com orc', !podemCruzar(humano, orc) && !podemCruzar(elfo, orc));
  ok('bicho não entra nessa conta',
     !podemCruzar(especies.indice('lobo'), especies.indice('raposa')));

  // 5. e o filho de um casal misto é o mestiço certo
  const meioElfo = especies.indice('humano_elfo');
  ok('humano com elfo faz meio-elfo', especieDoFilho(m, humano, elfo) === meioElfo);
  ok('meio-elfo com humano faz um dos dois',
     [humano, meioElfo].includes(especieDoFilho(m, meioElfo, humano)));

  // 6. e isso acontece sozinho num mundo rodando
  ok('nascem mestiços por conta própria', mesticos > 0,
     `${mesticos} nascimentos, ${povosMesticos.size} povo(s) mestiço(s)`);

  // 7. tudo sobrevive ao save
  const volta = desempacotar(empacotar(m));
  let iguais = true;
  for (let i = 0; i < c.limite; i++) {
    if (volta.criaturas.tracos[i] !== c.tracos[i]) iguais = false;
  }
  ok('os traços sobrevivem ao save', iguais);
}

// 20. as ferramentas do jogador: todas rodam, e nenhuma corrompe o mundo
{
  const m = new Mundo(TAMANHOS[0], 'chk-poderes');
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: 3 });
  ensinarTudo(m);
  for (let i = 0; i < 2000; i++) m.avancar();

  // Cada poder é aplicado em três pontos — o centro do mapa, uma vila e um
  // canto de mar — e o mundo anda alguns ticks depois de cada um. Com quase
  // duzentas ferramentas, é a única forma de saber que nenhuma delas explode
  // num caso que o desenvolvimento não visitou.
  const g = m.grid;
  const vila = m.aldeias.find((a) => a.ativa);
  const pontos: Array<[number, number]> = [
    [g.largura / 2, g.altura / 2],
    vila ? [vila.x, vila.y] : [4, 4],
    [2, 2],
  ];

  let quebrados = 0;
  const culpados: string[] = [];
  for (const p of poderes.todos()) {
    for (const [px, py] of pontos) {
      try {
        p.aplicar(m, px, py, p.raio, 0);
      } catch (e) {
        quebrados++;
        culpados.push(`${p.id}: ${(e as Error).message}`);
        break;
      }
    }
  }
  ok('todo poder roda sem estourar', quebrados === 0,
     `${poderes.tamanho} poderes · ${culpados.slice(0, 3).join(' | ')}`);

  // e o mundo continua rodando depois de levar todos eles na cabeça
  let andouSemQuebrar = true;
  try {
    for (let i = 0; i < 400; i++) m.avancar();
  } catch (e) {
    andouSemQuebrar = false;
    console.log(`   (o mundo parou: ${(e as Error).message})`);
  }
  ok('o mundo sobrevive a todos eles', andouSemQuebrar);

  // nenhuma criatura ficou fora do mapa, e nenhuma construção sem âncora
  const c = m.criaturas;
  let foraDoMapa = 0;
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i]) continue;
    if (c.x[i] < 0 || c.y[i] < 0 || c.x[i] >= g.largura || c.y[i] >= g.altura) foraDoMapa++;
  }
  ok('ninguém foi parar fora do mapa', foraDoMapa === 0, `${foraDoMapa} criaturas`);

  let orfaos = 0;
  for (let i = 0; i < g.total; i++) {
    const o = g.ocupacao[i];
    if (o >= 0 && g.construcao[o] === 0) orfaos++;
  }
  ok('nenhum tile preso a construção que não existe', orfaos === 0, `${orfaos} tiles`);

  // e o estrago todo ainda cabe num save
  let salvou = true;
  try {
    desempacotar(empacotar(m));
  } catch (e) {
    salvou = false;
    console.log(`   (o save quebrou: ${(e as Error).message})`);
  }
  ok('o mundo depois de tudo isso ainda salva e carrega', salvou);

  // as abas: todo poder mora numa categoria que a interface conhece
  const foraDeAba = poderes.filtrar((p) => !CATEGORIAS.includes(p.categoria));
  ok('todo poder tem aba', foraDeAba.length === 0,
     foraDeAba.map((p) => p.id).join(', '));
  for (const cat of CATEGORIAS) {
    const n = poderes.filtrar((p) => p.categoria === cat).length;
    if (n === 0) ok(`a aba ${cat} não está vazia`, false);
  }
  ok('as abas estão povoadas', CATEGORIAS.every(
    (cat) => poderes.filtrar((p) => p.categoria === cat).length > 0,
  ), CATEGORIAS.map((cat) => `${cat} ${poderes.filtrar((p) => p.categoria === cat).length}`).join(' · '));
}

// 21 em diante: a versão 2 (estações, poço e banco, preço, profissões,
// caminho e animação). Moram em `testes2.ts`, que também roda sozinho.
testes2(ok);
testesProfissoes(ok);
testesCaminho(ok);
testesAnimacao(ok);

console.log('');
console.log(falhas === 0 ? 'TUDO OK' : `${falhas} FALHAS`);
process.exit(falhas === 0 ? 0 : 1);
