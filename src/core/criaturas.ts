/**
 * Pool de criaturas em arrays paralelos (struct of arrays).
 *
 * Cada criatura é um índice, não um objeto. Isso é o que permite dezenas de
 * milhares de seres vivos ao mesmo tempo: sem alocação por criatura, sem
 * pressão no coletor de lixo e com acesso à memória em sequência.
 *
 * Atributo novo = mais um array aqui + uma linha em `criar()`. Não quebra save
 * antigo: `save.ts` grava por nome de campo e o que faltar volta como zero.
 */

export const enum Estado {
  Ocioso = 0,
  Vagando = 1,
  BuscandoComida = 2,
  Cacando = 3,
  Fugindo = 4,
  Acasalando = 5,
  Atacando = 6,
  Voltando = 7,
  Trabalhando = 8,
  Dormindo = 9,
}

/**
 * Bits de `criaturas.marcas`. Mecânica nova que precise de um sinalizador por
 * criatura ganha um bit aqui em vez de um array novo.
 */
export const MARCA_SOLDADO = 1 << 0;
export const MARCA_DOENTE = 1 << 1;
export const MARCA_DOMESTICADO = 1 << 2;
export const MARCA_LIDER = 1 << 3;

export const NOME_ESTADO: Record<number, string> = {
  [Estado.Ocioso]: 'parado',
  [Estado.Vagando]: 'vagando',
  [Estado.BuscandoComida]: 'procurando comida',
  [Estado.Cacando]: 'caçando',
  [Estado.Fugindo]: 'fugindo',
  [Estado.Acasalando]: 'procurando par',
  [Estado.Atacando]: 'atacando',
  [Estado.Voltando]: 'voltando para casa',
  [Estado.Trabalhando]: 'trabalhando',
  [Estado.Dormindo]: 'dormindo',
};

export class Criaturas {
  readonly capacidade: number;

  readonly vivo: Uint8Array;
  readonly especie: Uint8Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vida: Float32Array;
  readonly fome: Float32Array;
  readonly energia: Float32Array;
  readonly idade: Float32Array;
  readonly longevidade: Float32Array;
  readonly estado: Uint8Array;
  /** Criatura alvo (presa, inimigo, par) ou -1. */
  readonly alvo: Int32Array;
  readonly destinoX: Int16Array;
  readonly destinoY: Int16Array;
  /** Aldeia de origem, ou -1 para bicho selvagem. */
  readonly aldeia: Int16Array;
  readonly reino: Int16Array;
  /** Carrapato de reprodução: só acasala quando chega a zero. */
  readonly esperaFilho: Float32Array;
  /** Direção que está encarando (0 esquerda, 1 direita) — só para o desenho. */
  readonly dir: Uint8Array;
  /** Quanto de material o trabalhador está carregando. */
  readonly carga: Float32Array;
  /** Qual material é essa carga (índice em `MATERIAIS`). */
  readonly cargaMaterial: Uint8Array;
  /** Bits livres para mecânicas futuras (doente, amaldiçoado, domesticado...). */
  readonly marcas: Uint8Array;
  /** Experiência de combate — base para o futuro sistema de veteranos. */
  readonly xp: Float32Array;
  /** Ticks que faltam para poder atacar de novo. */
  readonly cdAtaque: Float32Array;
  /**
   * Índice do tile da casa em que a criatura entrou, ou -1 se está na rua.
   *
   * Quem está dentro não é desenhado, não anda e não é atacado — e é só dentro
   * de uma casa, com outro adulto, que os seres inteligentes têm filho. Casa
   * deixa de ser enfeite e passa a ser a condição de a civilização crescer.
   */
  readonly abrigo: Int32Array;
  /** Ticks que ainda vai ficar dentro de casa. */
  readonly tempoAbrigo: Float32Array;
  /**
   * Equipamento vestido: índice do registro **mais um** em cada encaixe, com
   * zero significando vazio. Três bytes por criatura — bicho selvagem carrega
   * o custo de três zeros, o que é aceitável para não ter dois pools.
   */
  readonly arma: Uint8Array;
  readonly escudo: Uint8Array;
  readonly armadura: Uint8Array;

  private livres: Int32Array;
  private qtdLivres = 0;
  /** Maior índice já usado + 1. Os laços varrem só até aqui. */
  private _limite = 0;
  private _quantidade = 0;

  constructor(capacidade: number) {
    this.capacidade = capacidade;
    this.vivo = new Uint8Array(capacidade);
    this.especie = new Uint8Array(capacidade);
    this.x = new Float32Array(capacidade);
    this.y = new Float32Array(capacidade);
    this.vida = new Float32Array(capacidade);
    this.fome = new Float32Array(capacidade);
    this.energia = new Float32Array(capacidade);
    this.idade = new Float32Array(capacidade);
    this.longevidade = new Float32Array(capacidade);
    this.estado = new Uint8Array(capacidade);
    this.alvo = new Int32Array(capacidade).fill(-1);
    this.destinoX = new Int16Array(capacidade).fill(-1);
    this.destinoY = new Int16Array(capacidade).fill(-1);
    this.aldeia = new Int16Array(capacidade).fill(-1);
    this.reino = new Int16Array(capacidade).fill(-1);
    this.esperaFilho = new Float32Array(capacidade);
    this.dir = new Uint8Array(capacidade);
    this.carga = new Float32Array(capacidade);
    this.cargaMaterial = new Uint8Array(capacidade);
    this.marcas = new Uint8Array(capacidade);
    this.xp = new Float32Array(capacidade);
    this.cdAtaque = new Float32Array(capacidade);
    this.abrigo = new Int32Array(capacidade).fill(-1);
    this.tempoAbrigo = new Float32Array(capacidade);
    this.arma = new Uint8Array(capacidade);
    this.escudo = new Uint8Array(capacidade);
    this.armadura = new Uint8Array(capacidade);
    this.livres = new Int32Array(capacidade);
  }

  get quantidade(): number {
    return this._quantidade;
  }

  /** Último índice ocupado + 1. Use como limite dos laços de varredura. */
  get limite(): number {
    return this._limite;
  }

  get cheio(): boolean {
    return this.qtdLivres === 0 && this._limite >= this.capacidade;
  }

  /** Reserva um índice. Devolve -1 se o mundo estiver lotado. */
  criar(): number {
    let i: number;
    if (this.qtdLivres > 0) {
      i = this.livres[--this.qtdLivres];
      // O índice pode ter ficado acima do limite quando `remover` encolheu a
      // varredura. Sem esta linha ele seria entregue de novo por `_limite++`,
      // e duas criaturas passariam a dividir a mesma posição no pool.
      if (i >= this._limite) this._limite = i + 1;
    } else if (this._limite < this.capacidade) {
      i = this._limite++;
    } else {
      return -1;
    }
    this.vivo[i] = 1;
    this.estado[i] = Estado.Ocioso;
    this.alvo[i] = -1;
    this.destinoX[i] = -1;
    this.destinoY[i] = -1;
    this.aldeia[i] = -1;
    this.reino[i] = -1;
    this.esperaFilho[i] = 0;
    this.carga[i] = 0;
    this.cargaMaterial[i] = 0;
    this.marcas[i] = 0;
    this.xp[i] = 0;
    this.cdAtaque[i] = 0;
    this.abrigo[i] = -1;
    this.tempoAbrigo[i] = 0;
    this.arma[i] = 0;
    this.escudo[i] = 0;
    this.armadura[i] = 0;
    this.idade[i] = 0;
    this.energia[i] = 100;
    this.fome[i] = 0;
    this._quantidade++;
    return i;
  }

  remover(i: number): void {
    if (!this.vivo[i]) return;
    this.vivo[i] = 0;
    this.alvo[i] = -1;
    this._quantidade--;
    if (this.qtdLivres < this.capacidade) this.livres[this.qtdLivres++] = i;
    // encolhe o limite quando os últimos índices morrem, para os laços andarem menos
    while (this._limite > 0 && !this.vivo[this._limite - 1]) this._limite--;
  }

  /**
   * Reconstrói os contadores internos depois de os arrays terem sido
   * preenchidos direto (ou seja, ao carregar um save). Sem isto o pool não
   * sabe quantas criaturas existem nem quais índices estão livres.
   */
  reconstruirDeArrays(limite: number): void {
    this._limite = Math.max(0, Math.min(limite, this.capacidade));
    while (this._limite > 0 && !this.vivo[this._limite - 1]) this._limite--;
    this._quantidade = 0;
    this.qtdLivres = 0;
    for (let i = 0; i < this._limite; i++) {
      if (this.vivo[i]) this._quantidade++;
      else this.livres[this.qtdLivres++] = i;
    }
  }

  limpar(): void {
    this.vivo.fill(0);
    this.qtdLivres = 0;
    this._limite = 0;
    this._quantidade = 0;
  }

  /** Conta quantas criaturas vivas há de cada espécie, em `saida`. */
  contarPorEspecie(saida: Int32Array): void {
    saida.fill(0);
    for (let i = 0; i < this._limite; i++) {
      if (this.vivo[i]) saida[this.especie[i]]++;
    }
  }
}
