/** De onde veio uma criatura nova. */
export type OrigemNascimento =
  | 'mundo'
  | 'natural'
  | 'casa'
  | 'imigracao'
  | 'jogador';

/**
 * Barramento de eventos da simulação.
 *
 * É o desacoplador principal do projeto: sistemas anunciam o que aconteceu e
 * quem quiser reage (UI, log, estatísticas, futuros sistemas de conhecimento e
 * economia) sem que o sistema de origem precise saber que eles existem.
 */

export type EventosDoJogo = {
  'mundo:gerado': { semente: string };
  'mundo:carregado': { semente: string; tick: number };

  /**
   * `origem` diz de onde a criatura veio. Serve para saber qual mecânica está
   * realmente fazendo o mundo crescer: já aconteceu de o crescimento dentro das
   * casas responder por 2% dos nascimentos enquanto a documentação — e os
   * testes — diziam que era o caminho principal.
   */
  'criatura:nasceu': {
    id: number; especie: number; x: number; y: number; origem: OrigemNascimento;
  };
  /** `porEspecie` é a espécie de quem matou, ou -1 quando não houve matador. */
  'criatura:morreu': {
    id: number; especie: number; x: number; y: number; causa: Causa; porEspecie: number;
  };

  'aldeia:fundada': { aldeia: number; reino: number; x: number; y: number };
  'aldeia:destruida': { aldeia: number; reino: number; x: number; y: number };
  'aldeia:cresceu': { aldeia: number; nivel: number };
  'aldeia:conquistada': { aldeia: number; de: number; para: number };

  'reino:fundado': { reino: number; nome: string };
  'reino:extinto': { reino: number; nome: string };
  'reino:guerra': { a: number; b: number };
  'reino:paz': { a: number; b: number };
  'reino:eraNova': { reino: number; era: number };
  'reino:alianca': { a: number; b: number };
  'reino:aliancaRompida': { a: number; b: number };

  'comercio:feito': {
    de: number; para: number; material: string; quanto: number; preco: number;
  };

  'especie:migrou': { especie: number; x: number; y: number; quantos: number };

  'terreno:incendio': { x: number; y: number };
  'vulcao:erupcao': { x: number; y: number; bombas: number };
  'barco:lancado': { aldeia: number; tipo: number };
  'barco:atracou': { aldeia: number; carga: number };
  'barco:zarpou': { aldeia: number; gente: number };
  'barco:colonizou': { aldeia: number; reino: number; x: number; y: number };
  'poder:usado': { poder: string; x: number; y: number };
};

export type Causa =
  | 'fome'
  | 'velhice'
  | 'combate'
  | 'predado'
  | 'fogo'
  | 'afogado'
  | 'praga'
  | 'jogador'
  | 'desastre'
  /** Fisgado por um pesqueiro. */
  | 'pescado'
  /**
   * Subiu a bordo de um navio.
   *
   * A criatura sai do mundo e volta a existir no desembarque, do outro lado do
   * mar. Não é morte de verdade, e por isso tem causa própria: contada junto
   * com fome ou combate, o diagnóstico diria que a travessia estava dizimando
   * a população.
   */
  | 'embarcou';

export type NomeEvento = keyof EventosDoJogo;
type Ouvinte<K extends NomeEvento> = (dados: EventosDoJogo[K]) => void;

export class Barramento {
  private ouvintes = new Map<NomeEvento, Set<(dados: never) => void>>();
  /** Contadores por tipo de evento — alimentam o painel de estatísticas. */
  readonly contagem = new Map<NomeEvento, number>();

  on<K extends NomeEvento>(tipo: K, fn: Ouvinte<K>): () => void {
    let set = this.ouvintes.get(tipo);
    if (!set) {
      set = new Set();
      this.ouvintes.set(tipo, set);
    }
    set.add(fn as (dados: never) => void);
    return () => set!.delete(fn as (dados: never) => void);
  }

  emitir<K extends NomeEvento>(tipo: K, dados: EventosDoJogo[K]): void {
    this.contagem.set(tipo, (this.contagem.get(tipo) ?? 0) + 1);
    const set = this.ouvintes.get(tipo);
    if (!set) return;
    for (const fn of set) (fn as Ouvinte<K>)(dados);
  }

  limpar(): void {
    this.ouvintes.clear();
    this.contagem.clear();
  }
}
