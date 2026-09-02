import { Registro, type Definicao } from '../core/registro.js';

/**
 * Traços: o que faz um indivíduo ser diferente dos outros do mesmo povo.
 *
 * Até aqui, dois humanos da mesma aldeia eram numericamente idênticos. Espécie
 * decidia tudo — vida, dano, velocidade, longevidade — e a única diferença
 * entre duas pessoas era a idade e o que elas estavam fazendo no momento. Um
 * mundo assim não produz personagem nenhum: não há o guerreiro forte, o velho
 * sábio, o comerciante ganancioso, o rei imortal.
 *
 * Cada traço é **um bit** em `Criaturas.tracos`, no mesmo idioma de
 * `Criaturas.marcas`. Trinta e dois cabem num `Uint32Array`, o que custa quatro
 * bytes por criatura e nenhuma alocação — o mesmo desenho que permite dezenas
 * de milhares de seres vivos ao mesmo tempo.
 *
 * O que um traço faz são **multiplicadores** sobre campos que já existiam.
 * Nenhum traço abre mecânica nova: forte multiplica o dano que o combate já
 * calculava, sábio multiplica o conhecimento que o reino já acumulava. É o que
 * mantém o sistema barato e o que garante que traço novo não precise de código
 * novo — só de uma linha nesta tabela.
 *
 * Traços vêm em pares opostos (forte e franzino, sábio e tolo). Ninguém carrega
 * os dois: `opostos` é conferido na herança e na mutação.
 *
 * **Só os inteligentes têm traço.** Foi decisão do Felipe, e ela tem uma razão
 * prática além do escopo: traço é coisa que se lê na ficha de alguém, e ninguém
 * inspeciona os oitocentos coelhos do mapa.
 */
export interface Traco extends Definicao {
  readonly nome: string;
  readonly descricao: string;
  /** Peso relativo no sorteio. Quanto maior, mais comum. */
  readonly peso: number;
  /** Ids de traços que não podem coexistir com este. */
  readonly opostos?: readonly string[];

  // --------------------------------------------------------- multiplicadores
  /** Vida máxima. */
  readonly vida?: number;
  /** Dano em combate. */
  readonly dano?: number;
  /** Velocidade de deslocamento. */
  readonly velocidade?: number;
  /** Longevidade, sorteada no nascimento. */
  readonly longevidade?: number;
  /** Fome ganha por tick. Acima de 1 é quem come mais. */
  readonly fome?: number;
  /** Espera entre um filho e o próximo. Abaixo de 1 é quem tem mais filhos. */
  readonly espera?: number;
  /** Ouro que embolsa por trabalho entregue. */
  readonly ouro?: number;
  /** Lealdade ao próprio reino. */
  readonly lealdade?: number;
  /** Conhecimento que produz para o reino. */
  readonly conhecimento?: number;
  /** Peso na escolha de par. Quem tem mais é procurado primeiro. */
  readonly beleza?: number;

  // ------------------------------------------------------------------ marcas
  /** Não morre de velhice. */
  readonly imortal?: boolean;
  /** Não foge de briga por estar ferido. */
  readonly destemido?: boolean;
}

export const tracos = new Registro<Traco>('tracos');

tracos.registrarTodos([
  // ------------------------------------------------------------------- corpo
  {
    id: 'forte', nome: 'forte', peso: 10, opostos: ['franzino'],
    descricao: 'Bate mais forte e aguenta mais, mas não é dos mais rápidos.',
    dano: 1.4, vida: 1.18, velocidade: 0.95,
  },
  {
    id: 'franzino', nome: 'franzino', peso: 8, opostos: ['forte'],
    descricao: 'Pouco osso e pouca carne. Corre bem e apanha mal.',
    dano: 0.68, vida: 0.8, velocidade: 1.08,
  },
  {
    id: 'agil', nome: 'ágil', peso: 10, opostos: ['lento'],
    descricao: 'Anda muito mais que os outros. Chega antes em tudo.',
    velocidade: 1.32, dano: 0.95,
  },
  {
    id: 'lento', nome: 'lento', peso: 7, opostos: ['agil'],
    descricao: 'Demora a chegar em qualquer lugar, mas não se abala fácil.',
    velocidade: 0.72, vida: 1.12,
  },
  {
    id: 'gordo', nome: 'gordo', peso: 8, opostos: ['magro'],
    descricao: 'Come muito e anda pouco. Em compensação, resiste ao que derruba os outros.',
    fome: 1.45, velocidade: 0.86, vida: 1.22,
  },
  {
    id: 'magro', nome: 'magro', peso: 8, opostos: ['gordo'],
    descricao: 'Come pouco e se move bem. Um mau ano derruba primeiro os outros.',
    fome: 0.72, velocidade: 1.1, vida: 0.9,
  },
  {
    id: 'robusto', nome: 'robusto', peso: 7, opostos: ['doentio'],
    descricao: 'Envelhece devagar. Enterra os contemporâneos e continua trabalhando.',
    longevidade: 1.4, vida: 1.12,
  },
  {
    id: 'doentio', nome: 'doentio', peso: 6, opostos: ['robusto'],
    descricao: 'Vida curta e corpo frágil.',
    longevidade: 0.68, vida: 0.85,
  },

  // ------------------------------------------------------------------ cabeça
  {
    id: 'sabio', nome: 'sábio', peso: 6, opostos: ['tolo'],
    descricao: 'Vale por uma biblioteca pequena. O reino descobre mais rápido por causa dele.',
    conhecimento: 2.4, dano: 0.9,
  },
  {
    id: 'tolo', nome: 'tolo', peso: 6, opostos: ['sabio'],
    descricao: 'Não aprende e não ensina.',
    conhecimento: 0.4,
  },
  {
    id: 'ganancioso', nome: 'ganancioso', peso: 9, opostos: ['generoso'],
    descricao: 'Junta ouro depressa — e é o primeiro a se revoltar contra um imposto.',
    ouro: 1.7, lealdade: 0.78,
  },
  {
    id: 'generoso', nome: 'generoso', peso: 7, opostos: ['ganancioso'],
    descricao: 'Nunca vai ser o mais rico da vila, e nunca vai ser quem começa a revolta.',
    ouro: 0.65, lealdade: 1.28,
  },
  {
    id: 'destemido', nome: 'destemido', peso: 6, opostos: ['covarde'],
    descricao: 'Não recua ferido. Morre mais, e leva gente junto.',
    dano: 1.12, destemido: true,
  },
  {
    id: 'covarde', nome: 'covarde', peso: 6, opostos: ['destemido'],
    descricao: 'Sai de perto na primeira dor. Vive mais que os corajosos.',
    dano: 0.85, velocidade: 1.06,
  },

  // -------------------------------------------------------------- vida social
  {
    id: 'belo', nome: 'belo', peso: 8, opostos: ['feio'],
    descricao: 'Acha par antes de todo mundo, e o povo gosta de quem é bonito.',
    beleza: 2.6, lealdade: 1.08,
  },
  {
    id: 'feio', nome: 'feio', peso: 7, opostos: ['belo'],
    descricao: 'Fica para o fim da fila.',
    beleza: 0.35,
  },
  {
    id: 'fertil', nome: 'fértil', peso: 7, opostos: ['esteril'],
    descricao: 'Tem filho atrás de filho. Uma família dessas ocupa uma vila em duas gerações.',
    espera: 0.55,
  },
  {
    id: 'esteril', nome: 'estéril', peso: 5, opostos: ['fertil'],
    descricao: 'Não deixa descendente. A linhagem morre com ele.',
    espera: 1e9,
  },

  // ------------------------------------------------------------------ o raro
  {
    id: 'imortal', nome: 'imortal', peso: 0.25,
    descricao: 'A velhice não o alcança. Só morre de fome, fogo ou espada — e o mundo lembra dele.',
    imortal: true, vida: 1.25, longevidade: 1,
  },
]);

/** Quantos traços existem. Tem de caber em 32, que é o tamanho da máscara. */
export const TOTAL_TRACOS = tracos.tamanho;
if (TOTAL_TRACOS > 32) {
  throw new Error(`Traços só cabem 32 numa máscara de Uint32; há ${TOTAL_TRACOS}.`);
}

/** Máscara de bits dos opostos de cada traço, por índice. */
export const TRACO_OPOSTOS = (() => {
  const a = new Uint32Array(TOTAL_TRACOS);
  tracos.todos().forEach((t, i) => {
    let m = 0;
    for (const id of t.opostos ?? []) m |= 1 << tracos.indice(id);
    a[i] = m;
  });
  return a;
})();

/** Peso de cada traço no sorteio, e a soma deles. */
export const TRACO_PESO = new Float32Array(tracos.todos().map((t) => t.peso));
export const PESO_TOTAL = TRACO_PESO.reduce((s, p) => s + p, 0);

/**
 * Os campos que um traço multiplica, na ordem em que `TRACO_FATOR` os guarda.
 *
 * Enum de posição e não de nome: quem consulta está dentro de um laço quente e
 * lê `TRACO_FATOR[traco * CAMPOS + Campo.dano]`, que é um acesso a array.
 */
export const enum Campo {
  vida = 0,
  dano = 1,
  velocidade = 2,
  longevidade = 3,
  fome = 4,
  espera = 5,
  ouro = 6,
  lealdade = 7,
  conhecimento = 8,
  beleza = 9,
}
export const CAMPOS = 10;

/** Matriz plana `[traço][campo]` de multiplicadores. 1 onde o traço não mexe. */
export const TRACO_FATOR = (() => {
  const a = new Float32Array(TOTAL_TRACOS * CAMPOS).fill(1);
  tracos.todos().forEach((t, i) => {
    const p = i * CAMPOS;
    if (t.vida !== undefined) a[p + Campo.vida] = t.vida;
    if (t.dano !== undefined) a[p + Campo.dano] = t.dano;
    if (t.velocidade !== undefined) a[p + Campo.velocidade] = t.velocidade;
    if (t.longevidade !== undefined) a[p + Campo.longevidade] = t.longevidade;
    if (t.fome !== undefined) a[p + Campo.fome] = t.fome;
    if (t.espera !== undefined) a[p + Campo.espera] = t.espera;
    if (t.ouro !== undefined) a[p + Campo.ouro] = t.ouro;
    if (t.lealdade !== undefined) a[p + Campo.lealdade] = t.lealdade;
    if (t.conhecimento !== undefined) a[p + Campo.conhecimento] = t.conhecimento;
    if (t.beleza !== undefined) a[p + Campo.beleza] = t.beleza;
  });
  return a;
})();

/** Máscara com todos os traços que impedem a morte por velhice. */
export const MASCARA_IMORTAL = (() => {
  let m = 0;
  tracos.todos().forEach((t, i) => {
    if (t.imortal) m |= 1 << i;
  });
  return m;
})();

/**
 * Máscara dos traços raros o bastante para virarem notícia.
 *
 * O corte é o peso: um traço que aparece em menos de um por cento dos sorteios
 * é acontecimento, e não estatística. Hoje só o imortal passa.
 */
export const MASCARA_RARA = (() => {
  let m = 0;
  tracos.todos().forEach((t, i) => {
    if (t.peso / PESO_TOTAL < 0.01) m |= 1 << i;
  });
  return m;
})();

/** Máscara dos traços que fazem alguém não recuar ferido. */
export const MASCARA_DESTEMIDO = (() => {
  let m = 0;
  tracos.todos().forEach((t, i) => {
    if (t.destemido) m |= 1 << i;
  });
  return m;
})();
