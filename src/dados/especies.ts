import { Registro, type Definicao } from '../core/registro.js';

/** Quantos ticks valem um "ano" de vida no relógio do jogo. */
export const TICKS_ANO = 400;

export type Dominio = 'terra' | 'agua' | 'ar';
export type Dieta = 'herbivoro' | 'carnivoro' | 'onivoro';
export type Categoria = 'animal' | 'civilizado' | 'monstro';

/**
 * Definição de uma espécie.
 *
 * Espécie nova = mais um objeto nesta lista. Nenhum sistema precisa ser tocado,
 * desde que ela use um dos cérebros já existentes (`animal`, `civilizado`,
 * `monstro`). Cérebro novo entra em `src/sim/ia.ts`.
 */
export interface Especie extends Definicao {
  readonly nome: string;
  readonly plural: string;
  readonly categoria: Categoria;
  /**
   * Ser inteligente ou bicho.
   *
   * É a divisão principal do jogo. O não-inteligente tem um objetivo só:
   * continuar vivo e deixar filhotes — come fruta ou caça, foge de quem o come
   * e procura par da própria espécie. O inteligente faz tudo isso e ainda
   * funda aldeia, derruba árvore, minera, fabrica equipamento, comercia,
   * guerreia e faz aliança.
   *
   * É um campo próprio, e não uma consequência da categoria, para caber no
   * futuro um bicho que aprenda ou um monstro que se organize.
   */
  readonly inteligente: boolean;
  /** Qual rotina de decisão usa. Ver `CEREBROS` em `src/sim/ia.ts`. */
  readonly cerebro: 'animal' | 'inteligente' | 'monstro';
  readonly dominio: Dominio;
  /** Cores do sprite: corpo, detalhe, sombra. Hex 0xRRGGBB. */
  readonly cores: readonly [number, number, number];
  /**
   * Porte do bicho em tiles: [largura, altura] do desenho.
   *
   * Vale a proporção do mundo, não a do sprite. A referência é a casa, que tem
   * 3×4: um humano cabe em 1×2, um urso é largo e baixo, e um bicho pequeno
   * ocupa um tile só. Bicho maior que porta de casa fica errado na tela.
   */
  /**
   * [largura, altura] do desenho, em tiles. Aceita fração.
   *
   * A escala do mundo tem uma régua só: a **casa**, que ocupa 3×4. Comparando
   * com o WorldBox, uma pessoa fica em torno de um quarto da altura de uma
   * casa — e é por isso que os povos inteligentes andam por volta de 1,2 tile
   * e não de 3. Com o porte antigo, um elfo chegava à altura do telhado e o
   * mapa inteiro parecia feito de bonecos grandes demais para as suas casas.
   */
  readonly porte: readonly [number, number];
  /** Lado do sprite em pixels do mundo (2 a 6). Ainda usado para ordenar desenho. */
  readonly tamanho: number;
  /**
   * Molde do desenho. Quando ausente, é deduzido do domínio e do tamanho —
   * ver `formaDe()` em `src/render/sprites.ts`.
   */
  readonly forma?: 'quadrupede' | 'bipede' | 'peixe' | 'ave' | 'grande' | 'aranha' | 'dragao';
  /** Tiles por tick. 0.05 ≈ 1 tile por segundo em velocidade normal. */
  readonly velocidade: number;
  readonly vidaMax: number;
  readonly dano: number;
  /** Distância em tiles para enxergar presa, ameaça ou par. */
  readonly visao: number;
  readonly dieta: Dieta;
  /** Ids de espécies que esta caça. */
  readonly presas: readonly string[];
  /** Ids de espécies de quem esta foge. */
  readonly medoDe: readonly string[];
  /** 0..1 — chance de partir para cima em vez de ignorar. */
  readonly agressividade: number;
  /** Vida em ticks: [mínimo, máximo]. */
  readonly longevidade: readonly [number, number];
  /** Ticks de espera entre um filho e o próximo. */
  readonly esperaFilho: number;
  /** Quantos filhotes por vez. */
  readonly ninhada: readonly [number, number];
  /** Ids de biomas onde nasce e prospera. */
  readonly biomas: readonly string[];
  /** Peso relativo ao povoar o mundo. 0 = não nasce sozinho (só pelo jogador). */
  readonly frequencia: number;
  /**
   * Quantos vizinhos da mesma espécie já bastam para a criatura parar de se
   * reproduzir. É o freio ecológico: sem um valor por espécie, coelho e urso
   * teriam a mesma densidade máxima e o mapa viraria um tapete de javalis.
   * Ausente = usa `BAL.lotacaoLocal`.
   */
  readonly lotacaoMax?: number;
  /** Só para civilizados: dados do povo. */
  readonly povo?: {
    /** Cor do reino no mapa político. */
    readonly corReino: number;
    /** Bônus de biomas preferidos ao escolher onde fundar aldeia. */
    readonly prefereBiomas: readonly string[];
    /** Multiplicador de crescimento populacional. */
    readonly natalidade: number;
    /** Multiplicador de força militar. */
    readonly marcial: number;
    /** Peso de escolher guerra em vez de paz. */
    readonly beligerancia: number;
  };
}

export const especies = new Registro<Especie>('especies');

especies.registrarTodos([
  // ---------------------------------------------------------------- civilizados
  {
    id: 'humano', nome: 'humano', plural: 'humanos', categoria: 'civilizado', inteligente: true, cerebro: 'inteligente',
    dominio: 'terra', cores: [0xd9a066, 0x3f6ba8, 0x8f5b3a], porte: [0.75, 1.05], tamanho: 3, velocidade: 0.055,
    vidaMax: 100, dano: 12, visao: 14, dieta: 'onivoro', presas: ['coelho', 'veado', 'ovelha', 'javali', 'peixe'],
    medoDe: [], agressividade: 0.35, longevidade: [9000, 15000], esperaFilho: 1400, ninhada: [1, 2],
    biomas: ['planicie', 'floresta', 'savana', 'praia'], frequencia: 1, lotacaoMax: 30,
    povo: { corReino: 0x4a7ec8, prefereBiomas: ['planicie', 'savana', 'praia'], natalidade: 1.15, marcial: 1, beligerancia: 0.5 },
  },
  {
    id: 'elfo', nome: 'elfo', plural: 'elfos', categoria: 'civilizado', inteligente: true, cerebro: 'inteligente',
    dominio: 'terra', cores: [0xe8d5a8, 0x4f9e5c, 0x9a8c60], porte: [0.75, 1.15], tamanho: 3, velocidade: 0.065,
    vidaMax: 90, dano: 14, visao: 18, dieta: 'herbivoro', presas: ['coelho', 'veado'],
    medoDe: [], agressividade: 0.25, longevidade: [16000, 26000], esperaFilho: 1700, ninhada: [1, 2],
    biomas: ['floresta', 'selva'], frequencia: 1, lotacaoMax: 30,
    povo: { corReino: 0x4fbf72, prefereBiomas: ['floresta', 'selva'], natalidade: 0.95, marcial: 1.05, beligerancia: 0.3 },
  },
  {
    id: 'anao', nome: 'anão', plural: 'anões', categoria: 'civilizado', inteligente: true, cerebro: 'inteligente',
    dominio: 'terra', cores: [0xc98f5e, 0x9b4b3a, 0x6d4630], porte: [0.7, 0.9], tamanho: 3, velocidade: 0.045,
    vidaMax: 130, dano: 16, visao: 11, dieta: 'onivoro', presas: ['coelho', 'javali'],
    medoDe: [], agressividade: 0.4, longevidade: [12000, 20000], esperaFilho: 2000, ninhada: [1, 2],
    biomas: ['montanha', 'taiga', 'tundra'], frequencia: 1, lotacaoMax: 30,
    povo: { corReino: 0xd2a24c, prefereBiomas: ['montanha', 'taiga', 'tundra'], natalidade: 0.9, marcial: 1.25, beligerancia: 0.45 },
  },
  {
    id: 'orc', nome: 'orc', plural: 'orcs', categoria: 'civilizado', inteligente: true, cerebro: 'inteligente',
    dominio: 'terra', cores: [0x7fa05a, 0x54341f, 0x4d6337], porte: [0.9, 1.25], tamanho: 4, velocidade: 0.05,
    vidaMax: 145, dano: 20, visao: 12, dieta: 'carnivoro', presas: ['coelho', 'veado', 'ovelha', 'javali', 'humano', 'elfo', 'anao'],
    medoDe: [], agressividade: 0.85, longevidade: [7000, 12000], esperaFilho: 1100, ninhada: [1, 3],
    biomas: ['savana', 'pantano', 'deserto', 'selva'], frequencia: 1, lotacaoMax: 30,
    povo: { corReino: 0xc4553f, prefereBiomas: ['savana', 'pantano', 'selva'], natalidade: 1.15, marcial: 1.18, beligerancia: 0.9 },
  },

  // -------------------------------------------------------------------- animais
  {
    id: 'coelho', nome: 'coelho', plural: 'coelhos', categoria: 'animal', inteligente: false, cerebro: 'animal',
    dominio: 'terra', cores: [0xd8cdbc, 0xf2ece2, 0x8d8477], porte: [0.6, 0.5], tamanho: 2, velocidade: 0.075,
    vidaMax: 18, dano: 1, visao: 10, dieta: 'herbivoro', presas: [],
    medoDe: ['lobo', 'raposa', 'urso', 'tigre', 'cobra', 'humano', 'orc', 'aranha_gigante', 'zumbi'],
    agressividade: 0, longevidade: [1400, 2400], esperaFilho: 300, ninhada: [2, 5],
    biomas: ['planicie', 'floresta', 'savana'], frequencia: 3.4, lotacaoMax: 22,
  },
  {
    id: 'ovelha', nome: 'ovelha', plural: 'ovelhas', categoria: 'animal', inteligente: false, cerebro: 'animal',
    dominio: 'terra', cores: [0xece7dd, 0x3a352f, 0xb3ada2], porte: [0.85, 0.7], tamanho: 3, velocidade: 0.04,
    vidaMax: 40, dano: 1, visao: 8, dieta: 'herbivoro', presas: [],
    medoDe: ['lobo', 'urso', 'tigre', 'humano', 'orc', 'zumbi'],
    agressividade: 0, longevidade: [2400, 3800], esperaFilho: 400, ninhada: [1, 3],
    biomas: ['planicie', 'savana'], frequencia: 2.6, lotacaoMax: 11,
  },
  {
    id: 'veado', nome: 'veado', plural: 'veados', categoria: 'animal', inteligente: false, cerebro: 'animal',
    dominio: 'terra', cores: [0xa4703f, 0xe0cdb4, 0x6b4726], porte: [0.9, 1.0], tamanho: 3, velocidade: 0.08,
    vidaMax: 45, dano: 3, visao: 14, dieta: 'herbivoro', presas: [],
    medoDe: ['lobo', 'urso', 'tigre', 'humano', 'elfo', 'orc', 'zumbi'],
    agressividade: 0, longevidade: [2600, 4200], esperaFilho: 380, ninhada: [1, 3],
    biomas: ['floresta', 'planicie', 'taiga'], frequencia: 3.2, lotacaoMax: 13,
  },
  {
    id: 'javali', nome: 'javali', plural: 'javalis', categoria: 'animal', inteligente: false, cerebro: 'animal',
    dominio: 'terra', cores: [0x5c4634, 0x2f2620, 0x3d2f24], porte: [1.0, 0.7], tamanho: 3, velocidade: 0.055,
    vidaMax: 60, dano: 10, visao: 9, dieta: 'onivoro', presas: ['coelho'],
    medoDe: ['urso', 'tigre'], agressividade: 0.45, longevidade: [2200, 3600], esperaFilho: 600, ninhada: [2, 4],
    biomas: ['floresta', 'selva', 'pantano'], frequencia: 1.5, lotacaoMax: 5,
  },
  {
    id: 'pinguim', nome: 'pinguim', plural: 'pinguins', categoria: 'animal', inteligente: false, cerebro: 'animal',
    dominio: 'terra', cores: [0x232830, 0xf0f2f5, 0xe0a020], porte: [0.55, 0.75], tamanho: 2, velocidade: 0.035,
    vidaMax: 25, dano: 2, visao: 8, dieta: 'onivoro', presas: ['peixe'],
    medoDe: ['urso'], agressividade: 0.05, longevidade: [2000, 3200], esperaFilho: 640, ninhada: [1, 2],
    biomas: ['neve', 'tundra'], frequencia: 1.4, lotacaoMax: 8,
  },
  {
    id: 'lobo', nome: 'lobo', plural: 'lobos', categoria: 'animal', inteligente: false, cerebro: 'animal',
    dominio: 'terra', cores: [0x6d7278, 0x3a3d42, 0x4b5057], porte: [1.0, 0.7], tamanho: 3, velocidade: 0.085,
    vidaMax: 55, dano: 14, visao: 16, dieta: 'carnivoro', presas: ['coelho', 'ovelha', 'veado', 'pinguim'],
    medoDe: ['urso'], agressividade: 0.8, longevidade: [2600, 4200], esperaFilho: 760, ninhada: [1, 3],
    biomas: ['floresta', 'taiga', 'tundra'], frequencia: 1, lotacaoMax: 3,
  },
  {
    id: 'raposa', nome: 'raposa', plural: 'raposas', categoria: 'animal', inteligente: false, cerebro: 'animal',
    dominio: 'terra', cores: [0xc26a2e, 0xf0e6dc, 0x8c4a20], porte: [0.85, 0.6], tamanho: 2, velocidade: 0.09,
    vidaMax: 28, dano: 7, visao: 13, dieta: 'carnivoro', presas: ['coelho', 'passaro'],
    medoDe: ['lobo', 'urso'], agressividade: 0.6, longevidade: [2000, 3200], esperaFilho: 470, ninhada: [1, 3],
    biomas: ['planicie', 'floresta', 'taiga'], frequencia: 1.1, lotacaoMax: 3,
  },
  {
    id: 'urso', nome: 'urso', plural: 'ursos', categoria: 'animal', inteligente: false, cerebro: 'animal',
    dominio: 'terra', cores: [0x584231, 0x33271d, 0x3f3024], porte: [1.3, 1.0], tamanho: 4, velocidade: 0.05,
    vidaMax: 130, dano: 26, visao: 13, dieta: 'onivoro', presas: ['coelho', 'ovelha', 'veado', 'javali', 'lobo', 'peixe', 'pinguim', 'humano', 'elfo', 'anao', 'orc'],
    medoDe: [], agressividade: 0.7, longevidade: [3600, 5600], esperaFilho: 1150, ninhada: [1, 2],
    biomas: ['floresta', 'taiga', 'montanha'], frequencia: 0.6, lotacaoMax: 2,
  },
  {
    id: 'tigre', nome: 'tigre', plural: 'tigres', categoria: 'animal', inteligente: false, cerebro: 'animal',
    dominio: 'terra', cores: [0xd88a2c, 0x2a1c12, 0xa5641c], porte: [1.3, 0.85], tamanho: 4, velocidade: 0.095,
    vidaMax: 105, dano: 30, visao: 17, dieta: 'carnivoro', presas: ['veado', 'javali', 'ovelha', 'coelho', 'humano', 'elfo', 'orc'],
    medoDe: [], agressividade: 0.85, longevidade: [3200, 5000], esperaFilho: 840, ninhada: [1, 2],
    biomas: ['selva', 'floresta'], frequencia: 0.5, lotacaoMax: 2,
  },
  {
    id: 'cobra', nome: 'cobra', plural: 'cobras', categoria: 'animal', inteligente: false, cerebro: 'animal',
    dominio: 'terra', cores: [0x6f8b3a, 0x2e3a18, 0x94ac54], porte: [0.9, 0.4], tamanho: 2, velocidade: 0.045,
    vidaMax: 20, dano: 16, visao: 7, dieta: 'carnivoro', presas: ['coelho', 'passaro'],
    medoDe: [], agressividade: 0.5, longevidade: [1800, 3000], esperaFilho: 520, ninhada: [1, 3],
    biomas: ['deserto', 'selva', 'savana', 'pantano'], frequencia: 1.2, lotacaoMax: 3,
  },
  {
    id: 'peixe', nome: 'peixe', plural: 'peixes', categoria: 'animal', inteligente: false, cerebro: 'animal',
    dominio: 'agua', cores: [0x8fc8d8, 0xe6f2f5, 0x4d8a9c], porte: [0.7, 0.4], tamanho: 2, velocidade: 0.06,
    vidaMax: 10, dano: 0, visao: 8, dieta: 'herbivoro', presas: [],
    medoDe: ['tubarao', 'pinguim'], agressividade: 0, longevidade: [1100, 1900], esperaFilho: 620, ninhada: [1, 3],
    biomas: ['oceano', 'raso', 'rio'], frequencia: 2.8, lotacaoMax: 26,
  },
  {
    id: 'tubarao', nome: 'tubarão', plural: 'tubarões', categoria: 'animal', inteligente: false, cerebro: 'animal',
    dominio: 'agua', cores: [0x5a6b78, 0xe8eef2, 0x39454e], porte: [1.4, 0.6], tamanho: 4, velocidade: 0.085,
    vidaMax: 95, dano: 28, visao: 16, dieta: 'carnivoro', presas: ['peixe', 'pinguim'],
    medoDe: [], agressividade: 0.85, longevidade: [3000, 4800], esperaFilho: 700, ninhada: [1, 2],
    biomas: ['oceano', 'oceano_profundo'], frequencia: 0.7, lotacaoMax: 2,
  },
  {
    id: 'passaro', nome: 'pássaro', plural: 'pássaros', categoria: 'animal', inteligente: false, cerebro: 'animal',
    dominio: 'ar', cores: [0x4d7fb8, 0xdfe8f0, 0x2f5480], porte: [0.6, 0.5], tamanho: 2, velocidade: 0.11,
    vidaMax: 8, dano: 1, visao: 12, dieta: 'herbivoro', presas: [],
    medoDe: ['raposa', 'cobra', 'dragao'], agressividade: 0, longevidade: [1100, 1800], esperaFilho: 650, ninhada: [1, 2],
    biomas: ['planicie', 'floresta', 'selva', 'savana', 'praia'], frequencia: 1.5, lotacaoMax: 7,
  },

  // ------------------------------------------------------------------- monstros
  {
    id: 'dragao', nome: 'dragão', plural: 'dragões', categoria: 'monstro', inteligente: false, cerebro: 'monstro',
    dominio: 'ar', cores: [0xa32f2f, 0xe08a3a, 0x5e1a1a], porte: [2.6, 1.8], tamanho: 6, velocidade: 0.1,
    vidaMax: 900, dano: 90, visao: 26, dieta: 'carnivoro',
    presas: ['humano', 'elfo', 'anao', 'orc', 'ovelha', 'veado', 'javali', 'urso', 'tigre', 'lobo'],
    medoDe: [], agressividade: 1, longevidade: [40000, 80000], esperaFilho: 12000, ninhada: [1, 1],
    biomas: ['montanha', 'pico'], frequencia: 0, lotacaoMax: 1,
  },
  {
    id: 'aranha_gigante', nome: 'aranha gigante', plural: 'aranhas gigantes', categoria: 'monstro', inteligente: false, cerebro: 'monstro',
    dominio: 'terra', cores: [0x3d2f42, 0x8f3f6a, 0x241a28], porte: [1.0, 0.7], tamanho: 4, velocidade: 0.07,
    vidaMax: 120, dano: 34, visao: 15, dieta: 'carnivoro',
    presas: ['humano', 'elfo', 'anao', 'orc', 'coelho', 'veado', 'ovelha', 'javali'],
    medoDe: [], agressividade: 1, longevidade: [5000, 9000], esperaFilho: 1600, ninhada: [1, 3],
    biomas: ['selva', 'pantano', 'floresta'], frequencia: 0, lotacaoMax: 4,
  },
  {
    id: 'zumbi', nome: 'zumbi', plural: 'zumbis', categoria: 'monstro', inteligente: false, cerebro: 'monstro',
    dominio: 'terra', cores: [0x6b8757, 0x3a4a2e, 0x8a5a4a], porte: [0.75, 1.05], tamanho: 3, velocidade: 0.03,
    vidaMax: 70, dano: 18, visao: 11, dieta: 'carnivoro',
    presas: ['humano', 'elfo', 'anao', 'orc', 'ovelha', 'veado', 'coelho', 'javali'],
    medoDe: [], agressividade: 1, longevidade: [2600, 4200], esperaFilho: 1e9, ninhada: [0, 0],
    biomas: [], frequencia: 0, lotacaoMax: 30,
  },
]);

/** Atalhos de índice para os laços quentes. */
export const E = Object.fromEntries(
  especies.todos().map((e) => [e.id, especies.indice(e.id)]),
) as Record<string, number>;

// ---------------------------------------------------------------------- tabelas
// Montadas uma vez no boot. Consultar objeto dentro do laço de IA custa caro;
// consultar Float32Array/Uint8Array por índice não custa quase nada.

const N = especies.tamanho;

export const ESP_VELOCIDADE = new Float32Array(N);
export const ESP_VIDA = new Float32Array(N);
export const ESP_DANO = new Float32Array(N);
export const ESP_VISAO = new Float32Array(N);
export const ESP_AGRESSAO = new Float32Array(N);
export const ESP_TAMANHO = new Uint8Array(N);
/**
 * [largura, altura] do desenho em tiles, achatado: `ESP_PORTE[i * 2]` e `+1`.
 *
 * É `Float32Array` e não inteiro porque a régua da escala é a **casa**, de
 * quatro tiles de altura, e uma pessoa tem de ficar perto de um quarto dela.
 * Em passo inteiro não existe esse tamanho: ou a pessoa tinha um tile e ficava
 * do tamanho de um coelho, ou tinha dois e chegava na metade do telhado.
 */
export const ESP_PORTE = new Float32Array(N * 2);
export const ESP_ESPERA_FILHO = new Float32Array(N);
export const ESP_CIVILIZADO = new Uint8Array(N);
export const ESP_INTELIGENTE = new Uint8Array(N);
export const ESP_MONSTRO = new Uint8Array(N);
export const ESP_DOMINIO = new Uint8Array(N); // 0 terra, 1 água, 2 ar
export const ESP_HERBIVORO = new Uint8Array(N);
/** Multiplicadores do povo. Valem 1 para quem não é civilizado. */
export const ESP_NATALIDADE = new Float32Array(N).fill(1);
export const ESP_MARCIAL = new Float32Array(N).fill(1);
export const ESP_LOTACAO = new Float32Array(N);
/**
 * Quão rápido a fome sobe, por dieta.
 *
 * Carnívoro come pouca vez e muito: se ele sentisse fome no mesmo ritmo de um
 * herbívoro, precisaria de uma caçada bem-sucedida a cada poucos minutos, e
 * como caçada falha, todo predador especialista acabava extinto enquanto o
 * onívoro — que sempre tem pasto de reserva — tomava o mapa.
 */
export const ESP_METABOLISMO = new Float32Array(N);
/** Matriz N×N: `ESP_CACA[caçador * N + presa]` = 1 quando caçador come presa. */
export const ESP_CACA = new Uint8Array(N * N);
/** Matriz N×N: `ESP_MEDO[quem * N + de]` = 1 quando "quem" foge de "de". */
export const ESP_MEDO = new Uint8Array(N * N);

for (let i = 0; i < N; i++) {
  const e = especies.porIndice(i);
  ESP_VELOCIDADE[i] = e.velocidade;
  ESP_VIDA[i] = e.vidaMax;
  ESP_DANO[i] = e.dano;
  ESP_VISAO[i] = e.visao;
  ESP_AGRESSAO[i] = e.agressividade;
  ESP_TAMANHO[i] = e.tamanho;
  ESP_PORTE[i * 2] = e.porte[0];
  ESP_PORTE[i * 2 + 1] = e.porte[1];
  ESP_ESPERA_FILHO[i] = e.esperaFilho;
  ESP_LOTACAO[i] = e.lotacaoMax ?? 16;
  ESP_METABOLISMO[i] =
    e.dieta === 'carnivoro' ? 0.5 : e.dieta === 'onivoro' ? 0.78 : 1;
  ESP_CIVILIZADO[i] = e.categoria === 'civilizado' ? 1 : 0;
  ESP_INTELIGENTE[i] = e.inteligente ? 1 : 0;
  ESP_MONSTRO[i] = e.categoria === 'monstro' ? 1 : 0;
  ESP_DOMINIO[i] = e.dominio === 'terra' ? 0 : e.dominio === 'agua' ? 1 : 2;
  ESP_HERBIVORO[i] = e.dieta === 'herbivoro' || e.dieta === 'onivoro' ? 1 : 0;
  if (e.povo) {
    ESP_NATALIDADE[i] = e.povo.natalidade;
    ESP_MARCIAL[i] = e.povo.marcial;
  }
  for (const p of e.presas) {
    const j = especies.talvez(p);
    if (j) ESP_CACA[i * N + especies.indice(p)] = 1;
  }
  for (const m of e.medoDe) {
    const j = especies.talvez(m);
    if (j) ESP_MEDO[i * N + especies.indice(m)] = 1;
  }
}

export const TOTAL_ESPECIES = N;

/** Espécies que o povoamento inicial usa, com os pesos declarados. */
export const ESPECIES_SELVAGENS = especies
  .filtrar((e) => e.frequencia > 0 && e.categoria === 'animal')
  .map((e) => especies.indice(e.id));

export const ESPECIES_CIVILIZADAS = especies
  .filtrar((e) => e.categoria === 'civilizado')
  .map((e) => especies.indice(e.id));
