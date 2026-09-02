import type { Sistema } from '../core/sistemas.js';
import type { Mundo } from '../core/mundo.js';
import { Estado } from '../core/criaturas.js';
import { B, BIOMA_FERTIL, BIOMA_INFLAMAVEL } from '../dados/biomas.js';
import {
  REC_COMIDA, REC_INFLAMAVEL, REC_MATERIAL, REC_QUANTIDADE, REC_RECRESCE,
  recursoAceitaBioma,
} from '../dados/recursos.js';
import { ancoraDaConstrucao, derrubar } from './urbanismo.js';
import { fatorDeAgua } from './geracao.js';
import { ED } from '../dados/edificios.js';
import { BAL } from './balanco.js';
import { indiceDoMaterial, oQueFalta } from './coleta.js';

const INDICE_COMIDA = indiceDoMaterial('comida');

/**
 * As três famílias em que o chão é medido, e o material que identifica cada uma.
 *
 * Não é a lista de materiais: o que interessa aqui é o que o objeto **é** no
 * mapa — mata, moita de fruta ou pedra —, e todos os metais contam como pedra
 * porque ocupam o chão do mesmo jeito e disputam o mesmo espaço.
 */
type FamiliaDoChao = 'madeira' | 'comida' | 'pedra';

/** A que família cada recurso pertence, por índice de recurso. */
const REC_FAMILIA: FamiliaDoChao[] = REC_MATERIAL.map((m) =>
  m === 'madeira' ? 'madeira' : m === 'comida' ? 'comida' : 'pedra',
);

/**
 * Vegetação crescendo, herbívoros pastando e incêndio se alastrando.
 *
 * O crescimento varre o mapa em faixas: a cada tick só uma parte das linhas é
 * atualizada, então o mundo inteiro se renova a cada `FAIXAS` ticks sem que
 * nenhum tick pague o custo do mapa completo.
 */
const FAIXAS = 12;

export const sistemaEcologia: Sistema = {
  id: 'ecologia',
  executar(mundo: Mundo): void {
    recensearOChao(mundo);
    crescerVegetacao(mundo);
    comerVegetal(mundo);
    queimar(mundo);
    esfriarLava(mundo);
    desfazerRuinas(mundo);
  },
};

/**
 * Conta o que ocupa o chão e diz quais famílias já encheram a cota.
 *
 * Uma varredura do mapa a cada `BAL.intervaloCensoDoChao` ticks: num mundo
 * continental são umas duas mil linhas de conta por tick, contra os milhares
 * de decisões que a IA toma no mesmo tempo. O resultado fica em
 * `Mundo.chaoLotado`, e quem planta consulta antes de plantar.
 *
 * Por que teto: a rebrota fecha clareira, e sem limite ela fecha **todas**. Um
 * mundo deixado rodando algumas horas virava um tapete de árvore e pedra sem
 * chão à vista. O teto é por família e sobre os tiles que aceitam aquela
 * família, então mata cheia não impede pedra de aparecer.
 */
function recensearOChao(mundo: Mundo): void {
  if (mundo.tick % BAL.intervaloCensoDoChao !== 0) return;
  const g = mundo.grid;

  let terra = 0;
  let madeira = 0;
  let comida = 0;
  let pedra = 0;
  for (let i = 0; i < g.total; i++) {
    if (!g.ehTerra(i)) continue;
    terra++;
    const r = g.recurso[i];
    if (r === 0) continue;
    const familia = REC_FAMILIA[r - 1];
    if (familia === 'madeira') madeira++;
    else if (familia === 'comida') comida++;
    else pedra++;
  }
  if (terra === 0) return;

  mundo.chaoLotado.madeira = madeira / terra >= BAL.tetoDoChao.madeira;
  mundo.chaoLotado.comida = comida / terra >= BAL.tetoDoChao.comida;
  mundo.chaoLotado.pedra = pedra / terra >= BAL.tetoDoChao.pedra;
}

/**
 * Lava esfria e vira rocha escura.
 *
 * Sem isto a lava é permanente, e um vulcão em atividade acaba com o mapa: cada
 * bomba deixa um tile aceso para sempre, e em algumas horas a serra inteira é
 * laranja. Esfriando, o vulcão fica sendo o que devia ser — um lugar perigoso
 * de se morar perto, que deixa um rastro de rocha nova em vez de engolir o
 * continente. A rocha resultante é estéril: a vida volta ali muito devagar.
 */
function esfriarLava(mundo: Mundo): void {
  if (mundo.tick % BAL.intervaloEsfriarLava !== 0) return;
  const g = mundo.grid;
  // uma fatia por vez, como as ruínas: lava não tem pressa
  const fatias = 8;
  const passo = Math.ceil(g.total / fatias);
  const inicio = ((mundo.tick / BAL.intervaloEsfriarLava) % fatias) * passo;
  const fim = Math.min(g.total, inicio + passo);

  for (let i = inicio; i < fim; i++) {
    if (g.bioma[i] !== B.lava) continue;
    if (!mundo.rng.chance(BAL.chanceLavaEsfriar)) continue;
    g.bioma[i] = B.vulcao;
    g.vegetacao[i] = 0;
    g.marcarSujoIdx(i);
  }
}

/**
 * Ruína velha desmorona e o mato volta.
 *
 * Sem isto, cada casa queimada ou derrubada deixava uma marca permanente: o
 * tile ficava ocupado para sempre, bloqueando lote e estrada, e um mundo de
 * horas acumulava centenas de escombros que ninguém nunca ia limpar.
 */
function desfazerRuinas(mundo: Mundo): void {
  if (mundo.tick % BAL.intervaloRuinas !== 0) return;
  const g = mundo.grid;
  // varre uma fatia do mapa por vez: o mundo inteiro sai caro e escombro não
  // tem pressa nenhuma
  const fatias = 8;
  const passo = Math.ceil(g.total / fatias);
  const inicio = ((mundo.tick / BAL.intervaloRuinas) % fatias) * passo;
  const fim = Math.min(g.total, inicio + passo);

  for (let i = inicio; i < fim; i++) {
    if (g.construcao[i] !== ED.ruina + 1) continue;
    if (!mundo.rng.chance(BAL.chanceRuinaDesmoronar)) continue;
    derrubar(mundo, i, false);
    g.vegetacao[i] = 40;

  }
}

/**
 * Árvores e arbustos voltam a encher com o tempo; minério, não.
 * Roda junto da vegetação, na mesma faixa de linhas, para pagar uma varredura só.
 */
function recrescerRecursos(mundo: Mundo, y0: number, y1: number): void {
  const g = mundo.grid;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < g.largura; x++) {
      const i = y * g.largura + x;
      const r = g.recurso[i];
      if (r === 0) continue;
      const passo = REC_RECRESCE[r - 1];
      if (passo <= 0) continue;
      const teto = REC_QUANTIDADE[r - 1];
      if (g.recursoQtd[i] >= teto) continue;
      const antes = g.recursoQtd[i];
      g.recursoQtd[i] = Math.min(teto, antes + passo * FAIXAS);
      if ((g.recursoQtd[i] >> 3) !== (antes >> 3)) g.marcarSujo(x, y);
    }
  }
}

/**
 * A mata volta.
 *
 * Uma vila desmata o próprio entorno em algumas dezenas de anos e depois fica
 * sem madeira para construir qualquer coisa. Aqui um tile vazio de um bioma que
 * dá árvore pode brotar de novo, devagar, desde que ainda haja mata por perto
 * para semear — clareira no meio da floresta se fecha, deserto não vira bosque.
 */
function rebrotarMata(mundo: Mundo, y0: number, y1: number): void {
  // Mata e moita rebrotam pelo mesmo caminho, e cada uma para no seu teto. A
  // fruta entrou aqui porque só a mata voltava: em vinte mil ticks os arbustos
  // caíam de 8,7% do chão para 2,9%, comidos por bicho e por gente sem nunca
  // se repor, e a comida do mundo ia junto.
  const madeiraPode = !mundo.chaoLotado.madeira;
  const comidaPode = !mundo.chaoLotado.comida;
  if (!madeiraPode && !comidaPode) return;
  const g = mundo.grid;
  const viz = mundo.bufVizinhos;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < g.largura; x++) {
      const i = y * g.largura + x;
      if (g.recurso[i] !== 0 || g.construcao[i] !== 0 || g.ocupacao[i] !== -1) continue;
      if (g.estrada[i] === 1 || g.fogo[i] > 0) continue;
      if (!g.ehTerra(i) || g.ehMontanha(i)) continue;
      // O limiar é relativo ao que aquele bioma consegue ter: com um número
      // fixo, savana, tundra e terra queimada nunca alcançavam — e eram
      // justamente os lugares onde a mata precisava voltar depois do fogo.
      if (g.vegetacao[i] < BIOMA_FERTIL[g.bioma[i]] * 255 * 0.55) continue;
      if (!mundo.rng.chance(BAL.chanceRebrotar)) continue;
      // A mata volta primeiro onde tem água, como na geração do mundo: a
      // margem do rio fecha a clareira em pouco tempo e o interflúvio seco
      // continua aberto por muito mais. Sem isto, uma floresta derrubada
      // voltava distribuída por igual e a bacia hidrográfica que o mapa
      // desenhava no começo da partida ia se apagando.
      //
      // A sondagem é local e só roda depois do sorteio acima, que já descarta
      // duzentos e cinquenta candidatos para cada um que chega aqui.
      const perto = fatorDeAgua(distanciaDaAguaDoce(mundo, x, y), 999);
      if (!mundo.rng.chance(Math.min(1, perto / BAL.rebrotaJuntoDagua))) continue;

      // precisa de uma planta vizinha para dar a semente
      const n = g.vizinhos8(x, y, viz);
      let semente = 0;
      for (let k = 0; k < n; k++) {
        const r = g.recurso[viz[k]];
        if (r === 0) continue;
        const familia = REC_FAMILIA[r - 1];
        if (familia === 'madeira' ? !madeiraPode : familia === 'comida' ? !comidaPode : true) {
          continue;
        }
        // e a semente tem de servir para este chão: sem isto, bastava um
        // arbusto na fronteira do bioma para nascer palmeira na neve
        if (!recursoAceitaBioma(r - 1, g.bioma[i])) continue;
        semente = r;
        break;
      }
      if (semente === 0) continue;
      g.recurso[i] = semente;
      g.recursoQtd[i] = Math.round(REC_QUANTIDADE[semente - 1] * 0.25);
      g.marcarSujo(x, y);
    }
  }
}

/**
 * A que distância está o rio ou lago mais próximo, olhando só o entorno.
 *
 * Anéis crescendo a partir do tile, com saída assim que acha: perto da água
 * custa quase nada, e longe custa uma varredura pequena que só acontece para
 * um punhado de tiles por tick. A alternativa seria guardar um mapa de
 * distância no `Grid` e mantê-lo em dia a cada alagamento, meteoro e maremoto
 * — caro e frágil para o que isto resolve.
 */
function distanciaDaAguaDoce(mundo: Mundo, cx: number, cy: number): number {
  const g = mundo.grid;
  for (let r = 1; r <= ALCANCE_DA_SONDAGEM; r++) {
    const x0 = Math.max(0, cx - r);
    const x1 = Math.min(g.largura - 1, cx + r);
    const y0 = Math.max(0, cy - r);
    const y1 = Math.min(g.altura - 1, cy + r);
    for (let y = y0; y <= y1; y++) {
      // só a borda do anel: o miolo já foi olhado na volta anterior
      const naBorda = y === cy - r || y === cy + r;
      const passo = naBorda ? 1 : Math.max(1, x1 - x0);
      for (let x = x0; x <= x1; x += passo) {
        const b = g.bioma[y * g.largura + x];
        if (b === B.rio || b === B.lago) return r;
      }
    }
  }
  return ALCANCE_DA_SONDAGEM * 2;
}

/** Até onde a rebrota procura água doce em volta. */
const ALCANCE_DA_SONDAGEM = 12;

function crescerVegetacao(mundo: Mundo): void {
  const g = mundo.grid;
  const faixa = mundo.tick % FAIXAS;
  const linhasPorFaixa = Math.ceil(g.altura / FAIXAS);
  const y0 = faixa * linhasPorFaixa;
  const y1 = Math.min(g.altura, y0 + linhasPorFaixa);
  const ganho = BAL.crescimentoVegetacao * FAIXAS;

  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < g.largura; x++) {
      const i = y * g.largura + x;
      if (g.fogo[i] > 0) continue;
      const fert = BIOMA_FERTIL[g.bioma[i]];
      if (fert <= 0) continue;
      const teto = fert * 255;
      if (g.vegetacao[i] >= teto) continue;
      const antes = g.vegetacao[i];
      g.vegetacao[i] = Math.min(teto, antes + ganho * fert);
      // só sujar o chunk quando a mudança é visível na cor
      if ((g.vegetacao[i] >> 4) !== (antes >> 4)) g.marcarSujo(x, y);
    }
  }
  recrescerRecursos(mundo, y0, y1);
  rebrotarMata(mundo, y0, y1);
}

/**
 * Quem chegou num tile com comida vegetal se serve.
 *
 * Fruta vem primeiro e alimenta bem mais que capim — é o que faz valer a pena
 * atravessar o campo até um arbusto em vez de mastigar o mato do lado.
 */
function comerVegetal(mundo: Mundo): void {
  const c = mundo.criaturas;
  const g = mundo.grid;
  const limite = c.limite;

  for (let i = 0; i < limite; i++) {
    if (!c.vivo[i]) continue;
    const estado = c.estado[i];
    if (estado !== Estado.BuscandoComida && estado !== Estado.Trabalhando) continue;

    const tx = c.x[i] | 0;
    const ty = c.y[i] | 0;
    if (tx < 0 || ty < 0 || tx >= g.largura || ty >= g.altura) continue;

    // Quem saiu a trabalho só enche a carga do que a aldeia pediu. Sem isto o
    // lenhador colhia capim no caminho da floresta e voltava para casa com
    // comida — a aldeia pedia madeira o tempo todo e nunca recebia nenhuma.
    // (Comparar com o tile de destino não serve: o movimento apaga o destino
    // no instante em que a criatura chega, antes deste sistema rodar.)
    if (estado === Estado.Trabalhando) {
      const casa = c.aldeia[i] >= 0 ? mundo.aldeias[c.aldeia[i]] : undefined;
      if (!casa?.ativa || oQueFalta(casa) !== 'comida') continue;
    }

    const t = g.idx(tx, ty);

    let alimento = 0;

    const r = g.recurso[t];
    if (r !== 0 && REC_COMIDA[r - 1] === 1 && g.recursoQtd[t] > 3) {
      const tirado = g.colher(t, BAL.frutaPorRefeicao);
      alimento = (tirado / BAL.frutaPorRefeicao) * BAL.saciaFruta;
    } else if (g.vegetacao[t] >= 30) {
      const colhido = Math.min(g.vegetacao[t], BAL.vegetacaoComida);
      g.vegetacao[t] -= colhido;
      g.marcarSujo(tx, ty);
      alimento = (colhido / BAL.vegetacaoComida) * BAL.saciaVegetacao;
    } else {
      continue;
    }

    if (estado === Estado.Trabalhando) {
      // trabalhador de aldeia guarda a maior parte em vez de comer tudo, mas
      // só se a carga já não for de outro material
      if (c.carga[i] === 0 || c.cargaMaterial[i] === INDICE_COMIDA) {
        c.cargaMaterial[i] = INDICE_COMIDA;
        c.carga[i] += (alimento / BAL.saciaVegetacao) * BAL.cargaTrabalho;
      }
      c.fome[i] = Math.max(0, c.fome[i] - 8);
    } else {
      c.fome[i] = Math.max(0, c.fome[i] - alimento);
      c.estado[i] = Estado.Vagando;
    }
    c.destinoX[i] = -1;
  }
}

/** Propagação e extinção do fogo. */
function queimar(mundo: Mundo): void {
  const g = mundo.grid;
  if (mundo.chamas.size === 0) return;

  const apagar: number[] = [];
  const acender: number[] = [];
  const viz = mundo.bufVizinhos;

  for (const i of mundo.chamas) {
    g.fogo[i] -= 1;
    g.marcarSujoIdx(i);

    if (g.fogo[i] <= 0) {
      apagar.push(i);
      // o que sobra depois do fogo
      g.vegetacao[i] = 0;
      // árvore queimada some; pedra e minério ficam
      if (g.recurso[i] !== 0 && REC_INFLAMAVEL[g.recurso[i] - 1] === 1) {
        g.limparRecurso(i);
      }
      if (BIOMA_FERTIL[g.bioma[i]] > 0.3) g.bioma[i] = B.cinzas;
      const alvo = ancoraDaConstrucao(mundo, i);
      if (alvo >= 0) derrubar(mundo, alvo, true);
      continue;
    }

    // consome o que o alimenta: sem isso o mesmo tile queima para sempre
    if (g.vegetacao[i] > 0) g.vegetacao[i] = Math.max(0, g.vegetacao[i] - 12);

    const x = i % g.largura;
    const y = (i / g.largura) | 0;
    const n = g.vizinhos8(x, y, viz);
    for (let k = 0; k < n; k++) {
      const j = viz[k];
      if (g.fogo[j] > 0) continue;
      const chance = combustivel(mundo, j) * BAL.espalhaFogo;
      if (chance > 0 && mundo.rng.chance(chance)) acender.push(j);
    }
  }

  for (const i of apagar) {
    mundo.chamas.delete(i);
    g.fogo[i] = 0;
  }
  for (const i of acender) {
    if (mundo.chamas.size > 6000) break; // teto de segurança
    atear(mundo, i);
  }
}

/**
 * Quanto combustível o tile tem para queimar, de 0 a 1.
 *
 * Fogo sem combustível não existe. Antes bastava o bioma ser inflamável, e o
 * incêndio atravessava campo raspado e terra queimada como se fosse mata —
 * um raio só chegava a consumir um terço da terra do mundo e nunca se apagava.
 */
function combustivel(mundo: Mundo, i: number): number {
  const g = mundo.grid;
  if (g.ehAgua(i)) return 0;
  const doBioma = BIOMA_INFLAMAVEL[g.bioma[i]];
  if (doBioma <= 0) return 0;

  let c = 0;
  if (g.vegetacao[i] > 55) c += (g.vegetacao[i] - 55) / 200;
  if (g.recurso[i] !== 0 && REC_INFLAMAVEL[g.recurso[i] - 1] === 1) c += 0.6;
  if (ancoraDaConstrucao(mundo, i) >= 0) c += 0.5;
  return Math.min(1, c) * doBioma;
}

/** Põe fogo num tile. Usado pela ecologia, pelos poderes e pelos desastres. */
export function atear(mundo: Mundo, i: number): void {
  const g = mundo.grid;
  if (g.fogo[i] > 0) return;
  if (combustivel(mundo, i) <= 0) return;
  g.fogo[i] = BAL.duracaoFogo;
  mundo.chamas.add(i);
  g.marcarSujoIdx(i);
  mundo.eventos.emitir('terreno:incendio', { x: i % g.largura, y: (i / g.largura) | 0 });
}
