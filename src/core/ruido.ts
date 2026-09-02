import { Rng } from './rng.js';

/**
 * Ruído de gradiente 2D (Perlin) com tabela de permutação embaralhada por semente.
 * Usado na geração de mundo: altitude, umidade, manchas de bioma e variação de cor.
 */
export class Ruido {
  private perm: Uint8Array;

  constructor(semente: number | string) {
    const rng = new Rng(semente);
    const base = new Uint8Array(256);
    for (let i = 0; i < 256; i++) base[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = rng.int(i + 1);
      const t = base[i];
      base[i] = base[j];
      base[j] = t;
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = base[i & 255];
  }

  private static suavizar(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private static gradiente(hash: number, x: number, y: number): number {
    // 8 direções — suficiente para terreno e mais barato que o gradiente completo
    switch (hash & 7) {
      case 0: return x + y;
      case 1: return x - y;
      case 2: return -x + y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  }

  /** Ruído em [-1, 1]. */
  em(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = Ruido.suavizar(xf);
    const v = Ruido.suavizar(yf);
    const p = this.perm;
    const aa = p[p[xi] + yi];
    const ab = p[p[xi] + yi + 1];
    const ba = p[p[xi + 1] + yi];
    const bb = p[p[xi + 1] + yi + 1];
    const x1 = lerp(Ruido.gradiente(aa, xf, yf), Ruido.gradiente(ba, xf - 1, yf), u);
    const x2 = lerp(Ruido.gradiente(ab, xf, yf - 1), Ruido.gradiente(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
  }

  /** Soma de oitavas. Devolve aproximadamente [-1, 1]. */
  fbm(x: number, y: number, oitavas = 4, persistencia = 0.5, lacunaridade = 2): number {
    let soma = 0;
    let amplitude = 1;
    let frequencia = 1;
    let normal = 0;
    for (let o = 0; o < oitavas; o++) {
      soma += this.em(x * frequencia, y * frequencia) * amplitude;
      normal += amplitude;
      amplitude *= persistencia;
      frequencia *= lacunaridade;
    }
    return soma / normal;
  }

  /** fbm com dobras — gera cristas, bom para cordilheiras. */
  cristas(x: number, y: number, oitavas = 4): number {
    let soma = 0;
    let amplitude = 1;
    let frequencia = 1;
    let normal = 0;
    for (let o = 0; o < oitavas; o++) {
      const v = 1 - Math.abs(this.em(x * frequencia, y * frequencia));
      soma += v * v * amplitude;
      normal += amplitude;
      amplitude *= 0.5;
      frequencia *= 2;
    }
    return soma / normal;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
