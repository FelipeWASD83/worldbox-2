import type { Mundo } from './mundo.js';

/**
 * Pipeline de sistemas de simulação.
 *
 * Cada sistema é uma peça independente que roda uma vez por tick, na ordem
 * declarada. Adicionar mecânica nova (economia, conhecimento, religião...) é
 * escrever um arquivo em `src/sim/` e registrar aqui — nenhum sistema existente
 * precisa saber do novo.
 *
 * `intervalo` permite que sistemas caros rodem a cada N ticks em vez de todo
 * tick; `fatias` divide o trabalho entre ticks (a criatura X pensa no tick em
 * que `id % fatias === tick % fatias`). É assim que milhares de criaturas cabem
 * no orçamento de 16 ms.
 */
export interface Sistema {
  /** Identificador curto, aparece no medidor de desempenho. */
  readonly id: string;
  /** Roda a cada N ticks. 1 = todo tick. */
  readonly intervalo?: number;
  executar(mundo: Mundo): void;
}

export class Pipeline {
  private sistemas: Sistema[] = [];
  /** Milissegundos gastos por sistema na última vez em que cada um foi medido. */
  readonly custo = new Map<string, number>();

  adicionar(...sistemas: Sistema[]): this {
    for (const s of sistemas) this.sistemas.push(s);
    return this;
  }

  /** Remove um sistema pelo id. Útil para desligar mecânica em teste. */
  remover(id: string): void {
    this.sistemas = this.sistemas.filter((s) => s.id !== id);
  }

  lista(): readonly Sistema[] {
    return this.sistemas;
  }

  executar(mundo: Mundo): void {
    for (let i = 0; i < this.sistemas.length; i++) {
      const s = this.sistemas[i];
      const intervalo = s.intervalo && s.intervalo > 1 ? s.intervalo : 1;
      if (mundo.tick % intervalo !== 0) continue;

      // Medir custa tempo, então cada sistema é cronometrado de 30 em 30
      // execuções *dele* — não de 30 em 30 ticks do mundo. Contando por tick,
      // a medição caía sempre em tick ímpar e os sistemas de intervalo par
      // (aldeias, diplomacia, praga, migração) nunca apareciam no painel.
      const vezes = (this.vezes.get(s.id) ?? 0) + 1;
      this.vezes.set(s.id, vezes);
      if (vezes % 30 === 1) {
        const t0 = performance.now();
        s.executar(mundo);
        this.custo.set(s.id, performance.now() - t0);
      } else {
        s.executar(mundo);
      }
    }
  }

  /** Quantas vezes cada sistema já rodou — usado só para espaçar a medição. */
  private vezes = new Map<string, number>();
}
