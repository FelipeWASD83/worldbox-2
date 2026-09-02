import { Registro, type Definicao } from '../core/registro.js';

/**
 * Biomas do mundo.
 *
 * A ordem importa: o índice é o que fica guardado em `grid.bioma`, e os saves
 * antigos guardam o id de texto. Bioma novo deve ser acrescentado no fim.
 */
export interface Bioma extends Definicao {
  readonly nome: string;
  /** Cor base do tile, em RGB 0..255. */
  readonly cor: readonly [number, number, number];
  /** Quanto a cor varia de tile para tile (dá textura sem imagem). */
  readonly variacao: number;
  readonly agua: boolean;
  /** 0..1 — quão rápido a vegetação cresce aqui. */
  readonly fertilidade: number;
  /** 0..1 — quão bem o fogo pega. */
  readonly inflamavel: number;
  /** 0..1 — quão atraente é para uma civilização se assentar. 0 = nunca. */
  readonly habitavel: number;
}

export const biomas = new Registro<Bioma>('biomas');

biomas.registrarTodos([
  { id: 'oceano_profundo', nome: 'oceano profundo', cor: [21, 44, 84], variacao: 6, agua: true, fertilidade: 0.15, inflamavel: 0, habitavel: 0 },
  { id: 'oceano', nome: 'oceano', cor: [32, 72, 128], variacao: 8, agua: true, fertilidade: 0.3, inflamavel: 0, habitavel: 0 },
  { id: 'raso', nome: 'água rasa', cor: [58, 116, 176], variacao: 10, agua: true, fertilidade: 0.45, inflamavel: 0, habitavel: 0 },
  { id: 'rio', nome: 'rio', cor: [64, 124, 186], variacao: 8, agua: true, fertilidade: 0.6, inflamavel: 0, habitavel: 0 },
  // Lago é água parada: mais escuro que o rio, mais claro que o oceano, e com
  // menos variação de cor — corrente é o que faz a água do rio cintilar.
  { id: 'lago', nome: 'lago', cor: [52, 104, 162], variacao: 5, agua: true, fertilidade: 0.7, inflamavel: 0, habitavel: 0 },
  { id: 'praia', nome: 'praia', cor: [214, 197, 141], variacao: 10, agua: false, fertilidade: 0.15, inflamavel: 0.05, habitavel: 0.35 },
  { id: 'deserto', nome: 'deserto', cor: [206, 178, 116], variacao: 12, agua: false, fertilidade: 0.06, inflamavel: 0.1, habitavel: 0.15 },
  { id: 'savana', nome: 'savana', cor: [155, 158, 82], variacao: 12, agua: false, fertilidade: 0.4, inflamavel: 0.8, habitavel: 0.6 },
  { id: 'planicie', nome: 'planície', cor: [104, 145, 72], variacao: 12, agua: false, fertilidade: 0.85, inflamavel: 0.5, habitavel: 1 },
  { id: 'floresta', nome: 'floresta', cor: [62, 105, 56], variacao: 12, agua: false, fertilidade: 1, inflamavel: 0.9, habitavel: 0.8 },
  { id: 'selva', nome: 'selva', cor: [42, 92, 48], variacao: 14, agua: false, fertilidade: 1, inflamavel: 0.6, habitavel: 0.45 },
  { id: 'pantano', nome: 'pântano', cor: [72, 88, 62], variacao: 12, agua: false, fertilidade: 0.75, inflamavel: 0.2, habitavel: 0.25 },
  { id: 'taiga', nome: 'taiga', cor: [58, 92, 78], variacao: 10, agua: false, fertilidade: 0.6, inflamavel: 0.7, habitavel: 0.55 },
  { id: 'tundra', nome: 'tundra', cor: [130, 138, 122], variacao: 10, agua: false, fertilidade: 0.25, inflamavel: 0.2, habitavel: 0.3 },
  { id: 'neve', nome: 'neve', cor: [226, 232, 238], variacao: 8, agua: false, fertilidade: 0.08, inflamavel: 0.05, habitavel: 0.15 },
  { id: 'montanha', nome: 'montanha', cor: [118, 116, 116], variacao: 12, agua: false, fertilidade: 0.15, inflamavel: 0.1, habitavel: 0.2 },
  { id: 'pico', nome: 'pico nevado', cor: [242, 244, 248], variacao: 6, agua: false, fertilidade: 0, inflamavel: 0, habitavel: 0 },
  // Lava e terra queimada com `inflamavel: 0` não é detalhe de balanço: com
  // qualquer valor acima de zero elas reacendem sozinhas para sempre — a lava
  // porque nunca vira cinza, a cinza porque volta a queimar o que já queimou —
  // e um único raio acabava incendiando o mundo inteiro sem nunca se apagar.
  { id: 'lava', nome: 'lava', cor: [206, 78, 30], variacao: 20, agua: false, fertilidade: 0, inflamavel: 0, habitavel: 0 },
  { id: 'cinzas', nome: 'terra queimada', cor: [56, 50, 48], variacao: 8, agua: false, fertilidade: 0.35, inflamavel: 0, habitavel: 0.4 },
  { id: 'campo_fertil', nome: 'campo fértil', cor: [86, 132, 62], variacao: 12, agua: false, fertilidade: 1, inflamavel: 0.55, habitavel: 1 },
  { id: 'mangue', nome: 'mangue', cor: [58, 82, 66], variacao: 12, agua: false, fertilidade: 0.85, inflamavel: 0.25, habitavel: 0.3 },
  { id: 'oasis', nome: 'oásis', cor: [96, 142, 96], variacao: 12, agua: false, fertilidade: 0.7, inflamavel: 0.3, habitavel: 0.55 },
  { id: 'terra_rachada', nome: 'terra rachada', cor: [162, 116, 84], variacao: 14, agua: false, fertilidade: 0.05, inflamavel: 0.1, habitavel: 0.1 },
  { id: 'gelo', nome: 'gelo marinho', cor: [206, 224, 236], variacao: 8, agua: false, fertilidade: 0, inflamavel: 0, habitavel: 0.05 },
  { id: 'vulcao', nome: 'vulcão', cor: [74, 58, 56], variacao: 14, agua: false, fertilidade: 0.05, inflamavel: 0.4, habitavel: 0.05 },
]);

/** Atalhos numéricos — usados nos laços quentes da simulação. */
export const B = {
  oceano_profundo: biomas.indice('oceano_profundo'),
  oceano: biomas.indice('oceano'),
  raso: biomas.indice('raso'),
  rio: biomas.indice('rio'),
  lago: biomas.indice('lago'),
  praia: biomas.indice('praia'),
  deserto: biomas.indice('deserto'),
  savana: biomas.indice('savana'),
  planicie: biomas.indice('planicie'),
  floresta: biomas.indice('floresta'),
  selva: biomas.indice('selva'),
  pantano: biomas.indice('pantano'),
  taiga: biomas.indice('taiga'),
  tundra: biomas.indice('tundra'),
  neve: biomas.indice('neve'),
  montanha: biomas.indice('montanha'),
  pico: biomas.indice('pico'),
  lava: biomas.indice('lava'),
  cinzas: biomas.indice('cinzas'),
  campo_fertil: biomas.indice('campo_fertil'),
  mangue: biomas.indice('mangue'),
  oasis: biomas.indice('oasis'),
  terra_rachada: biomas.indice('terra_rachada'),
  gelo: biomas.indice('gelo'),
  vulcao: biomas.indice('vulcao'),
} as const;

/** Tabelas planas, montadas uma vez, para o laço de simulação não fazer lookup. */
export const BIOMA_AGUA = new Uint8Array(biomas.todos().map((b) => (b.agua ? 1 : 0)));
export const BIOMA_FERTIL = new Float32Array(biomas.todos().map((b) => b.fertilidade));
export const BIOMA_INFLAMAVEL = new Float32Array(biomas.todos().map((b) => b.inflamavel));
export const BIOMA_HABITAVEL = new Float32Array(biomas.todos().map((b) => b.habitavel));
export const BIOMA_COR = (() => {
  const t = biomas.todos();
  const a = new Uint8Array(t.length * 3);
  for (let i = 0; i < t.length; i++) {
    a[i * 3] = t[i].cor[0];
    a[i * 3 + 1] = t[i].cor[1];
    a[i * 3 + 2] = t[i].cor[2];
  }
  return a;
})();
export const BIOMA_VARIACAO = new Uint8Array(biomas.todos().map((b) => b.variacao));
