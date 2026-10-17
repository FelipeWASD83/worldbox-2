/**
 * Testes da versão 2: estações, poço e banco, preço por oferta e procura,
 * profissões, busca de caminho e animação.
 *
 * Rodam no fim do `npm test`. Para rodar só estes, enquanto se mexe neles:
 *
 *   npx tsx tools/testes2.ts
 *
 * A pergunta que cada um responde é a do CLAUDE.md: o que este teste mostraria
 * se o sistema fosse apagado? Todos comparam o mundo **com** a mecânica contra
 * o mesmo mundo **sem** ela, ou medem um efeito que só ela produz.
 */
import { Mundo, TAMANHOS, type Aldeia } from '../src/core/mundo.js';
import { montarPipeline } from '../src/sim/index.js';
import { gerarTerreno, povoar } from '../src/sim/geracao.js';
import { empacotar, desempacotar } from '../src/core/save.js';
import { ED } from '../src/dados/edificios.js';
import { tecnologias } from '../src/dados/tecnologias.js';
import { TICKS_ANO } from '../src/dados/especies.js';
import { BAL } from '../src/sim/balanco.js';
import {
  Estacao, estacaoDe, linhaDaNeve, nevado,
} from '../src/sim/estacoes.js';
import { rendaDaLavoura } from '../src/sim/civilizacao.js';
import { sistemaEconomia, fatorDePreco } from '../src/sim/economia.js';
import { atear, fogoDeVerao } from '../src/sim/ecologia.js';
import {
  NOME_OFICIO, Oficio, TOTAL_OFICIOS, cotasDaVila, oQueBuscar, oficioDe, redistribuir,
} from '../src/sim/profissoes.js';
import { ESP_INTELIGENTE } from '../src/dados/especies.js';
import { Estado, MARCA_SOLDADO } from '../src/core/criaturas.js';
import { NIVEL_MAR } from '../src/core/grid.js';
import { B } from '../src/dados/biomas.js';
import { especies } from '../src/dados/especies.js';
import { sistemaMovimento } from '../src/sim/movimento.js';
import { MOLDES, QUADROS_POR_DIRECAO, quadrosDe } from '../src/render/moldes.js';

type Ok = (nome: string, cond: boolean, extra?: string) => void;

function mundoCivilizado(semente: string, tamanho = TAMANHOS[1], civs = 4): Mundo {
  const m = new Mundo(tamanho, semente);
  montarPipeline(m);
  gerarTerreno(m);
  povoar(m, { civilizacoes: civs });
  for (const r of m.reinos) {
    if (!r.ativo) continue;
    for (let t = 0; t < tecnologias.tamanho; t++) r.tecnologias.add(t);
    r.era = 3;
  }
  return m;
}

/** Tick no meio de uma estação, no ano `ano`. */
function meioDa(estacao: number, ano = 1): number {
  return ano * TICKS_ANO + Math.round((estacao + 0.5) * (TICKS_ANO / 4));
}

/** Põe um prédio no mapa como se a vila o tivesse erguido, e reconta a vila. */
function plantarPredio(m: Mundo, a: Aldeia, tipo: number): boolean {
  const g = m.grid;
  for (let r = 1; r < 30; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = a.x + dx;
        const y = a.y + dy;
        if (x < 0 || y < 0 || x >= g.largura || y >= g.altura) continue;
        const i = g.idx(x, y);
        if (g.aldeiaDona[i] !== a.id || g.construcao[i] !== 0 || g.ocupacao[i] !== -1) continue;
        if (!g.ehTerra(i)) continue;
        g.construcao[i] = tipo + 1;
        g.ocupacao[i] = i;
        m.recalcularCapacidade(a);
        return true;
      }
    }
  }
  return false;
}

export function testes2(ok: Ok): void {
  // ------------------------------------------------------------ 21. estações
  {
    const nomes = new Set<number>();
    for (let t = 0; t < TICKS_ANO; t += 10) nomes.add(estacaoDe(t));
    ok('o ano tem quatro estações', nomes.size === 4);
    ok(
      'a linha da neve sobe no inverno e volta no verão',
      linhaDaNeve(meioDa(Estacao.Inverno)) > linhaDaNeve(meioDa(Estacao.Verao)) + 30,
      `inverno ${linhaDaNeve(meioDa(Estacao.Inverno))} · verão ${linhaDaNeve(meioDa(Estacao.Verao))}`,
    );

    const m = mundoCivilizado('chk-estacoes');
    const g = m.grid;
    const contarNeve = (): number => {
      let n = 0;
      for (let i = 0; i < g.total; i++) if (nevado(m, i)) n++;
      return n;
    };
    m.tick = meioDa(Estacao.Verao) - 1;
    for (let k = 0; k < 6; k++) m.avancar();
    const neveVerao = contarNeve();
    m.tick = meioDa(Estacao.Inverno) - 1;
    for (let k = 0; k < 6; k++) m.avancar();
    const neveInverno = contarNeve();
    ok('o inverno cobre de neve o campo temperado', neveInverno > g.total * 0.03 && neveVerao === 0,
       `${neveInverno} tiles nevados no inverno · ${neveVerao} no verão`);

    // O mato cresce muito mais na primavera que no inverno. Mesmo mundo,
    // vegetação zerada, os mesmos ticks; só a estação muda.
    const crescimento = (estacao: number): number => {
      const w = desempacotar(empacotar(m));
      montarPipeline(w);
      for (let i = 0; i < w.grid.total; i++) w.grid.vegetacao[i] = 0;
      w.tick = meioDa(estacao) - 30;
      for (let k = 0; k < 60; k++) w.avancar();
      let soma = 0;
      for (let i = 0; i < w.grid.total; i++) soma += w.grid.vegetacao[i];
      return soma;
    };
    const primavera = crescimento(Estacao.Primavera);
    const inverno = crescimento(Estacao.Inverno);
    ok('o mato cresce na primavera e quase para no inverno', primavera > inverno * 2.2,
       `primavera ${primavera} · inverno ${inverno}`);

    // A lavoura: colheita no outono, pouco no inverno, seca no verão.
    const a = m.aldeias.find((x) => x.ativa)!;
    a.predios[ED.poco] = 0;
    m.tick = meioDa(Estacao.Outono);
    const outono = rendaDaLavoura(m, a);
    m.tick = meioDa(Estacao.Inverno);
    const invernoL = rendaDaLavoura(m, a);
    m.tick = meioDa(Estacao.Verao);
    const veraoSemPoco = rendaDaLavoura(m, a);
    a.predios[ED.poco] = 1;
    const veraoComPoco = rendaDaLavoura(m, a);
    ok('a colheita é no outono', outono > invernoL * 2, `outono ${outono.toFixed(2)} · inverno ${invernoL.toFixed(2)}`);
    ok('o poço segura a seca do verão', veraoSemPoco < 1 && veraoComPoco >= 1,
       `sem poço ${veraoSemPoco.toFixed(2)} · com poço ${veraoComPoco.toFixed(2)}`);
    m.tick = meioDa(Estacao.Outono);
    a.predios[ED.poco] = 0;
    const semPoco = rendaDaLavoura(m, a);
    a.predios[ED.poco] = 2;
    ok('o poço rega a lavoura o ano todo', rendaDaLavoura(m, a) > semPoco * 1.15);
    a.predios[ED.poco] = 0;

    // O raio seco: num mundo quente e seco, o verão acende a savana sozinho.
    let raios = 0;
    m.eventos.on('clima:raioSeco', () => raios++);
    m.tick = meioDa(Estacao.Verao);
    for (let i = 0; i < g.total; i++) {
      if (!g.ehTerra(i)) continue;
      g.temp[i] = 210;
      g.umidade[i] = 40;
      g.vegetacao[i] = 220;
    }
    for (let k = 0; k < 40; k++) fogoDeVerao(m);
    ok('o verão acende incêndio sozinho em terra seca', raios > 0, `${raios} raios secos`);

    // E a estação sobrevive ao save: ela sai do tick.
    m.tick = meioDa(Estacao.Inverno) + 3;
    const volta = desempacotar(empacotar(m));
    ok('a estação volta igual depois de carregar', estacaoDe(volta.tick) === Estacao.Inverno);
  }

  // ------------------------------------------------------- 22. poço e banco
  {
    // O poço apaga incêndio: o mesmo fogo, no mesmo lugar, queima menos chão
    // dentro de uma vila com poço.
    const base = mundoCivilizado('chk-poco');
    for (let k = 0; k < 400; k++) base.avancar();
    const queimado = (comPoco: boolean): number => {
      let total = 0;
      for (let t = 0; t < 3; t++) {
        const m = desempacotar(empacotar(base));
        montarPipeline(m);
        const g = m.grid;
        const a = m.aldeias.find((x) => x.ativa && x.tilesTerritorio > 80)!;
        if (comPoco) plantarPredio(m, a, ED.poco);
        // tudo seco e cheio de mato dentro do território, para o fogo ter onde ir
        for (let i = 0; i < g.total; i++) {
          if (g.aldeiaDona[i] === a.id && g.ehTerra(i)) g.vegetacao[i] = 240;
        }
        m.tick = meioDa(Estacao.Primavera);
        const origem = g.idx(a.x + 2, a.y + 2);
        atear(m, origem);
        atear(m, g.idx(a.x - 2, a.y + 1));
        // Mede quanto fogo ficou aceso dentro da vila, somado tick a tick: é o
        // que o poço muda (cada foco dura um terço e pula menos). Contar os
        // tiles queimados até o fim não servia: numa vila pequena o fogo
        // acabava pegando quase o território inteiro nos dois mundos, e a
        // contagem batia no teto.
        for (let k = 0; k < 300; k++) {
          m.avancar();
          for (const i of m.chamas) if (g.aldeiaDona[i] === a.id) total++;
        }
      }
      return total;
    };
    const sem = queimado(false);
    const com = queimado(true);
    ok('o poço apaga incêndio dentro da vila', com < sem * 0.6,
       `${com} focos-tick com poço · ${sem} sem`);

    // O banco: cofre maior e juros.
    const m = mundoCivilizado('chk-banco');
    for (let k = 0; k < 200; k++) m.avancar();
    const a = m.aldeias.find((x) => x.ativa)!;
    const tetoAntes = a.tetoOuro;
    plantarPredio(m, a, ED.banco);
    ok('o banco tem cofre próprio', a.tetoOuro >= tetoAntes * BAL.cofreDoBanco * 0.99,
       `${tetoAntes} → ${a.tetoOuro}`);
    a.estoque.ouro = 500;
    const r = m.reinos[a.reino];
    r.tesouro = 1000;
    m.tick = BAL.intervaloComercio * 100;
    sistemaEconomia.executar(m);
    ok('o ouro guardado no banco rende juros', a.estoque.ouro > 500 && r.tesouro > 1000,
       `vila ${a.estoque.ouro.toFixed(1)} · tesouro ${r.tesouro.toFixed(1)}`);
    a.estoque.ouro = a.tetoOuro;
    sistemaEconomia.executar(m);
    ok('os juros respeitam o cofre', a.estoque.ouro <= a.tetoOuro + 0.001);
  }

  // -------------------------------------------- 23. preço por oferta e procura
  {
    const m = mundoCivilizado('chk-preco');
    for (let k = 0; k < 200; k++) m.avancar();
    const vilas = m.aldeias.filter((x) => x.ativa);
    ok('o mercado começa no preço base', Math.abs(fatorDePreco(m, 'comida') - 1) < 0.05);

    // fome em todo lugar: a comida encarece
    for (let k = 0; k < 20; k++) {
      for (const a of vilas) a.estoque.comida = 0;
      sistemaEconomia.executar(m);
    }
    const naFome = fatorDePreco(m, 'comida');
    ok('a falta encarece', naFome > 1.3, `comida a ${Math.round(naFome * 100)}%`);

    // fartura em todo lugar: a comida barateia
    for (let k = 0; k < 40; k++) {
      for (const a of vilas) a.estoque.comida = a.capacidadeEstoque;
      sistemaEconomia.executar(m);
    }
    const naFartura = fatorDePreco(m, 'comida');
    ok('a sobra barateia', naFartura < 0.9, `comida a ${Math.round(naFartura * 100)}%`);
    ok('o preço fica dentro dos limites',
       naFartura >= BAL.precoMinimo && naFome <= BAL.precoMaximo);

    const volta = desempacotar(empacotar(m));
    ok('o preço sobrevive ao save', Math.abs(fatorDePreco(volta, 'comida') - naFartura) < 1e-4);
  }
}

export function testesProfissoes(ok: Ok): void {
  // ------------------------------------------------------------ 24. profissões
  const m = mundoCivilizado('chk-oficios');
  for (let k = 0; k < 6000; k++) m.avancar();
  const c = m.criaturas;
  const conta = new Int32Array(TOTAL_OFICIOS);
  let adultos = 0;
  let criancasComOficio = 0;
  let bichoComOficio = 0;
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i]) continue;
    if (ESP_INTELIGENTE[c.especie[i]] === 0) {
      if (oficioDe(c, i) !== 0) bichoComOficio++;
      continue;
    }
    if (c.aldeia[i] < 0) continue;
    if (c.idade[i] < c.longevidade[i] * BAL.fracaoAdulto) {
      if (oficioDe(c, i) !== 0) criancasComOficio++;
      continue;
    }
    adultos++;
    conta[oficioDe(c, i)]++;
  }
  const semOficio = conta[Oficio.Nenhum];
  ok('todo adulto de vila tem ofício', adultos > 20 && semOficio <= adultos * 0.05,
     `${adultos - semOficio} de ${adultos} · ` +
     [...conta].map((n, o) => `${NOME_OFICIO[o]} ${n}`).filter((t) => !t.endsWith(' 0')).join(', '));
  ok('criança e bicho não têm ofício', criancasComOficio === 0 && bichoComOficio === 0,
     `${criancasComOficio} crianças · ${bichoComOficio} bichos`);
  ok('a vila tem lavrador, lenhador e construtor',
     conta[Oficio.Lavrador] > 0 && conta[Oficio.Lenhador] > 0 && conta[Oficio.Construtor] > 0);

  // Ofício de casa precisa do prédio: ninguém é mercador sem mercado.
  let semPredio = 0;
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i] || c.aldeia[i] < 0) continue;
    const a = m.aldeias[c.aldeia[i]];
    const o = oficioDe(c, i);
    if (o === Oficio.Mercador && a.predios[ED.mercado] === 0) semPredio++;
    if (o === Oficio.Ferreiro && a.predios[ED.ferraria] === 0) semPredio++;
  }
  ok('ninguém é mercador sem mercado nem ferreiro sem ferraria', semPredio === 0, `${semPredio} casos`);

  // Perícia sobe com o trabalho.
  let habeis = 0;
  for (let i = 0; i < c.limite; i++) if (c.vivo[i] && c.pericia[i] > 0.3) habeis++;
  ok('quem trabalha no ofício ganha perícia', habeis > adultos * 0.1, `${habeis} com mais de 30%`);

  // A vila redistribui pelo que falta: com o celeiro vazio, a cota de
  // lavradores é bem maior do que com ele cheio. A conta da cota é direta (a
  // mesma vila, os mesmos adultos, só o celeiro muda); a da redistribuição no
  // mundo vem logo depois, e só precisa ir no mesmo sentido.
  {
    const v = m.aldeias.find((x) => x.ativa && x.populacao > 5)!;
    const guardada = v.estoque.comida;
    const cota = new Float64Array(TOTAL_OFICIOS);
    v.estoque.comida = 0;
    cotasDaVila(v, 40, cota);
    const lavFome = cota[Oficio.Lavrador];
    v.estoque.comida = v.capacidadeEstoque;
    cotasDaVila(v, 40, cota);
    const lavFartura = cota[Oficio.Lavrador];
    v.estoque.comida = guardada;
    ok('celeiro vazio pede mais lavrador', lavFome >= lavFartura * 1.5,
       `${lavFome} na fome · ${lavFartura} na fartura, de 40 adultos`);
  }
  const lavradoresCom = (comida: (v: Aldeia) => number): number => {
    const w = desempacotar(empacotar(m));
    montarPipeline(w);
    for (let k = 0; k < 12; k++) {
      for (const a of w.aldeias) if (a.ativa) a.estoque.comida = comida(a);
      redistribuir(w);
    }
    let n = 0;
    for (const a of w.aldeias) if (a.ativa) n += a.oficios[Oficio.Lavrador];
    return n;
  };
  const naFome = lavradoresCom((a) => a.populacao * 3);
  const naFartura = lavradoresCom((a) => a.capacidadeEstoque);
  ok('e a vila de fato manda mais gente para a lavoura', naFome > naFartura,
     `${naFome} lavradores na fome · ${naFartura} na fartura`);

  // O que cada um sai para buscar: o estudioso fica em casa, a fome chama
  // todo mundo, e o lenhador busca madeira mesmo com a vila querendo comida.
  const a = m.aldeias.find((x) => x.ativa && x.populacao > 5)!;
  a.estoque.comida = a.capacidadeEstoque;
  a.estoque.madeira = 0;
  ok('o estudioso trabalha em casa', oQueBuscar(a, Oficio.Estudioso) === null);
  ok('o lenhador busca madeira', oQueBuscar(a, Oficio.Lenhador) === 'madeira');
  a.estoque.comida = 0;
  ok('a fome chama todo ofício para a comida',
     oQueBuscar(a, Oficio.Estudioso) === 'comida' && oQueBuscar(a, Oficio.Lenhador) === 'comida');

  // Perícia dá rendimento: a mesma carga de madeira, entregue por um lenhador
  // mestre e por um aprendiz, enche o celeiro de forma diferente.
  const entrega = (pericia: number): number => {
    const w = desempacotar(empacotar(m));
    montarPipeline(w);
    const v = w.aldeias.find((x) => x.ativa && x.id === a.id)!;
    v.estoque.madeira = 0;
    const cc = w.criaturas;
    let quem = -1;
    for (let i = 0; i < cc.limite; i++) {
      if (cc.vivo[i] && cc.aldeia[i] === v.id && ESP_INTELIGENTE[cc.especie[i]] === 1) { quem = i; break; }
    }
    darOficioTeste(cc, quem, Oficio.Lenhador);
    cc.pericia[quem] = pericia;
    cc.x[quem] = v.x + 0.5;
    cc.y[quem] = v.y + 0.5;
    cc.carga[quem] = BAL.cargaTrabalho;
    cc.cargaMaterial[quem] = 1; // madeira
    cc.estado[quem] = 7; // voltando
    w.avancar();
    return v.estoque.madeira;
  };
  const mestre = entrega(1);
  const aprendiz = entrega(0);
  ok('o mestre rende mais que o aprendiz', mestre > aprendiz * 1.3,
     `${mestre.toFixed(1)} contra ${aprendiz.toFixed(1)}`);

  // O quartel: soldado de vila com quartel treina. Mesma vila, mesmo
  // soldado; só o quartel muda.
  const treino = (comQuartel: boolean): number => {
    const w = desempacotar(empacotar(m));
    montarPipeline(w);
    const v = w.aldeias.find((x) => x.ativa && x.id === a.id)!;
    v.predios[ED.quartel] = comQuartel ? 1 : 0;
    const cc = w.criaturas;
    let quem = -1;
    for (let i = 0; i < cc.limite; i++) {
      if (cc.vivo[i] && cc.aldeia[i] === v.id && ESP_INTELIGENTE[cc.especie[i]] === 1 &&
          cc.idade[i] > cc.longevidade[i] * BAL.fracaoAdulto) { quem = i; break; }
    }
    cc.marcas[quem] |= MARCA_SOLDADO;
    cc.xp[quem] = 0;
    for (let k = 0; k < 10; k++) redistribuir(w);
    return cc.xp[quem];
  };
  const comQ = treino(true);
  const semQ = treino(false);
  ok('o quartel treina o soldado', comQ > 1 && semQ === 0, `xp ${comQ.toFixed(1)} com · ${semQ} sem`);

  // E o ofício sobrevive ao save.
  const volta = desempacotar(empacotar(m));
  let iguais = true;
  for (let i = 0; i < c.limite; i++) {
    if (oficioDe(c, i) !== oficioDe(volta.criaturas, i)) { iguais = false; break; }
    if (Math.abs(c.pericia[i] - volta.criaturas.pericia[i]) > 1e-6) { iguais = false; break; }
  }
  ok('ofício e perícia sobrevivem ao save', iguais);
}

export function testesCaminho(ok: Ok): void {
  // ------------------------------------------------------- 25. busca de caminho
  // Quem só passeia não pede rota (bate na água e sorteia outro passeio); o
  // teste usa quem tem motivo para chegar: o bicho indo comer.
  // Um campo plano com um lago em U. A criatura começa no fundo do U, com o
  // destino do outro lado da parede dele: em linha reta, ela anda até a água e
  // fica deslizando no fundo da enseada. Com a busca, contorna.
  const montar = (): { m: Mundo; quem: number; dx: number; dy: number } => {
    const m = new Mundo(TAMANHOS[0], 'chk-caminho');
    const g = m.grid;
    for (let i = 0; i < g.total; i++) {
      g.alt[i] = NIVEL_MAR + 30;
      g.bioma[i] = B.planicie;
      g.temp[i] = 140;
    }
    const agua = (x: number, y: number): void => {
      const i = g.idx(x, y);
      g.alt[i] = NIVEL_MAR - 20;
      g.bioma[i] = B.lago;
    };
    // U aberto para a esquerda: paredes de cima e de baixo, fundo à direita
    for (let x = 60; x <= 90; x++) {
      for (let e = 0; e < 3; e++) {
        agua(x, 50 + e);
        agua(x, 90 + e);
      }
    }
    for (let y = 50; y <= 92; y++) for (let e = 0; e < 3; e++) agua(90 + e, y);
    const lobo = especies.indice('veado');
    const quem = m.nascer(lobo, 85.5, 71.5, 999999);
    const c = m.criaturas;
    c.estado[quem] = Estado.BuscandoComida;
    return { m, quem, dx: 110, dy: 71 };
  };
  const chegou = (buscas: number): { chegou: boolean; ticks: number } => {
    const antes = BAL.buscasPorTick;
    (BAL as { buscasPorTick: number }).buscasPorTick = buscas;
    const { m, quem, dx, dy } = montar();
    const c = m.criaturas;
    let t = 0;
    for (; t < 1500; t++) {
      c.destinoX[quem] = dx;
      c.destinoY[quem] = dy;
      c.estado[quem] = Estado.BuscandoComida;
      sistemaMovimento.executar(m);
      m.tick++;
      if (Math.hypot(c.x[quem] - dx - 0.5, c.y[quem] - dy - 0.5) < 1.5) break;
    }
    (BAL as { buscasPorTick: number }).buscasPorTick = antes;
    return { chegou: t < 1500, ticks: t };
  };
  const semBusca = chegou(0);
  const comBusca = chegou(BAL.buscasPorTick);
  ok('sem busca de caminho, a criatura fica presa na enseada', !semBusca.chegou);
  ok('com busca, ela contorna o lago e chega', comBusca.chegou, `${comBusca.ticks} ticks`);

  // E o peixe contorna a terra do mesmo jeito.
  {
    const m = new Mundo(TAMANHOS[0], 'chk-caminho-agua');
    const g = m.grid;
    for (let i = 0; i < g.total; i++) {
      g.alt[i] = NIVEL_MAR - 30;
      g.bioma[i] = B.oceano;
    }
    // uma península comprida entre o peixe e o destino
    for (let y = 30; y <= 110; y++) {
      for (let x = 70; x <= 73; x++) {
        const i = g.idx(x, y);
        g.alt[i] = NIVEL_MAR + 20;
        g.bioma[i] = B.planicie;
      }
    }
    const peixe = m.nascer(especies.indice('peixe'), 60.5, 70.5, 999999);
    const c = m.criaturas;
    let t = 0;
    for (; t < 3000; t++) {
      c.destinoX[peixe] = 85;
      c.destinoY[peixe] = 70;
      c.estado[peixe] = Estado.BuscandoComida;
      sistemaMovimento.executar(m);
      m.tick++;
      if (Math.hypot(c.x[peixe] - 85.5, c.y[peixe] - 70.5) < 1.5) break;
    }
    ok('o peixe contorna a península', t < 3000, `${t} ticks`);
  }

  // O teto de buscas por tick vale: cem criaturas presas pedindo rota no
  // mesmo tick não fazem cem buscas.
  {
    const { m, dx, dy } = montar();
    const c = m.criaturas;
    const presos: number[] = [];
    for (let k = 0; k < 100; k++) presos.push(m.nascer(especies.indice('veado'), 89.4, 60 + k * 0.25, 999999));
    for (const q of presos) {
      c.destinoX[q] = dx;
      c.destinoY[q] = dy;
      c.estado[q] = Estado.BuscandoComida;
    }
    const antes = m.rotas.totalBuscas;
    for (let k = 0; k < 8; k++) sistemaMovimento.executar(m);
    const feitas = m.rotas.totalBuscas - antes;
    ok('o teto de buscas por tick segura o custo', feitas <= BAL.buscasPorTick,
       `${feitas} buscas em 8 passadas do mesmo tick`);
  }
}

export function testesAnimacao(ok: Ok): void {
  // ------------------------------------------------------------ 26. animação
  // Cada forma ganha dois quadros de passo, gerados do molde parado. O que o
  // teste garante: que os passos existem (diferem do parado), que o corpo não
  // muda com a passada (só as pernas, a asa, o rabo) e que nada sai da caixa.
  const formas = Object.keys(MOLDES);
  const semPasso: string[] = [];
  const corpoMexeu: string[] = [];
  let foraDaCaixa = 0;
  const contar = (m: readonly string[], y0: number, y1: number): number => {
    let n = 0;
    for (let y = y0; y < y1; y++) for (const ch of m[y] ?? '') if (ch !== '.') n++;
    return n;
  };
  for (const f of formas) {
    const q = quadrosDe(f, MOLDES[f]);
    if (q.length !== QUADROS_POR_DIRECAO) foraDaCaixa++;
    for (const quadro of q) {
      if (quadro.length !== 16 || quadro.some((l) => l.length !== 16)) foraDaCaixa++;
    }
    if (q[1].join('') === q[0].join('') || q[2].join('') === q[0].join('')) semPasso.push(f);
    // nas formas de pernas, a metade de cima (a cabeça e o tronco) é a mesma
    if (['bipede', 'quadrupede', 'grande', 'pinguim'].includes(f)) {
      const topo = 8;
      for (const quadro of q) {
        if (contar(quadro, 0, topo) !== contar(q[0], 0, topo) ||
            quadro.slice(0, topo).join('') !== q[0].slice(0, topo).join('')) {
          corpoMexeu.push(f);
          break;
        }
      }
    }
  }
  ok('toda forma tem dois quadros de passo', semPasso.length === 0, semPasso.join(', '));
  ok('a passada mexe as pernas, não a cabeça', corpoMexeu.length === 0, corpoMexeu.join(', '));
  ok('os quadros cabem no molde de 16 pixels', foraDaCaixa === 0);
}

function darOficioTeste(c: Mundo['criaturas'], i: number, o: number): void {
  c.marcas[i] = (c.marcas[i] & ~(7 << 4)) | (o << 4);
}

// Rodando sozinho: `npx tsx tools/testes2.ts`
if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/testes2.ts')) {
  let falhas = 0;
  const ok: Ok = (nome, cond, extra = '') => {
    console.log(`${cond ? 'ok   ' : 'FALHA'} ${nome}${extra ? ' — ' + extra : ''}`);
    if (!cond) falhas++;
  };
  const so = process.argv[2];
  if (!so || so === 'v1') testes2(ok);
  if (!so || so === 'oficios') testesProfissoes(ok);
  if (!so || so === 'caminho') testesCaminho(ok);
  if (!so || so === 'animacao') testesAnimacao(ok);
  console.log(falhas === 0 ? '\nTUDO OK' : `\n${falhas} FALHAS`);
  process.exit(falhas === 0 ? 0 : 1);
}
