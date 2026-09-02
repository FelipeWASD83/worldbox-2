import type { Criaturas } from './criaturas.js';

/**
 * Índice espacial das criaturas: responde "quem está perto de mim" sem varrer
 * o mundo inteiro.
 *
 * É reconstruído a cada tick por counting sort — sem alocar nada, sem listas
 * encadeadas, sem `Map`. Foi o desenho medido antes de escolher a plataforma:
 * 50 mil criaturas custam ~7 ms por tick com isto no meio.
 */
export class IndiceEspacial {
  readonly lado: number;
  readonly colunas: number;
  readonly linhas: number;
  private readonly celulas: number;

  private inicio: Int32Array;
  private cursor: Int32Array;
  private ordenado: Int32Array;
  /** Posições do último `reconstruir`, para o corte circular de `aoRedor`. */
  private px: Float32Array = new Float32Array(0);
  private py: Float32Array = new Float32Array(0);

  constructor(larguraMundo: number, alturaMundo: number, capacidade: number, lado = 8) {
    this.lado = lado;
    this.colunas = Math.ceil(larguraMundo / lado);
    this.linhas = Math.ceil(alturaMundo / lado);
    this.celulas = this.colunas * this.linhas;
    this.inicio = new Int32Array(this.celulas + 1);
    this.cursor = new Int32Array(this.celulas + 1);
    this.ordenado = new Int32Array(capacidade);
  }

  private celulaDe(x: number, y: number): number {
    let cx = (x / this.lado) | 0;
    let cy = (y / this.lado) | 0;
    if (cx < 0) cx = 0;
    else if (cx >= this.colunas) cx = this.colunas - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.linhas) cy = this.linhas - 1;
    return cy * this.colunas + cx;
  }

  /** Reconstrói o índice inteiro. Chamar uma vez por tick, antes da IA. */
  reconstruir(c: Criaturas): void {
    this.px = c.x;
    this.py = c.y;
    const limite = c.limite;
    const inicio = this.inicio;
    inicio.fill(0);
    // 1ª passada: contar quantos caem em cada célula (guardado deslocado em 1)
    for (let i = 0; i < limite; i++) {
      // quem está dentro de casa sai do índice: não pode ser caçado, atacado
      // nem contado como vizinho enquanto estiver abrigado
      if (!c.vivo[i] || c.abrigo[i] >= 0) continue;
      inicio[this.celulaDe(c.x[i], c.y[i]) + 1]++;
    }
    // 2ª passada: soma acumulada vira o início de cada célula
    for (let k = 1; k <= this.celulas; k++) inicio[k] += inicio[k - 1];
    this.cursor.set(inicio);
    // 3ª passada: distribuir
    const ordenado = this.ordenado;
    const cursor = this.cursor;
    for (let i = 0; i < limite; i++) {
      if (!c.vivo[i] || c.abrigo[i] >= 0) continue;
      ordenado[cursor[this.celulaDe(c.x[i], c.y[i])]++] = i;
    }
  }

  /**
   * Percorre as criaturas realmente dentro de `raio` de (x, y) e chama
   * `visitar` com a distância ao quadrado de cada uma. Devolver `true`
   * interrompe a busca.
   *
   * O corte é circular de verdade. Já foi retangular por engano, e a praga —
   * a única chamadora que confiava no filtro em vez de refazer a conta — se
   * espalhava por quatro vezes a distância declarada no código.
   */
  aoRedor(
    x: number,
    y: number,
    raio: number,
    visitar: (id: number, distanciaQuadrada: number) => boolean | void,
  ): void {
    const r2 = raio * raio;
    const c0 = Math.max(0, ((x - raio) / this.lado) | 0);
    const c1 = Math.min(this.colunas - 1, ((x + raio) / this.lado) | 0);
    const l0 = Math.max(0, ((y - raio) / this.lado) | 0);
    const l1 = Math.min(this.linhas - 1, ((y + raio) / this.lado) | 0);
    const inicio = this.inicio;
    const ordenado = this.ordenado;
    for (let ly = l0; ly <= l1; ly++) {
      const base = ly * this.colunas;
      for (let cx = c0; cx <= c1; cx++) {
        const cel = base + cx;
        for (let k = inicio[cel], fim = inicio[cel + 1]; k < fim; k++) {
          const id = ordenado[k];
          const dx = this.px[id] - x;
          const dy = this.py[id] - y;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          if (visitar(id, d2) === true) return;
        }
      }
    }
  }

  /**
   * Mais próximo que satisfaça `aceita`, dentro de `raio`. Devolve -1 se não achar.
   * É a consulta mais usada pela IA — por isso vem escrita à mão, sem callback
   * de distância, para o motor de JS conseguir otimizar.
   */
  maisProximo(
    c: Criaturas,
    de: number,
    raio: number,
    aceita: (id: number) => boolean,
  ): number {
    const x = c.x[de];
    const y = c.y[de];
    const r2 = raio * raio;
    let melhor = -1;
    let melhorD = r2;
    const c0 = Math.max(0, ((x - raio) / this.lado) | 0);
    const c1 = Math.min(this.colunas - 1, ((x + raio) / this.lado) | 0);
    const l0 = Math.max(0, ((y - raio) / this.lado) | 0);
    const l1 = Math.min(this.linhas - 1, ((y + raio) / this.lado) | 0);
    const inicio = this.inicio;
    const ordenado = this.ordenado;
    for (let ly = l0; ly <= l1; ly++) {
      const base = ly * this.colunas;
      for (let cx = c0; cx <= c1; cx++) {
        const cel = base + cx;
        for (let k = inicio[cel], fim = inicio[cel + 1]; k < fim; k++) {
          const id = ordenado[k];
          if (id === de) continue;
          const dx = c.x[id] - x;
          const dy = c.y[id] - y;
          const d = dx * dx + dy * dy;
          if (d >= melhorD) continue;
          if (!aceita(id)) continue;
          melhorD = d;
          melhor = id;
        }
      }
    }
    return melhor;
  }

  /**
   * Conta quantas criaturas da mesma espécie há por perto, parando assim que
   * passar de `teto`.
   *
   * O teto não é detalhe: é o que mede superlotação sem pagar a contagem
   * completa. Num aglomerado de milhares de bichos iguais, contar todos por
   * criatura por tick seria o gargalo do jogo inteiro.
   */
  lotacaoDaEspecie(
    c: Criaturas,
    x: number,
    y: number,
    raio: number,
    especie: number,
    teto: number,
  ): number {
    let n = 0;
    const r2 = raio * raio;
    const c0 = Math.max(0, ((x - raio) / this.lado) | 0);
    const c1 = Math.min(this.colunas - 1, ((x + raio) / this.lado) | 0);
    const l0 = Math.max(0, ((y - raio) / this.lado) | 0);
    const l1 = Math.min(this.linhas - 1, ((y + raio) / this.lado) | 0);
    for (let ly = l0; ly <= l1; ly++) {
      const base = ly * this.colunas;
      for (let cx = c0; cx <= c1; cx++) {
        const cel = base + cx;
        for (let k = this.inicio[cel], fim = this.inicio[cel + 1]; k < fim; k++) {
          const id = this.ordenado[k];
          if (c.especie[id] !== especie) continue;
          const dx = c.x[id] - x;
          const dy = c.y[id] - y;
          if (dx * dx + dy * dy >= r2) continue;
          if (++n > teto) return n;
        }
      }
    }
    return n;
  }

}
