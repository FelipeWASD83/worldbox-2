/**
 * O terreno do mundo.
 *
 * Tudo aqui é array tipado paralelo indexado por `y * largura + x`. Nada de um
 * objeto por tile: num mapa de 384x216 isso seriam 83 mil objetos, e o mundo
 * grande passa de 200 mil. Camada nova = mais um array, sem mexer no resto.
 */

/** Altura a partir da qual o tile é terra seca. Abaixo disso é oceano. */
export const NIVEL_MAR = 96;
/** Altura a partir da qual vira encosta de montanha. */
/**
 * Altitude a partir da qual o chão é rocha exposta.
 *
 * Subiu de 178 para 202 porque a serra tomava mais de um quarto da terra firme
 * do mundo, e montanha é terreno morto: nada nasce, ninguém constrói (salvo a
 * mina) e os bichos evitam. Mexer aqui rende muito mais que mexer no controle
 * de "montanhas" da criação do mundo — aquele muda o relevo, este muda onde o
 * relevo deixa de ser habitável.
 */
export const NIVEL_MONTANHA = 202;
/** Lado do chunk usado para marcar regiões sujas no redesenho. */
export const LADO_CHUNK = 16;

export class Grid {
  readonly largura: number;
  readonly altura: number;
  readonly total: number;

  /** Altitude 0..255. `NIVEL_MAR` separa mar de terra. */
  readonly alt: Uint8Array;
  /** Índice do bioma no registro de biomas. */
  readonly bioma: Uint8Array;
  /** Umidade 0..255 — junto com temperatura decide o bioma. */
  readonly umidade: Uint8Array;
  /** Temperatura 0..255, onde 0 = -30 °C e 255 = +50 °C. */
  readonly temp: Uint8Array;
  /** Densidade de vegetação 0..255. Comida de herbívoro e combustível de incêndio. */
  readonly vegetacao: Uint8Array;
  /** Fogo restante no tile (0 = apagado). */
  readonly fogo: Uint8Array;
  /** Reino dono do tile, ou -1. */
  readonly territorio: Int16Array;
  /** Edifício no tile: 0 = nada, senão índice do registro + 1. */
  readonly construcao: Uint8Array;
  /** Aldeia dona do edifício, ou -1. */
  readonly aldeiaDona: Int16Array;
  /**
   * Para tiles tomados por um objeto maior que um tile: o índice do tile-âncora
   * onde esse objeto começa. -1 quando o tile está livre.
   *
   * Uma árvore de copa larga ou uma casa de três tiles precisam de um dono só;
   * sem isto, cada tile do prédio seria um prédio, e derrubar um pedaço deixaria
   * o resto de pé.
   */
  readonly ocupacao: Int32Array;
  /** Estrada no tile. É chão, então não disputa espaço com construção. */
  readonly estrada: Uint8Array;
  /** Recurso em cima do tile: 0 = nada, senão índice do registro + 1. */
  readonly recurso: Uint8Array;
  /** Quanto ainda resta desse recurso (0..255). Zero apaga o recurso. */
  readonly recursoQtd: Uint8Array;
  /**
   * De que é feita a construção do tile, e quem a ergueu.
   *
   * Um byte com duas coisas empacotadas: o material de obra nos três bits de
   * baixo e a espécie de quem construiu nos cinco de cima (ver
   * `empacotarAcabamento`, em `src/dados/edificios.ts`).
   *
   * É o que faz o mesmo prédio valer coisas diferentes conforme o povo e a
   * época: uma casa de palha abriga menos e cai mais fácil que a mesma casa de
   * pedra lavrada, e as duas podem estar lado a lado na mesma vila, uma
   * levantada antes da descoberta e a outra depois.
   *
   * Só tem sentido onde `construcao` não é zero; nos outros tiles é lixo
   * inofensivo que ninguém lê.
   */
  readonly acabamento: Uint8Array;
  /** Ruído fixo por tile, só para variar a cor no desenho. */
  readonly matiz: Uint8Array;

  /** Um byte por chunk: 1 quando algo mudou e o chunk precisa ser redesenhado. */
  readonly chunksSujos: Uint8Array;
  readonly chunksL: number;
  readonly chunksA: number;

  constructor(largura: number, altura: number) {
    this.largura = largura;
    this.altura = altura;
    this.total = largura * altura;
    this.alt = new Uint8Array(this.total);
    this.bioma = new Uint8Array(this.total);
    this.umidade = new Uint8Array(this.total);
    this.temp = new Uint8Array(this.total);
    this.vegetacao = new Uint8Array(this.total);
    this.fogo = new Uint8Array(this.total);
    this.territorio = new Int16Array(this.total).fill(-1);
    this.construcao = new Uint8Array(this.total);
    this.aldeiaDona = new Int16Array(this.total).fill(-1);
    this.ocupacao = new Int32Array(this.total).fill(-1);
    this.estrada = new Uint8Array(this.total);
    this.recurso = new Uint8Array(this.total);
    this.recursoQtd = new Uint8Array(this.total);
    this.acabamento = new Uint8Array(this.total);
    this.matiz = new Uint8Array(this.total);
    this.chunksL = Math.ceil(largura / LADO_CHUNK);
    this.chunksA = Math.ceil(altura / LADO_CHUNK);
    this.chunksSujos = new Uint8Array(this.chunksL * this.chunksA).fill(1);
  }

  idx(x: number, y: number): number {
    return y * this.largura + x;
  }

  dentro(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.largura && y < this.altura;
  }

  /** Prende a coordenada dentro do mapa (o mundo não dá a volta). */
  prenderX(x: number): number {
    return x < 0 ? 0 : x >= this.largura ? this.largura - 1 : x;
  }

  prenderY(y: number): number {
    return y < 0 ? 0 : y >= this.altura ? this.altura - 1 : y;
  }

  ehAgua(i: number): boolean {
    return this.alt[i] < NIVEL_MAR;
  }

  ehTerra(i: number): boolean {
    return this.alt[i] >= NIVEL_MAR;
  }

  ehMontanha(i: number): boolean {
    return this.alt[i] >= NIVEL_MONTANHA;
  }

  /** Terreno onde criatura terrestre consegue andar. */
  caminhavel(i: number): boolean {
    return this.alt[i] >= NIVEL_MAR && this.alt[i] < NIVEL_MONTANHA + 40;
  }

  /** Marca uma área como tomada pelo objeto que começa em `ancora`. */
  ocupar(ancora: number, largura: number, profundidade: number): void {
    const ax = ancora % this.largura;
    const ay = (ancora / this.largura) | 0;
    for (let dy = 0; dy < profundidade; dy++) {
      for (let dx = 0; dx < largura; dx++) {
        const x = ax + dx;
        const y = ay + dy;
        // um objeto vindo de save antigo pode encostar na borda: sem esta
        // guarda, `idx` daria a volta e marcaria a linha de baixo
        if (!this.dentro(x, y)) continue;
        this.ocupacao[this.idx(x, y)] = ancora;
        this.marcarSujo(x, y);
      }
    }
  }

  /** Solta a área tomada por um objeto. */
  desocupar(ancora: number, largura: number, profundidade: number): void {
    const ax = ancora % this.largura;
    const ay = (ancora / this.largura) | 0;
    for (let dy = 0; dy < profundidade; dy++) {
      for (let dx = 0; dx < largura; dx++) {
        const x = ax + dx;
        const y = ay + dy;
        if (!this.dentro(x, y)) continue;
        const i = this.idx(x, y);
        if (this.ocupacao[i] === ancora) this.ocupacao[i] = -1;
        // sujar tile a tile: um prédio que cruza a divisa de dois pedaços
        // deixava um deles desatualizado quando só os cantos eram marcados
        this.marcarSujo(x, y);
      }
    }
  }

  /** Tira uma unidade do recurso do tile; devolve quanto saiu de material. */
  colher(i: number, quanto: number): number {
    const r = this.recurso[i];
    if (r === 0) return 0;
    const tirado = Math.min(this.recursoQtd[i], quanto);
    this.recursoQtd[i] -= tirado;
    if (this.recursoQtd[i] <= 0) {
      this.recurso[i] = 0;
      this.recursoQtd[i] = 0;
    }
    this.marcarSujoIdx(i);
    return tirado;
  }

  limparRecurso(i: number): void {
    if (this.recurso[i] === 0) return;
    this.recurso[i] = 0;
    this.recursoQtd[i] = 0;
    this.marcarSujoIdx(i);
  }

  marcarSujo(x: number, y: number): void {
    const cx = (x / LADO_CHUNK) | 0;
    const cy = (y / LADO_CHUNK) | 0;
    if (cx < 0 || cy < 0 || cx >= this.chunksL || cy >= this.chunksA) return;
    this.chunksSujos[cy * this.chunksL + cx] = 1;
  }

  marcarSujoIdx(i: number): void {
    this.marcarSujo(i % this.largura, (i / this.largura) | 0);
  }

  marcarTudoSujo(): void {
    this.chunksSujos.fill(1);
  }

  /** Índices dos 4 vizinhos ortogonais válidos, escritos em `saida`. Devolve quantos. */
  vizinhos4(x: number, y: number, saida: Int32Array): number {
    let n = 0;
    if (y > 0) saida[n++] = (y - 1) * this.largura + x;
    if (x > 0) saida[n++] = y * this.largura + (x - 1);
    if (x < this.largura - 1) saida[n++] = y * this.largura + (x + 1);
    if (y < this.altura - 1) saida[n++] = (y + 1) * this.largura + x;
    return n;
  }

  /** Índices dos 8 vizinhos válidos, escritos em `saida`. Devolve quantos. */
  vizinhos8(x: number, y: number, saida: Int32Array): number {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= this.altura) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= this.largura) continue;
        saida[n++] = ny * this.largura + nx;
      }
    }
    return n;
  }
}
