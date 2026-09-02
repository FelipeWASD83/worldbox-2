import type { Sistema } from '../core/sistemas.js';
import type { Mundo } from '../core/mundo.js';
import { especies } from '../dados/especies.js';
import { BAL } from './balanco.js';

/**
 * Relações entre reinos: atrito de fronteira, declaração de guerra e paz.
 *
 * Roda raramente (a cada `intervaloDiplomacia` ticks) porque decisão política
 * não precisa de resolução de tick, e porque medir fronteira custa uma
 * varredura do território.
 */
export const sistemaDiplomacia: Sistema = {
  id: 'diplomacia',
  intervalo: BAL.intervaloDiplomacia,
  executar(mundo: Mundo): void {
    const ativos = mundo.reinos.filter((r) => r.ativo);
    if (ativos.length < 2) return;

    const fronteiras = medirFronteiras(mundo);
    const vizinhanca = medirVizinhanca(mundo);

    for (let a = 0; a < ativos.length; a++) {
      for (let b = a + 1; b < ativos.length; b++) {
        const ra = ativos[a];
        const rb = ativos[b];
        const chave = ra.id * 1000 + rb.id;
        const contato = fronteiras.get(chave) ?? 0;
        // territórios podem não se tocar e os povos já se incomodarem: basta
        // haver aldeia de um perto de aldeia do outro
        const vizinhos = vizinhanca.get(chave) ?? 0;
        const roce = contato + vizinhos * 25;

        const povoA = especies.porIndice(ra.especie).povo;
        const povoB = especies.porIndice(rb.especie).povo;
        const belicosidade = ((povoA?.beligerancia ?? 0.5) + (povoB?.beligerancia ?? 0.5)) / 2;

        if (roce > 0) {
          // quanto maior o roçar de fronteira, mais rápido a relação azeda
          mundo.mudarRelacao(ra.id, rb.id, BAL.atritoFronteira * Math.min(3, roce / 40) * belicosidade * 2);
        } else {
          mundo.mudarRelacao(ra.id, rb.id, BAL.aproximacaoNatural * (1 - belicosidade));
        }

        // O estranhamento entre povos diferentes só pesa quando eles se
        // esbarram. À distância, ninguém odeia quem nunca viu — e sem isso a
        // relação entre espécies diferentes nunca subia o bastante para haver
        // uma aliança no mundo inteiro.
        if (roce > 0) {
          mundo.mudarRelacao(ra.id, rb.id, ra.especie !== rb.especie ? -0.8 : 0.6);
        } else if (ra.especie === rb.especie) {
          mundo.mudarRelacao(ra.id, rb.id, 0.8);
        }

        const rel = mundo.relacao(ra.id, rb.id);

        if (mundo.emGuerra(ra.id, rb.id)) {
          // guerra cansa: quanto mais fraca a parte, mais chance de aceitar paz
          const exausto = ra.populacao < 6 || rb.populacao < 6;
          if (rel > BAL.limiarPaz || (exausto && mundo.rng.chance(0.5)) || mundo.rng.chance(0.06)) {
            mundo.fazerPaz(ra.id, rb.id);
          }
        } else if (rel < BAL.limiarGuerra && roce > 0) {
          if (mundo.rng.chance(0.25 + belicosidade * 0.5)) {
            mundo.declararGuerra(ra.id, rb.id);
          }
        } else if (rel > BAL.limiarAlianca && !mundo.saoAliados(ra.id, rb.id)) {
          // povos que se dão bem por tempo bastante acabam assinando aliança
          if (mundo.rng.chance(0.3)) mundo.firmarAlianca(ra.id, rb.id);
        } else if (rel < BAL.limiarRomper && mundo.saoAliados(ra.id, rb.id)) {
          mundo.romperAlianca(ra.id, rb.id);
        }
      }
    }
  },
};

/**
 * Conta quantos tiles de cada par de reinos se tocam.
 * Uma varredura só do mapa, olhando o vizinho da direita e o de baixo.
 */
function medirFronteiras(mundo: Mundo): Map<number, number> {
  const g = mundo.grid;
  const contagem = new Map<number, number>();

  for (let y = 0; y < g.altura; y++) {
    for (let x = 0; x < g.largura; x++) {
      const i = y * g.largura + x;
      const dono = g.territorio[i];
      if (dono < 0) continue;
      if (x + 1 < g.largura) somar(contagem, dono, g.territorio[i + 1]);
      if (y + 1 < g.altura) somar(contagem, dono, g.territorio[i + g.largura]);
    }
  }
  return contagem;
}

/**
 * Conta quantos pares de aldeias de reinos diferentes estão perto o bastante
 * para haver disputa por terra e caça.
 */
function medirVizinhanca(mundo: Mundo): Map<number, number> {
  const contagem = new Map<number, number>();
  const perto = BAL.distanciaDeAtrito * BAL.distanciaDeAtrito;
  const ativas = mundo.aldeias.filter((a) => a.ativa);
  for (let i = 0; i < ativas.length; i++) {
    for (let j = i + 1; j < ativas.length; j++) {
      const a = ativas[i];
      const b = ativas[j];
      if (a.reino === b.reino) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (dx * dx + dy * dy > perto) continue;
      somar(contagem, a.reino, b.reino);
    }
  }
  return contagem;
}

function somar(m: Map<number, number>, a: number, b: number): void {
  if (b < 0 || a === b) return;
  const chave = a < b ? a * 1000 + b : b * 1000 + a;
  m.set(chave, (m.get(chave) ?? 0) + 1);
}
