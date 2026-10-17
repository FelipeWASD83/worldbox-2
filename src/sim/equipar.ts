import type { Sistema } from '../core/sistemas.js';
import type { Aldeia, Mundo } from '../core/mundo.js';
import { MARCA_SOLDADO } from '../core/criaturas.js';
import { ESP_INTELIGENTE } from '../dados/especies.js';
import {
  equipamentos, porEncaixe, EQ_TECNOLOGIA, type Encaixe, type Equipamento,
} from '../dados/equipamentos.js';
import type { Estoque, Material } from '../dados/materiais.js';
import { MATERIAIS } from '../dados/materiais.js';
import { nivelDeForja } from './civilizacao.js';
import { Oficio } from './profissoes.js';
import { BAL } from './balanco.js';

/**
 * Fabricação e distribuição de equipamento.
 *
 * É o ponto onde a economia vira poder militar: a aldeia gasta ferro, madeira
 * e carvão para armar quem vai lutar. Uma aldeia rica em comida e pobre em
 * ferro tem gente, mas manda gente de porrete contra espadas.
 *
 * O que cada um recebe é sempre o melhor que a aldeia sabe fazer e consegue
 * pagar naquele momento, então a diferença entre reinos aparece sozinha no
 * campo de batalha.
 */
const INTERVALO = 40;

export const sistemaEquipar: Sistema = {
  id: 'equipar',
  intervalo: INTERVALO,
  executar(mundo: Mundo): void {
    const c = mundo.criaturas;
    const limite = c.limite;

    for (let i = 0; i < limite; i++) {
      if (!c.vivo[i]) continue;
      if (ESP_INTELIGENTE[c.especie[i]] === 0) continue;
      const idAldeia = c.aldeia[i];
      if (idAldeia < 0) continue;
      const a = mundo.aldeias[idAldeia];
      if (!a?.ativa) continue;

      const soldado = (c.marcas[i] & MARCA_SOLDADO) !== 0;
      // Civil ganha só o básico para não morrer de graça; soldado leva o melhor
      // que a forja da aldeia alcança — e sem ferraria não se faz espada.
      const teto = soldado ? nivelDeForja(a) + 1 : 1;

      melhorar(mundo, a, i, 'arma', c.arma, teto);
      if (soldado) {
        melhorar(mundo, a, i, 'escudo', c.escudo, teto);
        melhorar(mundo, a, i, 'armadura', c.armadura, teto);
      }

    }
  },
};

/**
 * Troca a peça de um encaixe pela melhor que a aldeia pode pagar agora.
 * Só sobe: ninguém devolve a espada para pegar um porrete.
 */
function melhorar(
  mundo: Mundo,
  a: Aldeia,
  criatura: number,
  encaixe: Encaixe,
  campo: Uint8Array,
  tetoDeQualidade: number,
): void {
  const atual = campo[criatura];
  const forcaAtual = atual !== 0 ? forcaDe(equipamentos.porIndice(atual - 1)) : -1;

  let melhor: Equipamento | null = null;
  let indiceMelhor = -1;
  let ordem = 0;
  for (const def of porEncaixe(encaixe)) {
    ordem++;
    if (ordem > tetoDeQualidade) break;
    if (def.nivelMinimo > a.nivel) continue;
    // Saber forjar vem antes de ter com que forjar: um povo que ainda não
    // descobriu a metalurgia não faz espada por mais ferro que tenha no
    // celeiro. É o que separa a horda de porretes do exército de aço.
    if (!mundo.reinoSabe(a.reino, EQ_TECNOLOGIA[equipamentos.indice(def.id)])) continue;
    if (forcaDe(def) <= forcaAtual) continue;
    if (!temComQuePagar(a.estoque, def.custo, desconto(a))) continue;
    melhor = def;
    indiceMelhor = equipamentos.indice(def.id);
  }

  if (!melhor) return;
  pagar(a.estoque, melhor.custo, desconto(a));
  campo[criatura] = indiceMelhor + 1;
}

function forcaDe(e: Equipamento): number {
  return e.dano + e.defesa;
}

/**
 * Quanto os ferreiros da vila tiram do custo de cada peça, de 0 a 0,4.
 *
 * É a contagem pura de ferreiros, e não a perícia somada: o equipamento é
 * entregue de quarenta em quarenta ticks a cada morador, e varrer o pool para
 * somar perícia a cada peça seria a conta mais cara deste sistema.
 */
function desconto(a: Aldeia): number {
  return Math.min(0.4, a.oficios[Oficio.Ferreiro] * BAL.descontoPorFerreiro);
}

function temComQuePagar(estoque: Estoque, custo: Partial<Estoque>, desc: number): boolean {
  for (const m of MATERIAIS) {
    const quanto = custo[m];
    if (quanto !== undefined && estoque[m] < quanto * (1 - desc)) return false;
  }
  return true;
}

function pagar(estoque: Estoque, custo: Partial<Estoque>, desc: number): void {
  for (const m of MATERIAIS) {
    const quanto = custo[m as Material];
    if (quanto !== undefined) estoque[m] -= quanto * (1 - desc);
  }
}
