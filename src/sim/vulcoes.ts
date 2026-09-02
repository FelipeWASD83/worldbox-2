import type { Sistema } from '../core/sistemas.js';
import type { Mundo } from '../core/mundo.js';
import { NIVEL_MAR } from '../core/grid.js';
import { B } from '../dados/biomas.js';
import { BAL } from './balanco.js';
import { atear } from './ecologia.js';
import { ancoraDaConstrucao, derrubar } from './urbanismo.js';

/**
 * Vulcões em atividade.
 *
 * Uma cratera cospe bombas de lava para o alto; elas voam alguns tiles e, onde
 * caem, deixam lava nova. É o que transforma o vulcão de mancha colorida no
 * mapa em coisa viva, e o que faz uma região vizinha a ele ser perigosa de
 * verdade — a lava avança sozinha, queima a mata e derruba o que estiver no
 * caminho.
 *
 * As bombas são simuladas com altura própria: sobem, perdem impulso e caem.
 * Enquanto voam não afetam nada, e é por isso que dá para vê-las passar por
 * cima do terreno antes de acertar o chão.
 */

/** Uma bomba de lava no ar. */
export interface BombaDeLava {
  x: number;
  y: number;
  /** Deslocamento por tick, em tiles. */
  vx: number;
  vy: number;
  /** Altura acima do chão, em tiles. Chega a zero quando cai. */
  z: number;
  vz: number;
}

export const sistemaVulcoes: Sistema = {
  id: 'vulcoes',
  executar(mundo: Mundo): void {
    lancar(mundo);
    voar(mundo);
  },
};

/** De tempos em tempos, uma cratera entra em erupção. */
function lancar(mundo: Mundo): void {
  if (mundo.vulcoes.length === 0) return;
  if (mundo.tick % BAL.intervaloErupcao !== 0) return;
  if (!mundo.rng.chance(BAL.chanceErupcao)) return;
  if (mundo.bombas.length > BAL.maxBombas) return;

  const g = mundo.grid;
  const centro = mundo.vulcoes[mundo.rng.int(mundo.vulcoes.length)];
  const cx = (centro % g.largura) + 0.5;
  const cy = ((centro / g.largura) | 0) + 0.5;

  const quantas = mundo.rng.intEntre(BAL.bombasPorErupcao[0], BAL.bombasPorErupcao[1]);
  for (let k = 0; k < quantas; k++) {
    const ang = mundo.rng.f() * Math.PI * 2;
    const forca = mundo.rng.entre(0.06, 0.2);
    mundo.bombas.push({
      x: cx,
      y: cy,
      vx: Math.cos(ang) * forca,
      vy: Math.sin(ang) * forca,
      z: 0,
      vz: mundo.rng.entre(0.12, 0.26),
    });
  }
  mundo.eventos.emitir('vulcao:erupcao', {
    x: cx | 0,
    y: cy | 0,
    bombas: quantas,
  });
}

/** Move as bombas no ar e resolve as que caíram. */
function voar(mundo: Mundo): void {
  const g = mundo.grid;
  const bombas = mundo.bombas;

  for (let k = bombas.length - 1; k >= 0; k--) {
    const b = bombas[k];
    b.x += b.vx;
    b.y += b.vy;
    b.z += b.vz;
    b.vz -= BAL.gravidadeBomba;

    const foraDoMapa = b.x < 0 || b.y < 0 || b.x >= g.largura || b.y >= g.altura;
    if (b.z > 0 && !foraDoMapa) continue;

    // caiu (ou saiu do mapa)
    bombas.splice(k, 1);
    if (foraDoMapa) continue;
    cair(mundo, g.idx(b.x | 0, b.y | 0));
  }
}

/** O que a lava faz onde acerta. */
function cair(mundo: Mundo, i: number): void {
  const g = mundo.grid;
  if (g.ehAgua(i)) {
    // lava no mar vira rocha nova: a ilha cresce
    g.alt[i] = NIVEL_MAR + 2;
    g.bioma[i] = B.vulcao;
    g.marcarSujoIdx(i);
    return;
  }

  const alvo = ancoraDaConstrucao(mundo, i);
  if (alvo >= 0) derrubar(mundo, alvo, false);
  g.limparRecurso(i);
  g.bioma[i] = B.lava;
  g.vegetacao[i] = 0;
  g.fogo[i] = 0;
  mundo.chamas.delete(i);
  g.marcarSujoIdx(i);

  // o calor acende o que estiver em volta
  const viz = mundo.bufVizinhos;
  const n = g.vizinhos8(i % g.largura, (i / g.largura) | 0, viz);
  for (let k = 0; k < n; k++) {
    if (mundo.rng.chance(0.12)) atear(mundo, viz[k]);
  }

  // e queima quem estiver por perto
  const c = mundo.criaturas;
  mundo.espacial.aoRedor((i % g.largura) + 0.5, ((i / g.largura) | 0) + 0.5, 1.6, (id) => {
    if (!c.vivo[id]) return;
    c.vida[id] -= BAL.danoBomba;
    if (c.vida[id] <= 0) mundo.matar(id, 'desastre');
  });
}
