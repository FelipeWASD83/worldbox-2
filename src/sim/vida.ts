import type { Sistema } from '../core/sistemas.js';
import type { Mundo } from '../core/mundo.js';
import type { Causa } from '../core/eventos.js';
import { NIVEL_MAR } from '../core/grid.js';
import { ESP_DOMINIO, ESP_METABOLISMO, ESP_VIDA } from '../dados/especies.js';
import { B } from '../dados/biomas.js';
import { BAL } from './balanco.js';

/**
 * Envelhecimento, fome, cura e o que o ambiente faz com quem está em cima dele.
 *
 * Roda em todas as criaturas todo tick. É O(n) puro, sem consulta espacial, e
 * por isso cabe no orçamento mesmo com o mundo cheio.
 */
export const sistemaVida: Sistema = {
  id: 'vida',
  executar(mundo: Mundo): void {
    const c = mundo.criaturas;
    const g = mundo.grid;
    const limite = c.limite;
    const mortos: number[] = [];
    const causas: Causa[] = [];

    for (let i = 0; i < limite; i++) {
      if (!c.vivo[i]) continue;

      c.idade[i] += 1;
      if (c.esperaFilho[i] > 0) c.esperaFilho[i] -= 1;
      if (c.cdAtaque[i] > 0) c.cdAtaque[i] -= 1;

      if (c.idade[i] >= c.longevidade[i]) {
        mortos.push(i);
        causas.push('velhice');
        continue;
      }

      const esp = c.especie[i];
      c.fome[i] += BAL.fomePorTick * ESP_METABOLISMO[esp];

      let causa: Causa | null = null;

      if (c.fome[i] >= BAL.fomeCritica) {
        c.fome[i] = BAL.fomeCritica;
        c.vida[i] -= BAL.danoFome;
        causa = 'fome';
      } else if (c.fome[i] < 50 && c.vida[i] < ESP_VIDA[esp]) {
        c.vida[i] = Math.min(ESP_VIDA[esp], c.vida[i] + BAL.curaPorTick);
      }

      // --------------------------------------------------------- ambiente
      const tx = c.x[i] | 0;
      const ty = c.y[i] | 0;
      if (tx >= 0 && ty >= 0 && tx < g.largura && ty < g.altura) {
        const t = g.idx(tx, ty);
        const dominio = ESP_DOMINIO[esp];

        if (g.bioma[t] === B.lava) {
          c.vida[i] -= BAL.danoLava;
          causa = 'fogo';
        } else if (g.fogo[t] > 0 && dominio !== 2) {
          c.vida[i] -= BAL.danoFogo;
          causa = 'fogo';
        }

        if (dominio === 0 && g.alt[t] < NIVEL_MAR - 10) {
          // bicho de terra em água funda se afoga
          c.vida[i] -= BAL.danoAfogamento;
          causa = 'afogado';
        } else if (dominio === 1 && g.alt[t] >= NIVEL_MAR) {
          // peixe fora d'água
          c.vida[i] -= 4;
          causa = 'afogado';
        }
      }

      if (c.vida[i] <= 0) {
        mortos.push(i);
        causas.push(causa ?? 'fome');
      }
    }

    for (let k = 0; k < mortos.length; k++) mundo.matar(mortos[k], causas[k]);
  },
};
