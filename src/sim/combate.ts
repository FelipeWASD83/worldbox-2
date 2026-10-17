import type { Sistema } from '../core/sistemas.js';
import type { Mundo } from '../core/mundo.js';
import { Estado } from '../core/criaturas.js';
import { ESP_CACA, ESP_DANO, ESP_MARCIAL, TOTAL_ESPECIES } from '../dados/especies.js';
import { Campo } from '../dados/tracos.js';
import { fator } from './genetica.js';
import { EQ_ALCANCE, EQ_DANO, EQ_DEFESA } from '../dados/equipamentos.js';
import { BAL } from './balanco.js';
import { indiceDoMaterial } from './coleta.js';
import { MARCA_SOLDADO } from '../core/criaturas.js';
import { ED } from '../dados/edificios.js';

const INDICE_COMIDA = indiceDoMaterial('comida');

/**
 * Resolve golpes entre criaturas que já estão coladas no alvo.
 *
 * A decisão de brigar é da IA; aqui só se aplica dano, se decide quem morreu e
 * se converte presa em refeição.
 */
export const sistemaCombate: Sistema = {
  id: 'combate',
  executar(mundo: Mundo): void {
    const c = mundo.criaturas;
    const limite = c.limite;

    for (let i = 0; i < limite; i++) {
      if (!c.vivo[i]) continue;
      const estado = c.estado[i];
      if (estado !== Estado.Atacando && estado !== Estado.Cacando) continue;
      if (c.cdAtaque[i] > 0) continue;

      const alvo = c.alvo[i];
      if (alvo < 0 || !c.vivo[alvo]) continue;

      // arma comprida alcança de mais longe; o arco atira de sete tiles
      const arma = c.arma[i];
      const alcance = arma !== 0 ? Math.max(BAL.alcanceGolpe, EQ_ALCANCE[arma - 1]) : BAL.alcanceGolpe;
      const dx = c.x[alvo] - c.x[i];
      const dy = c.y[alvo] - c.y[i];
      if (dx * dx + dy * dy > alcance * alcance) continue;

      const esp = c.especie[i];
      let dano = ESP_DANO[esp] * ESP_MARCIAL[esp] * fator(c.tracos[i], Campo.dano);
      if (arma !== 0) dano += EQ_DANO[arma - 1];
      // veterania: cada luta deixa a criatura um pouco melhor (teto de +50%)
      dano *= 1 + Math.min(0.5, c.xp[i] * 0.02);
      // soldado que saiu de vila com quartel bate mais: é tropa treinada
      if ((c.marcas[i] & MARCA_SOLDADO) !== 0 && c.aldeia[i] >= 0) {
        const casa = mundo.aldeias[c.aldeia[i]];
        if (casa?.ativa && casa.predios[ED.quartel] > 0) dano *= BAL.danoComQuartel;
      }
      if (c.reino[i] >= 0 && c.reino[alvo] >= 0 && mundo.emGuerra(c.reino[i], c.reino[alvo])) {
        dano *= BAL.bonusGuerra;
      }

      // escudo e armadura tiram do golpe, mas nunca o anulam de todo
      let defesa = 0;
      if (c.escudo[alvo] !== 0) defesa += EQ_DEFESA[c.escudo[alvo] - 1];
      if (c.armadura[alvo] !== 0) defesa += EQ_DEFESA[c.armadura[alvo] - 1];
      const sofrido = Math.max(dano * 0.15, dano - defesa);

      c.vida[alvo] -= sofrido;
      c.cdAtaque[i] = BAL.esperaGolpe;
      c.xp[i] += 1;

      // quem apanha revida ou foge
      if (c.vivo[alvo] && c.alvo[alvo] < 0) {
        const espAlvo = c.especie[alvo];
        const podeComer = ESP_CACA[espAlvo * TOTAL_ESPECIES + esp] === 1;
        c.alvo[alvo] = i;
        c.estado[alvo] = podeComer || ESP_DANO[espAlvo] > ESP_DANO[esp] * 0.6
          ? Estado.Atacando
          : Estado.Fugindo;
      }

      if (c.vida[alvo] <= 0) {
        const espAlvo = c.especie[alvo];
        const comeu = ESP_CACA[esp * TOTAL_ESPECIES + espAlvo] === 1;
        if (comeu) {
          c.fome[i] = Math.max(0, c.fome[i] - BAL.saciaCarne);
          // caçador de aldeia leva parte da caça para casa
          // a caça só entra na carga se ela já não estiver cheia de outra
          // coisa: senão o minério que o caçador levava virava carne
          if (c.aldeia[i] >= 0 && (c.carga[i] === 0 || c.cargaMaterial[i] === INDICE_COMIDA)) {
            c.cargaMaterial[i] = INDICE_COMIDA;
            c.carga[i] += BAL.cargaTrabalho * 0.6;
          }
        }
        mundo.matar(alvo, comeu ? 'predado' : 'combate', i);
        c.alvo[i] = -1;
        c.estado[i] = Estado.Vagando;
      }
    }
  },
};
