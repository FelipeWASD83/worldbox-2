import type { Sistema } from '../core/sistemas.js';
import { limiteDeTerritorio, type Aldeia, type Mundo, RANCOR_POR_TERRITORIO } from '../core/mundo.js';
import { Estado, MARCA_SOLDADO } from '../core/criaturas.js';
import {
  ED, ED_MATERIAL_MINIMO, ED_MAXIMO, ED_MORADIA, ED_RESISTENCIA, ED_TECNOLOGIA,
  MAT_FATOR, MATERIAIS_DE_OBRA, edificios, materialDoAcabamento,
} from '../dados/edificios.js';
import { materialDoReino } from './conhecimento.js';
import { Campo } from '../dados/tracos.js';
import { fator, podemCruzar } from './genetica.js';
import { tecnologias } from '../dados/tecnologias.js';
import { BIOMA_HABITAVEL, biomas } from '../dados/biomas.js';
import {
  acharLote, alcanceDaAldeia, ancoraDaConstrucao, derrubar, erguer, ligarAoCentro,
  pavimentar, semearEmVolta,
} from './urbanismo.js';
import { ESP_CIVILIZADO, ESP_NATALIDADE, TICKS_ANO, especies } from '../dados/especies.js';
import { nomeDeAldeia } from '../dados/nomes.js';
import { materialPorIndice } from './coleta.js';
import { focoDe } from './comandos.js';
import { empossarChefes } from './politica.js';
import { BAL } from './balanco.js';

/** A cada quantos ticks a gestão das aldeias é reavaliada. */
const INTERVALO_GESTAO = 10;

/**
 * Moradores chegando em casa: entregam o que colheram e comem do estoque.
 *
 * Roda todo tick porque é um laço simples sobre criaturas e precisa ser
 * responsivo — trabalhador parado na porta do celeiro fica esquisito.
 */
export const sistemaMoradores: Sistema = {
  id: 'moradores',
  executar(mundo: Mundo): void {
    const c = mundo.criaturas;
    const limite = c.limite;

    for (let i = 0; i < limite; i++) {
      if (!c.vivo[i]) continue;
      if (ESP_CIVILIZADO[c.especie[i]] === 0) continue;
      if (c.estado[i] !== Estado.Voltando) continue;

      const idAldeia = c.aldeia[i];
      const a = idAldeia >= 0 ? mundo.aldeias[idAldeia] : undefined;
      if (!a?.ativa) {
        c.estado[i] = Estado.Vagando;
        c.aldeia[i] = -1;
        continue;
      }

      const dx = a.x + 0.5 - c.x[i];
      const dy = a.y + 0.5 - c.y[i];
      // O celeiro atende quem **chegou à vila**, não quem pisou no tile exato
      // da praça. Com dois tiles de tolerância e vilas espalhadas, o trabalhador
      // faminto passava ao lado do próprio armazém e morria de fome com a
      // aldeia cheia de comida — foram setecentas mortes assim em vinte e cinco
      // mil ticks.
      if (dx * dx + dy * dy > BAL.alcanceDoCeleiro * BAL.alcanceDoCeleiro) continue;

      if (c.carga[i] > 0) {
        const m = materialPorIndice(c.cargaMaterial[i]);
        // serraria e mina fazem render mais o mesmo esforço — é o que faz
        // valer a pena erguer prédio de produção em vez de só casas
        // Duas coisas multiplicam o esforço: o prédio de produção e o terreno
        // em volta, medido quando a aldeia foi fundada. Fundar na floresta
        // rende mais madeira que fundar na pedra — e é isso que faz a escolha
        // do lugar importar.
        let rendimento = c.carga[i];
        if (m === 'madeira') {
          rendimento *= (1 + bonusDe(a, ED.serraria, 'bonusMadeira')) * a.bonusMadeira;
        } else if (m !== 'comida') {
          rendimento *= (1 + bonusDe(a, ED.mina, 'bonusMinerio')) * a.bonusPedra;
        }
        // o que não cabe no celeiro se perde: é o que dá sentido a construir
        // mais armazém em vez de acumular para sempre
        a.estoque[m] = Math.min(a.capacidadeEstoque, a.estoque[m] + rendimento);
        // Trabalho entregue vira dinheiro no bolso de quem entregou. É daqui
        // que sai a fortuna que decide **quem governa a vila** — sem uma fonte
        // de riqueza individual, "o cidadão mais rico" seria sempre um empate
        // em zero (ver `src/sim/politica.ts`).
        // Ganancioso embolsa mais da mesma carga; generoso, menos. É o que faz
        // um traço decidir quem vira governante da vila, já que o cargo é do
        // mais rico.
        c.riqueza[i] += rendimento * BAL.salarioPorCarga * fator(c.tracos[i], Campo.ouro);
        c.carga[i] = 0;
        a.moral = Math.min(100, a.moral + 0.4);
      }
      if (c.fome[i] > 20 && a.estoque.comida > 2) {
        const come = Math.min(a.estoque.comida, c.fome[i]);
        a.estoque.comida -= come;
        c.fome[i] -= come;
      }
      c.estado[i] = Estado.Vagando;
      c.destinoX[i] = -1;
    }
  },
};

/**
 * A vida da aldeia: consumo, coleta de recursos, obras, território, crescimento
 * e fundação de colônias.
 *
 * É o sistema pensado para inchar. Conhecimento, profissões, impostos e
 * comércio entram como novas etapas desta mesma função — ou como sistemas
 * próprios lendo os mesmos campos.
 */
export const sistemaAldeias: Sistema = {
  id: 'aldeias',
  intervalo: INTERVALO_GESTAO,
  executar(mundo: Mundo): void {
    for (const a of mundo.aldeias) {
      if (!a.ativa) continue;
      gerirAldeia(mundo, a);
    }
    atualizarReinos(mundo);
  },
};

function gerirAldeia(mundo: Mundo, a: Aldeia): void {
  const passo = INTERVALO_GESTAO;

  if (a.esperaObra > 0) a.esperaObra -= passo;

  // ------------------------------------------------------------- 1. consumo
  a.estoque.comida -= a.populacao * BAL.consumoAldeia * passo;
  if (a.estoque.comida < 0) {
    a.estoque.comida = 0;
    a.moral -= 0.8;
    // fome coletiva: os moradores começam a passar mal
    const c = mundo.criaturas;
    for (let i = 0; i < c.limite; i++) {
      if (c.vivo[i] && c.aldeia[i] === a.id) c.fome[i] += 0.5 * passo;
    }
  } else {
    const fe = Math.min(a.predios[ED.templo], ED_MAXIMO[ED.templo]) *
      (edificios.porIndice(ED.templo).moral ?? 0);
    a.moral = Math.min(100, a.moral + 0.15 + fe * 0.1);
  }

  // Madeira, pedra e minério não caem do céu: são trazidos por trabalhadores
  // (ver `src/sim/coleta.ts`). O que a aldeia produz sozinha é só o que sai da
  // terra ao redor — a lavoura das fazendas.
  a.estoque.comida = Math.min(
    a.capacidadeEstoque,
    a.estoque.comida + contarFazendas(mundo, a) * BAL.rendaPorFazenda * passo,
  );

  // ------------------------------------------------------- 3. território
  expandirTerritorio(mundo, a);

  // ------------------------------------------------------------ 4. obras
  if (a.esperaObra <= 0) {
    if (construirAlgo(mundo, a)) {
      // quem foca em construir levanta obra com mais frequência
      a.esperaObra = focoDe(a) === 'obras' ? BAL.esperaObra * 0.5 : BAL.esperaObra;
      mundo.recalcularCapacidade(a);
    }
  }

  // ------------------------------------------------- 5. crescimento e nível
  // Gente chega por dois caminhos, e isso é de propósito: a maior parte nasce
  // dentro das casas (`src/sim/moradia.ts`), e um fio de gente de fora se junta
  // à aldeia próspera. Depender só das casas travava tudo — sem casa não nasce
  // ninguém, e sem gente ninguém levanta casa.
  if (
    a.estoque.comida > BAL.comidaPorNascimento &&
    a.populacao < a.capacidade &&
    // O teto do mundo vale para todos: sem esta folga, as civilizações enchiam
    // o pool sozinhas e não sobrava lugar para nascer bicho nenhum.
    mundo.criaturas.quantidade < mundo.criaturas.capacidade * 0.92 &&
    // A chegada de fora mingua conforme a vila levanta casa, e isso é
    // estrutural, não um número calibrado: a imigração existe como rede para a
    // vila que ainda não tem onde alguém nascer. Enquanto foi uma chance fixa,
    // toda mudança que deixava o mundo mais próspero — mais terreno bom, mais
    // comida — inflava os dois caminhos junto, e a casa perdia a dianteira de
    // novo. Aqui ela perde força sozinha, sem depender de eu reajustar nada.
    mundo.rng.chance(
      (BAL.imigracaoParaAldeia * ESP_NATALIDADE[a.especie]) / (1 + a.casas * 1.4),
    )
  ) {
    // Quem chega nem sempre é do povo da casa. É por esta porta que dois povos
    // passam a morar na mesma vila — e, sem ela, mestiço nenhum jamais nasceria
    // no mundo: vila é fundada com um povo só, colônia herda o povo da mãe e a
    // imigração de fora do mapa trazia sempre mais do mesmo. Ver
    // `src/sim/genetica.ts`.
    const povo = povoQueChega(mundo, a);
    const filho = mundo.nascer(
      povo,
      a.x + mundo.rng.entre(-1.5, 1.5),
      a.y + mundo.rng.entre(-1.5, 1.5),
      TICKS_ANO * 2,
      'imigracao',
    );
    if (filho >= 0) {
      const c = mundo.criaturas;
      c.aldeia[filho] = a.id;
      c.reino[filho] = a.reino;
      // Quem chega de fora **traz um sobrenome**. Sem isto, metade da população
      // ficava sem linhagem nenhuma — e gente sem família não entra na conta da
      // sucessão, não herda e não pode ver a própria casa chegar ao trono.
      // Uma parte se junta a uma família que já mora aqui (é o casamento de
      // quem chega); o resto funda a sua.
      const anfitria = familiaDaCasa(mundo, a);
      c.familia[filho] = anfitria >= 0 && mundo.rng.chance(0.6)
        ? anfitria
        : mundo.novaFamilia();
      // Quem chega de fora traz também **um clã**. Uma parte se dissolve no clã
      // de quem já manda ali; o resto forma o seu, e é essa minoria que um dia
      // vai achar que não é mais representada. Ver `src/sim/cultura.ts`.
      if (mundo.rng.chance(BAL.chanceDeClaNovo) || a.governante < 0) {
        c.cla[filho] = mundo.criarCla(a.especie).id;
      } else if (c.vivo[a.governante] === 1) {
        c.cla[filho] = c.cla[a.governante];
      }
      a.populacao++;
      a.estoque.comida -= BAL.comidaPorNascimento;
    }
  }

  const proximo = a.nivel + 1;
  if (
    proximo < BAL.comidaParaSubirNivel.length &&
    a.populacao >= BAL.populacaoParaSubirNivel[proximo] &&
    a.estoque.comida >= BAL.comidaParaSubirNivel[proximo]
  ) {
    a.nivel = proximo;
    a.raio = BAL.raioPorNivel[Math.min(proximo, BAL.raioPorNivel.length - 1)];
    a.moral = Math.min(100, a.moral + 10);
    mundo.eventos.emitir('aldeia:cresceu', { aldeia: a.id, nivel: a.nivel });
  }

  // ------------------------------------------------------- 6. colonização
  // Vila cheia é o gatilho principal: sem espaço para crescer onde está, o
  // caminho do reino é fundar outra. Uma vila com folga só coloniza de vez em
  // quando, por iniciativa própria.
  const semEspaco = a.tilesTerritorio >= a.limiteTerritorio * 0.82;
  const podePagar = a.estoque.comida > 120 && a.estoque.madeira > 40;
  if (a.populacao >= BAL.populacaoParaColonizar && podePagar) {
    if (mundo.rng.chance(semEspaco ? BAL.chanceColonizarLotada : BAL.chanceColonizar)) {
      colonizarAPartirDe(mundo, a);
    }
  }

  // -------------------------------------------------- 7. aldeia abandonada
  if (a.populacao <= 0 && mundo.tick - a.fundadaEm > 400) {
    mundo.destruirAldeia(a.id);
  }
}

/**
 * Marca os tiles em volta como território da aldeia e do reino.
 *
 * Para no limite do nível: uma vila não cresce para sempre. Quando ela enche o
 * que lhe cabe, o reino só tem um caminho para se espalhar — mandar colonos
 * fundar outra vila.
 */
function expandirTerritorio(mundo: Mundo, a: Aldeia): void {
  const g = mundo.grid;
  a.limiteTerritorio = limiteDeTerritorio(a.nivel);
  if (a.tilesTerritorio >= a.limiteTerritorio) return;

  if (a.franja.length === 0) refazerFranja(mundo, a);
  if (a.franja.length === 0) return; // cercada por todos os lados

  const viz = mundo.bufVizinhos;
  let ganhos = 0;
  let tentativas = 0;
  // Quantos tiles foram arrancados de cada reino nesta passada. A mágoa é
  // lançada uma vez no fim, e não tile a tile: uma passada toma dezenas de
  // tiles, e cobrar cada um separado encheria o rancor no primeiro avanço.
  const arrancados = new Map<number, number>();
  const cabe = a.limiteTerritorio - a.tilesTerritorio;
  const teto = Math.min(BAL.tilesPorExpansao, cabe);

  // Cada passada come um punhado da fila da fronteira. O teto de tentativas
  // existe porque a fila junta muito tile inútil — água, rocha, chão de vizinho
  // mais forte — e sem ele uma vila cercada de mar varreria a fila inteira toda
  // vez sem tomar nada.
  while (ganhos < teto && tentativas < teto * 6 && a.franja.length > 0) {
    tentativas++;
    // Tira de posição sorteada, e não do fim: tirando sempre da mesma ponta a
    // vila crescia em faixa reta, porque a fila é preenchida em ordem de
    // vizinhança.
    const k = mundo.rng.int(a.franja.length);
    const i = a.franja[k];
    a.franja[k] = a.franja[a.franja.length - 1];
    a.franja.pop();

    if (!podeTomar(mundo, a, i)) continue;

    const x = i % g.largura;
    const y = (i / g.largura) | 0;
    const dono = g.aldeiaDona[i];
    if (dono >= 0) {
      const outra = mundo.aldeias[dono];
      if (outra?.ativa) {
        outra.tilesTerritorio = Math.max(0, outra.tilesTerritorio - 1);
        if (outra.reino !== a.reino) {
          arrancados.set(outra.reino, (arrancados.get(outra.reino) ?? 0) + 1);
        }
      }
    }
    g.aldeiaDona[i] = a.id;
    g.territorio[i] = a.reino;
    g.marcarSujo(x, y);
    ganhos++;

    // a fronteira avança: os vizinhos deste tile viram candidatos
    const n = g.vizinhos4(x, y, viz);
    for (let v = 0; v < n; v++) {
      const j = viz[v];
      if (g.aldeiaDona[j] === a.id) continue;
      if (a.franja.length < BAL.franjaMaxima) a.franja.push(j);
    }
  }
  a.tilesTerritorio += ganhos;

  // Tomar chão do vizinho é ofensa de Estado, e fica registrada. É um dos
  // motivos que a diplomacia soma na hora de decidir a guerra seguinte.
  for (const [reino, quantos] of arrancados) {
    mundo.acumularRancor(reino, a.reino, quantos * RANCOR_POR_TERRITORIO);
  }
}

/** A vila pode tomar este tile? */
function podeTomar(mundo: Mundo, a: Aldeia, i: number): boolean {
  const g = mundo.grid;
  if (i < 0 || i >= g.total) return false;
  if (g.ehAgua(i)) return false;
  const dono = g.aldeiaDona[i];
  if (dono === a.id) return false;
  if (dono < 0) return true;

  // Chão de outra vila só muda de mãos para quem é mais forte. Sem isso duas
  // vizinhas trocariam a mesma faixa de terra para sempre, e a fronteira
  // ficaria tremendo entre as duas sem nunca assentar.
  const outra = mundo.aldeias[dono];
  if (!outra?.ativa) return true;
  if (outra.nivel > a.nivel) return false;
  if (outra.nivel === a.nivel && outra.populacao >= a.populacao) return false;
  return true;
}

/**
 * Reconstrói a fila de fronteira a partir do que a vila domina hoje.
 *
 * Chamada quando a fila esvazia — no começo da vida da aldeia, depois de
 * carregar um save, ou quando a vila esteve cercada e um vizinho abriu espaço.
 * Varre o entorno uma vez; é caro e por isso não roda toda passada.
 */
function refazerFranja(mundo: Mundo, a: Aldeia): void {
  const g = mundo.grid;
  const viz = mundo.bufVizinhos;
  a.franja.length = 0;

  // vila recém-fundada ainda não tem nada: a fronteira é o próprio centro
  if (a.tilesTerritorio === 0) {
    a.franja.push(g.idx(a.x, a.y));
    return;
  }

  // O alcance da busca acompanha o tamanho do que ela domina, e não o raio de
  // construção: com território em forma livre, os dois deixaram de coincidir.
  const alcance = Math.ceil(Math.sqrt(a.tilesTerritorio)) + 6;
  const x0 = Math.max(0, a.x - alcance);
  const x1 = Math.min(g.largura - 1, a.x + alcance);
  const y0 = Math.max(0, a.y - alcance);
  const y1 = Math.min(g.altura - 1, a.y + alcance);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = g.idx(x, y);
      if (g.aldeiaDona[i] !== a.id) continue;
      const n = g.vizinhos4(x, y, viz);
      for (let v = 0; v < n; v++) {
        const j = viz[v];
        if (g.aldeiaDona[j] === a.id) continue;
        if (a.franja.length < BAL.franjaMaxima) a.franja.push(j);
      }
    }
  }
}

/**
 * Uma família que já mora na vila, sorteada entre os moradores.
 *
 * Serve para quem chega de fora se casar em vez de fundar sempre uma linhagem
 * nova — sem isso o mundo enche de famílias de um membro só, e a sucessão por
 * "família mais rica" perde o sentido, porque nenhuma família acumula nada.
 */
function familiaDaCasa(mundo: Mundo, a: Aldeia): number {
  const c = mundo.criaturas;
  let vistas = 0;
  let escolhida = -1;
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i] || c.aldeia[i] !== a.id || c.familia[i] < 0) continue;
    vistas++;
    // amostragem por reservatório: uma passada, sem montar lista
    if (mundo.rng.int(vistas) === 0) escolhida = c.familia[i];
  }
  return escolhida;
}

/** Escolhe o que a aldeia precisa e ergue, se houver material e espaço. */
function construirAlgo(mundo: Mundo, a: Aldeia): boolean {
  const reino = mundo.reinos[a.reino];
  const emGuerra = reino?.ativo && reino.guerras.size > 0;

  // A ordem é a das necessidades de uma comunidade: teto, comida, armazém,
  // produção, defesa e, por último, o que é luxo e prestígio.
  const foco = focoDe(a);
  const emPaz = !emGuerra;

  /**
   * A fila de vontades da aldeia, da mais urgente para a mais dispensável.
   *
   * É uma lista e não uma escada de `else if` porque a escada empurrava os
   * prédios de cidade para tão longe que eles nunca eram construídos: casa e
   * fazenda ganhavam sempre, e prefeitura, banco e taverna não saíam do papel.
   * Aqui cada item é uma condição e um tipo, e a primeira que valer leva.
   */
  // Lavoura quer um moinho no meio dela. Enquanto a vila não tem nenhum, ela
  // planta um punhado de roças soltas para não passar fome; a partir daí, o
  // moinho vira urgência e todo campo novo nasce em volta de um.
  const lavouraSolta = a.moinhosIdx.length === 0;
  const roçasDemais = lavouraSolta && a.predios[ED.fazenda] >= BAL.rocasSemMoinho;

  // De que este povo constrói hoje: o melhor material que a árvore de
  // tecnologia do reino alcança. Ver `src/sim/conhecimento.ts`.
  const material = materialDoReino(reino);

  const fila: Array<[boolean, number]> = [
    // sobrevivência
    [roçasDemais && a.nivel >= 2, ED.moinho],
    [a.estoque.comida < a.populacao * 8 && !roçasDemais, ED.fazenda],
    // A fogueira é a moradia de quem ainda não descobriu o abrigo. Vem antes da
    // casa porque, enquanto a casa estiver trancada, é ela ou nada: sem
    // moradia nenhuma um povo tribal não tem filho e o mundo trava na largada.
    [
      !mundo.reinoSabe(a.reino, TEC_ABRIGO)
        && a.predios[ED.fogueira] * ED_MORADIA[ED.fogueira] < a.populacao + 2,
      ED.fogueira,
    ],
    // Casa não é só teto: é onde nascem os filhos. A aldeia constrói assim que
    // falta cama, e não só quando está lotada — senão nunca sai do lugar, já
    // que sem casa não nasce gente e sem gente não se levanta casa.
    [a.casas * ED_MORADIA[ED.casa] < a.populacao + 4, ED.casa],
    [a.populacao >= a.capacidade - 2, ED.casa],

    // O porto vem cedo, e não junto dos marcos da cidade. Ele é a obra mais
    // cara que uma vila pequena tenta, e no meio da fila perdia a madeira toda
    // vez para uma casa de dez: medindo quarenta vilas costeiras, **nenhuma**
    // chegava a ter lote, nível e material ao mesmo tempo, e o mundo terminava
    // com um porto só. No topo, ele só concorre quando já dá para pagá-lo — que
    // é a regra da fila inteira — e a vila de beira-mar realmente vira uma vila
    // de beira-mar.
    [a.nivel >= 2 && a.predios[ED.porto] === 0, ED.porto],
    [a.estoque.comida > a.capacidadeEstoque * 0.75 && cabeMais(a, ED.celeiro, 4), ED.celeiro],

    // guerra na porta muda tudo de lugar
    [emGuerra && a.nivel >= 2 && a.predios[ED.ferraria] === 0, ED.ferraria],
    [emGuerra && a.nivel >= 2 && mundo.rng.chance(0.55), mundo.rng.chance(0.5) ? ED.muralha : ED.torre],

    // o que a vontade do jogador manda vir primeiro
    [foco === 'exercito' && a.nivel >= 2 && a.predios[ED.quartel] === 0, ED.quartel],
    [foco === 'comida' && a.nivel >= 2 && lavouraSolta, ED.moinho],
    [
      foco === 'comida' && a.estoque.comida < a.capacidadeEstoque * 0.8 && !roçasDemais,
      ED.fazenda,
    ],

    // O **primeiro** mercado sobe na fila, e só ele. É o prédio que liga a vila
    // ao resto do mundo: sem mercado não sai caravana, e sem caravana o ouro do
    // reino não circula. Lá embaixo, entre os marcos, ele tinha peso 0,72^20 e
    // simplesmente não era construído — três de quatro sementes terminavam
    // vinte mil ticks com zero negócios fechados, não porque o comércio
    // estivesse quebrado, mas porque não havia onde comerciar. O segundo
    // mercado continua no lugar antigo, com os outros marcos.
    [a.nivel >= 3 && a.predios[ED.mercado] === 0, ED.mercado],

    // conforto e produção
    [a.nivel >= 2 && cabeMais(a, ED.poco, ED_MAXIMO[ED.poco]), ED.poco],
    [a.nivel >= 2 && cabeMais(a, ED.moinho, ED_MAXIMO[ED.moinho]), ED.moinho],
    [a.nivel >= 2 && cabeMais(a, ED.taverna, ED_MAXIMO[ED.taverna]), ED.taverna],
    [a.nivel >= 2 && cabeMais(a, ED.serraria, ED_MAXIMO[ED.serraria]), ED.serraria],
    [a.nivel >= 2 && cabeMais(a, ED.mina, ED_MAXIMO[ED.mina]), ED.mina],
    [a.nivel >= 2 && cabeMais(a, ED.ferraria, ED_MAXIMO[ED.ferraria]), ED.ferraria],

    // os marcos da cidade
    [a.nivel >= 2 && a.predios[ED.prefeitura] === 0, ED.prefeitura],
    [a.nivel >= 3 && cabeMais(a, ED.mercado, ED_MAXIMO[ED.mercado]), ED.mercado],
    [a.nivel >= 3 && cabeMais(a, ED.quartel, ED_MAXIMO[ED.quartel]), ED.quartel],
    [a.nivel >= 3 && a.predios[ED.biblioteca] === 0, ED.biblioteca],
    [a.nivel >= 3 && a.predios[ED.castelo] === 0 && emPaz, ED.castelo],
    [a.nivel >= 3 && cabeMais(a, ED.templo, ED_MAXIMO[ED.templo]), ED.templo],
    [a.nivel >= 4 && a.predios[ED.banco] === 0, ED.banco],

    // nada urgente: mais casa, mais lavoura
    [a.populacao > a.casas * 3, ED.casa],
    [!roçasDemais, ED.fazenda],
    [true, ED.casa],
  ];

  // A escolha é um sorteio com peso, não uma cascata.
  //
  // Antes isto era um `for` que parava na primeira vontade paga com 76% de
  // chance. Parece razoável e não é: a quinta linha da fila só era alcançada
  // uma vez em quatrocentas, e a vigésima nunca. O resultado media-se no mapa
  // — nenhuma prefeitura, nenhum mercado e, sem mercado, nenhum negócio
  // fechado em vinte mil ticks. A ordem da fila tem de pesar na escolha sem
  // matar o fim dela.
  //
  // Pagar faz parte de ser candidato, e não é conferido depois: escolher uma
  // obra cara sem ter o material fazia a aldeia passar o ciclo inteiro sem
  // construir nada, em vez de erguer o que estava ao alcance.
  const candidatos: number[] = [];
  const pesos: number[] = [];
  let soma = 0;
  let peso = 1;
  for (const [vale, tipo] of fila) {
    if (!vale) continue;
    const opcao = edificios.porIndice(tipo);
    if (opcao.nivelMinimo > a.nivel) continue;
    // O reino sabe erguer isto? É a tranca nova da fase 4, e é ela que faz uma
    // tribo começar o mundo sem casa, sem lavoura e sem forja.
    if (!mundo.reinoSabe(a.reino, ED_TECNOLOGIA[tipo])) continue;
    // E sabe trabalhar o material que isto exige? Castelo não se levanta de
    // palha por mais rico que o reino esteja.
    if (material < ED_MATERIAL_MINIMO[tipo]) continue;
    if (a.estoque.madeira < custoEmMadeira(tipo, material)) continue;
    if (a.estoque.pedra < custoEmPedra(tipo, material)) continue;
    candidatos.push(tipo);
    pesos.push(peso);
    soma += peso;
    peso *= BAL.decaimentoDaFila;
  }
  if (candidatos.length === 0) return false;

  let escolha = candidatos[candidatos.length - 1];
  let sorteio = mundo.rng.f() * soma;
  for (let k = 0; k < candidatos.length; k++) {
    sorteio -= pesos[k];
    if (sorteio <= 0) {
      escolha = candidatos[k];
      break;
    }
  }

  const def = edificios.porIndice(escolha);

  const tile = acharLote(mundo, a, escolha);
  if (tile < 0) return false;

  // O prédio sai do melhor material que o reino domina, respeitado o piso do
  // próprio prédio — nunca abaixo dele, e nunca acima do que se sabe fazer.
  const materialDaObra = Math.max(material, ED_MATERIAL_MINIMO[escolha]);
  erguer(mundo, a, tile, escolha, materialDaObra);
  // toda obra nasce ligada à praça: é o que transforma um punhado de telhados
  // espalhados num povoado com ruas
  ligarAoCentro(mundo, a, tile % mundo.grid.largura, (tile / mundo.grid.largura) | 0);
  const semeia = edificios.porIndice(escolha).semeiaEmVolta;
  if (semeia) semearEmVolta(mundo, a, tile, semeia);

  a.estoque.madeira -= custoEmMadeira(escolha, materialDaObra);
  a.estoque.pedra -= custoEmPedra(escolha, materialDaObra);
  void def;
  return true;
}

/**
 * Quanto custa erguer aquele prédio naquele material.
 *
 * Material melhor custa mais pedra e, em compensação, menos madeira: uma parede
 * de alvenaria gasta cantaria onde a de tábua gastaria viga. A conta fica aqui,
 * numa função só, porque ela é consultada duas vezes — para saber se dá para
 * pagar e para pagar — e as duas leituras não podem discordar.
 */
export function custoEmMadeira(tipo: number, material: number): number {
  return edificios.porIndice(tipo).custoMadeira * MATERIAIS_DE_OBRA[material].custoMadeira;
}

export function custoEmPedra(tipo: number, material: number): number {
  return edificios.porIndice(tipo).custoPedra * MATERIAIS_DE_OBRA[material].custoPedra;
}

/**
 * Soma o bônus de um tipo de prédio, respeitando o máximo aproveitável.
 * Cem serrarias não fazem cem vezes mais madeira.
 */
export function bonusDe(
  a: Aldeia,
  tipo: number,
  campo: 'bonusMadeira' | 'bonusMinerio' | 'bonusComida',
): number {
  const quantos = Math.min(a.predios[tipo], ED_MAXIMO[tipo]);
  if (quantos <= 0) return 0;
  return (edificios.porIndice(tipo)[campo] ?? 0) * quantos;
}

/** Melhor nível de forja que a aldeia alcança. Sem ferraria, só o básico. */
export function nivelDeForja(a: Aldeia): number {
  return a.predios[ED.ferraria] > 0 ? (edificios.porIndice(ED.ferraria).forja ?? 1) : 1;
}

/** A aldeia tem mercado funcionando? */
export function temMercado(a: Aldeia): boolean {
  return a.predios[ED.mercado] > 0;
}

/** Índice da tecnologia do abrigo, resolvido uma vez. */
const TEC_ABRIGO = tecnologias.indice('abrigo');

/**
 * De que povo é o próximo a chegar naquela vila.
 *
 * Quase sempre o povo da própria vila. De vez em quando é alguém de um povo
 * vizinho — e as condições são as mesmas que a diplomacia já usa: tem de ser um
 * reino que o daqui **conhece**, com quem não está em guerra, e de um povo que
 * o daqui tolera o bastante para casar (`podemCruzar`).
 *
 * É de propósito que isso dependa da política: um mundo em que humanos e elfos
 * nunca se encontraram não produz meio-elfo, e um mundo em que eles comerciam
 * há séculos produz. A mestiçagem passa a ser uma consequência da história em
 * vez de um dado sorteado no vácuo.
 */
function povoQueChega(mundo: Mundo, a: Aldeia): number {
  if (!mundo.rng.chance(BAL.imigracaoDeOutroPovo)) return a.especie;
  const candidatos: number[] = [];
  for (const r of mundo.reinos) {
    if (!r.ativo || r.especie === a.especie) continue;
    if (!mundo.conhece(a.reino, r.id) || mundo.emGuerra(a.reino, r.id)) continue;
    if (!podemCruzar(a.especie, r.especie)) continue;
    candidatos.push(r.especie);
  }
  if (candidatos.length === 0) return a.especie;
  return candidatos[mundo.rng.int(candidatos.length)];
}

/** Quantas fazendas a aldeia tem trabalhando. */
function contarFazendas(mundo: Mundo, a: Aldeia): number {
  const g = mundo.grid;
  let n = 0;
  // o mesmo alcance que a aldeia usa para escolher lote — ver `urbanismo.ts`
  const r = alcanceDaAldeia(a);
  for (let y = a.y - r; y <= a.y + r; y++) {
    if (y < 0 || y >= g.altura) continue;
    for (let x = a.x - r; x <= a.x + r; x++) {
      if (x < 0 || x >= g.largura) continue;
      const i = g.idx(x, y);
      if (g.aldeiaDona[i] === a.id && g.construcao[i] === ED.fazenda + 1) n++;
    }
  }
  return n;
}

/** Ainda cabe mais um prédio deste tipo? */
function cabeMais(a: Aldeia, tipo: number, maximo: number): boolean {
  return a.predios[tipo] < maximo;
}

/**
 * Manda um grupo fundar uma aldeia nova a alguma distância.
 * Exportado porque o jogador também pode ordenar isso (ver `comandos.ts`).
 */
export function colonizarAPartirDe(mundo: Mundo, mae: Aldeia): void {
  const g = mundo.grid;
  const def = especies.porIndice(mae.especie);
  const preferidos = new Set(def.povo?.prefereBiomas ?? def.biomas);

  let melhor = -1;
  let melhorNota = 0.5;
  for (let t = 0; t < 260; t++) {
    const ang = mundo.rng.f() * Math.PI * 2;
    const d = mundo.rng.entre(BAL.distanciaEntreAldeias, BAL.distanciaEntreAldeias * 2.4);
    const x = Math.round(mae.x + Math.cos(ang) * d);
    const y = Math.round(mae.y + Math.sin(ang) * d);
    if (x < 2 || y < 2 || x >= g.largura - 2 || y >= g.altura - 2) continue;
    const i = g.idx(x, y);
    if (!g.ehTerra(i) || g.ehMontanha(i)) continue;
    if (BIOMA_HABITAVEL[g.bioma[i]] <= 0.1) continue;
    if (mundo.aldeiaMaisProxima(x, y, BAL.distanciaEntreAldeias) >= 0) continue;
    // Chão de ninguém, e não só longe de aldeia: colônia fundada dentro do
    // território de outra vila nasce sem ter o que dominar, e agora que a obra
    // exige território próprio ela nem chega a construir a primeira casa.
    if (g.aldeiaDona[i] !== -1) continue;

    let nota = BIOMA_HABITAVEL[g.bioma[i]];
    const nomeB = nomeDoBioma(g.bioma[i]);
    if (preferidos.has(nomeB)) nota += 1.2;
    nota += mundo.rng.f() * 0.4;
    if (nota > melhorNota) {
      melhorNota = nota;
      melhor = i;
    }
  }
  if (melhor < 0) return;

  const x = melhor % g.largura;
  const y = (melhor / g.largura) | 0;
  const nova = mundo.criarAldeia(mae.reino, mae.especie, x, y, nomeDeAldeia(mundo.rng, def.id));
  pavimentar(mundo, x, y);
  nova.estoque.comida = 30;
  nova.estoque.madeira = 20;
  mae.estoque.comida -= 60;
  mae.estoque.madeira -= 30;

  // colonos saem da aldeia-mãe
  const c = mundo.criaturas;
  let enviados = 0;
  const quota = Math.max(2, Math.floor(mae.populacao * 0.25));
  // Quem sai costuma ser quem já não se via na terra de origem. Uma parte das
  // colônias nasce, por isso, com clã próprio — e é a semente de uma província
  // que um dia se separa.
  const claDaColonia = mundo.rng.chance(BAL.chanceDeClaNovo)
    ? mundo.criarCla(mae.especie).id
    : -1;
  for (let i = 0; i < c.limite && enviados < quota; i++) {
    if (!c.vivo[i] || c.aldeia[i] !== mae.id) continue;
    c.aldeia[i] = nova.id;
    if (claDaColonia >= 0) c.cla[i] = claDaColonia;
    c.destinoX[i] = x;
    c.destinoY[i] = y;
    c.estado[i] = Estado.Voltando;
    mae.populacao--;
    nova.populacao++;
    enviados++;
  }
  empossarChefes(mundo, nova);
}

/** Id de texto de cada bioma, por índice — montado uma vez. */
const biomaNomes = biomas.todos().map((b) => b.id);

function nomeDoBioma(indice: number): string {
  return biomaNomes[indice] ?? '';
}

/** Recalcula população e era dos reinos, e distribui soldados. */
function atualizarReinos(mundo: Mundo): void {
  const c = mundo.criaturas;

  for (const r of mundo.reinos) {
    if (!r.ativo) continue;
    r.populacao = 0;
    for (const idA of r.aldeias) {
      const a = mundo.aldeias[idA];
      if (a?.ativa) r.populacao += a.populacao;
    }
    if (r.aldeias.length === 0) {
      mundo.extinguirReino(r.id);
      continue;
    }

    // Território conta junto com a população: um reino de muitas vilas
    // pequenas é tão império quanto um de poucas vilas grandes, e expandir
    // passa a valer a pena por si.
    r.territorio = 0;
    for (const idA of r.aldeias) {
      const a = mundo.aldeias[idA];
      if (a?.ativa) r.territorio += a.tilesTerritorio;
    }
    // A era não é mais calculada aqui. Ela era um número tirado de população e
    // território que não decidia nada; hoje é a era da tecnologia mais avançada
    // que o reino domina, e quem a move é `src/sim/conhecimento.ts`.
  }

  // soldados: só existem enquanto há guerra
  const emGuerra = new Set<number>();
  for (const r of mundo.reinos) {
    if (r.ativo && r.guerras.size > 0) emGuerra.add(r.id);
  }
  for (let i = 0; i < c.limite; i++) {
    if (!c.vivo[i]) continue;
    if (ESP_CIVILIZADO[c.especie[i]] === 0) continue;
    const reino = c.reino[i];
    if (reino >= 0 && emGuerra.has(reino)) {
      // fatia estável: sempre os mesmos índices viram soldado
      const a = c.aldeia[i] >= 0 ? mundo.aldeias[c.aldeia[i]] : undefined;
      let fatia = a && focoDe(a) === 'exercito'
        ? BAL.fracaoSoldadosEmGuerraTotal
        : BAL.fracaoSoldados;
      // O clã puxa a fatia: um clã guerreiro manda quase todo mundo para a
      // frente, um clã de lavradores quase ninguém. É o primeiro lugar onde os
      // valores de clã saem do papel e viram comportamento.
      const cla = mundo.cla(c.cla[i]);
      if (cla) fatia *= 1 + (cla.marcialidade - 0.5) * BAL.pesoDoClaNoExercito;
      if ((i % 100) / 100 < fatia) c.marcas[i] |= MARCA_SOLDADO;
    } else if ((c.marcas[i] & MARCA_SOLDADO) !== 0) {
      c.marcas[i] &= ~MARCA_SOLDADO;
    }
  }
}

/**
 * Dano a construções: soldados inimigos derrubam o que encontram pela frente.
 * Aldeia sem construção nenhuma e sem gente cai.
 */
export const sistemaCerco: Sistema = {
  id: 'cerco',
  intervalo: 20,
  executar(mundo: Mundo): void {
    const c = mundo.criaturas;
    const g = mundo.grid;

    for (let i = 0; i < c.limite; i++) {
      if (!c.vivo[i]) continue;
      if ((c.marcas[i] & MARCA_SOLDADO) === 0) continue;
      const meuReino = c.reino[i];
      if (meuReino < 0) continue;

      const tx = c.x[i] | 0;
      const ty = c.y[i] | 0;
      if (tx < 0 || ty < 0 || tx >= g.largura || ty >= g.altura) continue;
      const t = g.idx(tx, ty);
      const alvo = ancoraDaConstrucao(mundo, t);
      if (alvo < 0) continue;
      const construcao = g.construcao[alvo];
      const donaId = g.aldeiaDona[alvo];
      if (donaId < 0) continue;
      const dona = mundo.aldeias[donaId];
      if (!dona?.ativa || dona.reino === meuReino) continue;
      if (!mundo.emGuerra(meuReino, dona.reino)) continue;

      // pancada proporcional à resistência do que está sendo derrubado
      const dureza = ED_RESISTENCIA[construcao - 1]
        * MAT_FATOR[materialDoAcabamento(g.acabamento[alvo])];
      if (mundo.rng.chance(24 / (dureza + 24))) {
        derrubar(mundo, alvo, construcao - 1 !== ED.ruina);
        dona.moral -= 3;
        mundo.recalcularCapacidade(dona);
      }

      // aldeia sem gente e sem casa é tomada
      if (dona.populacao <= 0) {
        const antigo = dona.reino;
        mundo.aldeias[donaId].reino = meuReino;
        const velho = mundo.reinos[antigo];
        if (velho) velho.aldeias = velho.aldeias.filter((x) => x !== donaId);
        const novo = mundo.reinos[meuReino];
        if (novo?.ativo) novo.aldeias.push(donaId);
        dona.moral = 40;
        mundo.eventos.emitir('aldeia:conquistada', { aldeia: donaId, de: antigo, para: meuReino });
        if (velho?.ativo && velho.aldeias.length === 0) mundo.extinguirReino(antigo);
      }
    }
  },
};
