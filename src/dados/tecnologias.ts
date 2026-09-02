import { Registro, type Definicao } from '../core/registro.js';

/**
 * O que uma civilização sabe fazer, e em que ordem ela descobre.
 *
 * Até aqui todo povo nascia sabendo tudo: no primeiro minuto de mundo uma
 * tribo de nove pessoas já levantava casa com telhado, moinho de vento e
 * ferraria. Era o pressuposto mais forte do jogo e o menos justificado — a
 * civilização não tinha para onde crescer porque já começava pronta.
 *
 * Aqui ela começa como o pedido dizia: **quase primata**. Sabe fazer fogo e
 * lascar pedra, dorme em volta de uma fogueira, come o que acha. Casa,
 * lavoura, pedra lavrada e aço são coisas que ela **descobre**, uma de cada
 * vez, gastando conhecimento acumulado — e cada descoberta abre construção,
 * equipamento ou material de obra novo.
 *
 * Duas consequências que valem mais que a árvore em si:
 *
 * - **Os marcos passaram a servir para alguma coisa.** Biblioteca, prefeitura e
 *   templo estavam de pé no mapa sem função nenhuma desde que existem. Agora
 *   são a fonte de conhecimento do reino, e um império que constrói biblioteca
 *   descobre mais rápido que um que só constrói muralha.
 * - **A era virou consequência, não enfeite.** Ela era calculada de população e
 *   território e não fazia nada; agora é a era da tecnologia mais avançada que
 *   o reino domina, e é ela que aparece na crônica quando um povo cruza a
 *   fronteira entre um mundo e outro.
 *
 * A árvore é curta de propósito — dezessete descobertas. Uma árvore de cem
 * ficaria ilegível na tela do jogador e faria cada partida se parecer com a
 * anterior, porque ninguém consegue divergir num caminho estreito.
 */
export interface Tecnologia extends Definicao {
  readonly nome: string;
  readonly descricao: string;
  /** 0 tribal · 1 aldeias · 2 reino · 3 império. */
  readonly era: number;
  /** Conhecimento acumulado que custa descobrir. 0 = já se nasce sabendo. */
  readonly custo: number;
  /** Ids de tecnologias que precisam vir antes. */
  readonly requer?: readonly string[];
  /** Ids de construções que passa a permitir. */
  readonly liberaEdificios?: readonly string[];
  /** Ids de equipamentos que passa a permitir. */
  readonly liberaEquipamentos?: readonly string[];
  /**
   * Material de obra que passa a permitir, por índice em `MATERIAIS_DE_OBRA`.
   *
   * É o que faz um povo que só conhece madeira construir de madeira — e ter
   * prédios piores por isso, que era exatamente o pedido.
   */
  readonly materialDeObra?: number;
}

export const tecnologias = new Registro<Tecnologia>('tecnologias');

tecnologias.registrarTodos([
  // ------------------------------------------------------ era 0: tribal
  // Custo zero: é com isto que todo povo nasce. Fogo para não morrer de frio e
  // pedra lascada para não morrer de fome — nada além disso.
  {
    id: 'fogo', nome: 'domínio do fogo', era: 0, custo: 0,
    descricao: 'A fogueira em volta da qual o bando dorme. É a primeira moradia que existe.',
    liberaEdificios: ['fogueira'],
  },
  {
    id: 'pedra_lascada', nome: 'pedra lascada', era: 0, custo: 0,
    descricao: 'Uma lasca amarrada num pau. Não é bonito e resolve.',
    liberaEquipamentos: ['porrete', 'escudo_madeira'],
    materialDeObra: 0,
  },
  {
    id: 'coleta', nome: 'coleta organizada', era: 0, custo: 12, requer: ['fogo'],
    descricao: 'Saber onde a fruta nasce e voltar lá na estação certa.',
  },
  {
    id: 'caca', nome: 'caça em grupo', era: 0, custo: 18, requer: ['pedra_lascada'],
    descricao: 'Cercar o bicho em vez de correr atrás dele.',
    liberaEquipamentos: ['lanca'],
  },

  // ----------------------------------------------------- era 1: aldeias
  {
    id: 'abrigo', nome: 'abrigo', era: 1, custo: 26, requer: ['fogo'],
    descricao: 'Parede de barro e teto de palha. Dá para ter filho debaixo de um teto.',
    liberaEdificios: ['casa'],
  },
  {
    id: 'agricultura', nome: 'agricultura', era: 1, custo: 38, requer: ['coleta'],
    descricao: 'Plantar em vez de procurar. É o que prende um povo a um lugar.',
    liberaEdificios: ['fazenda'],
  },
  {
    id: 'cestaria', nome: 'cestaria e armazenagem', era: 1, custo: 48, requer: ['agricultura'],
    descricao: 'Guardar a colheita para o inverno sem que ela apodreça.',
    liberaEdificios: ['celeiro'],
  },
  {
    id: 'arco_e_flecha', nome: 'arco e flecha', era: 1, custo: 45, requer: ['caca'],
    descricao: 'Matar de longe. Muda a caça e muda a guerra.',
    liberaEquipamentos: ['arco'],
  },
  {
    id: 'carpintaria', nome: 'carpintaria', era: 1, custo: 65, requer: ['abrigo'],
    descricao: 'Viga, encaixe e serra. A construção deixa de ser barro e passa a ser madeira.',
    liberaEdificios: ['serraria'],
    materialDeObra: 1,
  },
  {
    id: 'fermentacao', nome: 'fermentação', era: 1, custo: 78, requer: ['agricultura'],
    descricao: 'Cerveja, pão e um lugar para o povo se juntar à noite.',
    liberaEdificios: ['taverna'],
  },

  // ------------------------------------------------------- era 2: reino
  {
    id: 'alvenaria', nome: 'alvenaria', era: 2, custo: 100, requer: ['carpintaria'],
    descricao: 'Pedra assentada. O que se ergue com ela não cai com um empurrão.',
    liberaEdificios: ['muralha', 'torre', 'poco'],
    materialDeObra: 2,
  },
  {
    id: 'moagem', nome: 'moagem', era: 2, custo: 112, requer: ['carpintaria', 'agricultura'],
    descricao: 'O vento fazendo o trabalho do braço. A lavoura passa a render.',
    liberaEdificios: ['moinho'],
  },
  {
    id: 'metalurgia', nome: 'metalurgia', era: 2, custo: 120, requer: ['alvenaria'],
    descricao: 'Tirar metal da rocha e dobrá-lo no fogo.',
    liberaEdificios: ['mina', 'ferraria'],
    liberaEquipamentos: ['espada', 'escudo_ferro', 'couro'],
  },
  {
    id: 'navegacao', nome: 'navegação', era: 2, custo: 126, requer: ['carpintaria'],
    descricao: 'Casco, remo e vela. O mar deixa de ser parede e vira estrada.',
    liberaEdificios: ['porto'],
  },
  {
    id: 'escrita', nome: 'escrita', era: 2, custo: 138, requer: ['fermentacao'],
    descricao: 'Guardar o que se sabe fora da cabeça de quem sabe.',
    liberaEdificios: ['prefeitura', 'biblioteca'],
  },
  {
    id: 'moeda', nome: 'moeda cunhada', era: 2, custo: 150, requer: ['escrita'],
    descricao: 'Um pedaço de metal que vale o mesmo em toda parte. Sem isso não há feira.',
    liberaEdificios: ['mercado'],
  },

  // ----------------------------------------------------- era 3: império
  {
    id: 'cantaria', nome: 'cantaria', era: 3, custo: 140, requer: ['alvenaria', 'escrita'],
    descricao: 'Pedra lavrada, arco e abóbada. O que se ergue agora atravessa séculos.',
    liberaEdificios: ['castelo', 'templo'],
    materialDeObra: 3,
  },
  {
    id: 'aco', nome: 'aço', era: 3, custo: 160, requer: ['metalurgia'],
    descricao: 'Ferro com carbono na medida. Corta o que o ferro só amassa.',
    liberaEdificios: ['quartel'],
    liberaEquipamentos: ['machado', 'cota', 'placas'],
  },
  {
    id: 'banca', nome: 'banca', era: 3, custo: 180, requer: ['moeda'],
    descricao: 'Empréstimo, juro e cofre. O ouro parado passa a trabalhar.',
    liberaEdificios: ['banco'],
  },
]);

/** Nomes das eras, na ordem. */
export const NOME_ERA = ['tribal', 'de aldeias', 'de reino', 'imperial'] as const;

/** Índices das tecnologias que todo povo já nasce sabendo. */
export const TEC_INICIAIS = tecnologias
  .filtrar((t) => t.custo === 0)
  .map((t) => tecnologias.indice(t.id));

/** Era de cada tecnologia, por índice. */
export const TEC_ERA = new Uint8Array(tecnologias.todos().map((t) => t.era));
/** Custo de cada tecnologia, por índice. */
export const TEC_CUSTO = new Float32Array(tecnologias.todos().map((t) => t.custo));
/** Pré-requisitos de cada tecnologia, já como índices. */
export const TEC_REQUER: number[][] = tecnologias
  .todos()
  .map((t) => (t.requer ?? []).map((id) => tecnologias.indice(id)));
