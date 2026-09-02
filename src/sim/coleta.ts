import type { Sistema } from '../core/sistemas.js';
import type { Aldeia, Mundo } from '../core/mundo.js';
import { Estado } from '../core/criaturas.js';
import { ESP_INTELIGENTE } from '../dados/especies.js';
import { REC_MATERIAL, REC_NIVEL, REC_POR_COLHEITA } from '../dados/recursos.js';
import { MATERIAIS, type Material } from '../dados/materiais.js';
import { BAL } from './balanco.js';
import { focoDe } from './comandos.js';

/**
 * Extração de recursos pelos seres inteligentes.
 *
 * É o que separa uma civilização de um bando: o bicho come o que acha na
 * frente; o inteligente vai atrás do que a aldeia dele precisa, derruba a
 * árvore, quebra a pedra, cava o veio de ferro e leva para casa.
 *
 * A escolha do que buscar é da IA (`src/sim/ia.ts`); aqui se resolve a
 * chegada: quem parou em cima de um recurso o explora e enche a carga.
 */

/** Índice de cada material na lista `MATERIAIS`, para caber num byte. */
const INDICE_MATERIAL = new Map<Material, number>(MATERIAIS.map((m, i) => [m, i]));

export function indiceDoMaterial(m: Material): number {
  return INDICE_MATERIAL.get(m) ?? 0;
}

export function materialPorIndice(i: number): Material {
  return MATERIAIS[i] ?? 'comida';
}

/**
 * O que a aldeia mais precisa agora.
 *
 * A ordem é a de uma comunidade real: comer primeiro, depois material de obra,
 * e só então o minério que vira ferramenta, arma e riqueza.
 */
export function oQueFalta(a: Aldeia): Material | null {
  const pop = Math.max(1, a.populacao);
  const teto = a.capacidadeEstoque;

  // O jogador pode ter mandado a aldeia puxar para um lado. Mesmo assim a fome
  // vem antes de tudo: um exército sem comida não chega ao campo de batalha.
  const foco = focoDe(a);
  if (a.estoque.comida < pop * 6 + 25) return 'comida';
  if (foco === 'comida' && a.estoque.comida < teto) return 'comida';
  if (foco === 'exercito') {
    if (a.nivel >= 2 && a.estoque.ferro < teto) return 'ferro';
    if (a.nivel >= 2 && a.estoque.carvao < teto * 0.6) return 'carvao';
  }
  if (foco === 'obras') {
    if (a.estoque.madeira < teto) return 'madeira';
    if (a.nivel >= 2 && a.estoque.pedra < teto) return 'pedra';
  }

  // comida primeiro, e com folga: é o que sustenta a população
  if (a.estoque.comida < Math.min(teto, pop * 12 + 60)) return 'comida';
  if (a.estoque.madeira < Math.min(teto, pop * 6 + 40)) return 'madeira';
  if (a.nivel >= 2 && a.estoque.pedra < Math.min(teto, pop * 4 + 25)) return 'pedra';
  if (a.nivel >= 2 && a.estoque.ferro < Math.min(teto, pop * 3 + 20)) return 'ferro';
  if (a.nivel >= 2 && a.estoque.carvao < Math.min(teto, pop * 2 + 12)) return 'carvao';
  if (a.nivel >= 3 && a.estoque.ouro < Math.min(teto, pop * 1.5)) return 'ouro';

  // Com tudo em ordem, ninguém sai para trabalhar. Sem esta saída a aldeia
  // acumulava dezenas de milhares de unidades de tudo, porque o trabalhador
  // nunca tinha motivo para parar.
  return null;
}

/**
 * Procura um tile com o recurso pedido e manda a criatura para lá.
 *
 * Sorteia pontos em vez de varrer: a aldeia inteira faz esta pergunta o tempo
 * todo, e varrer o território a cada decisão seria o sistema mais caro do jogo.
 */
export function procurarRecurso(
  mundo: Mundo,
  i: number,
  material: Material,
  raio: number,
  nivelAldeia: number,
): boolean {
  const c = mundo.criaturas;
  const g = mundo.grid;
  let melhorX = -1;
  let melhorY = -1;
  let melhorNota = 0;

  for (let t = 0; t < 16; t++) {
    const x = g.prenderX((c.x[i] + mundo.rng.entre(-raio, raio)) | 0);
    const y = g.prenderY((c.y[i] + mundo.rng.entre(-raio, raio)) | 0);
    const idx = g.idx(x, y);
    const r = g.recurso[idx];
    if (r === 0 || g.recursoQtd[idx] < 4) continue;
    if (g.fogo[idx] > 0) continue;
    if (REC_MATERIAL[r - 1] !== material) continue;
    // veio de ferro e de ouro exigem uma aldeia organizada
    if (REC_NIVEL[r - 1] > nivelAldeia) continue;

    // mais cheio e mais perto pontua melhor
    const dist = Math.hypot(x - c.x[i], y - c.y[i]);
    const nota = g.recursoQtd[idx] - dist * 1.5;
    if (nota > melhorNota) {
      melhorNota = nota;
      melhorX = x;
      melhorY = y;
    }
  }

  if (melhorX < 0) return false;
  c.destinoX[i] = melhorX;
  c.destinoY[i] = melhorY;
  c.estado[i] = Estado.Trabalhando;
  c.alvo[i] = -1;
  return true;
}

/**
 * Quem chegou em cima do recurso o explora.
 *
 * Roda todo tick porque é um laço simples e precisa ser responsivo — lenhador
 * parado ao lado da árvore fica esquisito.
 */
export const sistemaColeta: Sistema = {
  id: 'coleta',
  executar(mundo: Mundo): void {
    const c = mundo.criaturas;
    const g = mundo.grid;
    const limite = c.limite;

    for (let i = 0; i < limite; i++) {
      if (!c.vivo[i]) continue;
      if (ESP_INTELIGENTE[c.especie[i]] === 0) continue;
      if (c.estado[i] !== Estado.Trabalhando) continue;
      if (c.carga[i] >= BAL.cargaTrabalho) continue;

      const tx = c.x[i] | 0;
      const ty = c.y[i] | 0;
      if (tx < 0 || ty < 0 || tx >= g.largura || ty >= g.altura) continue;
      const t = g.idx(tx, ty);
      const r = g.recurso[t];
      if (r === 0 || g.recursoQtd[t] <= 0) continue;

      const material = REC_MATERIAL[r - 1];
      const indice = indiceDoMaterial(material);
      // carga é de um material só: chegando noutro tipo, entrega o que tem antes
      if (c.carga[i] > 0 && c.cargaMaterial[i] !== indice) continue;

      const tirado = g.colher(t, REC_POR_COLHEITA[r - 1]);
      if (tirado <= 0) continue;
      c.cargaMaterial[i] = indice;
      c.carga[i] += tirado;

      if (c.carga[i] >= BAL.cargaTrabalho) {
        // cheio: volta para casa
        const a = c.aldeia[i] >= 0 ? mundo.aldeias[c.aldeia[i]] : undefined;
        if (a?.ativa) {
          c.destinoX[i] = a.x;
          c.destinoY[i] = a.y;
          c.estado[i] = Estado.Voltando;
        }
      }
    }
  },
};
