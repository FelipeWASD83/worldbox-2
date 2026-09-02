import { Registro, type Definicao } from '../core/registro.js';

/**
 * Construções das civilizações.
 *
 * Em `grid.construcao` fica o índice + 1 (0 significa "tile vazio"), então há
 * espaço para 254 tipos antes de precisar mudar o tipo do array.
 */
export interface Edificio extends Definicao {
  readonly nome: string;
  /** Cor no mapa, RGB 0..255. */
  readonly cor: readonly [number, number, number];
  /** Madeira e pedra gastas para erguer. */
  readonly custoMadeira: number;
  readonly custoPedra: number;
  /** Quantos moradores a mais a aldeia suporta. */
  readonly abriga: number;
  /** Resistência a fogo e ataque. */
  readonly resistencia: number;
  /** Nível mínimo da aldeia para poder construir. */
  readonly nivelMinimo: number;
  /** Multiplica o que os lenhadores trazem. */
  readonly bonusMadeira?: number;
  /** Multiplica o que os mineiros trazem (pedra, ferro, carvão, ouro). */
  readonly bonusMinerio?: number;
  /** Multiplica o que vem da lavoura e da coleta de fruta. */
  readonly bonusComida?: number;
  /** Teto de qualidade do equipamento que a aldeia sabe fabricar. */
  readonly forja?: number;
  /** Permite comprar e vender com outras aldeias. */
  readonly comercio?: boolean;
  /** Moral que o prédio devolve por avaliação. */
  readonly moral?: number;
  /** Quantos deste tipo a aldeia aproveita (o excedente não faz efeito). */
  readonly maximo?: number;
  /** Tiles tomados no chão: [largura, profundidade]. */
  readonly ocupa: readonly [number, number];
  /** Tamanho do desenho em tiles: [largura, altura]. Telhado e torre sobem daqui. */
  readonly sprite: readonly [number, number];
  /** Planta lavoura nos tiles em volta quando é erguido. */
  readonly semeiaEmVolta?: number;
  /** Só este tipo pode ser erguido em rocha — é o caso da mina. */
  readonly aceitaMontanha?: boolean;
  /**
   * Acidente do terreno, e não obra de ninguém.
   *
   * Mora na camada das construções porque precisa de tile-âncora e de
   * desenho alto, mas não é levantado por aldeia nenhuma e não vem abaixo:
   * nem por meteoro, nem pela própria lava que cospe, nem quando a aldeia
   * que o cercou é destruída. Esse último caso não passava por `derrubar` e
   * apagava o vulcão calado — daí a regra morar aqui, num lugar só, em vez
   * de virar um `if` repetido em cada sítio que limpa o mapa.
   */
  readonly natural?: boolean;
  /**
   * Precisa de água encostada para existir. É o caso do porto.
   *
   * Não é o contrário de `aceitaMontanha`: o porto continua sendo erguido em
   * chão firme, e o que esta marca exige é que **haja mar ou lago colado nele**.
   * Sem isso, a aldeia levantava o porto no meio do continente.
   */
  readonly naAgua?: boolean;
  /**
   * Marco da cidade, sem efeito mecânico ainda.
   *
   * Prefeitura, banco, biblioteca, taverna, quartel e poço existem no mapa, custam
   * material e aparecem na ficha da aldeia, mas ainda não fazem nada — eles são
   * o gancho da próxima atualização, a de política e civilizações, onde cada um
   * ganha a sua função (governo, tesouro, conhecimento, ânimo e tropa).
   */
  readonly marco?: boolean;
  /** Quantos moradores dormem dentro. Casa é o que permite haver filho. */
  readonly moradia?: number;
}

export const edificios = new Registro<Edificio>('edificios');

edificios.registrarTodos([
  { id: 'casa', nome: 'casa', cor: [150, 96, 62], custoMadeira: 10, custoPedra: 0, abriga: 4, resistencia: 20, nivelMinimo: 1, ocupa: [2, 2], sprite: [3, 3.6], moradia: 4 },
  { id: 'celeiro', nome: 'celeiro', cor: [176, 138, 74], custoMadeira: 18, custoPedra: 4, abriga: 0, resistencia: 25, nivelMinimo: 1, ocupa: [3, 2], sprite: [3, 2.6] },
  { id: 'fazenda', nome: 'fazenda', cor: [190, 176, 88], custoMadeira: 8, custoPedra: 0, abriga: 0, resistencia: 10, nivelMinimo: 1, ocupa: [2, 2], sprite: [2, 0.9] },
  { id: 'muralha', nome: 'muralha', cor: [128, 124, 118], custoMadeira: 4, custoPedra: 16, abriga: 0, resistencia: 90, nivelMinimo: 2, ocupa: [1, 1], sprite: [1, 1.6] },
  { id: 'torre', nome: 'torre de guarda', cor: [106, 102, 98], custoMadeira: 10, custoPedra: 24, abriga: 2, resistencia: 70, nivelMinimo: 2, ocupa: [1, 1], sprite: [1, 3.2] },
  { id: 'castelo', nome: 'castelo', cor: [92, 96, 108], custoMadeira: 40, custoPedra: 80, abriga: 12, resistencia: 160, nivelMinimo: 3, ocupa: [4, 3], sprite: [5, 5] },
  { id: 'serraria', nome: 'serraria', cor: [138, 104, 60], custoMadeira: 26, custoPedra: 6, abriga: 1, resistencia: 30, nivelMinimo: 2, ocupa: [3, 2], sprite: [3, 2.6], bonusMadeira: 0.5, maximo: 3 },
  { id: 'mina', nome: 'mina', cor: [92, 86, 82], custoMadeira: 22, custoPedra: 14, abriga: 1, resistencia: 40, nivelMinimo: 2, ocupa: [2, 2], sprite: [2, 2.5], bonusMinerio: 0.6, maximo: 3 , aceitaMontanha: true },
  { id: 'ferraria', nome: 'ferraria', cor: [110, 78, 66], custoMadeira: 20, custoPedra: 20, abriga: 1, resistencia: 45, nivelMinimo: 2, ocupa: [2, 2], sprite: [2, 2.5], forja: 3, maximo: 2 },
  { id: 'mercado', nome: 'mercado', cor: [186, 148, 78], custoMadeira: 30, custoPedra: 10, abriga: 2, resistencia: 25, nivelMinimo: 3, ocupa: [3, 2], sprite: [3, 2.6], comercio: true, maximo: 2 },
  { id: 'templo', nome: 'templo', cor: [206, 200, 186], custoMadeira: 18, custoPedra: 22, abriga: 2, resistencia: 60, nivelMinimo: 3, ocupa: [3, 3], sprite: [3, 4], moral: 2.5, maximo: 2 },
  { id: 'prefeitura', nome: 'prefeitura', cor: [190, 176, 150], custoMadeira: 26, custoPedra: 26, abriga: 3, resistencia: 110, nivelMinimo: 2, maximo: 1, ocupa: [2, 2], sprite: [3, 4], marco: true },
  { id: 'banco', nome: 'banco', cor: [176, 160, 96], custoMadeira: 24, custoPedra: 38, abriga: 2, resistencia: 120, nivelMinimo: 4, maximo: 1, ocupa: [2, 2], sprite: [3, 3.2], marco: true },
  { id: 'biblioteca', nome: 'biblioteca', cor: [162, 140, 168], custoMadeira: 26, custoPedra: 16, abriga: 2, resistencia: 60, nivelMinimo: 3, maximo: 1, ocupa: [2, 2], sprite: [3, 3.2], marco: true },
  { id: 'taverna', nome: 'taverna', cor: [160, 106, 62], custoMadeira: 32, custoPedra: 10, abriga: 3, resistencia: 40, nivelMinimo: 2, maximo: 2, ocupa: [2, 2], sprite: [3, 3.2], marco: true },
  { id: 'quartel', nome: 'quartel', cor: [110, 104, 92], custoMadeira: 22, custoPedra: 24, abriga: 4, resistencia: 100, nivelMinimo: 2, maximo: 2, ocupa: [2, 2], sprite: [3, 3.2], marco: true },
  { id: 'poco', nome: 'poço', cor: [130, 128, 126], custoMadeira: 6, custoPedra: 18, abriga: 0, resistencia: 50, nivelMinimo: 2, maximo: 2, ocupa: [1, 1], sprite: [1, 1.6], marco: true },
  { id: 'moinho', nome: 'moinho de vento', cor: [196, 178, 140], custoMadeira: 34, custoPedra: 12, abriga: 1, resistencia: 35, nivelMinimo: 2, bonusComida: 0.45, maximo: 3, ocupa: [2, 2], sprite: [3, 4.6], semeiaEmVolta: 3 },
  // O porto é a maior obra do jogo e a única que não serve para nada em terra:
  // ele existe para os barcos saírem dele. Só se ergue em praia ou à beira de
  // lago — rio, mesmo largo, não tem espaço para atracar.
  { id: 'porto', nome: 'porto', cor: [124, 96, 62], custoMadeira: 34, custoPedra: 12, abriga: 2, resistencia: 70, nivelMinimo: 2, maximo: 1, ocupa: [4, 3], sprite: [5, 3.4], naAgua: true },
  // O vulcão não é obra de ninguém: é acidente do terreno, e mora aqui pelo
  // mesmo motivo da ruína — precisa de um tile-âncora, de um desenho alto e de
  // entrar na varredura de profundidade junto com árvore e casa. Antes ele era
  // uma cratera pintada em dezenas de tiles, que de perto não se lia como
  // montanha de fogo nenhuma: só uma mancha escura com miolo vermelho.
  { id: 'vulcao', nome: 'vulcão', cor: [86, 62, 58], custoMadeira: 0, custoPedra: 0, abriga: 0, resistencia: 9999, nivelMinimo: 99, ocupa: [1, 1], sprite: [4.5, 3.2], aceitaMontanha: true, natural: true },
  { id: 'ruina', nome: 'ruína', cor: [72, 66, 62], custoMadeira: 0, custoPedra: 0, abriga: 0, resistencia: 5, nivelMinimo: 99, ocupa: [1, 1], sprite: [1, 1] },
]);

export const ED = {
  casa: edificios.indice('casa'),
  celeiro: edificios.indice('celeiro'),
  fazenda: edificios.indice('fazenda'),
  muralha: edificios.indice('muralha'),
  torre: edificios.indice('torre'),
  castelo: edificios.indice('castelo'),
  serraria: edificios.indice('serraria'),
  mina: edificios.indice('mina'),
  ferraria: edificios.indice('ferraria'),
  mercado: edificios.indice('mercado'),
  templo: edificios.indice('templo'),
  moinho: edificios.indice('moinho'),
  prefeitura: edificios.indice('prefeitura'),
  banco: edificios.indice('banco'),
  biblioteca: edificios.indice('biblioteca'),
  taverna: edificios.indice('taverna'),
  quartel: edificios.indice('quartel'),
  poco: edificios.indice('poco'),
  porto: edificios.indice('porto'),
  vulcao: edificios.indice('vulcao'),
  ruina: edificios.indice('ruina'),
} as const;

export const ED_COR = (() => {
  const t = edificios.todos();
  const a = new Uint8Array(t.length * 3);
  for (let i = 0; i < t.length; i++) {
    a[i * 3] = t[i].cor[0];
    a[i * 3 + 1] = t[i].cor[1];
    a[i * 3 + 2] = t[i].cor[2];
  }
  return a;
})();

export const ED_ABRIGA = new Uint8Array(edificios.todos().map((e) => e.abriga));
export const ED_RESISTENCIA = new Float32Array(edificios.todos().map((e) => e.resistencia));
export const ED_MAXIMO = new Int32Array(edificios.todos().map((e) => e.maximo ?? 999));
export const ED_OCUPA = new Uint8Array(edificios.todos().flatMap((e) => [...e.ocupa]));
export const ED_MONTANHA = new Uint8Array(
  edificios.todos().map((e) => (e.aceitaMontanha ? 1 : 0)),
);
/** O que não vem abaixo por nada. Ver `Edificio.natural`. */
export const ED_NATURAL = new Uint8Array(edificios.todos().map((e) => (e.natural ? 1 : 0)));
/** Quem precisa de água encostada. Ver `Edificio.naAgua`. */
export const ED_NA_AGUA = new Uint8Array(edificios.todos().map((e) => (e.naAgua ? 1 : 0)));
/** Quantos moradores cada prédio abriga para dormir (0 = não é moradia). */
export const ED_MORADIA = new Uint8Array(edificios.todos().map((e) => e.moradia ?? 0));
/** [largura, altura] do desenho, em tiles. Aceita fração — ver `REC_SPRITE`. */
export const ED_SPRITE = new Float32Array(edificios.todos().flatMap((e) => [...e.sprite]));
