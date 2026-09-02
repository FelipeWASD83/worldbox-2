import { Registro, type Definicao } from '../core/registro.js';
import type { Mundo } from '../core/mundo.js';
import { B } from '../dados/biomas.js';
import { R, REC_QUANTIDADE } from '../dados/recursos.js';
import { biomaDe } from './geracao.js';
import { TEC_CUSTO, TEC_REQUER } from '../dados/tecnologias.js';

/**
 * As ferramentas na mão do jogador.
 *
 * Cada poder é uma definição com uma função `aplicar`. Poder novo = mais um
 * item neste registro; a barra de ferramentas se monta sozinha a partir daqui.
 */
export interface Poder extends Definicao {
  readonly nome: string;
  readonly icone: string;
  /**
   * Em que aba da barra o poder mora.
   *
   * A lista cresceu junto com o número de ferramentas: com quase duzentas, uma
   * aba de "terreno" com tudo dentro voltaria a ser a parede de ícones que a
   * divisão em abas resolveu. `CATEGORIAS`, logo abaixo, é a ordem em que elas
   * aparecem, e a interface se monta a partir dela — aba nova é uma entrada
   * naquele array e uma `<section>` no HTML.
   */
  readonly categoria: Categoria;
  readonly descricao: string;
  /** Raio inicial em tiles. */
  readonly raio: number;
  /** Se true, continua aplicando enquanto o botão estiver pressionado. */
  readonly continuo: boolean;
  /**
   * `parametro` carrega a escolha secundária da ferramenta — hoje só o índice
   * da espécie a invocar.
   */
  aplicar(mundo: Mundo, x: number, y: number, raio: number, parametro?: number): void;
}


/** As abas da barra de ferramentas, na ordem em que aparecem. */
export const CATEGORIAS = [
  'terreno', 'bioma', 'natureza', 'vida', 'construcao', 'destruicao', 'reino', 'saber',
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

/** Como cada aba se chama na tela. */
export const NOME_CATEGORIA: Record<Categoria, string> = {
  terreno: 'terreno',
  bioma: 'biomas',
  natureza: 'natureza',
  vida: 'vida',
  construcao: 'obras',
  destruicao: 'destruição',
  reino: 'reinos',
  saber: 'saber',
};

export const poderes = new Registro<Poder>('poderes');

// ------------------------------------------------------------------ utilidades

/** Chama `fn` para cada tile dentro do círculo. */
export function porTile(
  mundo: Mundo,
  cx: number,
  cy: number,
  raio: number,
  fn: (i: number, x: number, y: number, forca: number) => void,
): void {
  const g = mundo.grid;
  const r = Math.max(0, raio);
  const r2 = r * r;
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(g.largura - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(g.altura - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      fn(g.idx(x, y), x, y, r === 0 ? 1 : 1 - Math.sqrt(d2) / r);
    }
  }
}

/** Chama `fn` para cada criatura viva dentro do círculo. */
/**
 * Chama `fn` para cada criatura viva dentro do círculo.
 *
 * Varre o pool inteiro em vez de usar o índice espacial de propósito: quem está
 * dentro de casa sai do índice — para não ser caçado nem atacado —, e a mão do
 * jogador tem de alcançar mesmo assim. Um raio não respeita telhado. Poder é
 * clique, não laço de tick: pagar a varredura aqui não custa nada.
 */
export function porCriatura(
  mundo: Mundo,
  cx: number,
  cy: number,
  raio: number,
  fn: (id: number, forca: number) => void,
): void {
  const c = mundo.criaturas;
  const r2 = raio * raio;
  const limite = c.limite;
  for (let id = 0; id < limite; id++) {
    if (!c.vivo[id]) continue;
    const dx = c.x[id] - cx;
    const dy = c.y[id] - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    fn(id, raio === 0 ? 1 : 1 - Math.sqrt(d2) / raio);
  }
}


/**
 * A descoberta mais barata que aquele reino já pode alcançar, ou -1.
 *
 * A mesma escolha que a corte faria sozinha em `src/sim/conhecimento.ts` — o
 * poder do jogador antecipa a decisão, não a substitui por outra.
 */
export function proximaDescoberta(r: { tecnologias: Set<number> }): number {
  let alvo = -1;
  let maisBarata = Infinity;
  for (let t = 0; t < TEC_CUSTO.length; t++) {
    if (r.tecnologias.has(t)) continue;
    if (TEC_CUSTO[t] >= maisBarata) continue;
    if (!TEC_REQUER[t].every((req) => r.tecnologias.has(req))) continue;
    maisBarata = TEC_CUSTO[t];
    alvo = t;
  }
  return alvo;
}

/**
 * Que reinos têm presença dentro do círculo: pelo chão que dominam ou pela
 * gente que está ali.
 *
 * Os dois critérios importam. Só território deixaria de fora uma horda em
 * marcha, que é justamente onde o jogador vai querer clicar; só criaturas
 * deixaria de fora o interior de um império, onde não há ninguém passando no
 * momento do clique.
 */
export function reinosNaArea(mundo: Mundo, cx: number, cy: number, raio: number): Set<number> {
  const achados = new Set<number>();
  porTile(mundo, cx, cy, raio, (i) => {
    const dono = mundo.grid.territorio[i];
    if (dono >= 0 && mundo.reinos[dono]?.ativo) achados.add(dono);
  });
  porCriatura(mundo, cx, cy, raio, (id) => {
    const dono = mundo.criaturas.reino[id];
    if (dono >= 0 && mundo.reinos[dono]?.ativo) achados.add(dono);
  });
  return achados;
}

/** Refaz o bioma de um tile depois de mexer na altitude. */
export function refazerBioma(mundo: Mundo, i: number): void {
  const g = mundo.grid;
  g.bioma[i] = biomaDe(g.alt[i], g.temp[i], g.umidade[i]);
  g.marcarSujoIdx(i);
}

/**
 * Poe um recurso num tile, se o chao servir.
 *
 * A mão do jogador segue a mesma regra da natureza: minério nasce em qualquer
 * chão seco, menos na neve, onde o solo está coberto e não há o que garimpar.
 * O poder era mais restrito que a geração do mundo — só aceitava montanha — e
 * a diferença não tinha razão de ser depois que o minério passou a nascer no
 * mundo inteiro.
 */
export function plantar(
  mundo: Mundo,
  i: number,
  idRecurso: string,
  chance: number,
  minerio = false,
): void {
  const g = mundo.grid;
  if (g.ehAgua(i)) return;
  if (minerio && g.bioma[i] === B.neve) return;
  if (!mundo.rng.chance(chance)) return;
  const indice = R[idRecurso];
  if (indice === undefined) return;
  g.recurso[i] = indice + 1;
  g.recursoQtd[i] = REC_QUANTIDADE[indice];
  g.marcarSujoIdx(i);
}

/** Pinta um bioma direto, ajustando a altitude para ele fazer sentido. */
export function pintar(mundo: Mundo, i: number, bioma: number, altMin: number, altMax: number): void {
  const g = mundo.grid;
  if (g.alt[i] < altMin) g.alt[i] = altMin;
  if (g.alt[i] > altMax) g.alt[i] = altMax;
  g.bioma[i] = bioma;
  g.marcarSujoIdx(i);
}

