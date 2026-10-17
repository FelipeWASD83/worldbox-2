import type { Mundo } from '../core/mundo.js';
import type { Grid } from '../core/grid.js';
import { NIVEL_MAR, NIVEL_MONTANHA } from '../core/grid.js';
import { BIOMA_AGUA } from '../dados/biomas.js';
import { BAL } from './balanco.js';

/**
 * Busca de caminho: A* numa janela em volta da criatura.
 *
 * O movimento continua sendo em linha reta (`movimento.ts`) — é o que permite
 * mover dezenas de milhares por tick. A busca só entra **quando a linha reta
 * bate**: o bicho que esbarrou num lago, o lenhador com um rio entre ele e a
 * mata, o peixe com uma península no meio do caminho. Antes daqui, a criatura
 * deslizava pelo eixo que ainda dava e, numa enseada em U, ficava presa no
 * fundo até desistir.
 *
 * Três coisas seguram o custo:
 *
 * - **Teto por tick** (`BAL.buscasPorTick`). Quem pede rota além do teto anda
 *   como sempre andou e pede de novo no tick seguinte.
 * - **Janela**. A busca só olha um quadrado de `BAL.janelaDaBusca` tiles de
 *   raio em volta de quem pediu. Destino fora dela vira o ponto da borda mais
 *   perto dele: a criatura chega lá e, se ainda estiver bloqueada, pede outra.
 * - **Nada de lista nova por busca**. Os nós vivem em arrays tipados
 *   reaproveitados, com um carimbo de geração em vez de limpar a janela a cada
 *   busca.
 *
 * A rota guardada é curta — no máximo `PONTOS_POR_ROTA` pontos de passagem,
 * depois de esticada por linha de visão —, e não vai para o save: é estado de
 * passagem, como o pensamento da criatura naquele instante.
 */

/** Quantos pontos de passagem cabem na rota de uma criatura. */
export const PONTOS_POR_ROTA = 12;

/** Domínio de quem anda: 0 terra, 1 água. Quem voa nunca pede rota. */
export function podePisarTile(g: Grid, dominio: number, i: number): boolean {
  if (dominio === 1) return BIOMA_AGUA[g.bioma[i]] === 1;
  return g.alt[i] >= NIVEL_MAR && g.alt[i] < NIVEL_MONTANHA + 40;
}

/**
 * As rotas de todas as criaturas, em arrays paralelos ao pool.
 *
 * Mora fora de `Criaturas` porque não é atributo da criatura e não vai para o
 * save; o mundo guarda uma instância (`Mundo.rotas`).
 */
export class Rotas {
  /** Pontos de passagem, em tiles: `PONTOS_POR_ROTA` por criatura. */
  readonly x: Int16Array;
  readonly y: Int16Array;
  /** Quantos pontos a rota tem, e em qual a criatura está. 0 = sem rota. */
  readonly n: Uint8Array;
  readonly k: Uint8Array;
  /** Tile de destino para o qual a rota foi calculada. Mudou o destino, a rota não vale. */
  readonly para: Int32Array;
  /** Tick até o qual a criatura não pede rota de novo (falhou ou acabou de pedir). */
  readonly espera: Int32Array;
  /** 1 quando a busca normal falhou e a próxima deve usar a janela grande. */
  readonly grande: Uint8Array;

  /** Quantas buscas já foram feitas neste tick, e em que tick. */
  buscasNoTick = 0;
  tickDasBuscas = -1;
  /** Contadores, para o simulador e os testes. */
  totalBuscas = 0;
  totalAchadas = 0;

  constructor(capacidade: number) {
    this.x = new Int16Array(capacidade * PONTOS_POR_ROTA);
    this.y = new Int16Array(capacidade * PONTOS_POR_ROTA);
    this.n = new Uint8Array(capacidade);
    this.k = new Uint8Array(capacidade);
    this.para = new Int32Array(capacidade).fill(-1);
    this.espera = new Int32Array(capacidade);
    this.grande = new Uint8Array(capacidade);
  }

  esquecer(i: number): void {
    this.n[i] = 0;
    this.k[i] = 0;
    this.para[i] = -1;
  }
}

// ------------------------------------------------------------ buffers da busca

const LADO_MAX = 2 * 64 + 1;
const NOS = LADO_MAX * LADO_MAX;
const custo = new Float32Array(NOS);
const veio = new Int32Array(NOS);
const carimbo = new Uint32Array(NOS);
const fechado = new Uint32Array(NOS);
let geracao = 0;
// fila de prioridade (heap binário) de nós da janela
const heapNo = new Int32Array(NOS);
const heapF = new Float32Array(NOS);
let heapTam = 0;
// o caminho bruto, do fim para o começo
const bruto = new Int32Array(NOS);

function heapPor(no: number, f: number): void {
  let k = heapTam++;
  while (k > 0) {
    const pai = (k - 1) >> 1;
    if (heapF[pai] <= f) break;
    heapNo[k] = heapNo[pai];
    heapF[k] = heapF[pai];
    k = pai;
  }
  heapNo[k] = no;
  heapF[k] = f;
}

function heapTirar(): number {
  const topo = heapNo[0];
  const ultNo = heapNo[--heapTam];
  const ultF = heapF[heapTam];
  let k = 0;
  for (;;) {
    let filho = k * 2 + 1;
    if (filho >= heapTam) break;
    if (filho + 1 < heapTam && heapF[filho + 1] < heapF[filho]) filho++;
    if (heapF[filho] >= ultF) break;
    heapNo[k] = heapNo[filho];
    heapF[k] = heapF[filho];
    k = filho;
  }
  heapNo[k] = ultNo;
  heapF[k] = ultF;
  return topo;
}

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];
const PASSO = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

/**
 * Contexto da busca em andamento, em variáveis de módulo e não num objeto ou
 * numa função criada por busca: é o laço mais quente desta parte do jogo, e
 * cada vizinho de cada nó passa por `anda`.
 */
let _alt: Uint8Array = new Uint8Array(0);
let _bioma: Uint8Array = new Uint8Array(0);
let _largura = 0;
let _altura = 0;
let _dominio = 0;
let _ox = 0;
let _oy = 0;
let _lado = 0;

/** O nó local (x, y da janela) é andável? */
function anda(lx: number, ly: number): boolean {
  if (lx < 0 || ly < 0 || lx >= _lado || ly >= _lado) return false;
  const wx = lx + _ox;
  const wy = ly + _oy;
  if (wx < 0 || wy < 0 || wx >= _largura || wy >= _altura) return false;
  const i = wy * _largura + wx;
  if (_dominio === 1) return BIOMA_AGUA[_bioma[i]] === 1;
  return _alt[i] >= NIVEL_MAR && _alt[i] < NIVEL_MONTANHA + 40;
}

/** Distância octogonal: o custo exato de andar sem obstáculo em oito direções. */
function octil(dx: number, dy: number): number {
  const ax = dx < 0 ? -dx : dx;
  const ay = dy < 0 ? -dy : dy;
  return ax > ay ? ax + (Math.SQRT2 - 1) * ay : ay + (Math.SQRT2 - 1) * ax;
}

/**
 * Calcula a rota da criatura `i` até o tile (`destX`, `destY`) e a guarda.
 * Devolve se achou.
 *
 * Quem chama já sabe que a linha reta bateu: aqui não se confere de novo.
 */
export function calcularRota(
  mundo: Mundo, i: number, dominio: number, destX: number, destY: number,
): boolean {
  const rotas = mundo.rotas;
  rotas.totalBuscas++;
  // Primeiro a janela normal, que resolve o lago e a enseada. Se nela não há
  // passagem — a península comprida, a cordilheira de rio a rio —, a próxima
  // tentativa da mesma criatura usa a janela máxima, que vê o contorno de
  // longe. Em vezes separadas, e não na mesma chamada: a busca grande é a mais
  // cara do jogo, e duas no mesmo tick para a mesma criatura estouravam o
  // orçamento do movimento.
  const grande = rotas.grande[i] === 1;
  const r = grande
    ? buscar(mundo, i, dominio, destX, destY, 64, BAL.nosPorBusca * 3)
    : buscar(mundo, i, dominio, destX, destY, BAL.janelaDaBusca, BAL.nosPorBusca);
  rotas.grande[i] = r !== Busca.Achou && !grande ? 1 : 0;
  return r === Busca.Achou;
}

const enum Busca {
  Achou,
  JanelaFechada,
  Desistiu,
}

function buscar(
  mundo: Mundo, i: number, dominio: number, destX: number, destY: number,
  raioPedido: number, tetoDeNos: number,
): Busca {
  const g = mundo.grid;
  const rotas = mundo.rotas;
  const c = mundo.criaturas;

  const raio = Math.min(64, raioPedido);
  const lado = raio * 2 + 1;
  _alt = g.alt;
  _bioma = g.bioma;
  _largura = g.largura;
  _altura = g.altura;
  _dominio = dominio;
  _lado = lado;
  _ox = (c.x[i] | 0) - raio;
  _oy = (c.y[i] | 0) - raio;
  const sx = (c.x[i] | 0) - _ox;
  const sy = (c.y[i] | 0) - _oy;

  // Destino fora da janela: mira o ponto da borda na direção dele. A rota
  // leva até lá, e de lá a criatura segue em linha reta ou pede outra.
  let tx = destX - _ox;
  let ty = destY - _oy;
  if (tx < 0 || ty < 0 || tx >= lado || ty >= lado) {
    const ddx = tx - sx;
    const ddy = ty - sy;
    const escala = (raio - 1) / Math.max(Math.abs(ddx), Math.abs(ddy));
    tx = Math.round(sx + ddx * escala);
    ty = Math.round(sy + ddy * escala);
  }

  geracao++;
  if (geracao === 0xffffffff) {
    carimbo.fill(0);
    fechado.fill(0);
    geracao = 1;
  }

  // Destino na água (para quem anda) ou em terra (para peixe) não tem rota:
  // procura o vizinho andável mais perto dele. Sem isso, o lenhador mandado a
  // uma árvore na beira do rio procurava o tile do rio e nunca chegava.
  if (!anda(tx, ty)) {
    let achou = false;
    for (let r = 1; r <= 3 && !achou; r++) {
      for (let d = 0; d < 8 && !achou; d++) {
        const nx = tx + DX[d] * r;
        const ny = ty + DY[d] * r;
        if (anda(nx, ny)) {
          tx = nx;
          ty = ny;
          achou = true;
        }
      }
    }
    if (!achou) return Busca.Desistiu;
  }

  const inicio = sy * lado + sx;
  const alvo = ty * lado + tx;
  heapTam = 0;
  custo[inicio] = 0;
  veio[inicio] = -1;
  carimbo[inicio] = geracao;
  heapPor(inicio, octil(tx - sx, ty - sy));

  const montanha = NIVEL_MONTANHA;
  const custoSerra = BAL.custoDaSerraNaRota;
  let expandidos = 0;
  let resultado = Busca.JanelaFechada;
  while (heapTam > 0) {
    const no = heapTirar();
    if (fechado[no] === geracao) continue;
    fechado[no] = geracao;
    if (no === alvo) {
      resultado = Busca.Achou;
      break;
    }
    if (++expandidos > tetoDeNos) {
      resultado = Busca.Desistiu;
      break;
    }
    const nx0 = no % lado;
    const ny0 = (no / lado) | 0;
    for (let d = 0; d < 8; d++) {
      const nx = nx0 + DX[d];
      const ny = ny0 + DY[d];
      if (!anda(nx, ny)) continue;
      // diagonal não corta quina: as duas laterais têm de ser andáveis
      if (d >= 4 && (!anda(nx, ny0) || !anda(nx0, ny))) continue;
      const viz = ny * lado + nx;
      if (fechado[viz] === geracao) continue;
      // Serra custa mais: a rota contorna o morro quando há chão plano, do
      // mesmo jeito que o movimento já fazia, mas atravessa quando não há.
      let passo = PASSO[d];
      if (dominio === 0 && _alt[(ny + _oy) * _largura + nx + _ox] >= montanha) passo *= custoSerra;
      const novo = custo[no] + passo;
      if (carimbo[viz] === geracao && custo[viz] <= novo) continue;
      carimbo[viz] = geracao;
      custo[viz] = novo;
      veio[viz] = no;
      heapPor(viz, novo + octil(tx - nx, ty - ny));
    }
  }

  if (resultado !== Busca.Achou) return resultado;

  // remonta do fim para o começo
  let n = 0;
  for (let no = alvo; no !== -1 && n < NOS; no = veio[no]) bruto[n++] = no;

  // Estica a rota: de cada ponto, avança enquanto o próximo nó ainda se vê em
  // linha reta, e para no último visível. É o que transforma a escadinha de
  // tile em tile do A* em meia dúzia de retas que o movimento segue sem
  // ziguezague. Avançar e parar no primeiro que some de vista custa uma linha
  // de visão por nó; procurar o mais distante visível custaria o quadrado.
  const base = i * PONTOS_POR_ROTA;
  let pontos = 0;
  let atual = n - 1; // o começo
  while (atual > 0 && pontos < PONTOS_POR_ROTA) {
    let prox = atual - 1;
    for (let j = atual - 2; j >= 0 && atual - j <= 40; j--) {
      if (!vePorLinha(bruto[atual], bruto[j], lado)) break;
      prox = j;
    }
    rotas.x[base + pontos] = (bruto[prox] % lado) + _ox;
    rotas.y[base + pontos] = ((bruto[prox] / lado) | 0) + _oy;
    pontos++;
    atual = prox;
  }
  rotas.n[i] = pontos;
  rotas.k[i] = 0;
  rotas.para[i] = destY * g.largura + destX;
  rotas.totalAchadas++;
  return pontos > 0 ? Busca.Achou : Busca.Desistiu;
}

/** Dá para ir de um nó a outro em linha reta, sem pisar no que não se anda? */
function vePorLinha(a: number, b: number, lado: number): boolean {
  let x0 = a % lado;
  let y0 = (a / lado) | 0;
  const x1 = b % lado;
  const y1 = (b / lado) | 0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const px = x0 < x1 ? 1 : -1;
  const py = y0 < y1 ? 1 : -1;
  let erro = dx + dy;
  for (;;) {
    if (!anda(x0, y0)) return false;
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * erro;
    if (e2 >= dy) {
      // passo em x: confere a quina antes de virar diagonal
      if (e2 <= dx && !anda(x0 + px, y0) && !anda(x0, y0 + py)) return false;
      erro += dy;
      x0 += px;
    }
    if (e2 <= dx) {
      erro += dx;
      y0 += py;
    }
  }
}
