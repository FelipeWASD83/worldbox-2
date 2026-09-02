import type { Sistema } from '../core/sistemas.js';
import type { Mundo } from '../core/mundo.js';
import { MARCA_DOENTE } from '../core/criaturas.js';
import { E, ESP_CIVILIZADO } from '../dados/especies.js';

/** A cada quantos ticks a doença age. */
const INTERVALO = 8;

/**
 * Doença: consome quem está infectado e passa para quem chega perto.
 *
 * Quem morre de praga tendo sido civilizado pode levantar como zumbi — é o que
 * transforma um foco pequeno numa epidemia que derruba um reino.
 */
export const sistemaPraga: Sistema = {
  id: 'praga',
  intervalo: INTERVALO,
  executar(mundo: Mundo): void {
    const c = mundo.criaturas;
    const limite = c.limite;
    const doentes: number[] = [];

    for (let i = 0; i < limite; i++) {
      if (!c.vivo[i]) continue;
      if ((c.marcas[i] & MARCA_DOENTE) === 0) continue;
      doentes.push(i);
    }
    if (doentes.length === 0) return;

    const virarZumbi: Array<[number, number]> = [];

    for (const i of doentes) {
      c.vida[i] -= 1.6 * INTERVALO;
      c.fome[i] += 0.4 * INTERVALO;

      if (c.vida[i] <= 0) {
        const eraCivilizado = ESP_CIVILIZADO[c.especie[i]] === 1;
        const x = c.x[i];
        const y = c.y[i];
        mundo.matar(i, 'praga');
        if (eraCivilizado && mundo.rng.chance(0.4)) virarZumbi.push([x, y]);
        continue;
      }

      // contágio por proximidade
      mundo.espacial.aoRedor(c.x[i], c.y[i], 2.2, (id) => {
        if (!c.vivo[id] || id === i) return;
        if ((c.marcas[id] & MARCA_DOENTE) !== 0) return;
        if (mundo.rng.chance(0.05)) c.marcas[id] |= MARCA_DOENTE;
      });
    }

    for (const [x, y] of virarZumbi) {
      const z = mundo.nascer(E.zumbi, x, y, 0);
      if (z >= 0) mundo.criaturas.marcas[z] &= ~MARCA_DOENTE;
    }
  },
};
