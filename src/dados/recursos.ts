import { Registro, type Definicao } from '../core/registro.js';
import type { Material } from './materiais.js';
import { biomas } from './biomas.js';

/**
 * O que existe em cima do chão: árvores, arbustos de fruta, pedra e veios de
 * minério.
 *
 * Recurso é **camada do mapa**, não entidade: dois bytes por tile (o tipo e o
 * quanto ainda tem). Uma floresta de oitenta mil árvores como objetos custaria
 * mais que a simulação inteira de criaturas.
 *
 * O índice guardado em `grid.recurso` é o do registro **mais um** — zero
 * significa "tile limpo".
 */
export interface Recurso extends Definicao {
  readonly nome: string;
  /** Cor no mapa afastado, RGB 0..255. */
  readonly cor: readonly [number, number, number];
  /** O que sai quando é explorado. */
  readonly rende: Material;
  /** Quanto rende por unidade retirada. */
  readonly porColheita: number;
  /** Quantidade que o tile guarda quando está cheio (0..255). */
  readonly quantidade: number;
  /** Unidades que voltam por tick. 0 = não volta (minério é finito). */
  readonly recresce: number;
  /**
   * Ids de bioma onde nasce. Vazio significa **em qualquer chão** — é o caso
   * dos minérios, que existem no mundo todo e só são mais fartos na rocha.
   */
  readonly biomas: readonly string[];
  /** Onde a densidade é multiplicada. Serve para "mais comum em montanha". */
  readonly maisEm?: Readonly<Record<string, number>>;
  /** Biomas onde nunca nasce, mesmo com a lista aberta. */
  readonly nuncaEm?: readonly string[];
  /** Fração dos tiles daquele bioma que recebe este recurso. */
  readonly densidade: number;
  /**
   * Tiles tomados no chão: [largura, profundidade].
   *
   * Hoje todo recurso é 1×1: uma árvore fica de pé num tile só e a copa passa
   * por cima dos vizinhos sem impedir nada — se ocupasse o tamanho do desenho,
   * uma floresta de árvores 3×6 teria uma árvore a cada dezoito tiles e
   * pareceria um pomar. O campo existe para quando houver recurso que ocupe
   * área de verdade, como uma pedreira.
   */
  readonly ocupa: readonly [number, number];
  /** Tamanho do desenho, em tiles: [largura, altura]. Sobe a partir da base. */
  readonly sprite: readonly [number, number];
  /** Pega fogo junto com a vegetação. */
  readonly inflamavel: boolean;
  /**
   * Nível mínimo da aldeia para explorar. Minério exige gente organizada —
   * é o que dá sentido a uma aldeia crescer antes de virar potência militar.
   */
  readonly nivelMinimo: number;
}

/**
 * Onde nada que sai do chão consegue nascer.
 *
 * O pico nevado e o gelo marinho são chão coberto: não há solo à vista para
 * garimpar nem terra para criar raiz. Antes só a neve estava na lista, e o
 * resultado era veio de ouro brotando no alto do pico e pedregulho boiando no
 * gelo do mar.
 */
const NADA_NO_GELO = ['neve', 'pico', 'gelo'] as const;

export const recursos = new Registro<Recurso>('recursos');

recursos.registrarTodos([
  // ------------------------------------------------------------------ mata
  // A densidade é bem menor que a de antes: com copa de três tiles, mata cheia
  // vira uma mancha verde sem árvore reconhecível dentro dela.
  {
    id: 'arvore', nome: 'árvore', cor: [46, 78, 42], rende: 'madeira', porColheita: 6,
    quantidade: 60, recresce: 0.006, densidade: 0.17, inflamavel: true,
    nivelMinimo: 1, ocupa: [1, 1], sprite: [2.4, 3.4],
    biomas: ['floresta', 'planicie', 'campo_fertil'],
  },
  {
    id: 'arvore_selva', nome: 'árvore da selva', cor: [38, 72, 40], rende: 'madeira', porColheita: 7,
    quantidade: 70, recresce: 0.007, densidade: 0.19, inflamavel: true,
    nivelMinimo: 1, ocupa: [1, 1], sprite: [2.6, 3.4],
    biomas: ['selva', 'mangue'],
  },
  {
    id: 'pinheiro', nome: 'pinheiro', cor: [42, 74, 62], rende: 'madeira', porColheita: 6,
    quantidade: 55, recresce: 0.005, densidade: 0.16, inflamavel: true,
    nivelMinimo: 1, ocupa: [1, 1], sprite: [1.8, 3.3],
    biomas: ['taiga', 'tundra', 'neve'],
  },
  {
    id: 'arvore_pantano', nome: 'árvore do pântano', cor: [52, 72, 50], rende: 'madeira', porColheita: 5,
    quantidade: 45, recresce: 0.006, densidade: 0.15, inflamavel: true,
    nivelMinimo: 1, ocupa: [1, 1], sprite: [1.8, 2.7],
    biomas: ['pantano'],
  },
  {
    id: 'arvore_seca', nome: 'árvore seca', cor: [96, 84, 60], rende: 'madeira', porColheita: 4,
    quantidade: 30, recresce: 0.002, densidade: 0.05, inflamavel: true,
    nivelMinimo: 1, ocupa: [1, 1], sprite: [1.5, 2.1],
    biomas: ['savana', 'terra_rachada', 'cinzas'],
  },

  // ----------------------------------------------------------------- frutas
  // Fruta é o que herbívoro come e o que a aldeia colhe antes de ter lavoura,
  // mas moita é objeto no chão como qualquer outro: quando havia uma para cada
  // três árvores, o campo virava um tapete e não sobrava terreno à vista. Hoje
  // a proporção buscada é da ordem de seis de mata para uma de fruta, e o que
  // sustenta o herbívoro é o pasto, não a moita.
  {
    id: 'arbusto', nome: 'arbusto de frutas', cor: [122, 62, 74], rende: 'comida', porColheita: 5,
    quantidade: 28, recresce: 0.02, densidade: 0.13, inflamavel: true,
    nivelMinimo: 1, ocupa: [1, 1], sprite: [0.9, 0.9],
    biomas: ['planicie', 'floresta', 'selva', 'campo_fertil', 'taiga', 'savana'],
  },
  {
    id: 'palmeira', nome: 'palmeira', cor: [70, 112, 58], rende: 'comida', porColheita: 5,
    quantidade: 34, recresce: 0.012, densidade: 0.1, inflamavel: true,
    nivelMinimo: 1, ocupa: [1, 1], sprite: [2.2, 2.8],
    biomas: ['praia', 'oasis'],
  },
  {
    id: 'cacto', nome: 'cacto', cor: [78, 118, 66], rende: 'comida', porColheita: 3,
    quantidade: 18, recresce: 0.008, densidade: 0.06, inflamavel: false,
    nivelMinimo: 1, ocupa: [1, 1], sprite: [0.9, 1.4],
    biomas: ['deserto', 'oasis'],
  },

  // --------------------------------------------------------------- minérios
  // Todos com `biomas: []`: pedra e metal existem no mundo inteiro, e só são
  // mais fartos onde a rocha aflora. A neve é a única exceção — lá o chão está
  // coberto e não há o que garimpar.
  {
    id: 'pedra', nome: 'pedregulho', cor: [124, 122, 120], rende: 'pedra', porColheita: 7,
    quantidade: 90, recresce: 0, densidade: 0.007, inflamavel: false,
    nivelMinimo: 1, ocupa: [1, 1], sprite: [1.5, 0.9],
    biomas: [], maisEm: { montanha: 5, pico: 4, terra_rachada: 3, tundra: 2, vulcao: 3 },
    nuncaEm: NADA_NO_GELO,
  },
  {
    id: 'ferro', nome: 'veio de ferro', cor: [150, 108, 92], rende: 'ferro', porColheita: 4,
    quantidade: 55, recresce: 0, densidade: 0.003, inflamavel: false,
    nivelMinimo: 2, ocupa: [1, 1], sprite: [1.5, 0.9],
    biomas: [], maisEm: { montanha: 6, terra_rachada: 4, pico: 3 },
    nuncaEm: NADA_NO_GELO,
  },
  {
    id: 'carvao', nome: 'veio de carvão', cor: [58, 56, 60], rende: 'carvao', porColheita: 5,
    quantidade: 50, recresce: 0, densidade: 0.0025, inflamavel: true,
    nivelMinimo: 2, ocupa: [1, 1], sprite: [1.5, 0.9],
    biomas: [], maisEm: { montanha: 5, taiga: 3, pantano: 3, tundra: 2 },
    nuncaEm: NADA_NO_GELO,
  },
  {
    id: 'cobre', nome: 'veio de cobre', cor: [176, 116, 70], rende: 'cobre', porColheita: 5,
    quantidade: 48, recresce: 0, densidade: 0.0022, inflamavel: false,
    nivelMinimo: 1, ocupa: [1, 1], sprite: [1.5, 0.9],
    biomas: [], maisEm: { montanha: 5, savana: 3, deserto: 3, terra_rachada: 3 },
    nuncaEm: NADA_NO_GELO,
  },
  {
    id: 'estanho', nome: 'veio de estanho', cor: [148, 156, 164], rende: 'estanho', porColheita: 4,
    quantidade: 40, recresce: 0, densidade: 0.002, inflamavel: false,
    nivelMinimo: 1, ocupa: [1, 1], sprite: [1.5, 0.9],
    biomas: [], maisEm: { montanha: 4, tundra: 3, praia: 2 },
    nuncaEm: NADA_NO_GELO,
  },
  {
    id: 'ouro', nome: 'veio de ouro', cor: [198, 162, 62], rende: 'ouro', porColheita: 3,
    quantidade: 26, recresce: 0, densidade: 0.001, inflamavel: false,
    nivelMinimo: 3, ocupa: [1, 1], sprite: [1.5, 0.9],
    biomas: [], maisEm: { montanha: 6, pico: 4, vulcao: 5, rio: 3 },
    nuncaEm: NADA_NO_GELO,
  },
  {
    id: 'gema', nome: 'veio de gemas', cor: [126, 92, 186], rende: 'gema', porColheita: 2,
    quantidade: 18, recresce: 0, densidade: 0.0005, inflamavel: false,
    nivelMinimo: 3, ocupa: [1, 1], sprite: [1.5, 0.9],
    biomas: [], maisEm: { montanha: 6, pico: 5, vulcao: 6 },
    nuncaEm: NADA_NO_GELO,
  },
]);

export const R = Object.fromEntries(
  recursos.todos().map((r) => [r.id, recursos.indice(r.id)]),
) as Record<string, number>;

// ------------------------------------------------------------------- tabelas
const N = recursos.tamanho;

/**
 * Densidade de cada recurso em cada bioma, já com `maisEm` e `nuncaEm`
 * aplicados. Zero quer dizer "não nasce aqui".
 *
 * Fica numa tabela só, e não espalhado em duas contas iguais, porque a
 * pergunta "este recurso pode existir neste chão?" tem dois clientes: a geração
 * do mundo e a rebrota. Enquanto cada um tinha a sua versão, a rebrota
 * simplesmente copiava a planta do vizinho — e bastava um arbusto na fronteira
 * para nascer palmeira na neve.
 */
export const REC_DENSIDADE_NO_BIOMA = (() => {
  const a = new Float32Array(N * biomas.tamanho);
  for (let r = 0; r < N; r++) {
    const def = recursos.porIndice(r);
    const nunca = new Set(def.nuncaEm ?? []);
    for (let b = 0; b < biomas.tamanho; b++) {
      const nome = biomas.porIndice(b).id;
      if (nunca.has(nome)) continue;
      if (def.biomas.length === 0) {
        // lista aberta: nasce em qualquer chão, mais farto onde `maisEm` diz
        a[r * biomas.tamanho + b] = def.densidade * (def.maisEm?.[nome] ?? 1);
      } else if (def.biomas.includes(nome)) {
        // fora do bioma-natal o povoamento é ralo: bosque, não mata fechada
        a[r * biomas.tamanho + b] = def.densidade * (nome === def.biomas[0] ? 1 : 0.3);
      }
    }
  }
  return a;
})();

/** Aquele recurso consegue nascer naquele bioma? */
export function recursoAceitaBioma(recurso: number, bioma: number): boolean {
  return REC_DENSIDADE_NO_BIOMA[recurso * biomas.tamanho + bioma] > 0;
}

export const REC_COR = (() => {
  const a = new Uint8Array(N * 3);
  for (let i = 0; i < N; i++) {
    const c = recursos.porIndice(i).cor;
    a[i * 3] = c[0];
    a[i * 3 + 1] = c[1];
    a[i * 3 + 2] = c[2];
  }
  return a;
})();

export const REC_QUANTIDADE = new Uint8Array(recursos.todos().map((r) => r.quantidade));
export const REC_RECRESCE = new Float32Array(recursos.todos().map((r) => r.recresce));
export const REC_POR_COLHEITA = new Float32Array(recursos.todos().map((r) => r.porColheita));
export const REC_INFLAMAVEL = new Uint8Array(recursos.todos().map((r) => (r.inflamavel ? 1 : 0)));
export const REC_NIVEL = new Uint8Array(recursos.todos().map((r) => r.nivelMinimo));
/**
 * [largura, altura] do desenho, em tiles. Aceita fração.
 *
 * Fração porque a escala do mundo é fina: a régua é a casa, de quatro tiles,
 * e a diferença entre uma árvore de 3 e uma de 3,4 muda a cara de um mapa
 * florestado inteiro. Em passo inteiro não dá para acertar isso.
 */
export const REC_SPRITE = new Float32Array(recursos.todos().flatMap((r) => [...r.sprite]));
/** Nome do material que cada recurso rende, por índice de recurso. */
export const REC_MATERIAL = recursos.todos().map((r) => r.rende);
/** Quais recursos servem de comida para bicho — usado pela busca de alimento. */
export const REC_COMIDA = new Uint8Array(
  recursos.todos().map((r) => (r.rende === 'comida' ? 1 : 0)),
);
export const TOTAL_RECURSOS = N;
