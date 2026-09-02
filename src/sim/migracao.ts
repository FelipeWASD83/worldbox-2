import type { Sistema } from '../core/sistemas.js';
import type { Mundo } from '../core/mundo.js';
import { B, biomas } from '../dados/biomas.js';
import { ESPECIES_SELVAGENS, ESPECIES_FUNDADORAS, especies } from '../dados/especies.js';
import { nomeDeAldeia, nomeDeReino } from '../dados/nomes.js';
import { BIOMA_HABITAVEL } from '../dados/biomas.js';
import { BAL } from './balanco.js';
import { empossarChefes } from './politica.js';

/**
 * Migração: repõe espécies que ficaram à beira do fim.
 *
 * Um ecossistema fechado com predador e presa oscila muito, e no fundo de cada
 * oscilação alguém chega a zero — e de zero não se volta. O resultado é um
 * mundo que, com horas de jogo, sempre acaba com as mesmas três espécies.
 *
 * Aqui o mapa é tratado como um recorte de um mundo maior: quando uma espécie
 * fica rara demais, um pequeno grupo chega de fora e se instala num bioma que
 * lhe serve. A oscilação continua — o que deixa de existir é a extinção
 * definitiva por azar. Quem quiser ver espécies acabarem de vez desliga isso
 * nas opções do mundo.
 */
export const sistemaMigracao: Sistema = {
  id: 'migracao',
  intervalo: 500,
  executar(mundo: Mundo): void {
    if (!mundo.migracao) return;
    if (mundo.criaturas.cheio) return;

    const contagem = mundo.estatisticas.porEspecie;

    for (const idx of ESPECIES_SELVAGENS) {
      if (contagem[idx] >= BAL.pisoDaEspecie) continue;
      if (!mundo.rng.chance(BAL.chanceMigracao)) continue;

      const def = especies.porIndice(idx);
      const alvo = sortearLugar(mundo, def.biomas);
      if (alvo < 0) continue;

      const g = mundo.grid;
      const x = alvo % g.largura;
      const y = (alvo / g.largura) | 0;
      const quantos = mundo.rng.intEntre(3, 6);
      let entraram = 0;
      for (let k = 0; k < quantos; k++) {
        const c = mundo.nascer(
          idx,
          x + mundo.rng.entre(-2.5, 2.5),
          y + mundo.rng.entre(-2.5, 2.5),
          def.longevidade[0] * 0.2,
        );
        if (c < 0) break;
        entraram++;
      }
      if (entraram > 0) {
        mundo.eventos.emitir('especie:migrou', { especie: idx, x, y, quantos: entraram });
      }
    }

    refundarPovos(mundo);
  },
};

/**
 * Um povo varrido do mapa pode voltar a se estabelecer.
 *
 * Guerra entre reinos costuma terminar com um vencedor só, e sem isto toda
 * partida longa acabava com um único povo ocupando o mundo inteiro. Aqui os
 * derrotados podem reaparecer em outro canto, séculos depois — o que mantém a
 * disputa viva sem tirar do jogador o direito de exterminar alguém de vez
 * (basta desligar a migração ao criar o mundo).
 */
function refundarPovos(mundo: Mundo): void {
  const contagem = mundo.estatisticas.porEspecie;
  const g = mundo.grid;

  for (const idx of ESPECIES_FUNDADORAS) {
    if (contagem[idx] > 0) continue;
    if (!mundo.rng.chance(BAL.chanceRefundacao)) continue;

    const def = especies.porIndice(idx);
    const preferidos = new Set(def.povo?.prefereBiomas ?? def.biomas);

    let melhor = -1;
    let melhorNota = 0.6;
    for (let t = 0; t < 600; t++) {
      const i = mundo.rng.int(g.total);
      if (!g.ehTerra(i) || g.ehMontanha(i)) continue;
      if (g.territorio[i] >= 0) continue; // não nasce dentro de reino alheio
      const x = i % g.largura;
      const y = (i / g.largura) | 0;
      if (mundo.aldeiaMaisProxima(x, y, BAL.distanciaEntreAldeias) >= 0) continue;
      let nota = BIOMA_HABITAVEL[g.bioma[i]];
      if (nota <= 0.1) continue;
      const nomeBioma = nomeDoBioma(g.bioma[i]);
      if (preferidos.has(nomeBioma)) nota += 1.2;
      if (nota > melhorNota) {
        melhorNota = nota;
        melhor = i;
      }
    }
    if (melhor < 0) continue;

    const x = melhor % g.largura;
    const y = (melhor / g.largura) | 0;
    const reino = mundo.criarReino(idx, nomeDeReino(mundo.rng, def.id), def.povo?.corReino ?? 0x999999);
    const aldeia = mundo.criarAldeia(reino.id, idx, x, y, nomeDeAldeia(mundo.rng, def.id));
    reino.capital = aldeia.id;
    // Um povo que volta a se estabelecer nasce com o mesmo que os primeiros
    // reinos do mundo têm: uma casa real, uma casa rival para disputar com ela,
    // e um clã. Sem isso a coroa não teria linhagem para seguir e o reino
    // nasceria politicamente vazio.
    const casaReal = mundo.novaFamilia();
    const casaRival = mundo.novaFamilia();
    const cla = mundo.criarCla(idx).id;
    reino.casaReal = casaReal;
    for (let k = 0; k < 9; k++) {
      const c = mundo.nascer(
        idx,
        x + mundo.rng.entre(-2, 2),
        y + mundo.rng.entre(-2, 2),
        mundo.rng.entre(def.longevidade[0] * 0.16, def.longevidade[0] * 0.34),
      );
      if (c < 0) break;
      mundo.criaturas.aldeia[c] = aldeia.id;
      mundo.criaturas.reino[c] = reino.id;
      mundo.criaturas.familia[c] = k < 3 ? casaReal : casaRival;
      mundo.criaturas.cla[c] = cla;
      mundo.criaturas.riqueza[c] = k < 3 ? mundo.rng.entre(18, 30) : mundo.rng.entre(2, 10);
      aldeia.populacao++;
    }
    empossarChefes(mundo, aldeia);
    mundo.eventos.emitir('especie:migrou', { especie: idx, x, y, quantos: aldeia.populacao });
  }
}

const nomesDeBioma = biomas.todos().map((b) => b.id);
function nomeDoBioma(indice: number): string {
  return nomesDeBioma[indice] ?? '';
}

/**
 * Um tile qualquer que sirva à espécie. Sorteia pontos em vez de varrer o mapa:
 * o mundo tem dezenas de milhares de tiles e este sistema roda o tempo todo.
 */
function sortearLugar(mundo: Mundo, biomasAceitos: readonly string[]): number {
  const g = mundo.grid;
  const aceitos = new Set<number>();
  for (const id of biomasAceitos) {
    const idx = (B as Record<string, number>)[id];
    if (idx !== undefined) aceitos.add(idx);
  }
  if (aceitos.size === 0) return -1;

  for (let t = 0; t < 300; t++) {
    const i = mundo.rng.int(g.total);
    if (!aceitos.has(g.bioma[i])) continue;
    if (g.fogo[i] > 0) continue;
    return i;
  }
  return -1;
}
