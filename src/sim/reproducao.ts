import type { Sistema } from '../core/sistemas.js';
import type { Mundo } from '../core/mundo.js';
import { Estado } from '../core/criaturas.js';
import { ESP_ESPERA_FILHO, ESP_INTELIGENTE, especies } from '../dados/especies.js';
import { BAL } from './balanco.js';

/**
 * Nascimentos ao ar livre — dos bichos.
 *
 * Um casal precisa estar junto, adulto, alimentado e fora do período de espera.
 * Superlotação local corta a reprodução — é o que evita a explosão de coelhos
 * que trava a simulação em dez minutos.
 *
 * Os seres inteligentes não passam por aqui: eles têm filho dentro de casa,
 * em `src/sim/moradia.ts`.
 */
export const sistemaReproducao: Sistema = {
  id: 'reproducao',
  executar(mundo: Mundo): void {
    const c = mundo.criaturas;
    const limite = c.limite;
    const dist2 = BAL.distanciaPar * BAL.distanciaPar;

    for (let i = 0; i < limite; i++) {
      if (!c.vivo[i]) continue;
      if (ESP_INTELIGENTE[c.especie[i]] === 1) continue;
      if (c.estado[i] !== Estado.Acasalando) continue;
      if (c.esperaFilho[i] > 0) continue;

      const par = c.alvo[i];
      if (par < 0 || !c.vivo[par] || par === i) continue;
      if (c.especie[par] !== c.especie[i]) continue;
      if (c.esperaFilho[par] > 0) continue;
      // só um dos dois conduz o nascimento, senão sai filho em dobro
      if (par < i) continue;

      const dx = c.x[par] - c.x[i];
      const dy = c.y[par] - c.y[i];
      if (dx * dx + dy * dy > dist2) continue;

      if (mundo.criaturas.cheio) continue;

      const esp = c.especie[i];
      const def = especies.porIndice(esp);
      const quantos = mundo.rng.intEntre(def.ninhada[0], def.ninhada[1]);
      for (let k = 0; k < quantos; k++) {
        const filho = mundo.nascer(
          esp,
          c.x[i] + mundo.rng.entre(-0.8, 0.8),
          c.y[i] + mundo.rng.entre(-0.8, 0.8),
          0,
        );
        if (filho < 0) break;
        // o filhote herda a casa dos pais
        c.aldeia[filho] = c.aldeia[i];
        c.reino[filho] = c.reino[i];
        if (c.aldeia[i] >= 0) {
          const a = mundo.aldeias[c.aldeia[i]];
          if (a?.ativa) a.populacao++;
        }
      }

      const espera = ESP_ESPERA_FILHO[esp];
      c.esperaFilho[i] = espera;
      c.esperaFilho[par] = espera;
      c.fome[i] += 12;
      c.fome[par] += 12;
      c.estado[i] = Estado.Vagando;
      c.estado[par] = Estado.Vagando;
      c.alvo[i] = -1;
      c.alvo[par] = -1;
    }
  },
};
