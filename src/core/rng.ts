/**
 * Gerador de números pseudoaleatórios determinístico (xorshift128).
 *
 * A simulação inteira depende disto: mesma semente + mesma sequência de chamadas
 * = mesmo mundo. Nunca usar Math.random() dentro de sistema de simulação, só aqui.
 * Efeitos puramente visuais podem usar um RNG separado (ver `Rng.ramo`).
 */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(semente: number | string) {
    const s = typeof semente === 'string' ? Rng.sementeDeTexto(semente) : semente >>> 0;
    // splitmix32 para espalhar a semente pelos quatro estados
    let x = s >>> 0;
    const proximo = () => {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
      return (z ^ (z >>> 15)) >>> 0;
    };
    this.a = proximo();
    this.b = proximo();
    this.c = proximo();
    this.d = proximo();
    if ((this.a | this.b | this.c | this.d) === 0) this.a = 1;
  }

  static sementeDeTexto(texto: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /** Inteiro sem sinal de 32 bits. */
  u32(): number {
    const t = this.b << 9;
    let r = Math.imul(this.b, 5);
    r = ((r << 7) | (r >>> 25)) >>> 0;
    r = Math.imul(r, 9) >>> 0;
    this.c ^= this.a;
    this.d ^= this.b;
    this.b ^= this.c;
    this.a ^= this.d;
    this.c ^= t;
    this.d = ((this.d << 11) | (this.d >>> 21)) >>> 0;
    return r >>> 0;
  }

  /** Float em [0, 1). */
  f(): number {
    return this.u32() / 4294967296;
  }

  /** Float em [min, max). */
  entre(min: number, max: number): number {
    return min + this.f() * (max - min);
  }

  /** Inteiro em [0, n). */
  int(n: number): number {
    return (this.u32() % n) | 0;
  }

  /** Inteiro em [min, max] (inclusivo dos dois lados). */
  intEntre(min: number, max: number): number {
    return min + this.int(max - min + 1);
  }

  /** Verdadeiro com probabilidade p (0..1). */
  chance(p: number): boolean {
    return this.f() < p;
  }

  /** Um item qualquer do array. */
  escolher<T>(itens: readonly T[]): T {
    return itens[this.int(itens.length)];
  }

  /** Escolha ponderada: `pesos[i]` é o peso relativo de `itens[i]`. */
  escolherPesado<T>(itens: readonly T[], pesos: readonly number[]): T {
    let total = 0;
    for (let i = 0; i < pesos.length; i++) total += pesos[i];
    let r = this.f() * total;
    for (let i = 0; i < itens.length; i++) {
      r -= pesos[i];
      if (r <= 0) return itens[i];
    }
    return itens[itens.length - 1];
  }

  /** Embaralha no lugar (Fisher-Yates). */
  embaralhar<T>(itens: T[]): T[] {
    for (let i = itens.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = itens[i];
      itens[i] = itens[j];
      itens[j] = t;
    }
    return itens;
  }

  estado(): [number, number, number, number] {
    return [this.a, this.b, this.c, this.d];
  }

  restaurar(e: readonly number[]): void {
    this.a = e[0] >>> 0;
    this.b = e[1] >>> 0;
    this.c = e[2] >>> 0;
    this.d = e[3] >>> 0;
  }
}
